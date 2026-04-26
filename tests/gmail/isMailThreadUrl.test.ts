import { describe, it, expect } from 'vitest';
import { isLikelyMailGoogleThreadUrl } from '@/lib/gmail/isMailThreadUrl';

describe('isLikelyMailGoogleThreadUrl', () => {
  const threadId = '19d6a58c78785bd5';

  it('accepts mail.google.com inbox thread URLs with id', () => {
    expect(isLikelyMailGoogleThreadUrl(`https://mail.google.com/mail/u/0/#inbox/${threadId}`)).toBe(
      true,
    );
  });

  it('rejects calendar.google.com', () => {
    expect(
      isLikelyMailGoogleThreadUrl(
        'https://calendar.google.com/calendar/event?eid=abc123',
      ),
    ).toBe(false);
  });

  it('rejects meet.google.com', () => {
    expect(isLikelyMailGoogleThreadUrl('https://meet.google.com/xyz')).toBe(false);
  });

  it('rejects non-mail hosts even if a hex segment exists', () => {
    expect(
      isLikelyMailGoogleThreadUrl(`https://example.com/#inbox/${threadId}`),
    ).toBe(false);
  });
});
