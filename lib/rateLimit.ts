/**
 * Simple in-memory rate limiter
 * Rate limit: 60 requests per minute per IP
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

/**
 * Check if request should be rate limited
 * Rate limit: 60 requests per minute per IP
 * 
 * @param ip - Client IP address
 * @returns Object with allowed status and retryAfterMs if limited
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  // No entry or expired entry
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = entry.resetAt - now;
    return {
      allowed: false,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

/**
 * Get client IP from request headers
 * Checks x-forwarded-for and x-real-ip headers (common in proxies/load balancers)
 * Falls back to 127.0.0.1 for local development
 * 
 * @param headers - Request headers object
 * @returns Client IP address as string
 */
export function getClientIP(headers: Headers): string {
  // Check various headers for IP (common in proxies/load balancers)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback (won't work in production but useful for local dev)
  return '127.0.0.1';
}

