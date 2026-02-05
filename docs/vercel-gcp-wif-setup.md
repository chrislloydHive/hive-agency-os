# Vercel → GCP Workload Identity Federation (WIF) setup

Step-by-step checklist to configure Workload Identity Federation so Vercel can impersonate the Drive service account **hive-os-drive@hive-os-479319.iam.gserviceaccount.com** (no service account keys).

**Prerequisites:** `gcloud` CLI installed and authenticated, project `hive-os-479319` selected.

---

## 0. Enable OIDC in Vercel (no integration to install)

**There is no “Google”, “GCP”, or “OIDC” integration in Vercel’s Integrations list.** OIDC is a **Security** setting on the project:

1. Open your **Vercel project** (the one that hosts this app).
2. Go to **Settings** → **Security**.
3. Find the section **“Secure backend access with OIDC federation”**.
4. Choose **Team** (recommended) or **Global** and click **Save**.

That enables Vercel to issue OIDC tokens for your deployments. Without this, the runtime has no OIDC token (e.g. no file at `/var/run/secrets/vercel-oidc/token`) and you’ll see errors like “OIDC token not found” or “unable to impersonate”.

- **Team mode:** issuer will be `https://oidc.vercel.com/YOUR_TEAM_SLUG` (use your team URL slug).
- **Global mode:** issuer will be `https://oidc.vercel.com`.

Use the same mode when you create the OIDC provider in GCP (step 3).

---

## 1. Enable required APIs

At minimum: **IAM Credentials API** (for impersonation) and **Drive API**.

```bash
export PROJECT_ID=hive-os-479319
gcloud config set project $PROJECT_ID

gcloud services enable iamcredentials.googleapis.com
gcloud services enable drive.googleapis.com
```

---

## 2. Create Workload Identity Pool

```bash
gcloud iam workload-identity-pools create "hive-os-vercel-pool" \
  --location="global" \
  --display-name="Vercel OIDC" \
  --description="Pool for Vercel OIDC federation"
```

---

## 3. Create OIDC Provider: vercel-oidc

**Issuer:** Vercel’s OIDC issuer. It depends on your Vercel OIDC issuer mode:

- **Team mode:** `https://oidc.vercel.com/YOUR_TEAM_SLUG` (use the slug from your team URL, e.g. `https://vercel.com/your-team` → `your-team`)
- **Global mode:** `https://oidc.vercel.com`

**Audiences:** The OIDC token’s `aud` claim must match one of the provider’s **allowed audiences**. In Vercel, you set the audience when configuring the GCP OIDC integration; it must match exactly what you configure here.

- **Suggested allowed audience (team mode):** `https://vercel.com/YOUR_TEAM_SLUG`
- **Suggested (global):** `https://vercel.com`

Replace `YOUR_TEAM_SLUG` with your actual Vercel team slug. The value in **Allowed audiences** in GCP must match the audience Vercel sends in the token (set in Vercel’s OIDC/GCP integration).

**Create the provider (team mode example):**

```bash
# Replace YOUR_TEAM_SLUG with your Vercel team slug (e.g. hive-agency)
export VERCEL_TEAM_SLUG=YOUR_TEAM_SLUG

gcloud iam workload-identity-pools providers create-oidc "vercel-oidc" \
  --location="global" \
  --workload-identity-pool="hive-os-vercel-pool" \
  --display-name="Vercel OIDC" \
  --issuer-uri="https://oidc.vercel.com/${VERCEL_TEAM_SLUG}" \
  --allowed-audiences="https://vercel.com/${VERCEL_TEAM_SLUG}" \
  --attribute-mapping="google.subject=assertion.sub"
```

**Global issuer (no team slug):**

```bash
gcloud iam workload-identity-pools providers create-oidc "vercel-oidc" \
  --location="global" \
  --workload-identity-pool="hive-os-vercel-pool" \
  --display-name="Vercel OIDC" \
  --issuer-uri="https://oidc.vercel.com" \
  --allowed-audiences="https://vercel.com" \
  --attribute-mapping="google.subject=assertion.sub"
```

---

## 4. Attribute mapping and principal binding

**Attribute mapping (already in step 3):**

- `google.subject=assertion.sub` — The token’s `sub` (e.g. `owner:TEAM:project:PROJECT:environment:ENV`) becomes the federated principal’s subject.

**Principal identifier:** After federation, the principal looks like:

```text
principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/hive-os-vercel-pool/subject/SUBJECT_ATTRIBUTE_VALUE
```

Vercel’s `sub` is typically: `owner:TEAM_SLUG:project:PROJECT_NAME:environment:production` (or `preview`/`development`).

**Restricting by Vercel project (optional but recommended):** Use an attribute condition on the provider so only tokens from a specific Vercel project/environment are accepted, or restrict in IAM using `principalSet` with a prefix. Example of granting only for a specific subject pattern (e.g. one Vercel project + production):

```bash
# Get project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Example: allow only subject starting with owner:myteam:project:my-vercel-project:environment:production
# principalSet uses a prefix; adjust the path to match your Vercel subject pattern
export POOL_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/hive-os-vercel-pool"
# For a single full subject (replace with actual sub from a Vercel token):
# principal://.../subject/owner:myteam:project:my-app:environment:production
```

Use this `principal` or `principalSet` in the IAM binding in step 5.

---

## 5. Grant impersonation to the pool principal

The Vercel workload (federated principal) must be allowed to **impersonate** the service account. Use **Service Account Token Creator** on the target SA.

**Required role for impersonation:** `roles/iam.serviceAccountTokenCreator` (allows generating access tokens for the service account). Optionally, if you use Workload Identity User binding elsewhere, you’d use `roles/iam.workloadIdentityUser`; for **token-based impersonation from a WIF principal**, `roles/iam.serviceAccountTokenCreator` is the one that matters.

**Grant Token Creator to the pool (all subjects in the pool):**

```bash
export SA_EMAIL="hive-os-drive@hive-os-479319.iam.gserviceaccount.com"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# principalSet: all federated identities in the pool can impersonate the SA
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/hive-os-vercel-pool/subject/*"
```

To restrict to a single subject (e.g. one Vercel project + environment), use `principal` instead of `principalSet` and the full subject path:

```bash
# Replace SUBJECT_VALUE with the actual assertion.sub from your Vercel token (e.g. owner:myteam:project:my-app:environment:production)
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/hive-os-vercel-pool/subject/SUBJECT_VALUE"
```

---

## 6. Vercel environment variables

In the Vercel project, set:

| Variable | Value |
|----------|--------|
| `GOOGLE_CLOUD_PROJECT` | `hive-os-479319` |
| `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL` | `hive-os-drive@hive-os-479319.iam.gserviceaccount.com` |
| `GCP_PROJECT_NUMBER` | Project **number** (numeric), e.g. from GCP Console → IAM & Admin → Settings, or `gcloud projects describe hive-os-479319 --format="value(projectNumber)"`. Required for WIF when using the OIDC token from the request header (partner delivery on Vercel). |
| `HIVE_INBOUND_SECRET` | (your webhook secret; same as used for `X-Hive-Secret` header) |

Optional:

- **Fallback for the secret header:** `HIVE_INBOUND_EMAIL_SECRET`.
- **WIF pool/provider (if you used different IDs in GCP):** `GCP_WORKLOAD_IDENTITY_POOL_ID` (default `hive-os-vercel-pool`), `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` (default `vercel-oidc`).

**Vercel OIDC:** Enable OIDC in the project (see **step 0**). The audience Vercel sends is determined by your issuer mode (Team → `https://vercel.com/YOUR_TEAM_SLUG`; Global → `https://vercel.com`). Ensure the GCP provider’s **Allowed audiences** (step 3) match that value exactly. In serverless, the token is provided on the request as the `x-vercel-oidc-token` header; the app uses it for WIF so no token file is required.

---

## 7. Shared Drive requirement

- Add **hive-os-drive@hive-os-479319.iam.gserviceaccount.com** as a **member** of every Shared Drive that contains:
  - **Source** assets (files to copy), and
  - **Destination** partner folders.
- Recommended role: **Content manager** (or **Manager**) so the SA can copy and create files.
- All Drive API calls in this app use **supportsAllDrives: true** (already in code).

---

## 8. Verification

**Call the diag endpoint** with a folder ID that lives in a Shared Drive the service account can access:

```bash
curl -X POST 'https://YOUR_VERCEL_DOMAIN/api/partner-delivery/diag' \
  -H 'Content-Type: application/json' \
  -H 'X-Hive-Secret: YOUR_HIVE_INBOUND_SECRET' \
  -d '{"folderId": "YOUR_DRIVE_FOLDER_ID"}'
```

**Expected success (200):**

```json
{
  "ok": true,
  "folder": {
    "id": "...",
    "name": "Partner Folder",
    "mimeType": "application/vnd.google-apps.folder",
    "driveId": "...",
    "parents": ["..."]
  },
  "auth": {
    "projectId": "hive-os-479319",
    "impersonateEmail": "hive-os-drive@hive-os-479319.iam.gserviceaccount.com"
  },
  "requestId": "diag-..."
}
```

**Common failures:**

| Response | Cause |
|----------|--------|
| **401** `"Unauthorized"` | Wrong or missing `X-Hive-Secret` header. |
| **401** `"Google ADC/WIF not configured on Vercel. See docs/vercel-gcp-wif-setup.md"` | Vercel is not issuing OIDC tokens for GCP, or audience/issuer/pool/provider don’t match; or the principal doesn’t have `roles/iam.serviceAccountTokenCreator` on the SA. |
| **403** `"Service account cannot access this folder/Shared Drive. Add hive-os-drive@hive-os-479319.iam.gserviceaccount.com as a MEMBER of the Shared Drive (Content manager)."` | The SA is not a member of the Shared Drive that contains the folder. Add it as above. |
| **400** `"folderId is required"` | Body must include `"folderId": "..."`. |
