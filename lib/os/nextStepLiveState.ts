// lib/os/nextStepLiveState.ts
//
// Fetches live state (Gmail thread, linked docs, meeting notes) for the
// next-step handler. Returns structured data the prompt can ground on
// instead of relying on stale task-snapshot fields.

import type { gmail_v1, drive_v3 } from 'googleapis';
import type { TaskRecord } from '@/lib/airtable/tasks';
import { extractBody, stripQuotedReply } from '@/lib/gmail/threadContext';
import type { MsgPart } from '@/lib/gmail/threadContext';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface LiveAttachment {
  name: string;
  mimeType: string;
}

export interface LiveMessage {
  messageId: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  snippet: string;
  bodyPlainText: string;
  attachments: LiveAttachment[];
  newSinceTask: boolean;
  fromUser: boolean;
}

export interface LiveThreadState {
  messages: LiveMessage[];
  totalMessages: number;
  newSinceTask: number;
  ballInCourt: string; // "user" | "<other-party-email>"
}

export interface LiveLinkedDoc {
  docId: string;
  title: string;
  modifiedTime: string;
  excerpt: string;
  newerThanTask: boolean;
  url: string;
}

export interface MeetingNoteCandidate {
  title: string;
  url: string;
  date: string;
  attendees: string[];
  bodyText: string;
  source: 'drive' | 'gmail';
}

export interface MeetingNoteMatch extends MeetingNoteCandidate {
  matchReason: 'attendee' | 'keyword';
}

export interface MeetingSource {
  title: string;
  url: string;
  date: string;
}

export interface CrossThreadCandidate {
  threadId: string;
  threadUrl: string;
  subject: string;
  lastMessageDate: string;
  lastMessageFrom: string;
  messageCount: number;
  firstFewWordsOfLatestMessage: string;
  userIsLatestSender: boolean;
}

export interface SuggestedThreadRelink {
  fromThreadId: string;
  toThreadId: string;
  toThreadUrl: string;
  toSubject: string;
  reasoning: string;
}

export interface LiveState {
  thread: LiveThreadState | null;
  linkedDocs: LiveLinkedDoc[];
  meetingNotes: MeetingNoteMatch[];
  crossThreadCandidates: CrossThreadCandidate[];
  primaryOutboundContact: string | null;
  contactSource: string | null;
  stats: {
    threadMsgs: number;
    newSinceTask: number;
    linkedDocs: number;
    meetingCandidates: number;
    meetingMatched: number;
    ballInCourt: string;
    contactCandidates: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined | null,
  name: string,
): string {
  if (!headers) return '';
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function emailFromHeader(h: string): string {
  if (!h) return '';
  const bracket = h.match(/<([^>]+)>/);
  if (bracket) return bracket[1].trim().toLowerCase();
  const bare = h.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return bare ? bare[0].toLowerCase() : '';
}

function extractAttachments(payload: MsgPart | undefined | null): LiveAttachment[] {
  const result: LiveAttachment[] = [];
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.body && (part.body as Record<string, unknown>).attachmentId) {
      result.push({
        name: (part as Record<string, unknown>).filename as string || 'attachment',
        mimeType: part.mimeType || 'application/octet-stream',
      });
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return result;
}

function extractGoogleFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch) return docMatch[1];
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  return null;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'it', 'its', 'not',
  'no', 'up', 'out', 'just', 'about', 'into', 'over', 'after', 'before',
  'between', 'under', 'above', 'also', 'each', 'every', 'all', 'some',
  'any', 'more', 'than', 'then', 'now', 'very', 'too', 'so', 'how',
  'what', 'when', 'where', 'who', 'why', 'which', 'reply', 'follow',
  'task', 'email', 'send', 'check', 'update', 'new', 'get', 'set',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function parseAttendeesFromNoteBody(body: string): string[] {
  const emails: string[] = [];
  const attendeeSection = body.match(
    /(?:attendees?|participants?)\s*[:\-]\s*([\s\S]{0,2000}?)(?:\n\n|\n[A-Z]|\n#{1,3}\s)/i,
  );
  if (attendeeSection) {
    const matches = Array.from(
      attendeeSection[1].matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g),
    );
    for (const m of matches) {
      emails.push(m[0].toLowerCase());
    }
  }
  if (emails.length === 0) {
    const allEmails = Array.from(
      body.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g),
    );
    for (const m of allEmails) {
      emails.push(m[0].toLowerCase());
    }
  }
  return Array.from(new Set(emails));
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Live Thread
// ────────────────────────────────────────────────────────────────────────────

export async function fetchLiveThread(
  gmail: gmail_v1.Gmail,
  threadId: string,
  myEmail: string,
  task: TaskRecord,
): Promise<LiveThreadState | null> {
  try {
    const res = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });
    const rawMessages = res.data.messages || [];
    if (rawMessages.length === 0) return null;

    const taskCreatedMs = task.createdAt ? Date.parse(task.createdAt) : 0;
    const taskSyncedMs = task.lastSyncedAt ? Date.parse(task.lastSyncedAt) : 0;
    const cutoff = Math.max(taskCreatedMs, taskSyncedMs) || 0;
    const myEmailLower = myEmail.toLowerCase();

    const messages: LiveMessage[] = rawMessages.map((m) => {
      const headers = m.payload?.headers;
      const from = getHeader(headers, 'From');
      const to = getHeader(headers, 'To');
      const cc = getHeader(headers, 'Cc');
      const date = getHeader(headers, 'Date');
      const internalDateMs = Number(m.internalDate || 0);

      const rawBody = extractBody(m.payload as MsgPart) || m.snippet || '';
      const cleaned = stripQuotedReply(rawBody);
      const bodyPlainText = cleaned.length > 2000 ? cleaned.slice(0, 2000) + '…' : cleaned;

      return {
        messageId: m.id || '',
        from,
        to,
        cc,
        date,
        snippet: m.snippet || '',
        bodyPlainText,
        attachments: extractAttachments(m.payload as MsgPart),
        newSinceTask: cutoff > 0 && internalDateMs > cutoff,
        fromUser: !!myEmailLower && emailFromHeader(from) === myEmailLower,
      };
    });

    const lastMsg = messages[messages.length - 1];
    const ballInCourt = lastMsg.fromUser
      ? emailFromHeader(lastMsg.from) || 'user'
      : emailFromHeader(lastMsg.from) || 'unknown';
    // If the user sent the last message, ball is with the other party;
    // if someone else sent it, ball is with the user.
    const ball = lastMsg.fromUser
      ? (() => {
          // Find the most recent non-user sender
          for (let i = messages.length - 1; i >= 0; i--) {
            if (!messages[i].fromUser) {
              return emailFromHeader(messages[i].from) || 'other-party';
            }
          }
          // All messages from user (e.g. cold outreach); ball is with recipient
          return emailFromHeader(lastMsg.to.split(',')[0] || '') || 'other-party';
        })()
      : 'user';

    return {
      messages,
      totalMessages: messages.length,
      newSinceTask: messages.filter((m) => m.newSinceTask).length,
      ballInCourt: ball,
    };
  } catch (err) {
    console.warn(
      '[next-step/live-state] thread fetch failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Linked Docs
// ────────────────────────────────────────────────────────────────────────────

export async function fetchLinkedDocs(
  drive: drive_v3.Drive,
  task: TaskRecord,
): Promise<LiveLinkedDoc[]> {
  const urls = [task.draftUrl, task.attachUrl].filter(Boolean);
  const fileIds = urls.map(extractGoogleFileId).filter((id): id is string => !!id);
  if (fileIds.length === 0) return [];

  const taskCreatedMs = task.createdAt ? Date.parse(task.createdAt) : 0;
  const results: LiveLinkedDoc[] = [];

  for (const fileId of fileIds) {
    try {
      const meta = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, modifiedTime, webViewLink',
        supportsAllDrives: true,
      });
      const mime = meta.data.mimeType || '';
      let excerpt = '';
      if (mime === 'application/vnd.google-apps.document') {
        try {
          const exp = await drive.files.export(
            { fileId, mimeType: 'text/plain' },
            { responseType: 'arraybuffer' },
          );
          const text = Buffer.from(exp.data as ArrayBuffer).toString('utf-8').trim();
          excerpt = text.length > 1500 ? text.slice(0, 1500) + '…' : text;
        } catch { /* non-fatal */ }
      }

      const modMs = meta.data.modifiedTime ? Date.parse(meta.data.modifiedTime) : 0;
      results.push({
        docId: fileId,
        title: meta.data.name || 'Untitled',
        modifiedTime: meta.data.modifiedTime || '',
        excerpt,
        newerThanTask: taskCreatedMs > 0 && modMs > taskCreatedMs,
        url: meta.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      });
    } catch (err) {
      console.warn(
        `[next-step/live-state] linked doc fetch failed for ${fileId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Meeting Notes (Drive + Gmail)
// ────────────────────────────────────────────────────────────────────────────

async function fetchMeetingNotesDrive(
  drive: drive_v3.Drive,
): Promise<MeetingNoteCandidate[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  try {
    const res = await drive.files.list({
      q: [
        `mimeType='application/vnd.google-apps.document'`,
        `modifiedTime > '${sevenDaysAgo}'`,
        `(name contains 'Notes by Gemini' or name contains 'Meeting notes')`,
        `trashed = false`,
      ].join(' and '),
      orderBy: 'modifiedTime desc',
      pageSize: 25,
      fields: 'files(id, name, modifiedTime, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const candidates: MeetingNoteCandidate[] = [];
    for (const f of res.data.files || []) {
      if (!f.id) continue;
      let bodyText = '';
      try {
        const exp = await drive.files.export(
          { fileId: f.id, mimeType: 'text/plain' },
          { responseType: 'arraybuffer' },
        );
        bodyText = Buffer.from(exp.data as ArrayBuffer).toString('utf-8').trim();
      } catch { /* skip */ }

      candidates.push({
        title: f.name || 'Untitled',
        url: f.webViewLink || `https://docs.google.com/document/d/${f.id}/edit`,
        date: f.modifiedTime || '',
        attendees: parseAttendeesFromNoteBody(bodyText),
        bodyText,
        source: 'drive',
      });
    }
    return candidates;
  } catch (err) {
    console.warn(
      '[next-step/live-state] Drive meeting notes fetch failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function fetchMeetingNotesGmail(
  gmail: gmail_v1.Gmail,
): Promise<MeetingNoteCandidate[]> {
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:(notetaker-noreply@google.com OR meet-recordings-noreply@google.com OR notes@otter.ai OR notifications@fireflies.ai OR noreply@read.ai OR noreply@tldv.io) newer_than:7d',
      maxResults: 15,
    });
    const ids = (res.data.messages || [])
      .map((m) => m.id)
      .filter((s): s is string => !!s);
    if (ids.length === 0) return [];

    const fetched = await Promise.all(
      ids.map((id) =>
        gmail.users.messages
          .get({ userId: 'me', id, format: 'full' })
          .then((r) => r.data)
          .catch(() => null),
      ),
    );

    const candidates: MeetingNoteCandidate[] = [];
    for (const m of fetched) {
      if (!m) continue;
      const headers = m.payload?.headers;
      const subject = getHeader(headers, 'Subject')
        .replace(/^(fwd?|re):\s*/i, '')
        .trim();
      const dateHeader = getHeader(headers, 'Date');
      const bodyText = extractBody(m.payload as MsgPart) || m.snippet || '';
      const threadId = m.threadId;
      const url = threadId
        ? `https://mail.google.com/mail/u/0/#inbox/${threadId}`
        : '';

      candidates.push({
        title: subject || 'Meeting note',
        url,
        date: dateHeader || (m.internalDate ? new Date(Number(m.internalDate)).toISOString() : ''),
        attendees: parseAttendeesFromNoteBody(bodyText),
        bodyText,
        source: 'gmail',
      });
    }
    return candidates;
  } catch (err) {
    console.warn(
      '[next-step/live-state] Gmail meeting notes fetch failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Filter meeting notes by relevance to the task
// ────────────────────────────────────────────────────────────────────────────

function filterMeetingNotes(
  candidates: MeetingNoteCandidate[],
  taskContactEmails: Set<string>,
  task: TaskRecord,
): MeetingNoteMatch[] {
  const taskTokens = new Set(
    tokenize(
      [task.task, task.project, task.nextAction, task.from].filter(Boolean).join(' '),
    ),
  );

  const scored: Array<{
    candidate: MeetingNoteCandidate;
    matchReason: 'attendee' | 'keyword';
    score: number;
  }> = [];

  for (const c of candidates) {
    // Attendee overlap
    const attendeeOverlap = c.attendees.some((a) => taskContactEmails.has(a.toLowerCase()));
    if (attendeeOverlap) {
      scored.push({ candidate: c, matchReason: 'attendee', score: 100 });
      continue;
    }

    // Keyword match
    const noteText = (c.title + ' ' + c.bodyText.slice(0, 500)).toLowerCase();
    let keywordHits = 0;
    for (const token of Array.from(taskTokens)) {
      if (noteText.includes(token)) keywordHits++;
    }
    if (keywordHits >= 1) {
      scored.push({ candidate: c, matchReason: 'keyword', score: keywordHits });
    }
  }

  scored.sort((a, b) => {
    if (a.matchReason === 'attendee' && b.matchReason !== 'attendee') return -1;
    if (b.matchReason === 'attendee' && a.matchReason !== 'attendee') return 1;
    if (b.score !== a.score) return b.score - a.score;
    return (b.candidate.date || '').localeCompare(a.candidate.date || '');
  });

  return scored.slice(0, 3).map((s) => {
    const truncatedBody =
      s.candidate.bodyText.length > 1500
        ? s.candidate.bodyText.slice(0, 1500) + '…'
        : s.candidate.bodyText;
    return {
      ...s.candidate,
      bodyText: truncatedBody,
      matchReason: s.matchReason,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Cross-thread discovery
// ────────────────────────────────────────────────────────────────────────────

interface ContactDetectionResult {
  email: string;
  source: string; // "step-1-name-match" | "step-3-outbound-recipient" | "step-4-frequent-participant"
}

const NAME_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has',
  'are', 'was', 'were', 'been', 'will', 'would', 'could', 'should',
  'not', 'but', 'also', 'just', 'about', 'into', 'over', 'more',
  'than', 'then', 'now', 'very', 'new', 'all', 'some', 'any',
  'each', 'every', 'both', 'few', 'most', 'other', 'reply', 'follow',
  'sent', 'send', 'check', 'update', 'email', 'task', 'get', 'set',
  'call', 'meeting', 'next', 'step', 'action', 'status', 'please',
  'thanks', 'thank', 'dear', 'hello', 'hey', 'note', 'notes',
]);

/** Extract display name from a raw From/To header like "Tom Healy" <tom@example.com> */
function displayNameFromHeader(h: string): string {
  if (!h) return '';
  const bracket = h.indexOf('<');
  if (bracket > 0) {
    return h.slice(0, bracket).trim().replace(/^"|"$/g, '');
  }
  return '';
}

/**
 * Extract likely person names from task text.
 * Looks for capitalized two-word sequences that aren't at sentence start
 * and aren't common stopwords.
 */
function extractProperNames(text: string): Map<string, number> {
  const names = new Map<string, number>();
  // Match capitalized word sequences (2+ words, e.g. "Tom Healy")
  // We look for sequences mid-sentence (preceded by space/punctuation, not start-of-line)
  const matches = Array.from(
    text.matchAll(/(?:^|[.!?]\s+|\n|—\s*|,\s+|\(\s*|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g),
  );
  for (const m of matches) {
    const name = m[1].trim();
    const parts = name.split(/\s+/);
    if (parts.some((p) => NAME_STOPWORDS.has(p.toLowerCase()))) continue;
    if (parts.length > 3) continue; // likely not a person name
    const key = name.toLowerCase();
    names.set(key, (names.get(key) || 0) + 1);
  }

  // Also try single capitalized words that appear frequently (first names)
  const singleMatches = Array.from(
    text.matchAll(/(?:^|[\s,;:(]|\n)([A-Z][a-z]{2,})\b/g),
  );
  for (const m of singleMatches) {
    const word = m[1].trim();
    if (NAME_STOPWORDS.has(word.toLowerCase())) continue;
    if (word.length < 3) continue;
    const key = word.toLowerCase();
    names.set(key, (names.get(key) || 0) + 1);
  }

  return names;
}

/**
 * Identify the primary outbound contact from the linked thread.
 *
 * Priority order:
 * 1. Name-match: extract proper-noun names from task text, match against
 *    thread participant display names (NOT task.from — it's often the introducer)
 * 2. (skipped — name match is step 1)
 * 3. Recipient on user's most-recent outbound message
 * 4. Most-frequent non-user participant in the thread
 */
export function identifyPrimaryOutboundContact(
  thread: LiveThreadState,
  task: TaskRecord,
  myEmail: string,
): ContactDetectionResult | null {
  const myEmailLower = myEmail.toLowerCase();

  // Build participant map: email → display name
  const participantNames = new Map<string, string>(); // email → display name
  const participantFreq = new Map<string, number>(); // email → appearance count
  for (const msg of thread.messages) {
    for (const field of [msg.from, msg.to, msg.cc]) {
      if (!field) continue;
      // Headers can contain multiple addresses separated by commas
      const parts = field.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      for (const part of parts) {
        const email = emailFromHeader(part);
        if (!email || email === myEmailLower) continue;
        participantFreq.set(email, (participantFreq.get(email) || 0) + 1);
        const name = displayNameFromHeader(part.trim());
        if (name && !participantNames.has(email)) {
          participantNames.set(email, name);
        }
      }
    }
  }

  // Step 1: Extract names from task text, match against participant display names
  const taskText = [task.task, task.nextAction, task.notes].filter(Boolean).join('\n');
  const taskNames = extractProperNames(taskText);

  if (taskNames.size > 0) {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [email, displayName] of Array.from(participantNames.entries())) {
      const displayLower = displayName.toLowerCase();
      const displayParts = displayLower.split(/\s+/);
      let score = 0;

      // Check full name match
      if (taskNames.has(displayLower)) {
        score += (taskNames.get(displayLower) || 0) * 10;
      }

      // Check each part of the display name against task names
      for (const part of displayParts) {
        if (part.length < 3) continue;
        for (const [taskName, freq] of Array.from(taskNames.entries())) {
          if (taskName.includes(part) || part.includes(taskName.split(/\s+/)[0])) {
            score += freq;
          }
        }
      }

      // Also check if first name or last name appears standalone in task text
      for (const part of displayParts) {
        if (part.length < 3) continue;
        const re = new RegExp(`\\b${part}\\b`, 'gi');
        const matches = taskText.match(re);
        if (matches) score += matches.length;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = email;
      }
    }

    if (bestMatch && bestScore >= 2) {
      return { email: bestMatch, source: 'step-1-name-match' };
    }
  }

  // Step 3: Recipient on user's most-recent outbound message
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const msg = thread.messages[i];
    if (!msg.fromUser) continue;
    const toEmails = (msg.to || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const e of toEmails) {
      const lower = e.toLowerCase();
      if (lower !== myEmailLower) {
        return { email: lower, source: 'step-3-outbound-recipient' };
      }
    }
  }

  // Step 4: Most-frequent non-user participant
  let bestFreq: string | null = null;
  let bestFreqCount = 0;
  for (const [email, count] of Array.from(participantFreq.entries())) {
    if (count > bestFreqCount) {
      bestFreqCount = count;
      bestFreq = email;
    }
  }
  if (bestFreq) {
    return { email: bestFreq, source: 'step-4-frequent-participant' };
  }

  return null;
}

/**
 * Search Gmail for other recent threads with the primary contact,
 * excluding the linked thread. Returns lightweight summaries.
 */
export async function fetchCrossThreadCandidates(
  gmail: gmail_v1.Gmail,
  contactEmail: string,
  linkedThreadId: string,
  myEmail: string,
): Promise<CrossThreadCandidate[]> {
  const myEmailLower = myEmail.toLowerCase();
  try {
    const res = await gmail.users.threads.list({
      userId: 'me',
      q: `(from:${contactEmail} OR to:${contactEmail}) newer_than:30d`,
      maxResults: 11,
    });
    const threads = (res.data.threads || [])
      .filter((t) => t.id && t.id !== linkedThreadId)
      .slice(0, 10);
    if (threads.length === 0) return [];

    const candidates: CrossThreadCandidate[] = [];
    const fetched = await Promise.all(
      threads.map((t) =>
        gmail.users.threads
          .get({ userId: 'me', id: t.id!, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] })
          .then((r) => r.data)
          .catch(() => null),
      ),
    );

    for (const td of fetched) {
      if (!td || !td.id) continue;
      const msgs = td.messages || [];
      if (msgs.length === 0) continue;

      const firstMsg = msgs[0];
      const lastMsg = msgs[msgs.length - 1];

      const subject = getHeader(firstMsg.payload?.headers, 'Subject') || '(no subject)';
      const lastFrom = getHeader(lastMsg.payload?.headers, 'From');
      const lastDate = getHeader(lastMsg.payload?.headers, 'Date');
      const lastFromEmail = emailFromHeader(lastFrom);

      candidates.push({
        threadId: td.id,
        threadUrl: `https://mail.google.com/mail/u/0/#inbox/${td.id}`,
        subject,
        lastMessageDate: lastDate,
        lastMessageFrom: lastFrom,
        messageCount: msgs.length,
        firstFewWordsOfLatestMessage: (lastMsg.snippet || '').slice(0, 120),
        userIsLatestSender: lastFromEmail === myEmailLower,
      });
    }

    // Sort by most-recent-message desc (use the thread's historyId as proxy; Gmail lists are already sorted)
    return candidates;
  } catch (err) {
    console.warn(
      '[next-step/live-state] cross-thread search failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Main entry point
// ────────────────────────────────────────────────────────────────────────────

export async function fetchLiveState(opts: {
  gmail: gmail_v1.Gmail;
  drive: drive_v3.Drive;
  task: TaskRecord;
  threadId: string | null;
  myEmail: string;
}): Promise<LiveState> {
  const { gmail, drive, task, threadId, myEmail } = opts;
  const myEmailLower = myEmail.toLowerCase();

  // Collect all participant emails for meeting-note filtering
  const taskContactEmails = new Set<string>();
  const taskFromEmail = emailFromHeader(task.from || '');
  if (taskFromEmail && taskFromEmail !== myEmailLower) {
    taskContactEmails.add(taskFromEmail);
  }

  // Parallel fetches
  const [liveThread, linkedDocs, driveMeetingNotes, gmailMeetingNotes] = await Promise.all([
    threadId ? fetchLiveThread(gmail, threadId, myEmail, task) : Promise.resolve(null),
    fetchLinkedDocs(drive, task),
    fetchMeetingNotesDrive(drive),
    fetchMeetingNotesGmail(gmail),
  ]);

  // Add thread participants to contact emails for meeting note filtering
  if (liveThread) {
    for (const msg of liveThread.messages) {
      const fromEmail = emailFromHeader(msg.from);
      if (fromEmail && fromEmail !== myEmailLower) {
        taskContactEmails.add(fromEmail);
      }
      // Also check To/CC for participant emails
      for (const field of [msg.to, msg.cc]) {
        const emails = field.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        for (const e of emails) {
          const lower = e.toLowerCase();
          if (lower !== myEmailLower) taskContactEmails.add(lower);
        }
      }
    }
  }

  const allMeetingCandidates = [...driveMeetingNotes, ...gmailMeetingNotes].slice(0, 25);
  const meetingNotes = filterMeetingNotes(allMeetingCandidates, taskContactEmails, task);

  // Cross-thread discovery: find other recent threads with the primary contact
  let crossThreadCandidates: CrossThreadCandidate[] = [];
  let primaryOutboundContact: string | null = null;
  let contactSource: string | null = null;
  if (liveThread && threadId) {
    const contactResult = identifyPrimaryOutboundContact(liveThread, task, myEmail);
    if (contactResult) {
      primaryOutboundContact = contactResult.email;
      contactSource = contactResult.source;
      crossThreadCandidates = await fetchCrossThreadCandidates(
        gmail,
        contactResult.email,
        threadId,
        myEmail,
      );
    }
  }

  return {
    thread: liveThread,
    linkedDocs,
    meetingNotes,
    crossThreadCandidates,
    primaryOutboundContact,
    contactSource,
    stats: {
      threadMsgs: liveThread?.totalMessages ?? 0,
      newSinceTask: liveThread?.newSinceTask ?? 0,
      linkedDocs: linkedDocs.length,
      meetingCandidates: allMeetingCandidates.length,
      meetingMatched: meetingNotes.length,
      ballInCourt: liveThread?.ballInCourt ?? 'n/a',
      contactCandidates: crossThreadCandidates.length,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Prompt formatters
// ────────────────────────────────────────────────────────────────────────────

export function formatLiveThreadForPrompt(thread: LiveThreadState): string {
  const lines: string[] = [];
  lines.push(
    `[${thread.totalMessages} messages total, ${thread.newSinceTask} new since task created]`,
  );
  lines.push(`[ballInCourt: ${thread.ballInCourt}]`);
  lines.push('');

  for (const msg of thread.messages) {
    const markers: string[] = [];
    if (msg.newSinceTask) markers.push('NEW SINCE TASK');
    if (msg.fromUser) markers.push('FROM USER');
    const markerStr = markers.length > 0 ? ` [${markers.join(', ')}]` : '';

    lines.push(`--- Message${markerStr} ---`);
    lines.push(`From: ${msg.from}`);
    lines.push(`To: ${msg.to}`);
    if (msg.cc) lines.push(`Cc: ${msg.cc}`);
    lines.push(`Date: ${msg.date}`);
    if (msg.attachments.length > 0) {
      lines.push(
        `Attachments: ${msg.attachments.map((a) => `${a.name} (${a.mimeType})`).join(', ')}`,
      );
    }
    lines.push('');
    lines.push(msg.bodyPlainText);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatLinkedDocsForPrompt(docs: LiveLinkedDoc[]): string {
  if (docs.length === 0) return '(none)';
  return docs
    .map((d) => {
      const staleTag = d.newerThanTask ? ' [MODIFIED SINCE TASK CREATED]' : '';
      return `Title: ${d.title}${staleTag}\nURL: ${d.url}\nModified: ${d.modifiedTime}\nExcerpt:\n${d.excerpt || '(could not export)'}`;
    })
    .join('\n\n');
}

export function formatCrossThreadsForPrompt(
  candidates: CrossThreadCandidate[],
  contactEmail: string,
): string {
  if (candidates.length === 0) return '(none found)';
  return candidates
    .map((c) => {
      const senderLabel = c.userIsLatestSender ? 'you' : c.lastMessageFrom;
      return `— [threadId=${c.threadId}] ${c.subject} (${c.lastMessageDate}, last from ${senderLabel}, ${c.messageCount} msgs)\n  "${c.firstFewWordsOfLatestMessage}"`;
    })
    .join('\n');
}

export function formatMeetingNotesForPrompt(notes: MeetingNoteMatch[]): string {
  if (notes.length === 0) return '(none found in the last 7 days matching this task)';
  return notes
    .map((n) => {
      return `Title: ${n.title}\nURL: ${n.url}\nDate: ${n.date}\nSource: ${n.source}\nMatch: ${n.matchReason}\nAttendees: ${n.attendees.join(', ') || '(unknown)'}\n\n${n.bodyText}`;
    })
    .join('\n\n---\n\n');
}
