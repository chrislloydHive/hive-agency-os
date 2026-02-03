/**
 * Use client-provided approval timestamp when valid to avoid server timezone skew.
 * Airtable stores UTC; set the base timezone in Airtable (Base settings → Time zone)
 * so "Approved At" displays in your local time.
 */

const MAX_FUTURE_MS = 60 * 1000; // 1 min clock skew
const MAX_PAST_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * If the client sent a valid approvedAt (ISO string), return it as an ISO string.
 * Otherwise return server now. Valid = parses as date, not too far in past/future.
 */
export function resolveApprovedAt(clientApprovedAt: unknown): string {
  const now = new Date();
  const nowMs = now.getTime();

  if (typeof clientApprovedAt !== 'string' || !clientApprovedAt.trim()) {
    return now.toISOString();
  }

  const d = new Date(clientApprovedAt.trim());
  if (Number.isNaN(d.getTime())) {
    return now.toISOString();
  }

  const ms = d.getTime();
  if (ms > nowMs + MAX_FUTURE_MS || ms < nowMs - MAX_PAST_MS) {
    return now.toISOString();
  }

  return d.toISOString();
}
