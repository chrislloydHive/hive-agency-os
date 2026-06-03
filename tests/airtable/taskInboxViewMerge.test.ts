import { describe, it, expect } from 'vitest';
import {
  mergeTaskUpdateWithArchiveRules,
  serializeTaskFieldsForAirtable,
  suggestedResolutionJsonFieldName,
  type TaskRecord,
} from '@/lib/airtable/tasks';

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

describe('inbox view merge rules', () => {
  it('done:true moves task to archive view', () => {
    const merged = mergeTaskUpdateWithArchiveRules(baseTask(), { done: true });
    expect(merged).toMatchObject({ done: true, view: 'archive', status: 'Done' });
  });

  it('dismissedAt sets archive view', () => {
    const merged = mergeTaskUpdateWithArchiveRules(baseTask(), {
      dismissedAt: '2026-06-02T12:00:00.000Z',
    });
    expect(merged.view).toBe('archive');
  });

  it('serialize preserves suggestedResolution null (clear)', () => {
    const fields = serializeTaskFieldsForAirtable({ suggestedResolution: null });
    expect(fields[suggestedResolutionJsonFieldName]).toBeNull();
  });
});
