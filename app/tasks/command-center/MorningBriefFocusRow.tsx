'use client';
// app/tasks/command-center/MorningBriefFocusRow.tsx
// A single focus row in the Morning Brief that can be decided + applied inline
// without opening the full TaskEditPanel. Rendered 3x in the Focus section —
// or en masse via the "Decide all" button, which triggers auto-decide on each
// row in parallel.
//
// Design deliberately compact: the point is speed. A row shows:
//   1. Default state: priority pill + title + "Decide" button
//   2. Deciding:      title + spinner
//   3. Decided:       verb pill + one-line rationale + "Apply" button
//   4. Applied:       ✓ success message
//
// The full draft editor + alternatives list lives in TaskDecider inside the
// edit panel. Here we just surface the recommended verb and let Chris fire it.
// If he wants to edit the draft before sending, the chevron still opens the
// full panel.

import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ChevronRight,
  Sparkles,
  Play,
  Check,
  AlertCircle,
  ExternalLink,
  Mail,
  ChevronDown,
} from 'lucide-react';

type Verb = 'reply' | 'defer' | 'delegate' | 'ping' | 'close' | 'split' | 'schedule';

interface FocusReasonChip {
  tag: string;
  label: string;
  points: number;
}

interface FocusEntry {
  id: string;
  title: string;
  priority: string | null;
  due: string | null;
  status: string;
  project?: string | null;
  topReason: string | null;
  reasons?: FocusReasonChip[];
  score: number;
}

interface ThreadPreview {
  subject: string;
  latestFrom: string;
  latestDate: string;
  body: string;
  truncated: boolean;
  messageCount: number;
}

interface DecisionResponse {
  taskId: string;
  taskTitle: string;
  generatedAt: string;
  hasThread: boolean;
  latestMessageId: string | null;
  activityRowsConsidered: number;
  decision: {
    recommendedVerb: Verb;
    recommendedLabel: string;
    rationale: string;
    confidence: 'low' | 'medium' | 'high';
    alternatives: Array<{ verb: Verb; label: string; rationale: string }>;
    suggestedDraft?: string;
    proposedDate?: string;
  };
  threadPreview: ThreadPreview | null;
}

interface ApplyResult {
  ok: true;
  verb: Verb;
  action: string;
  message: string;
  taskId: string;
  draftId?: string;
  draftUrl?: string;
}

function priorityPill(p: string | null | undefined): string {
  switch (p) {
    case 'P0':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'P1':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'P2':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'P3':
      return 'bg-white/10 text-gray-400 border-white/10';
    default:
      return 'bg-white/10 text-gray-400 border-white/10';
  }
}

function verbColor(verb: string): string {
  switch (verb) {
    case 'reply':
      return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    case 'ping':
      return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    case 'defer':
      return 'bg-sky-500/15 border-sky-500/40 text-sky-300';
    case 'delegate':
      return 'bg-purple-500/15 border-purple-500/40 text-purple-300';
    case 'close':
      return 'bg-gray-500/15 border-gray-500/40 text-gray-300';
    case 'split':
      return 'bg-orange-500/15 border-orange-500/40 text-orange-300';
    case 'schedule':
      return 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300';
    default:
      return 'bg-white/5 border-white/10 text-gray-300';
  }
}

const EMAIL_VERBS: Verb[] = ['reply', 'ping'];

export interface FocusRowProps {
  focus: FocusEntry;
  /** Click the task body (chevron / title) to open the full edit panel. */
  onEdit: (taskId: string) => void;
  /** A monotonically-increasing trigger value. Each time the parent bumps this
   *  to a new number, the row fires a fresh decide request. Decouples the
   *  "go!" signal from the "is deciding" state. */
  decideNonce?: number;
  /** After a successful Apply, parent may refresh the brief to drop Done rows. */
  onApplied?: (result: ApplyResult) => void;
}

export function MorningBriefFocusRow({ focus, onEdit, decideNonce, onApplied }: FocusRowProps) {
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [data, setData] = useState<DecisionResponse | null>(null);

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<ApplyResult | null>(null);

  /** Thread-preview expansion state. Defaults to collapsed, but auto-opens when
   *  the engine is low-confidence — same pattern as TaskDecider. */
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Track the last nonce we acted on so a re-render with the same value is a
  // no-op, but a bumped nonce re-fires the decide (user can hit "Decide all"
  // again after an error). `null` means "never triggered by parent yet."
  const lastHandledNonceRef = useRef<number | null>(null);

  // Auto-expand the thread preview on the first render of a low-confidence
  // decision — but only once, so a manual collapse sticks.
  const autoExpandedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.threadPreview) return;
    if (autoExpandedForRef.current === data.generatedAt) return;
    autoExpandedForRef.current = data.generatedAt;
    if (data.decision.confidence === 'low') setPreviewExpanded(true);
  }, [data]);

  async function decide() {
    setDeciding(true);
    setDecideError(null);
    try {
      const res = await fetch(`/api/os/tasks/${focus.id}/decide`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Decide failed: ${res.status}`);
      }
      const json: DecisionResponse = await res.json();
      setData(json);
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : 'Failed to get decision');
    } finally {
      setDeciding(false);
    }
  }

  useEffect(() => {
    if (
      decideNonce !== undefined &&
      decideNonce !== lastHandledNonceRef.current &&
      !deciding &&
      !data
    ) {
      lastHandledNonceRef.current = decideNonce;
      void decide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decideNonce]);

  async function apply() {
    if (!data) return;
    const d = data.decision;
    const needsEmail = EMAIL_VERBS.includes(d.recommendedVerb);
    if (needsEmail && !data.latestMessageId) {
      setApplyError('No email thread attached — open the task to handle manually.');
      return;
    }
    if (needsEmail && !d.suggestedDraft) {
      setApplyError('No draft produced — open the task and regenerate.');
      return;
    }

    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/os/tasks/${focus.id}/apply-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verb: d.recommendedVerb,
          label: d.recommendedLabel,
          suggestedDraft: d.suggestedDraft,
          proposedDate: d.proposedDate,
          latestMessageId: data.latestMessageId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Apply failed: ${res.status}`);
      setApplySuccess(json as ApplyResult);
      onApplied?.(json as ApplyResult);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply decision');
    } finally {
      setApplying(false);
    }
  }

  // Row container is always the same frame; inner contents change based on state.
  return (
    <li className="rounded border border-white/5 bg-white/[0.02] hover:border-white/10 transition-colors">
      {/* Top line: priority + title + chevron (opens full panel) + inline action */}
      <div className="flex items-start gap-2 p-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5 ${priorityPill(focus.priority)}`}
        >
          {focus.priority || '–'}
        </span>
        <button
          type="button"
          onClick={() => onEdit(focus.id)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="text-sm text-gray-100 truncate">{focus.title}</div>
          {!data && focus.reasons && focus.reasons.length > 0 ? (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {focus.reasons.map(r => (
                <span
                  key={r.tag}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    r.points > 0
                      ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300/90'
                      : 'bg-white/5 border-white/10 text-gray-500'
                  }`}
                  title={`${r.tag} · ${r.points > 0 ? '+' : ''}${r.points}`}
                >
                  {r.label}
                </span>
              ))}
            </div>
          ) : (
            focus.topReason && !data && (
              <div className="text-[11px] text-gray-500 mt-0.5 truncate">{focus.topReason}</div>
            )
          )}
        </button>

        {/* Inline action: Decide → Apply → Applied */}
        {!data && !deciding && !decideError && !applySuccess && (
          <button
            type="button"
            onClick={decide}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] text-indigo-200 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Decide
          </button>
        )}
        {deciding && (
          <div className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Thinking
          </div>
        )}

        <button
          type="button"
          onClick={() => onEdit(focus.id)}
          aria-label="Open task"
          className="shrink-0 p-1 text-gray-600 hover:text-gray-300"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Decision panel — shows below once /decide returns */}
      {data && !applySuccess && (
        <div className="px-2 pb-2 space-y-2 border-t border-white/5 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${verbColor(data.decision.recommendedVerb)}`}
            >
              {data.decision.recommendedVerb}
            </span>
            <span className="text-xs text-gray-200 truncate">{data.decision.recommendedLabel}</span>
            <span className="text-[10px] text-gray-500 ml-auto shrink-0">
              {data.decision.confidence}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-snug">{data.decision.rationale}</p>

          {/* Thread preview — collapsible, auto-open for low-confidence.
              Same logic as TaskDecider but trimmed for this compact row. */}
          {data.threadPreview && (
            <div className="rounded border border-white/5 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setPreviewExpanded(v => !v)}
                aria-expanded={previewExpanded}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-left"
              >
                <Mail className="w-3 h-3 text-sky-300 shrink-0" />
                <span className="text-[10px] text-gray-400 truncate flex-1">
                  {data.threadPreview.subject || '(no subject)'}
                </span>
                <span className="text-[10px] text-gray-600 shrink-0">
                  {data.threadPreview.messageCount} msg
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-gray-600 shrink-0 transition-transform ${previewExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {previewExpanded && (
                <div className="px-2 pb-2 border-t border-white/5 pt-1.5">
                  <div className="text-[10px] text-gray-500 mb-1 truncate">
                    from {data.threadPreview.latestFrom || 'unknown'}
                  </div>
                  {data.threadPreview.body ? (
                    <p className="text-[11px] text-gray-300 whitespace-pre-wrap leading-snug">
                      {data.threadPreview.body}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic">(empty body)</p>
                  )}
                  {data.threadPreview.truncated && (
                    <p className="text-[10px] text-gray-600 italic mt-1">
                      …truncated; open the task for full text.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={applying}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] text-white font-medium transition-colors"
            >
              {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {applying ? 'Applying' : `Apply: ${data.decision.recommendedLabel}`}
            </button>
            <button
              type="button"
              onClick={() => onEdit(focus.id)}
              className="text-[10px] text-gray-500 hover:text-gray-300 underline"
            >
              Edit first
            </button>
          </div>
          {applyError && (
            <div className="flex items-start gap-1.5 text-[10px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}
        </div>
      )}

      {/* Success state — replaces the decision panel after Apply */}
      {applySuccess && (
        <div className="px-2 pb-2 pt-2 border-t border-white/5">
          <div className="flex items-start gap-2 text-[11px] text-emerald-200 bg-emerald-500/[0.08] border border-emerald-500/30 rounded px-2 py-1.5">
            <Check className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="flex-1 min-w-0">{applySuccess.message}</span>
            {applySuccess.draftUrl && (
              <a
                href={applySuccess.draftUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-0.5 text-sky-300 hover:text-sky-200 shrink-0"
              >
                Open <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Decide-time error — retryable in place */}
      {decideError && (
        <div className="px-2 pb-2 pt-2 border-t border-white/5">
          <div className="flex items-start gap-1.5 text-[10px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="flex-1">{decideError}</span>
            <button type="button" onClick={decide} className="underline hover:text-red-200">
              Retry
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
