# Partner Delivery (Airtable webhook → Hive OS)

Automated partner delivery: when an asset is ready, Airtable automation calls a Hive OS endpoint. The app copies the Google Drive file into a destination folder and updates the Creative Review Asset Status record.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DELIVERY_WEBHOOK_SECRET` | Yes | Shared secret. Set the same value in Airtable webhook config (header `X-DELIVERY-SECRET`). Requests without this header or with a wrong value are rejected with 401. |
| Google Drive | Conditional | When `token` is provided, the copy uses the company’s OAuth (same as the review portal) so the source file in company Drive is readable. Without `token`, the service account is used (`GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_EMAIL` + key); then the SA must have read access to the source file and write access to the destination folder. Recommend passing `token` so copies work without sharing Creative Review folders with the SA and so `GOOGLE_SERVICE_ACCOUNT_*` can be omitted. |

## Endpoint

**POST** `https://<your-vercel-domain>/api/delivery/partner`

### Headers

- **X-DELIVERY-SECRET** (required): must equal `DELIVERY_WEBHOOK_SECRET`.
- **Content-Type**: `application/json`.

### Body (JSON)

| Field | Required | Description |
|-------|----------|-------------|
| `airtableRecordId` | Yes | Creative Review Asset Status record ID (e.g. `recXXXXXXXXXXXXXX`). |
| `driveFileId` | Yes | Value of "Drive File ID" on the asset status record. |
| `deliveryBatchId` | No | Batch ID. If provided and `destinationFolderId` is empty, the app looks up "Partner Delivery Batches" by "Batch ID" and uses "Destination Folder ID". |
| `destinationFolderId` | No | Google Drive folder ID where the file should be copied. If set, this is used and no batch lookup is done. |
| `dryRun` | No | If `true`, validate inputs and resolve destination only; **do not** copy the file or update Airtable. Response: `{ ok: true, dryRun: true, resolvedDestinationFolderId, wouldCopyFileId }`. |
| `token` | No | **Recommended.** Client Review Portal token for the project. When set, the copy uses the company’s Google OAuth so the **source file** (in company Drive) can be read. Without it, the app uses the service account, which often cannot access Creative Review assets—copy will fail with 404/403 unless the source folder is shared with the service account. |

### Response

- **200** – Success, idempotent (already delivered), or dry run:
  - Normal: `{ "ok": true, "deliveredFileUrl": "https://drive.google.com/..." }`
  - Dry run: `{ "ok": true, "dryRun": true, "resolvedDestinationFolderId": "<folderId>", "wouldCopyFileId": "<fileId>" }`
- **400** – Bad request (e.g. missing `airtableRecordId` or `driveFileId`, or destination folder could not be resolved):
  - `{ "ok": false, "error": "<message>" }`
  - In **normal** mode (not dry run), the Airtable record is updated: Delivery Status = Error, Delivery Error = message, Ready to Deliver (Webhook) = false. In **dry run** mode, Airtable is never updated.
- **401** – Missing or invalid `X-DELIVERY-SECRET`.
- **404** – `airtableRecordId` not found in Creative Review Asset Status.
- **500** – Copy or Airtable update failed:
  - `{ "ok": false, "error": "<message>" }`
  - In normal mode, on copy failure the Airtable record is updated: Delivery Status = Error, Delivery Error = message, Ready to Deliver (Webhook) = false.

## Airtable schema (Creative Review Asset Status)

Fields used by the webhook:

- **Drive File ID** (Single line text) – source file ID for the copy.
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
     - `driveFileId` = field "Drive File ID" of that record.
     - `deliveryBatchId` = field "Delivery Batch ID" (optional).
     - `destinationFolderId` = optional; if you store the folder ID on the record or elsewhere, pass it here. Otherwise the app uses the batch lookup.
     - `token` = **recommended.** Client Review Portal token for the project (so the copy uses company Drive access; see Environment and Drive permissions).

4. **After webhook**  
   No need to update the record in Airtable after the request; the endpoint updates Delivery Status, Delivered At, Delivered File URL, Delivery Error, and Ready to Deliver (Webhook) on success or failure.

## Idempotency

If the Creative Review Asset Status record already has **Delivery Status** = "Delivered" or **Delivered At** set, the endpoint does nothing (no copy, no field changes) and returns `200` with `ok: true`. So retries or duplicate webhook runs do not create duplicate copies.

## Logging

Each request is logged as a single JSON line with: `requestId`, `airtableRecordId`, `driveFileId`, `destinationFolderId`, `dryRun`, `result` (`ok` | `dry_run` | `idempotent` | `error`), and optionally `error`. Use Vercel logs or your logging provider to trace deliveries.

## Dry run vs real delivery

- **Dry run** – Send `"dryRun": true` in the request body. The endpoint will:
  - Validate secret, `airtableRecordId`, `driveFileId`, and resolve the destination folder (from body or Partner Delivery Batches).
  - Return `{ "ok": true, "dryRun": true, "resolvedDestinationFolderId", "wouldCopyFileId" }`.
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

The test route loads the test record to get its **Drive File ID**, then runs the same delivery logic (with dry run by default). Use it to validate end-to-end without building a body by hand.

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
    "driveFileId": "<Drive File ID from the record>",
    "deliveryBatchId": "<optional Batch ID>",
    "destinationFolderId": "<optional; Drive folder ID if you do not use batch>",
    "dryRun": true
  }'
```

Expect `{ "ok": true, "dryRun": true, "resolvedDestinationFolderId": "...", "wouldCopyFileId": "..." }`.

**Real delivery:**

```bash
curl -X POST 'https://<YOUR_VERCEL_DOMAIN>/api/delivery/partner' \
  -H 'Content-Type: application/json' \
  -H 'X-DELIVERY-SECRET: <YOUR_DELIVERY_WEBHOOK_SECRET>' \
  -d '{
    "airtableRecordId": "recXXXXXXXXXXXXXX",
    "driveFileId": "<Drive File ID from the record>",
    "deliveryBatchId": "<optional Batch ID>",
    "destinationFolderId": "<optional; Drive folder ID if you do not use batch>"
  }'
```

- **Success:** response `{ "ok": true, "deliveredFileUrl": "https://drive.google.com/..." }`. The asset status record shows Delivered, Delivered At, and Delivered File URL; a copy of the file appears in the destination folder.
- **Idempotent:** run the same request again; you get 200 and no second copy.
- **Missing destination:** omit both `destinationFolderId` and `deliveryBatchId` (or use a batch with no Destination Folder ID); you get 400 and (in non–dry-run mode) the record is set to Delivery Status = Error with a clear message.
