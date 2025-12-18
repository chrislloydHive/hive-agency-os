// lib/competition/discoveryV2.ts
// Competition Lab v2 - Discovery Pipeline
//
// Reliable competitor discovery with:
// - Step tracking for observability
// - Zod schema validation for AI responses
// - Proper error handling (no silent failures)
// - Domain normalization and deduplication
// - Price tier derivation

import { z } from 'zod';
import { aiSimple } from '@/lib/ai-gateway';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import {
  createCompetitionRun,
  updateCompetitionRun,
  updateRunStatus,
  calculateDataConfidence,
} from './store';
import {
  type CompetitionRun,
  type DiscoveredCandidate,
  type ScoredCompetitor,
  type CompetitorSearchSource,
  type SimplePriceTier,
  type CompetitionRunStats,
  DiscoveredCandidatesSchema,
  generateCompetitorId,
  startStep,
  completeStep,
  failStep,
  normalizeDomain,
  resolvePriceTier,
  calculatePriceTierOverlap,
  calculateOverallScore,
  classifyCompetitorRole,
  computeRunStats,
} from './types';
import {
  COMPETITOR_DISCOVERY_SYSTEM_PROMPT,
  buildDiscoveryPrompt,
  ENRICHMENT_SYSTEM_PROMPT,
  getEnrichmentPrompt,
  SCORING_SYSTEM_PROMPT,
  getScoringPrompt,
  getWhyThisCompetitorMattersPrompt,
  getThreatAssessmentPrompt,
} from './prompts';

// ============================================================================
// Configuration
// ============================================================================

const MAX_CANDIDATES = 30;
const ENRICHMENT_BATCH_SIZE = 4;
const SCORING_BATCH_SIZE = 4;

// ============================================================================
// Context Types
// ============================================================================

interface DiscoveryContext {
  companyId: string;
  businessName: string;
  domain: string | null;
  industry: string | null;
  primaryOffers: string[];
  icpDescription: string | null;
  geographicFootprint: string | null;
  marketPosition: string | null;
  priceTier: SimplePriceTier | null;
  humanProvidedCompetitors: Array<{ name: string; domain?: string }>;
}

// ============================================================================
// Search Provider Interface
// ============================================================================

interface SearchProviderParams {
  companyContext: DiscoveryContext;
}

interface SearchProviderResult {
  candidates: DiscoveredCandidate[];
  sourceUsed: CompetitorSearchSource;
  queriesUsed: string[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Run Competition Discovery V2
 *
 * This is the main entry point that orchestrates the entire discovery pipeline.
 * It creates a run record and executes each step with proper error handling.
 */
export async function runCompetitionV2(args: {
  companyId: string;
}): Promise<CompetitionRun> {
  console.log(`[competition-v2] Starting discovery for company: ${args.companyId}`);

  // Create the run record
  let run = await createCompetitionRun({ companyId: args.companyId });
  const runId = run.id;

  try {
    // ========================================================================
    // Step 1: Load Context
    // ========================================================================
    run = startStep(run, 'loadContext');
    await updateCompetitionRun(runId, { steps: run.steps, status: 'discovering' });

    const context = await loadDiscoveryContext(args.companyId);
    if (!context) {
      throw new Error('Failed to load company context from Brain. Ensure the company has context data.');
    }
    console.log(`[competition-v2] Loaded context for: ${context.businessName}`);

    run = completeStep(run, 'loadContext');
    await updateCompetitionRun(runId, { steps: run.steps });

    // ========================================================================
    // Step 2: Generate Queries (implicit in search)
    // ========================================================================
    run = startStep(run, 'generateQueries');
    await updateCompetitionRun(runId, { steps: run.steps });

    // Generate a simple query list for logging
    const queries = generateQueries(context);
    run = {
      ...run,
      querySummary: {
        queriesGenerated: queries,
        sourcesUsed: [],
      },
    };
    run = completeStep(run, 'generateQueries');
    await updateCompetitionRun(runId, {
      steps: run.steps,
      querySummary: run.querySummary,
    });

    // ========================================================================
    // Step 3: Discover Candidates
    // ========================================================================
    run = startStep(run, 'discover');
    await updateCompetitionRun(runId, { steps: run.steps });

    const searchResult = await searchForCompetitorsV2({ companyContext: context });

    // Add human-provided competitors
    const humanCandidates = context.humanProvidedCompetitors.map((hc) => ({
      name: hc.name,
      domain: normalizeDomain(hc.domain),
      homepageUrl: hc.domain ? (hc.domain.includes('://') ? hc.domain : `https://${hc.domain}`) : null,
      shortSummary: null,
      geo: null,
      priceTierGuess: null,
      source: 'manual' as const,
      sourceNote: 'Provided by user in Brain context',
    }));

    // Deduplicate by domain
    const allCandidates = dedupeCandidatesByDomain([...humanCandidates, ...searchResult.candidates]);
    const candidateCount = allCandidates.length;

    console.log(`[competition-v2] Discovered ${candidateCount} unique candidates`);

    run = {
      ...run,
      discoveredCandidates: allCandidates,
      querySummary: {
        queriesGenerated: searchResult.queriesUsed,
        sourcesUsed: [searchResult.sourceUsed, ...(humanCandidates.length > 0 ? ['manual' as const] : [])],
      },
      candidatesDiscovered: candidateCount,
    };
    run = completeStep(run, 'discover');
    await updateCompetitionRun(runId, {
      steps: run.steps,
      discoveredCandidates: run.discoveredCandidates,
      querySummary: run.querySummary,
      candidatesDiscovered: candidateCount,
    });

    if (candidateCount === 0) {
      throw new Error('No competitors discovered. Try adding competitors manually or improving company context.');
    }

    // ========================================================================
    // Step 4: Enrich Candidates
    // ========================================================================
    run = startStep(run, 'enrich');
    await updateCompetitionRun(runId, { steps: run.steps, status: 'enriching' });

    const enrichedCandidates = await enrichCandidates(
      allCandidates.slice(0, MAX_CANDIDATES),
      context
    );

    console.log(`[competition-v2] Enriched ${enrichedCandidates.length} candidates`);

    run = {
      ...run,
      candidatesEnriched: enrichedCandidates.length,
    };
    run = completeStep(run, 'enrich');
    await updateCompetitionRun(runId, {
      steps: run.steps,
      candidatesEnriched: enrichedCandidates.length,
    });

    // ========================================================================
    // Step 5: Score Candidates
    // ========================================================================
    run = startStep(run, 'score');
    await updateCompetitionRun(runId, { steps: run.steps, status: 'scoring' });

    const scoredCompetitors = await scoreCompetitors(enrichedCandidates, context);

    console.log(`[competition-v2] Scored ${scoredCompetitors.length} competitors`);

    run = completeStep(run, 'score');
    await updateCompetitionRun(runId, {
      steps: run.steps,
      candidatesScored: scoredCompetitors.length,
    });

    // ========================================================================
    // Step 6: Classify Roles
    // ========================================================================
    run = startStep(run, 'classify');
    await updateCompetitionRun(runId, { steps: run.steps, status: 'classifying' });

    const classifiedCompetitors = classifyCompetitors(scoredCompetitors);

    // Compute stats
    const stats = computeRunStats(
      classifiedCompetitors,
      candidateCount,
      enrichedCandidates.length
    );

    run = completeStep(run, 'classify');
    await updateCompetitionRun(runId, { steps: run.steps });

    // ========================================================================
    // Step 7: Analyze (Strategic insights for top competitors)
    // ========================================================================
    run = startStep(run, 'analyze');
    await updateCompetitionRun(runId, { steps: run.steps });

    // Only analyze top competitors to save time/cost
    const topCompetitors = classifiedCompetitors.filter(
      (c) => c.role === 'core' || (c.role === 'secondary' && c.overallScore >= 65)
    );
    const analyzedCompetitors = await analyzeCompetitors(
      classifiedCompetitors,
      topCompetitors.map((c) => c.id),
      context
    );

    run = completeStep(run, 'analyze');
    await updateCompetitionRun(runId, { steps: run.steps });

    // ========================================================================
    // Step 8: Position (x/y for visualization)
    // ========================================================================
    run = startStep(run, 'position');
    await updateCompetitionRun(runId, { steps: run.steps });

    const positionedCompetitors = assignPositions(analyzedCompetitors);

    run = completeStep(run, 'position');

    // ========================================================================
    // Finalize
    // ========================================================================
    const confidence = calculateDataConfidence({
      ...run,
      competitors: positionedCompetitors,
    });

    const finalRun = await updateCompetitionRun(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      steps: run.steps,
      competitors: positionedCompetitors,
      stats,
      dataConfidenceScore: confidence,
    });

    console.log(`[competition-v2] Completed discovery for company: ${args.companyId}`);
    console.log(`[competition-v2] Found ${positionedCompetitors.length} competitors (${stats.coreCount} core, ${stats.secondaryCount} secondary, ${stats.alternativeCount} alternative)`);

    return finalRun;

  } catch (error) {
    console.error(`[competition-v2] Discovery failed:`, error);

    // Find the currently running step and mark it as failed
    const currentStep = run.steps.find((s) => s.status === 'running');
    if (currentStep) {
      run = failStep(run, currentStep.name, String(error));
    }

    // Update run to failed state
    const failedRun = await updateCompetitionRun(runId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      steps: run.steps,
      errors: [...(run.errors || []), String(error)],
    });

    return failedRun;
  }
}

// ============================================================================
// Step 1: Load Context
// ============================================================================

async function loadDiscoveryContext(companyId: string): Promise<DiscoveryContext | null> {
  try {
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      console.warn(`[competition-v2] No context graph found for company: ${companyId}`);
      return null;
    }

    const identity = graph.identity;
    const audience = graph.audience;
    const competitive = graph.competitive;
    const productOffer = graph.productOffer;
    const brand = graph.brand;

    // Extract human-provided competitors
    const humanProvidedCompetitors: Array<{ name: string; domain?: string }> = [];
    const competitors = competitive?.competitors?.value || [];
    for (const c of competitors) {
      if (c && typeof c === 'object' && 'name' in c && typeof c.name === 'string') {
        humanProvidedCompetitors.push({
          name: c.name,
          domain: 'domain' in c && typeof c.domain === 'string' ? c.domain : undefined,
        });
      }
    }

    // Extract company domain from meta if available
    // The domain is stored at meta level, not in identity
    let companyDomain: string | null = null;
    const metaDomain = (graph.meta as Record<string, unknown>)?.domain as string | undefined;
    if (metaDomain) {
      companyDomain = normalizeDomain(metaDomain);
    }

    // Derive price tier from context - use pricingNotes or priceRange
    const pricingContext = productOffer?.pricingNotes?.value || productOffer?.priceRange?.value || brand?.positioning?.value || '';
    const priceTier = resolvePriceTier(null, pricingContext);

    return {
      companyId,
      businessName: identity?.businessName?.value || graph.companyName || 'Unknown',
      domain: companyDomain,
      industry: identity?.industry?.value || null,
      primaryOffers: productOffer?.productLines?.value || [],
      icpDescription: audience?.icpDescription?.value || null,
      geographicFootprint: identity?.geographicFootprint?.value || null,
      marketPosition: brand?.positioning?.value || null,
      priceTier,
      humanProvidedCompetitors,
    };
  } catch (error) {
    console.error(`[competition-v2] Failed to load context:`, error);
    return null;
  }
}

// ============================================================================
// Step 2: Generate Queries
// ============================================================================

function generateQueries(context: DiscoveryContext): string[] {
  const queries: string[] = [];

  // Brand queries
  queries.push(`${context.businessName} competitors`);
  queries.push(`${context.businessName} alternatives`);
  queries.push(`companies like ${context.businessName}`);

  // Industry queries
  if (context.industry) {
    queries.push(`best ${context.industry} companies`);
    queries.push(`top ${context.industry} providers`);
  }

  // Geo queries
  if (context.geographicFootprint) {
    queries.push(`${context.industry || 'companies'} in ${context.geographicFootprint}`);
  }

  return queries;
}

// ============================================================================
// Step 3: Discover Candidates
// ============================================================================

/**
 * Search for competitors using AI simulation
 */
async function searchForCompetitorsV2(
  params: SearchProviderParams
): Promise<SearchProviderResult> {
  const { companyContext } = params;

  console.log(`[competition-v2] Searching for competitors of: ${companyContext.businessName}`);

  // Build the prompt
  const prompt = buildDiscoveryPrompt({
    businessName: companyContext.businessName,
    domain: companyContext.domain,
    industry: companyContext.industry,
    primaryOffers: companyContext.primaryOffers,
    icpDescription: companyContext.icpDescription,
    geographicFootprint: companyContext.geographicFootprint,
    marketPosition: companyContext.marketPosition,
  });

  try {
    // Call AI
    const response = await aiSimple({
      systemPrompt: COMPETITOR_DISCOVERY_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.4,
      maxTokens: 2000,
      jsonMode: true,
    });

    console.log(`[competition-v2] AI response received (${response.length} chars)`);

    // Parse JSON
    const parsed = safeJsonParse(response);
    if (!parsed) {
      console.error(`[competition-v2] Failed to parse AI response as JSON`);
      throw new Error('AI returned invalid JSON. Please try again.');
    }

    // Validate with Zod schema
    // Handle both array format and object-with-array format
    let rawCandidates: unknown[];
    if (Array.isArray(parsed)) {
      rawCandidates = parsed;
    } else if (parsed && typeof parsed === 'object') {
      // Try common wrapper keys: competitors, results, data, items
      const obj = parsed as Record<string, unknown>;
      rawCandidates = Array.isArray(obj.competitors) ? obj.competitors
        : Array.isArray(obj.results) ? obj.results
        : Array.isArray(obj.data) ? obj.data
        : Array.isArray(obj.items) ? obj.items
        : [];

      if (rawCandidates.length === 0) {
        console.warn(`[competition-v2] AI returned object but no array found. Keys: ${Object.keys(obj).join(', ')}`);
        // Log a preview of what we got
        console.warn(`[competition-v2] Response preview:`, JSON.stringify(parsed).slice(0, 500));
      }
    } else {
      rawCandidates = [];
      console.warn(`[competition-v2] AI returned unexpected type: ${typeof parsed}`);
    }

    // Transform to match our schema (add defaults for missing fields)
    const transformedCandidates = rawCandidates.map((item) => {
      const c = item as Record<string, unknown>;
      return {
        name: typeof c.name === 'string' ? c.name : 'Unknown',
        domain: normalizeDomain(c.homepageUrl as string | null),
        homepageUrl: typeof c.homepageUrl === 'string' ? c.homepageUrl : null,
        shortSummary: typeof c.shortSummary === 'string' ? c.shortSummary : null,
        geo: typeof c.geo === 'string' ? c.geo : null,
        priceTierGuess: validatePriceTier(c.priceTierGuess),
        source: 'ai_simulation' as const,
        sourceNote: typeof c.sourceNote === 'string' ? c.sourceNote : null,
      };
    });

    // Filter out invalid entries
    const validCandidates = transformedCandidates.filter(
      (c) => c.name && c.name !== 'Unknown' && c.name.length >= 2
    );

    console.log(`[competition-v2] Parsed ${validCandidates.length} valid candidates from AI response`);

    // Filter out the target company
    const targetDomain = companyContext.domain?.toLowerCase();
    const targetName = companyContext.businessName.toLowerCase();
    const filteredCandidates = validCandidates.filter((c) => {
      const candidateDomain = c.domain?.toLowerCase();
      const candidateName = c.name.toLowerCase();
      return candidateDomain !== targetDomain && candidateName !== targetName;
    });

    return {
      candidates: filteredCandidates,
      sourceUsed: 'ai_simulation',
      queriesUsed: generateQueries(companyContext),
    };

  } catch (error) {
    console.error(`[competition-v2] Discovery search failed:`, error);
    throw new Error(`Competitor discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validatePriceTier(value: unknown): SimplePriceTier | null {
  if (value === 'low' || value === 'mid' || value === 'high') {
    return value;
  }
  return null;
}

function safeJsonParse(text: string): unknown | null {
  try {
    // First try direct parse
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue to next attempt
      }
    }

    // Try to find array or object pattern
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // Continue
      }
    }

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue
      }
    }

    return null;
  }
}

function dedupeCandidatesByDomain(candidates: DiscoveredCandidate[]): DiscoveredCandidate[] {
  const seen = new Map<string, DiscoveredCandidate>();

  for (const candidate of candidates) {
    const key = candidate.domain?.toLowerCase() || candidate.name.toLowerCase();

    // Prefer candidates with more data
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, candidate);
    } else if (candidate.source === 'manual') {
      // Manual entries take priority
      seen.set(key, candidate);
    } else if (candidate.shortSummary && !existing.shortSummary) {
      // Prefer candidates with summaries
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Step 4: Enrich Candidates
// ============================================================================

interface EnrichedCandidate extends DiscoveredCandidate {
  enrichedData: ScoredCompetitor['enrichedData'];
}

async function enrichCandidates(
  candidates: DiscoveredCandidate[],
  context: DiscoveryContext
): Promise<EnrichedCandidate[]> {
  const enriched: EnrichedCandidate[] = [];

  // Process in batches
  for (let i = 0; i < candidates.length; i += ENRICHMENT_BATCH_SIZE) {
    const batch = candidates.slice(i, i + ENRICHMENT_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((candidate) => enrichCandidate(candidate, context))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        enriched.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn(`[competition-v2] Failed to enrich ${batch[j].name}:`, result.reason);
        // Still include with minimal data
        enriched.push({
          ...batch[j],
          enrichedData: createEmptyEnrichment(),
        });
      }
    }
  }

  return enriched;
}

async function enrichCandidate(
  candidate: DiscoveredCandidate,
  context: DiscoveryContext
): Promise<EnrichedCandidate> {
  try {
    const prompt = getEnrichmentPrompt(
      candidate.name,
      candidate.domain,
      candidate.shortSummary || undefined
    );

    const response = await aiSimple({
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.2,
      maxTokens: 1500,
      jsonMode: true,
    });

    const parsed = safeJsonParse(response);
    if (!parsed || typeof parsed !== 'object') {
      return {
        ...candidate,
        enrichedData: createEmptyEnrichment(),
      };
    }

    const data = parsed as Record<string, unknown>;

    return {
      ...candidate,
      enrichedData: {
        companyType: typeof data.companyType === 'string' ? data.companyType : null,
        category: typeof data.category === 'string' ? data.category : null,
        summary: typeof data.summary === 'string' ? data.summary : candidate.shortSummary,
        tagline: typeof data.tagline === 'string' ? data.tagline : null,
        targetAudience: typeof data.targetAudience === 'string' ? data.targetAudience : null,
        icpDescription: typeof data.icpDescription === 'string' ? data.icpDescription : null,
        companySizeTarget: typeof data.companySizeTarget === 'string' ? data.companySizeTarget : null,
        geographicFocus: typeof data.geographicFocus === 'string' ? data.geographicFocus : candidate.geo,
        headquartersLocation: typeof data.headquartersLocation === 'string' ? data.headquartersLocation : null,
        serviceAreas: Array.isArray(data.serviceAreas) ? data.serviceAreas.filter((x): x is string => typeof x === 'string') : [],
        primaryOffers: Array.isArray(data.primaryOffers) ? data.primaryOffers.filter((x): x is string => typeof x === 'string') : [],
        uniqueFeatures: Array.isArray(data.uniqueFeatures) ? data.uniqueFeatures.filter((x): x is string => typeof x === 'string') : [],
        pricingTier: validateLegacyPriceTier(data.pricingTier),
        pricingModel: typeof data.pricingModel === 'string' ? data.pricingModel : null,
        estimatedPriceRange: typeof data.estimatedPriceRange === 'string' ? data.estimatedPriceRange : null,
        brandScale: validateBrandScale(data.brandScale),
        estimatedEmployees: typeof data.estimatedEmployees === 'number' ? data.estimatedEmployees : null,
        foundedYear: typeof data.foundedYear === 'number' ? data.foundedYear : null,
        positioning: typeof data.positioning === 'string' ? data.positioning : null,
        valueProposition: typeof data.valueProposition === 'string' ? data.valueProposition : null,
        differentiators: Array.isArray(data.differentiators) ? data.differentiators.filter((x): x is string => typeof x === 'string') : [],
        weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses.filter((x): x is string => typeof x === 'string') : [],
        primaryChannels: Array.isArray(data.primaryChannels) ? data.primaryChannels.filter((x): x is string => typeof x === 'string') : [],
        socialProof: Array.isArray(data.socialProof) ? data.socialProof.filter((x): x is string => typeof x === 'string') : [],
      },
    };
  } catch (error) {
    console.warn(`[competition-v2] Enrichment failed for ${candidate.name}:`, error);
    return {
      ...candidate,
      enrichedData: createEmptyEnrichment(),
    };
  }
}

function createEmptyEnrichment(): ScoredCompetitor['enrichedData'] {
  return {
    companyType: null,
    category: null,
    summary: null,
    tagline: null,
    targetAudience: null,
    icpDescription: null,
    companySizeTarget: null,
    geographicFocus: null,
    headquartersLocation: null,
    serviceAreas: [],
    primaryOffers: [],
    uniqueFeatures: [],
    pricingTier: null,
    pricingModel: null,
    estimatedPriceRange: null,
    brandScale: null,
    estimatedEmployees: null,
    foundedYear: null,
    positioning: null,
    valueProposition: null,
    differentiators: [],
    weaknesses: [],
    primaryChannels: [],
    socialProof: [],
  };
}

function validateLegacyPriceTier(value: unknown): 'budget' | 'mid' | 'premium' | 'enterprise' | null {
  const valid = ['budget', 'mid', 'premium', 'enterprise'];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as 'budget' | 'mid' | 'premium' | 'enterprise';
  }
  return null;
}

function validateBrandScale(value: unknown): 'startup' | 'smb' | 'mid_market' | 'enterprise' | 'dominant' | null {
  const valid = ['startup', 'smb', 'mid_market', 'enterprise', 'dominant'];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as 'startup' | 'smb' | 'mid_market' | 'enterprise' | 'dominant';
  }
  return null;
}

// ============================================================================
// Step 5: Score Competitors
// ============================================================================

async function scoreCompetitors(
  candidates: EnrichedCandidate[],
  context: DiscoveryContext
): Promise<ScoredCompetitor[]> {
  const scored: ScoredCompetitor[] = [];

  // Process in batches
  for (let i = 0; i < candidates.length; i += SCORING_BATCH_SIZE) {
    const batch = candidates.slice(i, i + SCORING_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((candidate) => scoreCandidate(candidate, context))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        scored.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn(`[competition-v2] Failed to score ${batch[j].name}:`, result.reason);
        // Include with default scores
        scored.push(createDefaultScoredCompetitor(batch[j], context));
      }
    }
  }

  // Sort by overall score descending
  return scored.sort((a, b) => b.overallScore - a.overallScore);
}

async function scoreCandidate(
  candidate: EnrichedCandidate,
  context: DiscoveryContext
): Promise<ScoredCompetitor> {
  try {
    const targetContext = {
      companyId: context.companyId,
      businessName: context.businessName,
      domain: context.domain,
      industry: context.industry,
      icpDescription: context.icpDescription,
      serviceArea: context.geographicFootprint,
      geographicFootprint: context.geographicFootprint,
      revenueModel: null,
      marketMaturity: null,
      priceTier: context.priceTier,
      primaryOffers: context.primaryOffers,
      humanProvidedCompetitors: [],
    };

    const prompt = getScoringPrompt(targetContext, candidate.enrichedData, candidate.name);

    const response = await aiSimple({
      systemPrompt: SCORING_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.1,
      maxTokens: 800,
      jsonMode: true,
    });

    const parsed = safeJsonParse(response);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultScoredCompetitor(candidate, context);
    }

    const data = parsed as Record<string, unknown>;

    const offerSimilarity = clampScore(data.offerSimilarity);
    const audienceSimilarity = clampScore(data.audienceSimilarity);
    const geoOverlap = clampScore(data.geoOverlap);

    // Calculate price tier overlap
    const competitorPriceTier = convertLegacyToSimplePriceTier(candidate.enrichedData.pricingTier);
    const priceTierOverlap = calculatePriceTierOverlap(context.priceTier, competitorPriceTier);

    const overallScore = calculateOverallScore({
      offerSimilarity,
      audienceSimilarity,
      geoOverlap,
      priceTierOverlap,
    });

    const isHumanProvided = candidate.source === 'manual';
    const role = classifyCompetitorRole(overallScore, offerSimilarity, audienceSimilarity, isHumanProvided);

    return {
      id: generateCompetitorId(),
      competitorName: candidate.name,
      competitorDomain: candidate.domain,
      homepageUrl: candidate.homepageUrl,
      shortSummary: candidate.enrichedData.summary || candidate.shortSummary,
      geo: candidate.enrichedData.geographicFocus || candidate.geo,
      priceTier: competitorPriceTier,
      role,
      overallScore,
      offerSimilarity,
      audienceSimilarity,
      geoOverlap,
      priceTierOverlap,
      compositeScore: overallScore,
      brandScale: candidate.enrichedData.brandScale,
      enrichedData: candidate.enrichedData,
      source: candidate.source,
      sourceNote: candidate.sourceNote,
      removedByUser: false,
      promotedByUser: isHumanProvided,
      provenance: {
        discoveredFrom: candidate.source === 'manual' ? ['human_provided'] : ['brand_query'],
        humanOverride: isHumanProvided,
        humanOverrideAt: isHumanProvided ? new Date().toISOString() : null,
        removed: false,
        removedAt: null,
        removedReason: null,
        promoted: false,
        promotedAt: null,
      },
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
    console.warn(`[competition-v2] Scoring failed for ${candidate.name}:`, error);
    return createDefaultScoredCompetitor(candidate, context);
  }
}

function createDefaultScoredCompetitor(
  candidate: EnrichedCandidate,
  context: DiscoveryContext
): ScoredCompetitor {
  const isHumanProvided = candidate.source === 'manual';
  const defaultScore = isHumanProvided ? 80 : 50;

  return {
    id: generateCompetitorId(),
    competitorName: candidate.name,
    competitorDomain: candidate.domain,
    homepageUrl: candidate.homepageUrl,
    shortSummary: candidate.enrichedData?.summary || candidate.shortSummary,
    geo: candidate.enrichedData?.geographicFocus || candidate.geo,
    priceTier: convertLegacyToSimplePriceTier(candidate.enrichedData?.pricingTier),
    role: isHumanProvided ? 'core' : 'alternative',
    overallScore: defaultScore,
    offerSimilarity: defaultScore,
    audienceSimilarity: defaultScore,
    geoOverlap: 50,
    priceTierOverlap: 50,
    compositeScore: defaultScore,
    brandScale: candidate.enrichedData?.brandScale || null,
    enrichedData: candidate.enrichedData || createEmptyEnrichment(),
    source: candidate.source,
    sourceNote: candidate.sourceNote,
    removedByUser: false,
    promotedByUser: isHumanProvided,
    provenance: {
      discoveredFrom: isHumanProvided ? ['human_provided'] : ['brand_query'],
      humanOverride: isHumanProvided,
      humanOverrideAt: isHumanProvided ? new Date().toISOString() : null,
      removed: false,
      removedAt: null,
      removedReason: null,
      promoted: false,
      promotedAt: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: null,
    xPosition: null,
    yPosition: null,
    whyThisCompetitorMatters: null,
    howTheyDiffer: null,
    threatLevel: null,
    threatDrivers: [],
  };
}

function clampScore(value: unknown): number {
  if (typeof value !== 'number') return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function convertLegacyToSimplePriceTier(
  legacy: 'budget' | 'mid' | 'premium' | 'enterprise' | null | undefined
): SimplePriceTier | null {
  if (!legacy) return null;
  if (legacy === 'budget') return 'low';
  if (legacy === 'mid') return 'mid';
  if (legacy === 'premium' || legacy === 'enterprise') return 'high';
  return null;
}

// ============================================================================
// Step 6: Classify Roles
// ============================================================================

function classifyCompetitors(competitors: ScoredCompetitor[]): ScoredCompetitor[] {
  // Limit per role
  const maxCore = 6;
  const maxSecondary = 12;
  const maxAlternative = 18;

  let coreCount = 0;
  let secondaryCount = 0;
  let alternativeCount = 0;

  const classified: ScoredCompetitor[] = [];

  for (const competitor of competitors) {
    let role = competitor.role;

    // Enforce limits
    if (role === 'core' && coreCount >= maxCore) {
      role = 'secondary';
    }
    if (role === 'secondary' && secondaryCount >= maxSecondary) {
      role = 'alternative';
    }
    if (role === 'alternative' && alternativeCount >= maxAlternative) {
      continue; // Skip
    }

    // Update counts
    if (role === 'core') coreCount++;
    else if (role === 'secondary') secondaryCount++;
    else alternativeCount++;

    classified.push({ ...competitor, role });
  }

  return classified;
}

// ============================================================================
// Step 7: Analyze
// ============================================================================

async function analyzeCompetitors(
  competitors: ScoredCompetitor[],
  idsToAnalyze: string[],
  context: DiscoveryContext
): Promise<ScoredCompetitor[]> {
  const targetContext = {
    companyId: context.companyId,
    businessName: context.businessName,
    domain: context.domain,
    industry: context.industry,
    icpDescription: context.icpDescription,
    serviceArea: context.geographicFootprint,
    geographicFootprint: context.geographicFootprint,
    revenueModel: null,
    marketMaturity: null,
    priceTier: context.priceTier,
    primaryOffers: context.primaryOffers,
    humanProvidedCompetitors: [],
  };

  return Promise.all(
    competitors.map(async (competitor) => {
      if (!idsToAnalyze.includes(competitor.id)) {
        return competitor;
      }

      try {
        // Generate "why this competitor matters" and threat assessment in parallel
        const [whyMatters, threatData] = await Promise.all([
          generateWhyMatters(competitor, targetContext),
          generateThreatAssessment(competitor, targetContext),
        ]);

        return {
          ...competitor,
          whyThisCompetitorMatters: whyMatters,
          howTheyDiffer: threatData.howTheyDiffer,
          threatLevel: threatData.threatLevel,
          threatDrivers: threatData.threatDrivers,
        };
      } catch (error) {
        console.warn(`[competition-v2] Analysis failed for ${competitor.competitorName}:`, error);
        return competitor;
      }
    })
  );
}

async function generateWhyMatters(
  competitor: ScoredCompetitor,
  context: {
    businessName: string;
    industry: string | null;
    icpDescription: string | null;
    primaryOffers: string[];
    priceTier: SimplePriceTier | null;
    geographicFootprint: string | null;
    serviceArea: string | null;
    marketMaturity: string | null;
    revenueModel: string | null;
    domain: string | null;
    companyId: string;
    humanProvidedCompetitors: string[];
  }
): Promise<string | null> {
  try {
    const prompt = getWhyThisCompetitorMattersPrompt(context, competitor.enrichedData, competitor.competitorName, {
      overallScore: competitor.overallScore,
      offerSimilarity: competitor.offerSimilarity,
      audienceSimilarity: competitor.audienceSimilarity,
    });

    const response = await aiSimple({
      systemPrompt: 'You are a strategic competitive analyst. Be concise and specific.',
      taskPrompt: prompt,
      temperature: 0.3,
      maxTokens: 300,
    });

    return response.trim() || null;
  } catch {
    return null;
  }
}

async function generateThreatAssessment(
  competitor: ScoredCompetitor,
  context: {
    businessName: string;
    industry: string | null;
    icpDescription: string | null;
    primaryOffers: string[];
    priceTier: SimplePriceTier | null;
    geographicFootprint: string | null;
    serviceArea: string | null;
    marketMaturity: string | null;
    revenueModel: string | null;
    domain: string | null;
    companyId: string;
    humanProvidedCompetitors: string[];
  }
): Promise<{ howTheyDiffer: string | null; threatLevel: number | null; threatDrivers: string[] }> {
  try {
    const prompt = getThreatAssessmentPrompt(context, competitor.enrichedData, competitor.competitorName, {
      overallScore: competitor.overallScore,
      offerSimilarity: competitor.offerSimilarity,
      audienceSimilarity: competitor.audienceSimilarity,
    });

    const response = await aiSimple({
      systemPrompt: 'You are a strategic competitive analyst. Respond with JSON only.',
      taskPrompt: prompt,
      temperature: 0.2,
      maxTokens: 400,
      jsonMode: true,
    });

    const parsed = safeJsonParse(response);
    if (!parsed || typeof parsed !== 'object') {
      return { howTheyDiffer: null, threatLevel: null, threatDrivers: [] };
    }

    const data = parsed as Record<string, unknown>;

    return {
      howTheyDiffer: null, // Generated separately if needed
      threatLevel: typeof data.threatLevel === 'number' ? clampScore(data.threatLevel) : null,
      threatDrivers: Array.isArray(data.threatDrivers)
        ? data.threatDrivers.filter((x): x is string => typeof x === 'string').slice(0, 3)
        : [],
    };
  } catch {
    return { howTheyDiffer: null, threatLevel: null, threatDrivers: [] };
  }
}

// ============================================================================
// Step 8: Position
// ============================================================================

function assignPositions(competitors: ScoredCompetitor[]): ScoredCompetitor[] {
  return competitors.map((competitor, index) => {
    // Base position on offer and audience similarity
    let xPosition = competitor.offerSimilarity;
    let yPosition = competitor.audienceSimilarity;

    // Add small jitter to prevent overlap
    const jitter = (index % 5) * 2 - 4;
    xPosition = Math.max(0, Math.min(100, xPosition + jitter));
    yPosition = Math.max(0, Math.min(100, yPosition + ((index % 3) * 2 - 2)));

    return {
      ...competitor,
      xPosition,
      yPosition,
    };
  });
}

// ============================================================================
// Exports (Legacy compatibility)
// ============================================================================

export { runCompetitionV2 as runCompetitionDiscoveryV2 };
