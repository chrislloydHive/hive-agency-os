# Partner Delivery (Airtable + Google Drive)

Automated delivery of approved Creative Review assets to a Partner Delivery folder in Google Drive. Airtable automation calls a server endpoint to copy each asset; the endpoint uses the existing Drive service account.

## Endpoint

**POST** `https://<your-app>/api/review/assets/deliver`

### Request body

| Field | Required | Description |
|-------|----------|-------------|
| `fileId` | Yes | Google Drive file ID of the asset (same as "Drive File ID" in Creative Review Asset Status). |
| `destinationFolderId` | Yes | Drive folder ID where the copy should be placed. See [Folder structure](#folder-structure) below. |
| `batchId` | No | If provided, a child folder with this name is created under `destinationFolderId` (if it doesn’t exist), and the file is copied into that folder. Use a batch ID to group deliveries (e.g. date or run ID). |
| `recordId` | No | Airtable record ID of the Creative Review Asset Status record (for automation scripting; not used by the endpoint). |
| `token` | No | Review portal token (reserved for future use; not used by the endpoint). |

### Optional auth

If `REVIEW_DELIVERY_SECRET` is set in the environment, the request must include one of:

- **Header:** `x-delivery-secret: <value>`
- **Header:** `Authorization: Bearer <value>`

If the env var is not set, the endpoint does not check a secret (suitable for internal-only use).

### Response

**Success (200):**

```json
{
  "ok": true,
  "deliveredFileId": "<new Drive file ID>",
  "deliveredFileUrl": "https://drive.google.com/file/d/<id>/view"
}
```

**Error (4xx/5xx):**

```json
{
  "ok": false,
  "error": "<message>"
}
```

---

## Where `destinationFolderId` comes from

- **Option A – Fixed folder per partner/project**  
  Store the Partner Delivery folder ID in Airtable (e.g. on the Project or a Partner table) and pass it from the automation (e.g. from a linked record or a field that holds the folder ID).

- **Option B – Standard path**  
  Use a root “Partners” folder and derive the path (see [Folder structure](#folder-structure)). The automation can look up or compute the folder ID for `Partners/<Partner>/<Project>/Delivery` and pass that as `destinationFolderId`. If you use `batchId`, the endpoint will create `Delivery/<Batch ID>/` under that.

---

## Folder structure

Recommended default structure:

```
/Partners/<Partner>/<Project>/Delivery/<Batch ID>/
```

- **Partners** – root folder for all partner deliveries (e.g. shared with the Drive service account).
- **&lt;Partner&gt;** – one folder per partner.
- **&lt;Project&gt;** – one folder per project (e.g. project name or job #).
- **Delivery** – fixed name for delivery outputs.
- **&lt;Batch ID&gt;** – optional; one folder per batch (e.g. `2025-02-03` or `run-abc123`). **The endpoint can create this folder** if you pass `destinationFolderId` = the **Delivery** folder ID and `batchId` = the batch string.

Example:

- `destinationFolderId` = ID of `Partners/Acme Corp/117CAR – Creative Review/Delivery`
- `batchId` = `2025-02-03`
- Endpoint ensures `Delivery/2025-02-03/` exists and copies the file into it.

If you don’t use batching, pass the exact folder ID where the copy should go as `destinationFolderId` and omit `batchId`.

---

## Airtable automation: how to call the endpoint

1. **Trigger**  
   e.g. “When record matches conditions” in Creative Review Asset Status: `Needs Delivery` = true (and optionally `Delivery Status` is empty or “Pending”).

2. **Before running the script**  
   - Set **Delivery Status** = `Delivering` on the record (so you can see in-progress and avoid double-runs).

3. **Run script / Send request**  
   - **URL:** `https://<your-app>/api/review/assets/deliver`  
   - **Method:** POST  
   - **Headers:**  
     - `Content-Type: application/json`  
     - If using a secret: `x-delivery-secret: <REVIEW_DELIVERY_SECRET>` or `Authorization: Bearer <REVIEW_DELIVERY_SECRET>`  
   - **Body (JSON):**  
     - `fileId` = field “Drive File ID”  
     - `destinationFolderId` = your Delivery folder ID (from config, lookup, or formula)  
     - `batchId` = optional (e.g. today’s date or a batch field)  
     - `recordId` = Airtable record ID (for your own scripting)

4. **On success**  
   Update the same record:
   - **Delivered At** = now (e.g. `NOW()` or equivalent)
   - **Delivery Status** = `Delivered`
   - **Delivered File URL** = value from response `deliveredFileUrl`
   - **Delivery Batch ID** = `batchId` (if you use it)
   - **Needs Delivery** = false (optional, if you use this field)

5. **On failure**  
   Update the same record:
   - **Delivery Status** = `Error`
   - **Delivery Error** = response `error` string

Airtable’s “Run script” with `fetch()` or the “Send web request” action (if available) can do the POST and then branch on status to update the record accordingly.

---

## Environment and Drive access

- **Service account**  
  The endpoint uses the same Google Drive client as the rest of the app (`GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`). No user OAuth is required.

- **Drive permissions**  
  The service account must have:
  - **Read** access to the source file (the asset’s Drive file).
  - **Write** (e.g. “Editor”) access to the destination folder (and, if you use it, the parent so it can create the batch folder).

  Typically the review assets live in a shared structure (e.g. Shared Drive or folders shared with the SA). The Partner Delivery root (e.g. `Partners`) should be shared with the service account so it can create partner/project/delivery/batch folders and copy files in.

- **Optional**  
  `REVIEW_DELIVERY_SECRET` – if set, requests must include this value in `x-delivery-secret` or `Authorization: Bearer` (see above).

---

## Testing

1. **Create a test batch folder**  
   In Drive, create or pick a folder to act as “Delivery” (e.g. `Partners/TestPartner/TestProject/Delivery`). Share it with the service account. Note its folder ID.

2. **Pick one asset**  
   In Creative Review Asset Status, choose a record that has **Needs Delivery** checked and a valid **Drive File ID**. Ensure that file is readable by the service account.

3. **Call the endpoint manually**  
   ```bash
   curl -X POST 'https://<your-app>/api/review/assets/deliver' \
     -H 'Content-Type: application/json' \
     -d '{"fileId":"<Drive File ID>","destinationFolderId":"<Delivery folder ID>","batchId":"test-batch-1"}'
   ```
   If you use `REVIEW_DELIVERY_SECRET`, add:
   `-H 'x-delivery-secret: <REVIEW_DELIVERY_SECRET>'`

4. **Verify**  
   - Response is `{ "ok": true, "deliveredFileId": "...", "deliveredFileUrl": "..." }`.
   - In Drive, the Delivery folder (and, if used, `test-batch-1`) contains a copy of the asset.
   - Then run your Airtable automation once for that record and confirm the record updates to Delivered with the correct URL and timestamp.
