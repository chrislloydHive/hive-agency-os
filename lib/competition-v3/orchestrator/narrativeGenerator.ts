// lib/competition-v3/orchestrator/narrativeGenerator.ts
// Narrative Generation for Competition Lab V3
//
// Generates AI-powered insights and recommendations based on
// the competitive landscape analysis.

import { aiSimple } from '@/lib/ai-gateway';
import type {
  QueryContext,
  CompetitorProfileV3,
  LandscapeInsight,
  StrategicRecommendation,
} from '../types';

// ============================================================================
// Landscape Insights
// ============================================================================

/**
 * Generate landscape narrative insights
 */
export async function generateLandscapeNarrative(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): Promise<LandscapeInsight[]> {
  console.log(`[competition-v3/narrative] Generating landscape insights for ${competitors.length} competitors`);

  if (competitors.length === 0) {
    return [];
  }

  const prompt = buildInsightsPrompt(competitors, context);

  try {
    const response = await aiSimple({
      systemPrompt: INSIGHTS_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.4,
      maxTokens: 2000,
      jsonMode: true,
    });

    const parsed = JSON.parse(response);
    const insights = parsed.insights || [];

    return insights.map((insight: any, index: number): LandscapeInsight => ({
      id: `insight-${index}`,
      category: validateCategory(insight.category),
      title: insight.title || 'Landscape Insight',
      description: insight.description || '',
      evidence: insight.evidence || [],
      competitors: insight.competitors || [],
      severity: validateSeverity(insight.severity),
    }));
  } catch (error) {
    console.error('[competition-v3/narrative] Failed to generate insights:', error);
    return generateFallbackInsights(competitors, context);
  }
}

const INSIGHTS_SYSTEM_PROMPT = `You are a strategic competitive analyst who grounds analysis in the target company's real category, industry, ICP, and offerings (do NOT assume marketing/agency unless the target company is one).

Your task is to analyze a competitive landscape in terms of FIVE competitor types:
1. DIRECT COMPETITORS: Same business model + same ICP + overlapping services. These directly compete for the same customers.
2. PARTIAL OVERLAPS (Category Neighbors): Share either ICP or services but not both. Adjacent competitors.
3. FRACTIONAL EXECUTIVES: Fractional leadership/consulting alternatives relevant to the target category (e.g., fractional CxO or specialist consultants).
4. PLATFORM ALTERNATIVES: SaaS tools or platforms (HubSpot, Marketo, etc.) that buyers consider instead of services.
5. INTERNAL ALTERNATIVES: In-house hire options that buyers weigh against using an agency.

When generating insights:
- ALWAYS describe the landscape using these five categories explicitly
- Reference the top 3 highest-threat DIRECT competitors by name
- Explain how the target company's value model and ICP differ from direct competitors
- Describe the FRACTIONAL vs AGENCY vs PLATFORM vs INTERNAL tradeoff that founders actually face
- Be opinionated about where the target company should double down
- Treat platforms as enablers/infrastructure, NOT as primary competitive threats
- Be specific and evidence-based, not generic industry commentary`;

function buildInsightsPrompt(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): string {
  // Group competitors by type
  const direct = competitors.filter(c => c.classification.type === 'direct').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const partial = competitors.filter(c => c.classification.type === 'partial').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const fractional = competitors.filter(c => c.classification.type === 'fractional').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const platforms = competitors.filter(c => c.classification.type === 'platform').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const internal = competitors.filter(c => c.classification.type === 'internal');

  // Build top direct threats section
  const topDirectThreats = direct.slice(0, 3).map(c => {
    return `  - ${c.name} (Threat: ${c.scores.threatScore}/100): ${c.summary?.slice(0, 150) || 'No summary'}`;
  }).join('\n');

  // Build category summaries
  const formatCategory = (list: CompetitorProfileV3[], limit: number) =>
    list.slice(0, limit).map(c => `${c.name} (${c.scores.threatScore})`).join(', ') || 'None identified';

  const typeDistribution = {
    direct: direct.length,
    partial: partial.length,
    fractional: fractional.length,
    platform: platforms.length,
    internal: internal.length,
  };

  const avgThreat = competitors.length > 0
    ? Math.round(competitors.reduce((sum, c) => sum + c.scores.threatScore, 0) / competitors.length)
    : 0;

  return `Analyze this competitive landscape and generate 4-6 strategic insights.

TARGET COMPANY: ${context.businessName}
- Industry: ${context.industry || 'Marketing/Growth'}
- ICP: ${context.icpDescription || 'B2B startups'}
- ICP Stage: ${context.icpStage || 'startup/growth'}
- Primary Services: ${context.primaryOffers.join(', ') || 'Marketing strategy, growth'}
- Value Proposition: ${context.valueProposition || 'Unknown'}
- AI Orientation: ${context.aiOrientation || 'Unknown'}

═══════════════════════════════════════════════════════════════
COMPETITIVE LANDSCAPE BY TYPE
═══════════════════════════════════════════════════════════════

1. DIRECT COMPETITORS (${direct.length} total):
${topDirectThreats || '  No direct competitors identified'}

2. PARTIAL OVERLAPS / CATEGORY NEIGHBORS (${partial.length} total):
   ${formatCategory(partial, 5)}

3. FRACTIONAL EXECUTIVE ALTERNATIVES (${fractional.length} total):
   ${formatCategory(fractional, 3)}

4. PLATFORM ALTERNATIVES (${platforms.length} total):
   ${formatCategory(platforms, 3)}

5. INTERNAL HIRE ALTERNATIVES (${internal.length} total):
   ${formatCategory(internal, 2)}

SUMMARY:
- Distribution: ${JSON.stringify(typeDistribution)}
- Average Threat Score: ${avgThreat}/100
- Top Direct Threat: ${direct[0]?.name || 'None'} (${direct[0]?.scores.threatScore || 0}/100)

═══════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Generate insights that:
1. Describe the landscape in terms of the five competitor types above
2. Highlight the top 3 direct threats by name and explain positioning differences
3. Compare ${context.businessName} to fractional CMO alternatives - why would a founder choose one vs the other?
4. Treat platforms as infrastructure/enablers, not primary threats
5. Be opinionated about where ${context.businessName} should focus

Return JSON:
{
  "insights": [
    {
      "category": "threat" | "opportunity" | "trend" | "white-space",
      "title": "Short headline",
      "description": "Detailed insight (2-3 sentences) that references specific competitors",
      "evidence": ["Evidence point 1", "Evidence point 2"],
      "competitors": ["Competitor Name"],
      "severity": "high" | "medium" | "low"
    }
  ]
}`;
}

function validateCategory(category: unknown): LandscapeInsight['category'] {
  const valid = ['threat', 'opportunity', 'trend', 'white-space'];
  if (typeof category === 'string' && valid.includes(category)) {
    return category as LandscapeInsight['category'];
  }
  return 'trend';
}

function validateSeverity(severity: unknown): LandscapeInsight['severity'] {
  const valid = ['high', 'medium', 'low'];
  if (typeof severity === 'string' && valid.includes(severity)) {
    return severity as LandscapeInsight['severity'];
  }
  return 'medium';
}

/**
 * Generate fallback insights when AI fails
 */
function generateFallbackInsights(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): LandscapeInsight[] {
  const insights: LandscapeInsight[] = [];

  // Count by type
  const directCount = competitors.filter(c => c.classification.type === 'direct').length;
  const platformCount = competitors.filter(c => c.classification.type === 'platform').length;
  const avgThreat = Math.round(
    competitors.reduce((sum, c) => sum + c.scores.threatScore, 0) / competitors.length
  );

  if (directCount >= 3) {
    insights.push({
      id: 'fallback-1',
      category: 'threat',
      title: 'Crowded Direct Competition',
      description: `Found ${directCount} direct competitors targeting similar customers with similar services. This market segment is crowded.`,
      evidence: [`${directCount} direct competitors identified`],
      competitors: competitors.filter(c => c.classification.type === 'direct').slice(0, 3).map(c => c.name),
      severity: directCount >= 5 ? 'high' : 'medium',
    });
  }

  if (platformCount >= 2) {
    insights.push({
      id: 'fallback-2',
      category: 'trend',
      title: 'Platform Disruption Risk',
      description: `${platformCount} platform/SaaS alternatives could disrupt traditional service delivery. Monitor for feature expansion.`,
      evidence: [`${platformCount} platform competitors identified`],
      competitors: competitors.filter(c => c.classification.type === 'platform').map(c => c.name),
      severity: 'medium',
    });
  }

  if (avgThreat < 50) {
    insights.push({
      id: 'fallback-3',
      category: 'opportunity',
      title: 'Differentiated Position',
      description: 'Average threat score is relatively low, suggesting potential differentiation opportunities in the market.',
      evidence: [`Average threat score: ${avgThreat}/100`],
      competitors: [],
      severity: 'low',
    });
  }

  return insights;
}

// ============================================================================
// Strategic Recommendations
// ============================================================================

/**
 * Generate strategic recommendations
 */
export async function generateRecommendations(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): Promise<StrategicRecommendation[]> {
  console.log(`[competition-v3/narrative] Generating recommendations`);

  if (competitors.length === 0) {
    return [];
  }

  const prompt = buildRecommendationsPrompt(competitors, context);

  try {
    const response = await aiSimple({
      systemPrompt: RECOMMENDATIONS_SYSTEM_PROMPT,
      taskPrompt: prompt,
      temperature: 0.4,
      maxTokens: 2000,
      jsonMode: true,
    });

    const parsed = JSON.parse(response);
    const recommendations = parsed.recommendations || [];

    return recommendations.map((rec: any, index: number): StrategicRecommendation => ({
      id: `rec-${index}`,
      priority: validatePriority(rec.priority),
      type: validateRecType(rec.type),
      title: rec.title || 'Strategic Recommendation',
      description: rec.description || '',
      actions: rec.actions || [],
      targetCompetitors: rec.targetCompetitors || [],
      expectedOutcome: rec.expectedOutcome || '',
    }));
  } catch (error) {
    console.error('[competition-v3/narrative] Failed to generate recommendations:', error);
    return generateFallbackRecommendations(competitors, context);
  }
}

const RECOMMENDATIONS_SYSTEM_PROMPT = `You are a strategic advisor for B2B marketing agencies serving startups. Your task is to generate actionable competitive recommendations.

Focus on strategic choices founders face:
1. Agency vs. Fractional CMO - How to win against fractional executive alternatives
2. Agency vs. Platform - How to position against DIY automation tools
3. Agency vs. In-House - Why hire you instead of a full-time marketer
4. Differentiation from Direct Competitors - Clear positioning vs. similar agencies

Your recommendations should:
- Be specific and actionable with clear next steps
- Reference actual competitor names when relevant
- Explain the buyer's decision tradeoff
- Be opinionated about where to double down vs. concede

Do NOT give generic "industry" advice. Be specific to THIS company's competitive landscape.`;

function buildRecommendationsPrompt(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): string {
  // Group by type
  const direct = competitors.filter(c => c.classification.type === 'direct').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const partial = competitors.filter(c => c.classification.type === 'partial').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const fractional = competitors.filter(c => c.classification.type === 'fractional').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const platforms = competitors.filter(c => c.classification.type === 'platform');
  const internal = competitors.filter(c => c.classification.type === 'internal');

  // Top direct threats with detail
  const topDirectDetail = direct.slice(0, 3).map(c => {
    return `- ${c.name} (Threat: ${c.scores.threatScore}): ${c.summary?.slice(0, 120) || 'No summary'}`;
  }).join('\n');

  // Top fractional competitors
  const topFractional = fractional.slice(0, 2).map(c => c.name).join(', ') || 'None identified';

  return `Generate 4-6 strategic recommendations for ${context.businessName} to compete effectively.

═══════════════════════════════════════════════════════════════
TARGET COMPANY: ${context.businessName}
═══════════════════════════════════════════════════════════════
- Value Proposition: ${context.valueProposition || 'Unknown'}
- Differentiators: ${context.differentiators.join(', ') || 'Unknown'}
- Primary Services: ${context.primaryOffers.join(', ') || 'Unknown'}
- ICP: ${context.icpDescription || 'B2B startups'}
- AI Orientation: ${context.aiOrientation || 'Unknown'}

═══════════════════════════════════════════════════════════════
COMPETITIVE CONTEXT
═══════════════════════════════════════════════════════════════

TOP DIRECT THREATS (${direct.length} total):
${topDirectDetail || 'No direct competitors identified'}

FRACTIONAL CMO ALTERNATIVES (${fractional.length} total):
${topFractional}

PLATFORM ALTERNATIVES (${platforms.length} total):
${platforms.slice(0, 3).map(p => p.name).join(', ') || 'None identified'}

CATEGORY NEIGHBORS (${partial.length} total):
${partial.slice(0, 3).map(p => p.name).join(', ') || 'None identified'}

═══════════════════════════════════════════════════════════════
RECOMMENDATION FOCUS AREAS
═══════════════════════════════════════════════════════════════

Generate recommendations addressing:
1. How to WIN against ${direct[0]?.name || 'direct competitors'} and similar direct threats
2. How to position vs. FRACTIONAL CMOs (${topFractional}) - why hire ${context.businessName} instead?
3. How to compete with PLATFORMS - emphasize what automation can't do
4. Key DIFFERENTIATION moves to stand out in this market

Return JSON:
{
  "recommendations": [
    {
      "priority": 1-4 (1 = highest),
      "type": "positioning" | "differentiation" | "defense" | "expansion",
      "title": "Short recommendation title",
      "description": "Detailed recommendation (2-3 sentences) with specific competitor references",
      "actions": ["Specific action 1", "Specific action 2"],
      "targetCompetitors": ["Competitor to counter"],
      "expectedOutcome": "What success looks like"
    }
  ]
}`;
}

function validatePriority(priority: unknown): number {
  if (typeof priority === 'number' && priority >= 1 && priority <= 4) {
    return Math.round(priority);
  }
  return 2;
}

function validateRecType(type: unknown): StrategicRecommendation['type'] {
  const valid = ['positioning', 'differentiation', 'defense', 'expansion'];
  if (typeof type === 'string' && valid.includes(type)) {
    return type as StrategicRecommendation['type'];
  }
  return 'positioning';
}

/**
 * Generate fallback recommendations when AI fails
 */
function generateFallbackRecommendations(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): StrategicRecommendation[] {
  const recommendations: StrategicRecommendation[] = [];

  const topDirect = competitors
    .filter(c => c.classification.type === 'direct')
    .sort((a, b) => b.scores.threatScore - a.scores.threatScore)[0];

  if (topDirect) {
    recommendations.push({
      id: 'fallback-rec-1',
      priority: 1,
      type: 'differentiation',
      title: `Counter ${topDirect.name}`,
      description: `${topDirect.name} is the top direct threat. Develop messaging that highlights key differences.`,
      actions: [
        `Analyze ${topDirect.name}'s positioning`,
        'Identify gaps in their offering',
        'Develop counter-messaging',
      ],
      targetCompetitors: [topDirect.name],
      expectedOutcome: 'Clear differentiation in competitive deals',
    });
  }

  const hasPlatformThreats = competitors.some(c => c.classification.type === 'platform');
  if (hasPlatformThreats) {
    recommendations.push({
      id: 'fallback-rec-2',
      priority: 2,
      type: 'defense',
      title: 'Address Platform Disruption',
      description: 'Platform alternatives threaten service delivery. Emphasize strategic value over automation.',
      actions: [
        'Document strategic value-add beyond tool capabilities',
        'Create "tools vs. strategy" positioning',
        'Build case studies showing strategic impact',
      ],
      targetCompetitors: competitors.filter(c => c.classification.type === 'platform').map(c => c.name),
      expectedOutcome: 'Protected market share from platform erosion',
    });
  }

  return recommendations;
}
