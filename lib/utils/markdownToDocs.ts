// lib/utils/markdownToDocs.ts
// Converts markdown content into Google Docs API batchUpdate requests
// so that headings, bold, italic, bullets, and numbered lists render properly.

// ── Types ──────────────────────────────────────────────────────────────────

/** A segment of text within a line, with optional inline styles */
interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** A parsed block of markdown content */
interface ContentBlock {
  type: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'blank';
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  segments: TextSegment[];
  rawText: string; // plain text (no markdown syntax) for computing offsets
}

// ── Markdown Parser ────────────────────────────────────────────────────────

/**
 * Parse inline bold/italic markers into styled segments.
 * Handles **bold**, *italic*, and ***bold+italic***.
 */
function parseInlineStyles(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Regex matches ***bold+italic***, **bold**, or *italic*
  const regex = /(\*{1,3})((?:(?!\1).)+?)\1/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    const stars = match[1].length;
    const content = match[2];
    segments.push({
      text: content,
      bold: stars >= 2,
      italic: stars === 1 || stars === 3,
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  // If nothing was parsed, return the whole string as one segment
  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

/**
 * Parse a markdown string into an array of content blocks.
 */
function parseMarkdown(markdown: string): ContentBlock[] {
  const lines = markdown.split('\n');
  const blocks: ContentBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blank line
    if (line.trim() === '') {
      // Skip consecutive blanks, but preserve paragraph breaks
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'blank') {
        blocks.push({ type: 'blank', segments: [], rawText: '' });
      }
      continue;
    }

    // Bold-only line → treat as heading (e.g., "**Audience.**" or "**Brand architecture.**")
    // This catches section labels written as bold paragraphs instead of ## headings.
    const boldLineMatch = line.trim().match(/^\*{2,3}(.+?)\*{2,3}$/);
    if (boldLineMatch) {
      const content = boldLineMatch[1].trim();
      const segments = [{ text: content, bold: true }];
      const rawText = content;
      blocks.push({ type: 'heading', headingLevel: 2, segments, rawText });
      continue;
    }

    // Heading: # through ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const content = headingMatch[2].trim();
      const segments = parseInlineStyles(content);
      const rawText = segments.map((s) => s.text).join('');
      blocks.push({ type: 'heading', headingLevel: level, segments, rawText });
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^[-*_]{3,}\s*$/.test(line)) {
      // Insert a thin horizontal rule character
      blocks.push({
        type: 'paragraph',
        segments: [{ text: '─'.repeat(40) }],
        rawText: '─'.repeat(40),
      });
      continue;
    }

    // Bullet list item: - item or * item (but not **bold**)
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (bulletMatch && !(line.trim().startsWith('**') && !line.trim().startsWith('* '))) {
      const content = bulletMatch[2].trim();
      const segments = parseInlineStyles(content);
      const rawText = segments.map((s) => s.text).join('');
      blocks.push({ type: 'bullet', segments, rawText });
      continue;
    }

    // Numbered list item: 1. item
    const numberedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberedMatch) {
      const content = numberedMatch[2].trim();
      const segments = parseInlineStyles(content);
      const rawText = segments.map((s) => s.text).join('');
      blocks.push({ type: 'numbered', segments, rawText });
      continue;
    }

    // Regular paragraph
    const segments = parseInlineStyles(line.trim());
    const rawText = segments.map((s) => s.text).join('');
    blocks.push({ type: 'paragraph', segments, rawText });
  }

  // Remove trailing blank
  while (blocks.length > 0 && blocks[blocks.length - 1].type === 'blank') {
    blocks.pop();
  }

  return blocks;
}

// ── Google Docs Request Builder ────────────────────────────────────────────

/** Hive brand gold — used for heading text color (#d4a017) */
const HIVE_GOLD = { red: 212 / 255, green: 160 / 255, blue: 23 / 255 };

/** Google Docs API heading name for a given markdown heading level */
function headingStyle(level: number): string {
  if (level <= 0) return 'NORMAL_TEXT';
  if (level > 6) return 'HEADING_6';
  return `HEADING_${level}`;
}

/**
 * Build Google Docs API batchUpdate requests that insert formatted content
 * at the given start index (the position where the placeholder was).
 *
 * Strategy:
 *   1. Insert all plain text at once (concatenated with newlines)
 *   2. Apply paragraph styles (headings)
 *   3. Apply text styles (bold, italic)
 *   4. Create bullet/numbered lists
 *
 * Returns the requests array and the total number of characters inserted.
 */
export function buildFormattedInsertRequests(
  markdown: string,
  insertIndex: number,
): { requests: any[]; insertedLength: number } {
  const blocks = parseMarkdown(markdown);
  if (blocks.length === 0) {
    return {
      requests: [{ insertText: { location: { index: insertIndex }, text: markdown } }],
      insertedLength: markdown.length,
    };
  }

  // ── Step 1: Build the full plain text and track ranges ──────────────────
  const textParts: string[] = [];
  const blockRanges: Array<{
    block: ContentBlock;
    startOffset: number; // offset from insertIndex
    endOffset: number; // end of the line text (before newline)
    lineEndOffset: number; // end including the newline
  }> = [];

  let offset = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === 'blank') {
      textParts.push('\n');
      offset += 1;
      continue;
    }

    const lineText = block.rawText;
    const startOffset = offset;
    const endOffset = offset + lineText.length;

    textParts.push(lineText);
    offset += lineText.length;

    // Add newline after every block except the last
    if (i < blocks.length - 1) {
      textParts.push('\n');
      offset += 1;
    }

    blockRanges.push({
      block,
      startOffset,
      endOffset,
      lineEndOffset: offset,
    });
  }

  const fullText = textParts.join('');
  const totalLength = fullText.length;

  // ── Step 2: Build requests ──────────────────────────────────────────────
  const requests: any[] = [];

  // 2a. Insert the full text at the target index
  requests.push({
    insertText: {
      location: { index: insertIndex },
      text: fullText,
    },
  });

  // 2b. Apply paragraph styles (headings) and heading text color
  for (const { block, startOffset, endOffset, lineEndOffset } of blockRanges) {
    if (block.type === 'heading' && block.headingLevel) {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: insertIndex + startOffset,
            endIndex: insertIndex + lineEndOffset,
          },
          paragraphStyle: {
            namedStyleType: headingStyle(block.headingLevel),
          },
          fields: 'namedStyleType',
        },
      });
      // Override heading color with Hive brand gold
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: insertIndex + startOffset,
            endIndex: insertIndex + endOffset,
          },
          textStyle: {
            foregroundColor: { color: { rgbColor: HIVE_GOLD } },
          },
          fields: 'foregroundColor',
        },
      });
    }
  }

  // 2c. Apply inline text styles (bold, italic)
  for (const { block, startOffset } of blockRanges) {
    if (block.type === 'blank') continue;

    let segOffset = startOffset;
    for (const seg of block.segments) {
      if (seg.bold || seg.italic) {
        const styleFields: string[] = [];
        const textStyle: Record<string, boolean> = {};

        if (seg.bold) {
          textStyle.bold = true;
          styleFields.push('bold');
        }
        if (seg.italic) {
          textStyle.italic = true;
          styleFields.push('italic');
        }

        requests.push({
          updateTextStyle: {
            range: {
              startIndex: insertIndex + segOffset,
              endIndex: insertIndex + segOffset + seg.text.length,
            },
            textStyle,
            fields: styleFields.join(','),
          },
        });
      }
      segOffset += seg.text.length;
    }
  }

  // 2d. Create bullet lists
  for (const { block, startOffset, lineEndOffset } of blockRanges) {
    if (block.type === 'bullet') {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: insertIndex + startOffset,
            endIndex: insertIndex + lineEndOffset,
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    } else if (block.type === 'numbered') {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: insertIndex + startOffset,
            endIndex: insertIndex + lineEndOffset,
          },
          bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN',
        },
      });
    }
  }

  return { requests, insertedLength: totalLength };
}

/**
 * Build the full set of Google Docs API requests to:
 *   1. Find the placeholder text in the document
 *   2. Delete it
 *   3. Insert formatted markdown content in its place
 *
 * @param docContent - The result of docs.documents.get()
 * @param placeholderTexts - Possible placeholder strings to look for
 * @param markdown - The markdown content to inject
 * @returns Array of batchUpdate requests, or null if placeholder not found
 */
export function buildReplaceWithFormattedContent(
  docContent: any,
  placeholderTexts: string[],
  markdown: string,
): any[] | null {
  // Search through the document body to find the placeholder
  const body = docContent.body;
  if (!body?.content) return null;

  let placeholderStart: number | null = null;
  let placeholderEnd: number | null = null;

  for (const element of body.content) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        const textRun = el.textRun;
        if (!textRun?.content) continue;

        for (const placeholder of placeholderTexts) {
          const idx = textRun.content.indexOf(placeholder);
          if (idx !== -1) {
            placeholderStart = el.startIndex + idx;
            placeholderEnd = placeholderStart! + placeholder.length;
            break;
          }
        }
        if (placeholderStart !== null) break;
      }
    }
    if (placeholderStart !== null) break;
  }

  if (placeholderStart === null || placeholderEnd === null) {
    return null;
  }

  // Build requests:
  // 1. Delete the placeholder
  // 2. Insert formatted content at the same position
  const deleteRequest = {
    deleteContentRange: {
      range: {
        startIndex: placeholderStart,
        endIndex: placeholderEnd,
      },
    },
  };

  // After deletion, insert at placeholderStart
  const { requests: insertRequests } = buildFormattedInsertRequests(
    markdown,
    placeholderStart,
  );

  // Delete first, then insert (Google Docs processes requests in order)
  return [deleteRequest, ...insertRequests];
}
