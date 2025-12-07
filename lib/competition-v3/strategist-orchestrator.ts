// lib/competition-v3/strategist-orchestrator.ts
// Competition Lab V4 - Strategist Model Orchestrator
//
// Transforms V3 run data + company context into a structured strategist model
// using AI to generate strategic intelligence.

import { aiSimple } from '@/lib/ai-gateway';
import type { CompetitionRunV3Response, CompetitionCompetitor } from './ui-types';
import type {
  CompetitionStrategistModel,
  StrategistCompetitorSummary,
} from './strategist-types';

// ============================================================================
// Types
// ============================================================================

interface CompanyContext {
  name: string;
  description?: string;
  valueProposition?: string;
  targetAudience?: string;
  industry?: string;
  stage?: string;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Build a strategist model from competition run data and company context.
 * Uses AI to generate structured strategic intelligence.
 */
export async function buildCompetitionStrategistModel(
  run: CompetitionRunV3Response,
  companyContext: CompanyContext
): Promise<CompetitionStrategistModel> {
  console.log(`[strategist-orchestrator] Building strategist model for run ${run.runId}`);

  // 1. Build compact payload for AI
  const prompt = buildStrategistPrompt(run, companyContext);

  // 2. Call OpenAI
  const response = await aiSimple({
    systemPrompt: STRATEGIST_SYSTEM_PROMPT,
    taskPrompt: prompt,
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 4000,
    jsonMode: true,
  });

  // 3. Parse and validate
  const parsed = parseStrategistResponse(response, run, companyContext);

  console.log(`[strategist-orchestrator] Generated strategist model with ${parsed.primaryCompetitors.length} primary competitors`);

  return parsed;
}

// ============================================================================
// System Prompt
// ============================================================================

const STRATEGIST_SYSTEM_PROMPT = `You are a senior marketing strategist analyzing a competitive landscape for a B2B company.

Your job is to transform raw competitive data into actionable strategic intelligence that a CMO or VP Marketing would use in planning sessions and board presentations.

OUTPUT FORMAT:
Respond ONLY with valid JSON matching this exact schema:

{
  "headline": "string - One punchy line about the competitive situation (slide title style)",
  "elevator": "string - 2-3 sentences summarizing the landscape for an executive",
  "positioningSummary": "string - 3-5 sentences about where the company sits vs market archetypes",
  "primaryCompetitors": [
    {
      "id": "string",
      "name": "string",
      "url": "string or null",
      "type": "string - human-readable category e.g. 'Full-service agency', 'Fractional CMO collective'",
      "threat": "number 0-100",
      "whyThreat": "string - 1-3 sentences with specific reasons",
      "keyAngles": ["string", "string", "string"]
    }
  ],
  "altOptionsByType": {
    "fractional": [{ same shape as primaryCompetitors }],
    "platform": [{ same shape }],
    "internal": [{ same shape }]
  },
  "recommendedPlays": {
    "now": ["string - action item"],
    "next": ["string - action item"],
    "later": ["string - action item"]
  },
  "keyRisks": ["string - risk statement"],
  "keyTalkingPoints": ["string - how to explain edge in sales"],
  "watchListNotes": "string or null - 1-2 paragraphs on emerging patterns"
}

STRATEGIC FRAMING:
- Frame competitors by what the BUYER is choosing between:
  - "Hire [Company]" vs "Hire a fractional CMO" vs "Hire a performance agency" vs "DIY on a platform" vs "Build internal team"
- Direct + Partial competitors = real threats (include in primaryCompetitors)
- Fractional = alternative hire path
- Platform = tool alternatives / complements
- Internal = the build-vs-buy decision

LANGUAGE GUIDELINES:
- Use specific competitor names in analysis
- Make headline punchy and memorable (slide title quality)
- Keep bullets short and action-oriented
- Be honest about real threats - don't sugarcoat
- Focus on what's differentiated and defensible`;

// ============================================================================
// Prompt Builder
// ============================================================================

function buildStrategistPrompt(
  run: CompetitionRunV3Response,
  ctx: CompanyContext
): string {
  // Prepare competitor summaries by type
  const direct = run.competitors.filter(c => c.type === 'direct');
  const partial = run.competitors.filter(c => c.type === 'partial');
  const fractional = run.competitors.filter(c => c.type === 'fractional');
  const platform = run.competitors.filter(c => c.type === 'platform');
  const internal = run.competitors.filter(c => c.type === 'internal');

  // Format competitors for prompt
  const formatCompetitor = (c: CompetitionCompetitor) => ({
    name: c.name,
    url: c.url || c.domain,
    type: c.type,
    threat: c.scores.threat,
    relevance: c.scores.relevance,
    icpFit: c.coordinates.icpFit,
    valueModelFit: c.coordinates.valueModelFit,
    summary: c.summary,
    strengths: c.analysis?.strengths || [],
    weaknesses: c.analysis?.weaknesses || [],
  });

  return `Analyze this competitive landscape and generate a strategist briefing.

COMPANY: ${ctx.name}
${ctx.description ? `Description: ${ctx.description}` : ''}
${ctx.valueProposition ? `Value Prop: ${ctx.valueProposition}` : ''}
${ctx.targetAudience ? `Target Audience: ${ctx.targetAudience}` : ''}
${ctx.industry ? `Industry: ${ctx.industry}` : ''}
${ctx.stage ? `Stage: ${ctx.stage}` : ''}

LANDSCAPE SUMMARY:
- Total competitors analyzed: ${run.summary.totalCompetitors}
- Average threat score: ${run.summary.avgThreatScore}/100
- Direct threats: ${run.summary.byType.direct}
- Partial overlap: ${run.summary.byType.partial}
- Fractional alternatives: ${run.summary.byType.fractional}
- Platform alternatives: ${run.summary.byType.platform}
- Internal hire alternatives: ${run.summary.byType.internal}

EXISTING INSIGHTS:
${run.insights.landscapeSummary}

DIRECT COMPETITORS (highest threat):
${JSON.stringify(direct.slice(0, 8).map(formatCompetitor), null, 2)}

PARTIAL OVERLAP COMPETITORS:
${JSON.stringify(partial.slice(0, 5).map(formatCompetitor), null, 2)}

FRACTIONAL ALTERNATIVES:
${JSON.stringify(fractional.slice(0, 4).map(formatCompetitor), null, 2)}

PLATFORM ALTERNATIVES:
${JSON.stringify(platform.slice(0, 4).map(formatCompetitor), null, 2)}

INTERNAL HIRE ALTERNATIVES:
${JSON.stringify(internal.slice(0, 3).map(formatCompetitor), null, 2)}

EXISTING RECOMMENDATIONS:
Now: ${run.insights.recommendedMoves.now.join('; ')}
Next: ${run.insights.recommendedMoves.next.join('; ')}
Later: ${run.insights.recommendedMoves.later.join('; ')}

KEY RISKS FROM ANALYSIS:
${run.insights.keyRisks.join('\n')}

KEY OPPORTUNITIES:
${run.insights.keyOpportunities.join('\n')}

Generate a structured strategist model. Include 3-5 primary competitors (from direct + partial), and populate altOptionsByType with 1-3 entries each. Make the headline memorable, the plays actionable, and the talking points usable in sales calls.`;
}

// ============================================================================
// Response Parser
// ============================================================================

function parseStrategistResponse(
  response: string,
  run: CompetitionRunV3Response,
  ctx: CompanyContext
): CompetitionStrategistModel {
  try {
    // Try to extract JSON from response
    let jsonStr = response;

    // Handle markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Validate required fields exist
    if (!parsed.headline || !parsed.elevator || !parsed.primaryCompetitors) {
      throw new Error('Missing required fields in AI response');
    }

    // Normalize and validate competitor summaries
    const normalizeSummary = (c: any): StrategistCompetitorSummary => ({
      id: c.id || `comp-${Math.random().toString(36).slice(2, 8)}`,
      name: c.name || 'Unknown',
      url: c.url || undefined,
      type: c.type || 'Unknown',
      threat: typeof c.threat === 'number' ? c.threat : 50,
      whyThreat: c.whyThreat || '',
      keyAngles: Array.isArray(c.keyAngles) ? c.keyAngles.slice(0, 3) : [],
    });

    return {
      runId: run.runId,
      companyId: run.companyId,
      createdAt: new Date().toISOString(),
      headline: parsed.headline,
      elevator: parsed.elevator,
      positioningSummary: parsed.positioningSummary || '',
      primaryCompetitors: (parsed.primaryCompetitors || []).map(normalizeSummary),
      altOptionsByType: {
        fractional: (parsed.altOptionsByType?.fractional || []).map(normalizeSummary),
        platform: (parsed.altOptionsByType?.platform || []).map(normalizeSummary),
        internal: (parsed.altOptionsByType?.internal || []).map(normalizeSummary),
      },
      recommendedPlays: {
        now: parsed.recommendedPlays?.now || [],
        next: parsed.recommendedPlays?.next || [],
        later: parsed.recommendedPlays?.later || [],
      },
      keyRisks: parsed.keyRisks || [],
      keyTalkingPoints: parsed.keyTalkingPoints || [],
      watchListNotes: parsed.watchListNotes || undefined,
    };
  } catch (error) {
    console.error('[strategist-orchestrator] Failed to parse AI response:', error);
    console.error('[strategist-orchestrator] Raw response:', response.slice(0, 500));

    // Return a fallback model
    return buildFallbackModel(run, ctx);
  }
}

// ============================================================================
// Fallback Model
// ============================================================================

function buildFallbackModel(
  run: CompetitionRunV3Response,
  ctx: CompanyContext
): CompetitionStrategistModel {
  // Build basic model from existing data
  const directCompetitors = run.competitors
    .filter(c => c.type === 'direct' || c.type === 'partial')
    .sort((a, b) => b.scores.threat - a.scores.threat)
    .slice(0, 5)
    .map((c): StrategistCompetitorSummary => ({
      id: c.id,
      name: c.name,
      url: c.url,
      type: c.type === 'direct' ? 'Direct Competitor' : 'Partial Overlap',
      threat: c.scores.threat,
      whyThreat: c.summary || 'Competes for similar customers.',
      keyAngles: c.analysis?.strengths?.slice(0, 3) || [],
    }));

  const mapToSummary = (c: CompetitionCompetitor): StrategistCompetitorSummary => ({
    id: c.id,
    name: c.name,
    url: c.url,
    type: c.type,
    threat: c.scores.threat,
    whyThreat: c.summary || '',
    keyAngles: c.analysis?.strengths?.slice(0, 3) || [],
  });

  return {
    runId: run.runId,
    companyId: run.companyId,
    createdAt: new Date().toISOString(),
    headline: `${run.summary.totalCompetitors} competitors mapped, ${run.summary.byType.direct} direct threats`,
    elevator: run.insights.landscapeSummary || 'Competitive analysis complete.',
    positioningSummary: run.insights.categoryBreakdown || '',
    primaryCompetitors: directCompetitors,
    altOptionsByType: {
      fractional: run.competitors
        .filter(c => c.type === 'fractional')
        .slice(0, 3)
        .map(mapToSummary),
      platform: run.competitors
        .filter(c => c.type === 'platform')
        .slice(0, 3)
        .map(mapToSummary),
      internal: run.competitors
        .filter(c => c.type === 'internal')
        .slice(0, 3)
        .map(mapToSummary),
    },
    recommendedPlays: run.insights.recommendedMoves,
    keyRisks: run.insights.keyRisks.slice(0, 5),
    keyTalkingPoints: run.insights.keyOpportunities.slice(0, 5),
  };
}
