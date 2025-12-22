// lib/competition-v3/discovery/aiSearch.ts
// AI-Powered Competitor Search for Competition Lab V3
//
// Uses AI to discover competitors based on context.
// Simulates web search when no API is available.

import { aiSimple } from '@/lib/ai-gateway';
import type { QueryContext, DiscoveryCandidate } from '../types';

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
// AI Search
// ============================================================================

const SEARCH_SYSTEM_PROMPT = `You are a competitive intelligence analyst who anchors analysis in the target company's ACTUAL business category and industry.

CRITICAL RULE - CATEGORY MATCHING:
- Use the target company's industry, business model, ICP, and offerings to define what competitors should look like.
- NEVER assume the target is a "marketing agency", "digital agency", or "software company" unless explicitly stated.
- If the target is a LOCAL SERVICE business (e.g., car audio shop, plumber, tow company), competitors MUST be similar local service businesses, NOT marketing agencies.
- If the target is RETAIL (e.g., car electronics store), competitors MUST be similar retailers, NOT agencies.
- If category is "unknown", return ONLY competitors that match the explicit business signals provided (industry, offerings, ICP).

Your task is to identify real companies that compete with a target company. You must:
1. Only suggest REAL, established companies (not fictional or made-up)
2. Focus on companies competing for the same customers IN THE SAME BUSINESS CATEGORY
3. Include different types of competitors (appropriate to the category):
   - Direct competitors (same business model, same ICP, similar services)
   - Category neighbors (share some overlap but different focus)
   - Platform alternatives (tools/platforms in the same category)
   - NOTE: Only include fractional executives / internal hire alternatives for SERVICES/AGENCY verticals
4. Provide accurate domain URLs when known
5. Be specific about WHY each is a competitor AND how they match the target's business category

Always respond with valid JSON only. No commentary, explanations, or markdown.`;

// Tunable embedding radius (env override)
export const COMPETITION_EMBEDDING_RADIUS_V35 =
  parseFloat(process.env.COMPETITION_EMBEDDING_RADIUS_V35 || '') || 0.72;

/**
 * Search for competitors using AI
 */
export async function searchWithAI(
  context: QueryContext,
  queries: string[]
): Promise<DiscoveryCandidate[]> {
  console.log(`[competition-v3/aiSearch] Searching for competitors of: ${context.businessName}`);

  const prompt = buildSearchPrompt(context, queries);

  try {
    const response = await aiSimple({
      systemPrompt: SEARCH_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.4,
      maxTokens: 4000,
      jsonMode: true,
    });

    console.log(`[competition-v3/aiSearch] AI response received (${response.length} chars)`);

    const candidates = parseSearchResponse(response);
    console.log(`[competition-v3/aiSearch] Parsed ${candidates.length} candidates`);

    return candidates;
  } catch (error) {
    console.error('[competition-v3/aiSearch] Search failed:', error);
    throw error;
  }
}

/**
 * Build the search prompt with context
 */
function buildSearchPrompt(context: QueryContext, queries: string[]): string {
  // Determine the vertical/category for explicit guidance
  const vertical = context.verticalCategory || 'unknown';
  const archetype = (context as any).archetype || 'unknown';
  const isAgency = vertical === 'services' || archetype === 'agency' ||
    context.businessModel?.toLowerCase().includes('agency');
  const isLocalService = vertical === 'automotive' || vertical === 'retail' ||
    archetype === 'local_service' ||
    context.industry?.toLowerCase().includes('service') ||
    context.industry?.toLowerCase().includes('dispatch') ||
    context.industry?.toLowerCase().includes('towing');

  // Build the category enforcement block
  let categoryEnforcement = '';
  if (isLocalService) {
    categoryEnforcement = `
CRITICAL - BUSINESS CATEGORY ENFORCEMENT:
This is a LOCAL SERVICE business (NOT a marketing agency or software company).
- Direct competitors MUST be similar local service businesses in the same industry.
- Do NOT include marketing agencies, digital agencies, or advertising companies as direct competitors.
- Do NOT include SaaS companies or software platforms as direct competitors.
- Platforms should only be industry-specific tools (e.g., dispatch software, booking systems).
- Fractional/Internal types are NOT applicable for this business category.`;
  } else if (!isAgency && vertical !== 'unknown') {
    categoryEnforcement = `
CRITICAL - BUSINESS CATEGORY ENFORCEMENT:
This is a ${vertical.toUpperCase()} business (NOT a marketing agency).
- Direct competitors MUST be similar ${vertical} businesses.
- Do NOT include marketing agencies, digital agencies, or advertising companies as competitors.
- Do NOT include fractional CMOs or marketing consultants as competitors.
- Match the actual business model and industry of the target company.`;
  } else if (vertical === 'unknown') {
    categoryEnforcement = `
CRITICAL - CATEGORY IS UNKNOWN:
The business category could not be confidently determined.
- ONLY suggest competitors that EXACTLY match the industry and offerings listed above.
- Do NOT assume this is a marketing agency or software company.
- If industry is "towing" or "dispatch", competitors must be towing/dispatch companies.
- If industry is unknown, focus ONLY on companies with matching primary offerings.
- Err on the side of caution - fewer relevant competitors is better than many wrong ones.`;
  }

  // Determine competitor types based on category
  let competitorTypeGuidance = '';
  if (isAgency) {
    competitorTypeGuidance = `
COMPETITOR TYPES TO FIND (for Services/Agency vertical):
1. DIRECT COMPETITORS (6-8): Same agency model, same ICP, similar services
2. CATEGORY NEIGHBORS (4-6): Overlapping market but different focus (e.g., bigger agencies, different specialization)
3. FRACTIONAL EXECUTIVES (2-3): Fractional CMO services, marketing advisors
4. PLATFORM ALTERNATIVES (2-3): SaaS tools that could replace some agency services
5. INTERNAL ALTERNATIVES (1-2): What companies might hire internally instead`;
  } else if (isLocalService) {
    competitorTypeGuidance = `
COMPETITOR TYPES TO FIND (for Local Service vertical):
1. DIRECT COMPETITORS (8-12): Same type of local service business, same geographic area, similar offerings
2. CATEGORY NEIGHBORS (4-6): Related local businesses (e.g., if car audio, then car customization, detailing)
3. PLATFORM ALTERNATIVES (2-4): Industry-specific software tools (dispatch, scheduling, booking platforms)
NOTE: Do NOT include fractional executives or internal hire alternatives - these are not applicable.`;
  } else {
    competitorTypeGuidance = `
COMPETITOR TYPES TO FIND:
1. DIRECT COMPETITORS (6-8): Same business model, same ICP, similar products/services
2. CATEGORY NEIGHBORS (4-6): Related businesses with overlapping market
3. PLATFORM ALTERNATIVES (2-4): Tools or platforms that serve similar needs
NOTE: Only include fractional/internal types if this is clearly a services/agency business.`;
  }

  return `Identify 15-25 real companies that compete with or are alternatives to the target company described below.
${categoryEnforcement}

TARGET COMPANY CONTEXT:
- Business Name: ${context.businessName}
- Domain: ${context.domain || 'Unknown'}
- Industry: ${context.industry || 'Unknown'}
- Business Model: ${context.businessModel || 'Unknown'}
- Vertical Category: ${vertical}
- Archetype: ${archetype}
- ICP Description: ${context.icpDescription || 'Unknown'}
- ICP Stage: ${context.icpStage || 'Unknown'}
- Target Industries: ${safeJoin(context.targetIndustries) || 'Various'}
- Primary Offerings: ${safeJoin(context.primaryOffers) || 'Unknown'}
- Service Model: ${context.serviceModel || 'Unknown'}
- Price Positioning: ${context.pricePositioning || 'Unknown'}
- Value Proposition: ${context.valueProposition || 'Unknown'}
- Differentiators: ${safeJoin(context.differentiators) || 'Unknown'}
- Geography: ${context.geography || 'Unknown'}
- AI/Tech Orientation: ${context.aiOrientation || 'Unknown'}

SEARCH QUERIES THAT MIGHT FIND COMPETITORS:
${queries.slice(0, 10).map((q, i) => `${i + 1}. "${q}"`).join('\n')}
${competitorTypeGuidance}

For each competitor, provide:
- name: Company name (required, must be a REAL company)
- domain: Their website domain (e.g., "example.com")
- homepageUrl: Full URL (e.g., "https://example.com")
- competitorType: "direct" | "partial" | "fractional" | "platform" | "internal"
- summary: 1-2 sentence description
- whyCompetitor: Why they compete with the target AND how they match the target's business category
- estimatedSize: "solo" | "small" | "medium" | "large" | "enterprise"
- pricingTier: "budget" | "mid" | "premium" | "enterprise" | null
- geography: Primary market/region

IMPORTANT:
- Only include REAL companies that actually exist
- Do NOT make up company names or domains
- Competitors MUST match the target's business category (see CRITICAL section above)
- If you're unsure about a competitor's relevance, DO NOT include them
- Include a good mix of competitor types (appropriate to the vertical)

Respond with a JSON object containing a "competitors" array:
{
  "competitors": [
    {
      "name": "Company Name",
      "domain": "example.com",
      "homepageUrl": "https://example.com",
      "competitorType": "direct",
      "summary": "Brief description of what they do.",
      "whyCompetitor": "Why they compete with the target and how they match the business category.",
      "estimatedSize": "medium",
      "pricingTier": "mid",
      "geography": "US"
    }
  ]
}`;
}

/**
 * Parse AI search response
 */
function parseSearchResponse(response: string): DiscoveryCandidate[] {
  try {
    // Try to parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      // Try to extract JSON from markdown
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object or array
        const objectMatch = response.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsed = JSON.parse(objectMatch[0]);
        }
      }
    }

    if (!parsed) {
      console.warn('[competition-v3/aiSearch] Could not parse AI response');
      return [];
    }

    // Extract competitors array
    let competitors: unknown[];
    if (Array.isArray(parsed)) {
      competitors = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      competitors = Array.isArray(obj.competitors) ? obj.competitors
        : Array.isArray(obj.results) ? obj.results
        : Array.isArray(obj.data) ? obj.data
        : [];
    } else {
      competitors = [];
    }

    // Transform to DiscoveryCandidate format
    const candidates: DiscoveryCandidate[] = [];

    for (const c of competitors) {
      if (!c || typeof c !== 'object') continue;
      const comp = c as Record<string, unknown>;

      const name = typeof comp.name === 'string' ? comp.name : null;
      if (!name || name.length < 2) continue;

      // Extract domain
      let domain: string | null = null;
      if (typeof comp.domain === 'string') {
        domain = normalizeDomain(comp.domain);
      } else if (typeof comp.homepageUrl === 'string') {
        domain = normalizeDomain(comp.homepageUrl);
      }

      candidates.push({
        name,
        domain,
        homepageUrl: typeof comp.homepageUrl === 'string' ? comp.homepageUrl : domain ? `https://${domain}` : null,
        source: 'ai_inference',
        sourceUrl: null,
        sourceRank: null,
        queryMatched: null,
        snippet: typeof comp.summary === 'string' ? comp.summary : null,
        directoryRating: null,
        directoryReviews: null,
        frequency: 1,
      });
    }

    return candidates;
  } catch (error) {
    console.error('[competition-v3/aiSearch] Error parsing response:', error);
    return [];
  }
}

/**
 * Normalize domain from URL
 */
function normalizeDomain(input: string | null): string | null {
  if (!input) return null;

  try {
    // If it's already a domain (no protocol)
    if (!input.includes('://')) {
      return input.toLowerCase().replace(/^www\./, '').split('/')[0];
    }

    // Parse as URL
    const url = new URL(input);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // Fallback: just clean up the string
    return input.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
}

// ============================================================================
// Directory-Style Search (Simulated)
// ============================================================================

/**
 * Simulate directory search results
 * In a real implementation, this would scrape/query Clutch, G2, etc.
 */
export async function searchDirectories(
  context: QueryContext
): Promise<DiscoveryCandidate[]> {
  console.log(`[competition-v3/directories] Searching directories for: ${context.businessName}`);

  // Determine business category for context
  const vertical = context.verticalCategory || 'unknown';
  const archetype = (context as any).archetype || 'unknown';
  const isAgency = vertical === 'services' || archetype === 'agency' ||
    context.businessModel?.toLowerCase().includes('agency');

  // Build category-appropriate guidance
  let categoryGuidance = '';
  if (!isAgency) {
    categoryGuidance = `
IMPORTANT: This company is NOT a marketing agency. It is a ${context.industry || 'local service'} business.
- Only suggest companies that are in the same business category (${context.industry || vertical}).
- Do NOT include marketing agencies, digital agencies, or advertising companies.
- Focus on directory listings for ${context.industry || 'this type of'} businesses.`;
  }

  // For now, use AI to simulate directory results
  const prompt = `You are a competitive intelligence analyst. Based on the company context below, suggest 8-12 real companies that would appear on directories as competitors.
${categoryGuidance}

TARGET COMPANY:
- Name: ${context.businessName}
- Industry: ${context.industry || 'Unknown'}
- Business Category: ${vertical}
- ICP: ${context.icpDescription || 'Unknown'}
- Services: ${safeJoin(context.primaryOffers) || 'Unknown'}
- Geography: ${context.geography || 'US'}

For each competitor, provide:
- name: Company name (must be REAL and in the SAME business category)
- domain: Website domain
- rating: Directory rating (4.0-5.0)
- reviews: Estimated review count
- summary: Brief description showing how they match the target's industry
- source: "clutch" | "g2" | "manifest" | "upcity" | "yelp" | "google"

Return JSON: { "agencies": [...] }`;

  try {
    const response = await aiSimple({
      systemPrompt: 'You are a directory data specialist. Return only valid JSON with real company data.',
      taskPrompt: prompt,
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true,
    });

    const parsed = JSON.parse(response);
    const agencies = Array.isArray(parsed.agencies) ? parsed.agencies : [];

    return agencies.map((a: any): DiscoveryCandidate => ({
      name: a.name || 'Unknown',
      domain: normalizeDomain(a.domain),
      homepageUrl: a.domain ? `https://${normalizeDomain(a.domain)}` : null,
      source: a.source === 'g2' ? 'g2' : a.source === 'manifest' ? 'manifest' : a.source === 'upcity' ? 'upcity' : 'clutch',
      sourceUrl: null,
      sourceRank: null,
      queryMatched: null,
      snippet: a.summary || null,
      directoryRating: typeof a.rating === 'number' ? a.rating : null,
      directoryReviews: typeof a.reviews === 'number' ? a.reviews : null,
      frequency: 1,
    }));
  } catch (error) {
    console.error('[competition-v3/directories] Directory search failed:', error);
    return [];
  }
}

// ============================================================================
// Combined Search
// ============================================================================

/**
 * Run all discovery sources and combine results
 */
export async function runDiscovery(
  context: QueryContext,
  queries: string[]
): Promise<DiscoveryCandidate[]> {
  console.log(`[competition-v3/discovery] Running multi-source discovery...`);

  // Run searches in parallel
  const [aiResults, directoryResults] = await Promise.all([
    searchWithAI(context, queries).catch(err => {
      console.error('[competition-v3/discovery] AI search failed:', err);
      return [] as DiscoveryCandidate[];
    }),
    searchDirectories(context).catch(err => {
      console.error('[competition-v3/discovery] Directory search failed:', err);
      return [] as DiscoveryCandidate[];
    }),
  ]);

  // Combine and deduplicate
  const allCandidates = [...aiResults, ...directoryResults];
  const deduplicated = deduplicateCandidates(allCandidates);

  console.log(`[competition-v3/discovery] Found ${deduplicated.length} unique candidates from ${allCandidates.length} total`);

  return deduplicated;
}

/**
 * Deduplicate candidates by domain
 */
function deduplicateCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const byDomain = new Map<string, DiscoveryCandidate>();

  for (const candidate of candidates) {
    const key = candidate.domain?.toLowerCase() || candidate.name.toLowerCase();

    const existing = byDomain.get(key);
    if (!existing) {
      byDomain.set(key, candidate);
    } else {
      // Merge - keep best data, increment frequency
      byDomain.set(key, {
        ...existing,
        frequency: existing.frequency + 1,
        // Prefer non-null values
        snippet: existing.snippet || candidate.snippet,
        directoryRating: existing.directoryRating || candidate.directoryRating,
        directoryReviews: existing.directoryReviews || candidate.directoryReviews,
        homepageUrl: existing.homepageUrl || candidate.homepageUrl,
      });
    }
  }

  // Sort by frequency (higher = found by more sources)
  return Array.from(byDomain.values()).sort((a, b) => b.frequency - a.frequency);
}
