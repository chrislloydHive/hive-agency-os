# Partner Delivery (Airtable webhook → Hive OS)

Automated partner delivery: when an asset is ready, Hive OS runs delivery and updates the Creative Review Asset Status record.

**Preferred (no Airtable fetch):** If Airtable has disabled `fetch()` in automations, use the **backend worker**: Airtable only sets **Ready to Deliver (Webhook)** = true; a scheduled job (Inngest cron or internal endpoint) processes pending records. See **[Partner Delivery: Backend Worker](partner-delivery-backend-worker.md)**.

**Legacy (Airtable webhook):** When Airtable can call outbound HTTP, an automation can still call the Hive OS endpoint below. The app copies the Google Drive file into a destination folder and updates the Creative Review Asset Status record.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DELIVERY_WEBHOOK_SECRET` | Yes | Shared secret. Set the same value in Airtable webhook config (header `X-DELIVERY-SECRET`). Requests without this header or with a wrong value are rejected with 401. |
| `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL` | Yes (for WIF) | Service account email used when **no** `token` is sent. Required for Workload Identity Federation (WIF) mode. The app uses Google ADC + impersonated credentials; no JSON keys. See `docs/vercel-gcp-wif-setup.md`. |
| `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT` | No | GCP project ID (optional; used for logging and WIF). |

**Auth behavior:** If the request body includes a non-empty `token`, the copy uses the company’s OAuth (review portal token). **Otherwise** the app uses WIF service account impersonation. A missing token never returns 400 when WIF is configured; if WIF env is missing or misconfigured, the endpoint returns 500 with a clear message.

**Shared Drive:** When using the service account (no token), the impersonated account must be a **MEMBER** of any Shared Drive that contains the source file or destination folder. Add the service account (e.g. `hive-os-drive@<project>.iam.gserviceaccount.com`) as a member with “Content manager” (or appropriate) access. All Drive API calls use `supportsAllDrives: true`.

## Endpoint

**POST** `https://<your-vercel-domain>/api/delivery/partner`

### Headers

- **X-DELIVERY-SECRET** (required): must equal `DELIVERY_WEBHOOK_SECRET`.
- **Content-Type**: `application/json`.

### Body (JSON)

| Field | Required | Description |
|-------|----------|-------------|
| `airtableRecordId` | Yes | Creative Review Asset Status record ID (e.g. `recXXXXXXXXXXXXXX`). |
| `driveFileId` | Yes | Value of "Source Folder ID" on the asset status record (Google Drive folder ID to copy). |
| `deliveryBatchId` | No | Batch ID. If provided and `destinationFolderId` is empty, the app looks up "Partner Delivery Batches" by "Batch ID" and uses "Destination Folder ID". |
| `destinationFolderId` | No | Google Drive folder ID where the folder tree should be copied. If set, this is used and no batch lookup is done. |
| `dryRun` | No | If `true`, validate inputs and resolve destination only; **do not** copy or update Airtable. Response: `{ ok: true, dryRun: true, resolvedDestinationFolderId, wouldCopyFileId }`. |
| `token` | No | When set (non-empty), the copy uses the company’s Google OAuth (review portal token). When omitted, the app uses WIF service account impersonation; no OAuth token is required. For service account mode, the impersonated SA must have access to source file and destination folder (e.g. be a member of the Shared Drive). |

### Response

- **200** – Success, idempotent (already delivered), or dry run:
  - Copy success: `{ "ok": true, "deliveredFileUrl": "...", "newFileId": "...", "newName": "...", "authMode": "oauth" | "wif_service_account" }`
  - Idempotent (already delivered): `{ "ok": true, "deliveredFileUrl": "..." }`
  - Dry run: `{ "ok": true, "dryRun": true, "resolvedDestinationFolderId": "...", "wouldCopyFileId": "...", "authMode": "oauth" | "wif_service_account" }`
- **400** – Bad request (e.g. missing `airtableRecordId` or source folder ID (`driveFileId`), or preflight failed):
  - `{ "ok": false, "error": "<message>", "authMode": "...", "requestId": "<uuid>" }` (authMode/requestId when available)
  - In **normal** mode, the Airtable record is updated: Delivery Status = Error, Delivery Error = message, Ready to Deliver (Webhook) = false. In **dry run** mode, Airtable is never updated.
- **401** – Missing or invalid `X-DELIVERY-SECRET`.
- **404** – `airtableRecordId` not found in Creative Review Asset Status.
- **500** – Copy or Airtable update failed, or WIF not configured when no token was sent:
  - `{ "ok": false, "error": "<message>", "authMode": "...", "requestId": "<uuid>" }`
  - In normal mode, on copy failure the Airtable record is updated. If the service account cannot access the folder, the error will state that the SA must be a MEMBER of the Shared Drive.

## Airtable schema (Creative Review Asset Status)

Fields used by the webhook:

- **Source Folder ID** (Single line text) – Google Drive folder ID (entire folder tree is copied).
- **Delivery Status** (Single select): `Not Delivered` \| `Delivering` \| `Delivered` \| `Error`.
- **Delivery Error** (Long text) – set on failure.
- **Delivered At** (DateTime) – set on success.
- **Delivered File URL** (URL) – set on success (webViewLink of the copied file).
- **Delivery Batch ID** (Text) – optional; used to look up destination folder.
- **Ready to Deliver (Webhook)** (Checkbox) – set to `false` after the webhook runs (success or failure).

## Partner Delivery Batches (Airtable)

Table: **Partner Delivery Batches**

- **Batch ID** (e.g. text) – unique identifier for the batch.
- **Destination Folder ID** – Google Drive folder ID where files for this batch should be copied.

If the webhook is sent with `deliveryBatchId` and no `destinationFolderId`, the app looks up this table by Batch ID and uses the Destination Folder ID. If the batch is missing or the field is empty, the request fails with a clear error and the asset status record is marked Error.

## Airtable automation (webhook config)

1. **Trigger**  
   e.g. when a record in Creative Review Asset Status has "Ready to Deliver (Webhook)" = true (and optionally "Delivery Status" = "Not Delivered" or "Delivering").

2. **Before webhook (optional)**  
   Set "Delivery Status" = "Delivering" so you can see in-progress state.

3. **Send webhook request**
   - **URL:** `https://<your-vercel-domain>/api/delivery/partner`
   - **Method:** POST
   - **Headers:**
     - `Content-Type: application/json`
     - `X-DELIVERY-SECRET`: `<value of DELIVERY_WEBHOOK_SECRET>`
   - **Body (JSON):**
     - `airtableRecordId` = record ID of the triggered record (e.g. from "Record ID" or the automation record).
     - `driveFileId` = field "Source Folder ID" of that record.
     - `deliveryBatchId` = field "Delivery Batch ID" (optional).
     - `destinationFolderId` = optional; if you store the folder ID on the record or elsewhere, pass it here. Otherwise the app uses the batch lookup.
     - `token` = optional. When set, uses company OAuth; when omitted, uses WIF service account (see Environment).

4. **After webhook**  
   No need to update the record in Airtable after the request; the endpoint updates Delivery Status, Delivered At, Delivered File URL, Delivery Error, and Ready to Deliver (Webhook) on success or failure.

## Idempotency

If the Creative Review Asset Status record already has **Delivery Status** = "Delivered" or **Delivered At** set, the endpoint does nothing (no copy, no field changes) and returns `200` with `ok: true`. So retries or duplicate webhook runs do not create duplicate copies.

## Logging

Each request gets a UUID `requestId`. Logs include `requestId`, `authMode` (`oauth` | `wif_service_account`), `driveFileId`, `destinationFolderId`, `supportsAllDrives: true`, `dryRun`, `result`, and optionally `error`. Use Vercel logs or your logging provider to trace deliveries.

## Dry run vs real delivery

- **Dry run** – Send `"dryRun": true` in the request body. The endpoint will:
  - Validate secret, `airtableRecordId`, `driveFileId` (source folder ID), resolve the destination folder, resolve auth (OAuth or WIF), and run preflight (source and destination folder validated).
  - Return `{ "ok": true, "dryRun": true, "resolvedDestinationFolderId", "wouldCopyFileId", "authMode" }`.
  - **Not** copy the file or update the Airtable record.
- **Real delivery** – Omit `dryRun` or set `"dryRun": false`. The endpoint will copy the file and update the record as described above.

Use dry run to verify webhook config and destination resolution before enabling real runs in Airtable.

## Test route (internal)

**POST** `https://<your-vercel-domain>/api/delivery/partner/test`

Uses env-based test data; requires the same **X-DELIVERY-SECRET** header.

| Env var | Required | Description |
|---------|----------|-------------|
| `DELIVERY_TEST_RECORD_ID` | Yes | Creative Review Asset Status record ID to use for the test. |
| `DELIVERY_TEST_BATCH_ID` | No | Batch ID for destination lookup (optional if record has a batch or you rely on destinationFolderId from elsewhere). |
| `DELIVERY_TEST_TOKEN` | No | Review portal token for the project; when set, the copy uses company OAuth so the source file is accessible. |
| `DELIVERY_TEST_DRY_RUN` | No | Default `true`. Set to `false` or `0` to perform a real copy and Airtable update. |

The test route loads the test record to get its **Source Folder ID**, then runs the same delivery logic (with dry run by default). Use it to validate end-to-end without building a body by hand.

Example (dry run, default):

```bash
curl -X POST 'https://<YOUR_VERCEL_DOMAIN>/api/delivery/partner/test' \
  -H 'X-DELIVERY-SECRET: <YOUR_DELIVERY_WEBHOOK_SECRET>'
```

Example (real run – copies file and updates Airtable):

Set `DELIVERY_TEST_DRY_RUN=false` in the environment, then:

```bash
curl -X POST 'https://<YOUR_VERCEL_DOMAIN>/api/delivery/partner/test' \
  -H 'X-DELIVERY-SECRET: <YOUR_DELIVERY_WEBHOOK_SECRET>'
```

## Manual test (curl)

Replace placeholders and run:

**Dry run (no copy, no Airtable update):**

```bash
curl -X POST 'https://<YOUR_VERCEL_DOMAIN>/api/delivery/partner' \
  -H 'Content-Type: application/json' \
  -H 'X-DELIVERY-SECRET: <YOUR_DELIVERY_WEBHOOK_SECRET>' \
  -d '{
    "airtableRecordId": "recXXXXXXXXXXXXXX",
    "driveFileId": "<Source Folder ID from the record>",
    "deliveryBatchId": "<optional Batch ID>",
    "destinationFolderId": "<optional; Drive folder ID if you do not use batch>",
    "dryRun": true
  }'
```

Expect `{ "ok": true, "dryRun": true, "resolvedDestinationFolderId": "...", "wouldCopyFileId": "...", "authMode": "oauth" | "wif_service_account" }`.

**Real delivery (with token, OAuth):**

```bash
curl -X POST 'https://<YOUR_VERCEL_DOMAIN>/api/delivery/partner' \
  -H 'Content-Type: application/json' \
  -H 'X-DELIVERY-SECRET: <YOUR_DELIVERY_WEBHOOK_SECRET>' \
  -d '{
    "airtableRecordId": "recXXXXXXXXXXXXXX",
    "driveFileId": "<Source Folder ID from the record>",
    "deliveryBatchId": "<optional Batch ID>",
    "destinationFolderId": "<optional; Drive folder ID if you do not use batch>",
    "token": "<review portal token>"
  }'
```

**Real delivery (no token, WIF service account):**

```bash
curl -X POST 'https://<YOUR_VERCEL_DOMAIN>/api/delivery/partner' \
  -H 'Content-Type: application/json' \
  -H 'X-DELIVERY-SECRET: <YOUR_DELIVERY_WEBHOOK_SECRET>' \
  -d '{
    "airtableRecordId": "recXXXXXXXXXXXXXX",
    "driveFileId": "<Source Folder ID from the record>",
    "destinationFolderId": "<Drive folder ID>"
  }'
```

Requires `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL` and WIF configured (see `docs/vercel-gcp-wif-setup.md`). The service account must be a member of the Shared Drive containing the source file and destination folder.

- **Success:** response `{ "ok": true, "deliveredFileUrl": "...", "newFileId": "...", "newName": "...", "authMode": "oauth" | "wif_service_account" }`. The asset status record shows Delivered, Delivered At, and Delivered File URL; a copy of the file appears in the destination folder.
- **Idempotent:** run the same request again; you get 200 and no second copy.
- **Missing destination:** omit both `destinationFolderId` and `deliveryBatchId` (or use a batch with no Destination Folder ID); you get 400 and (in non–dry-run mode) the record is set to Delivery Status = Error with a clear message.
