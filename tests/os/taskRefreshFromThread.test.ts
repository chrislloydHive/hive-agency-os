import { describe, it, expect } from 'vitest';
import {
  extractCrossThreadSubjectHints,
  latestMessageId,
  shouldRunThreadRefreshForSync,
  threadHasInboundAfterWatermark,
  watermarkMsForRefresh,
} from '@/lib/os/taskRefreshFromThread';
import type { TaskRecord } from '@/lib/airtable/tasks';
import type { GmailMessageLike } from '@/lib/gmail/threadContext';

function baseTask(over: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'rec1',
    task: 'T',
    priority: 'P2',
    due: null,
    from: '',
    project: '',
    nextAction: '',
    status: 'Next',
    view: 'inbox',
    threadUrl: 'https://mail.google.com/mail/u/0/#inbox/abc123def456',
    calendarEventUrl: null,
    draftUrl: null,
    attachUrl: null,
    done: false,
    notes: '',
    assignedTo: '',
    createdAt: '2026-05-01T12:00:00.000Z',
    lastModified: null,
    source: null,
    sourceRef: null,
    autoCreated: false,
    dismissedAt: null,
    lastSeenAt: null,
    latestInboundAt: null,
    recurrence: null,
    suggestedResolution: null,
    lastSyncedAt: null,
    threadRefreshMessageId: null,
    ...over,
  };
}

function msg(id: string, internalDate: string): GmailMessageLike {
  return {
    id,
    internalDate,
    payload: { headers: [{ name: 'Subject', value: 'Hi' }] },
  };
}

describe('taskRefreshFromThread helpers', () => {
  it('extractCrossThreadSubjectHints finds quoted thread references', () => {
    const hints = extractCrossThreadSubjectHints(
      `Please see in the 'Re: Widget pricing Q2' thread for the spreadsheet.`,
    );
    expect(hints.some((h) => h.toLowerCase().includes('widget pricing'))).toBe(true);
  });

  it('shouldRunThreadRefreshForSync respects fingerprint and watermark', () => {
    const task = baseTask({
      createdAt: '2026-05-01T12:00:00.000Z',
      lastSyncedAt: null,
      threadRefreshMessageId: null,
    });
    const createdMs = new Date('2026-05-01T12:00:00.000Z').getTime();
    const messages = [
      msg('m1', String(createdMs - 3 * 86_400_000)),
      msg('m2', String(createdMs + 3_600_000)),
    ];
    expect(latestMessageId(messages)).toBe('m2');
    const wm = watermarkMsForRefresh(task);
    expect(threadHasInboundAfterWatermark(messages, wm)).toBe(true);
    expect(shouldRunThreadRefreshForSync(task, messages)).toBe(true);

    const task2 = baseTask({ threadRefreshMessageId: 'm2' });
    expect(shouldRunThreadRefreshForSync(task2, messages)).toBe(false);
  });
});
