import { describe, it, expect } from 'vitest';
import {
  enrichTaskUpdateForSuggestionResolution,
  isActiveSuggestedResolution,
  serializeTaskFieldsForAirtable,
  stripDismissedSuggestionsFieldOnMissingColumn,
  suggestedResolutionJsonFieldName,
  suggestionFingerprint,
  type SuggestedResolution,
  type TaskRecord,
} from '@/lib/airtable/tasks';
import { parseTaskPatchFromHttpBody } from '@/lib/airtable/parseTaskPatchFromHttpBody';

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

const waitingSuggestion: SuggestedResolution = {
  action: 'set_waiting_on',
  confidence: 'high',
  proposal: {
    waitingOnType: 'person',
    waitingOnDescription: 'Adam — assets',
    waitingUntil: '2026-05-26',
  },
  reasoning: 'Stale thread',
  suggestedAt: '2026-05-01T12:00:00.000Z',
};

describe('task suggestion resolution PATCH', () => {
  it('parseTaskPatchFromHttpBody preserves explicit null on suggestedResolution', () => {
    const r = parseTaskPatchFromHttpBody({
      suggestedResolution: null,
      waitingOnType: 'person',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.suggestedResolution).toBeNull();
    expect(r.patch.waitingOnType).toBe('person');
  });

  it('isActiveSuggestedResolution hides resolved_by_user markers', () => {
    expect(
      isActiveSuggestedResolution({
        status: 'resolved_by_user',
        resolvedAt: '2026-05-01T12:00:00.000Z',
        prevAction: 'set_waiting_on',
      }),
    ).toBe(false);
    expect(isActiveSuggestedResolution(waitingSuggestion)).toBe(true);
  });

  it('enrich converts explicit null clear into resolved marker + dismissed fingerprint', () => {
    const current = baseTask({ dismissedSuggestions: [] });
    const enriched = enrichTaskUpdateForSuggestionResolution(
      current,
      { suggestedResolution: null, waitingOnType: 'person' },
      waitingSuggestion,
    );
    expect(enriched.suggestedResolution).toMatchObject({
      status: 'resolved_by_user',
      prevAction: 'set_waiting_on',
    });
    expect(enriched.dismissedSuggestions).toHaveLength(1);
    expect(enriched.dismissedSuggestions?.[0].action).toBe('set_waiting_on');
    expect(enriched.dismissedSuggestions?.[0].fingerprint).toBe(
      suggestionFingerprint(waitingSuggestion),
    );
    expect(enriched.dismissedSuggestions?.[0].inboundWatermark).toBeNull();
  });

  it('enrich infers clear when suggestedResolution key is omitted but resolution fields are sent', () => {
    const current = baseTask();
    const enriched = enrichTaskUpdateForSuggestionResolution(
      current,
      {
        waitingOnType: 'person',
        waitingOnDescription: 'Adam',
        waitingUntil: '2026-05-26',
      },
      waitingSuggestion,
    );
    expect(enriched.suggestedResolution).toMatchObject({ status: 'resolved_by_user' });
  });

  it('stripDismissedSuggestionsFieldOnMissingColumn removes field on unknown column error', () => {
    const fields = {
      Task: 'Example',
      'Dismissed Suggestions': '[]',
    };
    const stripped = stripDismissedSuggestionsFieldOnMissingColumn(
      fields,
      '{"error":{"type":"UNKNOWN_FIELD_NAME","message":"Unknown field name: \\"Dismissed Suggestions\\""}}',
    );
    expect(stripped).toEqual({ Task: 'Example' });
  });

  it('serialize writes resolved marker JSON to Airtable column', () => {
    const marker = {
      status: 'resolved_by_user' as const,
      resolvedAt: '2026-05-01T12:00:00.000Z',
      prevAction: 'close',
    };
    const fields = serializeTaskFieldsForAirtable({ suggestedResolution: marker });
    expect(fields[suggestedResolutionJsonFieldName]).toBe(JSON.stringify(marker));
  });
});
