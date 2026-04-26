// True when threadUrl points at Gmail web mail (not Calendar / Meet) and has an API thread id.

import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';

export function isLikelyMailGoogleThreadUrl(threadUrl: string | null | undefined): boolean {
  if (!threadUrl || typeof threadUrl !== 'string') return false;
  const u = threadUrl.trim().toLowerCase();
  if (!u) return false;
  if (u.includes('calendar.google')) return false;
  if (u.includes('meet.google.com')) return false;
  if (!u.includes('mail.google.com')) return false;
  return extractGmailThreadIdFromUrl(threadUrl) != null;
}
