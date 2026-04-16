# Activity Log — setup

The Activity Log is the **event-stream memory layer** for the personal OS. Every
state-changing action (task created, status changed, draft reply made, triage
run, UI interactions) writes one row here. Higher phases — momentum, risk
detection, prioritization brain, decision engine — all read from this stream.

The stream is append-only. Nothing in the product deletes from it.

---

## Airtable schema

Create a table called **Activity Log** (or any name — configure via env below).
Fields, in order:

| Field name     | Type                          | Notes                                                                 |
| -------------- | ----------------------------- | --------------------------------------------------------------------- |
| `Timestamp`    | Date & time (ISO 8601)        | Set by the server. Used for ordering.                                 |
| `Actor Type`   | Single line text              | One of `user`, `system`, `ai`.                                         |
| `Actor`        | Single line text              | Human-readable: `Chris`, `auto-triage`, `ai-drafter`, `api`.          |
| `Action`       | Single line text              | Dot-namespaced verb: `task.created`, `task.status-changed`, etc.      |
| `Entity Type`  | Single line text              | `task`, `email`, `meeting`, `doc`, `triage-run`, `other`.              |
| `Entity ID`    | Single line text              | Airtable record id, Gmail thread id, calendar event id, etc.         |
| `Entity Title` | Single line text              | Denormalized title so a row is readable without a join. Truncated 500.|
| `Summary`      | Long text                     | One-line human description. Truncated to 1000 chars.                  |
| `Metadata`     | Long text                     | JSON blob with extra structured context. Truncated to 5000 chars.     |
| `Source`       | Single line text              | Where in the codebase the event was emitted. Free-form.               |

Notes:

- `Action` and `Actor Type` are plain text, not single-selects, so new values
  can be added without touching the Airtable schema.
- `Metadata` is a JSON string (not a linked/rich field) for the same reason —
  each emitter can include whatever structured context is useful.
- No linked-record fields. If you want to cross-reference (e.g. Activity Log →
  Tasks), use `Entity ID` as the foreign key — Airtable supports lookup fields
  against plain text.

Recommended views:

- **All events, newest first** — sort by `Timestamp` desc.
- **Task events** — filter `Entity Type = task`.
- **Triage runs** — filter `Entity Type = triage-run`, one row per run.
- **User actions** — filter `Actor Type = user`, to see Chris's engagement.

---

## Environment variables

```bash
# Required (falls back to OS base if unset):
AIRTABLE_ACTIVITY_LOG_BASE_ID=appXXXXXXXXXXXXXX

# Required (one of):
AIRTABLE_ACTIVITY_LOG_TABLE_ID=tblXXXXXXXXXXXXXX   # preferred — table IDs are stable
AIRTABLE_ACTIVITY_LOG_TABLE="Activity Log"         # or the exact table name
# If both unset, defaults to the name "Activity Log".
```

Set these in `.env.local` for local dev and in the Vercel project settings for
prod. The Airtable API token (`AIRTABLE_API_KEY`) is shared across all bases —
make sure the token has write access to the base configured above.

---

## Behavior

- `logEvent(event)` is the core writer. It **never throws**.
- If the Activity Log base isn't configured, `logEvent` **silently no-ops** and
  writes a `[ActivityLog:no-base]` line to `console.log`. The app still works;
  history is just not recorded.
- If the Airtable API errors, we log a `[ActivityLog] write failed` warning to
  `console.warn` and return normally.
- `logEventAsync(event)` is fire-and-forget — returns immediately, the write
  happens in the background. Use this in hot paths (task mutations, triage
  runs) where user-visible latency matters. On Vercel serverless, background
  promises can be dropped if the lambda freezes. That's acceptable for activity
  logs — we'd rather lose the occasional row than slow down the UI.

---

## Where events are emitted

| Emitter                                             | Action(s)                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `lib/airtable/tasks.ts#createTask`                  | `task.created`                                                   |
| `lib/airtable/tasks.ts#updateTask`                  | `task.updated` / `task.status-changed` / `task.completed`        |
| `lib/airtable/tasks.ts#deleteTask`                  | `task.deleted`                                                   |
| `app/api/os/tasks/auto-triage/route.ts`             | `triage.scan-run`, `task.from-email`, `triage.item-skipped`      |
| `app/api/os/gmail/draft-reply/route.ts`             | `email.draft-created`                                            |
| `app/api/os/activity/log/route.ts` (client-driven)  | Any action — UI opens, dismissals, navigation, etc.              |

---

## Emitting new events

From any server module:

```ts
import { logEventAsync } from '@/lib/airtable/activityLog';

logEventAsync({
  actorType: 'system',
  actor: 'api',
  action: 'task.opened-in-ui',
  entityType: 'task',
  entityId: 'recABC',
  entityTitle: 'Reply to Jim re: geofence data',
  summary: 'Task opened in Command Center edit panel',
  source: 'components/TaskEditPanel',
});
```

From a client component (UI events):

```ts
await fetch('/api/os/activity/log', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'task.opened-in-ui',
    entityType: 'task',
    entityId: task.id,
    entityTitle: task.task,
    source: 'components/TaskEditPanel',
  }),
});
```

Keep action verbs **dot-namespaced** (`domain.verb`) so filtering later is
easy. New actions do not require schema changes — just start using them.
