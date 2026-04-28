/**
 * Emails for contacts stored on Companies where Is Client = true (Primary Contact Email).
 * Cached briefly to avoid hammering Airtable during Gmail triage scans.
 */

import { getBase } from '@/lib/airtable';

const COMPANIES_TABLE = process.env.AIRTABLE_COMPANIES_TABLE || 'Companies';

let cache: { emails: Set<string>; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getKnownClientContactEmails(): Promise<Set<string>> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return cache.emails;
  }
  const emails = new Set<string>();
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: '{Is Client} = TRUE()',
        fields: ['Primary Contact Email'],
      })
      .all();
    for (const r of records) {
      const raw = r.get('Primary Contact Email') as string | undefined;
      const e = raw?.trim().toLowerCase();
      if (e) emails.add(e);
    }
  } catch (e) {
    console.warn('[knownClientContacts] failed to load client contact emails:', e);
  }
  cache = { emails, expiresAt: now + TTL_MS };
  return emails;
}

export function isKnownClientEmail(
  known: Set<string> | undefined,
  email: string | null | undefined,
): boolean {
  if (!known || known.size === 0 || !email) return false;
  return known.has(email.trim().toLowerCase());
}

/** For tests — clear in-memory cache. */
export function __resetKnownClientContactCacheForTests(): void {
  cache = null;
}
