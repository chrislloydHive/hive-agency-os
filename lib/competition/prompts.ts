// lib/competition/prompts.ts
// Competition Lab v2 - AI System Prompts
//
// Prompts for competitor discovery, enrichment, and scoring.
// Updated with strict JSON schema requirements for reliable parsing.

import type { TargetCompanyContext, EnrichedCompetitorData } from './types';

// ============================================================================
// Discovery System Prompts
// ============================================================================

/**
 * System prompt for competitor discovery
 */
export const COMPETITOR_DISCOVERY_SYSTEM_PROMPT = `You are an expert market researcher specializing in competitive landscapes.

Your task is to identify real companies that compete with a target company. You must:
1. Only suggest real, established companies (not fictional or made-up)
2. Focus on companies competing for the same customers
3. Include companies across different tiers: direct competitors, alternatives, and adjacent players
4. Provide accurate domain URLs when known

Always respond with valid JSON only. No commentary, explanations, or markdown.`;

/**
 * Main discovery prompt - expects JSON array response
 */
export const COMPETITOR_DISCOVERY_PROMPT = `You will be given structured context about a target company.
Your task is to identify 8-12 real companies that compete with or are alternatives to this company.

For each competitor, provide:
- name: Company name (required, must be a real company)
- homepageUrl: Their website URL if known (e.g., "https://example.com")
- shortSummary: 1-2 sentence description of what they do
- geo: Primary market/region (e.g., "US", "Global", "UK", "Pacific Northwest")
- priceTierGuess: Their pricing tier - "low", "mid", or "high" (or null if unknown)
- source: Always set to "ai_simulation"
- sourceNote: Brief reason why they were selected as a competitor

IMPORTANT:
- Only include REAL companies that actually exist
- Do not make up company names
- Include a mix of: direct competitors (same offering), alternatives (different approach), and adjacent players
- Consider the company's geography and industry when selecting competitors

Respond with valid JSON in this exact format - either a plain array OR an object with a "competitors" key:

Option A (preferred):
[
  {
    "name": "Company Name",
    "homepageUrl": "https://example.com",
    "shortSummary": "Brief description of what they offer.",
    "geo": "US",
    "priceTierGuess": "mid",
    "source": "ai_simulation",
    "sourceNote": "Reason they compete with the target."
  }
]

Option B (also accepted):
{
  "competitors": [
    { ... same structure as above ... }
  ]
}`;

/**
 * Build the full discovery prompt with company context
 */
export function buildDiscoveryPrompt(context: {
  businessName: string;
  domain?: string | null;
  industry?: string | null;
  primaryOffers?: string[];
  icpDescription?: string | null;
  geographicFootprint?: string | null;
  marketPosition?: string | null;
}): string {
  return `${COMPETITOR_DISCOVERY_PROMPT}

TARGET COMPANY CONTEXT:
- Business Name: ${context.businessName}
- Domain: ${context.domain || 'Unknown'}
- Industry: ${context.industry || 'Unknown'}
- Primary Offers: ${context.primaryOffers?.join(', ') || 'Unknown'}
- ICP (Ideal Customer): ${context.icpDescription || 'Unknown'}
- Geographic Focus: ${context.geographicFootprint || 'Unknown'}
- Market Position: ${context.marketPosition || 'Unknown'}

Identify 8-12 competitors for this company. Respond with JSON array only.`;
}

// ============================================================================
// Query Generation Prompts
// ============================================================================

/**
 * Generate search queries for competitor discovery
 */
export function getDiscoveryQueriesPrompt(context: TargetCompanyContext): string {
  return `You are a competitive intelligence analyst. Generate search queries to discover competitors for this company.

Target Company:
- Name: ${context.businessName}
- Domain: ${context.domain || 'Unknown'}
- Industry: ${context.industry || 'Unknown'}
- Service Area: ${context.serviceArea || 'Unknown'}
- Geographic Focus: ${context.geographicFootprint || 'Unknown'}
- ICP: ${context.icpDescription || 'Unknown'}
- Primary Offers: ${context.primaryOffers.join(', ') || 'Unknown'}

Generate search queries in these categories:

1. Brand queries (5 queries) - Direct competitor searches
   Examples: "{brand} competitors", "{brand} alternatives", "{brand} vs"

2. Category queries (5 queries) - Industry/category searches
   Examples: "best {industry} companies", "top {category} agencies"

3. Geo queries (3 queries) - Location-based searches
   Examples: "{industry} companies in {city}", "{service} near {region}"

4. Marketplace queries (3 queries) - Review site/directory searches
   Examples: "{category} on G2", "{industry} Clutch top agencies"

Return JSON with this exact structure:
{
  "brandQueries": ["query1", "query2", ...],
  "categoryQueries": ["query1", "query2", ...],
  "geoQueries": ["query1", "query2", ...],
  "marketplaceQueries": ["query1", "query2", ...]
}

Only return the JSON, no other text.`;
}

// ============================================================================
// Enrichment Prompts
// ============================================================================

/**
 * System prompt for competitor enrichment
 */
export const ENRICHMENT_SYSTEM_PROMPT = `You are a competitive intelligence analyst specializing in B2B market research. Your task is to analyze companies and extract structured competitive intelligence.

When analyzing a company, focus on:
1. Business model and primary offerings
2. Target audience and ICP
3. Geographic focus and service areas
4. Pricing tier and model
5. Positioning and differentiation
6. Competitive strengths and weaknesses

Be objective and fact-based. If information is not available, return null for that field.
All outputs must be valid JSON.`;

/**
 * Generate enrichment prompt for a candidate competitor
 */
export function getEnrichmentPrompt(
  competitorName: string,
  competitorDomain: string | null,
  rawSearchData?: string
): string {
  return `Analyze this company and extract competitive intelligence:

Company: ${competitorName}
Domain: ${competitorDomain || 'Unknown'}
${rawSearchData ? `\nSearch Data:\n${rawSearchData}` : ''}

Extract and return JSON with this exact structure:
{
  "companyType": "agency" | "saas" | "consultancy" | "platform" | "marketplace" | "other" | null,
  "category": "string describing their category/niche" | null,
  "summary": "one-line description of what they do" | null,
  "tagline": "their tagline if found" | null,
  "targetAudience": "who they serve" | null,
  "icpDescription": "ideal customer profile description" | null,
  "companySizeTarget": "SMB" | "Mid-Market" | "Enterprise" | "All" | null,
  "geographicFocus": "US" | "Global" | "Regional" | "Local" | null,
  "headquartersLocation": "city, state/country" | null,
  "serviceAreas": ["list", "of", "regions"],
  "primaryOffers": ["list", "of", "services/products"],
  "uniqueFeatures": ["list", "of", "differentiators"],
  "pricingTier": "budget" | "mid" | "premium" | "enterprise" | null,
  "pricingModel": "subscription" | "project" | "retainer" | "usage" | "custom" | null,
  "estimatedPriceRange": "rough price range if determinable" | null,
  "brandScale": "startup" | "smb" | "mid_market" | "enterprise" | "dominant" | null,
  "estimatedEmployees": number | null,
  "foundedYear": number | null,
  "positioning": "their market positioning statement" | null,
  "valueProposition": "their core value proposition" | null,
  "differentiators": ["what", "makes", "them", "unique"],
  "weaknesses": ["potential", "weaknesses", "or", "gaps"],
  "primaryChannels": ["marketing", "channels", "they", "use"],
  "socialProof": ["awards", "certifications", "notable", "clients"]
}

Only return the JSON, no other text.`;
}

// ============================================================================
// Scoring Prompts
// ============================================================================

/**
 * System prompt for similarity scoring
 */
export const SCORING_SYSTEM_PROMPT = `You are a competitive intelligence analyst. Your task is to compare a target company with a potential competitor and score their similarity across multiple dimensions.

Scoring Guidelines:
- Score from 0-100 where 100 = identical/perfect match
- Be objective and consistent
- Consider both explicit and implicit factors
- Account for market positioning and strategic intent

All outputs must be valid JSON with exact numeric scores.`;

/**
 * Generate scoring prompt for a candidate competitor
 */
export function getScoringPrompt(
  target: TargetCompanyContext,
  competitor: EnrichedCompetitorData,
  competitorName: string
): string {
  return `Compare this target company with the competitor and score their similarity:

TARGET COMPANY:
- Name: ${target.businessName}
- Industry: ${target.industry || 'Unknown'}
- ICP: ${target.icpDescription || 'Unknown'}
- Service Area: ${target.serviceArea || 'Unknown'}
- Geographic Focus: ${target.geographicFootprint || 'Unknown'}
- Price Tier: ${target.priceTier || 'Unknown'}
- Primary Offers: ${target.primaryOffers.join(', ') || 'Unknown'}

COMPETITOR:
- Name: ${competitorName}
- Category: ${competitor.category || 'Unknown'}
- Target Audience: ${competitor.targetAudience || 'Unknown'}
- ICP: ${competitor.icpDescription || 'Unknown'}
- Geographic Focus: ${competitor.geographicFocus || 'Unknown'}
- Price Tier: ${competitor.pricingTier || 'Unknown'}
- Primary Offers: ${competitor.primaryOffers.join(', ') || 'Unknown'}
- Brand Scale: ${competitor.brandScale || 'Unknown'}

Score the competitor on these dimensions (0-100):

1. OFFER SIMILARITY: How similar are their products/services to the target?
   - Consider: service types, delivery model, specializations
   - High (80-100): Nearly identical offerings
   - Medium (50-79): Similar category, different specifics
   - Low (0-49): Different offerings

2. AUDIENCE SIMILARITY: How much do their target audiences overlap?
   - Consider: ICP, company size, industry verticals
   - High (80-100): Same exact audience
   - Medium (50-79): Adjacent or overlapping audience
   - Low (0-49): Different audience

3. GEO OVERLAP: How much do their service areas overlap?
   - Consider: countries, regions, local markets
   - High (80-100): Same geographic focus
   - Medium (50-79): Partial overlap
   - Low (0-49): Different regions

4. PRICE TIER OVERLAP: How similar are their pricing positions?
   - Consider: price tier, pricing model, value perception
   - High (80-100): Same tier
   - Medium (50-79): Adjacent tier
   - Low (0-49): Different tier

Return JSON with this exact structure:
{
  "offerSimilarity": number,
  "audienceSimilarity": number,
  "geoOverlap": number,
  "priceTierOverlap": number,
  "scoringRationale": {
    "offerNotes": "brief explanation",
    "audienceNotes": "brief explanation",
    "geoNotes": "brief explanation",
    "priceNotes": "brief explanation"
  }
}

Only return the JSON, no other text.`;
}

// ============================================================================
// Analysis Prompts
// ============================================================================

/**
 * System prompt for competitor analysis
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are a strategic competitive analyst. Your task is to provide actionable competitive intelligence that helps businesses understand their market position.

Focus on:
1. Strategic implications
2. Threat assessment
3. Differentiation opportunities
4. Actionable recommendations

Be concise, specific, and actionable.`;

/**
 * Generate analysis prompt for why a competitor matters
 */
export function getWhyThisCompetitorMattersPrompt(
  target: TargetCompanyContext,
  competitor: EnrichedCompetitorData,
  competitorName: string,
  scores: {
    overallScore: number;
    offerSimilarity: number;
    audienceSimilarity: number;
  }
): string {
  return `Explain why this competitor matters to the target company:

TARGET: ${target.businessName}
- Industry: ${target.industry || 'Unknown'}
- ICP: ${target.icpDescription || 'Unknown'}

COMPETITOR: ${competitorName}
- Category: ${competitor.category || 'Unknown'}
- Summary: ${competitor.summary || 'Unknown'}
- Overall Score: ${scores.overallScore}/100
- Offer Similarity: ${scores.offerSimilarity}/100
- Audience Similarity: ${scores.audienceSimilarity}/100

Write 2-3 sentences explaining:
1. Why this competitor is relevant
2. What threat or opportunity they represent
3. What the target should watch for

Be specific and actionable. Return only the text, no JSON.`;
}

/**
 * Generate analysis prompt for how competitors differ
 */
export function getHowTheyDifferPrompt(
  target: TargetCompanyContext,
  competitor: EnrichedCompetitorData,
  competitorName: string
): string {
  return `Compare how this competitor differs from the target company:

TARGET: ${target.businessName}
- Positioning: ${target.icpDescription || 'Unknown'}
- Primary Offers: ${target.primaryOffers.join(', ') || 'Unknown'}
- Price Tier: ${target.priceTier || 'Unknown'}

COMPETITOR: ${competitorName}
- Positioning: ${competitor.positioning || 'Unknown'}
- Primary Offers: ${competitor.primaryOffers.join(', ') || 'Unknown'}
- Differentiators: ${competitor.differentiators.join(', ') || 'Unknown'}
- Price Tier: ${competitor.pricingTier || 'Unknown'}
- Value Proposition: ${competitor.valueProposition || 'Unknown'}

Write 2-3 sentences explaining the key differences in:
1. Positioning or approach
2. Target audience or use case
3. Pricing or value proposition

Be specific and highlight strategic implications. Return only the text, no JSON.`;
}

/**
 * Generate threat assessment prompt
 */
export function getThreatAssessmentPrompt(
  target: TargetCompanyContext,
  competitor: EnrichedCompetitorData,
  competitorName: string,
  scores: {
    overallScore: number;
    offerSimilarity: number;
    audienceSimilarity: number;
  }
): string {
  return `Assess the competitive threat level of this competitor:

TARGET: ${target.businessName}
- Industry: ${target.industry || 'Unknown'}
- Market Position: ${target.marketMaturity || 'Unknown'}

COMPETITOR: ${competitorName}
- Brand Scale: ${competitor.brandScale || 'Unknown'}
- Summary: ${competitor.summary || 'Unknown'}
- Strengths: ${competitor.differentiators.join(', ') || 'Unknown'}
- Weaknesses: ${competitor.weaknesses.join(', ') || 'Unknown'}
- Overall Score: ${scores.overallScore}/100
- Offer Similarity: ${scores.offerSimilarity}/100
- Audience Similarity: ${scores.audienceSimilarity}/100

Return JSON with this structure:
{
  "threatLevel": number (0-100),
  "threatDrivers": ["list", "of", "threat", "drivers"],
  "timeHorizon": "immediate" | "6-month" | "1-year" | "long-term",
  "defensiveActions": ["recommended", "actions"]
}

Threat Level Guidelines:
- 80-100: Critical - immediate competitive pressure
- 60-79: High - significant threat to market position
- 40-59: Medium - notable but manageable competition
- 20-39: Low - peripheral competitor
- 0-19: Minimal - not a direct threat

Only return the JSON, no other text.`;
}

// ============================================================================
// Batch Analysis Prompts
// ============================================================================

/**
 * Generate summary prompt for the entire competitive landscape
 */
export function getLandscapeSummaryPrompt(
  target: TargetCompanyContext,
  competitors: Array<{
    name: string;
    role: string;
    overallScore: number;
    threatLevel: number | null;
  }>
): string {
  const competitorList = competitors
    .map((c) => `- ${c.name}: ${c.role} (Score: ${c.overallScore}, Threat: ${c.threatLevel || 'N/A'})`)
    .join('\n');

  return `Summarize the competitive landscape for this company:

TARGET: ${target.businessName}
- Industry: ${target.industry || 'Unknown'}
- ICP: ${target.icpDescription || 'Unknown'}

COMPETITORS:
${competitorList}

Provide a strategic summary covering:
1. Overall competitive intensity (how crowded is the market?)
2. Primary threats and their nature
3. Key differentiation opportunities
4. Strategic recommendations

Write 3-4 paragraphs. Be specific and actionable.`;
}
