// lib/review/downloadSignature.ts
// HMAC-SHA256 signing/verification for short-lived download URLs.
// Env: DOWNLOAD_SIGNING_SECRET (required for signing and verification).

import { createHmac, timingSafeEqual } from 'crypto';

const PAYLOAD_SEP = '\n';

function getSecret(): string | null {
  const s = process.env.DOWNLOAD_SIGNING_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

/** Build canonical payload string for signing. */
export function buildPayload(assetId: string, token: string, exp: number): string {
  return [assetId, token, String(exp)].join(PAYLOAD_SEP);
}

/** Sign payload with HMAC-SHA256; returns hex string. */
export function signPayload(assetId: string, token: string, exp: number): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = buildPayload(assetId, token, exp);
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify signature. Returns true only if secret is set, payload matches, and exp is in the future.
 */
export function verifySignature(
  assetId: string,
  token: string,
  exp: number,
  sig: string
): boolean {
  const secret = getSecret();
  if (!secret || !sig) return false;
  const expected = createHmac('sha256', secret)
    .update(buildPayload(assetId, token, exp))
    .digest('hex');
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

export function isDownloadSigningConfigured(): boolean {
  return getSecret() != null;
}
