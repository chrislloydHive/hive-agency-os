// lib/review/downloadSignature.ts
// HMAC-SHA256 signing/verification for short-lived download URLs (dlId + exp only; no token in URL).
// Env: DOWNLOAD_SIGNING_SECRET (required for signing and verification).

import { createHmac, timingSafeEqual } from 'crypto';

const PAYLOAD_SEP = '\n';

function getSecret(): string | null {
  const s = process.env.DOWNLOAD_SIGNING_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

/** Build canonical payload for download URL: dlId + exp (no token). */
export function buildDownloadPayload(dlId: string, exp: number): string {
  return [dlId, String(exp)].join(PAYLOAD_SEP);
}

/** Sign dlId + exp with HMAC-SHA256; returns hex string. */
export function signDownloadPayload(dlId: string, exp: number): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return createHmac('sha256', secret)
    .update(buildDownloadPayload(dlId, exp))
    .digest('hex');
}

/** Verify signature for dlId + exp. */
export function verifyDownloadSignature(dlId: string, exp: number, sig: string): boolean {
  const secret = getSecret();
  if (!secret || !sig) return false;
  const expected = createHmac('sha256', secret)
    .update(buildDownloadPayload(dlId, exp))
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
