// Pull meeting transcript text from Google Docs/Drive links in task notes (best-effort).

import type { drive_v3 } from 'googleapis';

const MAX_TRANSCRIPT_CHARS = 14_000;

/** Google Doc or Drive file IDs that might hold a transcript. */
export function extractGoogleWorkspaceFileIdsFromNotes(notes: string | null | undefined): string[] {
  const raw = typeof notes === 'string' ? notes : '';
  const ids = new Set<string>();

  for (const m of raw.matchAll(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/gi)) {
    if (m[1]) ids.add(m[1]);
  }
  for (const m of raw.matchAll(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/gi)) {
    if (m[1]) ids.add(m[1]);
  }
  for (const m of raw.matchAll(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/gi)) {
    if (m[1]) ids.add(m[1]);
  }

  return [...ids];
}

async function exportGoogleDocPlainText(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<string | null> {
  try {
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType, name',
      supportsAllDrives: true,
    });
    const mime = meta.data.mimeType || '';
    if (mime !== 'application/vnd.google-apps.document') {
      return null;
    }
    const res = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'arraybuffer' },
    );
    const buf = res.data as ArrayBuffer;
    const text = Buffer.from(buf).toString('utf-8').trim();
    return text || null;
  } catch (e) {
    console.warn(`[taskNotesTranscript] export failed for ${fileId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function shouldAttemptTranscriptExport(notes: string, source: string | null | undefined): boolean {
  if (source === 'meeting-follow-up') return true;
  const n = notes.toLowerCase();
  if (/\btranscript\b/.test(n)) return true;
  return /\b(otter|fireflies|firefly|fathom|grain|read\.ai|gong|notebooklm|gemini)\b/i.test(notes);
}

/**
 * When notes link to Google Docs and the task looks meeting/transcript-related, export plain text for Claude.
 */
export async function buildMeetingTranscriptContextBlock(
  drive: drive_v3.Drive,
  notes: string | null | undefined,
  opts?: { source?: string | null },
): Promise<string> {
  const n = typeof notes === 'string' ? notes : '';
  const ids = extractGoogleWorkspaceFileIdsFromNotes(n);
  if (ids.length === 0) return '';
  if (!shouldAttemptTranscriptExport(n, opts?.source)) return '';

  const chunks: string[] = [];
  let used = 0;
  for (const id of ids) {
    if (used >= MAX_TRANSCRIPT_CHARS) break;
    const text = await exportGoogleDocPlainText(drive, id);
    if (!text) continue;
    const header = `--- Transcript (Google Doc export, file ${id}) ---\n`;
    const budget = MAX_TRANSCRIPT_CHARS - used - header.length;
    if (budget <= 0) break;
    const clipped = text.length > budget ? `${text.slice(0, budget)}…` : text;
    chunks.push(header + clipped);
    used += header.length + clipped.length;
  }

  return chunks.length ? `\n\n${chunks.join('\n\n')}\n` : '';
}
