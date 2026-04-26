// RFC822 plain-text message → Gmail `raw` (base64url) for new (non-thread) drafts.

export function encodeRFC2047(str: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

export function buildStandaloneDraftRaw(params: {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  body: string;
}): string {
  const { fromEmail, fromName, toEmail, subject, body } = params;
  const fromHdr = fromName ? `${encodeRFC2047(fromName)} <${fromEmail}>` : fromEmail;
  const subjectHdr = encodeRFC2047(subject);
  const raw = [
    `From: ${fromHdr}`,
    `To: ${toEmail}`,
    `Subject: ${subjectHdr}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(raw, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
