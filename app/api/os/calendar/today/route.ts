// app/api/os/calendar/today
// GET — today's timed events on the primary Google Calendar (same OAuth path as
// POST /api/os/gmail/draft-reply).

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken, getGoogleAccountEmail } from '@/lib/google/oauth';
import { getTodayRangeUtcMs } from '@/lib/google/calendarDayBounds';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

function calendarTimeZone(): string {
  return (
    process.env.HIVE_OS_CALENDAR_TZ?.trim() ||
    process.env.OS_CALENDAR_TZ?.trim() ||
    'America/Los_Angeles'
  );
}

function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function GET() {
  try {
    // Same resolution order as POST /api/os/gmail/draft-reply when no companyId in body.
    let refreshToken: string | undefined;
    const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
    if (defaultCompanyId) {
      const integrations = await getCompanyIntegrations(defaultCompanyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No Google refresh token available' }, { status: 500 });
    }

    const accessToken = await refreshAccessToken(refreshToken);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth });

    const userEmail = await getGoogleAccountEmail(accessToken);
    const tz = calendarTimeZone();
    const { startMs, endMs } = getTodayRangeUtcMs(new Date(), tz);
    const timeMin = new Date(startMs).toISOString();
    const timeMax = new Date(endMs).toISOString();

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      timeZone: tz,
    });

    const items = res.data.items || [];

    const rows: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      location: string | null;
      url: string;
    }> = [];

    for (const ev of items) {
      if (!ev.id || !isTimedEvent(ev)) continue;
      if (userDeclinedEvent(ev, userEmail)) continue;
      const start = ev.start?.dateTime;
      const end = ev.end?.dateTime;
      if (!start || !end) continue;
      const startMsEv = Date.parse(start);
      if (Number.isNaN(startMsEv) || startMsEv < startMs || startMsEv >= endMs) continue;

      rows.push({
        id: ev.id,
        title: ev.summary || '(no title)',
        start,
        end,
        location: ev.location ?? null,
        url: ev.htmlLink || '',
      });
    }

    rows.sort((a, b) => a.start.localeCompare(b.start));
    const events = rows.slice(0, 20);

    return NextResponse.json({ events });
  } catch (err) {
    console.error('[calendar/today] error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to fetch calendar';
    const lower = msg.toLowerCase();
    if (
      lower.includes('insufficient') ||
      lower.includes('scope') ||
      lower.includes('permission') ||
      lower.includes('forbidden')
    ) {
      return NextResponse.json(
        {
          error:
            'Google Calendar permission missing (calendar.readonly). Reconnect Google integration to grant calendar access.',
          detail: msg,
        },
        { status: 403 },
      );
    }
    if (lower.includes('invalid_grant') || lower.includes('refresh')) {
      return NextResponse.json(
        { error: 'Google token expired. Reconnect Google integration.', detail: msg },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function isTimedEvent(ev: calendar_v3.Schema$Event): boolean {
  return Boolean(ev.start?.dateTime && ev.end?.dateTime);
}

/**
 * True if the attendee row for the authenticated user (self or matching email)
 * has responseStatus declined.
 */
function userDeclinedEvent(ev: calendar_v3.Schema$Event, userEmail: string | null): boolean {
  const attendees = ev.attendees;
  if (!attendees?.length) return false;
  const mine = attendees.find(
    (a) => a.self === true || (userEmail ? emailsMatch(a.email, userEmail) : false),
  );
  if (!mine) return false;
  return mine.responseStatus === 'declined';
}
