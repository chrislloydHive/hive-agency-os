/**
 * Google Drive API client using Workload Identity Federation (no service account keys)
 * and service account impersonation. ADC is provided by Vercel OIDC/WIF at runtime.
 */

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { GoogleAuth, Impersonated } from 'google-auth-library';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

const DEFAULT_PROJECT = 'hive-os-479319';
const DEFAULT_IMPERSONATE_EMAIL = 'hive-os-drive@hive-os-479319.iam.gserviceaccount.com';

const WIF_DOCS = 'docs/vercel-gcp-wif-setup.md';

function getProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    DEFAULT_PROJECT
  );
}

function getImpersonateEmail(): string {
  return (
    process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    DEFAULT_IMPERSONATE_EMAIL
  );
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
      `Drive WIF requires GOOGLE_CLOUD_PROJECT and GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL (or use defaults). See ${WIF_DOCS} for configuration.`
    );
  }
}

/**
 * Returns { projectId, impersonateEmail } for logging. Uses env with defaults.
 */
export function getAuthModeSummary(): { projectId: string; impersonateEmail: string } {
  return {
    projectId: getProjectId(),
    impersonateEmail: getImpersonateEmail(),
  };
}

let _driveClient: drive_v3.Drive | null = null;

/**
 * Returns a Drive v3 client using ADC (WIF/OIDC) and impersonated credentials.
 * Use supportsAllDrives: true at call sites for Shared Drives.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (_driveClient) return _driveClient;

  const impersonateEmail = getImpersonateEmail();

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
