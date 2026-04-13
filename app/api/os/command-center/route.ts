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
import { getTasks, type TaskRecord } from '@/lib/airtable/tasks';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

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

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[];  // email strings
  description?: string;
  htmlLink?: string;
}

async function fetchCalendarRange(accessToken: string, timeMin: string, timeMax: string): Promise<{ events: CalEvent[]; error?: string }> {
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
      attendees: (e.attendees || []).map(a => a.email || '').filter(Boolean),
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
  modifiedTime: string;
  webViewLink?: string;
  owners: string[];
}

async function fetchDriveRecent(accessToken: string): Promise<DriveDoc[]> {
  const drive = google.drive({ version: 'v3' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const res = await drive.files.list({
      auth,
      q: `modifiedTime > '${sevenDaysAgo.toISOString()}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id,name,modifiedTime,webViewLink,owners)',
      orderBy: 'modifiedTime desc',
      pageSize: 20,
    });
    return (res.data.files || []).map(f => ({
      id: f.id || '',
      name: f.name || '(Untitled)',
      modifiedTime: f.modifiedTime || '',
      webViewLink: f.webViewLink || undefined,
      owners: (f.owners || []).map(o => o.displayName || o.emailAddress || '').filter(Boolean),
    }));
  } catch (err) {
    console.error('[Command Center] Drive error:', err);
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

function tokenize(s: string | undefined | null): string[] {
  if (!s) return [];
  return s.toLowerCase()
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

  // Upcoming Meetings: events in next 7 days
  const upcomingMeetings = events
    .filter(e => {
      const dte = daysUntil(e.dueDate, now);
      return dte !== null && dte >= 0 && dte <= 7;
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
// Simple in-memory cache (per server instance, 60s TTL)
// ============================================================================

type CachePayload = { ts: number; data: unknown };
const CACHE = new Map<string, CachePayload>();
const CACHE_TTL_MS = 60_000;

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

    // ── Fetch tasks (always available) ──────────────────────────────────
    const tasks = await getTasks({ excludeDone: true });

    // ── Fetch Google data ───────────────────────────────────────────────
    let events: CalEvent[] = [];
    let docs: DriveDoc[] = [];
    let googleConnected = false;
    let googleError: string | null = null;

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

        const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

        const [calResult, driveResult] = await Promise.all([
          fetchCalendarRange(accessToken, weekStart.toISOString(), weekEnd.toISOString()),
          fetchDriveRecent(accessToken),
        ]);
        events = calResult.events;
        docs = driveResult;
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

    const response = {
      ...categories,
      counts: {
        topPriorities: categories.topPriorities.length,
        fires: categories.fires.length,
        thisWeek: categories.thisWeek.length,
        waitingOn: categories.waitingOn.length,
        upcomingMeetings: categories.upcomingMeetings.length,
        recentActivity: categories.recentActivity.length,
        stale: categories.stale.length,
      },
      googleConnected,
      googleError,
      sources: {
        tasks: tasks.length,
        events: events.length,
        docs: docs.length,
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
