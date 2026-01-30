// lib/google/oauth.ts
// Reusable Google OAuth helpers: consent URL, code exchange, token refresh.
// Never logs token values.

import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
];

// ============================================================================
// Types
// ============================================================================

export interface ExchangeResult {
  refreshToken: string;
  accessToken: string;
  expiresAt: string; // ISO 8601
}

// ============================================================================
// Internal helper
// ============================================================================

function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/oauth/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build the Google OAuth consent URL.
 * The companyId is encoded in the `state` parameter so the callback can
 * associate tokens with the correct company.
 */
export function getGoogleOAuthUrl(companyId: string): string {
  const client = createOAuth2Client();

  const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

/**
 * Exchange an authorization code for tokens.
 * Throws if no refresh_token is returned (user may need to re-consent).
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<ExchangeResult> {
  const client = createOAuth2Client();
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
