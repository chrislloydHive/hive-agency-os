// lib/inngest/functions/generate-full-gap.ts
// Background job for generating Full GAP from GAP-IA data

import { inngest } from '../client';
import { getGapIaRunById, updateGapIaRun } from '@/lib/airtable/gapIaRuns';
import { createRecord, updateRecord } from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { generateLightFullGapFromIa } from '@/lib/growth-plan/generateLightFullGapFromIa';
import { reviewFullGap } from '@/lib/growth-plan/reviewFullGap';
import { generateFullGapDraft } from '@/lib/gap/generateFullGapDraft';
import { refineFullGapReport } from '@/lib/gap/refineFullGap';
import type { GrowthAccelerationPlan } from '@/lib/growth-plan/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a GAP-Plan Run record
 */
async function createGapPlanRun(params: {
  companyId: string;
  gapIaRunId: string;
  url: string;
  domain: string;
}): Promise<string> {
  console.log('[inngest:generate-full-gap] Creating GAP-Plan Run');

  const fields: Record<string, unknown> = {
    URL: params.url,
    'Company ID': params.companyId,
    Status: 'processing',
  };

  const result = await createRecord(AIRTABLE_TABLES.GAP_PLAN_RUN, fields);

  if (!result?.id) {
    throw new Error('Failed to create GAP-Plan Run record');
  }

  console.log('[inngest:generate-full-gap] Created GAP-Plan Run:', result.id);
  return result.id;
}

/**
 * Create a GAP-Full Report record
 */
async function createGapFullReport(params: {
  companyId: string;
  gapIaRunId: string;
  gapPlanRunId: string;
  plan: GrowthAccelerationPlan;
}): Promise<string> {
  console.log('[inngest:generate-full-gap] Creating GAP-Full Report');

  const now = new Date().toISOString();

  const fields: Record<string, unknown> = {
    Name: `${params.plan.companyName || 'Company'} - Full Report`,
    Company: [params.companyId],
    'GAP-IA Run': [params.gapIaRunId],
    'GAP Plan Run': [params.gapPlanRunId],
    'Overall Score': params.plan.scorecard?.overall ?? 0,
    'Brand Score': params.plan.scorecard?.brand ?? 0,
    'Content Score': params.plan.scorecard?.content ?? 0,
    'Website Score': params.plan.scorecard?.website ?? 0,
    'SEO Score': params.plan.scorecard?.seo ?? 0,
    'Authority Score': params.plan.scorecard?.authority ?? 0,
    'Report JSON': JSON.stringify(params.plan),
    'Created At': now,
    'Updated At': now,
  };

  const result = await createRecord(AIRTABLE_TABLES.GAP_FULL_REPORT, fields);

  if (!result?.id) {
    throw new Error('Failed to create GAP-Full Report record');
  }

  console.log('[inngest:generate-full-gap] Created GAP-Full Report:', result.id);
  return result.id;
}

/**
 * Update GAP-Plan Run with completion status
 */
async function updateGapPlanRunComplete(
  gapPlanRunId: string,
  params: {
    gapFullReportId: string;
    overallScore?: number;
    brandScore?: number;
    contentScore?: number;
    websiteScore?: number;
    seoScore?: number;
    authorityScore?: number;
    maturityStage?: string;
  }
): Promise<void> {
  console.log('[inngest:generate-full-gap] Updating GAP-Plan Run to completed');

  const fields: Record<string, unknown> = {
    Status: 'completed',
  };

  if (params.overallScore !== undefined) fields['Overall Score'] = params.overallScore;
  if (params.brandScore !== undefined) fields['Brand Score'] = params.brandScore;
  if (params.contentScore !== undefined) fields['Content Score'] = params.contentScore;
  if (params.websiteScore !== undefined) fields['Website Score'] = params.websiteScore;
  if (params.seoScore !== undefined) fields['SEO Score'] = params.seoScore;
  if (params.authorityScore !== undefined) fields['Authority Score'] = params.authorityScore;
  if (params.maturityStage) fields['Maturity Stage'] = params.maturityStage;

  await updateRecord(AIRTABLE_TABLES.GAP_PLAN_RUN, gapPlanRunId, fields);
}

/**
 * Update GAP-Plan Run with error status
 */
async function updateGapPlanRunError(
  gapPlanRunId: string,
  errorMessage: string
): Promise<void> {
  console.log('[inngest:generate-full-gap] Updating GAP-Plan Run to error');

  const fields: Record<string, unknown> = {
    Status: 'error',
  };

  const dataJson = { error: errorMessage };
  fields['Data JSON'] = JSON.stringify(dataJson);

  await updateRecord(AIRTABLE_TABLES.GAP_PLAN_RUN, gapPlanRunId, fields);
}

// ============================================================================
// Inngest Function
// ============================================================================

export const generateFullGap = inngest.createFunction(
  {
    id: 'generate-full-gap',
    name: 'Generate Full GAP from GAP-IA',
    // No timeout - let it run as long as needed
  },
  { event: 'gap/generate-full' },
  async ({ event, step }) => {
    const { gapIaRunId } = event.data;

    console.log('[inngest:generate-full-gap] Starting generation for:', gapIaRunId);

    // Step 1: Load GAP-IA Run
    const gapIaRun = await step.run('load-gap-ia-run', async () => {
      const run = await getGapIaRunById(gapIaRunId);
      if (!run) {
        throw new Error(`GAP-IA Run not found: ${gapIaRunId}`);
      }
      if (!run.core) {
        throw new Error('GAP-IA Run does not have core marketing context data');
      }
      return run;
    });

    // Step 2: Find or create Company
    const { companyUUID, companyAirtableId } = await step.run('find-or-create-company', async () => {
      const { findOrCreateCompanyByDomain, getCompanyByCanonicalId } = await import('@/lib/airtable/companies');

      let companyUUID: string;
      let companyAirtableId: string;

      if (gapIaRun.companyId) {
        companyUUID = gapIaRun.companyId;
        const existingCompany = await getCompanyByCanonicalId(companyUUID);
        if (!existingCompany) {
          throw new Error(`Company with UUID ${companyUUID} not found in Airtable`);
        }
        companyAirtableId = existingCompany.airtableRecordId || '';
        if (!companyAirtableId) {
          throw new Error(`Company ${companyUUID} missing Airtable record ID`);
        }
      } else {
        const result = await findOrCreateCompanyByDomain(gapIaRun.url, {
          companyName: gapIaRun.core.businessName,
          source: 'Inbound',
          stage: 'Prospect',
        });
        companyUUID = result.companyId;
        companyAirtableId = result.companyRecord.airtableRecordId || '';

        if (!companyAirtableId) {
          throw new Error('Failed to get Airtable record ID for company');
        }

        await updateGapIaRun(gapIaRunId, { companyId: companyUUID });
      }

      console.log('[inngest:generate-full-gap] Company IDs:', { uuid: companyUUID, airtableId: companyAirtableId });

      return { companyUUID, companyAirtableId };
    });

    // Step 3: Create GAP-Plan Run
    const gapPlanRunId = await step.run('create-gap-plan-run', async () => {
      return await createGapPlanRun({
        companyId: companyAirtableId,
        gapIaRunId,
        url: gapIaRun.url,
        domain: gapIaRun.domain,
      });
    });

    // Step 4a: Log GAP-IA data structure
    await step.run('log-gap-ia-data', async () => {
      const dataStructure = {
        hasCore: !!gapIaRun.core,
        hasDimensions: !!(gapIaRun as any).dimensions,
        hasSummary: !!(gapIaRun as any).summary,
        hasBreakdown: !!(gapIaRun as any).breakdown,
        hasQuickWins: !!(gapIaRun as any).quickWins,
      };
      console.log('[inngest:generate-full-gap] GAP-IA data structure:', dataStructure);
      return dataStructure;
    });

    // Step 4b: Generate Full GAP Draft (light, fast LLM call)
    const draftMarkdown = await step.run('generate-full-gap-draft', async () => {
      console.log('[inngest:generate-full-gap] Generating Full GAP draft...');

      try {
        const draft = await generateFullGapDraft(gapIaRun);
        console.log('[inngest:generate-full-gap] Draft generated, length:', draft.length);
        return draft;
      } catch (error) {
        console.error('[inngest:generate-full-gap] Draft generation failed:', error);
        throw error;
      }
    });

    // Step 4c: Refine Full GAP (heavy, comprehensive LLM call)
    const refinedMarkdown = await step.run('refine-full-gap', async () => {
      console.log('[inngest:generate-full-gap] Refining Full GAP...');

      try {
        const refined = await refineFullGapReport({
          iaJson: gapIaRun,
          fullGapDraftMarkdown: draftMarkdown,
        });
        console.log('[inngest:generate-full-gap] Refinement complete, length:', refined.length);
        return refined;
      } catch (error) {
        console.error('[inngest:generate-full-gap] Refinement failed:', error);
        throw error;
      }
    });

    // Step 4d: Generate Light Full GAP for JSON structure (backward compatibility)
    const lightPlanDraft = await step.run('generate-light-gap-json', async () => {
      console.log('[inngest:generate-full-gap] Generating JSON structure...');

      try {
        const result = await generateLightFullGapFromIa(
          gapIaRun,
          gapIaRun.domain,
          gapIaRun.url
        );

        console.log('[inngest:generate-full-gap] JSON structure generated');
        return result;
      } catch (error) {
        console.error('[inngest:generate-full-gap] JSON generation failed:', error);
        throw error;
      }
    });

    // Step 4e: Internal Reviewer - Quality assurance pass
    const lightPlan = await step.run('review-light-gap-json', async () => {
      console.log('[inngest:generate-full-gap] Starting Internal Reviewer...');

      try {
        const reviewed = await reviewFullGap({
          gapIa: gapIaRun,
          draft: lightPlanDraft,
          siteMetadata: {
            domain: gapIaRun.domain,
            url: gapIaRun.url,
            companyName: gapIaRun.core?.businessName,
            industry: gapIaRun.core?.industry,
            brandTier: gapIaRun.core?.brandTier,
          },
        });

        console.log('[inngest:generate-full-gap] ✓ Internal review complete');
        return reviewed;
      } catch (error) {
        console.warn('[inngest:generate-full-gap] Review failed, using draft:', error);
        // Fallback to draft on any error
        return lightPlanDraft;
      }
    });

    // Compose the Full GAP Lite by merging GAP-IA data with the light strategic layers
    const plan: GrowthAccelerationPlan = {
      companyName: gapIaRun.core?.businessName || 'Unknown Company',
      websiteUrl: gapIaRun.url,
      generatedAt: new Date().toISOString(),

      // Carry over scores from GAP-IA (canonical source of truth)
      scorecard: {
        overall: gapIaRun.summary?.overallScore || gapIaRun.core?.overallScore || 0,
        brand: gapIaRun.dimensions?.brand?.score || gapIaRun.core?.brand?.brandScore || 0,
        content: gapIaRun.dimensions?.content?.score || gapIaRun.core?.content?.contentScore || 0,
        website: gapIaRun.dimensions?.website?.score || gapIaRun.core?.website?.websiteScore || 0,
        seo: gapIaRun.dimensions?.seo?.score || gapIaRun.core?.seo?.seoScore || 0,
        authority: gapIaRun.dimensions?.authority?.score || 0,
        digitalFootprint: gapIaRun.dimensions?.digitalFootprint?.score || 0,
      },

      // Executive summary with expanded narrative
      executiveSummary: {
        strengths: [],
        keyIssues: gapIaRun.dimensions?.brand?.issues || [],
        strategicPriorities: gapIaRun.quickWins?.bullets?.slice(0, 3).map(w => w.action) || [],
        maturityStage: gapIaRun.core?.marketingMaturity || 'developing',
        narrative: lightPlan.executiveSummaryNarrative,
        expectedOutcomes: [],
      },

      // Dimension narratives from GAP-IA (for dimension summary sections)
      dimensionNarratives: {
        brand: gapIaRun.dimensions?.brand?.narrative,
        content: gapIaRun.dimensions?.content?.narrative,
        seo: gapIaRun.dimensions?.seo?.narrative,
        website: gapIaRun.dimensions?.website?.narrative,
        digitalFootprint: gapIaRun.dimensions?.digitalFootprint?.narrative,
        authority: gapIaRun.dimensions?.authority?.narrative,
      },

      // Section analyses - create from GAP-IA dimensions to populate the dimension sections
      sectionAnalyses: {
        brand: gapIaRun.dimensions?.brand ? {
          summary: gapIaRun.dimensions.brand.oneLiner,
          keyFindings: gapIaRun.dimensions.brand.issues || [],
        } : undefined,
        content: gapIaRun.dimensions?.content ? {
          summary: gapIaRun.dimensions.content.oneLiner,
          keyFindings: gapIaRun.dimensions.content.issues || [],
        } : undefined,
        seo: gapIaRun.dimensions?.seo ? {
          summary: gapIaRun.dimensions.seo.oneLiner,
          keyFindings: gapIaRun.dimensions.seo.issues || [],
        } : undefined,
        website: gapIaRun.dimensions?.website ? {
          summary: gapIaRun.dimensions.website.oneLiner,
          keyFindings: gapIaRun.dimensions.website.issues || [],
        } : undefined,
        digitalFootprint: gapIaRun.dimensions?.digitalFootprint ? {
          summary: gapIaRun.dimensions.digitalFootprint.oneLiner,
          keyFindings: gapIaRun.dimensions.digitalFootprint.issues || [],
        } : undefined,
        authority: gapIaRun.dimensions?.authority ? {
          summary: gapIaRun.dimensions.authority.oneLiner,
          keyFindings: gapIaRun.dimensions.authority.issues || [],
        } : undefined,
      },

      // Quick wins from GAP-IA (already exists)
      quickWins: gapIaRun.quickWins?.bullets?.map(w => ({
        title: w.action,
        description: w.action,
        category: w.category as any,
        expectedImpact: w.expectedImpact as any,
        effortLevel: w.effortLevel as any,
        timeframe: '0-30 days' as const,
        implementationSteps: [],
      })) || [],

      // NEW: Strategic initiatives from Light Full GAP
      strategicInitiatives: lightPlan.strategicInitiatives.map(init => ({
        title: init.title,
        description: init.description,
        category: init.dimension as any,
        timeline: init.timeframe === 'short' ? '0-30 days' : init.timeframe === 'medium' ? '30-60 days' : '60-90 days',
        expectedImpact: init.expectedImpact as any,
        keyActions: [],
        successMetrics: [],
        resourcesNeeded: [],
      })),

      // NEW: 90-day roadmap from Light Full GAP
      roadmap: lightPlan.ninetyDayPlan.map(phase => ({
        phase: phase.phase,
        focus: phase.focus,
        actions: phase.actions,
        businessRationale: phase.businessRationale,
      })),

      // NEW: KPIs from Light Full GAP
      kpis: lightPlan.kpisToWatch,

      // Required fields (empty/placeholder values)
      gapId: `gap-full-${gapIaRunId}`,
      focusAreas: [],
      resourceRequirements: [],
      timeline: {
        immediate: [],
        shortTerm: [],
        mediumTerm: [],
        longTerm: [],
      },
      expectedOutcomes: {
        thirtyDays: { scoreImprovement: 0, keyMetrics: [], milestones: [] },
        ninetyDays: { scoreImprovement: 0, keyMetrics: [], milestones: [] },
        sixMonths: { scoreImprovement: 0, keyMetrics: [], milestones: [] },
      },
      risks: [],
      nextSteps: [],
      marketAnalysis: {
        opportunitySize: 'Unknown',
        competitiveLandscape: 'Not analyzed',
        trends: [],
      },
      positioningAnalysis: {
        currentPositioning: 'Not analyzed',
        targetPositioning: 'Not defined',
        gaps: [],
        opportunities: [],
      },
      dataAvailability: {
        website: { htmlAvailable: false, crawlSuccessful: false },
        seo: { lighthouseAvailable: false, metaTagsParsed: false },
        content: { blogDetected: false, caseStudiesDetected: false },
        competitors: { competitorsIdentified: 0, competitorsAnalyzed: 0 },
        market: { marketSizeEstimated: false, trendsAnalyzed: false },
      } as any,

      // Model version
      modelVersion: 'gpt-4o-mini-light-full-gap-v1',
    } as any as GrowthAccelerationPlan;

    console.log('[inngest:generate-full-gap] GAP generation completed');

    // Step 5: Create GAP-Full Report
    const gapFullReportId = await step.run('create-gap-full-report', async () => {
      return await createGapFullReport({
        companyId: companyAirtableId,
        gapIaRunId,
        gapPlanRunId,
        plan,
      });
    });

    // Step 5b: Save refined markdown to GAP-Plan Run
    await step.run('save-refined-markdown', async () => {
      console.log('[inngest:generate-full-gap] Saving refined markdown to database...');

      await updateRecord(AIRTABLE_TABLES.GAP_PLAN_RUN, gapPlanRunId, {
        'Full GAP Markdown': refinedMarkdown,
      });

      console.log('[inngest:generate-full-gap] Markdown saved');
    });

    // Step 6: Update GAP-Plan Run with completion
    await step.run('update-gap-plan-run-complete', async () => {
      const maturityStageMapping: Record<string, string> = {
        'early': 'FOUNDATION',
        'developing': 'EMERGING',
        'advanced': 'SCALING',
        'mature': 'LEADING',
        'Early': 'FOUNDATION',
        'Emerging': 'EMERGING',
        'Scaling': 'SCALING',
        'Leading': 'LEADING',
        'FOUNDATION': 'FOUNDATION',
        'EMERGING': 'EMERGING',
        'SCALING': 'SCALING',
        'LEADING': 'LEADING',
      };
      const rawMaturityStage = plan.executiveSummary?.maturityStage || 'developing';
      const mappedMaturityStage = maturityStageMapping[rawMaturityStage] || 'EMERGING';

      await updateGapPlanRunComplete(gapPlanRunId, {
        gapFullReportId,
        overallScore: 'scorecard' in plan ? plan.scorecard?.overall : undefined,
        brandScore: 'scorecard' in plan ? plan.scorecard?.brand : undefined,
        contentScore: 'scorecard' in plan ? plan.scorecard?.content : undefined,
        websiteScore: 'scorecard' in plan ? plan.scorecard?.website : undefined,
        seoScore: 'scorecard' in plan ? plan.scorecard?.seo : undefined,
        authorityScore: 'scorecard' in plan ? plan.scorecard?.authority : undefined,
        maturityStage: mappedMaturityStage,
      });
    });

    // Step 7: Update GAP-IA Run with links
    await step.run('update-gap-ia-run', async () => {
      await updateGapIaRun(gapIaRunId, {
        companyId: companyUUID,
        gapPlanRunId,
        gapFullReportId,
      });
    });

    console.log('[inngest:generate-full-gap] Successfully generated full GAP from IA');

    return {
      success: true,
      gapPlanRunId,
      gapFullReportId,
    };
  }
);
