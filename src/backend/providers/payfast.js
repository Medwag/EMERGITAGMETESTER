// src/backend/providers/payfast.js
// Thin provider wrapper around existing PayFast URL generator.

/**
 * Create a PayFast payment URL (live path).
 *
 * @param {Object} opts
 * @param {number} opts.amount - ZAR amount (e.g., 149.00)
 * @param {string} opts.email - payer email
 * @param {string} opts.mPaymentId - merchant payment id (correlation id)
 * @returns {Promise<string>} final PayFast redirect URL
 */
export async function createPaymentUrl(opts) {
  const { generatePayfastUrl } = await import('backend/payments.jsw');
  return generatePayfastUrl(opts);
}

export default {
  createPaymentUrl
};

