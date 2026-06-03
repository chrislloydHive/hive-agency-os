import { describe, it, expect } from 'vitest';
import {
  suggestionFingerprint,
  shouldSuppressSuggestedResolution,
  buildDismissedSuggestionEntry,
  appendDismissedSuggestionEntry,
} from '@/lib/airtable/suggestionSuppression';
import type { SuggestedResolution, TaskRecord } from '@/lib/airtable/tasks';

function baseTask(over: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'recTest',
    task: 'T',
    priority: 'P2',
    due: null,
    from: '',
    project: '',
    nextAction: '',
    status: 'Inbox',
    view: 'inbox',
    threadUrl: null,
    calendarEventUrl: null,
    draftUrl: null,
    attachUrl: null,
    done: false,
    notes: '',
    assignedTo: '',
    createdAt: null,
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
    blockedBy: [],
    waitingOnType: null,
    waitingOnDescription: '',
    waitingUntil: null,
    dismissedSuggestions: [],
    ...over,
  };
}

const updateFull: SuggestedResolution = {
  action: 'update_full',
  proposal: {
    task: '294CAR-OR Portland Search Campaign',
    nextAction: 'Reply to Shannon',
    status: 'Next',
    notes: 'SEM update',
  },
  fields: ['nextAction'],
  changeSummary: 'Update next action',
  reasoning: 'New thread context',
  confidence: 'high',
  suggestedAt: '2026-06-03T12:00:00.000Z',
};

describe('suggestionSuppression', () => {
  it('fingerprints differ for materially different update_full proposals', () => {
    const other: SuggestedResolution = {
      ...updateFull,
      proposal: { ...updateFull.proposal, nextAction: 'Different action' },
    };
    expect(suggestionFingerprint(updateFull)).not.toBe(suggestionFingerprint(other));
  });

  it('suppresses when fingerprint matches and no new inbound mail', () => {
    const fp = suggestionFingerprint(updateFull);
    const task = baseTask({
      latestInboundAt: '2026-05-27T10:00:00.000Z',
      dismissedSuggestions: [
        {
          action: 'update_full',
          dismissedAt: '2026-05-29T00:00:00.000Z',
          fingerprint: fp,
          inboundWatermark: '2026-05-27T10:00:00.000Z',
        },
      ],
    });
    expect(shouldSuppressSuggestedResolution(task, updateFull)).toBe(true);
  });

  it('allows re-surface when latestInboundAt is after dismissal watermark', () => {
    const fp = suggestionFingerprint(updateFull);
    const task = baseTask({
      latestInboundAt: '2026-06-02T21:40:00.000Z',
      dismissedSuggestions: [
        {
          action: 'update_full',
          dismissedAt: '2026-06-02T00:03:00.000Z',
          fingerprint: fp,
          inboundWatermark: '2026-06-02T00:00:00.000Z',
        },
      ],
    });
    expect(shouldSuppressSuggestedResolution(task, updateFull)).toBe(false);
  });

  it('buildDismissedSuggestionEntry stores fingerprint and inbound watermark', () => {
    const entry = buildDismissedSuggestionEntry(updateFull, '2026-05-27T10:00:00.000Z');
    expect(entry.fingerprint).toBe(suggestionFingerprint(updateFull));
    expect(entry.inboundWatermark).toBe('2026-05-27T10:00:00.000Z');
    expect(entry.action).toBe('update_full');
  });

  it('appendDismissedSuggestionEntry dedupes by fingerprint', () => {
    const first = appendDismissedSuggestionEntry([], updateFull, null);
    const second = appendDismissedSuggestionEntry(first, updateFull, null);
    expect(second).toHaveLength(1);
  });
});
