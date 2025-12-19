import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // In development, skip auth entirely for easier testing
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // In production, check for session cookie
  const sessionCookie = request.cookies.get('next-auth.session-token') ||
                        request.cookies.get('__Secure-next-auth.session-token');

  if (!sessionCookie) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

// Protect all routes except auth pages, api routes, and static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - api/inngest (Inngest webhook endpoint)
     * - api/gap-ia (GAP-IA run endpoint for DMA)
     * - api/gap-plan (GAP Plan generation for DMA)
     * - api/gap-worker (GAP Worker endpoint for DMA)
     * - api/os/inbound (Gmail add-on webhook - uses X-Hive-Secret auth)
     * - api/inbound (Inbound lead ingestion webhook)
     * - auth (sign-in and error pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/auth|api/inngest|api/gap-ia|api/gap-plan|api/gap-worker|api/os/inbound|api/inbound|auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.ico$).*)',
  ],
};
