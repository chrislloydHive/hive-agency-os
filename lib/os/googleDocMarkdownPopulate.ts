// Populate a Google Doc from markdown-ish body using Docs API batchUpdate.

import type { docs_v1 } from 'googleapis';

function stripInlineMd(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}

/**
 * Insert body with heading styles (# / ## / ###). Appends to the empty document body.
 */
export async function populateDocFromMarkdown(
  docs: docs_v1.Docs,
  documentId: string,
  markdownBody: string,
): Promise<void> {
  const doc = await docs.documents.get({ documentId });
  const endIdx = doc.data.body?.content?.at(-1)?.endIndex;
  if (endIdx == null || endIdx < 2) {
    throw new Error('Unexpected empty document structure');
  }
  // Insert before the trailing newline of the document (endIndex is exclusive).
  let insertAt = endIdx - 1;

  const lines = markdownBody.replace(/\r\n/g, '\n').split('\n');
  const requests: docs_v1.Schema$Request[] = [];

  type Segment = { start: number; end: number; namedStyleType: 'HEADING_1' | 'HEADING_2' | 'HEADING_3' };
  const headingRanges: Segment[] = [];

  for (const rawLine of lines) {
    const line = rawLine;
    let namedStyleType: Segment['namedStyleType'] | null = null;
    let text = stripInlineMd(line);

    if (/^###\s+/.test(text)) {
      namedStyleType = 'HEADING_3';
      text = text.replace(/^###\s+/, '');
    } else if (/^##\s+/.test(text)) {
      namedStyleType = 'HEADING_2';
      text = text.replace(/^##\s+/, '');
    } else if (/^#\s+/.test(text)) {
      namedStyleType = 'HEADING_1';
      text = text.replace(/^#\s+/, '');
    }

    const toInsert = `${text}\n`;
    const start = insertAt;
    requests.push({
      insertText: {
        location: { index: insertAt },
        text: toInsert,
      },
    });
    const end = start + toInsert.length;
    if (namedStyleType) {
      headingRanges.push({
        start,
        end,
        namedStyleType,
      });
    }
    insertAt = end;
  }

  for (const h of headingRanges) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: h.start, endIndex: h.end },
        paragraphStyle: { namedStyleType: h.namedStyleType },
        fields: 'namedStyleType',
      },
    });
  }

  if (requests.length === 0) return;

  try {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  } catch (e) {
    console.warn('[googleDocMarkdownPopulate] styled batchUpdate failed, plain fallback:', e);
    const doc2 = await docs.documents.get({ documentId });
    const end2 = doc2.data.body?.content?.at(-1)?.endIndex;
    if (end2 == null || end2 < 2) throw e;
    const plain = lines
      .map((line) => {
        let t = stripInlineMd(line);
        if (/^#{1,6}\s+/.test(t)) t = t.replace(/^#{1,6}\s+/, '');
        return t;
      })
      .join('\n');
    const text = plain.endsWith('\n') ? plain : `${plain}\n`;
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{ insertText: { location: { index: end2 - 1 }, text } }],
      },
    });
  }
}
