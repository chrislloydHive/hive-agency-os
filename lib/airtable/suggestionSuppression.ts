/**
 * Fingerprint + inbound watermark for dismissed AI suggestions.
 * Prevents auto-resolve / sync from re-proposing the same proposal when no new mail arrived.
 */

import { createHash } from 'crypto';
import type { DismissedSuggestion, SuggestedResolution, TaskRecord } from './tasks';

/** Stable hash of proposal content — per-proposal, not a permanent task mute. */
export function suggestionFingerprint(s: SuggestedResolution): string {
  if ('status' in s && s.status === 'resolved_by_user') {
    const prev = s.prevAction ?? 'unknown';
    return createHash('sha1').update(JSON.stringify(['resolved_by_user', prev])).digest('hex');
  }

  const action = 'action' in s ? s.action : 'unknown';

  if (action === 'update_full') {
    const sr = s as { proposal?: Record<string, unknown> };
    const p = sr.proposal ?? {};
    const basis = JSON.stringify([
      action,
      p.task ?? null,
      p.nextAction ?? null,
      p.status ?? null,
      String(p.notes ?? '').trim(),
    ]);
    return createHash('sha1').update(basis).digest('hex');
  }

  if (action === 'update_nextAction') {
    const sr = s as { newNextAction?: string };
    return createHash('sha1')
      .update(JSON.stringify([action, sr.newNextAction ?? null]))
      .digest('hex');
  }

  if (action === 'add_blocker') {
    const sr = s as { candidateTaskId?: string };
    return createHash('sha1')
      .update(JSON.stringify([action, sr.candidateTaskId ?? null]))
      .digest('hex');
  }

  if (action === 'unblocked') {
    const sr = s as { byTaskId?: string };
    return createHash('sha1').update(JSON.stringify([action, sr.byTaskId ?? null])).digest('hex');
  }

  if (action === 'set_waiting_on') {
    const sr = s as { proposal?: Record<string, unknown> };
    const p = sr.proposal ?? {};
    return createHash('sha1')
      .update(
        JSON.stringify([
          action,
          p.waitingOnType ?? null,
          p.waitingOnDescription ?? null,
          p.waitingUntil ?? null,
        ]),
      )
      .digest('hex');
  }

  const sr = s as { reasoning?: string };
  return createHash('sha1')
    .update(JSON.stringify([action, sr.reasoning ?? null]))
    .digest('hex');
}

function legacyDismissalMatches(
  d: DismissedSuggestion,
  candidate: SuggestedResolution,
): boolean {
  if (d.fingerprint) return false;
  const action = 'action' in candidate ? candidate.action : '';
  if (d.action !== action) return false;
  if (action === 'add_blocker' && 'candidateTaskId' in candidate) {
    return d.candidateTaskId === candidate.candidateTaskId;
  }
  if (action === 'unblocked' && 'byTaskId' in candidate) {
    return d.candidateTaskId === candidate.byTaskId;
  }
  return true;
}

function findPriorDismissal(
  task: TaskRecord,
  fingerprint: string,
  candidate: SuggestedResolution,
): DismissedSuggestion | undefined {
  return (task.dismissedSuggestions ?? []).find(
    (d) => d.fingerprint === fingerprint || legacyDismissalMatches(d, candidate),
  );
}

/**
 * True when this exact proposal was dismissed and no newer inbound mail since.
 */
export function shouldSuppressSuggestedResolution(
  task: TaskRecord,
  candidate: SuggestedResolution,
): boolean {
  const fp = suggestionFingerprint(candidate);
  const prior = findPriorDismissal(task, fp, candidate);
  if (!prior) return false;

  const dismissedWatermark = prior.inboundWatermark ?? null;
  const noNewMail =
    !task.latestInboundAt ||
    !dismissedWatermark ||
    new Date(task.latestInboundAt).getTime() <= new Date(dismissedWatermark).getTime();

  return noNewMail;
}

/** Entry stored on dismiss (user rejected a specific proposal). */
export function buildDismissedSuggestionEntry(
  sr: SuggestedResolution,
  inboundWatermark: string | null,
): DismissedSuggestion {
  const action = 'action' in sr ? sr.action : 'unknown';
  const candidateTaskId =
    action === 'add_blocker'
      ? (sr as { candidateTaskId: string }).candidateTaskId
      : action === 'unblocked'
        ? (sr as { byTaskId: string }).byTaskId
        : undefined;

  return {
    action,
    dismissedAt: new Date().toISOString(),
    fingerprint: suggestionFingerprint(sr),
    inboundWatermark,
    ...(candidateTaskId ? { candidateTaskId } : {}),
  };
}

export function appendDismissedSuggestionEntry(
  existing: DismissedSuggestion[],
  sr: SuggestedResolution,
  inboundWatermark: string | null,
): DismissedSuggestion[] {
  const entry = buildDismissedSuggestionEntry(sr, inboundWatermark);
  if (existing.some((d) => d.fingerprint === entry.fingerprint)) {
    return existing;
  }
  return [...existing, entry];
}
