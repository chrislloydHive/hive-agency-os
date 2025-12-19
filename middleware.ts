import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Hive OS middleware
 * - Excludes inbound API routes (Gmail add-on uses header-based auth, not cookies)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Exclude inbound API endpoints from auth redirects
  if (
    pathname.startsWith("/api/os/inbound/") ||
    pathname.startsWith("/api/inbound/")
  ) {
    return NextResponse.next();
  }

  // TODO: your existing auth logic here (NextAuth / session gating / etc.)
  // This is intentionally minimal because your redirect logic may differ.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Run middleware on everything EXCEPT:
     * - next internals
     * - static assets
     * - favicon
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
