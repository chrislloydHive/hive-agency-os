// lib/inngest/functions/website-lab-v5-handlers.ts
// Inngest Handlers for Website Lab V5 Completed Event
//
// ARCHITECTURAL BOUNDARY:
// These handlers subscribe to `website_lab.v5.completed` and run INDEPENDENTLY.
// They do NOT affect Website Lab execution.
// They do NOT recompute Lab results.
// They are idempotent and tolerate missing/partial data.
//
// Website Lab's responsibility ended when it emitted the event.
// These handlers are downstream consequences only.

import { inngest } from '../client';
import type { WebsiteLabV5CompletedPayload } from '@/lib/gap-heavy/modules/websiteLabEvents';

// ============================================================================
// JOB A: Context Graph Proposal (Guarded)
// ============================================================================
// Trigger: BlockingIssueCount ≥ 1 OR repeated persona failures
// Responsibilities:
// - Apply V5-specific ingestion guards
// - Dedupe against existing Context Graph nodes
// - Propose nodes to Review Queue (not auto-commit)
// - Attach provenance metadata (WebsiteLabV5, runId)

export const contextGraphProposeFromV5 = inngest.createFunction(
  {
    id: 'context-graph-propose-from-website-lab-v5',
    name: 'Context Graph: Propose from Website Lab V5',
    retries: 2,
  },
  { event: 'website_lab.v5.completed' },
  async ({ event, step }) => {
    const payload = event.data as WebsiteLabV5CompletedPayload;
    const { companyId, runId, blockingIssueCount, personaFailureCounts, v5Score } = payload;

    console.log('[ContextGraph.V5] Received website_lab.v5.completed', {
      companyId,
      runId,
      blockingIssueCount,
    });

    // ========================================================================
    // GUARD: Check if proposal is warranted
    // ========================================================================
    const shouldPropose = await step.run('check-proposal-guard', async () => {
      // Guard 1: At least one blocking issue
      if (blockingIssueCount >= 1) {
        console.log('[ContextGraph.V5] Guard passed: blockingIssueCount >= 1');
        return true;
      }

      // Guard 2: Multiple persona failures
      const totalFailures =
        personaFailureCounts.first_time +
        personaFailureCounts.ready_to_buy +
        personaFailureCounts.comparison_shopper;

      if (totalFailures >= 2) {
        console.log('[ContextGraph.V5] Guard passed: totalPersonaFailures >= 2');
        return true;
      }

      // Guard 3: Very low score
      if (v5Score < 40) {
        console.log('[ContextGraph.V5] Guard passed: v5Score < 40');
        return true;
      }

      console.log('[ContextGraph.V5] Guard NOT passed, skipping proposal');
      return false;
    });

    if (!shouldPropose) {
      return { status: 'skipped', reason: 'guard_not_passed' };
    }

    // ========================================================================
    // STEP 1: Fetch V5 Data from Storage
    // ========================================================================
    // We only have metrics in the event payload.
    // Full data must be fetched from storage if needed.
    const v5Data = await step.run('fetch-v5-data', async () => {
      // ARCHITECTURAL NOTE:
      // This handler does NOT call Website Lab.
      // It fetches persisted data from storage.
      const { getHeavyGapRunById } = await import('@/lib/airtable/gapHeavyRuns');
      const run = await getHeavyGapRunById(runId);

      if (!run?.evidencePack?.websiteLabV4?.v5Diagnostic) {
        console.warn('[ContextGraph.V5] V5 data not found in storage');
        return null;
      }

      return run.evidencePack.websiteLabV4.v5Diagnostic;
    });

    if (!v5Data) {
      return { status: 'skipped', reason: 'v5_data_not_found' };
    }

    // ========================================================================
    // STEP 2: Build Context Proposals
    // ========================================================================
    const proposals = await step.run('build-proposals', async () => {
      // ARCHITECTURAL NOTE:
      // These are PROPOSALS only, not direct writes.
      // They go to a Review Queue for human approval.
      // No LLM calls here - just data transformation.

      const proposalNodes: Array<{
        nodeType: string;
        key: string;
        value: string;
        provenance: {
          source: 'WebsiteLabV5';
          runId: string;
          confidence: number;
        };
      }> = [];

      // Propose nodes from blocking issues
      for (const issue of v5Data.blockingIssues) {
        proposalNodes.push({
          nodeType: 'website_issue',
          key: `blocking_issue_${issue.id}`,
          value: `[${issue.page}] ${issue.whyItBlocks}`,
          provenance: {
            source: 'WebsiteLabV5',
            runId,
            confidence: issue.severity === 'high' ? 0.9 : issue.severity === 'medium' ? 0.7 : 0.5,
          },
        });
      }

      // Propose nodes from persona failures
      for (const journey of v5Data.personaJourneys) {
        if (!journey.succeeded && journey.failurePoint) {
          proposalNodes.push({
            nodeType: 'persona_friction',
            key: `persona_failure_${journey.persona}`,
            value: `[${journey.failurePoint.page}] ${journey.failurePoint.reason}`,
            provenance: {
              source: 'WebsiteLabV5',
              runId,
              confidence: 1 - journey.confidenceScore, // Lower confidence = higher concern
            },
          });
        }
      }

      console.log(`[ContextGraph.V5] Built ${proposalNodes.length} proposal nodes`);
      return proposalNodes;
    });

    // ========================================================================
    // STEP 3: Submit to Review Queue
    // ========================================================================
    await step.run('submit-to-review-queue', async () => {
      // ARCHITECTURAL NOTE:
      // We submit to a review queue, not directly to Context Graph.
      // Human review is required before these become canonical.
      // This prevents noise from low-confidence signals.

      console.log(`[ContextGraph.V5] Submitting ${proposals.length} proposals to review queue`);

      // TODO: Implement actual review queue submission
      // For now, just log the proposals
      for (const proposal of proposals) {
        console.log('[ContextGraph.V5] Proposal:', {
          nodeType: proposal.nodeType,
          key: proposal.key,
          confidence: proposal.provenance.confidence,
        });
      }

      // In production, this would call:
      // await submitToContextReviewQueue(companyId, proposals);
    });

    console.log('[ContextGraph.V5] ✓ Proposal submission complete');

    return {
      status: 'completed',
      proposalCount: proposals.length,
      companyId,
      runId,
    };
  }
);

// ============================================================================
// JOB B: Aggregation / Benchmarks
// ============================================================================
// Responsibilities:
// - Aggregate anonymized patterns across runs
// - No mutation of company data
// - No Context Graph writes

export const insightsAggregateV5 = inngest.createFunction(
  {
    id: 'insights-aggregate-website-lab-v5',
    name: 'Insights: Aggregate Website Lab V5',
    retries: 1,
  },
  { event: 'website_lab.v5.completed' },
  async ({ event, step }) => {
    const payload = event.data as WebsiteLabV5CompletedPayload;
    const { v5Score, blockingIssueCount, structuralChangeCount, pagesAnalyzed } = payload;

    console.log('[Insights.V5] Received website_lab.v5.completed for aggregation');

    // ========================================================================
    // STEP 1: Record Anonymized Metrics
    // ========================================================================
    await step.run('record-metrics', async () => {
      // ARCHITECTURAL NOTE:
      // This is READ-ONLY aggregation.
      // No company data is mutated.
      // Metrics are anonymized for benchmarking.

      const metrics = {
        timestamp: payload.completedAt,
        score: v5Score,
        blockingIssues: blockingIssueCount,
        structuralChanges: structuralChangeCount,
        pagesCount: pagesAnalyzed.length,
        personaSuccessRate: calculatePersonaSuccessRate(payload.personaFailureCounts),
      };

      console.log('[Insights.V5] Recording anonymized metrics:', metrics);

      // TODO: In production, write to analytics/metrics store
      // await recordAnonymizedMetrics('website_lab_v5', metrics);
    });

    // ========================================================================
    // STEP 2: Update Benchmarks (if applicable)
    // ========================================================================
    await step.run('update-benchmarks', async () => {
      // ARCHITECTURAL NOTE:
      // Benchmarks are aggregate statistics, not company-specific.
      // They help contextualize future scores.

      console.log('[Insights.V5] Updating aggregate benchmarks (no-op for now)');

      // TODO: In production, update rolling benchmarks
      // await updateRollingBenchmark('website_lab_v5_score', v5Score);
    });

    return { status: 'completed' };
  }
);

// ============================================================================
// JOB C: Threshold Signals
// ============================================================================
// Trigger examples:
// - v5Score < defined threshold
// - Score delta exceeds threshold
// - StructuralChangeCount >= 2
// Responsibilities:
// - Emit internal alerts or flags
// - Do NOT create Work automatically

export const signalsV5ThresholdBreached = inngest.createFunction(
  {
    id: 'signals-website-lab-v5-threshold-breached',
    name: 'Signals: Website Lab V5 Threshold Breached',
    retries: 1,
  },
  { event: 'website_lab.v5.completed' },
  async ({ event, step }) => {
    const payload = event.data as WebsiteLabV5CompletedPayload;
    const { companyId, runId, v5Score, structuralChangeCount, blockingIssueCount } = payload;

    console.log('[Signals.V5] Checking thresholds for', { companyId, runId });

    // ========================================================================
    // THRESHOLD CHECKS
    // ========================================================================
    const signals = await step.run('check-thresholds', async () => {
      const triggeredSignals: Array<{
        type: string;
        severity: 'info' | 'warning' | 'critical';
        message: string;
      }> = [];

      // Threshold 1: Very low score
      if (v5Score < 30) {
        triggeredSignals.push({
          type: 'critical_score',
          severity: 'critical',
          message: `Website Lab V5 score critically low: ${v5Score}/100`,
        });
      } else if (v5Score < 50) {
        triggeredSignals.push({
          type: 'low_score',
          severity: 'warning',
          message: `Website Lab V5 score below threshold: ${v5Score}/100`,
        });
      }

      // Threshold 2: Multiple structural changes needed
      if (structuralChangeCount >= 2) {
        triggeredSignals.push({
          type: 'multiple_structural_changes',
          severity: 'warning',
          message: `${structuralChangeCount} structural changes recommended`,
        });
      }

      // Threshold 3: High blocking issue count
      if (blockingIssueCount >= 4) {
        triggeredSignals.push({
          type: 'high_blocking_issues',
          severity: 'critical',
          message: `${blockingIssueCount} blocking issues identified`,
        });
      } else if (blockingIssueCount >= 2) {
        triggeredSignals.push({
          type: 'moderate_blocking_issues',
          severity: 'warning',
          message: `${blockingIssueCount} blocking issues identified`,
        });
      }

      return triggeredSignals;
    });

    if (signals.length === 0) {
      console.log('[Signals.V5] No thresholds breached');
      return { status: 'completed', signalsTriggered: 0 };
    }

    // ========================================================================
    // EMIT INTERNAL SIGNALS (No Work Creation)
    // ========================================================================
    await step.run('emit-signals', async () => {
      // ARCHITECTURAL NOTE:
      // These are internal signals/alerts ONLY.
      // They do NOT create Work items automatically.
      // Human review is required for any action.

      console.log(`[Signals.V5] Emitting ${signals.length} signals`);

      for (const signal of signals) {
        console.log(`[Signals.V5] [${signal.severity.toUpperCase()}] ${signal.type}: ${signal.message}`);

        // Emit signal event for downstream monitoring
        await inngest.send({
          name: 'signals.internal.triggered',
          data: {
            source: 'website_lab.v5',
            companyId,
            runId,
            ...signal,
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    return {
      status: 'completed',
      signalsTriggered: signals.length,
      signals: signals.map(s => s.type),
    };
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePersonaSuccessRate(
  failures: WebsiteLabV5CompletedPayload['personaFailureCounts']
): number {
  const totalPersonas = 3; // first_time, ready_to_buy, comparison_shopper
  const totalFailures = failures.first_time + failures.ready_to_buy + failures.comparison_shopper;
  const successes = totalPersonas - totalFailures;
  return successes / totalPersonas;
}
