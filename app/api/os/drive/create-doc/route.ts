// POST /api/os/drive/create-doc
// Creates a Google Doc from title + markdown-ish body; optional project folder + task attachUrl.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { z } from 'zod';
import { getTasks, updateTask } from '@/lib/airtable/tasks';
import { getOsGoogleAccessToken } from '@/lib/gmail/osGoogleAccess';
import { populateDocFromMarkdown } from '@/lib/os/googleDocMarkdownPopulate';
import { getDrivePublishConfig } from '@/lib/personalContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z
  .object({
    taskId: z.string().min(1).optional(),
    docTitle: z.string().min(1),
    docBody: z.string().min(1),
    projectFolderUrl: z.string().min(1).optional(),
  })
  .strict();

function parseGoogleDriveFolderIdFromUrl(url: string): string | null {
  const t = url.trim();
  const m = t.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

function docEditUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

export async function POST(req: NextRequest) {
  try {
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body: docTitle and docBody are required; taskId and projectFolderUrl optional' },
        { status: 400 },
      );
    }

    const googleAccess = await getOsGoogleAccessToken();
    if (!googleAccess.ok) {
      return NextResponse.json({ error: googleAccess.error }, { status: googleAccess.status });
    }

    if (parsed.data.taskId) {
      const all = await getTasks({});
      const exists = all.some((t) => t.id === parsed.data.taskId);
      if (!exists) {
        return NextResponse.json({ error: `taskId not found: ${parsed.data.taskId}` }, { status: 400 });
      }
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleAccess.accessToken });
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    let parents: string[] | undefined;
    if (parsed.data.projectFolderUrl) {
      const folderId = parseGoogleDriveFolderIdFromUrl(parsed.data.projectFolderUrl);
      if (folderId) {
        parents = [folderId];
      } else {
        console.warn(
          '[drive/create-doc] Could not parse folder id from projectFolderUrl; falling back to default folder or My Drive root.',
          parsed.data.projectFolderUrl.slice(0, 120),
        );
        const { defaultFolderId } = await getDrivePublishConfig();
        if (defaultFolderId?.trim()) {
          parents = [defaultFolderId.trim()];
        }
      }
    }

    const created = await drive.files.create({
      requestBody: {
        name: parsed.data.docTitle,
        mimeType: 'application/vnd.google-apps.document',
        ...(parents?.length ? { parents } : {}),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const docId = created.data.id;
    if (!docId) {
      return NextResponse.json({ error: 'Drive did not return a document id' }, { status: 502 });
    }

    await populateDocFromMarkdown(docs, docId, parsed.data.docBody);

    const docUrl = created.data.webViewLink?.trim() || docEditUrl(docId);

    if (parsed.data.taskId) {
      await updateTask(parsed.data.taskId, { attachUrl: docUrl });
    }

    return NextResponse.json({ docId, docUrl });
  } catch (err) {
    console.error('[drive/create-doc] error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to create document';
    const lower = msg.toLowerCase();
    if (
      lower.includes('insufficient') ||
      lower.includes('scope') ||
      lower.includes('permission') ||
      lower.includes('forbidden')
    ) {
      return NextResponse.json(
        { error: 'Google permission missing (drive/documents). Reconnect Google integration.', detail: msg },
        { status: 403 },
      );
    }
    if (lower.includes('invalid_grant') || lower.includes('refresh')) {
      return NextResponse.json({ error: 'Google token expired. Reconnect Google integration.', detail: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
