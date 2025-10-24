// backend/fallback-cron.js
import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { sendDiscordLog } from 'backend/logger.jsw';
import { purgeExpired } from 'backend/_lib/idempotency.js';

// 🔄 Every hour, re-check incomplete profiles
export async function checkPaymentsJob() {
    try {
        console.log("⏳ Running fallback payment check...");
        sendDiscordLog("⏳ Running fallback payment check...");

        const unpaid = await wixData.query("Emergency_Profiles")
            .eq("signupPaid", false)
            .find();

        for (let profile of unpaid.items) {
            console.log("🔎 Checking unpaid profile:", profile._id, profile.email);
            await checkPaystack(profile);
            await checkPayfast(profile);
        }

        sendDiscordLog("✅ Fallback check complete.");
    } catch (e) {
        console.error("❌ Fallback job error:", e);
        sendDiscordLog("❌ Fallback job error: " + e.message);
    }
}

// -------------------------
// IdempotencyKeys purge
// -------------------------
export async function purgeIdempotencyKeysJob(batchSize = 200, maxBatches = 10) {
    try {
        console.log('🧹 Running idempotency purge job...');
        sendDiscordLog('🧹 Running idempotency purge job...');

        let totalRemoved = 0;
        for (let i = 0; i < maxBatches; i++) {
            const { removed } = await purgeExpired(batchSize);
            totalRemoved += removed;
            if (!removed) break;
        }

        const msg = `✅ Idempotency purge complete. Removed: ${totalRemoved}`;
        console.log(msg);
        sendDiscordLog(msg);
    } catch (e) {
        console.error('❌ Idempotency purge error:', e);
        sendDiscordLog('❌ Idempotency purge error: ' + e.message);
    }
}

// -------------------------
// Paystack lookup
// -------------------------
async function checkPaystack(profile) {
    try {
        const secretKey = await getSecret("paystack");
        const url = `https://api.paystack.co/transaction?email=${profile.email}`;
        const res = await fetch(url, {
            method: "GET",
            headers: { "Authorization": `Bearer ${secretKey}` }
        });
        const data = await res.json();

        if (data.status && data.data.length > 0) {
            const paidTx = data.data.find(tx => tx.status === "success");
            if (paidTx) {
                console.log("✅ Paystack confirms payment:", paidTx.reference);
                await unlockEmergencyProfile(profile._owner, profile.email, "Paystack (Fallback)", paidTx.amount / 100);
            }
        }
    } catch (e) {
        console.error("⚠️ Paystack fallback error:", e.message);
    }
}

// -------------------------
// PayFast lookup
// -------------------------
async function checkPayfast(profile) {
    try {
        const merchant_id = await getSecret("payfast_merchant_id");
        const merchant_key = await getSecret("payfast_merchant_key");
        const passphrase = await getSecret("payfast_passphrase");

        // NOTE: PayFast doesn’t have a public API like Paystack.
        // Fallback = re-query with transaction ID if you stored it.
        // For now, just log that it’s not directly available:
        console.log("⚠️ PayFast fallback: API limited, requires merchant portal export.");
        sendDiscordLog("⚠️ PayFast fallback: check portal for profile " + profile._id);
    } catch (e) {
        console.error("⚠️ PayFast fallback error:", e.message);
    }
}

// -------------------------
// Shared unlock
// -------------------------
async function unlockEmergencyProfile(userId, email, provider, amount) {
    const existing = await wixData.query("Emergency_Profiles").eq("_owner", userId).find();
    if (existing.items.length > 0) {
        const profile = existing.items[0];
        profile.signupPaid = true;
        profile.signupProvider = provider;
        profile.signupAmount = amount;
        await wixData.update("Emergency_Profiles", profile);
        sendDiscordLog(`✅ Profile unlocked via ${provider} for ${email}`);
    }
}
