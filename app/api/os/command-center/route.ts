// app/api/os/command-center/route.ts
// Chief of Staff AI — unified Command Center data model.
//
// Pulls from: Airtable Tasks, Google Calendar, Google Drive, Gmail.
// Normalizes into a single WorkItem shape, scores each item on
// Urgency / Importance / Risk / Momentum, links related items across
// systems, and returns a ranked set of categories:
//
//   topPriorities[3], fires[], thisWeek[], waitingOn[],
//   upcomingMeetings[] (with prep flags), recentActivity[]
//
// Query params:
//   ?companyId=xxx   — optional, for company-specific Google tokens

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getTasks, TASKS_LIST_FETCH_REVISION, type TaskRecord } from '@/lib/airtable/tasks';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';
import { getEffectiveImportantDomains } from '@/lib/personalContext';

export const dynamic = 'force-dynamic';

// ============================================================================
// Unified WorkItem model
// ============================================================================

export type WorkItemSource = 'airtable' | 'calendar' | 'drive' | 'gmail';
export type WorkItemType = 'task' | 'event' | 'doc' | 'email';

export interface WorkItem {
  id: string;
  source: WorkItemSource;
  type: WorkItemType;
  title: string;
  description?: string;
  dueDate?: string | null;
  lastActivity?: string | null;  // ISO
  owner?: string;
  status?: string;
  priority?: string | null;
  project?: string;
  links: { label: string; url: string }[];
  // Computed
  score?: number;
  scoreBreakdown?: { urgency: number; importance: number; risk: number; momentum: number };
  relatedIds?: string[];         // ids of linked items across systems
  flags?: string[];              // e.g. "overdue", "blocked", "idle", "no-prep", "hot"
  suggestedAction?: { label: string; effort: 'quick' | 'short' | 'deep'; when: 'now' | 'today' | 'thisWeek' };
}

// ============================================================================
// Helpers — Google fetch
// ============================================================================

export interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[];  // email strings
  description?: string;
  htmlLink?: string;
}

export async function fetchCalendarRange(accessToken: string, timeMin: string, timeMax: string): Promise<{ events: CalEvent[]; error?: string }> {
  const calendar = google.calendar({ version: 'v3' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  try {
    const res = await calendar.events.list({
      auth,
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = (res.data.items || []).map((e) => ({
      id: e.id || '',
      summary: e.summary || '(No title)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      allDay: !!e.start?.date,
      // Google may return attendee objects, strings, or odd shapes — always coerce to email strings
      attendees: (e.attendees || [])
        .map((a: unknown) => {
          if (a == null || a === '') return '';
          if (typeof a === 'string') return a.trim();
          const raw = (a as { email?: unknown }).email;
          return typeof raw === 'string' ? raw.trim() : '';
        })
        .filter(Boolean),
      description: e.description || undefined,
      htmlLink: e.htmlLink || undefined,
    }));
    return { events };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown calendar error';
    console.error('[Command Center] Calendar error:', msg);
    return { events: [], error: msg };
  }
}

interface DriveDoc {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  owners: string[];
  lastModifyingEmail?: string;
  lastModifyingName?: string;
  modifiedByMe?: boolean;
  viewedByMeTime?: string;
  sharedWithMeTime?: string;
  parentFolderId?: string;
}

async function fetchDriveRecent(accessToken: string, sinceDays = 14): Promise<DriveDoc[]> {
  const drive = google.drive({ version: 'v3' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  try {
    const res = await drive.files.list({
      auth,
      q: `modifiedTime > '${since.toISOString()}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,owners,lastModifyingUser,modifiedByMe,viewedByMeTime,sharedWithMeTime,parents)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });
    return (res.data.files || []).map(f => ({
      id: f.id || '',
      name: f.name || '(Untitled)',
      mimeType: f.mimeType || '',
      modifiedTime: f.modifiedTime || '',
      webViewLink: f.webViewLink || undefined,
      owners: (f.owners || []).map(o => o.displayName || o.emailAddress || '').filter(Boolean),
      lastModifyingEmail: f.lastModifyingUser?.emailAddress || undefined,
      lastModifyingName: f.lastModifyingUser?.displayName || undefined,
      modifiedByMe: f.modifiedByMe ?? undefined,
      viewedByMeTime: f.viewedByMeTime || undefined,
      sharedWithMeTime: f.sharedWithMeTime || undefined,
      parentFolderId: (f.parents && f.parents[0]) || undefined,
    }));
  } catch (err) {
    console.error('[Command Center] Drive error:', err);
    return [];
  }
}

async function fetchMyEmail(accessToken: string): Promise<string | null> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const res = await oauth2.userinfo.get();
    return res.data.email || null;
  } catch (err) {
    console.error('[Command Center] userinfo error:', err);
    return null;
  }
}

interface SentMessage {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  body: string;
  to: string;
  date: string;
  link: string;
}

async function fetchSentMessages(accessToken: string, days = 14): Promise<SentMessage[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `in:sent newer_than:${days}d`,
      maxResults: 40,
    });
    const ids = (list.data.messages || []).map(m => m.id).filter(Boolean) as string[];
    const messages = await Promise.all(ids.map(async id => {
      try {
        const m = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const headers = m.data.payload?.headers || [];
        const get = (n: string) => headers.find(h => typeof h.name === 'string' && h.name.toLowerCase() === n.toLowerCase())?.value || '';
        // Extract text from payload
        let body = '';
        type MsgPart = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: MsgPart[] | null };
        const walk = (part: MsgPart | undefined | null) => {
          if (!part) return;
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
          }
          (part.parts || []).forEach(walk);
        };
        walk(m.data.payload as MsgPart | undefined);
        if (!body && m.data.snippet) body = m.data.snippet;
        return {
          id: m.data.id || id,
          threadId: m.data.threadId || '',
          subject: get('Subject'),
          snippet: m.data.snippet || '',
          body: body.slice(0, 4000),
          to: get('To'),
          date: get('Date'),
          link: `https://mail.google.com/mail/u/0/#sent/${m.data.threadId || id}`,
        } as SentMessage;
      } catch {
        return null;
      }
    }));
    return messages.filter((m): m is SentMessage => !!m);
  } catch (err) {
    console.error('[Command Center] Gmail sent error:', err);
    return [];
  }
}

// ============================================================================
// Triage inbox — live Gmail search for threads needing action
// ============================================================================

export interface TriageItem {
  id: string;              // message id
  threadId: string;
  subject: string;
  snippet: string;
  from: string;            // raw From header
  fromName: string;
  fromEmail: string;
  fromDomain: string;
  date: string;            // ISO
  unread: boolean;
  starred: boolean;
  important: boolean;
  matchedReason: string;   // why it surfaced ("Important sender", "Unread primary", etc)
  link: string;
  hasExistingTask: boolean;
  score: number;           // higher = more likely needs Chris's attention
  scoreReasons: string[];  // short labels for why we scored it this way
}

// Extended with QB + finance subject keywords. CC_IMPORTANT_SENDERS env var appends domains.
const DEFAULT_IMPORTANT_SENDER_DOMAINS = ['quickbooks.com', 'intuit.com'];
// Actionable finance signals — Chris usually needs to DO something.
const SUBJECT_KEYWORD_RE = /\b(a\/r\s*aging|past\s*due|overdue|collections?|chargeback|dispute|wire\s*transfer|ach\s*(return|reject|fail)|check\s*bounced|nsf|invoice\s*(due|unpaid|overdue)|unpaid\s*invoice|final\s*notice|demand\s*letter|1099|w-?9|w-?2|tax\s*(return|notice|audit))\b/i;
// Informational financial FYIs — automated bank/payroll/QB notifications. Chris does NOT need to act.
// e.g. "Processing payment to X", "Payment scheduled", "Payment on the way", "Your receipt is attached",
// "will be withdrawn from your account", "payment was sent", "direct deposit", "statement available".
const FINANCIAL_FYI_RE = /\b(processing\s+payment|payment\s+(scheduled|on\s+the\s+way|sent|received|complete|successful|processed|confirmation)|payment\s+to\s+\w|your\s+receipt|receipt\s+is\s+attached|will\s+be\s+withdrawn|has\s+been\s+deposited|direct\s+deposit|deposit\s+confirmation|auto-?pay|autopay|statement\s+(available|ready|is\s+ready)|monthly\s+statement|account\s+summary|transaction\s+alert|deposit\s+notification|funds\s+(available|transferred)|transfer\s+(complete|successful)|scheduled\s+transfer|ach\s+(credit|debit|notification)|paystub|pay\s*stub|payroll\s+(processed|complete)|limit\s+(has\s+)?increased|credit\s+limit|processing\s+limit|your\s+(intuit|quickbooks|bank|chase|amex|paypal|venmo)\s+account|account\s+(activity|alert|security|update|notice|notification)|password\s+(was\s+)?(updated|changed|reset)|security\s+alert|sign[- ]?in\s+from|new\s+sign[- ]?in|two[- ]?factor|verification\s+code|confirm\s+your\s+(email|account|identity)|you.ve\s+scheduled|scheduled\s+\d*\s*bill\s+payment|bill\s+payments?\s+(scheduled|processed|sent)|here.s\s+your\s+report|payment\s+(information|method)\s+(has\s+been\s+|was\s+)?updated|your\s+account\s+has\s+been\s+updated|your\s+order|order\s+confirmation|weekly\s+.+\s+report|your\s+(weekly|monthly|daily)\s+\w+)\b/i;
// Auto-reply / out-of-office subject patterns. These should always be dropped regardless of finance keywords.
const AUTO_REPLY_RE = /^(\s*(automatic\s+reply|auto[- ]?reply|out\s+of\s+(office|the\s+office|the\s+country)|ooo|away\s+from\s+(the\s+office|my\s+desk)|vacation\s+(reply|response)|auto\s+response)\s*[:\-]|\s*\[?auto\s*(reply|response)\]?)/i;

// Noise signals — senders, local parts, and subjects that should be heavily down-ranked.
// These are broad filters; a starred/important flag or finance keyword can still override.
const BULK_DOMAIN_RE = /(^|\.)((strava|netflix|amazon|amazonses|southwest|airbnb|uber|lyft|doordash|instacart|grubhub|spotify|apple|youtube|google(?!\.com$)|linkedin|twitter|facebook|instagram|pinterest|slack|zoom|calendly|dropbox|notion|github|heygen|framer|wordfence|wix|squarespace|shopify|stripe|paypal|venmo|zelle|chase|wellsfargo|bankofamerica|capital-?one|amex|americanexpress|discover|visa|mastercard|experian|equifax|transunion|credit-?karma|mint|turbotax|quickbooks-?mail|mailchimp|sendgrid|hubspot|salesforce|intercom|zendesk|asana|monday|trello|basecamp|medium|substack|patreon|eventbrite|meetup|yelp|opentable|doordash|peloton|nike|adidas|ups|fedex|usps|dhl|ticketmaster|stubhub|expedia|booking|hotels|airbnb|kayak|tripadvisor|ikea|home-?depot|lowes|costco|walmart|target|bestbuy|newegg|ebay|etsy|aliexpress|wayfair|chewy|petco|petsmart|duolingo|audible|kindle|goodreads|grammarly|1password|lastpass|dashlane|webflow|figma|loom|airtable|coda|clickup|miro|canva|adobe|autodesk|microsoft|office|sharepoint|dropbox|box|docusign|hellosign|robinhood|coinbase|kraken|binance|gemini|plaid|carta|angellist|producthunt|techcrunch|verge|wired|bloomberg|wsj|nyt|washingtonpost|economist|bbc|cnn|foxnews|reuters|associated-?press|nfl|nba|mlb|nhl|espn)\.)/i;
const BULK_LOCAL_RE = /^(no-?reply|noreply|notifications?|automated|mailer|bounces|bulk|marketing|newsletter|info|hello|team|support|updates?|digest|alerts?|donotreply|do-?not-?reply|feedback|community|social|promo|deals|offers)@/i;
const NOISE_SUBJECT_RE = /\b(gave\s+you\s+kudos|new\s+submission|updates?\s+to\s+our\s+(terms|privacy|policy)|shipped[:\s]|your\s+.+\s+order|order\s+(confirm|ship)|receipt|welcome\s+to|verify\s+your|security\s+alert|booking\s+confirm|save\s+more|earn\s+more|you.re\s+invited|flash\s+sale|ends\s+tonight|new\s+follower|liked\s+your|started\s+following|reminder.+subscription|subscription\s+(renew|confirm)|free\s+trial|upgrade\s+now)\b/i;
// "Re: ..." pattern → likely a direct reply from a human, strong positive signal.
const REPLY_SUBJECT_RE = /^\s*(re|fwd?):/i;

// Workspace / personal-mail-style domains — suggests a human, not a bulk system.
const PERSONAL_DOMAIN_RE = /@(gmail|outlook|hotmail|live|icloud|me|mac|yahoo|aol|protonmail|pm\.me|fastmail|hey\.com)\.com$/i;

function scoreTriageItem(
  item: Omit<TriageItem, 'score' | 'scoreReasons'>,
  importantDomains: string[],
  now: Date,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const domain = item.fromDomain || '';
  const email = item.fromEmail || '';
  const localPart = email.split('@')[0] || '';
  const localAt = email;
  const subject = item.subject || '';

  // ── Strong positives ────────────────────────────────────────
  if (importantDomains.some(d => domain.endsWith(d))) {
    score += 60; reasons.push('key sender');
  }
  if (SUBJECT_KEYWORD_RE.test(subject)) {
    score += 55; reasons.push('finance keyword');
  }
  if (item.starred) { score += 35; reasons.push('starred'); }
  if (item.important) { score += 20; reasons.push('important'); }
  if (REPLY_SUBJECT_RE.test(subject)) { score += 25; reasons.push('reply'); }
  if (PERSONAL_DOMAIN_RE.test(email)) { score += 12; reasons.push('personal addr'); }

  // ── Strong negatives ────────────────────────────────────────
  if (BULK_DOMAIN_RE.test(domain)) { score -= 45; reasons.push('bulk sender'); }
  if (BULK_LOCAL_RE.test(`${localPart}@`) || BULK_LOCAL_RE.test(localAt)) {
    score -= 35; reasons.push('noreply/notif');
  }
  if (NOISE_SUBJECT_RE.test(subject)) { score -= 40; reasons.push('noise subject'); }
  // Automated financial FYIs — heavy penalty that overrides the key-sender/finance-keyword bonus.
  // These are common from QuickBooks/Intuit but aren't actionable (just "we moved money" notifications).
  if (FINANCIAL_FYI_RE.test(subject)) { score -= 110; reasons.push('financial FYI'); }

  // ── Recency boost ───────────────────────────────────────────
  const ageMs = now.getTime() - new Date(item.date).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  const recency = Math.max(0, 20 - ageDays * 2.5);
  score += recency;
  if (recency > 15) reasons.push('today');

  return { score, reasons };
}

function parseFromHeader(from: string): { name: string; email: string; domain: string } {
  const raw = typeof from === 'string' ? from : String(from ?? '');
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<?([^>]+)>?\s*$/);
  const name = (m?.[1] || '').trim();
  const email = String(m?.[2] ?? raw).trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  return { name, email, domain };
}

export const TRIAGE_IMPORTANT_SENDER_DOMAINS = DEFAULT_IMPORTANT_SENDER_DOMAINS;

export async function fetchTriageInbox(
  accessToken: string,
  existingThreadUrls: Set<string>,
  days = 14,
  importantDomains: string[] = DEFAULT_IMPORTANT_SENDER_DOMAINS,
): Promise<TriageItem[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Overlapping queries (dedupe by threadId after).
    // Starred gets its own query with NO time limit — starring is an explicit
    // "I care about this" signal from Chris, so age of the underlying email
    // shouldn't exclude it (Gmail's newer_than filters by received date, not
    // by when the star was applied).
    const domainClause = importantDomains.map(d => `from:${d}`).join(' OR ');
    const queries: Array<{ q: string; reason: string }> = [
      { q: `in:inbox category:primary is:unread newer_than:${days}d`, reason: 'Unread primary' },
      { q: `in:inbox is:starred`, reason: 'Starred' },
      { q: `in:inbox is:important newer_than:${days}d`, reason: 'Important' },
      ...(importantDomains.length
        ? [{ q: `in:inbox (${domainClause}) newer_than:${days}d`, reason: 'Key sender' }]
        : []),
    ];

    const seen = new Map<string, { id: string; reason: string }>(); // threadId → first match
    for (const { q, reason } of queries) {
      const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 25 });
      for (const m of list.data.messages || []) {
        if (!m.id || !m.threadId) continue;
        if (!seen.has(m.threadId)) seen.set(m.threadId, { id: m.id, reason });
      }
    }

    const entries = Array.from(seen.entries());
    const now = new Date();
    const msgs = await Promise.all(entries.map(async ([threadId, { id, reason }]) => {
      try {
        const m = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
        const headers = m.data.payload?.headers || [];
        const get = (n: string) => headers.find(h => typeof h.name === 'string' && h.name.toLowerCase() === n.toLowerCase())?.value || '';
        const from = get('From');
        const subject = get('Subject');
        const dateStr = get('Date');
        const { name, email, domain } = parseFromHeader(from);
        const labels = m.data.labelIds || [];
        const unread = labels.includes('UNREAD');
        const starred = labels.includes('STARRED');
        const important = labels.includes('IMPORTANT');
        const link = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;

        // Elevate match reason if subject hits finance keywords or key sender
        let matchedReason = reason;
        if (SUBJECT_KEYWORD_RE.test(subject)) matchedReason = 'Finance keyword';
        if (importantDomains.some(d => domain.endsWith(d))) matchedReason = 'Key sender';

        // Parse date; fallback to internalDate
        let dateIso = new Date().toISOString();
        try { if (dateStr) dateIso = new Date(dateStr).toISOString(); } catch { /* noop */ }

        const base: Omit<TriageItem, 'score' | 'scoreReasons'> = {
          id,
          threadId,
          subject: subject || '(no subject)',
          snippet: m.data.snippet || '',
          from,
          fromName: name || email,
          fromEmail: email,
          fromDomain: domain,
          date: dateIso,
          unread,
          starred,
          important,
          matchedReason,
          link,
          hasExistingTask: existingThreadUrls.has(link) || Array.from(existingThreadUrls).some(u => u.includes(threadId)),
        };
        const { score, reasons } = scoreTriageItem(base, importantDomains, now);
        return { ...base, score, scoreReasons: reasons } as TriageItem;
      } catch {
        return null;
      }
    }));

    // Filter: drop items with strongly negative score, UNLESS they're starred (explicit user signal).
    // NOTE: Financial FYIs (payment processing/scheduled/receipts) get -110 which overrides the
    // key-sender/finance-keyword bonuses — they'll fall below zero and be dropped here.
    const filtered = msgs
      .filter((m): m is TriageItem => !!m)
      .filter(m => {
        // Capture-only: once a Task exists for this thread, it's "tracked work" and
        // lives in the Tasks table — drop from Needs Triage so nothing lives here.
        if (m.hasExistingTask) return false;
        // Auto-replies / out-of-office are always dropped, even if starred (they're noise).
        if (AUTO_REPLY_RE.test(m.subject)) return false;
        if (m.starred) return true; // user explicitly starred → always keep
        // Hard drop if financial FYI detected, regardless of sender.
        if (FINANCIAL_FYI_RE.test(m.subject)) return false;
        if (m.important) return m.score >= -20;
        if (m.matchedReason === 'Key sender' || m.matchedReason === 'Finance keyword') return m.score >= 0;
        if (REPLY_SUBJECT_RE.test(m.subject)) return m.score > -25;
        return m.score >= 0;
      });

    // Sort by score desc, tiebreak by recency desc
    filtered.sort((a, b) => (b.score - a.score) || (b.date || '').localeCompare(a.date || ''));

    // Slot budget: 20 items total. Starred items are an explicit "I care" signal
    // from Chris and must NEVER get crowded out by higher-scoring noise. Reserve
    // the top of the list for all starred items, then fill the remaining slots
    // with the highest-scoring non-starred items.
    const starredItems = filtered.filter(m => m.starred);
    const nonStarredItems = filtered.filter(m => !m.starred);
    const remainingSlots = Math.max(0, 20 - starredItems.length);
    return [...starredItems, ...nonStarredItems.slice(0, remainingSlots)];
  } catch (err) {
    console.error('[Command Center] Gmail triage error:', err);
    return [];
  }
}

// ============================================================================
// Normalize → WorkItem
// ============================================================================

function taskToWorkItem(t: TaskRecord): WorkItem {
  const links: WorkItem['links'] = [];
  if (t.threadUrl) links.push({ label: 'Email', url: t.threadUrl });
  if (t.draftUrl) links.push({ label: 'Draft', url: t.draftUrl });
  if (t.attachUrl) links.push({ label: 'Attachment', url: t.attachUrl });

  return {
    id: `airtable:${t.id}`,
    source: 'airtable',
    type: 'task',
    title: t.task,
    description: t.nextAction || t.notes || undefined,
    dueDate: t.due,
    lastActivity: t.lastModified,
    status: t.status,
    priority: t.priority,
    project: t.project,
    owner: t.from || undefined,
    links,
  };
}

function eventToWorkItem(e: CalEvent): WorkItem {
  return {
    id: `calendar:${e.id}`,
    source: 'calendar',
    type: 'event',
    title: e.summary,
    description: e.description?.slice(0, 300),
    dueDate: e.start,
    lastActivity: e.start,
    owner: e.attendees[0],
    links: e.htmlLink ? [{ label: 'Calendar', url: e.htmlLink }] : [],
  };
}

function docToWorkItem(d: DriveDoc): WorkItem {
  return {
    id: `drive:${d.id}`,
    source: 'drive',
    type: 'doc',
    title: d.name,
    lastActivity: d.modifiedTime,
    owner: d.owners[0],
    links: d.webViewLink ? [{ label: 'Drive', url: d.webViewLink }] : [],
  };
}

// ============================================================================
// Scoring engine
// ============================================================================

function daysUntil(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - now.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function scoreItem(item: WorkItem, now: Date): WorkItem {
  let urgency = 0, importance = 0, risk = 0, momentum = 0;
  const flags: string[] = [];

  // Urgency — from due date proximity
  // Stale: overdue by >90d = probably abandoned, not a fire
  const dte = daysUntil(item.dueDate, now);
  if (dte !== null) {
    if (dte < -90) { urgency = 15; flags.push('stale'); }
    else if (dte < 0) { urgency = 100; flags.push('overdue'); }
    else if (dte === 0) urgency = 90;
    else if (dte <= 2) urgency = 75;
    else if (dte <= 7) urgency = 50;
    else if (dte <= 14) urgency = 25;
    else urgency = 10;
  }

  // Importance — from priority
  if (item.priority === 'P0') { importance = 100; flags.push('hot'); }
  else if (item.priority === 'P1') importance = 70;
  else if (item.priority === 'P2') importance = 40;
  else if (item.priority === 'P3') importance = 20;
  else importance = 30; // default

  // Risk — overdue, blocked, waiting
  if (flags.includes('overdue')) risk += 50;
  if (item.status === 'Waiting') { risk += 40; flags.push('blocked'); }
  // Idle: last activity > 14 days ago for active task
  if (item.type === 'task' && item.lastActivity && item.status !== 'Done' && item.status !== 'Archive') {
    const idleDays = daysUntil(item.lastActivity, now);
    if (idleDays !== null && idleDays < -14) { risk += 20; flags.push('idle'); }
  }

  // Momentum — recent activity boosts rank
  if (item.lastActivity) {
    const age = daysUntil(item.lastActivity, now);
    if (age !== null) {
      if (age >= -1) momentum = 80;
      else if (age >= -3) momentum = 50;
      else if (age >= -7) momentum = 25;
      else momentum = 5;
    }
  }

  const score = urgency * 0.35 + importance * 0.3 + risk * 0.25 + momentum * 0.1;

  return {
    ...item,
    score: Math.round(score * 10) / 10,
    scoreBreakdown: { urgency, importance, risk, momentum },
    flags,
  };
}

// ============================================================================
// Cross-system linking — match on project / client name tokens
// ============================================================================

/** Tokenize for cross-linking. Airtable fields are not always strings at runtime. */
function tokenize(s: unknown): string[] {
  const raw =
    typeof s === 'string'
      ? s
      : s === null || s === undefined
        ? ''
        : typeof s === 'number' || typeof s === 'boolean'
          ? String(s)
          : '';
  if (!raw.trim()) return [];
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'meeting', 'call', 'sync', 'review', 'follow', 'follow-up', 'project', 'client', 'team', 'all', 'new', 'update']);

function linkItems(items: WorkItem[]): WorkItem[] {
  const index = new Map<string, Set<number>>();
  items.forEach((item, idx) => {
    const tokens = new Set([
      ...tokenize(item.title),
      ...tokenize(item.project),
      ...tokenize(item.owner),
    ]);
    tokens.forEach(tok => {
      if (!index.has(tok)) index.set(tok, new Set());
      index.get(tok)!.add(idx);
    });
  });

  return items.map((item, idx) => {
    const tokens = new Set([
      ...tokenize(item.title),
      ...tokenize(item.project),
      ...tokenize(item.owner),
    ]);
    const matchCount = new Map<number, number>();
    tokens.forEach(tok => {
      const bucket = index.get(tok);
      if (!bucket) return;
      bucket.forEach(j => {
        if (j === idx) return;
        matchCount.set(j, (matchCount.get(j) || 0) + 1);
      });
    });
    const relatedIds = Array.from(matchCount.entries())
      .filter(([, n]) => n >= 2)     // need 2+ shared tokens to link
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([j]) => items[j].id);
    return { ...item, relatedIds };
  });
}

// ============================================================================
// Suggested actions
// ============================================================================

function suggestAction(item: WorkItem): WorkItem {
  if (item.type === 'task') {
    if (item.flags?.includes('overdue')) {
      return { ...item, suggestedAction: { label: 'Close out or reschedule', effort: 'quick', when: 'now' } };
    }
    if (item.flags?.includes('blocked')) {
      return { ...item, suggestedAction: { label: 'Nudge the person you\'re waiting on', effort: 'quick', when: 'today' } };
    }
    if (item.flags?.includes('hot')) {
      return { ...item, suggestedAction: { label: 'Start this first', effort: 'deep', when: 'now' } };
    }
    if (item.description) {
      return { ...item, suggestedAction: { label: item.description, effort: 'short', when: 'today' } };
    }
  }
  if (item.type === 'event' && item.flags?.includes('no-prep')) {
    return { ...item, suggestedAction: { label: 'Prep 10 min before', effort: 'quick', when: 'today' } };
  }
  return item;
}

// ============================================================================
// Categorization
// ============================================================================

function categorize(items: WorkItem[], now: Date) {
  const tasks = items.filter(i => i.type === 'task');
  const events = items.filter(i => i.type === 'event');
  const docs = items.filter(i => i.type === 'doc');

  // Fires: truly recent overdue (not stale) OR P0 hot — excludes blocked
  const fires = tasks
    .filter(t => !t.flags?.includes('stale'))
    .filter(t => !t.flags?.includes('blocked'))
    .filter(t => t.flags?.includes('overdue') || t.flags?.includes('hot'))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const usedIds = new Set(fires.map(f => f.id));

  // Waiting On: blocked tasks (not in fires)
  const waitingOn = tasks
    .filter(t => !usedIds.has(t.id))
    .filter(t => t.flags?.includes('blocked'))
    .filter(t => !t.flags?.includes('stale'))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  waitingOn.forEach(t => usedIds.add(t.id));

  // Top Priorities: top 3 non-fire/non-waiting tasks ranked by score
  const topPriorities = tasks
    .filter(t => !usedIds.has(t.id))
    .filter(t => !t.flags?.includes('stale'))
    .filter(t => t.status !== 'Archive' && t.status !== 'Done')
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);
  topPriorities.forEach(t => usedIds.add(t.id));

  // This Week: tasks due within 7 days, not already bucketed
  const thisWeek = tasks
    .filter(t => !usedIds.has(t.id))
    .filter(t => {
      const dte = daysUntil(t.dueDate, now);
      return dte !== null && dte >= 0 && dte <= 7;
    })
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  thisWeek.forEach(t => usedIds.add(t.id));

  // Stale: tasks overdue >90 days (ancient backlog — surface separately, collapsed)
  const stale = tasks
    .filter(t => !usedIds.has(t.id))
    .filter(t => t.flags?.includes('stale'))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  // Upcoming Meetings: events in next 7 days, excluding personal holds/focus/OOO blocks
  const BLOCK_TITLE_RE = /^(hold|focus|ooo|out of office|lunch|break|busy|block|dnd|do not disturb|wfh|commute|travel)\b/i;
  const upcomingMeetings = events
    .filter(e => {
      const dte = daysUntil(e.dueDate, now);
      if (dte === null || dte < 0 || dte > 7) return false;
      const title = (e.title || '').trim();
      if (!title) return false;
      if (BLOCK_TITLE_RE.test(title)) return false;
      return true;
    })
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  // Recent Activity: docs modified in last 7 days
  const recentActivity = docs
    .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''))
    .slice(0, 10);

  return { topPriorities, fires, thisWeek, waitingOn, upcomingMeetings, recentActivity, stale };
}

// Detect meetings with no prep: no linked tasks or docs
function flagNoPrepMeetings(items: WorkItem[]): WorkItem[] {
  const byId = new Map(items.map(i => [i.id, i]));
  return items.map(item => {
    if (item.type !== 'event') return item;
    const dte = daysUntil(item.dueDate, new Date());
    if (dte === null || dte < 0 || dte > 7) return item;
    const related = (item.relatedIds || []).map(id => byId.get(id)).filter(Boolean) as WorkItem[];
    const hasPrep = related.some(r => r.type === 'task' || r.type === 'doc');
    if (!hasPrep) {
      return { ...item, flags: [...(item.flags || []), 'no-prep'] };
    }
    return item;
  });
}

// ============================================================================
// Smart signals — derived from raw Google data (non-inbox critical work)
// ============================================================================

function emailDomain(email: unknown): string {
  if (typeof email !== 'string' || !email) return '';
  const at = email.indexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

function titleWordKey(s: string): string {
  // Normalized key for clustering by title prefix (e.g. "Q2 Pitch Deck - v3" → "q2-pitch-deck")
  const tokens = tokenize(s).slice(0, 3);
  return tokens.join('-');
}

const BLOCK_TITLE_RE_GLOBAL = /^(hold|focus|ooo|out of office|lunch|break|busy|block|dnd|do not disturb|wfh|commute|travel|standup|stand-up|daily|weekly|sync|1:1|1-on-1|1on1)\b/i;

interface FollowUpItem {
  id: string;
  title: string;
  when: string;              // ISO
  attendees: string[];
  externalCount: number;
  daysSince: number;
  link?: string;
  score: number;
}

function findFollowUps(
  pastEvents: CalEvent[],
  items: WorkItem[],
  myEmail: string | null,
  now: Date,
): FollowUpItem[] {
  const myDomain = emailDomain(myEmail);
  const meetingTokensByEvent = new Map<string, Set<string>>();
  // Build a set of tokens seen in tasks that are ACTIVE/recent (created/modified after meeting)
  const taskTokensWithRecentActivity: Array<{ tokens: Set<string>; since: Date }> = items
    .filter(i => i.type === 'task')
    .map(i => ({
      tokens: new Set([...tokenize(i.title), ...tokenize(i.project), ...tokenize(i.owner)]),
      since: i.lastActivity ? new Date(i.lastActivity) : new Date(0),
    }));

  const candidates: FollowUpItem[] = [];
  for (const ev of pastEvents) {
    const start = new Date(ev.start);
    if (isNaN(start.getTime())) continue;
    const daysSince = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 0 || daysSince > 7) continue;   // past week only
    const title = (ev.summary || '').trim();
    if (!title || BLOCK_TITLE_RE_GLOBAL.test(title)) continue;

    const external = ev.attendees.filter((a) => {
      const addr = typeof a === 'string' ? a : '';
      const d = emailDomain(addr);
      return d && d !== myDomain && addr.toLowerCase() !== (myEmail || '').toLowerCase();
    });
    if (external.length === 0) continue;   // internal-only or solo — skip

    const evTokens = new Set(tokenize(title));
    meetingTokensByEvent.set(ev.id, evTokens);

    // Does any task have 2+ shared tokens AND was touched AFTER the meeting?
    const hasFollowupTask = taskTokensWithRecentActivity.some(({ tokens, since }) => {
      if (since < start) return false;
      let shared = 0;
      for (const t of evTokens) if (tokens.has(t)) shared++;
      return shared >= 2;
    });
    if (hasFollowupTask) continue;

    // Score: external attendee count × recency weight (more recent → higher)
    const recencyWeight = Math.max(0.3, 1 - daysSince / 7);
    const score = Math.round((external.length * 10 + recencyWeight * 20) * 10) / 10;
    candidates.push({
      id: `followup:${ev.id}`,
      title,
      when: ev.start,
      attendees: external.slice(0, 6),
      externalCount: external.length,
      daysSince,
      link: ev.htmlLink,
      score,
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

interface ReviewQueueItem {
  id: string;
  title: string;
  lastModified: string;
  modifiedBy: string;
  link?: string;
  daysSinceViewed: number | null;
  daysSinceModified: number;
  score: number;
}

function findReviewQueue(docs: DriveDoc[], myEmail: string | null, now: Date): ReviewQueueItem[] {
  const myDomain = emailDomain(myEmail);
  const candidates: ReviewQueueItem[] = [];
  for (const d of docs) {
    if (d.modifiedByMe) continue;
    const modifierEmail = (d.lastModifyingEmail || '').toLowerCase();
    if (!modifierEmail || modifierEmail === (myEmail || '').toLowerCase()) continue;
    const mod = new Date(d.modifiedTime);
    if (isNaN(mod.getTime())) continue;
    const daysSinceModified = Math.round((now.getTime() - mod.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceModified < 0 || daysSinceModified > 14) continue;

    const viewedAt = d.viewedByMeTime ? new Date(d.viewedByMeTime) : null;
    const viewedAfterModify = viewedAt && !isNaN(viewedAt.getTime()) && viewedAt >= mod;
    if (viewedAfterModify) continue; // already reviewed

    const daysSinceViewed = viewedAt && !isNaN(viewedAt.getTime())
      ? Math.round((now.getTime() - viewedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Higher score = more critical. External domain modifier > internal. Never-viewed > stale-viewed.
    const modifierDomain = emailDomain(modifierEmail);
    const externalBonus = modifierDomain && modifierDomain !== myDomain ? 30 : 0;
    const neverViewedBonus = daysSinceViewed === null ? 25 : 0;
    const recencyBonus = Math.max(0, 20 - daysSinceModified * 1.4);
    const score = Math.round((externalBonus + neverViewedBonus + recencyBonus) * 10) / 10;

    candidates.push({
      id: `review:${d.id}`,
      title: d.name,
      lastModified: d.modifiedTime,
      modifiedBy: d.lastModifyingName || d.lastModifyingEmail || 'Someone',
      link: d.webViewLink,
      daysSinceViewed,
      daysSinceModified,
      score,
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 6);
}

interface InProgressCluster {
  id: string;
  label: string;
  docCount: number;
  lastModified: string;
  docs: { id: string; title: string; link?: string; modifiedTime: string }[];
  score: number;
  /** Drive folder link — opens the project folder directly */
  folderLink?: string;
  folderName?: string;
  /** 'folder' = real project folder cluster; 'name' = name-token fallback */
  quality?: 'folder' | 'name';
}

/** Batch-resolve Drive folder IDs → { name, webViewLink } */
async function resolveFolderNames(
  folderIds: string[],
  accessToken: string,
): Promise<Map<string, { name: string; link: string }>> {
  const result = new Map<string, { name: string; link: string }>();
  if (folderIds.length === 0) return result;

  try {
    const drive = google.drive({ version: 'v3' });
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    // Fetch folder metadata in parallel (cap at 15 to avoid rate limits)
    const unique = [...new Set(folderIds)].slice(0, 15);
    const results = await Promise.allSettled(
      unique.map(id =>
        drive.files.get({ auth, fileId: id, fields: 'id,name,webViewLink' }),
      ),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.data.id) {
        const d = r.value.data;
        result.set(d.id!, {
          name: d.name || '(Folder)',
          link: d.webViewLink || `https://drive.google.com/drive/folders/${d.id}`,
        });
      }
    }
  } catch (err) {
    console.error('[Command Center] folder name resolve error:', err);
  }
  return result;
}

// ── Folder / doc intelligence filters ───────────────────────────────────────

// Generic top-level folders that aren't meaningful project locations.
const FOLDER_BLOCKLIST_EXACT = new Set([
  'my drive', 'shared with me', 'starred', 'trash', 'recent',
  'meet recordings', 'google meet recordings',
  'templates', 'archive', 'archives', 'downloads', 'misc',
]);
function isGenericFolderName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (FOLDER_BLOCKLIST_EXACT.has(lower)) return true;
  if (/^\d{4}$/.test(lower)) return true;  // year folders
  if (/^\d{4}[-/]\d{2}$/.test(lower)) return true;  // year-month folders
  if (lower.length <= 2) return true;
  return false;
}

/** Doc name patterns that indicate auto-generated or administrative noise. */
const DOC_NOISE_PATTERNS = [
  /^meeting notes?/i,
  /^meet recording/i,
  /^recording[-_ ]/i,
  /^untitled/i,
  /^copy of /i,
  /invoice/i,
  /receipt/i,
  /^template/i,
  /\btemplate\b.*\btemplate\b/i,  // double-template in name
];
function isNoiseDoc(name: string): boolean {
  return DOC_NOISE_PATTERNS.some(re => re.test(name));
}

/** MIME types that represent active creative/strategic work (not just exports). */
const CREATIVE_MIME_TYPES = new Set([
  'application/vnd.google-apps.presentation',                     // Google Slides
  'application/vnd.google-apps.document',                         // Google Docs
  'application/vnd.google-apps.spreadsheet',                      // Google Sheets
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // .pptx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          // .xlsx
]);

/**
 * Score an individual doc for "project work" relevance.
 * Higher = more likely to be real work worth surfacing.
 * Returns 0 for docs that should be excluded entirely.
 */
function scoreDocRelevance(d: DriveDoc, myEmail: string | null, now: Date): number {
  const name = d.name.toLowerCase();
  let score = 0;

  // ── Exclude outright ──────────────────────────────────────────
  if (isNoiseDoc(d.name)) return 0;

  // ── Content type signal ───────────────────────────────────────
  // Presentations and docs = creative deliverables (high signal)
  if (d.mimeType.includes('presentation') || d.mimeType.includes('slides')) score += 30;
  else if (d.mimeType.includes('document') || d.mimeType.includes('wordprocessing')) score += 25;
  else if (d.mimeType.includes('spreadsheet') || d.mimeType.includes('sheet')) score += 20;
  else if (d.mimeType === 'application/pdf') score += 5;  // PDFs are usually exports, low signal
  else score += 10;  // other types get baseline

  // ── Name signals ──────────────────────────────────────────────
  // Project-work keywords in the filename
  if (/\b(brief|creative|campaign|strategy|proposal|recommendation|report|plan|media|production|review)\b/i.test(d.name)) score += 20;
  // Client project number pattern (e.g., "260CAR", "275CAR")
  if (/\d{3}[A-Z]{2,}/i.test(d.name)) score += 15;

  // ── Collaboration signal ──────────────────────────────────────
  // Someone else edited it = active project, not just personal file
  const lastEditor = (d.lastModifyingEmail || '').toLowerCase();
  const me = (myEmail || '').toLowerCase();
  if (lastEditor && lastEditor !== me) score += 15;

  // ── Shared signal ─────────────────────────────────────────────
  // Shared files are more likely to be project work
  if (d.sharedWithMeTime) score += 10;

  // ── Recency signal ────────────────────────────────────────────
  const daysSince = Math.round((now.getTime() - new Date(d.modifiedTime).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= 1) score += 15;
  else if (daysSince <= 3) score += 10;
  else if (daysSince <= 7) score += 5;

  // ── Actively edited (not just viewed) ─────────────────────────
  if (d.modifiedByMe) score += 10;

  // ── Penalty for personal/admin patterns ───────────────────────
  if (/\b(invoice|receipt|expense|payroll|tax|w-?9)\b/i.test(name)) score -= 40;
  if (/\b(tracker|tracking|log|inbox)\b/i.test(name) && !lastEditor) score -= 15;

  return Math.max(0, score);
}

function findInProgress(
  docs: DriveDoc[],
  myEmail: string | null,
  now: Date,
  folderMap: Map<string, { name: string; link: string }>,
): InProgressCluster[] {
  const myLower = (myEmail || '').toLowerCase();
  const mine = docs.filter(d => {
    if (d.modifiedByMe) return true;
    return (d.lastModifyingEmail || '').toLowerCase() === myLower;
  });
  const fourteen = new Date(now); fourteen.setDate(fourteen.getDate() - 14);

  // Score each doc for relevance — drop anything that scores 0
  const scored = mine
    .filter(d => new Date(d.modifiedTime) >= fourteen)
    .map(d => ({ doc: d, relevance: scoreDocRelevance(d, myEmail, now) }))
    .filter(({ relevance }) => relevance > 0);

  // Cluster docs: use parent folder when it's a meaningful project folder,
  // otherwise fall back to name-token clustering so docs in generic locations
  // (My Drive, year folders) still group by content similarity.
  const clusters = new Map<string, { doc: DriveDoc; relevance: number }[]>();
  for (const entry of scored) {
    const d = entry.doc;
    const folder = d.parentFolderId ? folderMap.get(d.parentFolderId) : undefined;
    const folderIsGeneric = !folder || isGenericFolderName(folder.name);

    const key = (!folderIsGeneric && d.parentFolderId)
      ? d.parentFolderId  // real project folder — cluster by folder
      : (() => {
          // Generic or unknown folder — cluster by doc name tokens
          const tokens = tokenize(d.name).slice(0, 2);
          const nameFallback =
            typeof d.name === 'string'
              ? d.name
              : typeof d.name === 'number' || typeof d.name === 'boolean'
                ? String(d.name)
                : '';
          return tokens.length ? `name:${tokens.join('-')}` : `name:${nameFallback.toLowerCase().slice(0, 20)}`;
        })();

    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(entry);
  }

  const out: InProgressCluster[] = [];
  for (const [key, entries] of clusters) {
    if (entries.length === 0) continue;

    entries.sort((a, b) => b.doc.modifiedTime.localeCompare(a.doc.modifiedTime));
    const lastMod = entries[0].doc.modifiedTime;
    const daysSince = Math.round((now.getTime() - new Date(lastMod).getTime()) / (1000 * 60 * 60 * 24));
    const recencyWeight = Math.max(0.2, 1 - daysSince / 14);

    // Aggregate relevance score: use mean doc relevance × doc count × recency
    const avgRelevance = entries.reduce((sum, e) => sum + e.relevance, 0) / entries.length;
    const score = Math.round(avgRelevance * entries.length * recencyWeight) / 10;

    // Use folder name + link only for real project folders (not name-based clusters)
    const isNameCluster = key.startsWith('name:');
    const folder = !isNameCluster ? folderMap.get(key) : undefined;
    const quality: 'folder' | 'name' = isNameCluster ? 'name' : 'folder';

    const label = folder?.name
      || entries[0].doc.name.split(/[-_—:]/)[0].trim()
      || key;

    out.push({
      id: `project:${key}`,
      label,
      docCount: entries.length,
      lastModified: lastMod,
      docs: entries.slice(0, 5).map(e => ({
        id: e.doc.id,
        title: e.doc.name,
        link: e.doc.webViewLink,
        modifiedTime: e.doc.modifiedTime,
      })),
      score,
      folderLink: folder?.link || undefined,
      folderName: folder?.name || undefined,
      quality,
    });
  }

  // Filter: require 2+ docs, and for name-token clusters require higher avg relevance
  const MIN_NAME_CLUSTER_RELEVANCE = 30;
  return out
    .filter(c => {
      if (c.docCount < 2) return false;
      // Name-token clusters must have docs with real project-work signals
      if (c.quality === 'name') {
        const clusterEntries = clusters.get(c.id.replace('project:', ''));
        if (clusterEntries) {
          const avg = clusterEntries.reduce((s, e) => s + e.relevance, 0) / clusterEntries.length;
          if (avg < MIN_NAME_CLUSTER_RELEVANCE) return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

interface CommitmentItem {
  id: string;
  phrase: string;        // extracted commitment sentence
  to: string;
  subject: string;
  sentAt: string;
  link: string;
  deadline: string | null;  // parsed day name if present
  score: number;
}

const COMMITMENT_RE = /(?:\b(?:I['']?ll|I will|I'?m going to|I['']?m gonna|let me|I can|I shall)\b[^.?!\n]{5,140}[.?!\n])|(?:\b(?:will (?:send|share|ship|get|pull|prep|draft|put together|send over|loop in|follow up|circle back))\b[^.?!\n]{0,140}[.?!\n])|(?:\bby (?:tomorrow|tonight|today|this (?:afternoon|evening|week)|end of (?:day|week)|EOD|EOW|monday|tuesday|wednesday|thursday|friday|next week)\b[^.?!\n]{0,140}[.?!\n])/gi;
const DEADLINE_RE = /\b(?:tomorrow|tonight|today|this (?:afternoon|evening|week)|end of (?:day|week)|EOD|EOW|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i;

function findCommitments(sent: SentMessage[], now: Date): CommitmentItem[] {
  const out: CommitmentItem[] = [];
  for (const msg of sent) {
    if (!msg.body) continue;
    // Strip quoted reply blocks (lines starting with > or "On [date], X wrote:" and after)
    const trimmed = msg.body
      .split(/\n\s*On .{5,120} wrote:\s*\n/i)[0]
      .split('\n')
      .filter(l => !l.startsWith('>'))
      .join('\n');
    const matches = trimmed.match(COMMITMENT_RE);
    if (!matches) continue;
    // De-dupe identical phrases in the same message
    const seen = new Set<string>();
    const phrases = matches
      .map(m => String(m).trim().replace(/\s+/g, ' '))
      .filter(m => m.length > 12 && m.length < 200)
      .filter(m => { const k = m.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 2);

    for (const phrase of phrases) {
      const deadlineMatch = phrase.match(DEADLINE_RE);
      const deadline = deadlineMatch ? deadlineMatch[0] : null;
      const sentDate = msg.date ? new Date(msg.date) : now;
      const daysSinceSent = Math.round((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
      // Score: deadlines > general "I'll" statements; recent > old
      const deadlineBonus = deadline ? 30 : 0;
      const recencyBonus = Math.max(0, 20 - daysSinceSent * 1.4);
      const score = Math.round((deadlineBonus + recencyBonus + 10) * 10) / 10;
      out.push({
        id: `commit:${msg.id}:${phrase.slice(0, 20)}`,
        phrase,
        to: msg.to,
        subject: msg.subject,
        sentAt: sentDate.toISOString(),
        link: msg.link,
        deadline,
        score,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ============================================================================
// Simple in-memory cache (per server instance)
// ============================================================================

type CachePayload = { ts: number; data: unknown };
const CACHE = new Map<string, CachePayload>();
const CACHE_TTL_MS = 5_000;

function cacheGet(key: string): unknown | null {
  const v = CACHE.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > CACHE_TTL_MS) { CACHE.delete(key); return null; }
  return v.data;
}
function cacheSet(key: string, data: unknown) {
  CACHE.set(key, { ts: Date.now(), data });
}

// ============================================================================
// Main handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default';
    const noCache = searchParams.get('refresh') === '1';

    const cacheKey = `cc:${companyId}`;
    if (!noCache) {
      const cached = cacheGet(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const now = new Date();

    // ── Fetch tasks (Airtable: base/table via AIRTABLE_TASKS_* — see lib/airtable/tasks) ──
    let tasks: TaskRecord[] = [];
    let airtableTasksError: string | null = null;
    try {
      tasks = await getTasks({ excludeDone: true });
    } catch (err) {
      airtableTasksError = err instanceof Error ? err.message : String(err);
      console.error(
        '[Command Center] Airtable tasks failed (continuing without tasks):',
        airtableTasksError,
        '| tasksFetchRevision=',
        TASKS_LIST_FETCH_REVISION,
        '(if revision is missing, deploy/restart so lib/airtable/tasks.ts is current)',
      );
    }

    // ── Fetch Google data ───────────────────────────────────────────────
    let events: CalEvent[] = [];
    let pastEvents: CalEvent[] = [];
    let docs: DriveDoc[] = [];
    let sentMessages: SentMessage[] = [];
    let triageInbox: TriageItem[] = [];
    let myEmail: string | null = null;
    let googleConnected = false;
    let googleError: string | null = null;
    let resolvedAccessToken: string | null = null;

    // Build set of thread URLs already linked to tasks so we can mark dupes
    const existingThreadUrls = new Set<string>();
    for (const t of tasks) if (t.threadUrl) existingThreadUrls.add(t.threadUrl);

    // Pulled from context/personal/senders.md + CC_IMPORTANT_SENDERS env override.
    const importantDomains = await getEffectiveImportantDomains();

    try {
      let refreshToken: string | undefined;
      if (companyId && companyId !== 'default') {
        const integrations = await getCompanyIntegrations(companyId);
        refreshToken = integrations?.google?.refreshToken;
      }
      if (!refreshToken) {
        const fallback = await getAnyGoogleRefreshToken();
        if (fallback) refreshToken = fallback;
      }

      if (!refreshToken) {
        googleError = 'No Google refresh token found for this company or any fallback integration.';
      } else {
        googleConnected = true;
        const accessToken = await refreshAccessToken(refreshToken);
        resolvedAccessToken = accessToken;

        const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
        const pastStart = new Date(now); pastStart.setDate(pastStart.getDate() - 7); pastStart.setHours(0, 0, 0, 0);

        const [calResult, pastCalResult, driveResult, sentResult, emailResult, triageResult] = await Promise.all([
          fetchCalendarRange(accessToken, weekStart.toISOString(), weekEnd.toISOString()),
          fetchCalendarRange(accessToken, pastStart.toISOString(), weekStart.toISOString()),
          fetchDriveRecent(accessToken, 14),
          fetchSentMessages(accessToken, 14),
          fetchMyEmail(accessToken),
          fetchTriageInbox(accessToken, existingThreadUrls, 14, importantDomains),
        ]);
        events = calResult.events;
        pastEvents = pastCalResult.events;
        docs = driveResult;
        sentMessages = sentResult;
        myEmail = emailResult;
        triageInbox = triageResult;
        if (calResult.error) googleError = `Calendar: ${calResult.error}`;
      }
    } catch (err) {
      googleError = err instanceof Error ? err.message : 'Unknown Google error';
      console.error('[Command Center] Google fetch error:', err);
    }

    // ── Normalize → WorkItem[] ──────────────────────────────────────────
    let items: WorkItem[] = [
      ...tasks.map(taskToWorkItem),
      ...events.map(eventToWorkItem),
      ...docs.map(docToWorkItem),
    ];

    // ── Link across systems ─────────────────────────────────────────────
    items = linkItems(items);

    // ── Score ────────────────────────────────────────────────────────────
    items = items.map(i => scoreItem(i, now));

    // ── Flag no-prep meetings ───────────────────────────────────────────
    items = flagNoPrepMeetings(items);

    // ── Suggest actions ─────────────────────────────────────────────────
    items = items.map(suggestAction);

    // ── Categorize ──────────────────────────────────────────────────────
    const categories = categorize(items, now);

    // ── Smart signals ───────────────────────────────────────────────────
    const followUps = findFollowUps(pastEvents, items, myEmail, now);
    const reviewQueue = findReviewQueue(docs, myEmail, now);

    // Resolve Drive parent folder names so "What You're Building" can link
    // directly to project folders instead of just individual docs.
    const folderIds = docs
      .filter(d => d.parentFolderId)
      .map(d => d.parentFolderId!);
    const folderMap = resolvedAccessToken
      ? await resolveFolderNames(folderIds, resolvedAccessToken)
      : new Map<string, { name: string; link: string }>();

    const inProgress = findInProgress(docs, myEmail, now, folderMap);
    const commitments = findCommitments(sentMessages, now);

    const response = {
      ...categories,
      followUps,
      reviewQueue,
      inProgress,
      commitments,
      triage: triageInbox,
      counts: {
        topPriorities: categories.topPriorities.length,
        fires: categories.fires.length,
        thisWeek: categories.thisWeek.length,
        waitingOn: categories.waitingOn.length,
        upcomingMeetings: categories.upcomingMeetings.length,
        recentActivity: categories.recentActivity.length,
        stale: categories.stale.length,
        followUps: followUps.length,
        reviewQueue: reviewQueue.length,
        inProgress: inProgress.length,
        commitments: commitments.length,
        triage: triageInbox.length,
      },
      googleConnected,
      googleError,
      airtableTasksError,
      myEmail,
      sources: {
        tasks: tasks.length,
        events: events.length,
        pastEvents: pastEvents.length,
        docs: docs.length,
        sent: sentMessages.length,
        triage: triageInbox.length,
      },
      generatedAt: now.toISOString(),
    };

    cacheSet(cacheKey, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Command Center API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate command center' },
      { status: 500 },
    );
  }
}
