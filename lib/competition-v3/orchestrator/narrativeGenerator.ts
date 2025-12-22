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
  VerticalCategory,
} from '../types';
import { getVerticalTerminology, type VerticalTerminology } from '../verticalClassifier';
import { isB2CVertical } from './verticalDetection';
import { getVerticalModel } from './verticalModels';

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

const INSIGHTS_SYSTEM_PROMPT = `You are a strategic competitive analyst who grounds analysis in the target company's real category, industry, ICP, and offerings.

CRITICAL BUSINESS MODEL RULES:
- For B2C companies: Use consumer-focused language (consumers, shoppers, customers, households, drivers, local buyers). NEVER mention "B2B startups", "enterprise accounts", or SaaS-focused language.
- For B2B companies: Use business-focused language (clients, accounts, organizations, teams, enterprises). May mention startups if that's the actual ICP.
- For Hybrid companies: Acknowledge both audiences appropriately.

DO NOT assume marketing/agency/startup unless the context explicitly says so.

Your task is to analyze a competitive landscape in terms of FIVE competitor types:
1. DIRECT COMPETITORS: Same business model + same ICP + overlapping services. These directly compete for the same customers.
2. PARTIAL OVERLAPS (Category Neighbors): Share either ICP or services but not both. Adjacent competitors.
3. FRACTIONAL EXECUTIVES: Fractional leadership/consulting alternatives (if relevant to the category).
4. PLATFORM ALTERNATIVES: Online platforms or e-commerce that buyers consider as alternatives.
5. INTERNAL ALTERNATIVES: In-house or DIY options buyers weigh against using the company.

When generating insights:
- ALWAYS use language appropriate to the businessModelCategory (B2B/B2C/Hybrid)
- Use the provided industry/category in your analysis (e.g., "automotive aftermarket", "consumer electronics", "skateboard retail")
- Reference the top 3 highest-threat DIRECT competitors by name
- Describe competition in terms the company's actual customers would recognize
- Be specific and evidence-based, grounded in the provided competitor data
- NEVER use generic "tech startup" or "SaaS" language for retail/consumer companies`;


function buildInsightsPrompt(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): string {
  // Get vertical-specific terminology and model
  const vertical = context.verticalCategory || 'unknown';
  const terminology = getVerticalTerminology(vertical);
  const verticalModel = getVerticalModel(vertical);
  const isB2C = isB2CVertical(vertical);

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

  // Build threat distribution (B2C-aware)
  const threatDistribution: Record<string, number> = {
    direct: direct.length,
    partial: partial.length,
    platform: platforms.length,
  };
  if (!isB2C) {
    threatDistribution.fractional = fractional.length;
    threatDistribution.internal = internal.length;
  }

  const avgThreat = competitors.length > 0
    ? Math.round(competitors.reduce((sum, c) => sum + c.scores.threatScore, 0) / competitors.length)
    : 0;

  // Build audience description based on business model category
  const audienceDescription = context.businessModelCategory === 'B2C'
    ? 'Consumers and individual customers'
    : context.businessModelCategory === 'B2B'
    ? 'Business clients and organizations'
    : context.businessModelCategory === 'Hybrid'
    ? 'Both consumers and business customers'
    : 'General market';

  // Build vertical-specific language guidance
  const verticalGuidance = buildVerticalLanguageGuidance(vertical, terminology, context.subVertical);

  // Build competitor sections - hide B2B-only sections for B2C verticals
  let competitorSections = `
1. DIRECT ${verticalModel.typeLabels.direct.toUpperCase()}S (${direct.length} total):
${topDirectThreats || '  No direct competitors identified'}

2. ${verticalModel.typeLabels.partial.toUpperCase()}S / CATEGORY NEIGHBORS (${partial.length} total):
   ${formatCategory(partial, 5)}

3. ${verticalModel.typeLabels.platform.toUpperCase()}S (${platforms.length} total):
   ${formatCategory(platforms, 3)}`;

  // Only add fractional/internal sections for B2B verticals
  if (!isB2C) {
    competitorSections += `

4. FRACTIONAL/CONSULTANT ALTERNATIVES (${fractional.length} total):
   ${formatCategory(fractional, 3)}

5. INTERNAL HIRE ALTERNATIVES (${internal.length} total):
   ${formatCategory(internal, 2)}`;
  }

  // Build insight focus instructions based on vertical
  let insightInstructions: string;
  if (isB2C) {
    insightInstructions = `Generate insights that:
1. Describe the landscape using ${verticalModel.threatTerminology.competitor} and ${verticalModel.threatTerminology.competitors} terminology
2. Highlight the top 3 direct threats by name and explain positioning differences
3. Analyze local market dynamics - how do ${verticalModel.threatTerminology.customers} choose between ${context.businessName} and competitors?
4. Assess platform/online alternatives (Amazon, online retailers) and their impact on ${verticalModel.threatTerminology.market}
5. Identify omni-channel positioning opportunities - online presence vs. in-store experience
6. Be opinionated about where ${context.businessName} should focus to win ${verticalModel.threatTerminology.customers}`;
  } else {
    insightInstructions = `Generate insights that:
1. Describe the landscape in terms of the competitor types above
2. Highlight the top 3 direct threats by name and explain positioning differences
3. Compare ${context.businessName} to fractional/consultant alternatives - why would a client choose one vs the other?
4. Assess platform alternatives as potential disruptors
5. Analyze the internal hire alternative - what makes clients choose agency vs. in-house?
6. Be opinionated about where ${context.businessName} should focus`;
  }

  return `Analyze this competitive landscape and generate 4-6 strategic insights.

TARGET COMPANY: ${context.businessName}
- Business Model: ${context.businessModelCategory || 'Unknown'} (${context.businessModelCategory === 'B2C' ? 'consumer-facing' : context.businessModelCategory === 'B2B' ? 'business-facing' : 'general market'})
- Vertical: ${vertical}${context.subVertical ? ` (${context.subVertical})` : ''}
- Industry/Category: ${context.industry || 'General retail/services'}
- Target Audience: ${context.icpDescription || audienceDescription}
- Company Stage: ${context.icpStage || 'established'}
- Primary Offerings: ${safeJoin(context.primaryOffers) || 'Products and services'}
- Value Proposition: ${context.valueProposition || 'Unknown'}
- Number of Direct Competitors: ${direct.length}
- Competitor Type Model: ${verticalModel.displayName}

═══════════════════════════════════════════════════════════════
VERTICAL-SPECIFIC LANGUAGE RULES
═══════════════════════════════════════════════════════════════
${verticalGuidance}

Use these terms consistently:
- Customer: "${terminology.customer}" / "${terminology.customers}"
- Product/Service: "${terminology.product}" / "${terminology.products}"
- Competitor: "${terminology.competitor}" / "${terminology.competitors}"
- Market: "${terminology.market}"
${isB2C ? `
CRITICAL FOR ${vertical.toUpperCase()} VERTICAL:
- NEVER use: "B2B", "clients", "accounts", "enterprise", "SaaS", "internal hire", "fractional CMO"
- ALWAYS use: "${verticalModel.threatTerminology.customers}", "${verticalModel.threatTerminology.market}", "local market", "store", "shop"` : ''}

═══════════════════════════════════════════════════════════════
COMPETITIVE LANDSCAPE BY TYPE
═══════════════════════════════════════════════════════════════
${competitorSections}

SUMMARY:
- Threat Distribution: ${JSON.stringify(threatDistribution)}
- Average Threat Score: ${avgThreat}/100
- Top Direct Threat: ${direct[0]?.name || 'None'} (${direct[0]?.scores.threatScore || 0}/100)

═══════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════

${insightInstructions}

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
  const vertical = context.verticalCategory || 'unknown';
  const verticalModel = getVerticalModel(vertical);
  const isB2C = isB2CVertical(vertical);

  // Count by type
  const directCount = competitors.filter(c => c.classification.type === 'direct').length;
  const platformCount = competitors.filter(c => c.classification.type === 'platform').length;
  const avgThreat = Math.round(
    competitors.reduce((sum, c) => sum + c.scores.threatScore, 0) / competitors.length
  );

  if (directCount >= 3) {
    const competitorTerm = isB2C ? verticalModel.threatTerminology.competitors : 'direct competitors';
    const customerTerm = isB2C ? verticalModel.threatTerminology.customers : 'customers';
    insights.push({
      id: 'fallback-1',
      category: 'threat',
      title: isB2C ? 'Crowded Local Market' : 'Crowded Direct Competition',
      description: `Found ${directCount} ${competitorTerm} targeting similar ${customerTerm}. This market segment is crowded.`,
      evidence: [`${directCount} ${competitorTerm} identified`],
      competitors: competitors.filter(c => c.classification.type === 'direct').slice(0, 3).map(c => c.name),
      severity: directCount >= 5 ? 'high' : 'medium',
    });
  }

  if (platformCount >= 2) {
    const platformDescription = isB2C
      ? `${platformCount} online/e-commerce alternatives compete for ${verticalModel.threatTerminology.customer} attention. Monitor for local delivery expansion.`
      : `${platformCount} platform/SaaS alternatives could disrupt traditional service delivery. Monitor for feature expansion.`;
    insights.push({
      id: 'fallback-2',
      category: 'trend',
      title: isB2C ? 'Online Competition Pressure' : 'Platform Disruption Risk',
      description: platformDescription,
      evidence: [`${platformCount} platform competitors identified`],
      competitors: competitors.filter(c => c.classification.type === 'platform').map(c => c.name),
      severity: 'medium',
    });
  }

  if (avgThreat < 50) {
    const marketTerm = isB2C ? verticalModel.threatTerminology.market : 'market';
    insights.push({
      id: 'fallback-3',
      category: 'opportunity',
      title: 'Differentiated Position',
      description: `Average threat score is relatively low, suggesting potential differentiation opportunities in the ${marketTerm}.`,
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

const RECOMMENDATIONS_SYSTEM_PROMPT = `You are a strategic advisor who generates actionable competitive recommendations. Adapt your language to the company's business model.

CRITICAL: Match language to business model:
- For B2C companies: Focus on consumer decisions, shopper behavior, local market strategies. Avoid "B2B", "enterprise", or "startup" language.
- For B2B companies: Focus on client acquisition, account management, enterprise sales.
- For Hybrid: Address both consumer and business audiences appropriately.

Focus on strategic choices buyers face based on the industry:
1. Direct Competition - How to differentiate from similar companies
2. Platform Alternatives - How to position vs. e-commerce/online alternatives
3. DIY/In-House Options - Why customers should choose you vs. doing it themselves
4. Category Neighbors - How to capture share from adjacent competitors

Your recommendations should:
- Be specific and actionable with clear next steps
- Reference actual competitor names when relevant
- Use industry-appropriate language (retail, automotive, consumer, etc.)
- Be opinionated about where to double down vs. concede

Do NOT use generic startup/SaaS language for consumer retail companies.`;

function buildRecommendationsPrompt(
  competitors: CompetitorProfileV3[],
  context: QueryContext
): string {
  // Get vertical-specific terminology and model
  const vertical = context.verticalCategory || 'unknown';
  const terminology = getVerticalTerminology(vertical);
  const verticalModel = getVerticalModel(vertical);
  const isB2C = isB2CVertical(vertical);

  // Group by type
  const direct = competitors.filter(c => c.classification.type === 'direct').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const partial = competitors.filter(c => c.classification.type === 'partial').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const fractional = competitors.filter(c => c.classification.type === 'fractional').sort((a, b) => b.scores.threatScore - a.scores.threatScore);
  const platforms = competitors.filter(c => c.classification.type === 'platform');

  // Top direct threats with detail
  const topDirectDetail = direct.slice(0, 3).map(c => {
    return `- ${c.name} (Threat: ${c.scores.threatScore}): ${c.summary?.slice(0, 120) || 'No summary'}`;
  }).join('\n');

  // Build audience description based on business model category
  const audienceDescription = context.businessModelCategory === 'B2C'
    ? 'Consumers and individual customers'
    : context.businessModelCategory === 'B2B'
    ? 'Business clients and organizations'
    : context.businessModelCategory === 'Hybrid'
    ? 'Both consumers and business customers'
    : 'General market';

  // Build vertical-specific language guidance
  const verticalGuidance = buildVerticalLanguageGuidance(vertical, terminology, context.subVertical);

  // Build competitive context sections (B2C-aware)
  let competitiveContext = `TOP DIRECT ${verticalModel.typeLabels.direct.toUpperCase()}S (${direct.length} total):
${topDirectDetail || 'No direct competitors identified'}

${verticalModel.typeLabels.platform.toUpperCase()}S (${platforms.length} total):
${platforms.slice(0, 3).map(p => p.name).join(', ') || 'None identified'}

${verticalModel.typeLabels.partial.toUpperCase()}S (${partial.length} total):
${partial.slice(0, 3).map(p => p.name).join(', ') || 'None identified'}`;

  // Only add fractional section for B2B verticals
  if (!isB2C && fractional.length > 0) {
    competitiveContext += `

FRACTIONAL/CONSULTANT ALTERNATIVES (${fractional.length} total):
${fractional.slice(0, 2).map(c => c.name).join(', ')}`;
  }

  // Build recommendation focus areas based on vertical
  let focusAreas: string;
  if (isB2C) {
    focusAreas = `Generate recommendations addressing:
1. How to WIN against ${direct[0]?.name || 'direct ' + verticalModel.threatTerminology.competitors} for ${verticalModel.threatTerminology.customer} attention
2. How to build local market dominance - store footprint, community presence, local reputation
3. How to compete with online/platform alternatives - emphasize local expertise, hands-on service, immediate availability
4. Omni-channel positioning - how to blend online discovery with in-store experience
5. Key DIFFERENTIATION moves to stand out in ${verticalModel.threatTerminology.market}`;
  } else {
    focusAreas = `Generate recommendations addressing:
1. How to WIN against ${direct[0]?.name || 'direct competitors'} and similar direct threats
2. How to differentiate from fractional/consultant alternatives
3. How to compete with platform/SaaS alternatives - emphasize what automation cannot do
4. How to counter the internal hire alternative - why agency > in-house
5. Key DIFFERENTIATION moves to stand out in this market`;
  }

  return `Generate 4-6 strategic recommendations for ${context.businessName} to compete effectively.

═══════════════════════════════════════════════════════════════
TARGET COMPANY: ${context.businessName}
═══════════════════════════════════════════════════════════════
- Business Model: ${context.businessModelCategory || 'Unknown'} (${context.businessModelCategory === 'B2C' ? 'consumer-facing' : context.businessModelCategory === 'B2B' ? 'business-facing' : 'general market'})
- Vertical: ${vertical}${context.subVertical ? ` (${context.subVertical})` : ''}
- Competitor Type Model: ${verticalModel.displayName}
- Industry: ${context.industry || 'General retail/services'}
- Value Proposition: ${context.valueProposition || 'Unknown'}
- Differentiators: ${safeJoin(context.differentiators) || 'Unknown'}
- Primary Offerings: ${safeJoin(context.primaryOffers) || 'Products and services'}
- Target Audience: ${context.icpDescription || audienceDescription}
- Number of Direct Competitors: ${direct.length}

═══════════════════════════════════════════════════════════════
VERTICAL-SPECIFIC LANGUAGE RULES
═══════════════════════════════════════════════════════════════
${verticalGuidance}

Use these terms:
- Customer: "${terminology.customer}" / "${terminology.customers}"
- Competitor: "${terminology.competitor}" / "${terminology.competitors}"
- Differentiation focus: ${terminology.differentiation.slice(0, 3).join(', ')}
${isB2C ? `
CRITICAL FOR ${vertical.toUpperCase()} VERTICAL:
- NEVER mention: "internal hire", "fractional CMO", "B2B", "clients", "accounts"
- Focus on: local market dynamics, ${verticalModel.threatTerminology.customer} experience, store positioning` : ''}

═══════════════════════════════════════════════════════════════
COMPETITIVE CONTEXT
═══════════════════════════════════════════════════════════════

${competitiveContext}

═══════════════════════════════════════════════════════════════
RECOMMENDATION FOCUS AREAS
═══════════════════════════════════════════════════════════════

${focusAreas}

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
  const vertical = context.verticalCategory || 'unknown';
  const verticalModel = getVerticalModel(vertical);
  const isB2C = isB2CVertical(vertical);

  const topDirect = competitors
    .filter(c => c.classification.type === 'direct')
    .sort((a, b) => b.scores.threatScore - a.scores.threatScore)[0];

  if (topDirect) {
    const description = isB2C
      ? `${topDirect.name} is the top ${verticalModel.threatTerminology.competitor}. Develop messaging that highlights what makes your store unique.`
      : `${topDirect.name} is the top direct threat. Develop messaging that highlights key differences.`;

    const actions = isB2C
      ? [
          `Analyze ${topDirect.name}'s local presence and offerings`,
          `Identify what ${verticalModel.threatTerminology.customers} value that they don't offer`,
          'Develop community-focused messaging',
        ]
      : [
          `Analyze ${topDirect.name}'s positioning`,
          'Identify gaps in their offering',
          'Develop counter-messaging',
        ];

    recommendations.push({
      id: 'fallback-rec-1',
      priority: 1,
      type: 'differentiation',
      title: `Counter ${topDirect.name}`,
      description,
      actions,
      targetCompetitors: [topDirect.name],
      expectedOutcome: isB2C
        ? `Win more ${verticalModel.threatTerminology.customers} in head-to-head decisions`
        : 'Clear differentiation in competitive deals',
    });
  }

  const hasPlatformThreats = competitors.some(c => c.classification.type === 'platform');
  if (hasPlatformThreats) {
    const platformRec = isB2C
      ? {
          title: 'Counter Online Alternatives',
          description: `Online retailers threaten ${verticalModel.threatTerminology.market}. Emphasize in-store experience, local expertise, and immediate availability.`,
          actions: [
            'Highlight same-day availability and hands-on experience',
            'Create "buy local" community messaging',
            `Build loyalty programs for repeat ${verticalModel.threatTerminology.customers}`,
          ],
          expectedOutcome: `Protected ${verticalModel.threatTerminology.market} share from online erosion`,
        }
      : {
          title: 'Address Platform Disruption',
          description: 'Platform alternatives threaten service delivery. Emphasize strategic value over automation.',
          actions: [
            'Document strategic value-add beyond tool capabilities',
            'Create "tools vs. strategy" positioning',
            'Build case studies showing strategic impact',
          ],
          expectedOutcome: 'Protected market share from platform erosion',
        };

    recommendations.push({
      id: 'fallback-rec-2',
      priority: 2,
      type: 'defense',
      ...platformRec,
      targetCompetitors: competitors.filter(c => c.classification.type === 'platform').map(c => c.name),
    });
  }

  return recommendations;
}

// ============================================================================
// Vertical Language Guidance
// ============================================================================

/**
 * Build vertical-specific language guidance for prompts
 */
function buildVerticalLanguageGuidance(
  vertical: VerticalCategory,
  terminology: VerticalTerminology,
  subVertical?: string | null
): string {
  const differentiationFocus = terminology.differentiation.slice(0, 3).join(', ');
  const threatFocus = terminology.threats.slice(0, 3).join(', ');

  switch (vertical) {
    case 'retail':
      return `This is a RETAIL company.
- Use language: ${terminology.customers}, ${terminology.market}, store experience
- Key differentiation factors: ${differentiationFocus}
- Primary threats: ${threatFocus}
- DO NOT use: "clients", "accounts", "B2B", "SaaS", "enterprise", "startup"
- Focus on: local market dynamics, shopper behavior, foot traffic, merchandising`;

    case 'automotive':
      return `This is an AUTOMOTIVE ${subVertical ? `(${subVertical})` : 'aftermarket'} company.
- Use language: ${terminology.customers}, vehicle owners, installers, car enthusiasts
- Key differentiation factors: ${differentiationFocus}
- Primary threats: ${threatFocus}
- DO NOT use: "clients", "accounts", "B2B", "SaaS", "enterprise", "fractional CMO"
- Focus on: installation expertise, product knowledge, local reputation, service quality
${subVertical ? `- Sub-vertical focus: ${subVertical} specific terminology and competitors` : ''}`;

    case 'services':
      return `This is a SERVICES/AGENCY company.
- Use language: ${terminology.customers}, ${terminology.market}, engagements
- Key differentiation factors: ${differentiationFocus}
- Primary threats: ${threatFocus}
- May use: client acquisition, enterprise sales, B2B terminology
- Focus on: expertise, methodology, team, track record, industry specialization`;

    case 'software':
      return `This is a SOFTWARE/SAAS company.
- Use language: ${terminology.customers}, ${terminology.market}, platform
- Key differentiation factors: ${differentiationFocus}
- Primary threats: ${threatFocus}
- May use: users, subscriptions, integrations, enterprise, self-serve
- Focus on: features, pricing, integrations, ease of use, support`;

    case 'consumer-dtc':
      return `This is a CONSUMER DTC (Direct-to-Consumer) brand.
- Use language: ${terminology.customers}, community, brand advocates
- Key differentiation factors: ${differentiationFocus}
- Primary threats: ${threatFocus}
- DO NOT use: "clients", "accounts", "B2B", "enterprise"
- Focus on: brand story, community, customer experience, retention, acquisition channels`;

    case 'manufacturing':
      return `This is a MANUFACTURING/INDUSTRIAL company.
- Use language: ${terminology.customers}, ${terminology.market}, supply chain
- Key differentiation factors: ${differentiationFocus}
- Primary threats: ${threatFocus}
- Focus on: quality, lead times, certifications, pricing, reliability`;

    default:
      return `Use language appropriate to the ${terminology.market}.
- Customer terms: ${terminology.customer}/${terminology.customers}
- Product terms: ${terminology.product}/${terminology.products}
- Be specific to the provided industry and target audience.`;
  }
}
