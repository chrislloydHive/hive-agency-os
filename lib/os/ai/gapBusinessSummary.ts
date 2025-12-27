// lib/os/ai/gapBusinessSummary.ts
// GAP-derived business definition extractor
//
// Produces a concise business summary (40–60 words) from the most recent GAP outputs.
// Order of preference:
// 1) GAP Full Report (OS) – diagnostics/summary fields
// 2) GAP IA run – summary/core context
// Returns null when no reliable data is available.

import { getGapFullReportsForCompany } from '@/lib/airtable/gapFullReports';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import type { GapIaRun } from '@/lib/gap/types';

export type GapBusinessSummarySource = 'gapFull' | 'gapIa' | null;

export interface GapBusinessSummaryResult {
  summary: string | null;
  source: GapBusinessSummarySource;
}

const MAX_WORDS = 60;
const MIN_WORDS = 10;

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ').trim();
}

function pickFirstString(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length >= MIN_WORDS) {
      return value.trim();
    }
  }
  return null;
}

function buildFromCore(run: GapIaRun): string | null {
  const core = run.core || {};
  const business = core.businessName || '';
  const offer = core.primaryOffer || '';
  const audience = core.primaryAudience || '';
  const quickSummary = core.quickSummary || '';

  // Prefer quick summary if it has substance
  if (quickSummary && quickSummary.trim().split(/\s+/).length >= MIN_WORDS / 2) {
    return quickSummary.trim();
  }

  const parts: string[] = [];
  if (business) parts.push(business);
  if (offer) parts.push(`helps with ${offer}`);
  if (audience) parts.push(`for ${audience}`);

  const composed = parts.join(' ').trim();
  return composed.length > 0 ? composed : null;
}

function normalizeSummary(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return truncateWords(cleaned, MAX_WORDS);
}

/**
 * Fetch the best available GAP-derived business summary for a company.
 */
export async function getGapBusinessSummary(
  companyId: string
): Promise<GapBusinessSummaryResult> {
  try {
    // 1) Try latest GAP Full Report (OS)
    const fullReports = await getGapFullReportsForCompany(companyId);
    const latestFull = fullReports?.[0];

    if (latestFull) {
      const fullCandidate = pickFirstString([
        // Diagnostics summary is most descriptive if present
        (latestFull.diagnosticsJson as any)?.summary,
        latestFull.summary,
      ]);

      if (fullCandidate) {
        return {
          summary: normalizeSummary(fullCandidate),
          source: 'gapFull',
        };
      }
    }

    // 2) Fall back to latest GAP IA run
    const iaRuns = await getGapIaRunsForCompany(companyId, 1);
    const latestIa = iaRuns?.[0];

    if (latestIa) {
      const iaCandidate = pickFirstString([
        (latestIa.summary as any)?.narrative,
        (latestIa.summary as any)?.headlineDiagnosis,
        latestIa.businessContext,
        buildFromCore(latestIa),
      ]);

      if (iaCandidate) {
        return {
          summary: normalizeSummary(iaCandidate),
          source: 'gapIa',
        };
      }
    }
  } catch (error) {
    console.warn('[gapBusinessSummary] Failed to build GAP business summary:', error);
  }

  return { summary: null, source: null };
}

