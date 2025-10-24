Refactor Checklist: Payments Core

- [ ] Create CMS collection `IdempotencyKeys` with fields: `_id` (text), `key` (text), `createdAt` (datetime), `expiresAt` (datetime)
- [ ] Wire idempotency in webhooks/ITN handlers using `src/backend/_lib/idempotency.js`
  - [ ] Paystack: guard on `event.data.reference`
  - [ ] PayFast ITN: guard on `pf_payment_id` or composite key
- [ ] Centralize role checks using `src/backend/_lib/roles.js`
  - [ ] Gate admin-only actions and diagnostics
  - [ ] Add `Payments Manager` role if used
- [ ] Move payment URL creation calls to providers
  - [ ] Replace direct `generatePaystackUrl` calls with `providers/paystack.createTransactionUrl`
  - [ ] Replace direct PayFast URL builders with `providers/payfast.createPaymentUrl`
- [ ] Ensure Discord logging remains consistent for audit trail
- [ ] Confirm secrets exist in Wix Secrets Manager
  - [ ] `PaystackLiveSKey`
  - [ ] `payfast_merchant_id`, `payfast_merchant_key`, `payfast_passphrase`
  - [ ] `discord_webhook` (required for logs)
  - [ ] `discord_thread_id` (optional: consolidate logs into a single Discord thread)
  - [ ] `discord_log_username` (optional: default webhook username)
  - [ ] `discord_log_avatar_url` (optional: default webhook avatar)

## Logging Notes
- Discord content limit is 2000 characters. Logger truncates long messages with: "… [truncated]".
- Default identity: set `discord_log_username` and `discord_log_avatar_url`.
- Auto-prefixing: if a message lacks a leading `[... ]` prefix, the logger infers one by keywords:
  - `PayFast` + `ITN` → `[PayFast ITN]`
  - `PayFast` → `[PayFast]`
  - `Paystack` + `webhook` → `[Paystack Webhook]`
  - `Paystack` + (`sync` or `subscription`) → `[Paystack Sync]`
  - `Idempotency` or `purge` → `[Cron] [Idempotency]`
  - `fallback` or `cron` → `[Cron]`
  - `payment` → `[Payments]`
- [ ] Validate `PaymentAuditTrail` collection structure used by `payments.jsw`
- [ ] Exercise end-to-end on sandbox/test cards
- [ ] Document retry behavior and idempotency TTL

## Collection Schemas

### IdempotencyKeys
- Purpose: Prevent duplicate processing of webhooks/ITNs/retries.
- Collection: `IdempotencyKeys`
- Suggested fields
  - `_id` (text, required, primary key) — set to the generated idempotency key. Enforces uniqueness.
  - `key` (text) — duplicate of `_id` for convenience/queries.
  - `createdAt` (datetime) — when the key was first claimed.
  - `expiresAt` (datetime) — when the claim expires; used to allow reprocessing after TTL if needed.
- Permissions: backend writes with `{ suppressAuth: true }`. Lock down public permissions.
- Retention/TTL
  - Default TTL used in code is 24h. Adjust as needed per provider retry behavior.
  - Optional cleanup job: periodically delete items with `expiresAt < now` (see `purgeExpired()` helper).
- Example item
  - `_id`: `1a2b3c...` (sha256 hash)
  - `key`: same as `_id`
  - `createdAt`: `2025-01-01T10:00:00.000Z`
  - `expiresAt`: `2025-01-02T10:00:00.000Z`

### PaymentAuditTrail
- Purpose: Central log for payment events (signup and subscription) for analytics and support.
- Collection: `PaymentAuditTrail`
- Fields (as used by `recordPaymentEvent()` in `src/backend/payments.jsw`)
  - `timestamp` (datetime)
  - `userId` (text)
  - `email` (text)
  - `type` (text: `signup_fee` | `subscription_fee`)
  - `gateway` (text: `payfast` | `paystack`)
  - `amount` (number)
  - `planName` (text, optional)
  - `reference` (text, transaction id/reference)
  - `status` (text: `success` | `failed` | `pending`)
  - `environment` (text: `live` | `sandbox`)
- Permissions: backend write-only; restrict public access.
- Indexes: optional composite on `(userId, timestamp desc)` for queries.

### Optional: Payment_Errors
- Purpose: Persist detailed error payloads for investigations.
- Collection: `Payment_Errors` (referenced in `payfast-itn-handler.jsw` comments)
- Fields
  - `timestamp` (datetime)
  - `errorType` (text)
  - `itnData` (text) — JSON string of original payload
  - `errorDetails` (text) — JSON string of derived details
  - `source` (text) — e.g., `payfast_itn_handler`, `paystack_webhook`
- Permissions: backend write-only.
