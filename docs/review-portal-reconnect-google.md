# Reconnect Google for the Review Portal (fix invalid_grant)

When the review portal shows **"Google access expired or revoked"** or **invalid_grant**, the company’s Google refresh token is no longer valid. Reconnecting Google gives you a new token.

---

## Simplest: one URL with your review token

1. Copy the **token** from your review portal URL (the part after `/review/`, e.g. `59c7fdffa4e656273b9b555f7798c4c16c41d74`).
2. Open:
   ```
   https://hiveagencyos.com/api/review/reconnect-google?token=PASTE_TOKEN_HERE
   ```
3. Complete the Google sign-in. You’ll be redirected back to the review portal.

**If you get 404 “No CompanyIntegrations row found”:** CompanyIntegrations is in another base (e.g. Client PM). In **Vercel** (or your host), add an env var:

- **`REVIEW_INTEGRATIONS_BASE_ID`** = that base’s ID (e.g. `appVLDjqK2q4IJhGz`).

Redeploy, then try the same URL again. No need to look up companyId or baseId in the URL.

---

## Option A: Company is in the OS (has a Brain setup page)

### 1. Identify the company

- In **Airtable**, open the **Projects** table and find the project whose **Client Review Portal Token** is in the review URL.
- Note the **Client** (or **Company**) linked record — that’s the **company** you need to reconnect.

### 2. Open that company’s setup in the app

- Go to **`https://hiveagencyos.com/c/{companyId}/brain/setup`** (replace `{companyId}` with the company’s record ID).

### 3. Reconnect Google

- In the **Google Integration** section: if it says **“Connected”**, click **“Disconnect”** then **“Connect Google”**; otherwise click **“Connect Google”**.
- Complete the Google OAuth flow (use the Google account that has access to the project’s Drive folders).

### 4. Confirm

- Open the review portal again; assets should load if folder setup is correct.

---

## Option B: Company is not in the OS (e.g. Car Toys)

Use the **reconnect-for-review** endpoint. It finds a **CompanyIntegrations** row (by **CompanyId**, **Client Code**, or **Company Name**) and starts OAuth; the callback stores the new token on that record.

### 1. Find the right row (easiest: use the CSV/export)

- Export or view **CompanyIntegrations** (Grid view or CSV). You need the **CompanyId** column (the linked company id on each row).
- Rows used for the **review portal** usually have **GoogleOAuthScopeVersion** = `v2-drive`. Pick the row that is for Car Toys (or the project that’s failing).
- Copy that row’s **CompanyId** value (e.g. `recFbNF5RUL07mpz9`).

### 2. Start the reconnect flow

Open this URL in the browser (replace `RECORD_ID` with the **CompanyId** from step 1):

**By CompanyId (recommended if you have the grid/CSV):**

```
https://hiveagencyos.com/api/integrations/google/reconnect-for-review?companyId=RECORD_ID
```

Example: `?companyId=recFbNF5RUL07mpz9`

**By client code** (only if that row has Client Code set):

```
https://hiveagencyos.com/api/integrations/google/reconnect-for-review?clientCode=CARTOYS
```

**By company name** (only if that row has Company Name set):

```
https://hiveagencyos.com/api/integrations/google/reconnect-for-review?companyName=Car%20Toys
```

Optional: add `&redirect=/some/path` to land on a specific page after success (default is `/`).

**If CompanyIntegrations lives in a different base (e.g. Client PM / no PM OS UI):**  
Hive OS normally only looks at `AIRTABLE_DB_BASE_ID` and `AIRTABLE_OS_BASE_ID`. If your table is in another base, pass that base’s ID so we look there and write the new token there:

```
https://hiveagencyos.com/api/integrations/google/reconnect-for-review?companyId=RECORD_ID&baseId=appXXXXXXXXXXXXXX
```

Get the base ID from the Airtable URL when you have that base open: `https://airtable.com/appXXXXXXXXXXXXXX/...` → use `appXXXXXXXXXXXXXX`. The same Airtable token Hive OS uses (`AIRTABLE_API_KEY` / `AIRTABLE_ACCESS_TOKEN`) must have access to that base.

**Important:** For the review portal to use the new token after reconnect, Hive OS must be configured to read CompanyIntegrations from that same base. Set **`AIRTABLE_DB_BASE_ID`** (in Vercel / env) to the Client PM base ID. Then both the reconnect flow (with `baseId`) and the portal’s token lookup will use that base.

### 3. Complete Google OAuth

- You’ll be sent to Google’s consent screen. Sign in with the account that has access to the project’s Drive folders.
- After authorizing, you’ll be redirected back; the new refresh token is stored on the **CompanyIntegrations** record that was found in step 1.

### 4. Confirm

- Open the review portal again (same token). The portal reads from CompanyIntegrations (DB base first), so the new token will be used and assets should load if folder setup is correct.

---

## If you use two Airtable bases (OS + Hive DB)

- The review portal reads Google tokens from **CompanyIntegrations** in this order: **AIRTABLE_DB_BASE_ID** (Hive DB) first, then **AIRTABLE_OS_BASE_ID**.
- **Option A** (Brain setup) writes via the default base. If the company’s integration lives only in Hive DB, use **Option B** (reconnect-for-review) so the token is written to the same base the portal reads from.
- **Option B** finds the record in DB or OS and PATCHes it in that same base.

## Direct authorize URL (Option A only)

When the company exists in the OS and you have its record ID:

```
https://hiveagencyos.com/api/integrations/google/authorize?companyId={companyId}&redirect=/c/{companyId}/brain/setup?step=9
```
