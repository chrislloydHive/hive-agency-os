// lib/contextGraph/importers/gapImporter.ts
// GAP Importer - imports data from GAP-IA and GAP-Full runs into Context Graph
//
// DOMAIN AUTHORITY:
// - GAP is an orchestrator/synthesis layer
// - GAP may ONLY write to: identity (until Identity Lab exists), objectives, meta
// - GAP must NOT write to: brand, seo, content, website, audience, productOffer
//   (those are Lab domains with their own canonical authorities)
//
// Maps GAP diagnostic data to context graph fields:
// - Identity: businessName, industry (ALLOWED - no Identity Lab yet)
// - Objectives: primaryBusinessGoal, kpiLabels (ALLOWED - orchestration)
// - Meta fields: gapRunId, etc. (ALLOWED)
//
// BLOCKED from writing:
// - Brand, Website, Content, SEO, Audience, ProductOffer (Lab domains)

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import { setField, setDomainFields, createProvenance } from '../mutate';
import type { GapIaRun, CoreMarketingContext } from '@/lib/gap/types';

/**
 * GAP Importer
 *
 * Imports historical GAP-IA run data into the context graph.
 * Uses the most recent completed run for each company.
 */
export const gapImporter: DomainImporter = {
  id: 'gap',
  label: 'GAP Diagnostics',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      console.log('[gapImporter] Checking support for:', { companyId, domain });
      const runs = await getGapIaRunsForCompanyOrDomain(companyId, domain, 5);
      console.log('[gapImporter] Found runs:', runs.length);
      if (runs.length > 0) {
        console.log('[gapImporter] Run details:', runs.map(r => ({
          id: r.id,
          status: r.status,
          domain: r.domain,
          companyId: r.companyId,
        })));
      }
      const hasCompleted = runs.length > 0 && runs.some(r => r.status === 'completed' || r.status === 'complete');
      console.log('[gapImporter] Has completed runs:', hasCompleted);
      return hasCompleted;
    } catch (error) {
      console.warn('[gapImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      // Fetch the most recent completed GAP-IA runs
      const runs = await getGapIaRunsForCompanyOrDomain(companyId, domain, 5);
      const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'complete');

      if (completedRuns.length === 0) {
        result.errors.push('No completed GAP runs found');
        return result;
      }

      // Use the most recent completed run
      const latestRun = completedRuns[0];
      result.sourceRunIds.push(latestRun.id);

      // Create provenance for GAP-IA source
      const provenance = createProvenance('gap_ia', {
        confidence: 0.85,
        runId: latestRun.id,
        validForDays: 60,
      });

      // Import from core marketing context
      if (latestRun.core) {
        const coreImport = importFromCoreContext(graph, latestRun.core, provenance);
        result.fieldsUpdated += coreImport.count;
        result.updatedPaths.push(...coreImport.paths);
      }

      // Import from V2 dimensions if available
      if (latestRun.dimensions) {
        const dimensionsImport = importFromDimensions(graph, latestRun, provenance);
        result.fieldsUpdated += dimensionsImport.count;
        result.updatedPaths.push(...dimensionsImport.paths);
      }

      // Import from V2 summary if available
      if (latestRun.summary) {
        const summaryImport = importFromSummary(graph, latestRun.summary, provenance);
        result.fieldsUpdated += summaryImport.count;
        result.updatedPaths.push(...summaryImport.paths);
      }

      // Import from insights (legacy)
      if (latestRun.insights) {
        const insightsImport = importFromInsights(graph, latestRun.insights, provenance);
        result.fieldsUpdated += insightsImport.count;
        result.updatedPaths.push(...insightsImport.paths);
      }

      result.success = true;
      console.log(`[gapImporter] Imported ${result.fieldsUpdated} fields from GAP run ${latestRun.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[gapImporter] Import error:', error);
    }

    return result;
  },
};

/**
 * Import data from CoreMarketingContext
 *
 * DOMAIN AUTHORITY: GAP can only write to identity and objectives
 * Brand, Website, Content, SEO, Audience, ProductOffer are Lab domains
 */
function importFromCoreContext(
  graph: CompanyContextGraph,
  core: CoreMarketingContext,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // =========================================================================
  // IDENTITY DOMAIN - GAP is allowed (no Identity Lab yet)
  // =========================================================================

  if (core.businessName) {
    setField(graph, 'identity', 'businessName', core.businessName, provenance);
    paths.push('identity.businessName');
    count++;
  }

  if (core.industry) {
    setField(graph, 'identity', 'industry', core.industry, provenance);
    paths.push('identity.industry');
    count++;
  }

  if (core.geography) {
    setField(graph, 'identity', 'geographicFootprint', core.geography, provenance);
    paths.push('identity.geographicFootprint');
    count++;
  }

  // =========================================================================
  // OBJECTIVES DOMAIN - GAP is allowed (orchestration)
  // =========================================================================

  // Quick summary can go into objectives as primary business goal
  if (core.quickSummary) {
    setField(graph, 'objectives', 'primaryBusinessGoal', core.quickSummary, provenance);
    paths.push('objectives.primaryBusinessGoal');
    count++;
  }

  // =========================================================================
  // LAB DOMAINS - GAP BLOCKED (domain authority enforced)
  // Brand, Website, Content, SEO, Audience, ProductOffer
  // These fields are intentionally NOT written by GAP
  // The domain authority gate in mutate.ts will block anyway
  // =========================================================================

  // NOTE: brand, website, content, seo, audience, productOffer
  // writes have been removed - these are Lab domains

  return { count, paths };
}

/**
 * Import data from V2 dimensions
 *
 * DOMAIN AUTHORITY: GAP dimensions are UI-only, NOT imported to context
 * All dimension data (brand, content, seo, website) are Lab domains
 */
function importFromDimensions(
  _graph: CompanyContextGraph,
  _run: GapIaRun,
  _provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  // DOMAIN AUTHORITY: GAP dimensions should NOT be written to context
  // Brand, Content, SEO, Website are Lab domains
  // Dimensions are UI-only for GAP report display
  return { count: 0, paths: [] };
}

/**
 * Import data from V2 summary
 *
 * DOMAIN AUTHORITY: GAP can write to objectives (orchestration)
 */
function importFromSummary(
  graph: CompanyContextGraph,
  summary: NonNullable<GapIaRun['summary']>,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Top opportunities go to objectives - store as KPI labels as a proxy
  // ALLOWED: objectives is an orchestration domain
  if (summary.topOpportunities && summary.topOpportunities.length > 0) {
    setDomainFields(graph, 'objectives', {
      kpiLabels: summary.topOpportunities,
    }, provenance);
    paths.push('objectives.kpiLabels');
    count++;
  }

  // Headline diagnosis can inform primary business goal
  // ALLOWED: objectives is an orchestration domain
  if (summary.narrative) {
    setField(graph, 'objectives', 'primaryBusinessGoal', summary.narrative, provenance);
    paths.push('objectives.primaryBusinessGoal');
    count++;
  }

  return { count, paths };
}

/**
 * Import data from legacy insights
 *
 * DOMAIN AUTHORITY: GAP can only write to objectives
 * Brand, Website, Content, SEO insights are Lab domains - NOT written
 */
function importFromInsights(
  graph: CompanyContextGraph,
  insights: NonNullable<GapIaRun['insights']>,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // =========================================================================
  // LAB DOMAINS - GAP BLOCKED (domain authority enforced)
  // Brand, Website, Content, SEO insights are NOT written to context
  // These are Lab domains with their own canonical authorities
  // =========================================================================

  // NOTE: brandInsights, websiteInsights, contentInsights, seoInsights
  // writes have been removed - these are Lab domains

  // =========================================================================
  // OBJECTIVES DOMAIN - GAP is allowed (orchestration)
  // =========================================================================

  // Overall summary goes to objectives
  if (insights.overallSummary && !graph.objectives?.primaryBusinessGoal?.value) {
    setField(graph, 'objectives', 'primaryBusinessGoal', insights.overallSummary, provenance);
    paths.push('objectives.primaryBusinessGoal');
    count++;
  }

  return { count, paths };
}

export default gapImporter;
