// lib/gap-heavy/modules/websiteLabEvents.ts
// Website Lab V5 Event Payloads
// Used for emitting events when V5 diagnostic completes

import type { V5DiagnosticOutput } from './websiteLabV5';

export type WebsiteLabV5CompletedPayload = {
  companyId: string;
  runId: string;
  v5Score: number;
  blockingIssueCount: number;
  quickWinCount: number;
  structuralChangeCount: number;
  pagesAnalyzed: string[];
  personaFailureCounts: {
    first_time: number;
    ready_to_buy: number;
    comparison_shopper: number;
  };
  completedAt: string;
};

/**
 * Build the payload for website_lab.v5.completed event
 */
export function buildV5CompletedPayload(
  companyId: string,
  runId: string,
  v5Diagnostic: V5DiagnosticOutput,
  pagesAnalyzed: string[]
): WebsiteLabV5CompletedPayload {
  // Count persona failures
  const personaFailureCounts = {
    first_time: 0,
    ready_to_buy: 0,
    comparison_shopper: 0,
  };

  for (const journey of v5Diagnostic.personaJourneys) {
    if (!journey.succeeded) {
      personaFailureCounts[journey.persona]++;
    }
  }

  return {
    companyId,
    runId,
    v5Score: v5Diagnostic.score,
    blockingIssueCount: v5Diagnostic.blockingIssues.length,
    quickWinCount: v5Diagnostic.quickWins?.length ?? 0,
    structuralChangeCount: v5Diagnostic.structuralChanges?.length ?? 0,
    pagesAnalyzed,
    personaFailureCounts,
    completedAt: new Date().toISOString(),
  };
}
