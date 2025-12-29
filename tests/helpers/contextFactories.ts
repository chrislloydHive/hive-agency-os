// tests/helpers/contextFactories.ts
// Factory functions for context/diagnostic test fixtures
//
// These provide properly typed mock objects for tests involving:
// - DiagnosticRun (from lib/os/diagnostics/runs)
// - HeavyGapRunState (from lib/gap-heavy/state)
// - WebsiteLabWriterResult (from lib/contextGraph/websiteLabWriter)

import type { DiagnosticRun, DiagnosticToolId, DiagnosticRunStatus } from '@/lib/os/diagnostics/runs';
import type { HeavyGapRunState, HeavyGapStep, HeavyGapRunStatus } from '@/lib/gap-heavy/state';
import type { WebsiteLabWriterResult } from '@/lib/contextGraph/websiteLabWriter';
import type { EvidencePack } from '@/lib/gap-heavy/types';

// ============================================================================
// DiagnosticRun Factory
// ============================================================================

/**
 * Create a valid DiagnosticRun with sensible defaults
 */
export function makeDiagnosticRun(overrides: Partial<DiagnosticRun> = {}): DiagnosticRun {
  const now = new Date().toISOString();

  return {
    id: overrides.id ?? `diag-run-${Math.random().toString(36).slice(2, 8)}`,
    companyId: overrides.companyId ?? 'test-company',
    toolId: overrides.toolId ?? ('websiteLab' as DiagnosticToolId),
    status: overrides.status ?? ('complete' as DiagnosticRunStatus),
    summary: overrides.summary ?? null,
    score: overrides.score ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    metadata: overrides.metadata ?? null,
    rawJson: overrides.rawJson,
    // Optional V4 fields
    labSlug: overrides.labSlug,
    runType: overrides.runType,
    severityLevel: overrides.severityLevel,
  };
}

// ============================================================================
// EvidencePack Factory
// ============================================================================

/**
 * Create a valid EvidencePack with sensible defaults
 */
export function makeEvidencePack(overrides: Partial<EvidencePack> = {}): EvidencePack {
  return {
    modules: overrides.modules ?? [],
    ...overrides,
  };
}

// ============================================================================
// HeavyGapRunState Factory
// ============================================================================

/**
 * Create a valid HeavyGapRunState with sensible defaults
 */
export function makeHeavyGapRunState(overrides: Partial<HeavyGapRunState> = {}): HeavyGapRunState {
  const now = new Date().toISOString();

  // If evidencePack is provided, ensure it has the required modules field
  let evidencePack = overrides.evidencePack;
  if (evidencePack && !('modules' in evidencePack)) {
    evidencePack = makeEvidencePack(evidencePack as Partial<EvidencePack>);
  }

  return {
    id: overrides.id ?? `heavy-run-${Math.random().toString(36).slice(2, 8)}`,
    gapPlanRunId: overrides.gapPlanRunId ?? 'gap-plan-run-123',
    companyId: overrides.companyId ?? 'test-company',
    gapFullReportId: overrides.gapFullReportId,
    url: overrides.url ?? 'https://example.com',
    domain: overrides.domain ?? 'example.com',
    status: overrides.status ?? ('completed' as HeavyGapRunStatus),
    currentStep: overrides.currentStep ?? ('complete' as HeavyGapStep),
    stepsCompleted: overrides.stepsCompleted ?? ['init', 'discoverPages', 'analyzePages', 'complete'],
    workerVersion: overrides.workerVersion ?? 'heavy-v4.0.0',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastTickAt: overrides.lastTickAt,
    tickCount: overrides.tickCount ?? 0,
    errorMessage: overrides.errorMessage,
    // V4 fields
    modulesRequested: overrides.modulesRequested,
    modulesCompleted: overrides.modulesCompleted,
    evidencePack,
    // V3 legacy data
    data: overrides.data ?? {
      discoverPages: {
        sitemapFound: false,
        seedUrls: [],
        discoveredUrls: [],
        limitedByCap: false,
      },
    },
  };
}

// ============================================================================
// WebsiteLabWriterResult Factory
// ============================================================================

/**
 * Create a valid WebsiteLabWriterResult with sensible defaults
 */
export function makeWebsiteLabWriterResult(
  overrides: Partial<WebsiteLabWriterResult> = {}
): WebsiteLabWriterResult {
  return {
    fieldsUpdated: overrides.fieldsUpdated ?? 0,
    updatedPaths: overrides.updatedPaths ?? [],
    skippedPaths: overrides.skippedPaths ?? [],
    errors: overrides.errors ?? [],
    proof: overrides.proof,
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  DiagnosticRun,
  DiagnosticToolId,
  DiagnosticRunStatus,
  HeavyGapRunState,
  HeavyGapStep,
  HeavyGapRunStatus,
  WebsiteLabWriterResult,
  EvidencePack,
};
