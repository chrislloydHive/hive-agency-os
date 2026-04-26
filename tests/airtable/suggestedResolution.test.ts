import { describe, it, expect } from 'vitest';
import {
  deserializeTaskFromAirtable,
  parseSuggestedResolutionFromAirtable,
  parseSuggestedResolutionPatchInput,
  serializeTaskFieldsForAirtable,
  suggestedResolutionJsonFieldName,
} from '@/lib/airtable/tasks';

describe('suggestedResolution', () => {
  it('parses valid JSON from Airtable long text', () => {
    const raw = JSON.stringify({
      action: 'close',
      reasoning: 'They confirmed shipment.',
      confidence: 'high',
      suggestedAt: '2026-04-26T12:00:00.000Z',
    });
    const parsed = parseSuggestedResolutionFromAirtable(raw);
    expect(parsed).toMatchObject({
      action: 'close',
      confidence: 'high',
      suggestedAt: '2026-04-26T12:00:00.000Z',
    });
  });

  it('returns null for empty, invalid JSON, or bad shape', () => {
    expect(parseSuggestedResolutionFromAirtable(null)).toBeNull();
    expect(parseSuggestedResolutionFromAirtable('')).toBeNull();
    expect(parseSuggestedResolutionFromAirtable('not json')).toBeNull();
    expect(parseSuggestedResolutionFromAirtable('{"action":"close"}')).toBeNull();
  });

  it('requires newNextAction when action is update_nextAction', () => {
    const bad = parseSuggestedResolutionFromAirtable(
      JSON.stringify({
        action: 'update_nextAction',
        reasoning: 'x',
        confidence: 'medium',
        suggestedAt: '2026-04-26T12:00:00.000Z',
      }),
    );
    expect(bad).toBeNull();

    const good = parseSuggestedResolutionFromAirtable(
      JSON.stringify({
        action: 'update_nextAction',
        newNextAction: 'Ping them again Friday.',
        reasoning: 'x',
        confidence: 'medium',
        suggestedAt: '2026-04-26T12:00:00.000Z',
      }),
    );
    expect(good?.newNextAction).toBe('Ping them again Friday.');
  });

  it('PATCH parser accepts null to clear', () => {
    expect(parseSuggestedResolutionPatchInput(null)).toEqual({ ok: true, value: null });
  });

  it('serialize writes JSON string under configured column name', () => {
    const obj = {
      action: 'close' as const,
      reasoning: 'r',
      confidence: 'high' as const,
      suggestedAt: '2026-04-26T12:00:00.000Z',
    };
    const fields = serializeTaskFieldsForAirtable({ suggestedResolution: obj });
    expect(fields[suggestedResolutionJsonFieldName]).toBe(JSON.stringify(obj));
    const cleared = serializeTaskFieldsForAirtable({ suggestedResolution: null });
    expect(cleared[suggestedResolutionJsonFieldName]).toBeNull();
  });

  it('deserializes from TaskRecord mapping', () => {
    const json = JSON.stringify({
      action: 'leave',
      reasoning: 'Still waiting.',
      confidence: 'low',
      suggestedAt: '2026-04-26T12:00:00.000Z',
    });
    const task = deserializeTaskFromAirtable({
      id: 'rec1',
      fields: {
        Task: 'T',
        Priority: null,
        Due: null,
        From: '',
        Project: '',
        'Next Action': '',
        Status: 'Inbox',
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
        Recurrence: null,
        [suggestedResolutionJsonFieldName]: json,
      },
    });
    expect(task.suggestedResolution).toMatchObject({
      action: 'leave',
      confidence: 'low',
    });
  });
});
