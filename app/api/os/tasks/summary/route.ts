// app/api/os/tasks/summary/route.ts
// Daily Summary API — tasks + calendar + email pulse
// Source of truth: Airtable Tasks table, Google Calendar, Gmail
//
// Query params:
//   ?companyId=xxx  — required to look up Google OAuth tokens

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getTasks } from '@/lib/airtable/tasks';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';

// ============================================================================
// Calendar helper
// ============================================================================

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;          // ISO or date string
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
  attendeeCount: number;
  responseStatus?: string;
  description?: string;
}

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: 'v3' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const res = await calendar.events.list({
    auth,
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  return (res.data.items || []).map((e) => ({
    id: e.id || '',
    summary: e.summary || '(No title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    allDay: !!e.start?.date,
    location: e.location || undefined,
    htmlLink: e.htmlLink || undefined,
    attendeeCount: (e.attendees || []).length,
    responseStatus: e.attendees?.find((a) => a.self)?.responseStatus || undefined,
    description: e.description ? e.description.slice(0, 200) : undefined,
  }));
}

// ============================================================================
// Email helper
// ============================================================================

interface EmailDigest {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labels: string[];
  isStarred: boolean;
  isImportant: boolean;
}

async function fetchEmailPulse(accessToken: string): Promise<{
  starred: EmailDigest[];
  needsReply: EmailDigest[];
  unreadCount: number;
}> {
  const gmail = google.gmail({ version: 'v1' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  // Starred recent emails
  const starredRes = await gmail.users.messages.list({
    auth,
    userId: 'me',
    q: 'is:starred newer_than:7d',
    maxResults: 10,
  });

  // Unread non-promo emails (likely need attention)
  const needsReplyRes = await gmail.users.messages.list({
    auth,
    userId: 'me',
    q: 'is:unread -category:promotions -category:social -category:updates newer_than:3d',
    maxResults: 10,
  });

  // Total unread count
  const profile = await gmail.users.getProfile({ auth, userId: 'me' });
  const unreadCount = profile.data.threadsUnread || 0;

  // Fetch message details in parallel
  async function getDigest(msgId: string): Promise<EmailDigest | null> {
    try {
      const msg = await gmail.users.messages.get({
        auth,
        userId: 'me',
        id: msgId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers = msg.data.payload?.headers || [];
      const hdr = (name: string) => headers.find((h) => h.name === name)?.value || '';
      const labels = msg.data.labelIds || [];

      return {
        id: msg.data.id || msgId,
        threadId: msg.data.threadId || '',
        subject: hdr('Subject'),
        from: hdr('From'),
        date: hdr('Date'),
        snippet: msg.data.snippet || '',
        labels,
        isStarred: labels.includes('STARRED'),
        isImportant: labels.includes('IMPORTANT'),
      };
    } catch {
      return null;
    }
  }

  const starredIds = (starredRes.data.messages || []).map((m) => m.id!).filter(Boolean);
  const needsReplyIds = (needsReplyRes.data.messages || []).map((m) => m.id!).filter(Boolean);

  const [starred, needsReply] = await Promise.all([
    Promise.all(starredIds.map(getDigest)),
    Promise.all(needsReplyIds.map(getDigest)),
  ]);

  return {
    starred: starred.filter(Boolean) as EmailDigest[],
    needsReply: needsReply.filter(Boolean) as EmailDigest[],
    unreadCount,
  };
}

// ============================================================================
// Main handler
// ============================================================================

/**
 * GET /api/os/tasks/summary?companyId=xxx
 * Returns { overdue, hot, dueToday, counts, calendar, emailPulse }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // ── Tasks from Airtable ─────────────────────────────────────────────
    const tasks = await getTasks({ excludeDone: true });
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const overdue: typeof tasks = [];
    const hot: typeof tasks = [];
    const dueToday: typeof tasks = [];

    for (const t of tasks) {
      const isP0 = t.priority === 'P0';
      let dueDate: Date | null = null;
      if (t.due) {
        const parsed = new Date(t.due);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        } else {
          const withYear = new Date(`${t.due}, ${now.getFullYear()}`);
          if (!isNaN(withYear.getTime())) dueDate = withYear;
        }
      }
      const dueDateStr = dueDate ? dueDate.toISOString().slice(0, 10) : null;
      const isPastDue = dueDate && dueDateStr && dueDateStr < todayStr;
      const isDueToday = dueDateStr === todayStr;

      if (isPastDue) overdue.push(t);
      if (isP0) hot.push(t);
      if (isDueToday) dueToday.push(t);
    }

    // ── Google Calendar + Gmail ──────────────────────────────────────────
    let calendar: { today: CalendarEvent[]; week: CalendarEvent[] } = { today: [], week: [] };
    let emailPulse: { starred: EmailDigest[]; needsReply: EmailDigest[]; unreadCount: number } = {
      starred: [],
      needsReply: [],
      unreadCount: 0,
    };
    let googleConnected = false;

    if (companyId) {
      try {
        const integrations = await getCompanyIntegrations(companyId);
        const refreshToken = integrations?.google?.refreshToken;

        if (refreshToken) {
          googleConnected = true;
          const accessToken = await refreshAccessToken(refreshToken);

          // Today: midnight to midnight
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);

          // This week: today through next 7 days
          const weekEnd = new Date(todayStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const [todayEvents, weekEvents, emailData] = await Promise.all([
            fetchCalendarEvents(accessToken, todayStart.toISOString(), todayEnd.toISOString()),
            fetchCalendarEvents(accessToken, todayStart.toISOString(), weekEnd.toISOString()),
            fetchEmailPulse(accessToken),
          ]);

          calendar = { today: todayEvents, week: weekEvents };
          emailPulse = emailData;
        }
      } catch (err) {
        console.error('[Summary API] Google data fetch error:', err);
        // Continue — tasks still work without Google data
      }
    }

    return NextResponse.json({
      overdue,
      hot,
      dueToday,
      counts: {
        overdue: overdue.length,
        hot: hot.length,
        dueToday: dueToday.length,
        totalOpen: tasks.length,
      },
      calendar,
      emailPulse,
      googleConnected,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Tasks Summary API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 },
    );
  }
}
