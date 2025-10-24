/*************************************************
 * Imports
 *************************************************/
import { sendSMS } from 'backend/smsportal.jsw';
import { sendSignupSuccessTriggeredEmail } from 'backend/notifications.jsw';
import wixData from 'wix-data';
import wixSecretsBackend from 'wix-secrets-backend';
import { ok, serverError, badRequest, response } from 'wix-http-functions';
import { fetch } from 'wix-fetch';
import { sendDiscordLog } from 'backend/logger.jsw';
import { sendEmailAlert } from 'backend/email.jsw';
import {
  sendSignUpMessage,
  sendSubscriptionSuccess
} from 'backend/whatsapp.jsw';
import crypto from 'crypto'; // ✅ static import fixes dynamic import errors

/*************************************************
 * Constants
 *************************************************/
const PAYFAST_IPS = [
  '197.97.145.144', '197.97.145.145',
  '197.97.145.146', '197.97.145.147',
  '197.97.145.148', '197.97.145.149'
];

/*************************************************
 * Helper: Mark Profile Paid (signup)
 *************************************************/
async function markSignUpPaid(userId, paymentId) {
  try {
    const profileQuery = await wixData.query('Emergency_Profiles')
      .eq('_owner', userId)
      .limit(1)
      .find({ suppressAuth: true });

    const profile = profileQuery.items[0];
    if (!profile) return null;

    profile.signUpPaid = true;
    profile.lastPaymentDate = new Date();
    profile.payFastPaymentId = paymentId; // legacy field retained

    return wixData.update('Emergency_Profiles', profile, { suppressAuth: true });
  } catch (err) {
    console.error('❌ markSignUpPaid error:', err);
    throw err;
  }
}

/*************************************************
 * PayFast LIVE ITN Webhook
 * URL: https://www.emergitag.me/_functions/payfastWebhook
 * (Kept active; uses static crypto import now)
 *************************************************/
export async function post_payfastWebhook(request) {
  console.log('✅ [PayFast] ITN received');

  try {
    // 1️⃣ Parse incoming form data
    const rawBody = await request.body.text();
    if (!rawBody) throw new Error('Empty request body');
    const params = Object.fromEntries(new URLSearchParams(rawBody));
    console.log('📩 [PayFast] Params:', params);

    // 2️⃣ Verify request IP (optional)
    const clientIp = request.headers['x-forwarded-for'] || request.ip || '';
    if (!PAYFAST_IPS.includes(clientIp)) {
      console.warn('⚠️ Untrusted PayFast IP:', clientIp);
      await sendDiscordLog(`⚠️ Untrusted PayFast IP: ${clientIp}`);
      return ok({ body: 'Untrusted source ignored' });
    }

    // 3️⃣ Recalculate signature (MD5 + passphrase)
    const passphrase = await wixSecretsBackend.getSecret('payfast_passphrase');
    const signatureBase = Object.keys(params)
      .filter(k => k !== 'signature')
      .sort()
      .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
      .join('&') + (passphrase ? `&passphrase=${encodeURIComponent(passphrase)}` : '');

    const calcSig = crypto.createHash('md5').update(signatureBase).digest('hex');
    if (calcSig !== params.signature) {
      console.warn('⚠️ Invalid signature, ignoring ITN');
      await sendDiscordLog('⚠️ PayFast ITN rejected: Invalid signature');
      return ok({ body: 'Invalid signature' });
    }

    // 4️⃣ Server-to-server validation
    const validationUrl = 'https://www.payfast.co.za/eng/query/validate';
    const validationRes = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'EmergiTag/1.0'
      },
      body: rawBody
    });

    const validationText = await validationRes.text();
    console.log('🔍 Validation response:', validationText);
    if (!validationText.includes('VALID')) {
      await sendDiscordLog(`⚠️ PayFast validation failed: ${validationText}`);
      return ok({ body: 'Validation failed' });
    }

    // 5️⃣ Prevent duplicate processing
    const existing = await wixData.query('PayFast_Transactions')
      .eq('paymentId', params.pf_payment_id)
      .limit(1)
      .find({ suppressAuth: true });

    if (existing.items.length > 0) {
      console.log('🟡 Duplicate ITN ignored:', params.pf_payment_id);
      return ok({ body: 'Duplicate ignored' });
    }

    // 6️⃣ Update Emergency_Profiles
    const userId = params.m_payment_id || params.custom_str1;
    const profileQuery = await wixData.query('Emergency_Profiles')
      .eq('_owner', userId)
      .limit(1)
      .find({ suppressAuth: true });

    if (profileQuery.items.length > 0) {
      const profile = profileQuery.items[0];
      profile.signUpPaid = true;
      profile.lastPaymentReference = params.pf_payment_id;
      profile.paymentGateway = 'payfast';
      profile.lastPaymentDate = new Date();
      await wixData.update('Emergency_Profiles', profile, { suppressAuth: true });
      console.log('✅ Profile updated for user:', userId);
    } else {
      console.warn('⚠️ No Emergency_Profiles found for userId:', userId);
      await sendDiscordLog(`⚠️ No Emergency_Profiles found for userId: ${userId}`);
    }

    // 7️⃣ Record the transaction
    await wixData.insert('PayFast_Transactions', {
      paymentId: params.pf_payment_id,
      amount: parseFloat(params.amount_gross),
      status: params.payment_status,
      userId: userId,
      email: params.email_address || params.custom_str3,
      reference: params.m_payment_id,
      gateway: 'payfast',
      environment: 'live',
      rawPayload: params,
      processedAt: new Date()
    }, { suppressAuth: true });

    // 8️⃣ Optional audit trail
    await wixData.insert('PaymentAuditTrail', {
      timestamp: new Date(),
      userId,
      gateway: 'payfast',
      reference: params.pf_payment_id,
      amount: params.amount_gross,
      status: params.payment_status,
      type: 'signup_payment',
      environment: 'live'
    }, { suppressAuth: true });

    // ✅ Success
    await sendDiscordLog(`✅ PayFast payment confirmed for ${params.email_address}`);
    console.log('🎉 [PayFast] ITN processed successfully');

    return ok({
      headers: { 'Content-Type': 'text/plain' },
      body: 'OK'
    });

  } catch (err) {
    console.error('💥 [PayFast] ITN error:', err);
    await sendDiscordLog(`💥 PayFast ITN error: ${err.message}`);
    return serverError({ body: { error: err.message } });
  }
}

/*************************************************
 * PayFast OPTIONS (CORS preflight)
 *************************************************/
export function options_payfastWebhook(_request) {
  return response({
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/*************************************************
 * Meta WhatsApp Webhook (Verify + Receive)
 *************************************************/
export function get_whatsappWebhook(request) {
  try {
    const params = request.query || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === 'emergitag2025' && challenge) {
      return ok({
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
        body: String(challenge)
      });
    }

    return response({ status: 403, body: { error: 'Verification failed' } });
  } catch (err) {
    return serverError({ body: { error: err.message } });
  }
}

export async function post_whatsappWebhook(request) {
  try {
    const body = await request.body.json();
    // Minimal acknowledgement for Meta
    return ok({ headers: { 'Access-Control-Allow-Origin': '*' }, body: {} });
  } catch (err) {
    return badRequest({ body: { error: err.message } });
  }
}
