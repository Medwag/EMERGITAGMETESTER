// backend/paystackSubscription.jsw
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { sendDiscordAlert } from 'backend/discord-utils.jsw'; // optional
import { resolvePlanAmountZar, resolvePaystackPlanCode } from './plan-utils.jsw';

// Toggle live/test
const useLiveMode = false; // set to true in production

async function getSecretKey() {
  const keyName = useLiveMode ? "Live_Secret_Key" : "Test_Secret_Key";
  const secretKey = await getSecret(keyName);
  if (!secretKey) throw new Error(`Paystack secret "${keyName}" not configured.`);
  return secretKey;
}

/**
 * Create an initial Paystack transaction for the first subscription payment.
 * Frontend must pass metadata { userId, email, planName, cycle }.
 * Returns authorization_url (checkout link).
 */
export async function createPaystackSubscriptionLink(planName, isAnnual = false, metadata = {}) {
  try {
    if (!metadata || !metadata.userId || !metadata.email) {
      throw new Error("Missing metadata.userId or metadata.email (frontend must pass these).");
    }

    const secretKey = await getSecretKey();

    // Lookup plan row in CMS (PlanOptions). Try planName or planTier
    const planQuery = await wixData.query("PlanOptions").or(
      wixData.query("PlanOptions").eq("planName", planName),
      wixData.query("PlanOptions").eq("planTier", planName)
    ).limit(1).find({ suppressAuth: true });
    if (!planQuery.items.length) throw new Error(`Plan "${planName}" not found in PlanOptions collection.`);
    const plan = planQuery.items[0];

    // Determine price using shared helpers (ZAR)
    const priceZAR = resolvePlanAmountZar(plan, isAnnual ? 'Annual' : 'Monthly');
    if (!priceZAR || isNaN(priceZAR)) throw new Error(`Price for plan "${planName}" not configured correctly.`);

    const amount = Math.round(priceZAR * 100); // convert ZAR to kobo (integer)

    const initBody = {
      email: metadata.email,
      amount,
      currency: "ZAR",
      metadata: {
        ...metadata,
        planName,
        cycle: isAnnual ? "Annual" : "Monthly",
        transaction_type: "first_payment"
      },
      callback_url: "https://www.emergitag.me/subscription-confirmation" // page that will verify
    };

    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(initBody)
    });

    const result = await resp.json();
    if (!resp.ok || !result.status) {
      const errMsg = result?.message || `Paystack init failed with status ${resp.status}`;
      console.error("❌ Paystack init response:", result);
      throw new Error(errMsg);
    }

    // Save pending transaction for idempotency & lookup
    const tx = {
      _id: result.data.reference,
      reference: result.data.reference,
      userId: metadata.userId,
      email: metadata.email,
      amount: amount / 100,
      status: "pending",
      transactionType: "first_payment",
      createdAt: new Date()
    };

    try {
      await wixData.insert("PaystackTransactions", tx, { suppressAuth: true });
    } catch (e) {
      // If insert fails due to duplicate key or permission, warn but continue
      console.warn("⚠️ Could not insert PaystackTransactions record:", e?.message || e);
    }

    return result.data.authorization_url;
  } catch (err) {
    console.error("❌ createPaystackSubscriptionLink error:", err);
    await sendDiscordAlert?.(`❌ createPaystackSubscriptionLink error: ${err.message}`);
    throw err;
  }
}

/**
 * Verify a Paystack transaction reference. If it's a first_payment, create the subscription automatically.
 * Returns result object summarizing verification.
 */
export async function verifySubscriptionPayment(reference) {
  try {
    if (!reference) throw new Error("Missing reference.");

    const secretKey = await getSecretKey();
    const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }
    });

    if (!verifyResp.ok) {
      const text = await verifyResp.text();
      throw new Error(`Paystack verify failed: ${verifyResp.status} ${text}`);
    }

    const verifyJson = await verifyResp.json();
    if (!verifyJson.status) throw new Error(verifyJson.message || "Paystack verification failed");

    const tx = verifyJson.data;

    // Update local transaction record
    try {
      const updateObj = {
        _id: tx.reference,
        reference: tx.reference,
        status: tx.status === "success" ? "success" : "failed",
        paidAt: tx.paid_at ? new Date(tx.paid_at * 1000) : new Date(), // paystack returns timestamp sometimes
        paystackRaw: tx
      };
      // Use upsert semantics: try to insert, else update
      try {
        await wixData.insert("PaystackTransactions", updateObj, { suppressAuth: true });
      } catch (insertErr) {
        // if exists, update
        try {
          await wixData.update("PaystackTransactions", updateObj, { suppressAuth: true });
        } catch (uErr) {
          console.warn("⚠️ Could not upsert PaystackTransactions:", uErr);
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed to persist PaystackTransactions update:", e?.message || e);
    }

    // If successful and transaction_type === first_payment, create real subscription on Paystack
    const isFirstPayment = tx?.metadata?.transaction_type === "first_payment" || tx?.metadata?.transactionType === "first_payment";

    if (tx.status === "success" && isFirstPayment) {
      try {
        await handleFirstPaymentSuccess(tx);
      } catch (e) {
        console.warn("⚠️ handleFirstPaymentSuccess failed:", e?.message || e);
      }
    }

    return { success: tx.status === "success", data: tx };
  } catch (err) {
    console.error("❌ verifySubscriptionPayment error:", err);
    throw err;
  }
}

/**
 * Create a Paystack customer (if none) and create a subscription using Paystack's subscription endpoint.
 * This function assumes the initial transaction succeeded and card is authorized.
 */
export async function handleFirstPaymentSuccess(paystackData) {
  try {
    // paystackData should be the 'data' object from Paystack
    const metadata = paystackData?.metadata || {};
    const userId = metadata?.userId;
    const email = paystackData?.customer?.email || metadata?.email;
    const planName = metadata?.planName;
    const cycle = metadata?.cycle || metadata?.cycle; // "Monthly" or "Annual"

    if (!userId) {
      console.warn("⚠️ handleFirstPaymentSuccess: missing userId in metadata, aborting subscription creation.");
      return;
    }

    // Load or create profile
    let profileQuery = await wixData.query("Emergency_Profiles").eq("_owner", userId).limit(1).find({ suppressAuth: true });
    let profile = profileQuery.items[0];

    if (!profile) {
      const publicViewId = await cryptoRandomUUID();
      profile = await wixData.insert("Emergency_Profiles", {
        _owner: userId,
        userId,
        emailAddress: email || "unknown@example.com",
        publicViewId: publicViewId,
        dateCreated: new Date()
      }, { suppressAuth: true });
    }

    // Ensure we have (or create) a Paystack customer for this profile
    const secretKey = await getSecretKey();

    if (!profile.paystackCustomerCode) {
      // Create customer on Paystack
      const createCustBody = {
        email: profile.emailAddress || email,
        first_name: (profile.fullName || "Member").split(" ")[0] || "",
        last_name: (profile.fullName || "").split(" ").slice(1).join(" ") || "",
        phone: profile.phone || null
      };

      const custResp = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(createCustBody)
      });
      const custJson = await custResp.json();
      if (!custResp.ok || !custJson.status) {
        console.warn("⚠️ Paystack customer creation failed:", custJson);
        // Continue (maybe customer already exists), but we cannot create subscription if no customer_code
      } else {
        profile.paystackCustomerCode = custJson.data.customer_code;
        try {
          await wixData.update("Emergency_Profiles", profile, { suppressAuth: true });
        } catch (e) {
          console.warn("⚠️ Failed to save paystackCustomerCode on profile:", e);
        }
      }
    }

    if (!profile.paystackCustomerCode) {
      throw new Error("No paystackCustomerCode available for subscription creation.");
    }

    // Lookup plan code using helper
    const planQuery2 = await wixData.query("PlanOptions").or(
      wixData.query("PlanOptions").eq("planName", planName),
      wixData.query("PlanOptions").eq("planTier", planName)
    ).limit(1).find({ suppressAuth: true });
    if (!planQuery2.items.length) throw new Error(`Plan "${planName}" not found in PlanOptions collection.`);
    const planObj = planQuery2.items[0];
    const planCode = resolvePaystackPlanCode(planObj, cycle);

    if (!planCode) throw new Error(`Paystack plan code missing for "${planName}" (${cycle}).`);

    // Create subscription on Paystack
    const subscriptionBody = {
      customer: profile.paystackCustomerCode,
      plan: planCode,
      metadata: { userId, planName, cycle }
    };

    const subResp = await fetch("https://api.paystack.co/subscription", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(subscriptionBody)
    });

    const subJson = await subResp.json();
    if (!subResp.ok || !subJson.status) {
      console.error("❌ Paystack subscription creation failed:", subJson);
      throw new Error(subJson.message || "Paystack subscription creation failed");
    }

    // Persist subscription info to profile
    profile.paystackSubscriptionCode = subJson.data.subscription_code || subJson.data.subscription_code || subJson.data.sub_code || null;
    profile.planStatus = "active";
    profile.membershipTier = planName;
    profile.lastPaymentDate = new Date();

    try {
      await wixData.update("Emergency_Profiles", profile, { suppressAuth: true });
    } catch (e) {
      console.warn("⚠️ Failed to update Emergency_Profiles after subscription creation:", e);
    }

    // Update PaystackTransactions record's status (if exists)
    try {
      await wixData.update("PaystackTransactions", {
        _id: paystackData.reference,
        status: "success",
        paidAt: new Date()
      }, { suppressAuth: true });
    } catch (e) {
      console.warn("⚠️ Could not update PaystackTransactions record:", e);
    }

    return subJson.data;
  } catch (err) {
    console.error("❌ handleFirstPaymentSuccess error:", err);
    await sendDiscordAlert?.(`❌ handleFirstPaymentSuccess error: ${err.message}`);
    throw err;
  }
}

/* small helper because wix backend sometimes doesn't include crypto.randomUUID */
async function cryptoRandomUUID() {
  // Use safe crypto import with fallback for uniqueness
  try {
    const crypto = await import('crypto');
    return crypto.randomUUID();
  } catch (e) {
    return `pv_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  }
}
