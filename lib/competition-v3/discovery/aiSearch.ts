// lib/competition-v3/discovery/aiSearch.ts
// AI-Powered Competitor Search for Competition Lab V3
//
// Uses AI to discover competitors based on context.
// Simulates web search when no API is available.

import { aiSimple } from '@/lib/ai-gateway';
import type { QueryContext, DiscoveryCandidate } from '../types';

// ============================================================================
// AI Search
// ============================================================================

const SEARCH_SYSTEM_PROMPT = `You are a competitive intelligence analyst with deep knowledge of the marketing agency, consultancy, and MarTech landscape.

Your task is to identify real companies that compete with a target company. You must:
1. Only suggest REAL, established companies (not fictional or made-up)
2. Focus on companies competing for the same customers
3. Include different types of competitors:
   - Direct competitors (same business model, same ICP, similar services)
   - Category neighbors (share some overlap but different focus)
   - Fractional executives (CMO, marketing director services)
   - Platform alternatives (SaaS tools that replace agency services)
   - Internal hire alternatives (what a company might hire instead)
4. Provide accurate domain URLs when known
5. Be specific about WHY each is a competitor

Always respond with valid JSON only. No commentary, explanations, or markdown.`;

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
  return `Identify 15-25 real companies that compete with or are alternatives to the target company described below.

TARGET COMPANY CONTEXT:
- Business Name: ${context.businessName}
- Domain: ${context.domain || 'Unknown'}
- Industry: ${context.industry || 'Marketing/Advertising'}
- Business Model: ${context.businessModel || 'Agency'}
- ICP Description: ${context.icpDescription || 'Unknown'}
- ICP Stage: ${context.icpStage || 'Unknown'}
- Target Industries: ${context.targetIndustries.join(', ') || 'Various'}
- Primary Offerings: ${context.primaryOffers.join(', ') || 'Marketing services'}
- Service Model: ${context.serviceModel || 'Unknown'}
- Price Positioning: ${context.pricePositioning || 'Unknown'}
- Value Proposition: ${context.valueProposition || 'Unknown'}
- Differentiators: ${context.differentiators.join(', ') || 'Unknown'}
- Geography: ${context.geography || 'Unknown'}
- AI/Tech Orientation: ${context.aiOrientation || 'Unknown'}

SEARCH QUERIES THAT MIGHT FIND COMPETITORS:
${queries.slice(0, 10).map((q, i) => `${i + 1}. "${q}"`).join('\n')}

COMPETITOR TYPES TO FIND:
1. DIRECT COMPETITORS (6-8): Same business model, same ICP, similar services
2. CATEGORY NEIGHBORS (4-6): Overlapping market but different focus (e.g., bigger agencies, different specialization)
3. FRACTIONAL EXECUTIVES (2-3): Fractional CMO services, marketing advisors
4. PLATFORM ALTERNATIVES (2-3): SaaS tools that could replace some services
5. INTERNAL ALTERNATIVES (1-2): What companies might hire internally instead

For each competitor, provide:
- name: Company name (required, must be a REAL company)
- domain: Their website domain (e.g., "example.com")
- homepageUrl: Full URL (e.g., "https://example.com")
- competitorType: "direct" | "partial" | "fractional" | "platform" | "internal"
- summary: 1-2 sentence description
- whyCompetitor: Why they compete with the target
- estimatedSize: "solo" | "small" | "medium" | "large" | "enterprise"
- pricingTier: "budget" | "mid" | "premium" | "enterprise" | null
- geography: Primary market/region

IMPORTANT:
- Only include REAL companies that actually exist
- Do NOT make up company names or domains
- Prioritize companies that truly compete for the same customers
- Include a good mix of competitor types

Respond with a JSON object containing a "competitors" array:
{
  "competitors": [
    {
      "name": "Company Name",
      "domain": "example.com",
      "homepageUrl": "https://example.com",
      "competitorType": "direct",
      "summary": "Brief description of what they do.",
      "whyCompetitor": "Why they compete with the target.",
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

  // For now, use AI to simulate directory results
  const prompt = `You are a competitive intelligence analyst. Based on the company context below, suggest 8-12 real companies that would appear on directories like Clutch, G2, and Manifest as competitors.

TARGET COMPANY:
- Name: ${context.businessName}
- Industry: ${context.industry || 'Marketing'}
- ICP: ${context.icpDescription || 'Unknown'}
- Services: ${context.primaryOffers.join(', ') || 'Marketing services'}
- Geography: ${context.geography || 'US'}

For each competitor, provide:
- name: Company name (must be REAL)
- domain: Website domain
- rating: Clutch/G2 rating (4.0-5.0)
- reviews: Estimated review count
- summary: Brief description
- source: "clutch" | "g2" | "manifest" | "upcity"

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
