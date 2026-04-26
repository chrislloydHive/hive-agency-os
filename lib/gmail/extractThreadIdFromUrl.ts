// lib/gmail/extractThreadIdFromUrl.ts
// Resolve Gmail API thread ids from Gmail web URLs (My Day, Command Center, sync).

/**
 * Extract a Gmail thread id from a Gmail web URL.
 * Handles `#inbox/`, `#all/`, `#sent/`, query `compose=`, optional `th=`, and a
 * generic hex segment after `#` (labels, etc.).
 */
export function extractGmailThreadIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const inboxAllSent = trimmed.match(
    /#(?:inbox|all|sent)\/([0-9a-f]{10,})(?:[?&#]|$)/i,
  );
  if (inboxAllSent?.[1]) return inboxAllSent[1];

  const compose = trimmed.match(/[?&]compose=([0-9a-f]{10,})(?:&|#|$)/i);
  if (compose?.[1]) return compose[1];

  const th = trimmed.match(/[?&]th=([0-9a-f]{10,})(?:&|#|$)/i);
  if (th?.[1]) return th[1];

  const generic = trimmed.match(/[#/]([0-9a-f]{10,})(?:[?&#]|$)/i);
  if (generic?.[1]) return generic[1];

  return null;
}
