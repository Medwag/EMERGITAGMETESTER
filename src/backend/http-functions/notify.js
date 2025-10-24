// ✅ backend/_functions/notify.js
import wixData from 'wix-data';
import { sendWhatsAppAlert } from 'backend/notify.jsw';

// ✅ Required structure for an HTTP response
function response(status, bodyObj) {
  return {
    status: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  };
}

// Renamed to avoid route conflict with other notify handlers.
// New route: /_functions/payfastNotifyAlt
export async function post_payfastNotifyAlt(request) {
  try {
    const body = await request.body.text();
    console.log("🔔 PayFast ITN Raw Body:", body);

    const params = new URLSearchParams(body);
    const parsedData = Object.fromEntries(params.entries());

    console.log("🔍 Parsed ITN Data:", parsedData);

    const { payment_status, amount_gross, custom_str1, custom_str2 } = parsedData;

    if (!custom_str1 || !custom_str2) {
      console.warn("⚠️ Missing metadata (custom_str1 or custom_str2)");
      return response(400, { error: "Missing required metadata." });
    }

    const userId = custom_str1;
    const membershipTier = custom_str2;

    // Save or update Emergency Profile
    const item = {
      _id: userId,
      membershipTier: membershipTier,
      subscriptionStatus: "active",
      paidAmount: amount_gross,
      paidAt: new Date()
    };

    await wixData.save("Emergency_Profiles", item);

    console.log("✅ Emergency Profile updated for:", userId);

    // Optional admin alert
    await sendWhatsAppAlert("+27xxxxxxxxx", `✅ New active subscription for ${userId} - Tier: ${membershipTier}`);

    return response(200, { received: true });
  } catch (err) {
    console.error("❌ Error in PayFast notify:", err);
    return response(500, { error: "Internal server error", details: err.message });
  }
}
