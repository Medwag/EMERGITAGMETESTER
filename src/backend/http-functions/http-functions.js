// backend/http-functions.js
import { ok, badRequest } from 'wix-http-functions';
import { validatePayFastIPN } from 'backend/payfast-validation.jsw';
import wixData from 'wix-data';

export async function post_notify(request) {
  const body = await request.body.text();
  const ipnParams = Object.fromEntries(new URLSearchParams(body));
  const isValid = await validatePayFastIPN(ipnParams);

  // Prepare and log the payment data to the CMS
  const logEntry = {
    userId: ipnParams.custom_str1 ?? null,
    membershipTier: ipnParams.custom_str2 ?? null,
    status: ipnParams.payment_status ?? "UNKNOWN",
    pfPaymentId: ipnParams.pf_payment_id ?? null,
    paymentType: ipnParams.custom_str2 === "signup" ? "signup" : "subscription",
    valid: isValid,
    rawData: JSON.stringify(ipnParams),
    createdAt: new Date()
  };

  try {
    await wixData.insert("PayFast_Logs", logEntry);
  } catch (logError) {
    console.error("❌ Failed to log PayFast IPN:", logError);
  }

  // Stop if the IPN is invalid
  if (!isValid) {
    console.warn("🚫 Invalid IPN detected:", ipnParams);
    return badRequest({ body: { message: "Invalid IPN" } });
  }

  // Only process payments marked as COMPLETE
  if (ipnParams.payment_status === "COMPLETE") {
    const userId = ipnParams.custom_str1;
    const paymentType = ipnParams.custom_str2;

    try {
      if (paymentType === "signup") {
        // Mark the user's profile as having paid the signup fee
        const profileResult = await wixData.query("Emergency_Profiles")
          .eq("_owner", userId)
          .limit(1)
          .find();

        if (profileResult.items.length > 0) {
          const profile = profileResult.items[0];
          profile.signUpPaid = true;
          await wixData.update("Emergency_Profiles", profile);
          console.log("✅ Sign-up fee marked as paid for user:", userId);
        } else {
          console.warn("⚠️ No matching Emergency_Profile found for user:", userId);
        }

      } else {
        // Handle subscription-based membership updates
        await wixData.update("Emergency_Profiles", {
          _id: userId,
          membershipTier: paymentType,
          paymentStatus: "paid"
        });
        console.log("✅ Subscription updated for user:", userId);
      }
    } catch (error) {
      console.error("❌ Error updating Emergency_Profiles:", error);
    }
  }

  return ok({ body: { received: true } });
}
