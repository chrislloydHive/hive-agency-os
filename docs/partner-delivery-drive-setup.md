# Partner Delivery — Google Drive setup (Shared Drive)

Ops guide for the partner-delivery copy flow that uses a **service account** to copy files into partner folders on Google Drive (including Shared Drives).

## 1. Required Vercel env vars

| Variable | Required | Notes |
|----------|----------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes | Service account email (e.g. `xxx@yyy.iam.gserviceaccount.com`). |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Yes | Private key from the JSON key file. Store with `\n` escaped (e.g. paste the key as one line with `\n` for newlines); the app converts `\\n` → real newlines. |
| `HIVE_INBOUND_SECRET` | Yes* | Shared secret for `X-Hive-Secret` header. Requests without this header (or with a wrong value) get 401. |
| `HIVE_INBOUND_EMAIL_SECRET` | Fallback | Used if `HIVE_INBOUND_SECRET` is not set. Set one or the other. |

\* Either `HIVE_INBOUND_SECRET` or `HIVE_INBOUND_EMAIL_SECRET` must be set.

## 2. Shared Drive requirement

- Add the **service account email** as a **member** of the Shared Drive that contains **both**:
  - The **source** assets (files to copy), and  
  - The **destination** partner folders.
- **Recommended role:** **Content manager** (or **Manager**) so the service account can copy and create files in the destination folder.

## 3. Shared Drive gotchas

- **`supportsAllDrives`** — All Drive API calls in this flow use `supportsAllDrives: true`; no extra config needed.
- **Source in another Shared Drive** — If the source file lives in a *different* Shared Drive than the destination, the service account must also be a **member of that Shared Drive** (with at least read access). Otherwise you get 403/404.

## 4. How to test

1. **Diagnostic (folder access)**  
   Call the diag endpoint with a folder ID that the service account should see (e.g. the destination partner folder):

   ```bash
   curl -X POST 'https://<your-vercel-domain>/api/partner-delivery/diag' \
     -H 'Content-Type: application/json' \
     -H 'X-Hive-Secret: <HIVE_INBOUND_SECRET>' \
     -d '{"folderId": "<DriveFolderId>"}'
   ```

   - **200** + folder metadata (`id`, `name`, `mimeType`, `driveId`, `parents`) → service account can see the folder.
   - **403** → add the service account as a member of the Shared Drive (or share the folder with it).

2. **Copy (one file)**  
   Call the copy endpoint with one known source file and the same destination folder:

   ```bash
   curl -X POST 'https://<your-vercel-domain>/api/partner-delivery/copy' \
     -H 'Content-Type: application/json' \
     -H 'X-Hive-Secret: <HIVE_INBOUND_SECRET>' \
     -d '{
       "destinationFolderId": "<DriveFolderId>",
       "sourceFileIds": ["<sourceFileId>"]
     }'
   ```

   - **200** + `copied` / `failed` arrays → check `copied` for the new file ID and name.
   - **401** → wrong or missing `X-Hive-Secret`.
   - **403** on Drive → service account needs membership on the Shared Drive(s) for both source and destination.
