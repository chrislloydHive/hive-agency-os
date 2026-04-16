/**
 * Decision engine — "what should I do about this task, right now?"
 * -----------------------------------------------------------------
 * Given a task snapshot (status, due, from, notes, thread text, activity),
 * ask Claude to recommend a single concrete next move and a one-line rationale.
 *
 * This module is pure + deterministic up to the LLM boundary:
 *   - `buildDecisionPrompt()` turns the structured input into a prompt string
 *   - `parseDecisionResponse()` extracts the JSON the model returned
 *
 * The API route (`app/api/os/tasks/[id]/decide/route.ts`) does the impure
 * work: load the task, fetch the thread, call Anthropic, emit activity events.
 *
 * Actions (closed set — tuned to Chris's workflow):
 *   - reply       : respond in the thread (may include a suggested draft)
 *   - defer       : push the due date out with a reason
 *   - delegate    : forward to someone specific
 *   - ping        : nudge the person Chris is waiting on
 *   - close       : mark Done (already resolved, or it was FYI-only)
 *   - split       : break into smaller tasks (too broad to act on)
 *   - schedule    : block focus time on the calendar
 *
 * Rationale must be ONE sentence. Chris wants directional clarity, not essays.
 */

// ============================================================================
// Types
// ============================================================================

export type DecisionVerb =
  | 'reply'
  | 'defer'
  | 'delegate'
  | 'ping'
  | 'close'
  | 'split'
  | 'schedule';

/** Simple task shape the engine works off. Intentionally narrow. */
export interface DecisionTaskInput {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due: string | null;
  from: string;
  project: string | null;
  nextAction: string;
  notes: string;
  threadUrl: string | null;
  daysSinceCreated: number | null;
  daysSinceLastMotion: number | null;
  overdueByDays: number | null; // positive = overdue, null = no due date
}

/** Trimmed thread context — what the engine sees of the email. */
export interface DecisionThreadInput {
  subject: string;
  latestFrom: string;           // "Jim <jim@client.com>"
  latestDate: string;           // ISO
  latestBody: string;           // plain text, capped
  messageCount: number;
}

/** Recent activity summary — what has already happened to this task. */
export interface DecisionActivitySummary {
  lastActions: Array<{ action: string; timestamp: string; summary: string }>;
  statusFlips: number;
  lastOpenedInUi?: string;      // ISO
  hasDraftedReply: boolean;
}

export interface DecisionInput {
  task: DecisionTaskInput;
  thread?: DecisionThreadInput;
  activity: DecisionActivitySummary;
  identityName: string;         // "Chris"
  /** ISO date YYYY-MM-DD; anchors "today" for the model. Required — past/stale
   *  proposedDates (e.g. 2024-12-19 for an April 2026 ask) are a common LLM
   *  failure mode if we don't pin this. */
  todayIso: string;
}

export interface DecisionAlternative {
  verb: DecisionVerb;
  label: string;                // 2-5 word headline
  rationale: string;            // one sentence
}

export interface DecisionOutput {
  recommendedVerb: DecisionVerb;
  recommendedLabel: string;     // 2-5 word imperative: "Reply to Jim"
  rationale: string;            // one sentence, why this over alternatives
  confidence: 'low' | 'medium' | 'high';
  alternatives: DecisionAlternative[];
  /** Only populated when recommendedVerb === 'reply'. 2-5 sentence draft. */
  suggestedDraft?: string;
  /** For defer/ping/schedule: the proposed date (YYYY-MM-DD). Optional. */
  proposedDate?: string;
}

// ============================================================================
// Prompt building
// ============================================================================

/** Format a nullable field for the prompt without spraying `null` / `undefined`. */
function fieldOrDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function buildDecisionPrompt(input: DecisionInput): string {
  const { task, thread, activity, identityName, todayIso } = input;

  const threadBlock = thread
    ? [
        'Email thread context:',
        `  Subject     : ${thread.subject}`,
        `  Latest from : ${thread.latestFrom}`,
        `  Latest date : ${thread.latestDate}`,
        `  # messages  : ${thread.messageCount}`,
        `  Latest body:`,
        `"""`,
        thread.latestBody.slice(0, 3000),
        `"""`,
      ].join('\n')
    : 'No email thread attached to this task.';

  const activityBlock =
    activity.lastActions.length > 0
      ? [
          'Recent activity on this task:',
          ...activity.lastActions.slice(0, 8).map(
            e => `  - ${e.timestamp.slice(0, 10)}  ${e.action}: ${e.summary.slice(0, 140)}`,
          ),
          `  Status flips in last 7 days: ${activity.statusFlips}`,
          `  Has drafted reply: ${activity.hasDraftedReply ? 'yes' : 'no'}`,
          activity.lastOpenedInUi
            ? `  Last opened in UI: ${activity.lastOpenedInUi.slice(0, 10)}`
            : `  Last opened in UI: never`,
        ].join('\n')
      : 'No recent activity logged for this task.';

  return `You are advising ${identityName} on a single task from their personal operating system.
Your job: pick ONE concrete next action and explain, in one sentence, why that action beats the alternatives.

Today's date: ${todayIso}  ← use this as the anchor for any "proposedDate" field.
Never propose a date in the past. Any proposed date MUST be strictly later than today.

Task snapshot:
  Title         : ${task.title}
  Status        : ${task.status}
  Priority      : ${fieldOrDash(task.priority)}
  Due           : ${fieldOrDash(task.due)}
  From          : ${fieldOrDash(task.from)}
  Project       : ${fieldOrDash(task.project)}
  Next action   : ${fieldOrDash(task.nextAction)}
  Notes         : ${task.notes ? task.notes.slice(0, 800) : '—'}
  Days since created   : ${fieldOrDash(task.daysSinceCreated)}
  Days since last motion: ${fieldOrDash(task.daysSinceLastMotion)}
  Overdue by (days)    : ${fieldOrDash(task.overdueByDays)}

${threadBlock}

${activityBlock}

Choose exactly ONE verb from this closed set:
  reply    — Send a response in the email thread.
  defer    — Push the due date out; not actionable today.
  delegate — Forward to someone else; ${identityName} shouldn't own this.
  ping     — Nudge the person ${identityName} is waiting on.
  close    — Mark Done; already resolved or was FYI-only.
  split    — Break into smaller tasks; too broad to act on as-is.
  schedule — Block focus time on the calendar; needs deep work.

Return ONLY a JSON object (no markdown fences, no prose before or after) with this shape:
{
  "recommendedVerb": "reply" | "defer" | "delegate" | "ping" | "close" | "split" | "schedule",
  "recommendedLabel": "2-5 word imperative, e.g. 'Reply to Jim'",
  "rationale": "ONE sentence explaining why this beats the alternatives.",
  "confidence": "low" | "medium" | "high",
  "alternatives": [
    { "verb": "...", "label": "...", "rationale": "one sentence" }
  ],
  "suggestedDraft": "Only if verb is 'reply' — 2-5 sentence draft in ${identityName}'s voice, no fluff, no sign-off.",
  "proposedDate": "YYYY-MM-DD — only for defer/ping/schedule, otherwise omit"
}

Rules:
- Exactly ONE sentence for every rationale field. No semicolons to stitch two sentences.
- Alternatives: 2-3 items, NEVER include the recommended verb.
- If the task is Waiting and the blocker hasn't responded in 5+ days, strongly prefer "ping".
- If due is past and notes/thread show no new info, prefer "defer" with a specific reason.
- If the task looks like a multi-week effort with vague notes, prefer "split".
- If a draft has already been created and the thread hasn't moved, suggested next is usually to send that draft — still use verb "reply" and note this in rationale.
- ${identityName} is CEO of Hive — pick verbs that match an executive's time allocation.`;
}

// ============================================================================
// Response parsing
// ============================================================================

const ALLOWED_VERBS: DecisionVerb[] = [
  'reply',
  'defer',
  'delegate',
  'ping',
  'close',
  'split',
  'schedule',
];

function isVerb(v: unknown): v is DecisionVerb {
  return typeof v === 'string' && (ALLOWED_VERBS as string[]).includes(v);
}

function isConfidence(v: unknown): v is 'low' | 'medium' | 'high' {
  return v === 'low' || v === 'medium' || v === 'high';
}

/** Extract the first {...} JSON block from the model output and parse it. */
function extractJsonObject(text: string): Record<string, unknown> | null {
  // Tolerate code fences and leading/trailing prose.
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Fast path: whole thing is JSON.
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  // Slow path: find first balanced {...} block.
  let depth = 0;
  let start = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = trimmed.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          // keep scanning
        }
      }
    }
  }
  return null;
}

/** True if `ymd` (YYYY-MM-DD) is strictly after today's YYYY-MM-DD. */
function isFutureYmd(ymd: string, todayIso?: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const today = todayIso && /^\d{4}-\d{2}-\d{2}$/.test(todayIso)
    ? todayIso
    : new Date().toISOString().slice(0, 10);
  return ymd > today;
}

export function parseDecisionResponse(raw: string, todayIso?: string): DecisionOutput {
  const obj = extractJsonObject(raw);
  if (!obj) {
    // Safe fallback so the UI never explodes — Chris can always retry.
    return {
      recommendedVerb: 'reply',
      recommendedLabel: 'Review and decide',
      rationale: 'Model response could not be parsed as JSON; open the task and decide manually.',
      confidence: 'low',
      alternatives: [],
    };
  }

  const verb = isVerb(obj.recommendedVerb) ? obj.recommendedVerb : 'reply';
  const confidence = isConfidence(obj.confidence) ? obj.confidence : 'medium';
  const rawAlts = Array.isArray(obj.alternatives) ? obj.alternatives : [];
  const alternatives: DecisionAlternative[] = rawAlts
    .map(a => {
      if (!a || typeof a !== 'object') return null;
      const alt = a as Record<string, unknown>;
      if (!isVerb(alt.verb)) return null;
      return {
        verb: alt.verb,
        label: typeof alt.label === 'string' ? alt.label : alt.verb,
        rationale: typeof alt.rationale === 'string' ? alt.rationale : '',
      };
    })
    .filter((x): x is DecisionAlternative => !!x)
    .filter(a => a.verb !== verb) // never duplicate the primary verb
    .slice(0, 3);

  const suggestedDraft =
    verb === 'reply' && typeof obj.suggestedDraft === 'string' && obj.suggestedDraft.trim()
      ? obj.suggestedDraft.trim()
      : undefined;

  // Drop past/invalid proposedDates. If the model hallucinates a stale date
  // (e.g. 2024-12-19 in April 2026), we'd rather send nothing than mislead the
  // UI — apply-decision will fall back to a sensible default (today + 3d).
  const proposedDate =
    typeof obj.proposedDate === 'string' && isFutureYmd(obj.proposedDate, todayIso)
      ? obj.proposedDate
      : undefined;

  return {
    recommendedVerb: verb,
    recommendedLabel:
      typeof obj.recommendedLabel === 'string' && obj.recommendedLabel.trim()
        ? obj.recommendedLabel.trim()
        : defaultLabel(verb),
    rationale:
      typeof obj.rationale === 'string' && obj.rationale.trim()
        ? obj.rationale.trim()
        : 'No rationale provided.',
    confidence,
    alternatives,
    suggestedDraft,
    proposedDate,
  };
}

function defaultLabel(verb: DecisionVerb): string {
  switch (verb) {
    case 'reply':
      return 'Reply in thread';
    case 'defer':
      return 'Defer to later';
    case 'delegate':
      return 'Delegate this';
    case 'ping':
      return 'Ping the blocker';
    case 'close':
      return 'Mark Done';
    case 'split':
      return 'Break into pieces';
    case 'schedule':
      return 'Schedule focus time';
  }
}

// Exposed for tests.
export const _internal = { extractJsonObject, defaultLabel };
