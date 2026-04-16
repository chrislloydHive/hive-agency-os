/**
 * Activity Log — the event-stream substrate for the personal OS.
 * ---------------------------------------------------------------
 * Every state-changing action in the system (task created, status changed,
 * email replied, triage scan run, UI interactions, etc.) emits one row here.
 *
 * This is the memory layer. Higher phases (momentum, risk detection,
 * prioritization brain, decision engine) all read from this stream.
 *
 * Design rules:
 *   1. `logEvent` NEVER throws. It's best-effort; failures log to console
 *      but do not propagate. The app must never break because a log
 *      write fails.
 *   2. `logEvent` is fire-and-forget by default — callers can `await` it
 *      if they need guaranteed delivery (e.g., in route handlers that
 *      want the write confirmed before responding). In serverless
 *      environments, un-awaited writes may be dropped if the lambda
 *      freezes — acceptable for this workload.
 *   3. If the Airtable table isn't configured (env vars absent), `logEvent`
 *      no-ops silently. Same for when the Airtable API errors — we log to
 *      console and keep going. The app still works; we just lose history.
 *
 * See `docs/activity-log-setup.md` for the Airtable schema + env vars.
 */

import { fetchWithRetry } from './client';
import { resolveActivityLogBaseId } from './bases';

// ============================================================================
// Constants — table identifier
// ============================================================================

/**
 * Table name or table ID (tbl...) for the Activity Log table.
 * Table IDs are base-specific. Set AIRTABLE_ACTIVITY_LOG_TABLE_ID to the tbl id
 * or AIRTABLE_ACTIVITY_LOG_TABLE to a name. Default: "Activity Log".
 */
function getActivityLogTableIdentifier(): string {
  return (
    process.env.AIRTABLE_ACTIVITY_LOG_TABLE_ID?.trim() ||
    process.env.AIRTABLE_ACTIVITY_LOG_TABLE?.trim() ||
    'Activity Log'
  );
}

/**
 * Field names for the Activity Log table. Keep in sync with the Airtable schema.
 * See `docs/activity-log-setup.md`.
 */
const FIELDS = {
  TIMESTAMP: 'Timestamp',
  ACTOR_TYPE: 'Actor Type',
  ACTOR: 'Actor',
  ACTION: 'Action',
  ENTITY_TYPE: 'Entity Type',
  ENTITY_ID: 'Entity ID',
  ENTITY_TITLE: 'Entity Title',
  SUMMARY: 'Summary',
  METADATA: 'Metadata',
  SOURCE: 'Source',
} as const;

// ============================================================================
// Types
// ============================================================================

/** Who or what triggered the event. */
export type ActivityActorType = 'user' | 'system' | 'ai';

/** What kind of thing the event is about. */
export type ActivityEntityType = 'task' | 'email' | 'meeting' | 'doc' | 'triage-run' | 'other';

/**
 * Normalized action verbs. Using a string-literal union rather than a single
 * select in Airtable so we can add new actions without touching the schema.
 * Keep entries dot-namespaced (`domain.verb`) for easy filtering later.
 */
export type ActivityAction =
  | 'task.created'
  | 'task.updated'
  | 'task.status-changed'
  | 'task.completed'
  | 'task.deleted'
  | 'task.opened-in-ui'
  | 'task.dismissed-from-triage'
  | 'task.from-email'
  | 'email.draft-created'
  | 'email.replied'
  | 'triage.scan-run'
  | 'triage.item-skipped'
  | 'other';

export interface ActivityEvent {
  /** Optional timestamp override. Defaults to now. ISO 8601. */
  timestamp?: string;
  actorType: ActivityActorType;
  /** Human-readable label: 'Chris', 'auto-triage', 'ai-parser', 'api'. */
  actor: string;
  action: ActivityAction | string;
  entityType: ActivityEntityType;
  /** Airtable record id, Gmail thread id, calendar event id, etc. */
  entityId?: string;
  /** Denormalized title so the row is readable without a join. */
  entityTitle?: string;
  /** One-line human description of what happened. Required. */
  summary: string;
  /** Any extra structured context. Serialized to JSON in the Metadata field. */
  metadata?: Record<string, unknown>;
  /** Where in the codebase this event was emitted. Free-form. */
  source?: string;
}

// ============================================================================
// Core: logEvent
// ============================================================================

/**
 * Record an event in the Activity Log.
 *
 * Never throws. Fire-and-forget friendly — callers can choose whether to
 * `await` based on whether they need delivery confirmation.
 *
 * @example
 *   void logEvent({
 *     actorType: 'system',
 *     actor: 'api',
 *     action: 'task.created',
 *     entityType: 'task',
 *     entityId: 'recABC',
 *     entityTitle: 'Reply to Jim re: geofence data',
 *     summary: 'Task created: Reply to Jim re: geofence data (P1, due 2026-04-18)',
 *     source: 'lib/airtable/tasks#createTask',
 *   });
 */
export async function logEvent(event: ActivityEvent): Promise<void> {
  try {
    const baseId = resolveActivityLogBaseId();
    if (!baseId) {
      // No base configured → silent no-op. Still log to console so dev can see
      // what would have been recorded.
      console.log('[ActivityLog:no-base]', compactLogLine(event));
      return;
    }

    const tableId = getActivityLogTableIdentifier();
    const fields: Record<string, unknown> = {
      [FIELDS.TIMESTAMP]: event.timestamp || new Date().toISOString(),
      [FIELDS.ACTOR_TYPE]: event.actorType,
      [FIELDS.ACTOR]: event.actor,
      [FIELDS.ACTION]: event.action,
      [FIELDS.ENTITY_TYPE]: event.entityType,
      [FIELDS.SUMMARY]: event.summary.slice(0, 1000), // protect against runaway summaries
    };
    if (event.entityId) fields[FIELDS.ENTITY_ID] = event.entityId;
    if (event.entityTitle) fields[FIELDS.ENTITY_TITLE] = event.entityTitle.slice(0, 500);
    if (event.source) fields[FIELDS.SOURCE] = event.source;
    if (event.metadata && Object.keys(event.metadata).length > 0) {
      try {
        fields[FIELDS.METADATA] = JSON.stringify(event.metadata).slice(0, 5000);
      } catch {
        // metadata wasn't JSON-serializable — skip it rather than failing the write
      }
    }

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      // Read the body so we get a useful error, but don't throw — the caller
      // doesn't care whether the log write succeeded.
      const errorText = await response.text().catch(() => '<no body>');
      console.warn(
        `[ActivityLog] write failed (${response.status}): ${errorText.slice(0, 300)} for ${compactLogLine(event)}`,
      );
    }
  } catch (err) {
    // Final safety net — any other failure (network, JSON, etc.) is swallowed.
    console.warn('[ActivityLog] unexpected failure:', err, compactLogLine(event));
  }
}

/**
 * Fire-and-forget variant. Use this in hot paths (task mutations, triage
 * runs) where waiting on the log write would add user-visible latency.
 * Returns immediately; the write happens in the background.
 *
 * Note: on Vercel serverless, background promises may be dropped if the
 * lambda freezes before resolution. Acceptable for activity logs.
 */
export function logEventAsync(event: ActivityEvent): void {
  void logEvent(event);
}

// ============================================================================
// Summary helpers — compute the one-line description from common shapes
// ============================================================================

/**
 * Given a TaskRecord-shaped object (before the mutation) and an UpdateTaskInput
 * (the patch), return a human-readable summary of what changed. Used by
 * `lib/airtable/tasks.updateTask` to produce descriptive event summaries.
 *
 * Keeps the shape loose so this module doesn't need to import TaskRecord
 * (which would create a circular import with tasks.ts).
 */
export function summarizeTaskUpdate(
  taskTitle: string,
  input: Record<string, unknown>,
): { summary: string; changedFields: string[]; statusTransition?: { to: string } } {
  const changedFields = Object.keys(input).filter(k => input[k] !== undefined);
  const parts: string[] = [];

  if ('status' in input && typeof input.status === 'string') {
    parts.push(`status → ${input.status}`);
  }
  if ('priority' in input && typeof input.priority === 'string') {
    parts.push(`priority → ${input.priority}`);
  }
  if ('due' in input) {
    parts.push(input.due ? `due → ${input.due}` : 'due cleared');
  }
  if ('project' in input && typeof input.project === 'string') {
    parts.push(`project → ${input.project}`);
  }
  if (parts.length === 0 && changedFields.length > 0) {
    parts.push(`fields: ${changedFields.join(', ')}`);
  }

  const summary = `Task updated: "${taskTitle}" — ${parts.join(', ') || 'no-op'}`;
  const statusTransition =
    'status' in input && typeof input.status === 'string' ? { to: input.status } : undefined;

  return { summary, changedFields, statusTransition };
}

// ============================================================================
// Reads — signals for the prioritization brain
// ============================================================================

/** One Activity Log row, as mapped from Airtable. */
export interface ActivityRow {
  id: string;
  timestamp: string;
  actorType: ActivityActorType | string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  summary: string;
  source?: string;
  /** Parsed metadata; undefined if the field was empty or non-JSON. */
  metadata?: Record<string, unknown>;
}

function mapActivityRow(record: { id: string; fields?: Record<string, unknown> }): ActivityRow {
  const f = record.fields || {};
  let metadata: Record<string, unknown> | undefined;
  const rawMeta = f[FIELDS.METADATA];
  if (typeof rawMeta === 'string' && rawMeta.trim()) {
    try {
      const parsed = JSON.parse(rawMeta);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      // leave undefined
    }
  }
  return {
    id: record.id,
    timestamp: (f[FIELDS.TIMESTAMP] as string) || '',
    actorType: (f[FIELDS.ACTOR_TYPE] as string) || 'system',
    actor: (f[FIELDS.ACTOR] as string) || '',
    action: (f[FIELDS.ACTION] as string) || '',
    entityType: (f[FIELDS.ENTITY_TYPE] as string) || '',
    entityId: (f[FIELDS.ENTITY_ID] as string) || undefined,
    entityTitle: (f[FIELDS.ENTITY_TITLE] as string) || undefined,
    summary: (f[FIELDS.SUMMARY] as string) || '',
    source: (f[FIELDS.SOURCE] as string) || undefined,
    metadata,
  };
}

/**
 * Escape a value for use inside an Airtable formula single-quoted string.
 * Airtable has no parameterized queries; escape backslashes and single quotes
 * so IDs / titles can't break out of the literal.
 */
function escapeForFormula(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Fetch Activity Log rows newer than `sinceIso`, filtered to `task` events
 * for the given task ids.
 *
 * Never throws: on any failure returns an empty list. The prioritization
 * brain must still produce a ranking if the event stream is unavailable —
 * engagement signals are a bonus, not a requirement.
 */
export async function getRecentTaskActivity(params: {
  sinceIso: string;
  /** Only return events for these task ids. Empty → returns nothing. */
  taskIds: string[];
  /** Hard cap on rows. Default 500 (engagement window is narrow). */
  maxRows?: number;
}): Promise<ActivityRow[]> {
  const { sinceIso, taskIds } = params;
  const maxRows = params.maxRows ?? 500;
  if (!taskIds.length) return [];

  try {
    const baseId = resolveActivityLogBaseId();
    if (!baseId) return [];
    const tableId = getActivityLogTableIdentifier();

    // Chunk ids: Airtable formula length is bounded (~16KB). 100 per request
    // is comfortable.
    const chunks: string[][] = [];
    for (let i = 0; i < taskIds.length; i += 100) chunks.push(taskIds.slice(i, i + 100));

    const out: ActivityRow[] = [];
    for (const chunk of chunks) {
      const idClauses = chunk
        .map(id => `{${FIELDS.ENTITY_ID}}='${escapeForFormula(id)}'`)
        .join(',');
      const formula = `AND({${FIELDS.ENTITY_TYPE}}='task', IS_AFTER({${FIELDS.TIMESTAMP}},'${escapeForFormula(sinceIso)}'), OR(${idClauses}))`;

      let offset: string | undefined;
      do {
        const qs = new URLSearchParams();
        qs.set('filterByFormula', formula);
        qs.set('pageSize', '100');
        if (offset) qs.set('offset', offset);

        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${qs.toString()}`;
        const res = await fetchWithRetry(url, { method: 'GET' });
        if (!res.ok) {
          console.warn(
            `[ActivityLog.getRecentTaskActivity] ${res.status} on chunk of ${chunk.length} ids; returning partial results`,
          );
          break;
        }
        const data = await res.json();
        for (const record of data.records || []) {
          out.push(mapActivityRow(record));
          if (out.length >= maxRows) return out;
        }
        offset = data.offset;
      } while (offset);
    }

    return out;
  } catch (err) {
    console.warn('[ActivityLog.getRecentTaskActivity] unexpected failure:', err);
    return [];
  }
}

/**
 * Fetch Activity Log rows newer than `sinceIso`, filtered to the given entity
 * types. Use this for sweeps that aren't scoped to a fixed id list — e.g.
 * risk detection scanning all `email` events for orphaned drafts.
 *
 * Never throws: returns [] on any failure.
 */
export async function getRecentActivityByTypes(params: {
  sinceIso: string;
  entityTypes: string[];
  /** Optional additional filter: only rows whose Action starts with any of these prefixes. */
  actionPrefixes?: string[];
  /** Hard cap on rows. Default 1000. */
  maxRows?: number;
}): Promise<ActivityRow[]> {
  const { sinceIso, entityTypes } = params;
  const maxRows = params.maxRows ?? 1000;
  if (!entityTypes.length) return [];

  try {
    const baseId = resolveActivityLogBaseId();
    if (!baseId) return [];
    const tableId = getActivityLogTableIdentifier();

    const typeClauses = entityTypes
      .map(t => `{${FIELDS.ENTITY_TYPE}}='${escapeForFormula(t)}'`)
      .join(',');
    const parts: string[] = [
      `IS_AFTER({${FIELDS.TIMESTAMP}},'${escapeForFormula(sinceIso)}')`,
      `OR(${typeClauses})`,
    ];
    if (params.actionPrefixes && params.actionPrefixes.length) {
      const prefixClauses = params.actionPrefixes
        .map(p => `LEFT({${FIELDS.ACTION}},${p.length})='${escapeForFormula(p)}'`)
        .join(',');
      parts.push(`OR(${prefixClauses})`);
    }
    const formula = `AND(${parts.join(',')})`;

    const out: ActivityRow[] = [];
    let offset: string | undefined;
    do {
      const qs = new URLSearchParams();
      qs.set('filterByFormula', formula);
      qs.set('pageSize', '100');
      if (offset) qs.set('offset', offset);

      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?${qs.toString()}`;
      const res = await fetchWithRetry(url, { method: 'GET' });
      if (!res.ok) {
        console.warn(
          `[ActivityLog.getRecentActivityByTypes] ${res.status}; returning partial results`,
        );
        break;
      }
      const data = await res.json();
      for (const record of data.records || []) {
        out.push(mapActivityRow(record));
        if (out.length >= maxRows) return out;
      }
      offset = data.offset;
    } while (offset);

    return out;
  } catch (err) {
    console.warn('[ActivityLog.getRecentActivityByTypes] unexpected failure:', err);
    return [];
  }
}

// ============================================================================
// Internals
// ============================================================================

function compactLogLine(event: ActivityEvent): string {
  const parts = [
    event.actorType,
    event.actor,
    event.action,
    event.entityType,
    event.entityId || '-',
    `"${(event.summary || '').slice(0, 100)}"`,
  ];
  return parts.join(' | ');
}
