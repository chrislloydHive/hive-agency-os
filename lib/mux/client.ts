import Mux from '@mux/mux-node';

let singleton: Mux | null | undefined;

/**
 * Mux Video API client (token id + secret from env).
 * Returns null when MUX_TOKEN_ID / MUX_TOKEN_SECRET are unset — ingestion skips Mux.
 */
export function getMuxClient(): Mux | null {
  if (singleton === undefined) {
    const tokenId = process.env.MUX_TOKEN_ID?.trim();
    const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
    if (!tokenId || !tokenSecret) {
      singleton = null;
    } else {
      singleton = new Mux({
        tokenId,
        tokenSecret,
        webhookSecret: getMuxWebhookSecret() ?? undefined,
      });
    }
  }
  return singleton ?? null;
}

/** Prefer MUX_WEBHOOK_SIGNING_SECRET; Mux SDK default env is MUX_WEBHOOK_SECRET. */
export function getMuxWebhookSecret(): string | undefined {
  return (
    process.env.MUX_WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.MUX_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}
