// lib/gap-heavy/strategicOrchestrator.ts
// GAP Heavy Strategic Intelligence Orchestrator
//
// This orchestrator transforms multi-source diagnostic data into strategic
// intelligence focused on competitors, visibility, opportunities, and priorities.
//
// GAP Heavy is NOT another diagnostic. It synthesizes:
// - Crawler data (site structure, content, pages)
// - GSC/Analytics data (search visibility, traffic patterns)
// - Social/GBP signals (local presence, social proof)
// - Competitor inference (SERP analysis, market positioning)
//
// Into strategic outputs:
// - Competitor landscape analysis
// - Search visibility map
// - Growth opportunities
// - Funnel gaps
// - Strategic priorities
// - "How we win" narrative

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { EvidencePack, DiagnosticModuleResult } from './types';
import {
  type GapHeavyResult,
  type GapHeavyCompetitor,
  type GapHeavyVisibilityMap,
  type GapHeavyOpportunity,
  type GapHeavyFunnelGap,
  type GapHeavyLocalAndSocialSignals,
  type GapHeavyStrategicPriority,
  type GapHeavyEvidenceItem,
  type GapHeavyDataSignals,
  type GapHeavyEngineResult,
  computeGapHeavyConfidence,
  generateGapHeavyId,
  createEmptyGapHeavyResult,
  GapHeavyResultSchema,
} from './strategicTypes';

// ============================================================================
// Types
// ============================================================================

export interface StrategicOrchestratorInput {
  /** Company record */
  company: CompanyRecord;
  /** Website URL being analyzed */
  websiteUrl: string;
  /** Evidence pack from Heavy Worker V4 modules */
  evidencePack: EvidencePack;
  /** Optional existing heavy run ID */
  heavyRunId?: string;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run the GAP Heavy Strategic Intelligence analysis
 *
 * This takes evidence from Heavy Worker V4 modules and synthesizes it into
 * strategic intelligence about competitors, visibility, opportunities, and priorities.
 */
export async function runStrategicOrchestrator(
  input: StrategicOrchestratorInput
): Promise<GapHeavyEngineResult> {
  console.log('[Strategic Orchestrator] Starting strategic intelligence analysis:', {
    companyId: input.company.id,
    websiteUrl: input.websiteUrl,
  });

  try {
    // Step 1: Compute data signals and confidence
    const dataSignals = computeDataSignals(input.evidencePack);
    const dataConfidence = computeGapHeavyConfidence(dataSignals);

    console.log('[Strategic Orchestrator] Data signals:', dataSignals);
    console.log('[Strategic Orchestrator] Data confidence:', dataConfidence);

    // Step 2: Extract evidence items from all sources
    const evidence = extractEvidenceItems(input.evidencePack);
    console.log('[Strategic Orchestrator] Extracted evidence items:', evidence.length);

    // Step 3: Use AI to synthesize strategic intelligence
    const strategicResult = await synthesizeStrategicIntelligence({
      company: input.company,
      websiteUrl: input.websiteUrl,
      evidencePack: input.evidencePack,
      dataSignals,
      evidence,
    });

    // Step 4: Build final result
    const result: GapHeavyResult = {
      companyId: input.company.id,
      dataConfidence,
      dataSignals,
      competitorLandscape: strategicResult.competitorLandscape,
      searchVisibilityMap: strategicResult.searchVisibilityMap,
      categoryOpportunities: strategicResult.categoryOpportunities,
      contentOpportunities: strategicResult.contentOpportunities,
      funnelGaps: strategicResult.funnelGaps,
      localAndSocialSignals: strategicResult.localAndSocialSignals,
      strategicPriorities: strategicResult.strategicPriorities,
      strategistNarrative: strategicResult.strategistNarrative,
      evidence,
      createdAt: new Date().toISOString(),
    };

    console.log('[Strategic Orchestrator] Analysis complete:', {
      competitors: result.competitorLandscape.length,
      opportunities: result.categoryOpportunities.length + result.contentOpportunities.length,
      funnelGaps: result.funnelGaps.length,
      priorities: result.strategicPriorities.length,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error('[Strategic Orchestrator] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Data Signal Computation
// ============================================================================

/**
 * Compute data signals from evidence pack
 */
function computeDataSignals(evidencePack: EvidencePack): GapHeavyDataSignals {
  const modules = evidencePack.modules || [];

  // Check for GSC data in demand module or evidence
  const demandModule = modules.find(m => m.module === 'demand');
  const hasGsc = !!(
    evidencePack.demand?.gsc ||
    (demandModule?.rawEvidence as any)?.gsc
  );

  // Check for SERP samples (from competitor analysis or SEO module)
  const seoModule = modules.find(m => m.module === 'seo');
  const hasSerpSamples = !!(
    (seoModule?.rawEvidence as any)?.serpSamples ||
    evidencePack.presence?.serpData
  );

  // Check for crawl data (from website module or presence)
  const websiteModule = modules.find(m => m.module === 'website');
  const hasCrawl = !!(
    websiteModule?.status === 'completed' ||
    evidencePack.websiteLabV4 ||
    evidencePack.presence?.pages
  );

  // Check for GBP data
  const hasGbp = !!(
    evidencePack.presence?.gbp ||
    (demandModule?.rawEvidence as any)?.gbp
  );

  // Check for social data
  const hasSocial = !!(
    evidencePack.presence?.social ||
    evidencePack.brand?.socialProofDensity
  );

  // Check for analytics data (GA4)
  const hasAnalytics = !!(
    evidencePack.demand?.ga4 ||
    (demandModule?.rawEvidence as any)?.ga4
  );

  // Count identified competitors
  const competitorCount = countCompetitors(evidencePack);

  return {
    hasGsc,
    hasSerpSamples,
    hasCrawl,
    hasGbp,
    hasSocial,
    hasAnalytics,
    competitorCount,
  };
}

/**
 * Count identified competitors from evidence
 */
function countCompetitors(evidencePack: EvidencePack): number {
  // Check brand evidence for competitor context
  const brandCompetitors = evidencePack.brand?.competitorBrandContext?.competitors || [];

  // Check presence evidence for competitors
  const presenceCompetitors = (evidencePack.presence?.competitors as any[]) || [];

  // Deduplicate by URL
  const allCompetitors = [...brandCompetitors, ...presenceCompetitors];
  const uniqueUrls = new Set(allCompetitors.map(c => c.url).filter(Boolean));

  return uniqueUrls.size;
}

// ============================================================================
// Evidence Extraction
// ============================================================================

/**
 * Extract evidence items from all sources in the evidence pack
 */
function extractEvidenceItems(evidencePack: EvidencePack): GapHeavyEvidenceItem[] {
  const evidence: GapHeavyEvidenceItem[] = [];
  const modules = evidencePack.modules || [];

  // Add evidence from each completed module
  for (const mod of modules) {
    if (mod.status !== 'completed') continue;

    // Add summary as evidence
    if (mod.summary) {
      evidence.push({
        id: generateGapHeavyId('ev'),
        source: mapModuleToEvidenceSource(mod.module),
        description: `${mod.module.toUpperCase()} Module: ${mod.summary}`,
      });
    }

    // Add key issues as evidence
    for (const issue of (mod.issues || []).slice(0, 3)) {
      evidence.push({
        id: generateGapHeavyId('ev'),
        source: mapModuleToEvidenceSource(mod.module),
        description: issue,
      });
    }
  }

  // Add brand evidence
  if (evidencePack.brand) {
    if (evidencePack.brand.valuePropositionSummary) {
      evidence.push({
        id: generateGapHeavyId('ev'),
        source: 'crawler',
        description: `Value Proposition: ${evidencePack.brand.valuePropositionSummary}`,
      });
    }
    if (evidencePack.brand.competitorOverlapNotes) {
      evidence.push({
        id: generateGapHeavyId('ev'),
        source: 'serp',
        description: `Competitor Notes: ${evidencePack.brand.competitorOverlapNotes}`,
      });
    }
  }

  // Add GSC/Analytics evidence
  if (evidencePack.demand?.gsc) {
    evidence.push({
      id: generateGapHeavyId('ev'),
      source: 'search-console',
      description: 'Google Search Console data available for visibility analysis',
    });
  }
  if (evidencePack.demand?.ga4) {
    evidence.push({
      id: generateGapHeavyId('ev'),
      source: 'analytics',
      description: 'GA4 analytics data available for traffic analysis',
    });
  }

  return evidence;
}

/**
 * Map module key to evidence source
 */
function mapModuleToEvidenceSource(module: string): GapHeavyEvidenceItem['source'] {
  switch (module) {
    case 'seo':
      return 'crawler';
    case 'content':
      return 'crawler';
    case 'website':
      return 'crawler';
    case 'brand':
      return 'crawler';
    case 'demand':
      return 'analytics';
    case 'ops':
      return 'other';
    default:
      return 'other';
  }
}

// ============================================================================
// AI Synthesis
// ============================================================================

interface SynthesisInput {
  company: CompanyRecord;
  websiteUrl: string;
  evidencePack: EvidencePack;
  dataSignals: GapHeavyDataSignals;
  evidence: GapHeavyEvidenceItem[];
}

interface SynthesisOutput {
  competitorLandscape: GapHeavyCompetitor[];
  searchVisibilityMap: GapHeavyVisibilityMap;
  categoryOpportunities: GapHeavyOpportunity[];
  contentOpportunities: GapHeavyOpportunity[];
  funnelGaps: GapHeavyFunnelGap[];
  localAndSocialSignals: GapHeavyLocalAndSocialSignals;
  strategicPriorities: GapHeavyStrategicPriority[];
  strategistNarrative: string;
}

/**
 * Use AI to synthesize strategic intelligence from evidence
 */
async function synthesizeStrategicIntelligence(
  input: SynthesisInput
): Promise<SynthesisOutput> {
  console.log('[Strategic Orchestrator] Synthesizing strategic intelligence with AI...');

  const systemPrompt = buildSystemPrompt();
  const taskPrompt = buildTaskPrompt(input);

  try {
    const result = await aiForCompany(input.company.id, {
      type: 'Strategy',
      tags: ['GAP Heavy', 'Strategic', 'Competitive', 'Intelligence'],
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.5,
      jsonMode: true,
      maxTokens: 8000,
    });

    // Parse AI response
    const parsed = JSON.parse(result.content);

    // Add IDs to all items
    return {
      competitorLandscape: (parsed.competitorLandscape || []).map((c: any, i: number) => ({
        id: c.id || generateGapHeavyId('comp'),
        name: c.name || `Competitor ${i + 1}`,
        url: c.url,
        positionSummary: c.positionSummary || '',
        relativeStrengths: c.relativeStrengths || [],
        relativeWeaknesses: c.relativeWeaknesses || [],
        inferredChannels: c.inferredChannels || [],
        notes: c.notes,
      })),
      searchVisibilityMap: {
        summary: parsed.searchVisibilityMap?.summary || 'Unable to determine search visibility.',
        keyChannels: parsed.searchVisibilityMap?.keyChannels || [],
        brandVsNonBrand: parsed.searchVisibilityMap?.brandVsNonBrand || 'Unknown',
        coverageByIntent: parsed.searchVisibilityMap?.coverageByIntent || [],
        notes: parsed.searchVisibilityMap?.notes,
      },
      categoryOpportunities: (parsed.categoryOpportunities || []).map((o: any) => ({
        id: o.id || generateGapHeavyId('catop'),
        title: o.title || '',
        category: o.category || 'category',
        description: o.description || '',
        expectedImpact: o.expectedImpact || 'medium',
        timeHorizon: o.timeHorizon || 'mid-term',
        supportingEvidenceIds: o.supportingEvidenceIds,
      })),
      contentOpportunities: (parsed.contentOpportunities || []).map((o: any) => ({
        id: o.id || generateGapHeavyId('contop'),
        title: o.title || '',
        category: o.category || 'content',
        description: o.description || '',
        expectedImpact: o.expectedImpact || 'medium',
        timeHorizon: o.timeHorizon || 'mid-term',
        supportingEvidenceIds: o.supportingEvidenceIds,
      })),
      funnelGaps: (parsed.funnelGaps || []).map((g: any) => ({
        id: g.id || generateGapHeavyId('fg'),
        title: g.title || '',
        description: g.description || '',
        stage: g.stage || 'consideration',
        severity: g.severity || 'medium',
        supportingEvidenceIds: g.supportingEvidenceIds,
      })),
      localAndSocialSignals: {
        summary: parsed.localAndSocialSignals?.summary || 'Unable to determine local and social presence.',
        localPresence: parsed.localAndSocialSignals?.localPresence || 'Unknown',
        reviewPositioning: parsed.localAndSocialSignals?.reviewPositioning || 'Unknown',
        socialProofSummary: parsed.localAndSocialSignals?.socialProofSummary || 'Unknown',
        notes: parsed.localAndSocialSignals?.notes,
      },
      strategicPriorities: (parsed.strategicPriorities || []).map((p: any) => ({
        id: p.id || generateGapHeavyId('sp'),
        title: p.title || '',
        whyItMatters: p.whyItMatters || '',
        recommendedPlays: p.recommendedPlays || [],
        relatedOpportunitiesIds: p.relatedOpportunitiesIds,
        relatedFunnelGapIds: p.relatedFunnelGapIds,
      })),
      strategistNarrative: parsed.strategistNarrative || 'Unable to generate strategic narrative.',
    };
  } catch (error) {
    console.error('[Strategic Orchestrator] AI synthesis failed:', error);

    // Return fallback based on raw evidence
    return buildFallbackSynthesis(input);
  }
}

/**
 * Build system prompt for strategic intelligence synthesis
 */
function buildSystemPrompt(): string {
  return `You are a senior growth strategist conducting a competitive and market intelligence analysis.

Your role is to synthesize multi-source evidence into strategic insights:
- Identify who the competitors are and how they compare
- Map search visibility and market positioning
- Find growth opportunities across category, content, and funnel
- Identify funnel gaps that need attention
- Determine strategic priorities - the big levers for growth
- Write a consultant-grade "how we win" narrative

IMPORTANT: You are NOT creating another diagnostic with scores. You are creating STRATEGIC INTELLIGENCE.
- Focus on competitive positioning, not internal scores
- Focus on market opportunities, not technical issues
- Focus on "where to win" not "what's broken"
- Think like a strategy consultant, not an auditor

Output ONLY valid JSON matching the exact structure provided.`;
}

/**
 * Build task prompt with evidence context
 */
function buildTaskPrompt(input: SynthesisInput): string {
  const { company, websiteUrl, evidencePack, dataSignals, evidence } = input;

  // Build evidence summary
  const evidenceSummary = evidence
    .map(e => `- [${e.source}] ${e.description}`)
    .join('\n');

  // Build module summaries
  const modules = evidencePack.modules || [];
  const moduleSummaries = modules
    .filter(m => m.status === 'completed' && m.summary)
    .map(m => `- ${m.module.toUpperCase()}: ${m.summary}`)
    .join('\n');

  // Build brand context if available
  let brandContext = '';
  if (evidencePack.brand) {
    brandContext = `
## Brand Evidence
- Value Proposition: ${evidencePack.brand.valuePropositionSummary || 'Unknown'}
- Audience Clarity: ${evidencePack.brand.audienceClarityLevel || 'Unknown'}
- Differentiation: ${evidencePack.brand.differentiationLevel || 'Unknown'}
- Social Proof: ${evidencePack.brand.socialProofDensity || 'Unknown'}
${evidencePack.brand.competitorBrandContext?.competitors?.length ? `- Known Competitors: ${evidencePack.brand.competitorBrandContext.competitors.map(c => c.name).join(', ')}` : ''}
`;
  }

  // Build content context if available
  let contentContext = '';
  if (evidencePack.content) {
    contentContext = `
## Content Evidence
${JSON.stringify(evidencePack.content, null, 2).slice(0, 2000)}
`;
  }

  return `Analyze ${company.name} (${websiteUrl}) and provide strategic intelligence.

## Company Context
- Name: ${company.name}
- Website: ${websiteUrl}
- Industry: ${company.industry || 'Unknown'}
- Stage: ${company.stage || 'Unknown'}

## Data Availability
- GSC Data: ${dataSignals.hasGsc ? 'Yes' : 'No'}
- SERP Samples: ${dataSignals.hasSerpSamples ? 'Yes' : 'No'}
- Site Crawl: ${dataSignals.hasCrawl ? 'Yes' : 'No'}
- GBP Data: ${dataSignals.hasGbp ? 'Yes' : 'No'}
- Social Data: ${dataSignals.hasSocial ? 'Yes' : 'No'}
- Analytics: ${dataSignals.hasAnalytics ? 'Yes' : 'No'}
- Competitors Identified: ${dataSignals.competitorCount}

## Module Analysis Summaries
${moduleSummaries || 'No module summaries available'}
${brandContext}
${contentContext}

## Evidence Collected
${evidenceSummary || 'Limited evidence available'}

---

Generate strategic intelligence in this exact JSON structure:

{
  "competitorLandscape": [
    {
      "name": "Competitor name",
      "url": "https://...",
      "positionSummary": "How they are positioned in the market",
      "relativeStrengths": ["Strength vs ${company.name}"],
      "relativeWeaknesses": ["Weakness vs ${company.name}"],
      "inferredChannels": ["SEO", "Paid Search", "Social", etc.],
      "notes": "Additional context"
    }
  ],
  "searchVisibilityMap": {
    "summary": "Narrative overview of visibility vs competitors",
    "keyChannels": ["Google Search", "Local/GBP", etc.],
    "brandVsNonBrand": "Descriptive split (e.g., 80% branded, 20% non-branded)",
    "coverageByIntent": ["Strong on X", "Weak on Y"],
    "notes": "Additional context"
  },
  "categoryOpportunities": [
    {
      "title": "Short opportunity title",
      "category": "category",
      "description": "Detailed description",
      "expectedImpact": "high|medium|low",
      "timeHorizon": "near-term|mid-term|long-term"
    }
  ],
  "contentOpportunities": [
    {
      "title": "Short opportunity title",
      "category": "content",
      "description": "Detailed description",
      "expectedImpact": "high|medium|low",
      "timeHorizon": "near-term|mid-term|long-term"
    }
  ],
  "funnelGaps": [
    {
      "title": "Short gap title",
      "description": "Detailed description",
      "stage": "awareness|consideration|decision|post-purchase",
      "severity": "high|medium|low"
    }
  ],
  "localAndSocialSignals": {
    "summary": "Overview of local and social presence",
    "localPresence": "Description of local presence",
    "reviewPositioning": "Review positioning vs competitors",
    "socialProofSummary": "Social proof assessment"
  },
  "strategicPriorities": [
    {
      "title": "Big lever title (e.g., 'Win non-branded category searches')",
      "whyItMatters": "Strategic rationale",
      "recommendedPlays": ["Action 1", "Action 2", "Action 3"]
    }
  ],
  "strategistNarrative": "2-3 paragraph consultant-grade narrative explaining how ${company.name} can win in their market. This should feel like strategic advice from a senior growth consultant, not a list of issues. Focus on the 'so what' and 'now what'."
}

Guidelines:
- Identify 2-5 competitors based on evidence (or infer likely competitors from the market)
- Find 3-5 category opportunities and 3-5 content opportunities
- Identify 3-5 funnel gaps across the buyer journey
- Distill 3-5 strategic priorities (the biggest levers)
- Write a compelling narrative that ties it all together
- If data is limited, make reasonable inferences but note the uncertainty`;
}

/**
 * Build fallback synthesis when AI fails
 */
function buildFallbackSynthesis(input: SynthesisInput): SynthesisOutput {
  const { evidencePack } = input;

  // Extract any competitor data from brand evidence
  const brandCompetitors = evidencePack.brand?.competitorBrandContext?.competitors || [];
  const competitors: GapHeavyCompetitor[] = brandCompetitors.map((c: any, i: number) => ({
    id: generateGapHeavyId('comp'),
    name: c.name || `Competitor ${i + 1}`,
    url: c.url,
    positionSummary: c.positioningSummary || 'Unable to determine positioning',
    relativeStrengths: [],
    relativeWeaknesses: [],
    inferredChannels: [],
  }));

  // Build opportunities from module recommendations
  const modules = evidencePack.modules || [];
  const categoryOpportunities: GapHeavyOpportunity[] = [];
  const contentOpportunities: GapHeavyOpportunity[] = [];

  for (const mod of modules) {
    if (mod.status !== 'completed') continue;
    for (const rec of (mod.recommendations || []).slice(0, 2)) {
      const opp: GapHeavyOpportunity = {
        id: generateGapHeavyId('op'),
        title: rec.length > 60 ? rec.slice(0, 57) + '...' : rec,
        category: mod.module === 'content' ? 'content' : 'category',
        description: rec,
        expectedImpact: 'medium',
        timeHorizon: 'mid-term',
      };
      if (mod.module === 'content') {
        contentOpportunities.push(opp);
      } else {
        categoryOpportunities.push(opp);
      }
    }
  }

  // Build funnel gaps from issues
  const funnelGaps: GapHeavyFunnelGap[] = [];
  for (const mod of modules) {
    if (mod.status !== 'completed') continue;
    for (const issue of (mod.issues || []).slice(0, 2)) {
      funnelGaps.push({
        id: generateGapHeavyId('fg'),
        title: issue.length > 60 ? issue.slice(0, 57) + '...' : issue,
        description: issue,
        stage: 'consideration',
        severity: 'medium',
      });
    }
  }

  return {
    competitorLandscape: competitors,
    searchVisibilityMap: {
      summary: 'Limited data available for visibility analysis.',
      keyChannels: ['Google Search'],
      brandVsNonBrand: 'Unknown - insufficient search data',
      coverageByIntent: [],
    },
    categoryOpportunities,
    contentOpportunities,
    funnelGaps,
    localAndSocialSignals: {
      summary: 'Limited data available for local and social analysis.',
      localPresence: evidencePack.brand?.trustSignalsPresent ? 'Some local signals detected' : 'Unknown',
      reviewPositioning: 'Unknown',
      socialProofSummary: evidencePack.brand?.socialProofDensity || 'Unknown',
    },
    strategicPriorities: categoryOpportunities.slice(0, 3).map(o => ({
      id: generateGapHeavyId('sp'),
      title: o.title,
      whyItMatters: 'Identified as a growth opportunity based on diagnostic analysis.',
      recommendedPlays: [o.description],
    })),
    strategistNarrative: 'Strategic analysis was limited by available data. Run additional diagnostics to improve data confidence and enable deeper strategic insights.',
  };
}
