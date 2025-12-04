// lib/contextGraph/importers/gapImporter.ts
// GAP Importer - imports data from GAP-IA and GAP-Full runs into Context Graph
//
// Maps GAP diagnostic data to context graph fields:
// - Identity: businessName, industry, competitiveLandscape
// - Brand: positioning, toneOfVoice, brandStrengths, brandWeaknesses
// - Website: websiteScore, websiteSummary
// - Content: contentSummary, contentScore
// - SEO: seoScore, seoSummary

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
 */
function importFromCoreContext(
  graph: CompanyContextGraph,
  core: CoreMarketingContext,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Identity domain
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

  // Brand domain
  if (core.brand) {
    if (core.brand.perceivedPositioning) {
      setField(graph, 'brand', 'positioning', core.brand.perceivedPositioning, provenance);
      paths.push('brand.positioning');
      count++;
    }

    if (core.brand.toneOfVoice) {
      setField(graph, 'brand', 'toneOfVoice', core.brand.toneOfVoice, provenance);
      paths.push('brand.toneOfVoice');
      count++;
    }

    if (core.brand.brandScore !== undefined) {
      // Store as brand perception narrative
      const brandNarrative = `Brand score: ${core.brand.brandScore}/100. Visual consistency: ${core.brand.visualConsistency || 'unknown'}.`;
      setField(graph, 'brand', 'brandPerception', brandNarrative, provenance);
      paths.push('brand.brandPerception');
      count++;
    }
  }

  // Website domain
  if (core.website) {
    if (core.website.websiteScore !== undefined) {
      setField(graph, 'website', 'websiteScore', core.website.websiteScore, provenance);
      paths.push('website.websiteScore');
      count++;
    }

    if (core.website.clarityOfMessage) {
      const websiteSummary = `Message clarity: ${core.website.clarityOfMessage}. CTA quality: ${core.website.primaryCtaQuality || 'unknown'}. Friction: ${core.website.perceivedFriction || 'unknown'}.`;
      setField(graph, 'website', 'websiteSummary', websiteSummary, provenance);
      paths.push('website.websiteSummary');
      count++;
    }
  }

  // Content domain
  if (core.content) {
    if (core.content.contentScore !== undefined) {
      // Map content score to content domain
      const contentSummary = `Content score: ${core.content.contentScore}/100. Depth: ${core.content.contentDepth || 'unknown'}. Has blog: ${core.content.hasBlogOrResources ? 'yes' : 'no'}.`;
      setField(graph, 'content', 'contentSummary', contentSummary, provenance);
      paths.push('content.contentSummary');
      count++;
    }
  }

  // SEO domain
  if (core.seo) {
    if (core.seo.seoScore !== undefined) {
      setField(graph, 'seo', 'seoScore', core.seo.seoScore, provenance);
      paths.push('seo.seoScore');
      count++;
    }

    const seoNotes: string[] = [];
    if (core.seo.appearsIndexable !== null) {
      seoNotes.push(`Indexable: ${core.seo.appearsIndexable ? 'yes' : 'no'}`);
    }
    if (core.seo.onPageBasics) {
      seoNotes.push(`On-page basics: ${core.seo.onPageBasics}`);
    }
    if (core.seo.searchIntentFit) {
      seoNotes.push(`Search intent fit: ${core.seo.searchIntentFit}`);
    }
    if (seoNotes.length > 0) {
      setField(graph, 'seo', 'seoSummary', seoNotes.join('. '), provenance);
      paths.push('seo.seoSummary');
      count++;
    }
  }

  // Audience domain - primary audience
  if (core.primaryAudience) {
    setField(graph, 'audience', 'demographics', core.primaryAudience, provenance);
    paths.push('audience.demographics');
    count++;
  }

  // Product/Offer domain - primary offer
  if (core.primaryOffer) {
    setField(graph, 'productOffer', 'pricingNotes', core.primaryOffer, provenance);
    paths.push('productOffer.pricingNotes');
    count++;
  }

  // Quick summary can go into objectives as primary business goal
  if (core.quickSummary) {
    setField(graph, 'objectives', 'primaryBusinessGoal', core.quickSummary, provenance);
    paths.push('objectives.primaryBusinessGoal');
    count++;
  }

  return { count, paths };
}

/**
 * Import data from V2 dimensions
 */
function importFromDimensions(
  graph: CompanyContextGraph,
  run: GapIaRun,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;
  const dimensions = run.dimensions;

  if (!dimensions) return { count, paths };

  // Brand dimension
  if (dimensions.brand) {
    if (dimensions.brand.narrative) {
      setField(graph, 'brand', 'brandPerception', dimensions.brand.narrative, provenance);
      paths.push('brand.brandPerception');
      count++;
    }
    if (dimensions.brand.issues && dimensions.brand.issues.length > 0) {
      setDomainFields(graph, 'brand', {
        brandWeaknesses: dimensions.brand.issues,
      }, provenance);
      paths.push('brand.brandWeaknesses');
      count++;
    }
  }

  // Content dimension
  if (dimensions.content) {
    if (dimensions.content.narrative) {
      setField(graph, 'content', 'contentSummary', dimensions.content.narrative, provenance);
      paths.push('content.contentSummary');
      count++;
    }
  }

  // SEO dimension
  if (dimensions.seo) {
    if (dimensions.seo.narrative) {
      setField(graph, 'seo', 'seoSummary', dimensions.seo.narrative, provenance);
      paths.push('seo.seoSummary');
      count++;
    }
    if (dimensions.seo.score !== undefined) {
      setField(graph, 'seo', 'seoScore', dimensions.seo.score, provenance);
      paths.push('seo.seoScore');
      count++;
    }
  }

  // Website dimension
  if (dimensions.website) {
    if (dimensions.website.narrative) {
      setField(graph, 'website', 'websiteSummary', dimensions.website.narrative, provenance);
      paths.push('website.websiteSummary');
      count++;
    }
    if (dimensions.website.score !== undefined) {
      setField(graph, 'website', 'websiteScore', dimensions.website.score, provenance);
      paths.push('website.websiteScore');
      count++;
    }
    if (dimensions.website.issues && dimensions.website.issues.length > 0) {
      setDomainFields(graph, 'website', {
        criticalIssues: dimensions.website.issues,
      }, provenance);
      paths.push('website.criticalIssues');
      count++;
    }
  }

  return { count, paths };
}

/**
 * Import data from V2 summary
 */
function importFromSummary(
  graph: CompanyContextGraph,
  summary: NonNullable<GapIaRun['summary']>,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Top opportunities go to objectives - store as KPI labels as a proxy
  if (summary.topOpportunities && summary.topOpportunities.length > 0) {
    setDomainFields(graph, 'objectives', {
      kpiLabels: summary.topOpportunities,
    }, provenance);
    paths.push('objectives.kpiLabels');
    count++;
  }

  // Headline diagnosis can inform primary business goal
  if (summary.narrative) {
    setField(graph, 'objectives', 'primaryBusinessGoal', summary.narrative, provenance);
    paths.push('objectives.primaryBusinessGoal');
    count++;
  }

  return { count, paths };
}

/**
 * Import data from legacy insights
 */
function importFromInsights(
  graph: CompanyContextGraph,
  insights: NonNullable<GapIaRun['insights']>,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Brand insights
  if (insights.brandInsights && insights.brandInsights.length > 0) {
    // Use first insight as brand perception if not already set
    if (!graph.brand.brandPerception.value) {
      setField(graph, 'brand', 'brandPerception', insights.brandInsights.join(' '), provenance);
      paths.push('brand.brandPerception');
      count++;
    }
  }

  // Website insights
  if (insights.websiteInsights && insights.websiteInsights.length > 0) {
    setDomainFields(graph, 'website', {
      recommendations: insights.websiteInsights,
    }, provenance);
    paths.push('website.recommendations');
    count++;
  }

  // Content insights - store as content gaps
  if (insights.contentInsights && insights.contentInsights.length > 0) {
    setDomainFields(graph, 'content', {
      keyTopics: insights.contentInsights,
    }, provenance);
    paths.push('content.keyTopics');
    count++;
  }

  // SEO insights
  if (insights.seoInsights && insights.seoInsights.length > 0) {
    setDomainFields(graph, 'seo', {
      seoRecommendations: insights.seoInsights,
    }, provenance);
    paths.push('seo.seoRecommendations');
    count++;
  }

  // Overall summary goes to objectives
  if (insights.overallSummary && !graph.objectives.primaryBusinessGoal.value) {
    setField(graph, 'objectives', 'primaryBusinessGoal', insights.overallSummary, provenance);
    paths.push('objectives.primaryBusinessGoal');
    count++;
  }

  return { count, paths };
}

export default gapImporter;
