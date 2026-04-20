// app/api/os/drive/publish/route.ts
// Publishes content to Google Drive via the Hive branded template system.
//
// POST /api/os/drive/publish
//   body: {
//     type: 'brief' | 'sow' | 'report' | 'strategy',
//     fileName: string,
//     content: string,                  // main body content (injected into {{CONTENT}})
//     project?: string,                 // project/client name
//     client?: string,                  // client name (defaults to project)
//     projectNumber?: string,           // project number
//     docName?: string,                 // document title (defaults to fileName)
//     inlineTable?: string,             // optional table content
//     destinationFolderId?: string,     // override default folder
//     templateId?: string,              // override template doc ID
//   }
//
// Returns:
//   { ok: true, docId: string, docUrl: string }
//
// The endpoint reads config from context/personal/drive.md and POSTs to
// the deployed Apps Script web app which clones a branded Google Docs
// template and injects the content.

import { NextRequest, NextResponse } from 'next/server';
import { getDrivePublishConfig } from '@/lib/personalContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface PublishBody {
  type: string;
  fileName: string;
  content: string;
  project?: string;
  client?: string;
  projectNumber?: string;
  docName?: string;
  inlineTable?: string;
  destinationFolderId?: string;
  templateId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublishBody;

    // Validate required fields
    if (!body.content?.trim()) {
      return NextResponse.json({ ok: false, error: 'content is required' }, { status: 400 });
    }
    if (!body.fileName?.trim()) {
      return NextResponse.json({ ok: false, error: 'fileName is required' }, { status: 400 });
    }

    // Load config
    const config = await getDrivePublishConfig();

    if (!config.appsScriptUrl || config.appsScriptUrl.includes('PASTE_YOUR')) {
      return NextResponse.json(
        { ok: false, error: 'Apps Script URL not configured. Update context/personal/drive.md.' },
        { status: 500 },
      );
    }

    // Resolve template
    const docType = (body.type || 'report').toLowerCase();
    if (!config.docTypes.includes(docType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid type "${docType}". Valid types: ${config.docTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const templateId = body.templateId || config.templates[docType];
    if (!templateId) {
      return NextResponse.json(
        { ok: false, error: `No template configured for type "${docType}"` },
        { status: 400 },
      );
    }

    const folderId = body.destinationFolderId || config.defaultFolderId;
    if (!folderId) {
      return NextResponse.json(
        { ok: false, error: 'No destination folder. Set default_folder_id in drive.md or pass destinationFolderId.' },
        { status: 400 },
      );
    }

    // Build payload for Apps Script
    const payload = {
      templateDocId: templateId,
      destinationFolderId: folderId,
      fileName: body.fileName.trim(),
      content: body.content,
      docName: body.docName || body.fileName.trim(),
      project: body.project || '',
      client: body.client || body.project || '',
      projectNumber: body.projectNumber || '',
      inlineTable: body.inlineTable || '',
      placeholders: {
        '{{PROJECT}}': body.project || '',
        '{{CLIENT}}': body.client || body.project || '',
        '{{PROJECT_NUMBER}}': body.projectNumber || '',
        '{{DOC_NAME}}': body.docName || body.fileName.trim(),
        '{{CONTENT}}': body.content,
        '{{INLINE_TABLE}}': body.inlineTable || '',
      },
    };

    // POST to Apps Script
    const response = await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Apps Script redirects on POST — follow redirects
      redirect: 'follow',
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[drive/publish] Apps Script error:', response.status, text);
      return NextResponse.json(
        { ok: false, error: `Apps Script returned ${response.status}`, detail: text },
        { status: 502 },
      );
    }

    const result = await response.json();

    if (!result.ok) {
      console.error('[drive/publish] Apps Script returned error:', result.error);
      return NextResponse.json(
        { ok: false, error: result.error || 'Apps Script returned an error' },
        { status: 502 },
      );
    }

    console.log(`[drive/publish] Created doc: ${result.docUrl} (type=${docType})`);

    return NextResponse.json({
      ok: true,
      docId: result.docId,
      docUrl: result.docUrl,
      type: docType,
      fileName: body.fileName.trim(),
    });
  } catch (err) {
    console.error('[drive/publish] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Publish failed' },
      { status: 500 },
    );
  }
}
