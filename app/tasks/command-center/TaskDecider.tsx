'use client';
// app/tasks/command-center/TaskDecider.tsx
// Inline panel inside TaskEditPanel: asks the decision engine "what should I
// do about this task?" and renders the recommended verb + one-line rationale,
// plus 2-3 alternatives and (for reply/ping) a suggested draft. Each verb can
// be applied in-place — clicking "Apply" POSTs to /apply-decision which either
// updates the task, creates a Gmail draft, or both.
//
// Render surface is intentionally compact — a single collapsible block that
// sits below the task form fields. First load is lazy (click to invoke);
// that keeps the edit panel snappy and avoids burning tokens on every open.

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Play,
  ExternalLink,
  AlertCircle,
  Undo2,
  Pencil,
  ChevronDown,
  Mail,
} from 'lucide-react';

type Verb = 'reply' | 'defer' | 'delegate' | 'ping' | 'close' | 'split' | 'schedule';

interface Alternative {
  verb: Verb;
  label: string;
  rationale: string;
}

interface Decision {
  recommendedVerb: Verb;
  recommendedLabel: string;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  alternatives: Alternative[];
  suggestedDraft?: string;
  proposedDate?: string;
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
  decision: Decision;
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

function confidenceLabel(c: 'low' | 'medium' | 'high'): string {
  return c === 'high' ? 'high confidence' : c === 'medium' ? 'medium confidence' : 'low confidence';
}

/** Verbs that need a latestMessageId to apply (i.e., Gmail-driven). */
const EMAIL_VERBS: Verb[] = ['reply', 'ping'];

function requiresEmailContext(verb: Verb): boolean {
  return EMAIL_VERBS.includes(verb);
}

export function TaskDecider({
  taskId,
  onApplied,
}: {
  taskId: string;
  /** Called after a successful apply so the parent can refresh state. */
  onApplied?: (result: ApplyResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DecisionResponse | null>(null);
  const [copied, setCopied] = useState(false);

  /** Which verb is currently being applied (disables buttons to prevent double-click). */
  const [applyingVerb, setApplyingVerb] = useState<Verb | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<ApplyResult | null>(null);

  /** The editable draft body. Seeded from the AI's suggestedDraft; Chris can
   *  tweak before Apply. `null` means we haven't seeded yet (no decision loaded
   *  or no draft). Kept separate from `data.decision.suggestedDraft` so we can
   *  show a "modified" indicator + revert. */
  const [editedDraft, setEditedDraft] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Seed the textarea whenever a new decision arrives. If Chris regenerates,
  // this overwrites any in-progress edits — that's the right behavior because
  // regenerate means "give me a fresh take."
  useEffect(() => {
    if (data?.decision.suggestedDraft !== undefined) {
      setEditedDraft(data.decision.suggestedDraft);
    } else {
      setEditedDraft(null);
    }
  }, [data]);

  // Auto-size the textarea to fit its content — avoids an internal scrollbar
  // for short drafts while still letting longer ones expand naturally.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [editedDraft]);

  const originalDraft = data?.decision.suggestedDraft;
  const draftEdited =
    originalDraft !== undefined && editedDraft !== null && editedDraft !== originalDraft;

  /** Collapsed/expanded state for the thread preview card. Default collapsed
   *  so the recommendation is the primary focus — but we auto-expand when the
   *  engine isn't sure (low confidence) so Chris reads the context before he
   *  hits Apply. He can still collapse it manually. */
  const [threadExpanded, setThreadExpanded] = useState(false);
  /** Track which decision generation we've auto-expanded for, so a user-driven
   *  collapse on a low-confidence decision sticks instead of snapping back open
   *  on the next re-render. */
  const autoExpandedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.threadPreview) return;
    // Key the auto-expand on the generation timestamp: a regenerate produces a
    // new `generatedAt`, so we get a fresh chance to auto-expand if the new
    // recommendation is also low-confidence.
    const key = data.generatedAt;
    if (autoExpandedForRef.current === key) return;
    autoExpandedForRef.current = key;
    if (data.decision.confidence === 'low') {
      setThreadExpanded(true);
    }
  }, [data]);

  async function invoke() {
    setLoading(true);
    setError(null);
    // Invalidate any prior apply state so the UI doesn't show a stale "Applied"
    // badge next to a freshly regenerated recommendation.
    setApplySuccess(null);
    setApplyError(null);
    try {
      const res = await fetch(`/api/os/tasks/${taskId}/decide`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Decide failed: ${res.status}`);
      }
      const json: DecisionResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get decision');
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    const toCopy = editedDraft ?? data?.decision.suggestedDraft;
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked; non-fatal
    }
  }

  function revertDraft() {
    if (data?.decision.suggestedDraft !== undefined) {
      setEditedDraft(data.decision.suggestedDraft);
    }
  }

  async function applyVerb(verb: Verb, label: string) {
    if (!data) return;
    setApplyingVerb(verb);
    setApplyError(null);
    setApplySuccess(null);
    // Use the edited draft (falling back to the AI's original) so any tweaks
    // Chris made in the textarea land in the Gmail draft verbatim.
    const draftToSend =
      editedDraft !== null ? editedDraft : data.decision.suggestedDraft;
    try {
      const res = await fetch(`/api/os/tasks/${taskId}/apply-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verb,
          label,
          suggestedDraft: draftToSend,
          // Ship the original too so the server can detect edit-before-apply
          // and log a `decision.draft-edited` signal for the feedback loop.
          originalDraft: data.decision.suggestedDraft,
          proposedDate: data.decision.proposedDate,
          latestMessageId: data.latestMessageId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Apply failed: ${res.status}`);
      }
      setApplySuccess(json as ApplyResult);
      onApplied?.(json as ApplyResult);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply decision');
    } finally {
      setApplyingVerb(null);
    }
  }

  if (!data && !loading && !error) {
    return (
      <div className="pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={invoke}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-200 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          What should I do next?
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Thinking through the thread and recent activity…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-2 border-t border-white/5">
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">
          {error}
          <button
            type="button"
            onClick={invoke}
            className="ml-2 underline hover:text-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const d = data.decision;

  // If the recommendation needs email context but we don't have it, surface a
  // warning that the Apply button is going to fail — better to say so upfront.
  // The draft body check considers Chris's edits (he may have emptied it).
  const recNeedsEmail = requiresEmailContext(d.recommendedVerb);
  const effectiveDraft = editedDraft !== null ? editedDraft.trim() : (d.suggestedDraft || '').trim();
  const recBlocked =
    (recNeedsEmail && !data.latestMessageId) ||
    (recNeedsEmail && !effectiveDraft);

  return (
    <div className="pt-2 border-t border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            Suggested next move
          </span>
        </div>
        <button
          type="button"
          onClick={invoke}
          aria-label="Regenerate decision"
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Thread preview — collapsed by default so the recommendation stays primary. */}
      {data.threadPreview && (
        <ThreadPreviewCard
          preview={data.threadPreview}
          expanded={threadExpanded}
          onToggle={() => setThreadExpanded(v => !v)}
          lowConfidenceHint={data.decision.confidence === 'low'}
        />
      )}

      <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/[0.06] p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] px-2 py-0.5 rounded border font-medium ${verbColor(d.recommendedVerb)}`}
          >
            {d.recommendedVerb}
          </span>
          <span className="text-sm font-semibold text-gray-100">{d.recommendedLabel}</span>
          <span className="text-[10px] text-gray-500 ml-auto">
            {confidenceLabel(d.confidence)}
          </span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{d.rationale}</p>
        {d.proposedDate && (
          <div className="text-[11px] text-gray-400">
            Proposed date: <span className="text-gray-200 font-mono">{d.proposedDate}</span>
          </div>
        )}

        {recBlocked && (
          <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {!data.latestMessageId
                ? 'No email thread attached — pick an alternative, or attach the thread URL on the task.'
                : 'No draft body produced — regenerate or pick an alternative.'}
            </span>
          </div>
        )}

        {/* Primary Apply button */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => applyVerb(d.recommendedVerb, d.recommendedLabel)}
            disabled={applyingVerb !== null || recBlocked || !!applySuccess}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] text-white font-medium transition-colors"
          >
            {applyingVerb === d.recommendedVerb ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : applySuccess?.verb === d.recommendedVerb ? (
              <Check className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            {applyingVerb === d.recommendedVerb
              ? 'Applying…'
              : applySuccess?.verb === d.recommendedVerb
                ? 'Applied'
                : `Apply: ${d.recommendedLabel}`}
          </button>
          {applySuccess?.draftUrl && applySuccess.verb === d.recommendedVerb && (
            <a
              href={applySuccess.draftUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200"
            >
              Open draft <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {applySuccess && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-[11px] text-emerald-200 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{applySuccess.message}</span>
        </div>
      )}

      {applyError && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{applyError}</span>
        </div>
      )}

      {d.suggestedDraft && editedDraft !== null && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">
                Draft
              </span>
              {draftEdited && (
                <span className="flex items-center gap-1 text-[10px] text-amber-300">
                  <Pencil className="w-2.5 h-2.5" />
                  edited
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {draftEdited && (
                <button
                  type="button"
                  onClick={revertDraft}
                  title="Revert to AI's original draft"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20"
                >
                  <Undo2 className="w-3 h-3" />
                  Revert
                </button>
              )}
              <button
                type="button"
                onClick={copyDraft}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={editedDraft}
            onChange={e => setEditedDraft(e.target.value)}
            placeholder="Edit the draft before Apply creates the Gmail draft…"
            rows={4}
            className="w-full resize-none rounded border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-gray-200 leading-relaxed focus:outline-none focus:border-indigo-500/50 focus:bg-black/30 placeholder:text-gray-600 font-[inherit]"
            // Disable the textarea once the draft has been applied — further
            // edits are useless since the Gmail draft has already been created
            // (they'd need to edit directly in Gmail at that point).
            disabled={!!applySuccess && (applySuccess.verb === 'reply' || applySuccess.verb === 'ping')}
          />
          <p className="text-[10px] text-gray-600">
            Your edits land in Gmail as the draft body. No sign-off is appended.
          </p>
        </div>
      )}

      {d.alternatives.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Alternatives</div>
          <ul className="space-y-1">
            {d.alternatives.map((a, i) => {
              const altBlocked = requiresEmailContext(a.verb) && !data.latestMessageId;
              const isApplyingThis = applyingVerb === a.verb;
              const wasApplied = applySuccess?.verb === a.verb;
              return (
                <li
                  key={`${a.verb}-${i}`}
                  className="flex items-start gap-2 p-2 rounded border border-white/5 bg-white/[0.02]"
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5 ${verbColor(a.verb)}`}
                  >
                    {a.verb}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200">{a.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{a.rationale}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyVerb(a.verb, a.label)}
                    disabled={applyingVerb !== null || altBlocked || !!applySuccess}
                    title={altBlocked ? 'No email thread attached' : `Apply: ${a.label}`}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-300 border border-white/10 hover:border-white/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isApplyingThis ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : wasApplied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {isApplyingThis ? 'Applying' : wasApplied ? 'Applied' : 'Apply'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-gray-600">
        Based on {data.activityRowsConsidered} activity events
        {data.hasThread ? ' + email thread' : ' (no thread attached)'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThreadPreviewCard
// A collapsible card that shows the latest email in the attached thread. This
// gives Chris enough context to eyeball "what am I replying to?" before hitting
// Apply, without bouncing to Gmail. The body is already trimmed server-side
// (quoted replies stripped, capped at 200 words) — we just render it.
// ─────────────────────────────────────────────────────────────────────────────

function formatPreviewDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function ThreadPreviewCard({
  preview,
  expanded,
  onToggle,
  lowConfidenceHint,
}: {
  preview: ThreadPreview;
  expanded: boolean;
  onToggle: () => void;
  /** Render a small "read before applying" note when the engine is unsure. */
  lowConfidenceHint?: boolean;
}) {
  const when = formatPreviewDate(preview.latestDate);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-start gap-2 text-left"
      >
        <Mail className="w-3.5 h-3.5 text-sky-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-200 truncate">
            {preview.subject || '(no subject)'}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
            from {preview.latestFrom || 'unknown'}
            {when ? ` · ${when}` : ''}
            {' · '}
            {preview.messageCount} message{preview.messageCount === 1 ? '' : 's'}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && lowConfidenceHint && (
        <div className="mt-2 text-[10px] text-amber-300/80 italic">
          Low confidence — worth reading before applying.
        </div>
      )}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/5">
          {preview.body ? (
            <>
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                {preview.body}
              </p>
              {preview.truncated && (
                <p className="text-[10px] text-gray-500 mt-2 italic">
                  …truncated; open the thread in Gmail for full text.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-gray-500 italic">(empty body)</p>
          )}
        </div>
      )}
    </div>
  );
}
