// lib/inngest/functions/website-diagnostic.ts
// Website Diagnostic Engine - Inngest Multi-Step Function
//
// This replaces synchronous Website Lab execution with an async, resumable pipeline.
// Each step stores partial results in the database and can be retried independently.

import { inngest } from '../client';
import { NonRetriableError } from 'inngest';
import { getCompanyById } from '@/lib/airtable/companies';
import { createHeavyGapRun, updateHeavyGapRunState, getHeavyGapRunById } from '@/lib/airtable/gapHeavyRuns';
import {
  discoverSiteGraph,
  fetchPagesHTML,
  analyzePage,
  discoverPages,
  extractPageEvidence,
  buildSiteGraph,
  classifyPageIntents,
  evaluateHeuristics,
  simulatePersonas,
  runWebsiteLab,
} from '@/lib/gap-heavy/modules/websiteLabImpl';
import type { WebsiteUXAssessmentV4 } from '@/lib/gap-heavy/modules/websiteLab';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import { buildWebsiteActionPlan } from '@/lib/gap-heavy/modules/websiteActionPlanBuilder';
import { runV5Diagnostic } from '@/lib/gap-heavy/modules/websiteLabV5';
import {
  buildV5CompletedPayload,
  type WebsiteLabV5CompletedPayload,
} from '@/lib/gap-heavy/modules/websiteLabEvents';

// ============================================================================
// EVENT TYPES
// ============================================================================

type WebsiteDiagnosticStartEvent = {
  name: 'website.diagnostic.start';
  data: {
    companyId: string;
    websiteUrl: string;
    runId?: string; // Optional: existing run to update
  };
};

type WebsiteDiagnosticUpdatedEvent = {
  name: 'website.diagnostic.updated';
  data: {
    companyId: string;
    runId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    currentStep?: string;
    percent?: number;
    error?: string;
  };
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export const websiteDiagnostic = inngest.createFunction(
  {
    id: 'website-diagnostic',
    name: 'Website Diagnostic Pipeline',
    retries: 2,
  },
  { event: 'website.diagnostic.start' },
  async ({ event, step }) => {
    const { companyId, websiteUrl, runId: existingRunId } = event.data;

    console.log('[WebsiteDiagnostic] Starting pipeline', { companyId, websiteUrl });

    // ========================================================================
    // STEP 0: Initialize Run Record
    // ========================================================================
    const runId = await step.run('initialize-run', async () => {
      console.log('[WebsiteDiagnostic] Initializing run record...');

      // Verify company exists
      const company = await getCompanyById(companyId);
      if (!company) {
        throw new NonRetriableError(`Company ${companyId} not found`);
      }

      // Create or update Heavy Run record
      let id = existingRunId;
      if (!id) {
        // Extract domain from URL
        const urlObj = new URL(websiteUrl);
        const domain = urlObj.hostname.replace(/^www\./, '');

        id = await createHeavyGapRun({
          gapPlanRunId: '', // Will be set later if GAP plan is created
          companyId,
          url: websiteUrl,
          domain,
        });
        const currentRun = await getHeavyGapRunById(id);
        if (currentRun) {
          await updateHeavyGapRunState({
            ...currentRun,
            status: 'running',
          });
        }
      } else {
        const currentRun = await getHeavyGapRunById(id);
        if (currentRun) {
          await updateHeavyGapRunState({
            ...currentRun,
            status: 'running',
          });
        }
      }

      // Emit status update event
      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId: id,
          status: 'running',
          currentStep: 'initialize',
          percent: 0,
        },
      });

      return id;
    });

    // ========================================================================
    // STEP 1: Discover Pages (V4.2 - Multi-page discovery)
    // ========================================================================
    const pages = await step.run('discover-pages', async () => {
      console.log('[WebsiteDiagnostic] Step 1/8: Discovering pages with priority scoring...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'discover-pages',
          percent: 12,
        },
      });

      // Phase 1a: Discover pages with priority scoring (lightweight)
      const discoveredPages = await discoverSiteGraph(websiteUrl, 30);
      console.log(`[WebsiteDiagnostic] ✓ Discovered ${discoveredPages.length} pages with priority scores`);

      // Phase 1b: Fetch HTML for discovered pages in batches
      const pageSnapshots = await fetchPagesHTML(discoveredPages, 5);
      console.log(`[WebsiteDiagnostic] ✓ Fetched HTML for ${pageSnapshots.length}/${discoveredPages.length} pages`);

      // Calculate type distribution for logging
      const typeStats = pageSnapshots.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('[WebsiteDiagnostic] Page type distribution:', typeStats);

      // Store partial result
      const currentRun = await getHeavyGapRunById(runId);
      if (currentRun) {
        await updateHeavyGapRunState({
          ...currentRun,
          evidencePack: {
            ...currentRun.evidencePack,
            websiteLabV4: {
              ...(currentRun.evidencePack?.websiteLabV4 || {}),
              _partial: {
                pagesDiscovered: pageSnapshots.length,
                pageUrls: pageSnapshots.map((p) => p.url),
                typeDistribution: typeStats,
              },
            },
            modules: currentRun.evidencePack?.modules || [],
          },
        });
      }

      return pageSnapshots;
    });

    // ========================================================================
    // STEP 2: Extract Page Evidence (V4.2 - Batch processing)
    // ========================================================================
    const pageEvidences = await step.run('extract-evidence', async () => {
      console.log('[WebsiteDiagnostic] Step 2/8: Extracting evidence per page (batch processing)...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'extract-evidence',
          percent: 25,
        },
      });

      // Process pages in batches for better performance
      const batchSize = 8; // Process 8 pages at a time
      const evidences = [];

      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        console.log(`[WebsiteDiagnostic] Processing evidence batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pages.length / batchSize)} (${batch.length} pages)`);

        // Process batch in parallel
        const batchEvidences = await Promise.all(
          batch.map(snapshot => analyzePage(snapshot))
        );

        evidences.push(...batchEvidences);

        // Log progress
        console.log(`[WebsiteDiagnostic] ✓ Processed ${evidences.length}/${pages.length} pages`);
      }

      console.log(`[WebsiteDiagnostic] ✓ Extracted evidence for ${evidences.length} pages`);
      return evidences;
    });

    // ========================================================================
    // STEP 3: Build Site Graph
    // ========================================================================
    const siteGraph = await step.run('build-site-graph', async () => {
      console.log('[WebsiteDiagnostic] Step 3/8: Building site graph...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'build-site-graph',
          percent: 37,
        },
      });

      const graph = buildSiteGraph(pageEvidences);
      console.log(
        `[WebsiteDiagnostic] ✓ Built site graph: ${graph.pages.length} pages, ${graph.edges.length} edges`
      );
      return graph;
    });

    // ========================================================================
    // STEP 4: Classify Page Intents
    // ========================================================================
    await step.run('classify-intents', async () => {
      console.log('[WebsiteDiagnostic] Step 4/8: Classifying page intents...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'classify-intents',
          percent: 50,
        },
      });

      const intentMap = await classifyPageIntents(pageEvidences);

      // Attach intent to pages
      for (const page of siteGraph.pages) {
        const intent = intentMap.get(page.path);
        if (intent) {
          page.pageIntent = intent;
          // Assign funnel stage based on intent
          if (intent.primaryIntent === 'explore') page.funnelStage = 'awareness';
          else if (intent.primaryIntent === 'educate') page.funnelStage = 'consideration';
          else if (intent.primaryIntent === 'convert') page.funnelStage = 'decision';
          else if (intent.primaryIntent === 'validate') page.funnelStage = 'consideration';
          else if (intent.primaryIntent === 'compare') page.funnelStage = 'consideration';
          else page.funnelStage = 'none';
        }
      }

      console.log(`[WebsiteDiagnostic] ✓ Classified intents for ${intentMap.size} pages`);
    });

    // ========================================================================
    // STEP 5: Run Heuristic Evaluation
    // ========================================================================
    const heuristics = await step.run('evaluate-heuristics', async () => {
      console.log('[WebsiteDiagnostic] Step 5/8: Running heuristic UX evaluation...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'evaluate-heuristics',
          percent: 62,
        },
      });

      const result = evaluateHeuristics(siteGraph);
      console.log(`[WebsiteDiagnostic] ✓ Heuristic evaluation: ${result.findings.length} findings`);
      return result;
    });

    // ========================================================================
    // STEP 5.5: Run V5 Strict Diagnostic (MANDATORY)
    // ========================================================================
    // ARCHITECTURAL NOTE:
    // V5 is MANDATORY. If V5 fails, the entire pipeline fails.
    // This ensures outputs always include v5Diagnostic with specific,
    // page-anchored issues rather than generic V4 phrases.
    // Event emission happens LATER, after results are persisted (Step 10).
    const v5Diagnostic = await step.run('run-v5-diagnostic', async () => {
      console.log('[WebsiteDiagnostic] Step 5.5: Running V5 strict diagnostic (MANDATORY)...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'v5-diagnostic',
          percent: 68,
        },
      });

      // V5 is MANDATORY - no try/catch, failures propagate
      const result = await runV5Diagnostic(siteGraph, heuristics);

      // HARD ASSERTION: V5 must produce valid output
      if (!result || !result.observations || !result.blockingIssues) {
        throw new NonRetriableError('[WebsiteDiagnostic] ASSERTION FAILED: V5 diagnostic returned invalid structure. v5Diagnostic must exist with observations and blockingIssues.');
      }

      console.log(`[WebsiteDiagnostic] ✓ V5 diagnostic complete: score=${result.score}/100`);
      console.log(`[WebsiteDiagnostic]   - Blocking issues: ${result.blockingIssues.length}`);
      console.log(`[WebsiteDiagnostic]   - Quick wins: ${result.quickWins.length}`);
      console.log(`[WebsiteDiagnostic]   - Structural changes: ${result.structuralChanges.length}`);
      return result;
    });

    // ========================================================================
    // STEP 6: Simulate Personas
    // ========================================================================
    const personas = await step.run('simulate-personas', async () => {
      console.log('[WebsiteDiagnostic] Step 6/8: Simulating persona behaviors...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'simulate-personas',
          percent: 75,
        },
      });

      const result = await simulatePersonas(siteGraph);
      console.log(`[WebsiteDiagnostic] ✓ Simulated ${result.length} personas`);
      return result;
    });

    // ========================================================================
    // STEP 7: Run Intelligence Engines & Generate Assessment
    // ========================================================================
    const labResult = await step.run('run-intelligence-engines', async () => {
      console.log('[WebsiteDiagnostic] Step 7/8: Running intelligence engines...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'intelligence-engines',
          percent: 87,
        },
      });

      // Import Phase 1 engines
      const {
        analyzeCtaIntelligence,
        analyzeContentIntelligence,
        analyzeTrustSignals,
        analyzeVisualBrand,
        buildImpactMatrix,
        analyzeScentTrail,
        generateStrategistViews,
        enhancePersonas,
        getAnalyticsIntegrations,
      } = await import('@/lib/gap-heavy/modules/websiteLabEngines');

      // Run all intelligence engines
      const ctaIntelligence = analyzeCtaIntelligence(siteGraph);
      const contentIntelligence = analyzeContentIntelligence(siteGraph);
      const trustAnalysis = analyzeTrustSignals(siteGraph);
      const visualBrandEvaluation = analyzeVisualBrand(siteGraph);
      const scentTrailAnalysis = analyzeScentTrail(siteGraph);

      // Generate strategist views
      const strategistViews = await generateStrategistViews(
        siteGraph,
        ctaIntelligence,
        contentIntelligence,
        trustAnalysis
      );

      // Enhance personas
      const enhancedPersonas = enhancePersonas(personas, siteGraph);

      // Get analytics integrations (stub for now)
      const analyticsIntegrations = await getAnalyticsIntegrations({});

      // Build siteAssessment directly from V5 (NO V4 scoring)
      // V5 is the ONLY canonical implementation
      const benchmarkLabel: 'elite' | 'strong' | 'average' | 'weak' =
        v5Diagnostic.score >= 90 ? 'elite' :
        v5Diagnostic.score >= 80 ? 'strong' :
        v5Diagnostic.score >= 60 ? 'average' : 'weak';

      const siteAssessment: WebsiteUXAssessmentV4 = {
        // V3 required fields
        score: v5Diagnostic.score,
        summary: `${v5Diagnostic.score >= 80 ? 'STRONG' : v5Diagnostic.score >= 50 ? 'MIXED' : 'WEAK'} - ${v5Diagnostic.scoreJustification}`,
        strategistView: v5Diagnostic.scoreJustification,
        sectionScores: {
          hierarchy: v5Diagnostic.score,
          clarity: v5Diagnostic.score,
          trust: v5Diagnostic.score,
          navigation: v5Diagnostic.score,
          conversion: v5Diagnostic.score,
          visualDesign: v5Diagnostic.score,
          mobile: v5Diagnostic.score,
          intentAlignment: v5Diagnostic.score,
        },
        issues: v5Diagnostic.blockingIssues.map(issue => ({
          id: `v5-issue-${issue.id}`,
          severity: issue.severity,
          tag: `Blocking Issue #${issue.id}`,
          description: issue.whyItBlocks,
          evidence: `Page: ${issue.page} | Fix: ${issue.concreteFix.what} at ${issue.concreteFix.where}`,
        })),
        recommendations: v5Diagnostic.quickWins.map((win, idx) => ({
          id: `v5-quickwin-${idx + 1}`,
          priority: 'now' as const,
          tag: win.title,
          description: win.action,
          evidence: `Page: ${win.page} | Expected impact: ${win.expectedImpact}`,
        })),
        workItems: v5Diagnostic.quickWins.map((win, idx) => ({
          id: `v5-work-${idx + 1}`,
          title: win.title,
          description: win.action,
          priority: 'P1' as const,
          reason: win.expectedImpact,
        })),
        // V4 required fields
        pageLevelScores: siteGraph.pages.slice(0, 10).map(page => {
          const obs = v5Diagnostic.observations.find(o => o.pagePath === page.path);
          return {
            path: page.path,
            type: page.type,
            score: v5Diagnostic.score,
            strengths: obs?.primaryCTAs?.map(c => `CTA: ${c.text}`) || [],
            weaknesses: obs?.missingUnclearElements || [],
          };
        }),
        funnelHealthScore: Math.round(
          (v5Diagnostic.personaJourneys.filter(j => j.succeeded).length / v5Diagnostic.personaJourneys.length) * 100
        ),
        multiPageConsistencyScore: v5Diagnostic.score,
        benchmarkLabel,
        // V4 optional fields (from V5)
        executiveSummary: v5Diagnostic.scoreJustification,
        keyIssues: v5Diagnostic.blockingIssues
          .filter(i => i.severity === 'high')
          .map(i => `${i.page}: ${i.whyItBlocks}`),
        quickWins: v5Diagnostic.quickWins.map(w => ({
          title: w.title,
          description: `${w.action} (Page: ${w.page})`,
          impact: 'high' as const,
          effort: 'low' as const,
          dimensions: ['conversion_flow' as const],
        })),
      };

      // Build impact matrix
      const impactMatrix = buildImpactMatrix(
        siteGraph,
        siteAssessment.issues || [],
        siteAssessment.recommendations || [],
        ctaIntelligence,
        contentIntelligence,
        trustAnalysis
      );

      // Assemble complete lab result
      const complete: WebsiteUXLabResultV4 = {
        siteGraph,
        personas: enhancedPersonas,
        heuristics,
        siteAssessment,
        ctaIntelligence,
        contentIntelligence,
        trustAnalysis,
        visualBrandEvaluation,
        impactMatrix,
        scentTrailAnalysis,
        strategistViews,
        analyticsIntegrations,
        // V5 Strict Diagnostic (MANDATORY - guaranteed to exist from Step 5.5)
        v5Diagnostic: {
          observations: v5Diagnostic.observations,
          personaJourneys: v5Diagnostic.personaJourneys,
          blockingIssues: v5Diagnostic.blockingIssues,
          quickWins: v5Diagnostic.quickWins,
          structuralChanges: v5Diagnostic.structuralChanges,
          score: v5Diagnostic.score,
          scoreJustification: v5Diagnostic.scoreJustification,
        },
      };

      console.log('[WebsiteDiagnostic] ✓ Intelligence engines complete');
      return complete;
    });

    // ========================================================================
    // STEP 8: Build Action Plan
    // ========================================================================
    const actionPlan = await step.run('build-action-plan', async () => {
      console.log('[WebsiteDiagnostic] Step 8/9: Building action plan...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'build-action-plan',
          percent: 90,
        },
      });

      const plan = buildWebsiteActionPlan(labResult);
      console.log('[WebsiteDiagnostic] ✓ Action plan built');
      console.log(`  - ${plan.now.length} items in NOW bucket`);
      console.log(`  - ${plan.next.length} items in NEXT bucket`);
      console.log(`  - ${plan.later.length} items in LATER bucket`);
      return plan;
    });

    // ========================================================================
    // STEP 9: Mark Narrative as Pending Generation
    // ========================================================================
    // Note: We don't generate the narrative during the diagnostic pipeline anymore
    // because it's too large to store in Airtable (3,000-6,000+ words).
    // Instead, it's generated on-demand via the API when accessed.
    const narrativeMetadata = await step.run('mark-narrative-pending', async () => {
      console.log('[WebsiteDiagnostic] Step 9/9: Marking narrative as pending generation...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'mark-narrative-pending',
          percent: 95,
        },
      });

      // Return metadata indicating narrative can be generated
      const metadata = {
        _canGenerate: true,
        _overallScore: labResult.siteAssessment.score,
        _hasActionPlan: !!actionPlan,
      };

      console.log('[WebsiteDiagnostic] ✓ Narrative marked as available for generation');
      return metadata;
    });

    // ========================================================================
    // STEP 10: Persist Results
    // ========================================================================
    await step.run('persist-results', async () => {
      console.log('[WebsiteDiagnostic] Persisting final results...');

      await inngest.send({
        name: 'website.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'persist-results',
          percent: 98,
        },
      });

      // Update Heavy Run with complete results
      const currentRun = await getHeavyGapRunById(runId);
      if (currentRun) {
        await updateHeavyGapRunState({
          ...currentRun,
          status: 'completed',
          updatedAt: new Date().toISOString(),
          evidencePack: {
            websiteLabV4: labResult,
            websiteActionPlan: actionPlan,
            websiteNarrative: narrativeMetadata, // Store metadata only, not full report
            modules: [
              {
                module: 'website',
                status: 'completed',
                score: labResult.siteAssessment.score,
              },
            ],
          },
        });
      }

      console.log('[WebsiteDiagnostic] ✓ Results persisted');
      console.log('[WebsiteDiagnostic] ✓ Narrative available for on-demand generation');
    });

    // ========================================================================
    // STEP 11: Emit V5 Completed Event (Idempotent)
    // ========================================================================
    // ARCHITECTURAL NOTE:
    // Event emission with idempotency check via HeavyGapRun metadata.
    // Uses eventsEmitted.websiteLabV5CompletedAt as the marker.
    // This ensures the event is emitted exactly once, even on retry.
    // V5 is MANDATORY - if we reach here, v5Diagnostic is guaranteed to exist.
    await step.run('emit-v5-completed-event', async () => {
      // Idempotency check: fetch current run state
      const currentRun = await getHeavyGapRunById(runId);
      const existingMetadata = (currentRun?.evidencePack || {}) as Record<string, unknown>;
      const eventsEmitted = (existingMetadata._eventsEmitted || {}) as Record<string, unknown>;

      if (eventsEmitted.websiteLabV5CompletedAt) {
        console.log('[WebsiteDiagnostic] website_lab.v5.completed SKIPPED (already emitted)', {
          runId,
          emittedAt: eventsEmitted.websiteLabV5CompletedAt,
        });
        return;
      }

      console.log('[WebsiteDiagnostic] Emitting website_lab.v5.completed event...');

      // Build minimal payload (no raw data, only metrics)
      const pagesAnalyzed = siteGraph.pages.map(p => p.path);
      const payload = buildV5CompletedPayload(
        companyId,
        runId,
        v5Diagnostic,
        pagesAnalyzed
      );

      // Emit the canonical event
      await inngest.send({
        name: 'website_lab.v5.completed',
        data: payload,
      });

      console.log('[WebsiteDiagnostic] website_lab.v5.completed EMITTED', {
        runId,
        v5Score: payload.v5Score,
        blockingIssueCount: payload.blockingIssueCount,
        pagesAnalyzed: payload.pagesAnalyzed.length,
      });

      // Mark as emitted (idempotency marker)
      if (currentRun) {
        const existingPack = currentRun.evidencePack || { modules: [] };
        await updateHeavyGapRunState({
          ...currentRun,
          evidencePack: {
            ...existingPack,
            _eventsEmitted: {
              ...eventsEmitted,
              websiteLabV5CompletedAt: new Date().toISOString(),
            },
          },
        });
        console.log('[WebsiteDiagnostic] Idempotency marker set for run:', runId);
      }
    });

    // ========================================================================
    // FINAL: Emit Completion Event
    // ========================================================================
    await inngest.send({
      name: 'website.diagnostic.updated',
      data: {
        companyId,
        runId,
        status: 'completed',
        percent: 100,
      },
    });

    console.log('[WebsiteDiagnostic] ============================================');
    console.log('[WebsiteDiagnostic] DIAGNOSTIC PIPELINE COMPLETE');
    console.log(`[WebsiteDiagnostic] Score: ${labResult.siteAssessment.score}/100`);
    console.log(`[WebsiteDiagnostic] Action items: ${actionPlan.now.length + actionPlan.next.length + actionPlan.later.length}`);
    console.log('[WebsiteDiagnostic] ============================================');

    return {
      runId,
      companyId,
      score: labResult.siteAssessment.score,
      actionItems: actionPlan.now.length + actionPlan.next.length + actionPlan.later.length,
    };
  }
);

// ============================================================================
// ERROR HANDLER
// ============================================================================

export const websiteDiagnosticErrorHandler = inngest.createFunction(
  {
    id: 'website-diagnostic-error-handler',
    name: 'Website Diagnostic Error Handler',
  },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    // Only handle failures from website-diagnostic function
    if (event.data.function_id !== 'website-diagnostic') {
      return;
    }

    const { companyId, runId } = event.data.event.data;
    const error = event.data.error;

    console.error('[WebsiteDiagnostic] Function failed:', error);

    // Update run record with error
    if (runId) {
      const currentRun = await getHeavyGapRunById(runId);
      if (currentRun) {
        await updateHeavyGapRunState({
          ...currentRun,
          status: 'error',
          errorMessage: String(error),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Emit failure event
    await inngest.send({
      name: 'website.diagnostic.updated',
      data: {
        companyId,
        runId,
        status: 'failed',
        error: String(error),
      },
    });
  }
);
