// lib/inngest/client.ts
// Inngest client for background job processing

import { Inngest, InngestMiddleware } from 'inngest';

// Middleware to propagate Vercel OIDC token from request headers to function context
const vercelOidcMiddleware = new InngestMiddleware({
  name: 'Vercel OIDC Token Propagation',
  init: () => {
    return {
      onFunctionRun: ({ ctx, reqArgs }) => {
        // Extract x-vercel-oidc-token from request headers if available
        // reqArgs contains the Next.js request object for route handlers
        let oidcToken: string | undefined;
        
        if (reqArgs && Array.isArray(reqArgs) && reqArgs.length > 0) {
          // reqArgs is an array - first element might be the Next.js request
          const firstArg = reqArgs[0];
          if (firstArg && typeof firstArg === 'object' && 'headers' in firstArg) {
            const headers = firstArg.headers as Headers | Record<string, string>;
            if (headers instanceof Headers) {
              oidcToken = headers.get('x-vercel-oidc-token') || undefined;
            } else if (typeof headers === 'object') {
              oidcToken = headers['x-vercel-oidc-token'] || headers['X-Vercel-OIDC-Token'] || undefined;
            }
          }
        }
        
        // Temporary logging to confirm OIDC token presence
        console.log('[Inngest Middleware] OIDC token propagation:', {
          hasOidcToken: !!oidcToken,
          hasReqArgs: !!reqArgs,
          reqArgsLength: reqArgs?.length || 0,
        });
        
        return {
          transformInput: ({ ctx: inputCtx }) => {
            // Merge OIDC token into function context
            return {
              ctx: {
                ...inputCtx,
                oidcToken,
              },
            };
          },
        };
      },
    };
  },
});

// Create Inngest client with middleware
// Event key should be set in environment variables
export const inngest = new Inngest({
  id: 'hive-agency-os',
  name: 'Hive Agency OS Background Jobs',
  eventKey: process.env.INNGEST_EVENT_KEY,
  middleware: [vercelOidcMiddleware],
});

// TEMP instrumentation: Log Inngest config at boot (once per process)
if (typeof window === 'undefined') {
  console.log('[inngest/config]', {
    hasEventKey: Boolean(process.env.INNGEST_EVENT_KEY),
    eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.slice(0, 8) ?? null,
    hasSigningKey: Boolean(process.env.INNGEST_SIGNING_KEY),
    signingKeyPrefix: process.env.INNGEST_SIGNING_KEY?.slice(0, 8) ?? null,
    clientId: 'hive-agency-os',
  });
}
