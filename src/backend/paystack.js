import wixData from 'wix-data';
import { verifyPaystackTransaction, upsertEmergencyProfile } from 'backend/paystack-utils.jsw';


/**
 * ✅ Paystack Webhook Handler
 * This is called by Paystack after every event (must be set in Paystack dashboard).
 */
export async function post_paystack(req) {
  try {
    const body = await req.body.json();   // parse JSON body
    const event = body.event;
    const data = body.data;

    console.log(`📩 Paystack Webhook Event: ${event}`, data.reference);

    switch(event) {
      case "charge.success": {
        // ✅ Verify transaction to be safe
        const verified = await verifyPaystackTransaction(data.reference);
        if (verified.success) {
          try {
            await upsertEmergencyProfile(verified.data);
            console.log(`✅ Profile updated for ${verified.data.customer.email}`);
          } catch (err) {
            console.error("❌ Failed to upsert profile:", err);
          }
        } else {
          console.warn("⚠️ Transaction not verified:", data.reference);
        }
        break;
      }

      case "invoice.payment_failed": {
        // ⚠️ Example: Mark subscription as needing attention
        const email = data.customer?.email;
        if (email) {
          let results = await wixData.query("Emergency_Profiles")
            .eq("email", email)
            .limit(1)
            .find({ suppressAuth: true });
          if (results.items.length > 0) {
            let profile = results.items[0];
            profile.planStatus = "attention";
            await wixData.update("Emergency_Profiles", profile);
          }
        }
        break;
      }

      case "subscription.create": {
        // Optional: store subscription code in CMS
        const email = data.customer?.email;
        if (email) {
          let results = await wixData.query("Emergency_Profiles")
            .eq("email", email)
            .limit(1)
            .find({ suppressAuth: true });
          if (results.items.length > 0) {
            let profile = results.items[0];
            profile.paystackSubscriptionCode = data.subscription_code;
            await wixData.update("Emergency_Profiles", profile);
          }
        }
        break;
      }

      default:
        console.log("ℹ️ Unhandled Paystack event:", event);
    }

    return { status: 200 };
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return { status: 500, body: { error: err.message } };
  }
}
