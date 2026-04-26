// POST /api/os/gmail/create-compose
// Creates a new Gmail draft (not a reply) from reviewed to/subject/body.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { z } from 'zod';
import { getTasks, updateTask } from '@/lib/airtable/tasks';
import { getGoogleAccountEmail } from '@/lib/google/oauth';
import { getIdentity } from '@/lib/personalContext';
import { getOsGoogleAccessToken } from '@/lib/gmail/osGoogleAccess';
import { buildStandaloneDraftRaw } from '@/lib/gmail/standaloneDraftRaw';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const bodySchema = z
  .object({
    to: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    taskId: z.string().min(1).optional(),
  })
  .strict();

function normalizeToField(to: string): string {
  const t = to.trim();
  const m = t.match(/<([^>]+@[^>\s]+)>/);
  if (m) return m[1].trim();
  return t;
}

function looksLikeEmail(addr: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
}

export async function POST(req: NextRequest) {
  try {
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedBody = bodySchema.safeParse(bodyJson);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid body: to, subject, and body are required' }, { status: 400 });
    }

    const toNorm = normalizeToField(parsedBody.data.to);
    if (!looksLikeEmail(toNorm)) {
      return NextResponse.json({ error: `Invalid "to" — expected a single email address, got: ${parsedBody.data.to}` }, { status: 400 });
    }

    const googleAccess = await getOsGoogleAccessToken();
    if (!googleAccess.ok) {
      return NextResponse.json({ error: googleAccess.error }, { status: googleAccess.status });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleAccess.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const [profileEmail, identity] = await Promise.all([
      getGoogleAccountEmail(googleAccess.accessToken),
      getIdentity(),
    ]);
    const fromEmail = profileEmail || identity.email;
    const fromName = identity.name;

    const raw = buildStandaloneDraftRaw({
      fromEmail,
      fromName: fromName || undefined,
      toEmail: toNorm,
      subject: parsedBody.data.subject,
      body: parsedBody.data.body,
    });

    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw },
      },
    });

    const draftId = draft.data.id;
    if (!draftId) {
      return NextResponse.json({ error: 'Gmail did not return a draft id' }, { status: 502 });
    }

    const draftUrl = `https://mail.google.com/mail/u/0/#drafts?compose=${encodeURIComponent(draftId)}`;

    if (parsedBody.data.taskId) {
      const all = await getTasks({});
      const exists = all.some((t) => t.id === parsedBody.data.taskId);
      if (!exists) {
        return NextResponse.json({ error: `taskId not found: ${parsedBody.data.taskId}` }, { status: 400 });
      }
      await updateTask(parsedBody.data.taskId, { draftUrl });
    }

    return NextResponse.json({ draftId, draftUrl });
  } catch (err) {
    console.error('[gmail/create-compose] error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to create draft';
    const lower = msg.toLowerCase();
    if (
      lower.includes('insufficient') ||
      lower.includes('scope') ||
      lower.includes('permission') ||
      lower.includes('forbidden')
    ) {
      return NextResponse.json(
        {
          error: 'Google permission missing (gmail.compose). Reconnect Google integration.',
          detail: msg,
        },
        { status: 403 },
      );
    }
    if (lower.includes('invalid_grant') || lower.includes('refresh')) {
      return NextResponse.json({ error: 'Google token expired. Reconnect Google integration.', detail: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
