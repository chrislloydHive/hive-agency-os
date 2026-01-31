// lib/oauth/state.ts
// HMAC-signed OAuth state tokens to prevent CSRF / state-tampering.
// Format: base64url(json).base64url(hmac-sha256)

import { createHmac } from 'crypto';

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'Missing OAUTH_STATE_SECRET or NEXTAUTH_SECRET — cannot sign OAuth state',
    );
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function hmac(data: string, secret: string): string {
  return base64url(
    Buffer.from(createHmac('sha256', secret).update(data).digest()),
  );
}

/**
 * Sign a JSON-serialisable payload into a tamper-proof state token.
 */
export function signState(payload: Record<string, unknown>): string {
  const secret = getSecret();
  const data = base64url(Buffer.from(JSON.stringify(payload), 'utf-8'));
  const sig = hmac(data, secret);
  return `${data}.${sig}`;
}

/**
 * Verify and decode a state token.
 */
export function verifyState(
  token: string,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const dot = token.indexOf('.');
  if (dot === -1) {
    return { ok: false, error: 'malformed state token (no signature)' };
  }

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const secret = getSecret();
  const expected = hmac(data, secret);

  if (sig !== expected) {
    return { ok: false, error: 'invalid state signature' };
  }

  try {
    const json = Buffer.from(data, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as Record<string, unknown>;
    return { ok: true, payload };
  } catch {
    return { ok: false, error: 'corrupt state payload' };
  }
}
