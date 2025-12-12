// lib/competition-v3/orchestrator/runCompetitionAnalysis.ts
// Main Competition Analysis Orchestrator for V3
//
// Pipeline:
// 1. Load context from Context Graph
// 2. Generate discovery queries
// 3. Run multi-source discovery
// 4. Enrich candidates (metadata + AI analysis)
// 5. Classify competitors (6 categories)
// 6. Score competitors (7 dimensions)
// 7. Select final competitors
// 8. Compute positioning coordinates
// 9. Generate narrative insights
// 10. Store results

import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { getCompanyById } from '@/lib/airtable/companies';
import { generateSearchQueries } from '../discovery/searchQueries';
import { runDiscovery } from '../discovery/aiSearch';
import { enrichCandidates } from '../enrichment/metadataExtractor';
import { classifyCandidates, selectFinalCompetitors } from '../enrichment/categoryClassifier';
import { scoreCompetitors } from '../scoring/computeScores';
import { computePositioningCoordinates, getQuadrantStats } from '../positioning/computeCoordinates';
import { generateLandscapeNarrative, generateRecommendations } from './narrativeGenerator';
import { saveCompetitionRunV3, type CompetitionRunV3Payload } from '../store';
import { summarizeForContext } from '../summarizeForContext';
import { updateCompetitiveDomain } from '../updateCompetitiveDomain';
import type {
  QueryContext,
  CompetitionRunV3,
  CompetitorProfileV3,
  LandscapeInsight,
  StrategicRecommendation,
  VerticalCategory,
  CompanyArchetype,
} from '../types';
import {
  detectVerticalCategory,
  detectCompanyArchetype,
  detectMarketplaceVertical,
  classifyCompanyArchetypeAndVertical,
} from '../verticalClassifier';

// ============================================================================
// Main Orchestrator
// ============================================================================

export interface RunCompetitionV3Options {
  companyId: string;
  maxCandidates?: number; // Max candidates to enrich (default 30)
  maxFinal?: number; // Max final competitors (default 18)
  skipNarrative?: boolean; // Skip AI narrative generation
}

export interface CompetitionV3Result {
  run: CompetitionRunV3;
  competitors: CompetitorProfileV3[];
  insights: LandscapeInsight[];
  recommendations: StrategicRecommendation[];
}

// Version stamp for tracking which code version is running
const COMPETITION_V3_VERSION = '2025-12-11-marketplace-fix';

/**
 * Run the full V3 competition analysis pipeline
 */
export async function runCompetitionV3(
  options: RunCompetitionV3Options
): Promise<CompetitionV3Result> {
  const { companyId, maxCandidates = 30, maxFinal = 18, skipNarrative = false } = options;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[COMPV3 VERSION] ${COMPETITION_V3_VERSION}`);
  console.log(`[competition-v3] Starting analysis for company: ${companyId}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  const runId = `comp-v3-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Initialize run state
  let run: CompetitionRunV3 = {
    id: runId,
    companyId,
    version: 3,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    steps: {
      queryGeneration: { status: 'pending', startedAt: null, completedAt: null },
      discovery: { status: 'pending', startedAt: null, completedAt: null, candidatesFound: 0 },
      enrichment: { status: 'pending', startedAt: null, completedAt: null, enrichedCount: 0 },
      classification: { status: 'pending', startedAt: null, completedAt: null },
      scoring: { status: 'pending', startedAt: null, completedAt: null },
      positioning: { status: 'pending', startedAt: null, completedAt: null },
      narrative: { status: 'pending', startedAt: null, completedAt: null },
    },
    summary: {
      totalCandidates: 0,
      totalCompetitors: 0,
      byType: { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 },
      avgThreatScore: 0,
      quadrantDistribution: {},
    },
  };

  try {
    // Step 1: Load context and build query context
    console.log('[competition-v3] Step 1: Loading context...');
    const [graph, company] = await Promise.all([
      loadContextGraph(companyId),
      getCompanyById(companyId),
    ]);
    const context = buildQueryContext(graph, companyId, company);

    // Step 2: Generate discovery queries
    console.log('[competition-v3] Step 2: Generating queries...');
    run.steps.queryGeneration.status = 'running';
    run.steps.queryGeneration.startedAt = new Date().toISOString();

    const queries = generateSearchQueries(context);
    console.log(`[competition-v3] Generated ${queries.length} search queries`);

    // VERIFICATION LOG: Show first 10 queries for debugging agency default issue
    console.log(`\n[VERIFICATION] === GENERATED QUERIES ===`);
    console.log(`[VERIFICATION] Company: ${context.businessName}, Vertical: ${context.verticalCategory}, Archetype: ${context.archetype}`);
    queries.slice(0, 10).forEach((q, i) => {
      console.log(`[VERIFICATION] Query ${i + 1}: ${q}`);
    });
    console.log(`[VERIFICATION] === END QUERIES ===\n`);

    run.steps.queryGeneration.status = 'completed';
    run.steps.queryGeneration.completedAt = new Date().toISOString();

    // Step 3: Run multi-source discovery
    console.log('[competition-v3] Step 3: Running discovery...');
    run.steps.discovery.status = 'running';
    run.steps.discovery.startedAt = new Date().toISOString();

    let candidates = await runDiscovery(context, queries);

    // Exclude durable invalid competitors
    if (context.invalidCompetitors && context.invalidCompetitors.length > 0) {
      const invalidSet = new Set(context.invalidCompetitors.map(d => d.toLowerCase()));
      candidates = candidates.filter(c => !c.domain || !invalidSet.has((c.domain || '').toLowerCase()));
    }

    // Pre-filter obvious non-competitors (marketing agencies, ecommerce platforms, generic SaaS)
    const genericPatterns = /(marketing agency|digital marketing|seo agency|woocommerce|shopify|bigcommerce|wordpress plugin|b2b software|platform)/i;
    candidates = candidates.filter(c => {
      const hay = `${c.name} ${c.snippet || ''}`.toLowerCase();
      return !genericPatterns.test(hay);
    });

    run.steps.discovery.candidatesFound = candidates.length;
    run.summary.totalCandidates = candidates.length;

    console.log(`[competition-v3] Found ${candidates.length} unique candidates`);

    run.steps.discovery.status = 'completed';
    run.steps.discovery.completedAt = new Date().toISOString();

    // Step 4: Enrich candidates
    console.log('[competition-v3] Step 4: Enriching candidates...');
    run.steps.enrichment.status = 'running';
    run.steps.enrichment.startedAt = new Date().toISOString();

    const enriched = await enrichCandidates(candidates, context, maxCandidates);
    run.steps.enrichment.enrichedCount = enriched.length;

    console.log(`[competition-v3] Enriched ${enriched.length} candidates`);

    run.steps.enrichment.status = 'completed';
    run.steps.enrichment.completedAt = new Date().toISOString();

    // Step 5: Classify competitors
    console.log('[competition-v3] Step 5: Classifying competitors...');
    run.steps.classification.status = 'running';
    run.steps.classification.startedAt = new Date().toISOString();

    const classified = await classifyCandidates(enriched, context);

    console.log(`[competition-v3] Classified ${classified.length} competitors`);

    // VERIFICATION LOG: Show top 10 competitor domains after classification
    const nonIrrelevant = classified.filter(c => c.classification.type !== 'irrelevant');
    console.log(`\n[VERIFICATION] === TOP CLASSIFIED COMPETITORS ===`);
    console.log(`[VERIFICATION] Non-irrelevant: ${nonIrrelevant.length} / ${classified.length}`);
    nonIrrelevant.slice(0, 10).forEach((c, i) => {
      console.log(`[VERIFICATION] ${i + 1}. ${c.domain || c.name} (type: ${c.classification.type}, conf: ${c.classification.confidence.toFixed(2)})`);
    });
    console.log(`[VERIFICATION] === END COMPETITORS ===\n`);

    run.steps.classification.status = 'completed';
    run.steps.classification.completedAt = new Date().toISOString();

    // Step 6: Score competitors
    console.log('[competition-v3] Step 6: Scoring competitors...');
    run.steps.scoring.status = 'running';
    run.steps.scoring.startedAt = new Date().toISOString();

    const scored = scoreCompetitors(classified, context);

    // Drop irrelevant/low-threat competitors
    const filteredScored = scored.filter(c => c.classification.type !== 'irrelevant' && c.scores.threatScore >= 20);
    const forSelection = filteredScored.length > 0 ? filteredScored : scored;

    console.log(`[competition-v3] Scored ${scored.length} competitors`);

    run.steps.scoring.status = 'completed';
    run.steps.scoring.completedAt = new Date().toISOString();

    // Step 7: Select final competitors using quota-based selection
    console.log('[competition-v3] Step 7: Selecting final competitors...');
    const selected = selectFinalCompetitors(forSelection, {
      direct: { min: 3, max: 6 },
      partial: { min: 3, max: 5 },
      fractional: { min: 2, max: 3 },
      platform: { min: 1, max: 3 },
      internal: { min: 1, max: 2 },
      total: maxFinal,
    });

    // Step 8: Compute positioning coordinates
    console.log('[competition-v3] Step 8: Computing positions...');
    run.steps.positioning.status = 'running';
    run.steps.positioning.startedAt = new Date().toISOString();

    // Convert to CompetitorProfileV3 format
    const competitors: CompetitorProfileV3[] = selected.map((c, index) => ({
      id: `${runId}-${index}`,
      runId,
      name: c.name,
      domain: c.domain,
      homepageUrl: c.homepageUrl,
      logoUrl: null,
      summary: c.aiSummary || c.snippet || '',
      classification: c.classification,
      scores: c.scores,
      jtbdMatches: c.jtbdMatches,
      offerOverlapScore: c.offerOverlapScore,
      signalsVerified: c.signalsVerified,
      businessModelCategory: c.businessModelCategory,
      geoScore: c.geoScore,
      positioning: {
        x: 50,
        y: 50,
        quadrant: 'distant',
        bubbleSize: 'medium',
        clusterGroup: c.classification.type,
      },
      metadata: {
        teamSize: c.metadata?.teamSize || null,
        teamSizeEstimate: c.metadata?.teamSizeEstimate || null,
        foundedYear: c.metadata?.foundedYear || null,
        headquarters: c.metadata?.headquarters || null,
        serviceRegions: c.metadata?.serviceRegions || [],
        techStack: c.metadata?.techStack || [],
        hasAICapabilities: c.metadata?.hasAICapabilities || false,
        hasAutomation: c.metadata?.hasAutomation || false,
        pricingTier: c.metadata?.pricingTier || null,
        businessModel: c.metadata?.businessModel || null,
        serviceModel: c.metadata?.serviceModel || null,
      },
      discovery: {
        source: c.source,
        sourceUrl: c.sourceUrl,
        frequency: c.frequency,
        directoryRating: c.directoryRating,
        directoryReviews: c.directoryReviews,
      },
      analysis: {
        strengths: c.aiStrengths || [],
        weaknesses: c.aiWeaknesses || [],
        whyCompetitor: c.aiWhyCompetitor || null,
        differentiators: [],
        opportunities: [],
      },
    }));

    // Apply positioning coordinates
    const positioned = computePositioningCoordinates(competitors);

    run.steps.positioning.status = 'completed';
    run.steps.positioning.completedAt = new Date().toISOString();

    // Update summary
    run.summary.totalCompetitors = positioned.length;
    run.summary.byType = positioned.reduce((acc, c) => {
      const type = c.classification.type;
      if (type !== 'irrelevant') {
        acc[type as keyof typeof acc] = (acc[type as keyof typeof acc] || 0) + 1;
      }
      return acc;
    }, { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 });

    run.summary.avgThreatScore = Math.round(
      positioned.reduce((sum, c) => sum + c.scores.threatScore, 0) / positioned.length
    );

    const quadrantStats = getQuadrantStats(positioned);
    run.summary.quadrantDistribution = Object.fromEntries(
      Object.entries(quadrantStats).map(([q, stats]) => [q, stats.count])
    );

    // Step 9: Generate narrative insights
    let insights: LandscapeInsight[] = [];
    let recommendations: StrategicRecommendation[] = [];

    if (!skipNarrative) {
      console.log('[competition-v3] Step 9: Generating narrative...');
      run.steps.narrative.status = 'running';
      run.steps.narrative.startedAt = new Date().toISOString();

      try {
        [insights, recommendations] = await Promise.all([
          generateLandscapeNarrative(positioned, context),
          generateRecommendations(positioned, context),
        ]);

        run.steps.narrative.status = 'completed';
        run.steps.narrative.completedAt = new Date().toISOString();
      } catch (narrativeError) {
        console.warn('[competition-v3] Narrative generation failed:', narrativeError);
        run.steps.narrative.status = 'completed'; // Don't fail the whole run
        run.steps.narrative.completedAt = new Date().toISOString();
      }
    } else {
      run.steps.narrative.status = 'skipped';
    }

    // Complete the run BEFORE storing (so stored record has correct status)
    run.status = 'completed';
    run.completedAt = new Date().toISOString();

    // Step 10: Store results in Context Graph
    console.log('[competition-v3] Step 10: Storing results...');
    await storeResults(companyId, graph as CompanyContextGraph, positioned, insights, recommendations, run);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[competition-v3] Analysis complete in ${duration}s`);
    console.log(`[competition-v3] Found ${positioned.length} competitors`);
    console.log(`[competition-v3] Distribution: ${JSON.stringify(run.summary.byType)}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      run,
      competitors: positioned,
      insights,
      recommendations,
    };
  } catch (error) {
    console.error('[competition-v3] Analysis failed:', error);

    run.status = 'failed';
    run.error = error instanceof Error ? error.message : 'Unknown error';
    run.completedAt = new Date().toISOString();

    // Mark any running steps as failed
    for (const step of Object.values(run.steps)) {
      if (step.status === 'running') {
        step.status = 'failed';
        step.completedAt = new Date().toISOString();
      }
    }

    throw error;
  }
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build QueryContext from Context Graph
 *
 * @param graph - The Context Graph for the company
 * @param companyId - The company ID
 * @param company - Optional company data from Airtable (used as fallback)
 */
function buildQueryContext(graph: any, companyId: string, company?: { name: string; domain?: string; website?: string } | null): QueryContext {
  const identity = graph.identity || {};
  const offer = graph.offer || {};
  const icp = graph.icp || {};
  const positioning = graph.positioning || {};
  const pricing = graph.pricing || {};
  const competitive = graph.competitive || {};

  // Extract business name (with fallback to Airtable company data)
  const businessName = identity.businessName?.value ||
    identity.brandName?.value ||
    company?.name ||
    `Company ${companyId.slice(0, 8)}`;

  // Extract domain (with fallback to Airtable company data)
  const graphDomain = identity.websiteUrl?.value
    ? extractDomain(identity.websiteUrl.value)
    : null;
  const domain = graphDomain ||
    (company?.domain ? extractDomain(company.domain) : null) ||
    (company?.website ? extractDomain(company.website) : null);

  // Extract ICP description
  const icpParts = [
    icp.targetAudience?.value,
    icp.idealCustomerProfile?.value,
    icp.primaryPersona?.value,
  ].filter(Boolean);
  const icpDescription = icpParts.join('. ') || null;

  // Determine ICP stage
  let icpStage: QueryContext['icpStage'] = null;
  const companySize = icp.companySize?.value?.toLowerCase() || '';
  if (companySize.includes('startup') || companySize.includes('early')) {
    icpStage = 'startup';
  } else if (companySize.includes('growth') || companySize.includes('scale')) {
    icpStage = 'growth';
  } else if (companySize.includes('mid') || companySize.includes('smb')) {
    icpStage = 'mid-market';
  } else if (companySize.includes('enterprise') || companySize.includes('large')) {
    icpStage = 'enterprise';
  }

  // Extract target industries
  const targetIndustries: string[] = [];
  if (icp.industries?.value) {
    if (Array.isArray(icp.industries.value)) {
      targetIndustries.push(...icp.industries.value);
    } else if (typeof icp.industries.value === 'string') {
      targetIndustries.push(...icp.industries.value.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean));
    }
  }

  // Extract primary offers
  const primaryOffers: string[] = [];
  if (offer.coreServices?.value) {
    if (Array.isArray(offer.coreServices.value)) {
      primaryOffers.push(...offer.coreServices.value);
    } else if (typeof offer.coreServices.value === 'string') {
      primaryOffers.push(...offer.coreServices.value.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean));
    }
  }
  if (offer.serviceCategories?.value && Array.isArray(offer.serviceCategories.value)) {
    primaryOffers.push(...offer.serviceCategories.value);
  }

  // Extract value proposition
  const valueProposition = positioning.valueProposition?.value ||
    offer.mainBenefit?.value ||
    null;

  // Extract differentiators
  const differentiators: string[] = [];
  if (positioning.differentiators?.value) {
    if (Array.isArray(positioning.differentiators.value)) {
      differentiators.push(...positioning.differentiators.value);
    } else if (typeof positioning.differentiators.value === 'string') {
      differentiators.push(...positioning.differentiators.value.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean));
    }
  }

  // Determine AI orientation
  let aiOrientation: QueryContext['aiOrientation'] = null;
  const aiMentions = [
    positioning.technologyApproach?.value,
    offer.serviceDelivery?.value,
    identity.brandPromise?.value,
  ].join(' ').toLowerCase();

  if (aiMentions.includes('ai-first') || aiMentions.includes('ai native')) {
    aiOrientation = 'ai-first';
  } else if (aiMentions.includes('ai') || aiMentions.includes('automation')) {
    aiOrientation = 'ai-augmented';
  } else if (aiMentions.includes('traditional') || aiMentions.includes('human')) {
    aiOrientation = 'traditional';
  }

  // Durable invalid competitors from context graph
  const invalidCompetitors: string[] = Array.isArray(competitive.invalidCompetitors?.value)
    ? competitive.invalidCompetitors.value
    : [];

  // Determine business model category (B2B vs B2C vs Hybrid)
  let businessModelCategory: QueryContext['businessModelCategory'] = null;
  const businessModelText = [
    identity.businessModel?.value,
    icp.customerType?.value,
    icp.targetAudience?.value,
    identity.industry?.value,
  ].join(' ').toLowerCase();

  // Check for B2C indicators
  const b2cIndicators = ['consumer', 'b2c', 'retail', 'household', 'individual', 'shopper', 'driver', 'customer'];
  const b2bIndicators = ['b2b', 'business', 'enterprise', 'company', 'organization', 'saas', 'client', 'corporate'];

  const hasB2C = b2cIndicators.some(indicator => businessModelText.includes(indicator));
  const hasB2B = b2bIndicators.some(indicator => businessModelText.includes(indicator));

  if (hasB2C && hasB2B) {
    businessModelCategory = 'Hybrid';
  } else if (hasB2C) {
    businessModelCategory = 'B2C';
  } else if (hasB2B) {
    businessModelCategory = 'B2B';
  }

  // Build partial context for vertical detection
  const partialContext: Partial<QueryContext> = {
    businessName,
    domain,
    industry: identity.industry?.value || positioning.industry?.value || null,
    businessModel: identity.businessModel?.value || null,
    businessModelCategory,
    icpDescription,
    primaryOffers,
    valueProposition,
    differentiators,
  };

  // Detect archetype and vertical using combined classification
  const classification = classifyCompanyArchetypeAndVertical(partialContext);
  const archetype: CompanyArchetype = classification.archetype.archetype;
  const verticalCategory: VerticalCategory = classification.vertical.verticalCategory;
  const subVertical = classification.vertical.subVertical;

  // Detect marketplace sub-vertical if this is a marketplace
  let marketplaceVertical: string | null = null;
  if (verticalCategory === 'marketplace' || archetype === 'two_sided_marketplace') {
    // Build text for marketplace vertical detection
    const textForMarketplace = [
      businessName,
      identity.industry?.value,
      identity.businessModel?.value,
      icpDescription,
      ...primaryOffers,
    ].filter(Boolean).join(' ');
    marketplaceVertical = detectMarketplaceVertical(textForMarketplace);
  }

  console.log(`[competition-v3] Archetype detected: ${archetype} - confidence: ${classification.archetype.confidence}`);
  console.log(`[competition-v3] Vertical detected: ${verticalCategory}${subVertical ? ` (${subVertical})` : ''}${marketplaceVertical ? ` [marketplace: ${marketplaceVertical}]` : ''} - confidence: ${classification.vertical.confidence}`);
  if (classification.archetype.signals.length > 0) {
    console.log(`[competition-v3] Archetype signals: ${classification.archetype.signals.slice(0, 3).join(', ')}`);
  }
  if (classification.vertical.signals.length > 0) {
    console.log(`[competition-v3] Vertical signals: ${classification.vertical.signals.slice(0, 3).join(', ')}`);
  }

  return {
    businessName,
    domain,
    industry: identity.industry?.value || positioning.industry?.value || null,
    businessModel: identity.businessModel?.value || null,
    businessModelCategory,
    verticalCategory,
    subVertical,
    archetype,
    marketplaceVertical,
    icpDescription,
    icpStage,
    targetIndustries,
    primaryOffers,
    serviceModel: pricing.pricingModel?.value || null,
    pricePositioning: positioning.pricePositioning?.value || null,
    valueProposition,
    differentiators,
    geography: identity.headquartersLocation?.value || identity.headquarters?.value || null,
    serviceRegions: identity.serviceRegions?.value || [],
    aiOrientation,
    invalidCompetitors,
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    if (!url.includes('://')) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ============================================================================
// Result Storage
// ============================================================================

/**
 * Store results using dual-storage strategy:
 * 1. Full V3 payload → Competition Runs table (for QBR, history, debugging)
 * 2. Summary → Context Graph competitive domain (for Brain)
 */
async function storeResults(
  companyId: string,
  _graph: CompanyContextGraph, // Kept for signature compatibility
  competitors: CompetitorProfileV3[],
  insights: LandscapeInsight[],
  recommendations: StrategicRecommendation[],
  run: CompetitionRunV3
): Promise<void> {
  // ============================================================================
  // STEP 1: Save full V3 payload to Competition Runs table
  // ============================================================================
  console.log('[competition-v3] Saving full V3 payload to Competition Runs table...');

  const fullPayload: CompetitionRunV3Payload = {
    runId: run.id,
    companyId,
    status: run.status as 'pending' | 'running' | 'completed' | 'failed',
    createdAt: run.startedAt,
    completedAt: run.completedAt,
    competitors,
    insights,
    recommendations,
    summary: {
      totalCandidates: run.summary.totalCandidates,
      totalCompetitors: run.summary.totalCompetitors,
      byType: run.summary.byType,
      avgThreatScore: run.summary.avgThreatScore,
      quadrantDistribution: run.summary.quadrantDistribution,
    },
    error: run.error,
  };

  try {
    const recordId = await saveCompetitionRunV3(fullPayload);
    console.log(`[competition-v3] Full V3 payload saved to Competition Runs (record: ${recordId})`);
  } catch (error) {
    console.error('[competition-v3] Failed to save to Competition Runs table:', error);
    // Don't fail the whole run if this storage fails - continue to Context Graph update
  }

  // ============================================================================
  // STEP 2: Generate summary and save to Context Graph competitive domain
  // ============================================================================
  console.log('[competition-v3] Generating summary for Context Graph...');

  const summary = summarizeForContext(fullPayload);

  console.log('[competition-v3] Updating Context Graph competitive domain...');

  const updateResult = await updateCompetitiveDomain(companyId, summary, run.id);

  if (updateResult.success) {
    console.log(`[competition-v3] Context Graph updated (${updateResult.fieldsUpdated.length} fields)`);
  } else {
    console.error('[competition-v3] Failed to update Context Graph:', updateResult.error);
  }

  console.log('[competition-v3] Dual-storage complete');
}

// ============================================================================
// Exports
// ============================================================================

export { buildQueryContext };
