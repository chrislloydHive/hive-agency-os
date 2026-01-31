// lib/google/oauth.ts
// Reusable Google OAuth helpers: consent URL, code exchange, token refresh.
// Never logs token values.

import { google } from 'googleapis';
import { signState } from '@/lib/oauth/state';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
];

export const GOOGLE_OAUTH_SCOPE_VERSION = 'v2-drive';

const CALLBACK_PATH = '/api/oauth/google/callback';

// ============================================================================
// Types
// ============================================================================

export interface ExchangeResult {
  refreshToken: string;
  accessToken: string;
  expiresAt: string; // ISO 8601
}

// ============================================================================
// Internal helpers
// ============================================================================

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
    );
  }

  return { clientId, clientSecret };
}

/**
 * Canonical base URL for OAuth redirect_uri.
 * Reads APP_URL (the Hive Agency OS domain), NOT NEXT_PUBLIC_BASE_URL
 * which points to the DMA frontend.
 */
export function getCanonicalBaseUrl(): string {
  const url = process.env.APP_URL;
  if (url) return url.replace(/\/+$/, '');

  console.warn(
    '[google/oauth] APP_URL not set — falling back to https://hiveagencyos.com. ' +
    'Set APP_URL in your environment to silence this warning.',
  );
  return 'https://hiveagencyos.com';
}

function createOAuth2Client(redirectUri?: string) {
  const { clientId, clientSecret } = getClientCredentials();
  const callbackUrl = redirectUri ?? `${getCanonicalBaseUrl()}${CALLBACK_PATH}`;
  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build the Google OAuth consent URL.
 *
 * @param companyId - encoded in `state` so the callback can associate tokens
 * @param _origin   - DEPRECATED, ignored. Kept for call-site compat.
 */
export function getGoogleOAuthUrl(companyId: string, _origin?: string): string {
  if (_origin) {
    console.warn(
      '[google/oauth] getGoogleOAuthUrl: origin parameter is deprecated and ignored. ' +
      'The canonical base URL is derived from APP_URL.',
    );
  }

  const redirectUri = getCanonicalBaseUrl() + CALLBACK_PATH;
  const client = createOAuth2Client(redirectUri);

  const state = signState({
    companyId,
    scopeVersion: GOOGLE_OAUTH_SCOPE_VERSION,
    ts: Date.now(),
  });

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

/**
 * Exchange an authorization code for tokens.
 *
 * @param code        - the authorization code from Google
 * @param redirectUri - must match the redirect_uri used during consent
 *
 * Throws if no refresh_token is returned (user may need to re-consent).
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<ExchangeResult> {
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. The user may need to re-authorize with prompt=consent.',
    );
  }

  if (!tokens.access_token) {
    throw new Error('No access_token returned from token exchange.');
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

/**
 * Refresh an access token using a stored refresh token.
 * Returns a fresh access token string.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<string> {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error('Failed to refresh access token.');
  }

  return token;
}
