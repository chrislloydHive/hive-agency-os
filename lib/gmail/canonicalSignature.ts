// lib/gmail/canonicalSignature.ts
// Deterministic signature for all outbound drafts created on Chris's behalf.
// Strip whatever the LLM invented, then append the canonical version.

export const CANONICAL_FROM_EMAIL = 'chrislloyd@hiveadagency.com';
export const CANONICAL_FROM_NAME = 'Chris Lloyd';

const PLAIN_SIGNATURE = [
  '',
  '-- ',
  'Chris Lloyd',
  '206.369.0683',
  'hive — www.hiveadagency.com',
].join('\n');

const HTML_SIGNATURE = [
  '<div>-- </div>',
  '<div><b>Chris Lloyd</b></div>',
  '<div>206.369.0683</div>',
  '<div><hr style="border: none; border-top: 1px solid #ccc; width: 112px; margin: 8px 0;"></div>',
  '<div><a href="http://www.hiveadagency.com" style="text-decoration: none; color: #1a1a1a; font-family: Georgia, \'Times New Roman\', serif; font-weight: 700; font-style: italic; font-size: 28px; letter-spacing: -0.5px;">hive</a></div>',
].join('\n');

const SIGN_OFF_RE =
  /^(Best|Thanks|Thank you|Cheers|Regards|Kind regards|Warm regards|Sincerely|All the best|Talk soon|Looking forward),?\s*$/im;

const DOUBLE_DASH_RE = /^--\s?$/m;

const CHRIS_LLOYD_RE = /^Chris\s*Lloyd\s*$/im;

const PHONE_RE = /^\d{3}[.\-)\s]\d{3}[.\-\s]\d{4}\s*$/m;

/**
 * Find the byte offset where an LLM-generated signature begins (or -1).
 * Scans from the bottom to find the LATEST occurrence so we don't accidentally
 * clip the substantive body.
 */
function findSignatureCutPoint(body: string): number {
  const lines = body.split('\n');
  const totalLines = lines.length;
  // Only scan the last 15 lines — signatures don't appear mid-body.
  const scanFrom = Math.max(0, totalLines - 15);

  for (let i = scanFrom; i < totalLines; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // `-- ` or `--` on its own line
    if (DOUBLE_DASH_RE.test(trimmed)) {
      return charOffset(lines, i);
    }

    // Sign-off word followed within 5 lines by a name or phone
    if (SIGN_OFF_RE.test(trimmed)) {
      const tail = lines.slice(i + 1, i + 6).join('\n');
      if (CHRIS_LLOYD_RE.test(tail) || PHONE_RE.test(tail) || /chris/i.test(tail)) {
        return charOffset(lines, i);
      }
    }

    // "Chris Lloyd" alone on a line near the bottom
    if (CHRIS_LLOYD_RE.test(trimmed) && i >= totalLines - 8) {
      // Check if this looks like a sig block (name followed by contact info)
      const tail = lines.slice(i + 1, i + 4).join('\n');
      if (PHONE_RE.test(tail) || /hive/i.test(tail) || /www\./i.test(tail) || tail.trim() === '') {
        return charOffset(lines, i);
      }
    }
  }

  return -1;
}

function charOffset(lines: string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1; // +1 for the \n
  }
  return offset;
}

/**
 * Strip any LLM-generated signature from the body, then append the canonical
 * plain-text signature. Returns the final body string.
 */
export function stripAndAppendSignature(body: string): string {
  const cut = findSignatureCutPoint(body);
  const clean = (cut >= 0 ? body.slice(0, cut) : body).trimEnd();
  return clean + '\n' + PLAIN_SIGNATURE;
}

/**
 * Convert a plain-text body to simple HTML (preserves line breaks).
 */
function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n\s*\n/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/**
 * Build a multipart/alternative raw RFC 2822 message with the canonical
 * HTML signature. The body should already have the plain-text signature
 * appended (via stripAndAppendSignature).
 */
export function buildCanonicalRaw(params: {
  fromEmail?: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  inReplyTo?: string;
  references?: string;
  body: string;
}): string {
  const fromEmail = params.fromEmail || CANONICAL_FROM_EMAIL;
  const fromName = params.fromName || CANONICAL_FROM_NAME;
  const { toEmail, toName, subject, inReplyTo, references, body } = params;
  const fromHdr = `${encodeRFC2047(fromName)} <${fromEmail}>`;
  const toHdr = toName ? `${encodeRFC2047(toName)} <${toEmail}>` : toEmail;
  const subjectHdr = encodeRFC2047(subject);

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const plainBody = body;

  // Split body at the plain sig delimiter to insert the HTML sig instead
  const sigIdx = body.lastIndexOf('\n-- \n');
  const bodyBeforeSig = sigIdx >= 0 ? body.slice(0, sigIdx) : body;
  const htmlBody = bodyToHtml(bodyBeforeSig) + '\n<br>\n' + HTML_SIGNATURE;

  const commonHeaders = [
    `From: ${fromHdr}`,
    `To: ${toHdr}`,
    `Subject: ${subjectHdr}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const raw = [
    ...commonHeaders,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    plainBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeRFC2047(str: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Prompt clause to inject into any LLM prompt that generates email bodies.
 * Tells the model to stop before the signature.
 */
export const NO_SIGNATURE_PROMPT_CLAUSE =
  'Do NOT include a signature, closing salutation ("Best,"/"Thanks,"/etc.), name, phone number, or company wordmark. The compose endpoint appends a canonical signature server-side. Your job is to write only the message body, ending with the last substantive sentence.';
