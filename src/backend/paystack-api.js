// backend/paystack-api.js
import { fetch } from 'wix-fetch';
import { getPaystackSecretKey, PAYSTACK_CONFIG } from './paystack-config.jsw';

const BASE_URL = PAYSTACK_CONFIG.API_BASE_URL;

/** Internal helper to call Paystack */
async function paystackFetch(path, { method = "GET", body } = {}) {
  const SECRET_KEY = await getPaystackSecretKey();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await res.json();
  if (!json?.status) {
    // Normalize errors
    throw new Error(json?.message || `Paystack error on ${path}`);
  }
  return json.data; // Paystack wraps data under .data
}

/** Create a plan (use Dashboard for one-time setup, but API is here if you need it) */
export function createPlan({ name, interval, amount, invoice_limit }) {
  return paystackFetch("/plan", {
    method: "POST",
    body: { name, interval, amount, ...(invoice_limit ? { invoice_limit } : {}) }
  });
}

/** Initialize a transaction (returns authorization_url to redirect user) */
export function initTransaction({ email, amount, planCode, metadata }) {
  return paystackFetch("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount,                 // amount in kobo (ZAR cents if Paystack SA, still *100)
      currency: PAYSTACK_CONFIG.CURRENCY,
      ...(planCode ? { plan: planCode } : {}),
      ...(metadata ? { metadata } : {})
    }
  });
}

/** Verify a transaction after redirect (optional safety) */
export function verifyTransaction(reference) {
  return paystackFetch(`/transaction/verify/${reference}`);
}

/** Create subscription (requires existing customer + authorization) */
export function createSubscription({ customer, plan, authorization }) {
  return paystackFetch("/subscription", {
    method: "POST",
    body: { customer, plan, ...(authorization ? { authorization } : {}) }
  });
}

/** Fetch a subscription */
export function fetchSubscription(idOrCode) {
  return paystackFetch(`/subscription/${idOrCode}`);
}
