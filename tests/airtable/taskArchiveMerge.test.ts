import { describe, it, expect } from 'vitest';
import { mergeTaskUpdateWithArchiveRules, type TaskRecord, type UpdateTaskInput } from '@/lib/airtable/tasks';

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
    ...over,
  };
}

describe('mergeTaskUpdateWithArchiveRules', () => {
  it('forces view archive when completing (status Done)', () => {
    const current = baseTask();
    const merged = mergeTaskUpdateWithArchiveRules(current, { status: 'Done' });
    expect(merged).toMatchObject({
      status: 'Done',
      done: true,
      view: 'archive',
    });
  });

  it('forces view archive when marking done without status (bare done checkbox)', () => {
    const current = baseTask({ status: 'Inbox' });
    const merged = mergeTaskUpdateWithArchiveRules(current, { done: true });
    expect(merged).toMatchObject({
      status: 'Done',
      done: true,
      view: 'archive',
    });
  });

  it('restores view when leaving Done for Next (explicit view)', () => {
    const current = baseTask({ status: 'Done', view: 'archive', done: true });
    const merged = mergeTaskUpdateWithArchiveRules(current, {
      status: 'Next',
      done: false,
      view: 'projects',
    } as UpdateTaskInput);
    expect(merged).toMatchObject({
      status: 'Next',
      done: false,
      view: 'projects',
    });
  });

  it('defaults view inbox when leaving Done without view in patch', () => {
    const current = baseTask({ status: 'Done', view: 'archive', done: true });
    const merged = mergeTaskUpdateWithArchiveRules(current, { status: 'Inbox' });
    expect(merged).toMatchObject({
      status: 'Inbox',
      done: false,
      view: 'inbox',
    });
  });

  it('sets view archive for Status=Archive (dismissed)', () => {
    const current = baseTask();
    const merged = mergeTaskUpdateWithArchiveRules(current, { status: 'Archive' });
    expect(merged).toMatchObject({
      status: 'Archive',
      view: 'archive',
    });
  });
});
