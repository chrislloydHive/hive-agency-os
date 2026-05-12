// lib/ai/anthropicRetry.ts
// Retry wrapper for Anthropic API calls with status-code-aware backoff.

import { APIError, APIConnectionTimeoutError } from '@anthropic-ai/sdk/error';

export interface AnthropicCallResult<T> {
  ok: true;
  value: T;
  retries: number;
}

export interface AnthropicCallError {
  ok: false;
  error: string;
  upstreamStatus: number | null;
  retryable: boolean;
  retries: number;
  requestId?: string;
}

export type AnthropicCallOutcome<T> = AnthropicCallResult<T> | AnthropicCallError;

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;

function isTransientStatus(status: number): boolean {
  return status === 529 || status === 503;
}

function isRateLimited(status: number): boolean {
  return status === 429;
}

function isTimeout(err: unknown): boolean {
  if (err instanceof APIConnectionTimeoutError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('etimedout') || msg.includes('timed out');
  }
  return false;
}

function extractRequestId(err: unknown): string | undefined {
  if (err instanceof APIError && err.requestID) return err.requestID;
  return undefined;
}

function extractRetryAfter(err: unknown): number | null {
  if (!(err instanceof APIError) || !err.headers) return null;
  const h = err.headers.get?.('retry-after');
  if (!h) return null;
  const seconds = parseFloat(h);
  if (!isNaN(seconds) && seconds > 0 && seconds < 30) return seconds * 1000;
  return null;
}

/**
 * Execute an Anthropic API call with automatic retry on transient errors.
 *
 * Retry policy:
 * - 529 (overloaded), 503: up to 2 retries, exponential backoff (500ms, 1500ms)
 * - 429 (rate-limited): single retry, respects Retry-After header (else 1s)
 * - Timeouts: up to 2 retries, same backoff
 * - All others: fail fast, no retry
 */
export async function callAnthropicWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<AnthropicCallOutcome<T>> {
  let lastErr: unknown;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const value = await fn();
      return { ok: true, value, retries };
    } catch (err) {
      lastErr = err;
      const reqId = extractRequestId(err);

      if (err instanceof APIError && err.status != null) {
        const status = err.status as number;

        if (isTransientStatus(status) && attempt < MAX_RETRIES) {
          const delay = BACKOFF_BASE_MS * Math.pow(3, attempt); // 500ms, 1500ms
          console.warn(
            `[anthropic-retry] ${context} got ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1}, request_id=${reqId || 'n/a'})`,
          );
          await sleep(delay);
          retries++;
          continue;
        }

        if (isRateLimited(status) && attempt < 1) {
          const delay = extractRetryAfter(err) ?? 1000;
          console.warn(
            `[anthropic-retry] ${context} got 429 rate-limited, retrying in ${delay}ms (request_id=${reqId || 'n/a'})`,
          );
          await sleep(delay);
          retries++;
          continue;
        }

        // Non-retryable or exhausted retries
        return {
          ok: false,
          error: err.message,
          upstreamStatus: status,
          retryable: isTransientStatus(status) || isRateLimited(status),
          retries,
          requestId: reqId,
        };
      }

      if (isTimeout(err) && attempt < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(3, attempt);
        console.warn(
          `[anthropic-retry] ${context} timed out, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
        );
        await sleep(delay);
        retries++;
        continue;
      }

      // Unknown error — fail fast
      break;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const reqId = extractRequestId(lastErr);
  const isTo = isTimeout(lastErr);
  const upstreamStatus =
    lastErr instanceof APIError && lastErr.status != null
      ? (lastErr.status as number)
      : null;

  return {
    ok: false,
    error: msg,
    upstreamStatus,
    retryable: isTo || (upstreamStatus !== null && (isTransientStatus(upstreamStatus) || isRateLimited(upstreamStatus))),
    retries,
    requestId: reqId,
  };
}

/**
 * Map an AnthropicCallError to the appropriate HTTP status code.
 * - 529/overloaded → 503
 * - timeout → 504
 * - other upstream failure → 502
 */
export function httpStatusForAnthropicError(err: AnthropicCallError): number {
  if (err.upstreamStatus === 529 || err.upstreamStatus === 503) return 503;
  if (
    err.error.toLowerCase().includes('timeout') ||
    err.error.includes('ETIMEDOUT') ||
    err.error.toLowerCase().includes('timed out')
  ) {
    return 504;
  }
  return 502;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
