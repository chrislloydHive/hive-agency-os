import { describe, it, expect } from 'vitest';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';

describe('extractGmailThreadIdFromUrl', () => {
  const id = '19d6a58c78785bd5';

  it('parses #inbox/', () => {
    expect(extractGmailThreadIdFromUrl(`https://mail.google.com/mail/u/0/#inbox/${id}`)).toBe(id);
  });

  it('parses #all/ and #sent/', () => {
    expect(extractGmailThreadIdFromUrl(`https://mail.google.com/mail/u/0/#all/${id}`)).toBe(id);
    expect(extractGmailThreadIdFromUrl(`https://mail.google.com/mail/u/0/#sent/${id}`)).toBe(id);
  });

  it('parses compose= query param', () => {
    expect(
      extractGmailThreadIdFromUrl(`https://mail.google.com/mail/u/0/?compose=${id}&view=cm`),
    ).toBe(id);
  });

  it('parses th= param', () => {
    expect(extractGmailThreadIdFromUrl(`https://mail.google.com/mail/?th=${id}`)).toBe(id);
  });

  it('returns null for empty or non-Gmail', () => {
    expect(extractGmailThreadIdFromUrl(null)).toBeNull();
    expect(extractGmailThreadIdFromUrl('')).toBeNull();
    expect(extractGmailThreadIdFromUrl('https://example.com/')).toBeNull();
  });
});
