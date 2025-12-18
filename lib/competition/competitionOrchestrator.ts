// lib/competition/competitionOrchestrator.ts
// Competition Lab v2 - Main Orchestrator Pipeline
//
// Coordinates the full competition discovery, enrichment, scoring, and classification pipeline.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { aiSimple } from '@/lib/ai-gateway';
import {
  createCompetitionRun,
  updateCompetitionRun,
  updateRunStatus,
  calculateDataConfidence,
  getCompetitionRun,
} from './store';
import {
  getDiscoveryQueriesPrompt,
  ENRICHMENT_SYSTEM_PROMPT,
  getEnrichmentPrompt,
  SCORING_SYSTEM_PROMPT,
  getScoringPrompt,
  getWhyThisCompetitorMattersPrompt,
  getHowTheyDifferPrompt,
  getThreatAssessmentPrompt,
} from './prompts';
import {
  type CompetitionRun,
  type CompetitionRunResult,
  type CompetitionSummary,
  type CandidateCompetitor,
  type ScoredCompetitor,
  type TargetCompanyContext,
  type EnrichedCompetitorData,
  type DiscoverySource,
  calculateOverallScore,
  classifyCompetitorRole,
  generateCompetitorId,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const MAX_CANDIDATES = 50; // Maximum candidates to process
const MAX_COMPETITORS_PER_ROLE = {
  core: 5,
  secondary: 10,
  alternative: 15,
};

// ============================================================================
// Main Orchestrator Function
// ============================================================================

/**
 * Run the full competition lab pipeline for a company
 */
export async function runCompetitionLab(companyId: string): Promise<CompetitionRunResult> {
  console.log(`[competition] Starting competition lab for company: ${companyId}`);

  // Create the run record
  const run = await createCompetitionRun({ companyId });
  const runId = run.id;

  try {
    // Step 1: Load context from Context Graph
    await updateRunStatus(runId, 'discovering');
    const targetContext = await loadTargetContext(companyId);

    if (!targetContext) {
      throw new Error('Failed to load company context');
    }

    // Step 2: Generate discovery queries
    const querySet = await generateDiscoveryQueries(targetContext);
    await updateCompetitionRun(runId, { querySet });

    // Step 3: Discover candidates from multiple sources
    const candidates = await discoverCandidates(targetContext, querySet);
    await updateCompetitionRun(runId, {
      candidatesDiscovered: candidates.length,
    });

    // Step 4: Enrich candidates
    await updateRunStatus(runId, 'enriching');
    const enrichedCandidates = await enrichCandidates(candidates.slice(0, MAX_CANDIDATES));
    await updateCompetitionRun(runId, {
      candidatesEnriched: enrichedCandidates.length,
    });

    // Step 5: Score candidates
    await updateRunStatus(runId, 'scoring');
    const scoredCompetitors = await scoreCandidates(targetContext, enrichedCandidates);
    await updateCompetitionRun(runId, {
      candidatesScored: scoredCompetitors.length,
    });

    // Step 6: Classify and filter competitors
    await updateRunStatus(runId, 'classifying');
    const classifiedCompetitors = classifyAndFilterCompetitors(scoredCompetitors);

    // Step 7: Generate analysis for top competitors
    const analyzedCompetitors = await generateCompetitorAnalysis(
      targetContext,
      classifiedCompetitors
    );

    // Step 8: Assign positions for visualization
    const positionedCompetitors = assignVisualizationPositions(analyzedCompetitors);

    // Step 9: Finalize run
    await updateRunStatus(runId, 'completed');
    const finalRun = await updateCompetitionRun(runId, {
      competitors: positionedCompetitors,
      completedAt: new Date().toISOString(),
    });

    // Calculate and update data confidence
    const updatedRun = await getCompetitionRun(runId);
    if (updatedRun) {
      const confidence = calculateDataConfidence(updatedRun);
      await updateCompetitionRun(runId, { dataConfidenceScore: confidence });
    }

    // Build result
    const result = buildRunResult(runId, positionedCompetitors);
    console.log(`[competition] Completed competition lab for company: ${companyId}`);
    return result;
  } catch (error) {
    console.error(`[competition] Competition lab failed:`, error);
    await updateRunStatus(runId, 'failed');
    await updateCompetitionRun(runId, {
      errors: [(error as Error).message],
    });
    throw error;
  }
}

// ============================================================================
// Step 1: Load Target Context
// ============================================================================

async function loadTargetContext(companyId: string): Promise<TargetCompanyContext | null> {
  try {
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      console.warn(`[competition] No context graph found for company: ${companyId}`);
      return null;
    }

    const identity = graph.identity;
    const audience = graph.audience;
    const competitive = graph.competitive;
    const productOffer = graph.productOffer;

    // Get primary offers from productOffer domain or identity competitors
    const primaryOffers = productOffer?.productLines?.value || [];

    // Get human-provided competitors from competitive domain
    const humanProvidedCompetitors: string[] = [];
    const competitors = competitive?.competitors?.value || [];
    for (const c of competitors) {
      if (c && typeof c === 'object' && 'name' in c && typeof c.name === 'string') {
        humanProvidedCompetitors.push(c.name);
      }
    }

    return {
      companyId,
      businessName: identity?.businessName?.value || graph.companyName || 'Unknown',
      domain: null, // Domain not stored directly in context graph
      industry: identity?.industry?.value || null,
      icpDescription: audience?.icpDescription?.value || null,
      serviceArea: identity?.serviceArea?.value || null,
      geographicFootprint: identity?.geographicFootprint?.value || null,
      revenueModel: identity?.revenueModel?.value || null,
      marketMaturity: identity?.marketMaturity?.value || null,
      priceTier: null, // Price tier not directly in identity, would need to derive from productOffer
      primaryOffers,
      humanProvidedCompetitors,
    };
  } catch (error) {
    console.error(`[competition] Failed to load target context:`, error);
    return null;
  }
}

// ============================================================================
// Step 2: Generate Discovery Queries
// ============================================================================

interface QuerySet {
  brandQueries: string[];
  categoryQueries: string[];
  geoQueries: string[];
  marketplaceQueries: string[];
}

async function generateDiscoveryQueries(context: TargetCompanyContext): Promise<QuerySet> {
  try {
    const prompt = getDiscoveryQueriesPrompt(context);

    const content = await aiSimple({
      systemPrompt: 'You are a competitive intelligence analyst. Generate search queries in JSON format.',
      taskPrompt: prompt,
      temperature: 0.3,
      maxTokens: 1000,
      jsonMode: true,
    });

    const json = extractJSON(content) as {
      brandQueries?: string[];
      categoryQueries?: string[];
      geoQueries?: string[];
      marketplaceQueries?: string[];
    };

    return {
      brandQueries: Array.isArray(json.brandQueries) ? json.brandQueries : [],
      categoryQueries: Array.isArray(json.categoryQueries) ? json.categoryQueries : [],
      geoQueries: Array.isArray(json.geoQueries) ? json.geoQueries : [],
      marketplaceQueries: Array.isArray(json.marketplaceQueries) ? json.marketplaceQueries : [],
    };
  } catch (error) {
    console.error(`[competition] Failed to generate discovery queries:`, error);
    // Fallback to basic queries
    return {
      brandQueries: [
        `${context.businessName} competitors`,
        `${context.businessName} alternatives`,
      ],
      categoryQueries: context.industry
        ? [`best ${context.industry} companies`]
        : [],
      geoQueries: [],
      marketplaceQueries: [],
    };
  }
}

// ============================================================================
// Step 3: Discover Candidates
// ============================================================================

async function discoverCandidates(
  context: TargetCompanyContext,
  querySet: QuerySet
): Promise<CandidateCompetitor[]> {
  const candidates: Map<string, CandidateCompetitor> = new Map();

  // Add human-provided competitors first
  for (const name of context.humanProvidedCompetitors) {
    const key = name.toLowerCase();
    candidates.set(key, {
      name,
      domain: null,
      discoveredFrom: ['human_provided'],
    });
  }

  // Run search queries in parallel batches
  const allQueries: Array<{ query: string; source: DiscoverySource }> = [
    ...querySet.brandQueries.map((q) => ({ query: q, source: 'brand_query' as const })),
    ...querySet.categoryQueries.map((q) => ({ query: q, source: 'category_query' as const })),
    ...querySet.geoQueries.map((q) => ({ query: q, source: 'geo_query' as const })),
    ...querySet.marketplaceQueries.map((q) => ({ query: q, source: 'marketplace_query' as const })),
  ];

  // Process queries in batches of 3 to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < allQueries.length; i += batchSize) {
    const batch = allQueries.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(({ query, source }) => searchForCompetitors(query, source))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const candidate of result.value) {
          const key = candidate.name.toLowerCase();
          const existing = candidates.get(key);
          if (existing) {
            // Merge discovery sources
            existing.discoveredFrom = [
              ...new Set([...existing.discoveredFrom, ...candidate.discoveredFrom]),
            ];
          } else {
            candidates.set(key, candidate);
          }
        }
      }
    }
  }

  // Filter out the target company itself
  const targetKey = context.businessName.toLowerCase();
  candidates.delete(targetKey);

  return Array.from(candidates.values());
}

async function searchForCompetitors(
  query: string,
  source: DiscoverySource
): Promise<CandidateCompetitor[]> {
  try {
    // Use AI to extract competitor names from search results
    // In production, this would use a real search API
    const content = await aiSimple({
      systemPrompt: 'You are a competitive research assistant. Return only valid JSON arrays.',
      taskPrompt: `Search query: "${query}"

Imagine you are searching for this query. List 5-8 company names that would appear as competitors in the search results.

Return JSON array of objects with "name" and "domain" fields:
[{"name": "Company Name", "domain": "company.com"}, ...]

Only return the JSON array, no other text.`,
      temperature: 0.5,
      maxTokens: 500,
      jsonMode: true,
    });

    const companies = extractJSON(content);

    if (!Array.isArray(companies)) {
      return [];
    }

    return companies.map((c: { name: string; domain?: string }) => ({
      name: c.name,
      domain: c.domain || null,
      discoveredFrom: [source],
    }));
  } catch (error) {
    console.error(`[competition] Search failed for query "${query}":`, error);
    return [];
  }
}

// ============================================================================
// Step 4: Enrich Candidates
// ============================================================================

async function enrichCandidates(
  candidates: CandidateCompetitor[]
): Promise<Array<CandidateCompetitor & { enrichedData: EnrichedCompetitorData }>> {
  const enriched: Array<CandidateCompetitor & { enrichedData: EnrichedCompetitorData }> = [];

  // Process in batches of 5 for rate limiting
  const batchSize = 5;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((candidate) => enrichCandidate(candidate))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        enriched.push({
          ...batch[j],
          enrichedData: result.value,
        });
      }
    }
  }

  return enriched;
}

async function enrichCandidate(
  candidate: CandidateCompetitor
): Promise<EnrichedCompetitorData | null> {
  try {
    const prompt = getEnrichmentPrompt(candidate.name, candidate.domain);

    const content = await aiSimple({
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.2,
      maxTokens: 1500,
      jsonMode: true,
    });

    const data = extractJSON(content) as Record<string, unknown>;

    return {
      companyType: (data.companyType as string) || null,
      category: (data.category as string) || null,
      summary: (data.summary as string) || null,
      tagline: (data.tagline as string) || null,
      targetAudience: (data.targetAudience as string) || null,
      icpDescription: (data.icpDescription as string) || null,
      companySizeTarget: (data.companySizeTarget as string) || null,
      geographicFocus: (data.geographicFocus as string) || null,
      headquartersLocation: (data.headquartersLocation as string) || null,
      serviceAreas: Array.isArray(data.serviceAreas) ? data.serviceAreas : [],
      primaryOffers: Array.isArray(data.primaryOffers) ? data.primaryOffers : [],
      uniqueFeatures: Array.isArray(data.uniqueFeatures) ? data.uniqueFeatures : [],
      pricingTier: (data.pricingTier as 'budget' | 'mid' | 'premium' | 'enterprise') || null,
      pricingModel: (data.pricingModel as string) || null,
      estimatedPriceRange: (data.estimatedPriceRange as string) || null,
      brandScale: (data.brandScale as 'startup' | 'smb' | 'mid_market' | 'enterprise' | 'dominant') || null,
      estimatedEmployees: typeof data.estimatedEmployees === 'number' ? data.estimatedEmployees : null,
      foundedYear: typeof data.foundedYear === 'number' ? data.foundedYear : null,
      positioning: (data.positioning as string) || null,
      valueProposition: (data.valueProposition as string) || null,
      differentiators: Array.isArray(data.differentiators) ? data.differentiators : [],
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
      primaryChannels: Array.isArray(data.primaryChannels) ? data.primaryChannels : [],
      socialProof: Array.isArray(data.socialProof) ? data.socialProof : [],
    };
  } catch (error) {
    console.error(`[competition] Enrichment failed for "${candidate.name}":`, error);
    return null;
  }
}

// ============================================================================
// Step 5: Score Candidates
// ============================================================================

async function scoreCandidates(
  target: TargetCompanyContext,
  candidates: Array<CandidateCompetitor & { enrichedData: EnrichedCompetitorData }>
): Promise<ScoredCompetitor[]> {
  const scored: ScoredCompetitor[] = [];

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((candidate) => scoreCandidate(target, candidate))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        scored.push(result.value);
      }
    }
  }

  return scored;
}

async function scoreCandidate(
  target: TargetCompanyContext,
  candidate: CandidateCompetitor & { enrichedData: EnrichedCompetitorData }
): Promise<ScoredCompetitor | null> {
  try {
    const prompt = getScoringPrompt(target, candidate.enrichedData, candidate.name);

    const content = await aiSimple({
      systemPrompt: SCORING_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.1,
      maxTokens: 800,
      jsonMode: true,
    });

    const scores = extractJSON(content) as {
      offerSimilarity?: number;
      audienceSimilarity?: number;
      geoOverlap?: number;
      priceTierOverlap?: number;
    };

    const offerSimilarity = clamp(typeof scores.offerSimilarity === 'number' ? scores.offerSimilarity : 50, 0, 100);
    const audienceSimilarity = clamp(typeof scores.audienceSimilarity === 'number' ? scores.audienceSimilarity : 50, 0, 100);
    const geoOverlap = clamp(typeof scores.geoOverlap === 'number' ? scores.geoOverlap : 50, 0, 100);
    const priceTierOverlap = clamp(typeof scores.priceTierOverlap === 'number' ? scores.priceTierOverlap : 50, 0, 100);

    const overallScore = calculateOverallScore({
      offerSimilarity,
      audienceSimilarity,
      geoOverlap,
      priceTierOverlap,
    });

    const isHumanProvided = candidate.discoveredFrom.includes('human_provided');
    const role = classifyCompetitorRole(
      overallScore,
      offerSimilarity,
      audienceSimilarity,
      isHumanProvided
    );

    return {
      id: generateCompetitorId(),
      competitorName: candidate.name,
      competitorDomain: candidate.domain,
      homepageUrl: candidate.domain ? `https://${candidate.domain}` : null,
      shortSummary: candidate.enrichedData.summary || null,
      geo: candidate.enrichedData.geographicFocus || null,
      priceTier: candidate.enrichedData.pricingTier === 'budget' ? 'low' :
                 candidate.enrichedData.pricingTier === 'enterprise' || candidate.enrichedData.pricingTier === 'premium' ? 'high' :
                 candidate.enrichedData.pricingTier === 'mid' ? 'mid' : null,
      role,
      overallScore,
      offerSimilarity,
      audienceSimilarity,
      geoOverlap,
      priceTierOverlap,
      compositeScore: overallScore,
      brandScale: candidate.enrichedData.brandScale,
      enrichedData: candidate.enrichedData,
      provenance: {
        discoveredFrom: candidate.discoveredFrom,
        humanOverride: isHumanProvided,
        humanOverrideAt: isHumanProvided ? new Date().toISOString() : null,
        removed: false,
        removedAt: null,
        removedReason: null,
        promoted: false,
        promotedAt: null,
      },
      source: 'ai_simulation' as const,
      sourceNote: `Discovered from ${candidate.discoveredFrom.join(', ')}`,
      removedByUser: false,
      promotedByUser: isHumanProvided,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      xPosition: null,
      yPosition: null,
      whyThisCompetitorMatters: null,
      howTheyDiffer: null,
      threatLevel: null,
      threatDrivers: [],
    };
  } catch (error) {
    console.error(`[competition] Scoring failed for "${candidate.name}":`, error);
    return null;
  }
}

// ============================================================================
// Step 6: Classify and Filter
// ============================================================================

function classifyAndFilterCompetitors(competitors: ScoredCompetitor[]): ScoredCompetitor[] {
  // Sort by overall score descending
  const sorted = [...competitors].sort((a, b) => b.overallScore - a.overallScore);

  // Group by role
  const byRole = {
    core: sorted.filter((c) => c.role === 'core'),
    secondary: sorted.filter((c) => c.role === 'secondary'),
    alternative: sorted.filter((c) => c.role === 'alternative'),
  };

  // Limit per role
  const filtered = [
    ...byRole.core.slice(0, MAX_COMPETITORS_PER_ROLE.core),
    ...byRole.secondary.slice(0, MAX_COMPETITORS_PER_ROLE.secondary),
    ...byRole.alternative.slice(0, MAX_COMPETITORS_PER_ROLE.alternative),
  ];

  return filtered;
}

// ============================================================================
// Step 7: Generate Analysis
// ============================================================================

async function generateCompetitorAnalysis(
  target: TargetCompanyContext,
  competitors: ScoredCompetitor[]
): Promise<ScoredCompetitor[]> {
  // Only analyze top competitors (core + top secondary)
  const toAnalyze = competitors.filter(
    (c) => c.role === 'core' || (c.role === 'secondary' && c.overallScore >= 70)
  );

  const analyzed = await Promise.all(
    toAnalyze.map(async (competitor) => {
      try {
        const [whyMatters, howDiffer, threatData] = await Promise.all([
          generateWhyMatters(target, competitor),
          generateHowDiffer(target, competitor),
          generateThreatAssessment(target, competitor),
        ]);

        return {
          ...competitor,
          whyThisCompetitorMatters: whyMatters,
          howTheyDiffer: howDiffer,
          threatLevel: threatData?.threatLevel || null,
          threatDrivers: threatData?.threatDrivers || [],
        };
      } catch (error) {
        console.error(`[competition] Analysis failed for "${competitor.competitorName}":`, error);
        return competitor;
      }
    })
  );

  // Merge analyzed back with non-analyzed
  const analyzedIds = new Set(analyzed.map((c) => c.id));
  const notAnalyzed = competitors.filter((c) => !analyzedIds.has(c.id));

  return [...analyzed, ...notAnalyzed];
}

async function generateWhyMatters(
  target: TargetCompanyContext,
  competitor: ScoredCompetitor
): Promise<string | null> {
  try {
    const prompt = getWhyThisCompetitorMattersPrompt(target, competitor.enrichedData, competitor.competitorName, {
      overallScore: competitor.overallScore,
      offerSimilarity: competitor.offerSimilarity,
      audienceSimilarity: competitor.audienceSimilarity,
    });

    const content = await aiSimple({
      systemPrompt: 'You are a competitive intelligence analyst. Provide concise, actionable insights.',
      taskPrompt: prompt,
      temperature: 0.3,
      maxTokens: 300,
    });

    return content.trim();
  } catch {
    return null;
  }
}

async function generateHowDiffer(
  target: TargetCompanyContext,
  competitor: ScoredCompetitor
): Promise<string | null> {
  try {
    const prompt = getHowTheyDifferPrompt(target, competitor.enrichedData, competitor.competitorName);

    const content = await aiSimple({
      systemPrompt: 'You are a competitive intelligence analyst. Provide concise, actionable insights.',
      taskPrompt: prompt,
      temperature: 0.3,
      maxTokens: 300,
    });

    return content.trim();
  } catch {
    return null;
  }
}

async function generateThreatAssessment(
  target: TargetCompanyContext,
  competitor: ScoredCompetitor
): Promise<{ threatLevel: number; threatDrivers: string[] } | null> {
  try {
    const prompt = getThreatAssessmentPrompt(target, competitor.enrichedData, competitor.competitorName, {
      overallScore: competitor.overallScore,
      offerSimilarity: competitor.offerSimilarity,
      audienceSimilarity: competitor.audienceSimilarity,
    });

    const content = await aiSimple({
      systemPrompt: 'You are a competitive intelligence analyst. Return only valid JSON.',
      taskPrompt: prompt,
      temperature: 0.2,
      maxTokens: 500,
      jsonMode: true,
    });

    const data = extractJSON(content) as { threatLevel?: number; threatDrivers?: string[] };
    return {
      threatLevel: clamp(typeof data.threatLevel === 'number' ? data.threatLevel : 50, 0, 100),
      threatDrivers: Array.isArray(data.threatDrivers) ? data.threatDrivers : [],
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Step 8: Assign Visualization Positions
// ============================================================================

function assignVisualizationPositions(competitors: ScoredCompetitor[]): ScoredCompetitor[] {
  return competitors.map((competitor) => {
    // X-axis: Offer similarity (left = different, right = similar)
    // Y-axis: Audience similarity (bottom = different, top = similar)
    // Map 0-100 scores to -100 to 100 range
    const xPosition = (competitor.offerSimilarity - 50) * 2;
    const yPosition = (competitor.audienceSimilarity - 50) * 2;

    // Add some jitter to prevent overlap
    const jitterX = (Math.random() - 0.5) * 10;
    const jitterY = (Math.random() - 0.5) * 10;

    return {
      ...competitor,
      xPosition: clamp(xPosition + jitterX, -100, 100),
      yPosition: clamp(yPosition + jitterY, -100, 100),
    };
  });
}

// ============================================================================
// Build Result
// ============================================================================

function buildRunResult(runId: string, competitors: ScoredCompetitor[]): CompetitionRunResult {
  const activeCompetitors = competitors.filter((c) => !c.provenance.removed);

  const summary: CompetitionSummary = {
    totalDiscovered: activeCompetitors.length,
    coreCount: activeCompetitors.filter((c) => c.role === 'core').length,
    secondaryCount: activeCompetitors.filter((c) => c.role === 'secondary').length,
    alternativeCount: activeCompetitors.filter((c) => c.role === 'alternative').length,
    avgOfferSimilarity:
      activeCompetitors.length > 0
        ? Math.round(
            activeCompetitors.reduce((sum, c) => sum + c.offerSimilarity, 0) /
              activeCompetitors.length
          )
        : 0,
    avgAudienceSimilarity:
      activeCompetitors.length > 0
        ? Math.round(
            activeCompetitors.reduce((sum, c) => sum + c.audienceSimilarity, 0) /
              activeCompetitors.length
          )
        : 0,
    topThreat:
      activeCompetitors
        .filter((c) => c.threatLevel !== null)
        .sort((a, b) => (b.threatLevel || 0) - (a.threatLevel || 0))[0]?.competitorName || null,
    dataConfidence: 0, // Will be calculated and updated separately
    humanOverrideCount: activeCompetitors.filter((c) => c.provenance.humanOverride).length,
  };

  return {
    runId,
    status: 'completed',
    competitors: activeCompetitors,
    summary,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function extractJSON(content: string): Record<string, unknown> {
  try {
    // Try to find JSON in the content
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch {
    console.warn('[competition] Failed to extract JSON from content');
    return {};
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
