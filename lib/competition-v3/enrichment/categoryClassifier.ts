// lib/competition-v3/enrichment/categoryClassifier.ts
// Six-Category Competitor Classification for Competition Lab V3
//
// Classifies competitors into:
// - direct: Same business model + same ICP + overlapping services
// - partial: Category neighbor - shares ICP or services but not both
// - fractional: Fractional executive competitor (CMO, growth advisor)
// - internal: Internal hire / DIY alternative
// - platform: SaaS tools that replace part of the service
// - irrelevant: Not a real competitor (filtered out)

import { aiSimple } from '@/lib/ai-gateway';
import type { QueryContext, EnrichedCandidate, CompetitorType, ClassificationResult } from '../types';

// ============================================================================
// Classification
// ============================================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You are a competitive intelligence analyst specializing in B2B market analysis.

Your task is to classify competitors into one of six categories based on their relationship to a target company.

Classification Rules:
1. DIRECT: Same business model + same ICP + overlapping services. These directly compete for the same customers.
2. PARTIAL (Category Neighbor): Shares EITHER ICP or services but not both. Adjacent competitors.
3. FRACTIONAL: Fractional executive services (CMO, VP Marketing, etc.). Individual consultants or small firms offering fractional leadership.
4. INTERNAL: Internal hire alternative. What a company might hire instead of using the target (e.g., in-house marketer).
5. PLATFORM: SaaS tools or platforms that replace some of the target's services.
6. IRRELEVANT: Not actually a competitor (wrong industry, too different, or not a real company).

Be precise in your classification. Consider:
- Business model similarity (agency vs consultancy vs SaaS vs freelancer)
- ICP overlap (same target customers?)
- Service overlap (similar offerings?)
- Size/scale differences
- Geographic relevance`;

/**
 * Classify a batch of candidates
 */
export async function classifyCandidates(
  candidates: EnrichedCandidate[],
  context: QueryContext
): Promise<Array<EnrichedCandidate & { classification: ClassificationResult }>> {
  console.log(`[competition-v3/classifier] Classifying ${candidates.length} candidates`);

  // Process in batches of 5 for efficiency
  const batchSize = 5;
  const results: Array<EnrichedCandidate & { classification: ClassificationResult }> = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await classifyBatch(batch, context);
    results.push(...batchResults);
  }

  console.log(`[competition-v3/classifier] Classified ${results.length} candidates`);

  // Log distribution
  const distribution = results.reduce((acc, r) => {
    acc[r.classification.type] = (acc[r.classification.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[competition-v3/classifier] Distribution:`, distribution);

  return results;
}

/**
 * Classify a batch of candidates
 */
async function classifyBatch(
  candidates: EnrichedCandidate[],
  context: QueryContext
): Promise<Array<EnrichedCandidate & { classification: ClassificationResult }>> {
  const prompt = buildClassificationPrompt(candidates, context);

  try {
    const response = await aiSimple({
      systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.2,
      maxTokens: 2000,
      jsonMode: true,
    });

    const classifications = parseClassificationResponse(response, candidates);
    return classifications;
  } catch (error) {
    console.error('[competition-v3/classifier] Batch classification failed:', error);
    // Return with default classification
    return candidates.map(c => ({
      ...c,
      classification: {
        type: 'partial' as CompetitorType,
        confidence: 0.5,
        reasoning: 'Classification failed - defaulting to partial',
        signals: {
          businessModelMatch: false,
          icpOverlap: false,
          serviceOverlap: false,
          sameMarket: false,
          isPlatform: false,
          isFractional: false,
          isInternalAlt: false,
        },
      },
    }));
  }
}

/**
 * Build classification prompt
 */
function buildClassificationPrompt(
  candidates: EnrichedCandidate[],
  context: QueryContext
): string {
  const candidateDescriptions = candidates.map((c, i) => {
    const metadata = c.metadata;
    return `
CANDIDATE ${i + 1}: ${c.name}
- Domain: ${c.domain || 'Unknown'}
- Summary: ${c.aiSummary || c.snippet || 'No summary available'}
- Business Model: ${metadata?.businessModel || 'Unknown'}
- Team Size: ${metadata?.teamSize || 'Unknown'}
- Pricing Tier: ${metadata?.pricingTier || 'Unknown'}
- Services: ${c.crawledContent?.services?.offerings?.join(', ') || 'Unknown'}
- Has AI: ${metadata?.hasAICapabilities ? 'Yes' : 'No'}
- Strengths: ${c.aiStrengths?.slice(0, 3).join(', ') || 'Unknown'}`;
  }).join('\n');

  return `Classify each competitor below relative to the target company.

TARGET COMPANY: ${context.businessName}
- Domain: ${context.domain || 'Unknown'}
- Industry: ${context.industry || 'Marketing'}
- Business Model: ${context.businessModel || 'Agency'}
- ICP: ${context.icpDescription || 'Unknown'}
- ICP Stage: ${context.icpStage || 'Unknown'}
- Primary Services: ${context.primaryOffers.join(', ') || 'Unknown'}
- Price Position: ${context.pricePositioning || 'Unknown'}
- Geography: ${context.geography || 'Unknown'}
- AI Orientation: ${context.aiOrientation || 'Unknown'}

COMPETITORS TO CLASSIFY:
${candidateDescriptions}

For each candidate, determine:
1. type: "direct" | "partial" | "fractional" | "internal" | "platform" | "irrelevant"
2. confidence: 0-1 (how confident are you in this classification)
3. reasoning: Brief explanation
4. signals: Which signals led to this classification

Return JSON:
{
  "classifications": [
    {
      "candidateIndex": 0,
      "type": "direct",
      "confidence": 0.9,
      "reasoning": "Same agency model targeting startups with similar services",
      "signals": {
        "businessModelMatch": true,
        "icpOverlap": true,
        "serviceOverlap": true,
        "sameMarket": true,
        "isPlatform": false,
        "isFractional": false,
        "isInternalAlt": false
      }
    }
  ]
}`;
}

/**
 * Parse classification response
 */
function parseClassificationResponse(
  response: string,
  candidates: EnrichedCandidate[]
): Array<EnrichedCandidate & { classification: ClassificationResult }> {
  try {
    const parsed = JSON.parse(response);
    const classifications = parsed.classifications || [];

    return candidates.map((candidate, index) => {
      const classification = classifications.find(
        (c: any) => c.candidateIndex === index
      ) || {
        type: 'partial',
        confidence: 0.5,
        reasoning: 'No classification provided',
        signals: {},
      };

      return {
        ...candidate,
        classification: {
          type: validateCompetitorType(classification.type),
          confidence: typeof classification.confidence === 'number'
            ? Math.min(1, Math.max(0, classification.confidence))
            : 0.5,
          reasoning: classification.reasoning || '',
          signals: {
            businessModelMatch: !!classification.signals?.businessModelMatch,
            icpOverlap: !!classification.signals?.icpOverlap,
            serviceOverlap: !!classification.signals?.serviceOverlap,
            sameMarket: !!classification.signals?.sameMarket,
            isPlatform: !!classification.signals?.isPlatform,
            isFractional: !!classification.signals?.isFractional,
            isInternalAlt: !!classification.signals?.isInternalAlt,
          },
        },
      };
    });
  } catch (error) {
    console.error('[competition-v3/classifier] Error parsing response:', error);
    return candidates.map(c => ({
      ...c,
      classification: {
        type: 'partial' as CompetitorType,
        confidence: 0.5,
        reasoning: 'Parse error - defaulting to partial',
        signals: {
          businessModelMatch: false,
          icpOverlap: false,
          serviceOverlap: false,
          sameMarket: false,
          isPlatform: false,
          isFractional: false,
          isInternalAlt: false,
        },
      },
    }));
  }
}

/**
 * Validate competitor type
 */
function validateCompetitorType(type: unknown): CompetitorType {
  const validTypes: CompetitorType[] = ['direct', 'partial', 'fractional', 'internal', 'platform', 'irrelevant'];
  if (typeof type === 'string' && validTypes.includes(type as CompetitorType)) {
    return type as CompetitorType;
  }
  return 'partial';
}

// ============================================================================
// Bad-Fit Detection & Negative Filters
// ============================================================================

/**
 * Signals that indicate a bad-fit candidate
 */
export interface BadFitSignals {
  isPurePlatform: boolean;       // HubSpot, Marketo, etc.
  isVeryLargeAgency: boolean;    // 500+ employees, global network
  isEnterpriseOnly: boolean;     // Fortune 500, enterprise-only
  isB2CLocal: boolean;           // Dentists, plumbers, restaurants
  isWrongIndustry: boolean;      // Completely unrelated industry
}

/**
 * Known pure platform domains to exclude or cap
 */
const PURE_PLATFORM_DOMAINS = new Set([
  'hubspot.com', 'marketo.com', 'mailchimp.com', 'salesforce.com',
  'adobe.com', 'oracle.com', 'pardot.com', 'eloqua.com',
  'activecampaign.com', 'klaviyo.com', 'braze.com', 'iterable.com',
  'sendgrid.com', 'intercom.com', 'drift.com', 'hootsuite.com',
  'sproutsocial.com', 'buffer.com', 'later.com', 'canva.com',
  'semrush.com', 'ahrefs.com', 'moz.com', 'buzzsumo.com',
  'google.com', 'meta.com', 'facebook.com', 'linkedin.com',
]);

/**
 * Keywords that indicate pure platform (not services)
 */
const PLATFORM_KEYWORDS = [
  'software', 'platform', 'crm', 'marketing automation',
  'saas tool', 'self-serve', 'free trial', 'pricing plans',
  'api', 'integrations', 'developer', 'sign up free',
];

/**
 * Keywords that indicate enterprise-only focus
 */
const ENTERPRISE_ONLY_KEYWORDS = [
  'fortune 500', 'fortune 1000', 'enterprise-only', 'large enterprises',
  'global brands', 'multinational', 'global network', '$1B+', 'billion dollar',
];

/**
 * Keywords that indicate B2C/local service focus
 */
const B2C_LOCAL_KEYWORDS = [
  'dentists', 'plumbers', 'restaurants', 'salons', 'chiropractors',
  'local seo', 'local business', 'small business marketing',
  'home services', 'contractors', 'real estate agents',
  'medical practices', 'law firms', // These are B2C/local oriented
];

/**
 * Detect bad-fit signals for a candidate
 */
export function detectBadFitSignals(
  candidate: EnrichedCandidate,
  context: QueryContext
): BadFitSignals {
  const domain = candidate.domain?.toLowerCase() || '';
  const name = candidate.name.toLowerCase();
  const snippet = candidate.snippet?.toLowerCase() || '';
  const summary = candidate.aiSummary?.toLowerCase() || '';
  const content = candidate.crawledContent;
  const metadata = candidate.metadata;

  // Combine all text for keyword matching
  const allText = [
    snippet,
    summary,
    content?.homepage.title,
    content?.homepage.h1,
    content?.homepage.description,
    ...(content?.services?.offerings || []),
    ...(content?.industries || []),
  ].filter(Boolean).join(' ').toLowerCase();

  // 1. Pure Platform detection
  const isPurePlatform =
    PURE_PLATFORM_DOMAINS.has(domain) ||
    PLATFORM_KEYWORDS.filter(kw => allText.includes(kw)).length >= 3 ||
    (metadata?.businessModel === 'saas' && !allText.includes('agency') && !allText.includes('services'));

  // 2. Very Large Agency detection (500+ or global network)
  const isVeryLargeAgency =
    (metadata?.teamSizeEstimate && metadata.teamSizeEstimate > 500) ||
    metadata?.teamSize === 'enterprise' ||
    allText.includes('global offices') ||
    allText.includes('global network') ||
    (allText.includes('500+') && allText.includes('employees'));

  // 3. Enterprise-Only detection
  const isEnterpriseOnly =
    ENTERPRISE_ONLY_KEYWORDS.some(kw => allText.includes(kw)) ||
    (allText.includes('enterprise') && !allText.includes('startup') && !allText.includes('growth'));

  // 4. B2C/Local detection (only if our ICP is B2B)
  const icpIsB2B = context.icpDescription?.toLowerCase().includes('b2b') ||
    context.targetIndustries.some(i => i.toLowerCase().includes('saas') || i.toLowerCase().includes('tech'));
  const isB2CLocal = icpIsB2B && B2C_LOCAL_KEYWORDS.some(kw => allText.includes(kw));

  // 5. Wrong Industry (completely unrelated)
  const isWrongIndustry =
    (allText.includes('healthcare provider') && !context.targetIndustries.some(i => i.toLowerCase().includes('health'))) ||
    (allText.includes('financial services') && !context.targetIndustries.some(i => i.toLowerCase().includes('fintech'))) ||
    allText.includes('recruitment agency') ||
    allText.includes('staffing agency');

  return {
    isPurePlatform,
    isVeryLargeAgency,
    isEnterpriseOnly,
    isB2CLocal,
    isWrongIndustry,
  };
}

/**
 * Determine if candidate should be excluded entirely
 */
export function shouldExcludeCandidate(signals: BadFitSignals): boolean {
  // Exclude if wrong industry or purely B2C/local when we're B2B
  return signals.isWrongIndustry || signals.isB2CLocal;
}

/**
 * Get threat score cap based on bad-fit signals
 * Returns null if no cap should be applied
 */
export function getThreatScoreCap(signals: BadFitSignals): number | null {
  if (signals.isPurePlatform) return 55;      // Platforms are alternatives, not primary threats
  if (signals.isVeryLargeAgency) return 45;   // Big agencies rarely compete for startups
  if (signals.isEnterpriseOnly) return 40;    // Enterprise-only doesn't compete for startup ICP
  return null; // No cap
}

// ============================================================================
// Rule-Based Pre-Classification
// ============================================================================

/**
 * Quick rule-based classification for obvious cases
 */
export function preClassifyCandidate(
  candidate: EnrichedCandidate,
  context: QueryContext
): { type: CompetitorType; confidence: number } | null {
  const name = candidate.name.toLowerCase();
  const domain = candidate.domain?.toLowerCase() || '';
  const snippet = candidate.snippet?.toLowerCase() || '';
  const metadata = candidate.metadata;

  // Check bad-fit signals first
  const badFitSignals = detectBadFitSignals(candidate, context);
  if (shouldExcludeCandidate(badFitSignals)) {
    return { type: 'irrelevant', confidence: 0.9 };
  }

  // Platform detection (pure platforms, not agencies with software)
  if (
    badFitSignals.isPurePlatform ||
    PURE_PLATFORM_DOMAINS.has(domain) ||
    (metadata?.businessModel === 'saas' && !snippet.includes('agency'))
  ) {
    return { type: 'platform', confidence: 0.8 };
  }

  // Fractional detection
  if (
    name.includes('fractional') ||
    snippet.includes('fractional cmo') ||
    snippet.includes('fractional marketing') ||
    snippet.includes('part-time cmo') ||
    snippet.includes('interim marketing') ||
    snippet.includes('outsourced cmo')
  ) {
    return { type: 'fractional', confidence: 0.85 };
  }

  // Internal alternative detection
  if (
    snippet.includes('hire a') ||
    snippet.includes('in-house') ||
    snippet.includes('full-time') ||
    (name.includes('freelancer')) ||
    (name.includes('consultant') && metadata?.teamSize === 'solo')
  ) {
    return { type: 'internal', confidence: 0.6 };
  }

  // Check for same geography
  const sameGeo = !context.geography ||
    snippet.includes(context.geography.toLowerCase()) ||
    candidate.crawledContent?.about?.location?.toLowerCase().includes(context.geography.toLowerCase());

  // Check for service overlap
  const hasServiceOverlap = context.primaryOffers.some(offer =>
    snippet.includes(offer.toLowerCase()) ||
    candidate.crawledContent?.services?.offerings?.some(s =>
      s.toLowerCase().includes(offer.toLowerCase())
    )
  );

  // Direct competitor signals (startup-focused agencies)
  const startupsignals = snippet.includes('startup') || snippet.includes('saas') ||
    snippet.includes('b2b') || snippet.includes('growth');

  if (
    metadata?.businessModel === 'agency' &&
    hasServiceOverlap &&
    startupsignals &&
    (sameGeo || !context.geography)
  ) {
    return { type: 'direct', confidence: 0.7 };
  }

  // Default: let AI classify
  return null;
}

// ============================================================================
// Selection Logic - Quota-Based Selection
// ============================================================================

/**
 * Quotas for constructing a representative competitor set
 */
interface SelectionQuotas {
  direct: { min: number; max: number };
  partial: { min: number; max: number };
  fractional: { min: number; max: number };
  platform: { min: number; max: number };
  internal: { min: number; max: number };
  total: number;
}

const DEFAULT_QUOTAS: SelectionQuotas = {
  direct: { min: 3, max: 6 },      // 3-5 direct competitors
  partial: { min: 3, max: 6 },     // 3-5 partial overlaps
  fractional: { min: 2, max: 4 },  // 2-3 fractional exec competitors
  platform: { min: 1, max: 4 },    // 1-3 platform alternatives
  internal: { min: 1, max: 3 },    // 1-2 internal-hire alternatives
  total: 18,
};

/**
 * Select final competitors using quota-based approach
 *
 * This ensures a representative set across all competitor types,
 * not just a wall of generic agencies sorted by threat score.
 */
export function selectFinalCompetitors<T extends EnrichedCandidate & { classification: ClassificationResult; scores?: { threatScore: number } }>(
  classified: T[],
  quotas: SelectionQuotas = DEFAULT_QUOTAS
): T[] {
  // Filter out irrelevant and excluded candidates
  const relevant = classified.filter(c => c.classification.type !== 'irrelevant');

  console.log(`[competition-v3/selection] Starting with ${relevant.length} relevant candidates`);

  // Group by type
  const byType: Record<CompetitorType, T[]> = {
    direct: [],
    partial: [],
    fractional: [],
    internal: [],
    platform: [],
    irrelevant: [],
  };

  for (const candidate of relevant) {
    byType[candidate.classification.type].push(candidate);
  }

  // Sort each group by threat score (descending)
  for (const type of Object.keys(byType) as CompetitorType[]) {
    byType[type].sort((a, b) => {
      const aScore = a.scores?.threatScore ?? (a.classification.confidence * 50);
      const bScore = b.scores?.threatScore ?? (b.classification.confidence * 50);
      return bScore - aScore;
    });
  }

  // Log distribution before selection
  console.log(`[competition-v3/selection] Distribution: direct=${byType.direct.length}, partial=${byType.partial.length}, fractional=${byType.fractional.length}, platform=${byType.platform.length}, internal=${byType.internal.length}`);

  // Select from each category in priority order
  const selected: T[] = [];
  const selectedDomains = new Set<string>();

  // Priority order: direct first (most important), then others
  const typeOrder: (keyof SelectionQuotas)[] = ['direct', 'partial', 'fractional', 'platform', 'internal'];

  // Phase 1: Fill minimum quotas
  for (const type of typeOrder) {
    if (type === 'total') continue;
    const quota = quotas[type] as { min: number; max: number };
    const candidates = byType[type as CompetitorType];

    for (const candidate of candidates) {
      if (selected.length >= quotas.total) break;
      if (selectedDomains.has(candidate.domain || '')) continue;

      // Count how many of this type we already have
      const typeCount = selected.filter(s => s.classification.type === type).length;
      if (typeCount >= quota.min) continue;

      selected.push(candidate);
      if (candidate.domain) selectedDomains.add(candidate.domain);
    }
  }

  // Phase 2: Fill up to max quotas (if we have room)
  for (const type of typeOrder) {
    if (type === 'total') continue;
    if (selected.length >= quotas.total) break;

    const quota = quotas[type] as { min: number; max: number };
    const candidates = byType[type as CompetitorType];

    for (const candidate of candidates) {
      if (selected.length >= quotas.total) break;
      if (selectedDomains.has(candidate.domain || '')) continue;

      // Count how many of this type we already have
      const typeCount = selected.filter(s => s.classification.type === type).length;
      if (typeCount >= quota.max) continue;

      selected.push(candidate);
      if (candidate.domain) selectedDomains.add(candidate.domain);
    }
  }

  // Phase 3: Backfill with best remaining candidates (direct/partial priority)
  if (selected.length < quotas.total) {
    const backfillTypes: CompetitorType[] = ['direct', 'partial'];
    for (const type of backfillTypes) {
      const candidates = byType[type];
      for (const candidate of candidates) {
        if (selected.length >= quotas.total) break;
        if (selectedDomains.has(candidate.domain || '')) continue;
        selected.push(candidate);
        if (candidate.domain) selectedDomains.add(candidate.domain);
      }
    }
  }

  // Final distribution logging
  const finalDist = selected.reduce((acc, c) => {
    acc[c.classification.type] = (acc[c.classification.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`[competition-v3/selection] Selected ${selected.length} finalists: ${JSON.stringify(finalDist)}`);

  return selected;
}
