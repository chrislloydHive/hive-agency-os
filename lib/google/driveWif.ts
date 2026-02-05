/**
 * Google Drive API client using Workload Identity Federation (no service account keys)
 * and service account impersonation.
 * - When oidcToken (from request header x-vercel-oidc-token) is provided: uses ExternalAccountClient
 *   so auth works in Vercel serverless where the token is not in a file.
 * - Otherwise: ADC (file or GOOGLE_APPLICATION_CREDENTIALS_JSON written to /tmp).
 */

import { writeFileSync } from 'fs';
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { ExternalAccountClient, GoogleAuth, Impersonated } from 'google-auth-library';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

const DEFAULT_PROJECT = 'hive-os-479319';
const DEFAULT_IMPERSONATE_EMAIL = 'hive-os-drive@hive-os-479319.iam.gserviceaccount.com';
const DEFAULT_POOL_ID = 'hive-os-vercel-pool';
const DEFAULT_PROVIDER_ID = 'vercel-oidc';

const WIF_DOCS = 'docs/vercel-gcp-wif-setup.md';

const ADC_CREDENTIALS_PATH = '/tmp/gcp-wif.json';

let _envLogged = false;

/**
 * If GOOGLE_APPLICATION_CREDENTIALS is not set but GOOGLE_APPLICATION_CREDENTIALS_JSON is set,
 * write the JSON to /tmp/gcp-wif.json and set GOOGLE_APPLICATION_CREDENTIALS so ADC can find it.
 * Do not log secrets.
 */
function ensureAdcCredentialsFile(): void {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) return;
  writeFileSync(ADC_CREDENTIALS_PATH, json, 'utf8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = ADC_CREDENTIALS_PATH;
}

/**
 * One-time debug log: boolean presence of Vercel OIDC and Google credential env vars only.
 */
function logEnvPresenceOnce(): void {
  if (_envLogged) return;
  _envLogged = true;
  console.log(
    '[WIF] env:',
    JSON.stringify({
      vercelOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
      vercelOidcTokenUrl: !!process.env.VERCEL_OIDC_TOKEN_URL,
      vercelOidcIssuer: !!process.env.VERCEL_OIDC_ISSUER,
      vercelOidcAudience: !!process.env.VERCEL_OIDC_AUDIENCE,
      googleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      googleApplicationCredentialsJson: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    })
  );
}

function getProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    DEFAULT_PROJECT
  );
}

function getImpersonateEmail(): string {
  const email =
    process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT?.trim() ||
    DEFAULT_IMPERSONATE_EMAIL;
  if (!email) {
    throw new Error(
      `Drive WIF: GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL (or GOOGLE_IMPERSONATE_SERVICE_ACCOUNT) is required. See ${WIF_DOCS}.`
    );
  }
  return email;
}

/**
 * Validates that env (or defaults) are in place and that ADC/WIF is available.
 * Throws with a clear message and pointer to WIF setup docs if something is missing.
 */
export function assertWifEnv(): void {
  const projectId = getProjectId();
  const impersonateEmail = getImpersonateEmail();
  if (!projectId || !impersonateEmail) {
    throw new Error(
      `Drive WIF requires GOOGLE_CLOUD_PROJECT and impersonation target. Set GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL. See ${WIF_DOCS} for configuration.`
    );
  }
}

/**
 * Returns { projectId, impersonateEmail } for debugging/logging. Uses env with defaults.
 */
export function getAuthModeSummary(): { projectId: string; impersonateEmail: string } {
  return {
    projectId: getProjectId(),
    impersonateEmail: getImpersonateEmail(),
  };
}

let _driveClient: drive_v3.Drive | null = null;

/**
 * Build a Drive client using the Vercel OIDC token from the request header.
 * Use when running on Vercel serverless (token is in x-vercel-oidc-token, not in a file).
 * Requires GCP_PROJECT_NUMBER and WIF pool/provider IDs (or defaults).
 */
async function getDriveClientWithOidcToken(oidcToken: string): Promise<drive_v3.Drive> {
  const projectNumber =
    process.env.GCP_PROJECT_NUMBER?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim();
  if (!projectNumber) {
    throw new Error(
      `Drive WIF with OIDC token requires GCP_PROJECT_NUMBER (or GOOGLE_CLOUD_PROJECT_NUMBER). Get it from GCP Console → IAM & Admin → Settings. See ${WIF_DOCS}.`
    );
  }

  const impersonateEmail = getImpersonateEmail();
  const poolId =
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() || DEFAULT_POOL_ID;
  const providerId =
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim() ||
    DEFAULT_PROVIDER_ID;

  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  const serviceAccountImpersonationUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${impersonateEmail}:generateAccessToken`;

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: serviceAccountImpersonationUrl,
    scopes: [DRIVE_SCOPE],
    subject_token_supplier: {
      getSubjectToken: () => Promise.resolve(oidcToken),
    },
  });

  if (!authClient) {
    throw new Error(
      `Drive WIF: ExternalAccountClient.fromJSON returned null. Check GCP_PROJECT_NUMBER and pool/provider. See ${WIF_DOCS}.`
    );
  }

  return google.drive({
    version: 'v3',
    auth: authClient as drive_v3.Drive['context']['_options']['auth'],
  });
}

export interface GetDriveClientOptions {
  /** OIDC token from request header x-vercel-oidc-token. When set, uses WIF with this token (no file). */
  oidcToken?: string | null;
}

/**
 * Returns a Drive v3 client using WIF/OIDC or ADC.
 * - If options.oidcToken is provided: uses that token (Vercel serverless; token from request header).
 * - Otherwise: ADC (Vercel OIDC file or GOOGLE_APPLICATION_CREDENTIALS_JSON).
 * Use supportsAllDrives: true at call sites for Shared Drives.
 */
export async function getDriveClient(
  options?: GetDriveClientOptions
): Promise<drive_v3.Drive> {
  const token = options?.oidcToken?.trim();
  if (token) {
    return getDriveClientWithOidcToken(token);
  }

  if (_driveClient) return _driveClient;

  ensureAdcCredentialsFile();
  logEnvPresenceOnce();

  const impersonateEmail = getImpersonateEmail();
  const projectId = getProjectId();
  console.log(
    '[WIF]',
    JSON.stringify({ authMode: 'wif', impersonateEmail, projectId })
  );

  const sourceAuth = new google.auth.GoogleAuth({ scopes: [DRIVE_SCOPE] });
  let sourceClient: Awaited<ReturnType<GoogleAuth['getClient']>>;
  try {
    sourceClient = await sourceAuth.getClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Drive WIF: ADC failed (no credentials from OIDC/WIF). ${msg} See ${WIF_DOCS} for Vercel + GCP WIF setup.`
    );
  }

  const auth = new Impersonated({
    sourceClient,
    targetPrincipal: impersonateEmail,
    targetScopes: [DRIVE_SCOPE],
    lifetime: 3600,
    delegates: [],
  });

  _driveClient = google.drive({
    version: 'v3',
    auth: auth as drive_v3.Drive['context']['_options']['auth'],
  });
  return _driveClient;
}
