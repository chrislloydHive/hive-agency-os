import type { NextRequest } from 'next/server';

/**
 * Origin for absolute URLs returned to the browser (signed downloads, etc.).
 * Uses NEXT_PUBLIC_APP_URL or VERCEL_URL when set so links match the public host;
 * otherwise falls back to the request URL (fine for local dev).
 */
export function getPublicOriginFromRequest(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      const href = explicit.includes('://') ? explicit : `https://${explicit}`;
      return new URL(href).origin;
    } catch {
      /* fall through */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel}`;
  }
  return req.nextUrl.origin;
}
