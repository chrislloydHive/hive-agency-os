// Central HTTP PATCH body → UpdateTaskInput (allow-list + typed fields).

import {
  parseRecurrenceFromRequestBody,
  parseSuggestedResolutionPatchInput,
  sanitizeTaskUpdateFromJsonBody,
  type UpdateTaskInput,
} from '@/lib/airtable/tasks';

export type TaskPatchParseResult =
  | { ok: true; patch: UpdateTaskInput }
  | { ok: false; error: string };

/**
 * Build an {@link UpdateTaskInput} from a JSON PATCH body.
 * Preserves explicit `null` on clearable fields (e.g. `suggestedResolution: null`).
 * `recurrence` is merged when present on the body.
 */
export function parseTaskPatchFromHttpBody(body: Record<string, unknown>): TaskPatchParseResult {
  const bodyRec = parseRecurrenceFromRequestBody(body);
  if (!bodyRec.ok) {
    return { ok: false, error: bodyRec.error };
  }

  const patch = sanitizeTaskUpdateFromJsonBody(body);
  if (bodyRec.present) {
    patch.recurrence = bodyRec.value;
  } else {
    delete patch.recurrence;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'suggestedResolution')) {
    const sr = parseSuggestedResolutionPatchInput(body.suggestedResolution);
    if (!sr.ok) {
      return { ok: false, error: sr.error };
    }
    patch.suggestedResolution = sr.value;
  } else {
    delete patch.suggestedResolution;
  }

  return { ok: true, patch };
}
