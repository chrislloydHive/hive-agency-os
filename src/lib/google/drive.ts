/**
 * Google Drive client using Service Account (EMAIL + PRIVATE_KEY env only).
 * Use when you do not want to store the full JSON key in env.
 * All call sites must use supportsAllDrives: true for Shared Drives.
 */

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

function getEmail(): string {
  const v = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!v || !v.trim()) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL is required for Drive. Set it (and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) in your environment.'
    );
  }
  return v.trim();
}

function getPrivateKey(): string {
  const v = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!v || !v.trim()) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is required for Drive. Set it (and GOOGLE_SERVICE_ACCOUNT_EMAIL) in your environment.'
    );
  }
  return v.trim().replace(/\\n/g, '\n');
}

let _client: drive_v3.Drive | null = null;

/**
 * Returns a Drive v3 client authenticated with the service account (JWT).
 * Uses GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
 * Use supportsAllDrives: true on all API calls for Shared Drives.
 */
export function getDriveClient(): drive_v3.Drive {
  if (_client) return _client;
  const auth = new google.auth.JWT({
    email: getEmail(),
    key: getPrivateKey(),
    scopes: [DRIVE_SCOPE],
  });
  _client = google.drive({ version: 'v3', auth });
  return _client;
}

/**
 * Throws a clear error if Drive env vars are missing. Call before using getDriveClient() when you want to fail fast with a helpful message.
 */
export function assertDriveEnv(): void {
  const missing: string[] = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()) missing.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Google Drive service account env missing: ${missing.join(', ')}. Set both to use Drive (Shared Drives supported at call sites with supportsAllDrives: true).`
    );
  }
}
