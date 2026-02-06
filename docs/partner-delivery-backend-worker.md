# Partner Delivery: Backend Worker (No Airtable fetch)

Airtable has disabled `fetch()` in automations ("Request processing is disabled due to earlier failed request"). Delivery is now triggered **inside Hive OS**; Airtable is used only as a state machine (set flags, no outbound HTTP).

## Flow

1. **Airtable (automation or manual)**  
   On the Creative Review Asset Status (CRAS) record, set:
   - **Ready to Deliver (Webhook)** = `true`
   - **Delivered?** = No (or leave **Delivered At** blank)
   - **Delivery Status** = `Delivering` (optional; for visibility)

2. **Backend worker**  
   A job runs periodically (or on demand) and:
   - Queries CRAS for records where **Ready to Deliver (Webhook)** = true and **Delivered At** is blank
   - For each record: resolves destination from **Delivery Batch ID** (Partner Delivery Batches), copies from **Source Folder ID** into the batch destination (same logic as `POST /api/delivery/partner` legacy mode), uses **service account / WIF** (no OAuth)
   - Writes back to CRAS:
     - **Delivered?** = true, **Delivered At**, **Delivered File URL** / **Delivered Folder URL**, **Delivery Status** = Delivered, **Ready to Deliver (Webhook)** = false
     - On failure: **Delivery Status** = Error, **Delivery Error** = message

3. **UI**  
   Once **Delivered File URL** (or **Delivered Folder URL**) is written, the review portal can show the link; no Airtable fetch is required for delivery.

## How to run the worker

### Option A: Inngest (cron)

A scheduled Inngest function runs **every 5 minutes** and processes all pending CRAS records. No setup beyond deploying; ensure Inngest is configured (see `app/api/inngest/route.ts`).

- Function id: `partner-delivery-run-pending`
- Schedule: `*/5 * * * *`

### Option B: Internal endpoint (Vercel Cron or external scheduler)

Call the internal endpoint so you control the schedule (e.g. Vercel Cron every 5 minutes, or an external cron).

**POST** `https://<your-vercel-domain>/api/internal/run-pending-deliveries`

| Header | Required | Description |
|--------|----------|-------------|
| `x-run-pending-deliveries-secret` | Yes | Must equal `RUN_PENDING_DELIVERIES_SECRET`. |
| **or** `Authorization: Bearer <secret>` | Yes | Same secret. |

**Response (200):**

```json
{
  "ok": true,
  "processed": 3,
  "succeeded": 2,
  "failed": 0,
  "skipped": 1,
  "results": [
    { "recordId": "recXXX", "ok": true, "deliveredFileUrl": "...", "authMode": "wif_service_account" },
    { "recordId": "recYYY", "ok": true, "deliveredFileUrl": "...", "authMode": "wif_service_account" },
    { "recordId": "recZZZ", "ok": true, "deliveredFileUrl": "...", "authMode": "wif_service_account" }
  ]
}
```

**Environment variable**

- `RUN_PENDING_DELIVERIES_SECRET` – set this and use it in the header when calling the internal endpoint. Not needed if you only use the Inngest cron.

## Idempotency

- **Safe to re-run:** Records already delivered (e.g. **Delivered At** set) are excluded by the query; if one slips through, the delivery code path returns "idempotent" and does not copy again.
- **Partial failures:** If some records fail, the next run will retry only those still pending (Ready to Deliver = true, Delivered At blank). Clear **Delivery Error** and set **Ready to Deliver (Webhook)** = true again to retry a failed record.

## Airtable automation (no fetch)

1. **Trigger**  
   e.g. when **Ready to Deliver (Webhook)** is set to true (by formula, button, or another automation).

2. **Actions (no Run Script / no Webhook)**  
   - Set **Delivery Status** = `Delivering` (optional).  
   - Do **not** call `fetch()` or "Send request to webhook". The backend worker will pick up the record.

3. **Done**  
   The worker runs on a schedule (or you call the internal endpoint); it updates **Delivered?**, **Delivered At**, **Delivered File URL**, **Delivery Status**, and clears **Ready to Deliver (Webhook)**.

## Reuse

- **Drive copy:** Same as `POST /api/delivery/partner` legacy mode (`runPartnerDelivery` → `copyDriveFolderTree` / Drive API).
- **CRAS write-back:** Same helpers as the webhook flow (`updateAssetStatusDeliverySuccess`, `updateAssetStatusDeliveryError`, `writeDeliveryToRecord` with **Ready to Deliver (Webhook)** = false).
- **Auth:** Service account / WIF only (no OAuth token). Ensure the impersonated service account is a member of the Shared Drive(s) that contain source and destination.

## Summary

| Before | After |
|--------|--------|
| Airtable automation called `fetch()` to `POST /api/delivery/partner` | Airtable only sets **Ready to Deliver (Webhook)** = true (and optionally **Delivery Status** = Delivering) |
| One webhook per record | Backend job queries CRAS for all pending records and runs delivery for each |
| Delivery triggered by Airtable | Delivery triggered by Inngest cron or `POST /api/internal/run-pending-deliveries` |

This replaces all Airtable Run Script / Webhook delivery automations that used `fetch()`.
