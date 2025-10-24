// src/backend/_lib/idempotency.js
// Lightweight idempotency helpers for backend workflows (webhooks, retries, etc.)
//
// Collection: IdempotencyKeys (recommended fields: _id, key, createdAt, expiresAt)
// - You can create this collection in CMS and (optionally) add a TTL job externally.
// - We use `_id = key` to enforce uniqueness without extra indices.

import wixData from 'wix-data';
import crypto from 'crypto';

export const IDEMPOTENCY_COLLECTION = 'IdempotencyKeys';

/**
 * Create a deterministic idempotency key from arbitrary parts.
 * Example: makeKeyFrom('paystack', event.reference)
 */
export function makeKeyFrom(...parts) {
  const base = parts.filter(Boolean).map(v => String(v).trim()).join(':');
  return crypto.createHash('sha256').update(base).digest('hex');
}

/**
 * Attempt to claim an idempotency key.
 * - If the key is fresh or expired, claims it and returns { claimed: true }.
 * - If an unexpired record already exists, returns { claimed: false, alreadyProcessed: true }.
 */
export async function ensureOnce(key, ttlSeconds = 15 * 60) {
  const now = Date.now();
  const expiresAt = new Date(now + ttlSeconds * 1000);

  try {
    // Try to get existing record by deterministic _id
    const existing = await wixData.get(IDEMPOTENCY_COLLECTION, key).catch(() => null);
    if (existing) {
      const exp = existing.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
      if (exp && exp > now) {
        return { claimed: false, alreadyProcessed: true };
      }
      // Expired: refresh the record
      existing.expiresAt = expiresAt;
      existing.createdAt = new Date();
      await wixData.update(IDEMPOTENCY_COLLECTION, existing, { suppressAuth: true });
      return { claimed: true, refreshed: true };
    }

    // No record: insert a fresh claim
    const item = {
      _id: key,
      key,
      createdAt: new Date(),
      expiresAt
    };
    await wixData.insert(IDEMPOTENCY_COLLECTION, item, { suppressAuth: true });
    return { claimed: true };
  } catch (error) {
    // If insert races and fails due to duplicate id, treat as already processed
    const msg = String(error && error.message || error);
    if (msg.toLowerCase().includes('already exists')) {
      return { claimed: false, alreadyProcessed: true };
    }
    throw error;
  }
}

/**
 * Optionally clean up expired keys. Safe to call occasionally.
 */
export async function purgeExpired(limit = 50) {
  const nowIso = new Date().toISOString();
  const results = await wixData.query(IDEMPOTENCY_COLLECTION)
    .lt('expiresAt', nowIso)
    .limit(limit)
    .find({ suppressAuth: true });

  const toRemove = results.items || [];
  for (const item of toRemove) {
    await wixData.remove(IDEMPOTENCY_COLLECTION, item._id, { suppressAuth: true }).catch(() => {});
  }
  return { removed: toRemove.length };
}

export default {
  IDEMPOTENCY_COLLECTION,
  makeKeyFrom,
  ensureOnce,
  purgeExpired
};

