// lib/competition-v3/enrichment/metadataExtractor.ts
// Metadata Extraction for Competition Lab V3
//
// Extracts company metadata from discovered candidates:
// - Team size estimation
// - Tech stack detection
// - Pricing tier inference
// - Business model classification
// - AI capability detection

import { aiSimple } from '@/lib/ai-gateway';
import type { DiscoveryCandidate, EnrichedCandidate, CompanyMetadata, CrawledContent, SemanticSimilarity, QueryContext } from '../types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely join array or return string value
 */
function safeJoin(value: unknown, separator: string = ', '): string {
  if (Array.isArray(value)) {
    return value.join(separator);
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

// ============================================================================
// Enrichment Pipeline
// ============================================================================

/**
 * Enrich candidates with metadata, crawled content, and analysis
 */
export async function enrichCandidates(
  candidates: DiscoveryCandidate[],
  context: QueryContext,
  maxCandidates: number = 30
): Promise<EnrichedCandidate[]> {
  console.log(`[competition-v3/enrichment] Enriching ${Math.min(candidates.length, maxCandidates)} candidates`);

  // Limit to top candidates
  const toEnrich = candidates.slice(0, maxCandidates);

  // Process in parallel batches
  const batchSize = 5;
  const enriched: EnrichedCandidate[] = [];

  for (let i = 0; i < toEnrich.length; i += batchSize) {
    const batch = toEnrich.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(candidate => enrichCandidate(candidate, context))
    );
    enriched.push(...batchResults);
  }

  console.log(`[competition-v3/enrichment] Enriched ${enriched.length} candidates`);
  return enriched;
}

/**
 * Enrich a single candidate
 */
async function enrichCandidate(
  candidate: DiscoveryCandidate,
  context: QueryContext
): Promise<EnrichedCandidate> {
  try {
    // Use AI to extract all metadata at once
    const enrichmentData = await extractWithAI(candidate, context);

    return {
      ...candidate,
      enrichmentStatus: 'completed',
      enrichmentError: null,
      crawledContent: enrichmentData.crawledContent,
      metadata: enrichmentData.metadata,
      semanticSimilarity: enrichmentData.similarity,
      aiSummary: enrichmentData.summary,
      aiStrengths: enrichmentData.strengths,
      aiWeaknesses: enrichmentData.weaknesses,
      aiWhyCompetitor: enrichmentData.whyCompetitor,
      // V3.5 signals for threat scoring
      jtbdMatches: enrichmentData.jtbdMatches,
      offerOverlapScore: enrichmentData.offerOverlapScore,
      geoScore: enrichmentData.geoScore,
      businessModelCategory: enrichmentData.businessModelCategory,
      signalsVerified: enrichmentData.signalsVerified,
    };
  } catch (error) {
    console.warn(`[competition-v3/enrichment] Failed to enrich ${candidate.name}:`, error);
    return {
      ...candidate,
      enrichmentStatus: 'failed',
      enrichmentError: error instanceof Error ? error.message : 'Unknown error',
      crawledContent: null,
      metadata: null,
      semanticSimilarity: null,
      aiSummary: null,
      aiStrengths: [],
      aiWeaknesses: [],
      aiWhyCompetitor: null,
      // Default V3.5 signals for failed enrichment
      jtbdMatches: 0.4,
      offerOverlapScore: 0.4,
      geoScore: 0.4,
      businessModelCategory: undefined,
      signalsVerified: 0,
    };
  }
}

// ============================================================================
// AI-Powered Extraction
// ============================================================================

interface EnrichmentResult {
  crawledContent: CrawledContent | null;
  metadata: CompanyMetadata | null;
  similarity: SemanticSimilarity | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  whyCompetitor: string | null;
  // V3.5 signals for threat scoring
  jtbdMatches?: number;
  offerOverlapScore?: number;
  geoScore?: number;
  businessModelCategory?: 'retail-service' | 'retail-product' | 'ecommerce' | 'agency' | 'saas' | 'other';
  signalsVerified?: number;
}

const ENRICHMENT_SYSTEM_PROMPT = `You are a competitive intelligence analyst. Your task is to analyze a company and extract structured metadata.

Be objective and fact-based. Use your knowledge of the company if available, or make reasonable inferences based on the information provided.

For unknown fields, return null rather than guessing.

For V3.5 scoring signals (jtbdMatches, offerOverlapScore, geoScore), you MUST provide numeric values between 0 and 1:
- jtbdMatches: How well their jobs-to-be-done match the target company (0=no overlap, 1=identical)
- offerOverlapScore: Service/product offering similarity (0=completely different, 1=identical offerings)
- geoScore: Geographic market overlap (0=no overlap, 1=same exact markets)`;

/**
 * Extract all enrichment data using AI
 */
async function extractWithAI(
  candidate: DiscoveryCandidate,
  context: QueryContext
): Promise<EnrichmentResult> {
  const prompt = `Analyze this company and extract competitive intelligence:

COMPANY TO ANALYZE:
- Name: ${candidate.name}
- Domain: ${candidate.domain || 'Unknown'}
- Initial Description: ${candidate.snippet || 'No description available'}
- Found via: ${candidate.source}
- Directory Rating: ${candidate.directoryRating || 'N/A'}

COMPARISON TARGET (for similarity scoring):
- Target Company: ${context.businessName}
- Industry: ${context.industry || 'Marketing'}
- ICP: ${context.icpDescription || 'Unknown'}
- Services: ${safeJoin(context.primaryOffers) || 'Unknown'}
- Value Prop: ${context.valueProposition || 'Unknown'}

Extract and return JSON with this structure:
{
  "metadata": {
    "teamSize": "solo" | "small" | "medium" | "large" | "enterprise" | null,
    "teamSizeEstimate": number | null,
    "foundedYear": number | null,
    "headquarters": "city, state/country" | null,
    "serviceRegions": ["region1", "region2"],
    "techStack": ["tool1", "tool2"],
    "hasAICapabilities": boolean,
    "hasAutomation": boolean,
    "pricingTier": "budget" | "mid" | "premium" | "enterprise" | null,
    "businessModel": "agency" | "consultancy" | "saas" | "marketplace" | "hybrid" | null,
    "serviceModel": "retainer" | "project" | "hourly" | "subscription" | "hybrid" | null
  },
  "crawledContent": {
    "homepage": {
      "title": "Page title",
      "h1": "Main headline",
      "description": "Meta description or tagline",
      "keywords": ["keyword1", "keyword2"]
    },
    "services": {
      "found": true,
      "offerings": ["service1", "service2"],
      "keywords": ["keyword1"]
    },
    "industries": ["industry1", "industry2"],
    "techStack": ["tool1", "tool2"]
  },
  "similarity": {
    "positioningSimilarity": 0.0-1.0,
    "icpSimilarity": 0.0-1.0,
    "valueModelSimilarity": 0.0-1.0,
    "offeringSimilarity": 0.0-1.0,
    "overallSimilarity": 0.0-1.0
  },
  "v35Signals": {
    "jtbdMatches": 0.0-1.0,
    "offerOverlapScore": 0.0-1.0,
    "geoScore": 0.0-1.0,
    "businessModelCategory": "retail-service" | "retail-product" | "ecommerce" | "agency" | "saas" | "other",
    "signalsVerified": 0-5
  },
  "summary": "1-2 sentence company description",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "whyCompetitor": "Why this company competes with the target"
}

Team Size Guidelines:
- solo: 1 person
- small: 2-10 people
- medium: 11-50 people
- large: 51-200 people
- enterprise: 200+ people

Similarity Scoring (0-1):
- 0.0-0.3: Low similarity
- 0.4-0.6: Moderate similarity
- 0.7-1.0: High similarity

V3.5 Signal Scoring (CRITICAL for threat calculation):
- jtbdMatches: Jobs-to-be-done overlap (0=different jobs, 1=same jobs)
- offerOverlapScore: Product/service offering similarity (0=none, 1=identical)
- geoScore: Geographic market overlap (0=different markets, 1=same markets)
- signalsVerified: Count of verified competitive signals (0-5)`;

  try {
    const response = await aiSimple({
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.2,
      maxTokens: 1500,
      jsonMode: true,
    });

    const parsed = JSON.parse(response);

    return {
      crawledContent: parsed.crawledContent ? {
        domain: candidate.domain || '',
        homepage: {
          title: parsed.crawledContent.homepage?.title || null,
          h1: parsed.crawledContent.homepage?.h1 || null,
          description: parsed.crawledContent.homepage?.description || null,
          keywords: parsed.crawledContent.homepage?.keywords || [],
        },
        services: {
          found: parsed.crawledContent.services?.found || false,
          offerings: parsed.crawledContent.services?.offerings || [],
          keywords: parsed.crawledContent.services?.keywords || [],
        },
        about: {
          found: false,
          teamSize: parsed.metadata?.teamSize || null,
          founded: parsed.metadata?.foundedYear?.toString() || null,
          location: parsed.metadata?.headquarters || null,
        },
        pricing: {
          found: false,
          indicators: [],
          tier: parsed.metadata?.pricingTier || null,
        },
        industries: parsed.crawledContent.industries || [],
        testimonials: [],
        techStack: parsed.crawledContent.techStack || parsed.metadata?.techStack || [],
      } : null,

      metadata: parsed.metadata ? {
        teamSize: parsed.metadata.teamSize || null,
        teamSizeEstimate: parsed.metadata.teamSizeEstimate || null,
        foundedYear: parsed.metadata.foundedYear || null,
        headquarters: parsed.metadata.headquarters || null,
        serviceRegions: parsed.metadata.serviceRegions || [],
        techStack: parsed.metadata.techStack || [],
        hasAICapabilities: !!parsed.metadata.hasAICapabilities,
        hasAutomation: !!parsed.metadata.hasAutomation,
        pricingTier: parsed.metadata.pricingTier || null,
        businessModel: parsed.metadata.businessModel || null,
        serviceModel: parsed.metadata.serviceModel || null,
      } : null,

      similarity: parsed.similarity ? {
        positioningSimilarity: clamp(parsed.similarity.positioningSimilarity, 0, 1),
        icpSimilarity: clamp(parsed.similarity.icpSimilarity, 0, 1),
        valueModelSimilarity: clamp(parsed.similarity.valueModelSimilarity, 0, 1),
        offeringSimilarity: clamp(parsed.similarity.offeringSimilarity, 0, 1),
        overallSimilarity: clamp(parsed.similarity.overallSimilarity, 0, 1),
      } : null,

      summary: parsed.summary || null,
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      whyCompetitor: parsed.whyCompetitor || null,
      // V3.5 signals for threat scoring
      jtbdMatches: parsed.v35Signals?.jtbdMatches != null
        ? clamp(parsed.v35Signals.jtbdMatches, 0, 1)
        : parsed.similarity?.icpSimilarity ?? 0.5,
      offerOverlapScore: parsed.v35Signals?.offerOverlapScore != null
        ? clamp(parsed.v35Signals.offerOverlapScore, 0, 1)
        : parsed.similarity?.offeringSimilarity ?? 0.5,
      geoScore: parsed.v35Signals?.geoScore != null
        ? clamp(parsed.v35Signals.geoScore, 0, 1)
        : 0.5,
      businessModelCategory: parsed.v35Signals?.businessModelCategory || undefined,
      signalsVerified: parsed.v35Signals?.signalsVerified ?? 0,
    };
  } catch (error) {
    console.warn(`[competition-v3/enrichment] AI extraction failed for ${candidate.name}:`, error);

    // Return minimal data with default V3.5 signals
    return {
      crawledContent: null,
      metadata: {
        teamSize: null,
        teamSizeEstimate: null,
        foundedYear: null,
        headquarters: null,
        serviceRegions: [],
        techStack: [],
        hasAICapabilities: false,
        hasAutomation: false,
        pricingTier: null,
        businessModel: null,
        serviceModel: null,
      },
      similarity: null,
      summary: candidate.snippet,
      strengths: [],
      weaknesses: [],
      whyCompetitor: null,
      // Default V3.5 signals for fallback
      jtbdMatches: 0.4,
      offerOverlapScore: 0.4,
      geoScore: 0.4,
      businessModelCategory: undefined,
      signalsVerified: 0,
    };
  }
}

/**
 * Clamp a number between min and max
 */
function clamp(value: number | null | undefined, min: number, max: number): number {
  if (value === null || value === undefined || isNaN(value)) {
    return (min + max) / 2; // Default to middle
  }
  return Math.min(max, Math.max(min, value));
}

// ============================================================================
// Team Size Utilities
// ============================================================================

/**
 * Estimate team size from various signals
 */
export function estimateTeamSize(metadata: CompanyMetadata | null): string | null {
  if (!metadata) return null;

  if (metadata.teamSize) return metadata.teamSize;

  if (metadata.teamSizeEstimate) {
    if (metadata.teamSizeEstimate === 1) return 'solo';
    if (metadata.teamSizeEstimate <= 10) return 'small';
    if (metadata.teamSizeEstimate <= 50) return 'medium';
    if (metadata.teamSizeEstimate <= 200) return 'large';
    return 'enterprise';
  }

  return null;
}

/**
 * Get numeric range for team size
 */
export function getTeamSizeRange(size: string | null): { min: number; max: number } {
  switch (size) {
    case 'solo': return { min: 1, max: 1 };
    case 'small': return { min: 2, max: 10 };
    case 'medium': return { min: 11, max: 50 };
    case 'large': return { min: 51, max: 200 };
    case 'enterprise': return { min: 201, max: 10000 };
    default: return { min: 1, max: 50 }; // Default assumption
  }
}

// ============================================================================
// Pricing Utilities
// ============================================================================

/**
 * Normalize pricing tier
 */
export function normalizePricingTier(tier: string | null): 'budget' | 'mid' | 'premium' | 'enterprise' | null {
  if (!tier) return null;

  const lower = tier.toLowerCase();

  if (lower.includes('budget') || lower.includes('low') || lower.includes('affordable')) {
    return 'budget';
  }
  if (lower.includes('mid') || lower.includes('moderate') || lower.includes('standard')) {
    return 'mid';
  }
  if (lower.includes('premium') || lower.includes('high') || lower.includes('luxury')) {
    return 'premium';
  }
  if (lower.includes('enterprise') || lower.includes('custom') || lower.includes('contact')) {
    return 'enterprise';
  }

  return 'mid'; // Default
}

// ============================================================================
// AI Detection
// ============================================================================

/**
 * Detect AI/automation capabilities from content
 */
export function detectAICapabilities(content: CrawledContent | null): boolean {
  if (!content) return false;

  const text = [
    content.homepage.description,
    content.homepage.h1,
    ...content.homepage.keywords,
    ...content.services.offerings,
    ...content.services.keywords,
  ].join(' ').toLowerCase();

  const aiKeywords = [
    'ai', 'artificial intelligence', 'machine learning', 'ml',
    'ai-powered', 'ai-driven', 'ai-first', 'ai-native',
    'gpt', 'llm', 'neural', 'deep learning',
    'automated', 'automation', 'auto-', 'smart',
  ];

  return aiKeywords.some(kw => text.includes(kw));
}
