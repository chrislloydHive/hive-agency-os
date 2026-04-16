// scripts/evalDecisionEngine.ts
// Decision-engine offline eval harness.
//
// Replays recent `decision.applied` events through the decision engine and
// compares the engine's CURRENT recommendation to what Chris actually did.
// Gives us a shippable "did that prompt tweak help or hurt?" signal without
// needing a hand-curated golden set.
//
// Ground truth = `verb` in the `decision.applied` event metadata. These are
// verbs Chris accepted (possibly after editing the draft — we log that as
// well via `decision.draft-edited`). That's a noisy signal — Chris may
// accept sub-optimal recommendations — but it's the best reinforcement
// signal we have.
//
// Usage:
//   npx tsx scripts/evalDecisionEngine.ts           # last 14 days, full run
//   npx tsx scripts/evalDecisionEngine.ts --days 7  # tighter window
//   npx tsx scripts/evalDecisionEngine.ts --limit 20  # cap replay size
//   npx tsx scripts/evalDecisionEngine.ts --dry    # parse inputs but don't call Anthropic
//
// Output:
//   - stdout table: per-task row + overall accuracy
//   - scripts/fixtures/decision-eval-<ISO>.json — machine-readable snapshot
//
// This intentionally doesn't call /api/os/tasks/:id/decide — it reconstructs
// the inputs directly from Airtable so the eval keeps working even if the
// route is torn down or moved.

import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTasks, type TaskRecord } from '../lib/airtable/tasks';
import {
  getRecentTaskActivity,
  getRecentActivityByTypes,
  type ActivityRow,
} from '../lib/airtable/activityLog';
import { getAnyGoogleRefreshToken, getCompanyIntegrations } from '../lib/airtable/companyIntegrations';
import { refreshAccessToken } from '../lib/google/oauth';
import { getIdentity } from '../lib/personalContext';
import {
  buildDecisionPrompt,
  parseDecisionResponse,
  type DecisionInput,
  type DecisionTaskInput,
  type DecisionThreadInput,
  type DecisionActivitySummary,
  type DecisionVerb,
} from '../lib/decisionEngine';

// ============================================================================
// CLI flag parsing — tiny; no yargs needed
// ============================================================================

interface Flags {
  days: number;
  limit: number | null;
  dry: boolean;
  companyId: string | null;
}

function parseFlags(argv: string[]): Flags {
  const out: Flags = { days: 14, limit: null, dry: false, companyId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--days') out.days = Math.max(1, parseInt(argv[++i] || '14', 10));
    else if (a === '--limit') out.limit = Math.max(1, parseInt(argv[++i] || '50', 10));
    else if (a === '--dry') out.dry = true;
    else if (a === '--company') out.companyId = argv[++i] || null;
  }
  return out;
}

// ============================================================================
// Types
// ============================================================================

interface EvalRow {
  taskId: string;
  taskTitle: string;
  actualVerb: DecisionVerb;           // what Chris applied
  predictedVerb: DecisionVerb | null; // what the engine says now
  confidence: 'low' | 'medium' | 'high' | null;
  match: boolean;
  appliedAt: string;
  hadThread: boolean;
  activityRows: number;
  rationale: string;
  error?: string;
  /** draftEdit metadata from the applied event, if any. Surfaces whether Chris
   *  rewrote the AI draft — useful for filtering "AI was structurally right
   *  but wording was off." */
  draftEditSimilarity: number | null;
}

interface EvalSummary {
  generatedAt: string;
  windowDays: number;
  totalCandidates: number;
  totalEvaluated: number;
  skipped: number;
  errors: number;
  verbAccuracy: number;             // exact match rate
  byVerb: Record<string, { total: number; matched: number; accuracy: number }>;
  confusionMatrix: Record<string, Record<string, number>>;
  rows: EvalRow[];
}

// ============================================================================
// Helpers — mirrored from /api/os/tasks/[id]/decide so the eval is hermetic
// ============================================================================

type MsgPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MsgPart[] | null;
};

function extractPlainText(payload: MsgPart | undefined | null): string {
  let body = '';
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return body;
}

function threadIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m1 = /#inbox\/([a-zA-Z0-9]+)/.exec(url);
  if (m1) return m1[1];
  const m2 = /[?&]th=([a-zA-Z0-9]+)/.exec(url);
  return m2 ? m2[1] : null;
}

function overdueDaysFor(ymd: string | null, now: Date): number | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - due.getTime()) / (24 * 3600 * 1000));
  return diff > 0 ? diff : null;
}

function daysSinceIso(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((now.getTime() - t) / (24 * 3600 * 1000));
}

function summarizeActivity(rows: ActivityRow[], now: Date): DecisionActivitySummary {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const sorted = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const statusFlips = sorted.filter(r => {
    if (r.action !== 'task.status-changed' && r.action !== 'task.completed') return false;
    const tms = Date.parse(r.timestamp);
    return !Number.isNaN(tms) && tms >= sevenDaysAgo;
  }).length;

  const hasDraftedReply = sorted.some(r => r.action === 'email.draft-created');
  const opened = [...sorted].reverse().find(r => r.action === 'task.opened-in-ui');

  return {
    lastActions: sorted.slice(-8).map(r => ({
      action: r.action,
      timestamp: r.timestamp,
      summary: r.summary || '',
    })),
    statusFlips,
    lastOpenedInUi: opened?.timestamp,
    hasDraftedReply,
  };
}

// ============================================================================
// Google token (optional — threads improve eval quality but aren't required)
// ============================================================================

async function resolveGoogleAccessToken(companyId: string | null): Promise<string | null> {
  try {
    let refreshToken: string | undefined;
    if (companyId && companyId !== 'default') {
      const integrations = await getCompanyIntegrations(companyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) {
      const fallback = await getAnyGoogleRefreshToken();
      if (fallback) refreshToken = fallback;
    }
    if (!refreshToken) return null;
    return await refreshAccessToken(refreshToken);
  } catch (err) {
    console.warn('[eval] google token fetch failed:', err);
    return null;
  }
}

// ============================================================================
// Build DecisionInput for a single task — same shape the route builds, but
// anchored to `now` (the eval time) rather than the original apply time.
// ============================================================================

async function buildInputForTask(
  task: TaskRecord,
  gmailAccessToken: string | null,
  now: Date,
  identityName: string,
): Promise<{ input: DecisionInput; hadThread: boolean; activityRowCount: number }> {
  const sinceIso = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString();
  const activityRows = await getRecentTaskActivity({
    sinceIso,
    taskIds: [task.id],
    maxRows: 100,
  });
  const activity = summarizeActivity(activityRows, now);

  let thread: DecisionThreadInput | undefined;
  const threadId = threadIdFromUrl(task.threadUrl);
  if (threadId && gmailAccessToken) {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: gmailAccessToken });
      const gmail = google.gmail({ version: 'v1', auth });
      const t = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
      const messages = t.data.messages || [];
      const last = messages[messages.length - 1];
      const headers = last?.payload?.headers || [];
      const hget = (n: string) =>
        headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
      const subject = hget('Subject') || '(no subject)';
      const fromHeader = hget('From') || '—';
      const dateStr = hget('Date');
      let dateIso = '';
      try {
        if (dateStr) dateIso = new Date(dateStr).toISOString();
      } catch {
        /* noop */
      }
      const body = extractPlainText(last?.payload as MsgPart) || last?.snippet || '';
      thread = {
        subject,
        latestFrom: fromHeader,
        latestDate:
          dateIso ||
          (last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : ''),
        latestBody: body,
        messageCount: messages.length,
      };
    } catch (err) {
      console.warn(`[eval] thread fetch failed for ${task.id}:`, err);
    }
  }

  const taskInput: DecisionTaskInput = {
    id: task.id,
    title: task.task,
    status: task.status,
    priority: task.priority,
    due: task.due,
    from: task.from || '',
    project: task.project || null,
    nextAction: task.nextAction || '',
    notes: task.notes || '',
    threadUrl: task.threadUrl,
    daysSinceCreated: daysSinceIso(task.createdAt, now),
    daysSinceLastMotion: daysSinceIso(
      activity.lastActions.length
        ? activity.lastActions[activity.lastActions.length - 1].timestamp
        : task.lastModified,
      now,
    ),
    overdueByDays: overdueDaysFor(task.due, now),
  };

  return {
    input: {
      task: taskInput,
      thread,
      activity,
      identityName,
      todayIso: now.toISOString().slice(0, 10),
    },
    hadThread: !!thread,
    activityRowCount: activityRows.length,
  };
}

// ============================================================================
// Main
// ============================================================================

const VERBS: DecisionVerb[] = ['reply', 'defer', 'delegate', 'ping', 'close', 'split', 'schedule'];

function isVerb(v: unknown): v is DecisionVerb {
  return typeof v === 'string' && (VERBS as readonly string[]).includes(v);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  console.log(
    `Decision eval — window=${flags.days}d, limit=${flags.limit ?? '∞'}, dry=${flags.dry}`,
  );

  const now = new Date();
  const sinceIso = new Date(now.getTime() - flags.days * 24 * 3600 * 1000).toISOString();

  // 1. Pull all decision.applied events in the window.
  const applied = await getRecentActivityByTypes({
    sinceIso,
    entityTypes: ['task'],
    actionPrefixes: ['decision.applied'],
    maxRows: 500,
  });
  console.log(`Found ${applied.length} decision.applied events in the last ${flags.days} days.`);

  // Deduplicate by task id — we only need the most recent apply per task so
  // we're scoring against the freshest ground truth.
  const latestByTask = new Map<string, ActivityRow>();
  for (const row of applied) {
    if (!row.entityId) continue;
    const prev = latestByTask.get(row.entityId);
    if (!prev || prev.timestamp < row.timestamp) latestByTask.set(row.entityId, row);
  }
  let candidates = Array.from(latestByTask.values()).sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  if (flags.limit) candidates = candidates.slice(0, flags.limit);
  console.log(`Evaluating ${candidates.length} unique task-apply events.`);

  // 2. Load edit signals so we can annotate the eval rows.
  const edited = await getRecentActivityByTypes({
    sinceIso,
    entityTypes: ['task'],
    actionPrefixes: ['decision.draft-edited'],
    maxRows: 500,
  });
  const similarityByTask = new Map<string, number>();
  for (const row of edited) {
    if (!row.entityId) continue;
    const sim = typeof row.metadata?.wordSimilarity === 'number'
      ? row.metadata.wordSimilarity
      : null;
    if (sim === null) continue;
    // Keep the most recent similarity per task.
    const prev = similarityByTask.get(row.entityId);
    if (prev === undefined) similarityByTask.set(row.entityId, sim);
  }

  // 3. Load all tasks once so we can enrich without N requests.
  const allTasks = await getTasks({});
  const taskById = new Map(allTasks.map(t => [t.id, t]));

  const identity = await getIdentity();
  const gmailToken = await resolveGoogleAccessToken(flags.companyId);
  if (!gmailToken) {
    console.warn('[eval] No Google token; email-verb evals will be degraded.');
  }

  const anthropic = new Anthropic();
  const rows: EvalRow[] = [];
  let skipped = 0;
  let errors = 0;

  for (const [i, evt] of candidates.entries()) {
    const task = evt.entityId ? taskById.get(evt.entityId) : undefined;
    const actualVerb = evt.metadata?.verb;
    if (!task || !isVerb(actualVerb)) {
      skipped++;
      continue;
    }

    const progress = `[${i + 1}/${candidates.length}]`;
    try {
      const { input, hadThread, activityRowCount } = await buildInputForTask(
        task,
        gmailToken,
        now,
        identity.name || 'Chris',
      );
      const prompt = buildDecisionPrompt(input);

      let predictedVerb: DecisionVerb | null = null;
      let confidence: EvalRow['confidence'] = null;
      let rationale = '';

      if (!flags.dry) {
        const ai = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        });
        const content = ai.content[0];
        if (content && content.type === 'text') {
          const decision = parseDecisionResponse(content.text, input.todayIso);
          predictedVerb = decision.recommendedVerb;
          confidence = decision.confidence;
          rationale = decision.rationale;
        }
      }

      const matched = predictedVerb === actualVerb;
      rows.push({
        taskId: task.id,
        taskTitle: task.task,
        actualVerb,
        predictedVerb,
        confidence,
        match: matched,
        appliedAt: evt.timestamp,
        hadThread,
        activityRows: activityRowCount,
        rationale,
        draftEditSimilarity: similarityByTask.get(task.id) ?? null,
      });
      console.log(
        `${progress} ${matched ? 'HIT ' : 'MISS'} actual=${actualVerb} pred=${predictedVerb ?? 'n/a'} conf=${confidence ?? 'n/a'} · ${task.task.slice(0, 60)}`,
      );
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${progress} ERROR ${task.id}: ${msg}`);
      rows.push({
        taskId: task.id,
        taskTitle: task.task,
        actualVerb,
        predictedVerb: null,
        confidence: null,
        match: false,
        appliedAt: evt.timestamp,
        hadThread: false,
        activityRows: 0,
        rationale: '',
        error: msg,
        draftEditSimilarity: similarityByTask.get(task.id) ?? null,
      });
    }
  }

  // 4. Aggregate.
  const byVerb: EvalSummary['byVerb'] = {};
  const confusion: EvalSummary['confusionMatrix'] = {};
  for (const v of VERBS) {
    byVerb[v] = { total: 0, matched: 0, accuracy: 0 };
    confusion[v] = {};
    for (const p of VERBS) confusion[v][p] = 0;
  }
  let matchedCount = 0;
  for (const r of rows) {
    if (!isVerb(r.actualVerb)) continue;
    byVerb[r.actualVerb].total++;
    if (r.match) {
      matchedCount++;
      byVerb[r.actualVerb].matched++;
    }
    if (r.predictedVerb && isVerb(r.predictedVerb)) {
      confusion[r.actualVerb][r.predictedVerb]++;
    }
  }
  for (const v of VERBS) {
    byVerb[v].accuracy = byVerb[v].total
      ? Math.round((byVerb[v].matched / byVerb[v].total) * 1000) / 1000
      : 0;
  }
  const summary: EvalSummary = {
    generatedAt: now.toISOString(),
    windowDays: flags.days,
    totalCandidates: candidates.length,
    totalEvaluated: rows.length,
    skipped,
    errors,
    verbAccuracy: rows.length ? Math.round((matchedCount / rows.length) * 1000) / 1000 : 0,
    byVerb,
    confusionMatrix: confusion,
    rows,
  };

  // 5. Report.
  console.log('\n── Results ────────────────────────────────────────────');
  console.log(`Evaluated: ${rows.length} / ${candidates.length}`);
  console.log(`Overall verb accuracy: ${(summary.verbAccuracy * 100).toFixed(1)}%`);
  console.log(`Skipped (missing data): ${skipped} · Errors: ${errors}`);
  console.log('\nBy verb:');
  for (const v of VERBS) {
    const b = byVerb[v];
    if (!b.total) continue;
    console.log(
      `  ${v.padEnd(10)} ${b.matched}/${b.total} = ${(b.accuracy * 100).toFixed(0)}%`,
    );
  }
  console.log('\nConfusion (rows=actual, cols=predicted):');
  const header = ['         '].concat(VERBS.map(v => v.slice(0, 4).padStart(5))).join(' ');
  console.log(header);
  for (const a of VERBS) {
    const line = [a.padEnd(9)]
      .concat(VERBS.map(p => String(confusion[a][p]).padStart(5)))
      .join(' ');
    console.log(line);
  }

  // 6. Snapshot.
  const outDir = join(process.cwd(), 'scripts', 'fixtures');
  mkdirSync(outDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const outPath = join(outDir, `decision-eval-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nSnapshot: ${outPath}`);
}

main().catch(err => {
  console.error('[eval] fatal:', err);
  process.exit(1);
});
