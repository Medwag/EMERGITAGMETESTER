// src/backend/providers/paystack.js
// Thin provider wrapper around existing payment initializer.

/**
 * Initialize a Paystack transaction and return an authorization URL.
 *
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string} opts.id - user id or correlation id
 * @param {number} opts.amount - in kobo (ZAR * 100)
 * @param {('signup_fee'|'subscription_fee')} [opts.transactionType]
 * @param {string} [opts.planName]
 * @param {string} [opts.planCode]
 * @returns {Promise<string>} authorization_url
 */
export async function createTransactionUrl(opts) {
  const { generatePaystackUrl } = await import('backend/payments.jsw');
  return generatePaystackUrl(opts);
}

export default {
  createTransactionUrl
};

