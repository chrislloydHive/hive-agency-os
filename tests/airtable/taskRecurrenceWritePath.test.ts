import { describe, it, expect } from 'vitest';
import {
  mergeTaskUpdateWithArchiveRules,
  parseRecurrenceFromRequestBody,
  sanitizeTaskUpdateFromJsonBody,
  serializeTaskFieldsForAirtable,
  deserializeTaskFromAirtable,
  type TaskRecord,
  type UpdateTaskInput,
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
    status: 'Next',
    view: 'inbox',
    threadUrl: null,
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
    ...over,
  };
}

describe('task recurrence write path', () => {
  it('parseRecurrenceFromRequestBody accepts own-key recurrence and Recurrence alias', () => {
    expect(parseRecurrenceFromRequestBody({ recurrence: 'weekly' })).toEqual({
      ok: true,
      present: true,
      value: 'weekly',
    });
    expect(parseRecurrenceFromRequestBody({ Recurrence: 'daily' })).toEqual({
      ok: true,
      present: true,
      value: 'daily',
    });
    expect(parseRecurrenceFromRequestBody(Object.create({ recurrence: 'weekly' }))).toEqual({
      ok: true,
      present: false,
    });
  });

  it('sanitizeTaskUpdateFromJsonBody allow-lists patch keys and drops recurrence raw', () => {
    const raw = {
      recurrence: 'weekly',
      task: 'New title',
      evil: 'drop me',
    } as Record<string, unknown>;
    const sanitized = sanitizeTaskUpdateFromJsonBody(raw);
    expect(sanitized).toEqual({ task: 'New title' });
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'recurrence')).toBe(false);
  });

  it('serialize → Airtable fields includes Recurrence after merge (active task)', () => {
    const current = baseTask({ recurrence: null });
    const input: UpdateTaskInput = { recurrence: 'weekly' };
    const merged = mergeTaskUpdateWithArchiveRules(current, input);
    const fields = serializeTaskFieldsForAirtable(merged);
    expect(fields).toMatchObject({ Recurrence: 'weekly' });
  });

  it('serialize preserves Recurrence when merge forces Done/archive fields', () => {
    const current = baseTask({ status: 'Inbox', done: false, view: 'inbox' });
    const input: UpdateTaskInput = { recurrence: 'biweekly', status: 'Done' };
    const merged = mergeTaskUpdateWithArchiveRules(current, input);
    const fields = serializeTaskFieldsForAirtable(merged);
    expect(fields).toMatchObject({
      Recurrence: 'biweekly',
      Status: 'Done',
      Done: true,
      View: 'archive',
    });
  });

  it('round-trip: Airtable-shaped fields → TaskRecord → serialize clears recurrence with null', () => {
    const record = {
      id: 'recX',
      fields: {
        Task: 'Hello',
        Priority: 'P1',
        Due: null,
        From: '',
        Project: '',
        'Next Action': '',
        Status: 'Next',
        View: 'inbox',
        'Thread URL': null,
        'Draft URL': null,
        'Attachment URL': null,
        Done: false,
        Notes: '',
        'Assigned To': '',
        'Created At': null,
        'Last Modified': null,
        Source: null,
        SourceRef: null,
        AutoCreated: false,
        DismissedAt: null,
        'Last Seen At': null,
        'Latest Inbound At': null,
        Recurrence: 'monthly',
      },
    };
    const task = deserializeTaskFromAirtable(record);
    expect(task.recurrence).toBe('monthly');

    const cleared = mergeTaskUpdateWithArchiveRules(task, { recurrence: null });
    const fields = serializeTaskFieldsForAirtable(cleared);
    expect(fields.Recurrence).toBeNull();
  });
});
