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
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',  // needed for drafts.create
];

// Bump version whenever SCOPES changes — forces re-consent.
export const GOOGLE_OAUTH_SCOPE_VERSION = 'v4-cal-gmail-compose';

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
 * Reads APP_URL exclusively — no other env vars influence this.
 * Throws if APP_URL is not set or is not https.
 */
export function getAppBaseUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error('APP_URL env var is required for OAuth');
  }
  // Allow http only for localhost dev; otherwise require https.
  const isLocal = url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
  if (!url.startsWith('https://') && !isLocal) {
    throw new Error(`APP_URL must be https, got: ${url}`);
  }
  const base = url.replace(/\/+$/, '');
  assertValidOAuthDomain(base);
  return base;
}

/**
 * Regression guard: reject known-bad domain typos so OAuth
 * never silently breaks again.
 */
function assertValidOAuthDomain(url: string): void {
  // "hiveagencyos" without the 'y' → "hiveagencos"
  if (/hiveagencos\./i.test(url)) {
    throw new Error(
      `Invalid redirect_uri domain detected (typo "hiveagencos" — missing "y"): ${url}`,
    );
  }
  if (/digitalmarketingaudit\.ai/i.test(url)) {
    throw new Error(
      `Invalid redirect_uri domain detected (DMA domain should not be used for OAuth): ${url}`,
    );
  }
}

function createOAuth2Client(redirectUri?: string) {
  const { clientId, clientSecret } = getClientCredentials();
  const callbackUrl = redirectUri ?? `${getAppBaseUrl()}${CALLBACK_PATH}`;
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

  const baseUrl = getAppBaseUrl();
  const redirectUri = `${baseUrl}${CALLBACK_PATH}`;
  const client = createOAuth2Client(redirectUri);

  console.log('[google-oauth] redirect_uri =', redirectUri);

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

/**
 * Email address for the Google account behind this access token.
 * Uses Gmail `users.getProfile` so it works with our OAuth scopes (gmail.*, drive, calendar).
 * The OAuth2 userinfo endpoint requires `openid` / `userinfo.*` scopes, which we do not request.
 */
export async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  if (!accessToken?.trim()) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.getProfile({ userId: 'me' });
  return res.data.emailAddress ?? null;
}
