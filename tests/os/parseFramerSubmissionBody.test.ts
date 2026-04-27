import { describe, expect, test } from 'vitest';
import { parseSubmissionBody } from '@/lib/os/commandCenterGoogle';

/**
 * Fixture mirrors Gmail thread 19dcd50f2c3bc63f (Framer "General Contact",
 * Brock Hoskins): same field order, CRLF-wrapped Message body, and Framer
 * footer. Paste the raw plain body from that thread here if you need a
 * byte-for-byte golden file.
 */
const BROCK_HOSKINS_FRAMER_BODY =
  "You've just received a new submission for your General Contact form.\r\n" +
  '\r\n' +
  'Name: Brock Hoskins\r\n' +
  '\r\n' +
  'Email: brock@example.com\r\n' +
  '\r\n' +
  'Phone Number: +1 555-555-0100\r\n' +
  '\r\n' +
  'Select a Topic: General Contact\r\n' +
  '\r\n' +
  'Message: Hi there — I came across Hive while researching partners for a\r\n' +
  'brand refresh and ongoing growth marketing. We are a small team with big\r\n' +
  'ambitions and I would value a conversation about how you approach discovery,\r\n' +
  'positioning, and execution with clients who are earlier in their marketing\r\n' +
  'maturity. If it makes sense on your side, please let me know a couple of times\r\n' +
  "that could work for a short intro call next week. I'd love to connect.\r\n" +
  '\r\n' +
  'This email is a submission of a Framer form. If you want to stop receiving these notifications, go to Manage Domains > click on your domain > Forms.\r\n';

describe('parseSubmissionBody (Framer website submissions)', () => {
  test('captures multi-line Message up to sentinel and collapses wraps', () => {
    const parsed = parseSubmissionBody(BROCK_HOSKINS_FRAMER_BODY);
    expect(parsed.hasFields).toBe(true);
    expect(parsed.isSpam).toBe(false);

    const messageLine = parsed.fullBody.split('\n').find((l) => l.startsWith('Message:'));
    expect(messageLine).toBeDefined();
    const message = messageLine!.slice('Message:'.length).trim();
    expect(message.endsWith("I'd love to connect.")).toBe(true);
    expect(message).not.toMatch(/\r/);
    expect(message).not.toContain('This email is a submission of a Framer form');
  });

  test('legacy single-line Label: value still works when no Framer label anchors match', () => {
    const body = [
      'Company: Acme Corp',
      'Ask: One line only.',
      '',
      'This email is a submission of a Framer form.',
    ].join('\n');
    const parsed = parseSubmissionBody(body);
    expect(parsed.hasFields).toBe(true);
    expect(parsed.fullBody).toContain('Ask: One line only.');
  });
});
