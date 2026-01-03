// lib/competition/getCanonicalCompetitionRun.ts
// Canonical accessor for the latest Competition Lab run across engines (V4 preferred, V3 fallback).
// This keeps downstream consumers (proposals, quality, UI status cards) from showing "Not Run"
// when a newer V4 run exists outside the DiagnosticRuns table.

import { getLatestCompetitionRunV4 } from '@/lib/competition-v4';
import { validateCompetitionRun } from '@/lib/competition-v4/validateCompetitionRun';
import type { CompetitionV4Result } from '@/lib/competition-v4';
import { getLatestCompetitionRunV3, type CompetitionRunV3Payload } from '@/lib/competition-v3/store';

type CanonicalRunStatus = 'completed' | 'failed' | 'running' | 'pending' | 'unknown';

export interface CanonicalCompetitionRun {
  version: 'v4' | 'v3';
  runId: string;
  createdAt: string;
  status: CanonicalRunStatus;
  payload: CompetitionV4Result | CompetitionRunV3Payload;
}

function getRunTimestamp(payload: CompetitionV4Result | CompetitionRunV3Payload): string {
  if ('version' in payload && payload.version === 4) {
    return payload.execution.completedAt || payload.execution.startedAt || new Date().toISOString();
  }
  // V3 payload has createdAt and completedAt (no updatedAt)
  const v3 = payload as CompetitionRunV3Payload;
  return v3.completedAt || v3.createdAt || new Date().toISOString();
}

function normalizeStatus(payload: CompetitionV4Result | CompetitionRunV3Payload): CanonicalRunStatus {
  // Cast to string to handle any status value from V3/V4 without TypeScript enum narrowing
  const rawStatus = ('execution' in payload ? payload.execution.status : payload.status) as string | undefined;
  if (!rawStatus) return 'unknown';
  if (rawStatus === 'completed' || rawStatus === 'complete') return 'completed';
  if (rawStatus === 'failed' || rawStatus === 'error') return 'failed';
  if (rawStatus === 'running') return 'running';
  if (rawStatus === 'pending') return 'pending';
  return 'unknown';
}

/**
 * Returns the newest validated competition run, preferring V4 when available.
 * Falls back to V3 so legacy data still renders.
 */
export async function getCanonicalCompetitionRun(
  companyId: string
): Promise<CanonicalCompetitionRun | null> {
  const [v4Record, v3Record] = await Promise.all([
    getLatestCompetitionRunV4(companyId),
    getLatestCompetitionRunV3(companyId),
  ]);

  // Prefer V4 when valid
  if (v4Record?.payload) {
    const validation = validateCompetitionRun(v4Record.payload);
    const status = normalizeStatus(v4Record.payload);
    if (validation.ok && status === 'completed') {
      return {
        version: 'v4',
        runId: v4Record.payload.runId,
        createdAt: getRunTimestamp(v4Record.payload),
        status,
        payload: v4Record.payload,
      };
    }
  }

  // Otherwise, use the most recent between V4 (even if not validated) and V3
  const candidates: CanonicalCompetitionRun[] = [];

  if (v4Record?.payload) {
    candidates.push({
      version: 'v4',
      runId: v4Record.payload.runId,
      createdAt: getRunTimestamp(v4Record.payload),
      status: normalizeStatus(v4Record.payload),
      payload: v4Record.payload,
    });
  }

  if (v3Record) {
    candidates.push({
      version: 'v3',
      runId: v3Record.runId,
      createdAt: getRunTimestamp(v3Record),
      status: normalizeStatus(v3Record),
      payload: v3Record,
    });
  }

  if (candidates.length === 0) return null;

  // Pick newest by createdAt
  candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return candidates[0];
}

