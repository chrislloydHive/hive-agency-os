import { describe, it, expect } from 'vitest';
import { scoreTriageItem } from '@/lib/os/commandCenterGoogle';
import type { TriageItem } from '@/lib/os/commandCenterGoogle';

/** Snapshot shape for Jim / Sound Distributions–style client forward (FW + trade-out + cold-like quoted body). */
function jimTradeOutForward(): Omit<TriageItem, 'score' | 'scoreReasons'> {
  return {
    id: 'msgfixture1',
    threadId: '19dd14a8b1cd9bbd',
    subject: 'FW: Social Indoor Advertising Specials For ITC Members!',
    snippet:
      'Chris, Yet another trade out offer for signage. ----- Forwarded message ----- quick question schedule a call get booked',
    from: 'Jim Warren <jim@sounddistributions.com>',
    fromName: 'Jim Warren',
    fromEmail: 'jim@sounddistributions.com',
    fromDomain: 'sounddistributions.com',
    date: new Date('2026-04-27T16:33:00-07:00').toISOString(),
    unread: true,
    starred: false,
    important: false,
    matchedReason: 'Unread primary',
    link: 'https://mail.google.com/mail/u/0/#inbox/19dd14a8b1cd9bbd',
    hasExistingTask: false,
    isKnownClientContact: true,
  };
}

describe('triage — known client contact', () => {
  it('applies a large positive boost and keeps score high even with cold-outreach-like quoted snippet', () => {
    const base = jimTradeOutForward();
    const { score, reasons } = scoreTriageItem(base, [], new Date('2026-04-27T20:00:00Z'), {
      isKnownClient: true,
    });
    expect(score).toBeGreaterThanOrEqual(50);
    expect(reasons).toContain('client contact');
  });

  it('without client boost, the same body signals would score much lower (cold outreach penalty)', () => {
    const base = { ...jimTradeOutForward(), isKnownClientContact: false };
    const { score: withClient } = scoreTriageItem(base, [], new Date('2026-04-27T20:00:00Z'), {
      isKnownClient: true,
    });
    const { score: withoutClient } = scoreTriageItem(base, [], new Date('2026-04-27T20:00:00Z'), {
      isKnownClient: false,
    });
    expect(withClient).toBeGreaterThan(withoutClient + 40);
  });
});

describe('triage — thread dedup', () => {
  it('buildTriageThreadDedupFromTasks only marks active or 24h-recent', async () => {
    const { buildTriageThreadDedupFromTasks } = await import('@/lib/airtable/taskThreadDedup');
    const { triageThreadIsDeduped } = await import('@/lib/airtable/taskThreadDedup');
    const now = Date.parse('2026-04-27T12:00:00Z');
    const tid = '19dd14a8b1cd9bbd';
    const open = {
      id: 'rec1',
      threadUrl: `https://mail.google.com/mail/u/0/#inbox/${tid}`,
      done: false,
      status: 'Inbox' as const,
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const dedup = buildTriageThreadDedupFromTasks([open] as any, now);
    expect(triageThreadIsDeduped(tid, dedup)).toBe(true);
  });
});
