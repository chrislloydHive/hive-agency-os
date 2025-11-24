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
  generateSiteAssessment,
  runWebsiteLab,
} from '@/lib/gap-heavy/modules/websiteLabImpl';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import { buildWebsiteActionPlan } from '@/lib/gap-heavy/modules/websiteActionPlanBuilder';

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

      // Generate site assessment
      const siteAssessment = await generateSiteAssessment(siteGraph, personas, heuristics);

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
