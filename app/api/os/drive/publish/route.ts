// app/api/os/drive/publish/route.ts
// Publishes Claude-created content to Google Drive via the Hive branded template system.
//
// Uses company OAuth (not ADC) so it works without gcloud CLI.
// Flow:
//   1. Look up template from Airtable by document type
//   2. Copy the template via Google Drive API (company OAuth)
//   3. Inject content into placeholders via Google Docs API (company OAuth)
//   4. Return the Google Drive link
//
// POST /api/os/drive/publish
//   body: {
//     companyId?: string,         // defaults to DMA_DEFAULT_COMPANY_ID
//     type?: 'brief' | 'sow' | 'report' | 'strategy',
//     templateId?: string,        // Airtable template record ID (overrides type lookup)
//     fileName: string,           // document title
//     content: string,            // main body (injected into "Content goes here…")
//     project?: string,           // project name (populates {{PROJECT}} and cover table)
//     client?: string,            // client name (defaults to project)
//     subject?: string,           // subject line (defaults to fileName)
//     date?: string,              // date string (defaults to today)
//   }
//
// Returns:
//   { ok: true, docId, docUrl, type, fileName }

import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, getTemplateById } from '@/lib/airtable/templates';
import { createGoogleDriveClient } from '@/lib/integrations/googleDrive';
import { buildReplaceWithFormattedContent } from '@/lib/utils/markdownToDocs';
import type { DocumentType } from '@/lib/types/template';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Friendly type → Airtable DocumentType mapping ──────────────────────────
const TYPE_MAP: Record<string, DocumentType> = {
  brief: 'BRIEF',
  sow: 'SOW',
  report: 'BRIEF',    // reports use the Brief template (general purpose)
  strategy: 'SOW',    // strategy docs use the SOW template (structured)
  timeline: 'TIMELINE',
  msa: 'MSA',
};

// ── Request body ────────────────────────────────────────────────────────────
interface PublishBody {
  companyId?: string;
  type?: string;
  templateId?: string;
  fileName: string;
  content: string;
  project?: string;
  client?: string;
  subject?: string;
  date?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublishBody;

    // ── Validate required fields ──────────────────────────────────────────
    if (!body.content?.trim()) {
      return NextResponse.json({ ok: false, error: 'content is required' }, { status: 400 });
    }
    if (!body.fileName?.trim()) {
      return NextResponse.json({ ok: false, error: 'fileName is required' }, { status: 400 });
    }

    const companyId = body.companyId || process.env.DMA_DEFAULT_COMPANY_ID || '';
    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'companyId is required (or set DMA_DEFAULT_COMPANY_ID env var)' },
        { status: 400 },
      );
    }

    // ── Resolve template ──────────────────────────────────────────────────
    let templateFileId: string | undefined;
    let resolvedType = body.type?.toLowerCase() || 'brief';

    if (body.templateId) {
      // Direct template ID lookup
      const template = await getTemplateById(body.templateId);
      if (!template) {
        return NextResponse.json(
          { ok: false, error: `Template ${body.templateId} not found in Airtable.` },
          { status: 404 },
        );
      }
      templateFileId = template.driveTemplateFileId;
    } else {
      // Look up by document type
      const documentType = TYPE_MAP[resolvedType];
      if (!documentType) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid type "${resolvedType}". Valid types: ${Object.keys(TYPE_MAP).join(', ')}`,
          },
          { status: 400 },
        );
      }

      const templates = await listTemplates({ documentType });
      const aiTemplate = templates.find((t) => t.allowAIDrafting);
      const template = aiTemplate || templates[0];

      if (!template) {
        return NextResponse.json(
          {
            ok: false,
            error: `No template found for document type "${documentType}".`,
            availableTypes: Object.keys(TYPE_MAP),
          },
          { status: 404 },
        );
      }

      templateFileId = template.driveTemplateFileId;
      console.log(
        `[drive/publish] Resolved type "${resolvedType}" → template "${template.name}" (fileId=${templateFileId})`,
      );
    }

    if (!templateFileId) {
      return NextResponse.json(
        { ok: false, error: 'Template has no Drive file ID configured.' },
        { status: 400 },
      );
    }

    // ── Get company OAuth Drive + Docs clients ────────────────────────────
    const driveClient = createGoogleDriveClient(companyId);
    const drive = await driveClient.getDrive();
    const docs = await driveClient.getDocs();

    // ── Copy the template ─────────────────────────────────────────────────
    const fileName = body.fileName.trim();
    let docId: string;
    let docUrl: string;

    try {
      const copyResponse = await drive.files.copy({
        fileId: templateFileId,
        requestBody: {
          name: fileName,
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      docId = copyResponse.data.id!;
      docUrl = copyResponse.data.webViewLink || `https://docs.google.com/document/d/${docId}/edit`;

      console.log(`[drive/publish] Cloned template → ${docId} ("${fileName}")`);
    } catch (copyError: any) {
      console.error('[drive/publish] Failed to copy template:', copyError?.message || copyError);
      const status = copyError?.code || 500;
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to copy template: ${copyError?.message || 'Unknown error'}`,
          howToFix: status === 401 || status === 403
            ? 'Reconnect Google OAuth with Drive scopes.'
            : 'Check that the template file ID is correct and accessible.',
        },
        { status: 502 },
      );
    }

    // ── Inject formatted content into the cloned doc ─────────────────────
    try {
      // The Hive Doc Template placeholders:
      //   {{Doc_Title}}, Project Name, Client, Date, Subject — filled by the Google Docs side panel
      //   "Content goes here…" / "Content goes here..." — body placeholder (filled by this endpoint)
      const placeholderTexts = ['Content goes here…', 'Content goes here...'];

      // Read the document to find the placeholder's exact position
      const docData = await docs.documents.get({ documentId: docId });

      // Build formatted requests (delete placeholder → insert styled content)
      const formattedRequests = buildReplaceWithFormattedContent(
        docData.data,
        placeholderTexts,
        body.content,
      );

      if (formattedRequests && formattedRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: formattedRequests },
        });
        console.log(`[drive/publish] Injected formatted content into cloned doc`);
      } else {
        // Fallback: placeholder not found, try plain replaceAllText
        console.warn('[drive/publish] Placeholder not found in doc, falling back to replaceAllText');
        const fallbackRequests = placeholderTexts.map(placeholder => ({
          replaceAllText: {
            containsText: { text: placeholder, matchCase: false },
            replaceText: body.content,
          },
        }));
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: fallbackRequests },
        });
        console.log(`[drive/publish] Injected content (plain text fallback) into cloned doc`);
      }
    } catch (injectError: any) {
      console.error('[drive/publish] Content injection failed:', injectError?.message || injectError);
      // Doc was cloned but content injection failed — still return the link
      return NextResponse.json({
        ok: true,
        docId,
        docUrl,
        type: resolvedType,
        fileName,
        warning: 'Document created but content injection failed — placeholders may still be present.',
      });
    }

    // ── Populate template header fields (Doc Title, Project, Client, Date, Subject) ──
    try {
      const today = body.date || new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      const project = body.project || '';
      const client = body.client || project;
      const subject = body.subject || fileName;
      const docTitle = fileName;

      // Token replacements: {{TOKEN}} → value  (matches Apps Script buildTokens_ pattern)
      const tokenReplacements: Record<string, string> = {
        '{{DOC_TITLE}}': docTitle,
        '{{Doc_Title}}': docTitle,
        '{{doc_title}}': docTitle,
        '{{PROJECT}}': project,
        '{{CLIENT}}': client,
        '{{SUBJECT}}': subject,
        '{{DATE}}': today,
        '{{DOC_TYPE}}': resolvedType,
      };

      // Table cell label replacements: "Label:\n" → "Label:\nValue"
      // The Hive Doc Template has a cover table with cells like "Project Name:\n"
      const labelReplacements: Record<string, string> = {
        'Project Name:\n': `Project Name:\n${project}`,
        'Client:\n': `Client:\n${client}`,
        'Date:\n': `Date:\n${today}`,
        'Subject:\n': `Subject:\n${subject}`,
      };

      const fieldRequests = [
        ...Object.entries(tokenReplacements).map(([placeholder, value]) => ({
          replaceAllText: {
            containsText: { text: placeholder, matchCase: true },
            replaceText: value,
          },
        })),
        ...Object.entries(labelReplacements).map(([placeholder, value]) => ({
          replaceAllText: {
            containsText: { text: placeholder, matchCase: false },
            replaceText: value,
          },
        })),
      ];

      if (fieldRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: fieldRequests },
        });
        console.log(`[drive/publish] Populated template fields (project=${project}, client=${client})`);
      }
    } catch (fieldError: any) {
      console.warn('[drive/publish] Template field population failed:', fieldError?.message);
      // Non-fatal — doc was still created with content
    }

    console.log(`[drive/publish] Published: ${docUrl} (type=${resolvedType})`);

    return NextResponse.json({
      ok: true,
      docId,
      docUrl,
      type: resolvedType,
      fileName,
    });
  } catch (err: any) {
    console.error('[drive/publish] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Publish failed' },
      { status: 500 },
    );
  }
}
