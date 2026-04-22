/**
 * Gmail triage + Calendar range helpers shared by Command Center, Morning Brief,
 * and other OS routes. Kept out of `app/api/.../route.ts` so routes don't import
 * each other's route modules.
 */

import { google } from 'googleapis';

// ============================================================================
// Calendar
// ============================================================================

export interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[]; // email strings
  description?: string;
  htmlLink?: string;
}

export async function fetchCalendarRange(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<{ events: CalEvent[]; error?: string }> {
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

// ============================================================================
// Triage inbox — live Gmail search for threads needing action
// ============================================================================

export interface TriageItem {
  id: string; // message id
  threadId: string;
  subject: string;
  snippet: string;
  from: string; // raw From header
  fromName: string;
  fromEmail: string;
  fromDomain: string;
  date: string; // ISO
  unread: boolean;
  starred: boolean;
  important: boolean;
  matchedReason: string; // why it surfaced ("Important sender", "Unread primary", etc)
  link: string;
  hasExistingTask: boolean;
  score: number; // higher = more likely needs Chris's attention
  scoreReasons: string[]; // short labels for why we scored it this way
  /** Only populated for website-submission items — the fully formatted form
   *  body (every field on its own line). Used as Notes on the created task
   *  so the preview can show just Topic + Message while the full data is
   *  still available in the edit panel. */
  submissionBody?: string;
}

// Extended with QB + finance subject keywords. CC_IMPORTANT_SENDERS env var appends domains.
// Only match actionable QuickBooks domains, NOT broad intuit.com (which includes
// TurboTax marketing, Intuit developer newsletters, surveys, etc.).
const DEFAULT_IMPORTANT_SENDER_DOMAINS = ['quickbooks.com'];
// Actionable finance signals — Chris usually needs to DO something.
const SUBJECT_KEYWORD_RE =
  /\b(a\/r\s*aging|past\s*due|overdue|collections?|chargeback|dispute|wire\s*transfer|ach\s*(return|reject|fail)|check\s*bounced|nsf|invoice\s*(due|unpaid|overdue)|unpaid\s*invoice|final\s*notice|demand\s*letter|1099|w-?9|w-?2|tax\s*(return|notice|audit))\b/i;
// Informational financial FYIs — automated bank/payroll/QB notifications. Chris does NOT need to act.
// e.g. "Processing payment to X", "Payment scheduled", "Payment on the way", "Your receipt is attached",
// "will be withdrawn from your account", "payment was sent", "direct deposit", "statement available".
const FINANCIAL_FYI_RE =
  /\b(processing\s+payment|payment\s+(scheduled|on\s+the\s+way|sent|received|complete|successful|processed|confirmation)|payment\s+to\s+\w|your\s+receipt|receipt\s+is\s+attached|will\s+be\s+withdrawn|has\s+been\s+deposited|direct\s+deposit|deposit\s+confirmation|auto-?pay|autopay|statement\s+(available|ready|is\s+ready)|monthly\s+statement|account\s+summary|transaction\s+alert|deposit\s+notification|funds\s+(available|transferred)|transfer\s+(complete|successful)|scheduled\s+transfer|ach\s+(credit|debit|notification)|paystub|pay\s*stub|payroll\s+(processed|complete)|limit\s+(has\s+)?increased|credit\s+limit|processing\s+limit|your\s+(intuit|quickbooks|bank|chase|amex|paypal|venmo)\s+account|account\s+(activity|alert|security|update|notice|notification)|password\s+(was\s+)?(updated|changed|reset)|security\s+alert|sign[- ]?in\s+from|new\s+sign[- ]?in|two[- ]?factor|verification\s+code|confirm\s+your\s+(email|account|identity)|you.ve\s+scheduled|scheduled\s+\d*\s*bill\s+payment|bill\s+payments?\s+(scheduled|processed|sent)|here.s\s+your\s+report|payment\s+(information|method)\s+(has\s+been\s+|was\s+)?updated|your\s+account\s+has\s+been\s+updated|your\s+order|order\s+confirmation|weekly\s+.+\s+report|your\s+(weekly|monthly|daily)\s+\w+)\b/i;
// Auto-reply / out-of-office subject patterns. These should always be dropped regardless of finance keywords.
const AUTO_REPLY_RE =
  /^(\s*(automatic\s+reply|auto[- ]?reply|out\s+of\s+(office|the\s+office|the\s+country)|ooo|away\s+from\s+(the\s+office|my\s+desk)|vacation\s+(reply|response)|auto\s+response)\s*[:\-]|\s*\[?auto\s*(reply|response)\]?)/i;

// Noise signals — senders, local parts, and subjects that should be heavily down-ranked.
// These are broad filters; a starred/important flag or finance keyword can still override.
const BULK_DOMAIN_RE =
  /(^|\.)((strava|netflix|amazon|amazonses|southwest|airbnb|uber|lyft|doordash|instacart|grubhub|spotify|apple|youtube|google(?!\.com$)|linkedin|twitter|facebook|instagram|pinterest|slack|zoom|calendly|dropbox|notion|github|heygen|framer|wordfence|wix|squarespace|shopify|stripe|paypal|venmo|zelle|chase|wellsfargo|bankofamerica|capital-?one|amex|americanexpress|discover|visa|mastercard|experian|equifax|transunion|credit-?karma|mint|turbotax|quickbooks-?mail|mailchimp|sendgrid|hubspot|salesforce|intercom|zendesk|asana|monday|trello|basecamp|medium|substack|patreon|eventbrite|meetup|yelp|opentable|doordash|peloton|nike|adidas|ups|fedex|usps|dhl|ticketmaster|stubhub|expedia|booking|hotels|airbnb|kayak|tripadvisor|ikea|home-?depot|lowes|costco|walmart|target|bestbuy|newegg|ebay|etsy|aliexpress|wayfair|chewy|petco|petsmart|duolingo|audible|kindle|goodreads|grammarly|1password|lastpass|dashlane|webflow|figma|loom|airtable|coda|clickup|miro|canva|adobe|autodesk|microsoft|office|sharepoint|dropbox|box|docusign|hellosign|robinhood|coinbase|kraken|binance|gemini|plaid|carta|angellist|producthunt|techcrunch|verge|wired|bloomberg|wsj|nyt|washingtonpost|economist|bbc|cnn|foxnews|reuters|associated-?press|nfl|nba|mlb|nhl|espn)\.)/i;
const BULK_LOCAL_RE =
  /^(no-?reply|noreply|notifications?|automated|mailer|bounces|bulk|marketing|newsletter|info|hello|team|support|updates?|digest|alerts?|donotreply|do-?not-?reply|feedback|community|social|promo|deals|offers)@/i;
const NOISE_SUBJECT_RE =
  /\b(gave\s+you\s+kudos|new\s+submission|updates?\s+to\s+our\s+(terms|privacy|policy)|shipped[:\s]|your\s+.+\s+order|order\s+(confirm|ship)|receipt|welcome\s+to|verify\s+your|security\s+alert|booking\s+confirm|save\s+more|earn\s+more|you.re\s+invited|flash\s+sale|ends\s+tonight|new\s+follower|liked\s+your|started\s+following|reminder.+subscription|subscription\s+(renew|confirm)|free\s+trial|upgrade\s+now|line\s+of\s+credit|credit\s+line|pre[- ]?approv|get\s+funded|funding\s+(option|opportunit)|business\s+loan|business\s+financing|capital\s+for\s+your|no\s+hard\s+credit\s+pull|flexible\s+financ|got\s+approved|you.ve\s+been\s+approved|approved\s+for|your\s+opinion|take\s+a\s+survey|take\s+our\s+survey|quick\s+survey|feedback\s+survey|2[- ]?minute\s+survey|how\s+was\s+your|rate\s+your\s+(experience|recent)|we.d\s+like\s+your|share\s+your\s+(opinion|feedback|thoughts)|unsubscribe|this\s+has\s+been\s+earth\s+approved|eco[- ]?friendly|gift\s+baskets?|size\s+passport|your\s+withholding|one\s+quick\s+fix|take\s+control)\b/i;
// Cold outreach / sales spam — subject or snippet signals.
const COLD_OUTREACH_RE =
  /\b(cold\s+email|outbound\s+(system|leads?|campaign)|done[- ]for[- ]you\s+(outbound|lead|system)|qualified\s+leads|book\s+(a\s+)?call|get\s+booked|15[- ]?min(ute)?\s+(call|chat)|schedule\s+a\s+(demo|call|meeting)|quick\s+question|saw\s+your\s+(company|profile|website|linkedin)|reaching\s+out\s+because|thought\s+you.d\s+be\s+interested|would\s+love\s+to\s+connect|open\s+to\s+a\s+quick\s+chat|let.s\s+hop\s+on\s+a\s+call|we\s+help\s+(companies|businesses|agencies|founders))\b/i;
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
  if (importantDomains.some((d) => domain.endsWith(d))) {
    score += 60;
    reasons.push('key sender');
  }
  if (SUBJECT_KEYWORD_RE.test(subject)) {
    score += 55;
    reasons.push('finance keyword');
  }
  if (item.starred) {
    score += 35;
    reasons.push('starred');
  }
  if (item.important) {
    score += 20;
    reasons.push('important');
  }
  if (REPLY_SUBJECT_RE.test(subject)) {
    score += 25;
    reasons.push('reply');
  }
  if (PERSONAL_DOMAIN_RE.test(email)) {
    score += 12;
    reasons.push('personal addr');
  }

  // ── Strong negatives ────────────────────────────────────────
  if (BULK_DOMAIN_RE.test(domain)) {
    score -= 45;
    reasons.push('bulk sender');
  }
  if (BULK_LOCAL_RE.test(`${localPart}@`) || BULK_LOCAL_RE.test(localAt)) {
    score -= 35;
    reasons.push('noreply/notif');
  }
  if (NOISE_SUBJECT_RE.test(subject) || NOISE_SUBJECT_RE.test(item.snippet || '')) {
    score -= 40;
    reasons.push('noise subject');
  }
  // Automated financial FYIs — heavy penalty that overrides the key-sender/finance-keyword bonus.
  // These are common from QuickBooks/Intuit but aren't actionable (just "we moved money" notifications).
  if (FINANCIAL_FYI_RE.test(subject)) {
    score -= 110;
    reasons.push('financial FYI');
  }
  // Cold outreach / sales pitches — check both subject and snippet.
  if (COLD_OUTREACH_RE.test(subject) || COLD_OUTREACH_RE.test(item.snippet || '')) {
    score -= 80;
    reasons.push('cold outreach');
  }

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
    const domainClause = importantDomains.map((d) => `from:${d}`).join(' OR ');
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
    const msgs = await Promise.all(
      entries.map(async ([threadId, { id, reason }]) => {
        try {
          const m = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });
          const headers = m.data.payload?.headers || [];
          const get = (n: string) =>
            headers.find((h) => typeof h.name === 'string' && h.name.toLowerCase() === n.toLowerCase())?.value ||
            '';
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
          if (importantDomains.some((d) => domain.endsWith(d))) matchedReason = 'Key sender';

          // Parse date; fallback to internalDate
          let dateIso = new Date().toISOString();
          try {
            if (dateStr) dateIso = new Date(dateStr).toISOString();
          } catch {
            /* noop */
          }

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
            hasExistingTask:
              existingThreadUrls.has(link) || Array.from(existingThreadUrls).some((u) => u.includes(threadId)),
          };
          const { score, reasons } = scoreTriageItem(base, importantDomains, now);
          return { ...base, score, scoreReasons: reasons } as TriageItem;
        } catch {
          return null;
        }
      }),
    );

    // Filter: drop items with strongly negative score, UNLESS they're starred (explicit user signal).
    // NOTE: Financial FYIs (payment processing/scheduled/receipts) get -110 which overrides the
    // key-sender/finance-keyword bonuses — they'll fall below zero and be dropped here.
    const filtered = msgs
      .filter((m): m is TriageItem => !!m)
      .filter((m) => {
        // Capture-only: once a Task exists for this thread, it's "tracked work" and
        // lives in the Tasks table — drop from Needs Triage so nothing lives here.
        if (m.hasExistingTask) return false;
        // Auto-replies / out-of-office are always dropped, even if starred (they're noise).
        if (AUTO_REPLY_RE.test(m.subject)) return false;
        // Cold outreach is always dropped — sales spam doesn't deserve attention.
        if (COLD_OUTREACH_RE.test(m.subject) || COLD_OUTREACH_RE.test(m.snippet || '')) return false;
        // Starred bypass: starred items surface with age limits.
        // - Bulk sender starred items drop after 14 days (forgotten star on a notification).
        // - All other starred items drop after 30 days (if you haven't acted in a month,
        //   it's no longer active triage — archive the star or create a task).
        if (m.starred) {
          const ageMs = now.getTime() - new Date(m.date).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          const isBulk = BULK_DOMAIN_RE.test(m.fromDomain) || NOISE_SUBJECT_RE.test(m.subject);
          if (isBulk && ageDays > 14) return false;
          if (ageDays > 30) return false;
          return true;
        }
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
    const starredItems = filtered.filter((m) => m.starred);
    const nonStarredItems = filtered.filter((m) => !m.starred);
    const remainingSlots = Math.max(0, 20 - starredItems.length);
    return [...starredItems, ...nonStarredItems.slice(0, remainingSlots)];
  } catch (err) {
    console.error('[Command Center] Gmail triage error:', err);
    return [];
  }
}

/** Walker for Gmail message payload parts — concatenates every text/plain
 *  section, then falls back to text/html (stripped to text) if the email has
 *  no plain alternative. Framer's form notifications are HTML-only, so we
 *  need the HTML fallback to get real preview content. */
type MsgPart = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: MsgPart[] | null };

function decodePart(part: MsgPart): string {
  if (!part.body?.data) return '';
  return Buffer.from(part.body.data, 'base64').toString('utf-8');
}

/** Unicode chars commonly used as invisible preheader/tracking padding in
 *  marketing emails (Framer especially). Stripping these is critical — the
 *  marker-based preview split would otherwise return 200 chars of padding. */
const INVISIBLE_PADDING_RE = /[\u00AD\u034F\u200B\u200C\u200D\u2060\uFEFF]/g;

/** Strip HTML tags, decode common entities, normalize whitespace. Rough but
 *  good enough for preview text — we don't need faithful rendering. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Insert a space before closing block tags so "<p>A</p><p>B</p>" → "A B"
    .replace(/<\/(p|div|li|h[1-6]|tr|td|br)\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Drop invisible padding chars BEFORE whitespace collapse
    .replace(INVISIBLE_PADDING_RE, '')
    // Collapse runs of whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPlainBody(payload: MsgPart | undefined | null): string {
  if (!payload) return '';
  let plain = '';
  let html = '';
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plain += decodePart(part) + '\n';
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodePart(part) + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  if (plain.trim()) return plain;
  if (html.trim()) return htmlToText(html);
  return '';
}

/** Parse form-field lines (`Label: value`) out of a Framer submission body.
 *  Returns both a compact preview (Topic + Message only) for the task row
 *  and the full structured body (every field) for the Notes field.
 *
 *  Strategy: match lines against a Label:value pattern. Robust across Framer
 *  template variations because it ignores all preheader/boilerplate — those
 *  lines never match the pattern. If no fields detected, the caller falls
 *  back to Gmail's snippet.
 */
const FORM_FIELD_RE = /^([A-Z][A-Za-z0-9\s]{0,40}):\s*(.+)$/;

/** Labels to surface in the compact preview. Chris only wants to see Topic
 *  + Message in the row; everything else (Name, Email, Phone) is identifying
 *  noise that lives in the Notes field. */
function isTopicLabel(label: string): boolean {
  return /^(select\s+a\s+)?topic$/i.test(label.trim());
}
function isMessageLabel(label: string): boolean {
  return /^(message|notes?|details?|description|comments?)$/i.test(label.trim());
}

interface ParsedSubmission {
  preview: string;     // compact — Topic + Message only, truncated to ~220 chars
  fullBody: string;    // every field on its own line — drops into Notes
  hasFields: boolean;  // false if no form-field lines found (caller falls back)
  isSpam: boolean;     // true if the message/name look like bot-generated gibberish
}

/** Cheap common-English-word test. Presence of any of these in the message
 *  strongly suggests a real human wrote it. Spam submissions tend to be single
 *  random strings with no structure. */
const COMMON_WORDS_RE =
  /\b(the|and|or|i|we|you|your|our|my|me|is|are|was|be|have|has|for|in|on|at|of|with|about|to|from|would|could|can|please|thanks|thank|hi|hello|help|need|want|like|interested|looking|business|company|service|product|marketing|website|email|contact|ask|question|quote)\b/i;

/** Camel-case-in-the-middle pattern — e.g. "hPjiTnEbwfdjtCrsfj". Real words
 *  have internal caps only at sentence boundaries or after punctuation. */
function hasRandomCamelCase(s: string): boolean {
  if (!/^[A-Za-z]+$/.test(s)) return false;
  // Count transitions: lowercase → uppercase in the middle of a word.
  let transitions = 0;
  for (let i = 1; i < s.length; i++) {
    if (/[a-z]/.test(s[i - 1]) && /[A-Z]/.test(s[i])) transitions++;
  }
  return transitions >= 2;
}

/** Heuristic spam detector for Framer form submissions. Two-signal threshold:
 *  gibberish message + gibberish name/email = spam. Single signal isn't enough
 *  because legit submissions occasionally have short messages. */
function looksLikeSpamSubmission(fields: Array<{ label: string; value: string }>): boolean {
  const get = (re: RegExp) =>
    fields.find((f) => re.test(f.label.trim()))?.value.trim() || '';
  const name = get(/^name$/i);
  const email = get(/^email$/i);
  const message = get(/^(message|notes?|details?|description|comments?)$/i);

  let signals = 0;

  // Message signals
  if (message) {
    const words = message.split(/\s+/).filter((w) => w.length > 0);
    const singleBlob = words.length <= 1 && message.length >= 10;
    const noCommonWords = !COMMON_WORDS_RE.test(message);
    const randomCamelCase = hasRandomCamelCase(message.replace(/\s+/g, ''));
    if (singleBlob) signals++;
    if (noCommonWords && message.length >= 15) signals++;
    if (randomCamelCase) signals++;
  } else {
    // No message at all → probably a bot
    signals++;
  }

  // Name signals
  if (name && hasRandomCamelCase(name)) signals++;

  // Email signals — disposable gmail dotted variants are a tell
  if (email) {
    const local = email.split('@')[0] || '';
    const dots = (local.match(/\./g) || []).length;
    if (dots >= 3) signals++;
  }

  // Trigger on 2+ signals to keep false positives low.
  return signals >= 2;
}

function parseSubmissionBody(body: string): ParsedSubmission {
  if (!body) return { preview: '', fullBody: '', hasFields: false, isSpam: false };

  const stripped = body.replace(INVISIBLE_PADDING_RE, '');
  const lines = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fields: Array<{ label: string; value: string }> = [];
  for (const line of lines) {
    const m = line.match(FORM_FIELD_RE);
    if (m) fields.push({ label: m[1].trim(), value: m[2].trim() });
  }
  if (fields.length === 0) {
    return { preview: '', fullBody: '', hasFields: false, isSpam: false };
  }

  const isSpam = looksLikeSpamSubmission(fields);

  // Preview: Topic value (no label, it's already obvious) + "Message: <text>"
  // (label retained so the message reads as continuation, not mid-sentence).
  // Drops everything else — Name/Email/Phone are noise in the row and live in
  // Notes via the `fullBody` return below for the edit panel.
  const topic = fields.find((f) => isTopicLabel(f.label));
  const message = fields.find((f) => isMessageLabel(f.label));
  const previewParts: string[] = [];
  if (topic) previewParts.push(topic.value);
  if (message) previewParts.push(`Message: ${message.value}`);
  // If neither Topic nor Message found, fall back to all fields compactly.
  const previewRaw = previewParts.length > 0 ? previewParts.join(' · ') : fields.map((f) => `${f.label}: ${f.value}`).join(' · ');
  const preview = previewRaw.length > 220 ? previewRaw.slice(0, 217) + '…' : previewRaw;

  // Full body: every field, one per line. Perfect for Notes.
  const fullBody = fields.map((f) => `${f.label}: ${f.value}`).join('\n');

  return { preview, fullBody, hasFields: true, isSpam };
}

/**
 * Fetch website form submissions (Framer "New Submission" notifications).
 *
 * These are non-spam but low-priority — routine form fills from the Hive
 * marketing site. Separate from triage so they don't crowd out real emails,
 * and so the sync endpoint can create them as P3 tasks with a distinct source.
 *
 * We identify them by:
 *   - from:*@framer.com
 *   - subject matches /^\s*New Submission/i
 *
 * Fetches `format: 'full'` (heavier than metadata) so we can pull the real
 * form body into the preview, since Gmail's auto-snippet just grabs Framer's
 * boilerplate "You've just received a new submission" line.
 *
 * @returns TriageItem[] with matchedReason='Website submission'.
 */
export async function fetchWebsiteSubmissions(
  accessToken: string,
  existingThreadUrls: Set<string>,
  days = 30,
): Promise<TriageItem[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Framer form notifications come from @framer.com; subject always leads with
    // "New Submission" (Framer's default template). Broader net on the search
    // (just the domain) + client-side subject filter to catch variants.
    const q = `in:anywhere from:framer.com newer_than:${days}d`;
    const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 });
    const messageIds = (list.data.messages || [])
      .filter((m): m is { id: string; threadId: string } => Boolean(m.id && m.threadId));

    if (messageIds.length === 0) return [];

    const msgs = await Promise.all(
      messageIds.map(async ({ id, threadId }) => {
        try {
          // Full format so we get the body — metadata alone gives us Gmail's
          // auto-snippet which is always the Framer boilerplate.
          const m = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
          const headers = m.data.payload?.headers || [];
          const get = (n: string) =>
            headers.find((h) => typeof h.name === 'string' && h.name.toLowerCase() === n.toLowerCase())?.value ||
            '';
          const from = get('From');
          const subject = get('Subject');
          const dateStr = get('Date');

          // Subject must start with "New Submission" (case-insensitive, allow
          // leading whitespace). Drops Framer marketing emails etc.
          if (!/^\s*new submission/i.test(subject)) return null;

          const { name, email, domain } = parseFromHeader(from);
          const labels = m.data.labelIds || [];
          const link = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;

          let dateIso = new Date().toISOString();
          try {
            if (dateStr) dateIso = new Date(dateStr).toISOString();
          } catch {
            /* noop */
          }

          const bodyText = extractPlainBody(m.data.payload as MsgPart);
          const parsed = parseSubmissionBody(bodyText);
          // Drop spam before it becomes a task — bot-submitted gibberish
          // with no real name/message is noise Chris never wants to see.
          if (parsed.isSpam) return null;
          // Preview falls back to Gmail's snippet if no form fields parsed.
          const preview = parsed.hasFields
            ? parsed.preview
            : (m.data.snippet || '').slice(0, 220);

          const item: TriageItem = {
            id,
            threadId,
            subject: subject || '(no subject)',
            snippet: preview,
            from,
            fromName: name || email,
            fromEmail: email,
            fromDomain: domain,
            date: dateIso,
            unread: labels.includes('UNREAD'),
            starred: labels.includes('STARRED'),
            important: labels.includes('IMPORTANT'),
            matchedReason: 'Website submission',
            link,
            hasExistingTask:
              existingThreadUrls.has(link) ||
              Array.from(existingThreadUrls).some((u) => u.includes(threadId)),
            score: 0,
            scoreReasons: ['website-submission'],
            submissionBody: parsed.fullBody,
          };
          return item;
        } catch {
          return null;
        }
      }),
    );

    // Newest first, cap at 40 so the section doesn't explode if there's a backlog.
    return msgs
      .filter((m): m is TriageItem => !!m)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 40);
  } catch (err) {
    console.error('[Command Center] Gmail website submissions error:', err);
    return [];
  }
}
