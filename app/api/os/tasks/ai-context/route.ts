// app/api/os/tasks/ai-context/route.ts
// AI Context Briefing — pulls recent Drive docs, past meetings, emails,
// and current tasks, then generates a focused daily/weekly briefing via Anthropic.
//
// Query params:
//   ?companyId=xxx  — required for Google OAuth tokens

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getTasks } from '@/lib/airtable/tasks';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface RecentDoc {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  owners?: string[];
}

interface PastMeeting {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendeeCount: number;
  description?: string;
}

interface RecentEmail {
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

// ============================================================================
// Google Drive — recent docs
// ============================================================================

async function fetchRecentDocs(accessToken: string): Promise<RecentDoc[]> {
  const drive = google.drive({ version: 'v3' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const res = await drive.files.list({
      auth,
      q: `modifiedTime > '${sevenDaysAgo.toISOString()}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,owners)',
      orderBy: 'modifiedTime desc',
      pageSize: 15,
    });

    return (res.data.files || []).map((f) => ({
      id: f.id || '',
      name: f.name || '(Untitled)',
      mimeType: f.mimeType || '',
      modifiedTime: f.modifiedTime || '',
      webViewLink: f.webViewLink || undefined,
      owners: f.owners?.map((o) => o.displayName || o.emailAddress || '').filter(Boolean),
    }));
  } catch (err) {
    console.error('[AI Context] Drive fetch error:', err);
    return [];
  }
}

// ============================================================================
// Google Calendar — past meetings (last 3 days)
// ============================================================================

async function fetchPastMeetings(accessToken: string): Promise<PastMeeting[]> {
  const calendar = google.calendar({ version: 'v3' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  try {
    const res = await calendar.events.list({
      auth,
      calendarId: 'primary',
      timeMin: threeDaysAgo.toISOString(),
      timeMax: now.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });

    return (res.data.items || []).map((e) => ({
      id: e.id || '',
      summary: e.summary || '(No title)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      attendeeCount: (e.attendees || []).length,
      description: e.description ? e.description.slice(0, 200) : undefined,
    }));
  } catch (err) {
    console.error('[AI Context] Calendar fetch error:', err);
    return [];
  }
}

// ============================================================================
// Gmail — recent important emails (last 3 days)
// ============================================================================

async function fetchRecentEmails(accessToken: string): Promise<RecentEmail[]> {
  const gmail = google.gmail({ version: 'v1' });
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  try {
    const res = await gmail.users.messages.list({
      auth,
      userId: 'me',
      q: 'is:starred OR (is:unread -category:promotions -category:social -category:updates) newer_than:3d',
      maxResults: 10,
    });

    const msgIds = (res.data.messages || []).map((m) => m.id!).filter(Boolean);
    const emails: RecentEmail[] = [];

    for (const id of msgIds.slice(0, 10)) {
      try {
        const msg = await gmail.users.messages.get({
          auth,
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = msg.data.payload?.headers || [];
        const hdr = (name: string) => headers.find((h) => h.name === name)?.value || '';
        emails.push({
          subject: hdr('Subject'),
          from: hdr('From'),
          date: hdr('Date'),
          snippet: msg.data.snippet || '',
        });
      } catch {
        // skip individual message errors
      }
    }

    return emails;
  } catch (err) {
    console.error('[AI Context] Gmail fetch error:', err);
    return [];
  }
}

// ============================================================================
// Anthropic AI briefing
// ============================================================================

async function generateBriefing(context: {
  tasks: { task: string; priority: string | null; due: string | null; project: string; status: string }[];
  recentDocs: RecentDoc[];
  pastMeetings: PastMeeting[];
  recentEmails: RecentEmail[];
  todayStr: string;
}): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `You are a concise executive assistant generating a daily focus briefing for a busy agency owner.
Your goal: help them understand what they should focus on today and this week based on their recent activity.

Guidelines:
- Be direct and actionable — no fluff
- Use short paragraphs, not long bullet lists
- Highlight connections between meetings, docs, and tasks
- Call out anything that looks urgent or time-sensitive
- If you see patterns (e.g. a client showing up in meetings + emails + docs), flag it as a focus area
- Keep the whole briefing under 250 words
- Use a warm but professional tone`;

  const tasksSummary = context.tasks.slice(0, 15).map((t) =>
    `- [${t.priority || 'P2'}] ${t.task}${t.due ? ` (due: ${t.due})` : ''}${t.project ? ` — ${t.project}` : ''}`
  ).join('\n');

  const docsSummary = context.recentDocs.map((d) =>
    `- "${d.name}" (modified ${new Date(d.modifiedTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`
  ).join('\n');

  const meetingsSummary = context.pastMeetings.map((m) =>
    `- ${m.summary} (${new Date(m.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${m.attendeeCount} attendees)`
  ).join('\n');

  const emailsSummary = context.recentEmails.map((e) => {
    const sender = e.from.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || e.from.split('@')[0];
    return `- From ${sender}: "${e.subject}"`;
  }).join('\n');

  const userMessage = `Today is ${context.todayStr}.

Here's my current context:

## Open Tasks (${context.tasks.length} total)
${tasksSummary || '(none)'}

## Documents I've Worked On Recently
${docsSummary || '(none)'}

## Recent Meetings (Last 3 Days)
${meetingsSummary || '(none)'}

## Recent Important Emails
${emailsSummary || '(none)'}

Generate my daily focus briefing.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : 'Unable to generate briefing.';
  } catch (err) {
    console.error('[AI Context] Anthropic error:', err);
    return 'Unable to generate AI briefing at this time. Check that your Anthropic API key is configured.';
  }
}

// ============================================================================
// Main handler
// ============================================================================

/**
 * GET /api/os/tasks/ai-context?companyId=xxx
 * Returns { briefing, recentDocs, pastMeetings, recentEmails }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // ── Tasks from Airtable ─────────────────────────────────────────────
    const tasks = await getTasks({ excludeDone: true });
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // ── Google data ─────────────────────────────────────────────────────
    let recentDocs: RecentDoc[] = [];
    let pastMeetings: PastMeeting[] = [];
    let recentEmails: RecentEmail[] = [];
    let googleConnected = false;

    if (companyId) {
      try {
        const integrations = await getCompanyIntegrations(companyId);
        const refreshToken = integrations?.google?.refreshToken;

        if (refreshToken) {
          googleConnected = true;
          const accessToken = await refreshAccessToken(refreshToken);

          // Fetch all Google data in parallel
          [recentDocs, pastMeetings, recentEmails] = await Promise.all([
            fetchRecentDocs(accessToken),
            fetchPastMeetings(accessToken),
            fetchRecentEmails(accessToken),
          ]);
        }
      } catch (err) {
        console.error('[AI Context] Google data fetch error:', err);
      }
    }

    // ── Generate AI briefing ────────────────────────────────────────────
    const briefing = await generateBriefing({
      tasks: tasks.map((t) => ({
        task: t.task,
        priority: t.priority,
        due: t.due,
        project: t.project,
        status: t.status,
      })),
      recentDocs,
      pastMeetings,
      recentEmails,
      todayStr,
    });

    return NextResponse.json({
      briefing,
      recentDocs,
      pastMeetings,
      recentEmails,
      googleConnected,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[AI Context API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate AI context' },
      { status: 500 },
    );
  }
}
