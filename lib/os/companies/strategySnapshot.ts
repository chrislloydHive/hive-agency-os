// lib/os/companies/strategySnapshot.ts
// Strategic Snapshot Generator
//
// Computes and persists a per-company strategic snapshot that distills:
// - Latest scores from key tools
// - Repeated themes from Brain entries
// - Concrete 3-5 focus areas
// - A 90-day narrative

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import {
  getCompanyStrategySnapshot,
  upsertCompanyStrategySnapshot,
  type CompanyStrategicSnapshot,
} from '@/lib/airtable/companyStrategySnapshot';
import { getCompanyInsights } from '@/lib/airtable/clientBrain';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  listDiagnosticRunsForCompany,
  getLatestRunForCompanyAndTool,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { getToolByDiagnosticId, COMPANY_TOOL_DEFS } from '@/lib/tools/registry';

// Re-export types
export type { CompanyStrategicSnapshot };

// ============================================================================
// Types
// ============================================================================

interface DiagnosticScores {
  gapIa: number | null;
  gapPlan: number | null;
  gapHeavy: number | null;
  websiteLab: number | null;
  brandLab: number | null;
  contentLab: number | null;
  seoLab: number | null;
  demandLab: number | null;
  opsLab: number | null;
  creativeLab: number | null;
}

interface BrainAggregation {
  strengths: string[];
  gaps: string[];
  themes: string[];
  recentInsightCount: number;
}

interface SnapshotAIOutput {
  focusAreas: string[];
  narrative90DayPlan: string;
  maturityStage?: string;
  keyStrengths?: string[];
  keyGaps?: string[];
}

// ============================================================================
// Score Aggregation
// ============================================================================

/**
 * Get the latest scores from all diagnostic tools
 */
async function getLatestDiagnosticScores(
  companyId: string
): Promise<{ scores: DiagnosticScores; latestRunId: string | null; sourceToolIds: string[] }> {
  console.log('[StrategySnapshot] Fetching diagnostic scores for:', companyId);

  const scores: DiagnosticScores = {
    gapIa: null,
    gapPlan: null,
    gapHeavy: null,
    websiteLab: null,
    brandLab: null,
    contentLab: null,
    seoLab: null,
    demandLab: null,
    opsLab: null,
    creativeLab: null,
  };

  const toolIdMap: Record<DiagnosticToolId, keyof DiagnosticScores> = {
    gapSnapshot: 'gapIa',
    gapPlan: 'gapPlan',
    gapHeavy: 'gapHeavy',
    websiteLab: 'websiteLab',
    brandLab: 'brandLab',
    contentLab: 'contentLab',
    seoLab: 'seoLab',
    demandLab: 'demandLab',
    opsLab: 'opsLab',
    creativeLab: 'creativeLab',
  };

  let latestRunId: string | null = null;
  let latestRunDate: Date | null = null;
  const sourceToolIds: string[] = [];

  // Get all runs and extract scores
  const allRuns = await listDiagnosticRunsForCompany(companyId, { limit: 50 });

  for (const run of allRuns) {
    const scoreKey = toolIdMap[run.toolId];
    if (scoreKey && run.status === 'complete' && run.score !== null) {
      // Only use the most recent score for each tool
      if (scores[scoreKey] === null) {
        scores[scoreKey] = run.score;
        sourceToolIds.push(run.toolId);
      }

      // Track the most recent run overall
      const runDate = new Date(run.createdAt);
      if (!latestRunDate || runDate > latestRunDate) {
        latestRunDate = runDate;
        latestRunId = run.id;
      }
    }
  }

  console.log('[StrategySnapshot] Scores:', scores);
  return { scores, latestRunId, sourceToolIds };
}

/**
 * Calculate the overall score from available diagnostic scores
 */
function calculateOverallScore(scores: DiagnosticScores): number | null {
  // Priority: GAP Plan > GAP Heavy > GAP IA > weighted average
  if (scores.gapPlan !== null) return scores.gapPlan;
  if (scores.gapHeavy !== null) return scores.gapHeavy;
  if (scores.gapIa !== null) return scores.gapIa;

  // Calculate weighted average from available scores
  const availableScores: { score: number; weight: number }[] = [];

  if (scores.websiteLab !== null) availableScores.push({ score: scores.websiteLab, weight: 1.5 });
  if (scores.brandLab !== null) availableScores.push({ score: scores.brandLab, weight: 1.2 });
  if (scores.contentLab !== null) availableScores.push({ score: scores.contentLab, weight: 1.0 });
  if (scores.seoLab !== null) availableScores.push({ score: scores.seoLab, weight: 1.0 });
  if (scores.demandLab !== null) availableScores.push({ score: scores.demandLab, weight: 1.0 });
  if (scores.opsLab !== null) availableScores.push({ score: scores.opsLab, weight: 0.8 });

  if (availableScores.length === 0) return null;

  const totalWeight = availableScores.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = availableScores.reduce((sum, s) => sum + s.score * s.weight, 0);

  return Math.round(weightedSum / totalWeight);
}

// ============================================================================
// Brain Aggregation
// ============================================================================

/**
 * Aggregate insights from Brain entries
 */
async function aggregateBrainInsights(companyId: string): Promise<BrainAggregation> {
  console.log('[StrategySnapshot] Aggregating Brain insights for:', companyId);

  const insights = await getCompanyInsights(companyId, { limit: 50 });

  const strengths: string[] = [];
  const gaps: string[] = [];
  const themes: string[] = [];

  // Filter to recent diagnostic summaries
  const recentInsights = insights.filter((i) => {
    const isToolRun = i.source.type === 'tool_run';
    const isRecent = new Date(i.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    return isToolRun && isRecent;
  });

  // Extract strengths and gaps from insight bodies
  for (const insight of recentInsights) {
    const body = insight.body;

    // Parse structured insights (our format)
    const strengthMatch = body.match(/\*\*Key Strengths:\*\*\n([\s\S]*?)(?=\n\n|\*\*|$)/);
    if (strengthMatch) {
      const items = strengthMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());
      strengths.push(...items);
    }

    const gapMatch = body.match(/\*\*Key Gaps:\*\*\n([\s\S]*?)(?=\n\n|\*\*|$)/);
    if (gapMatch) {
      const items = gapMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());
      gaps.push(...items);
    }

    const focusMatch = body.match(/\*\*Recommended Focus Areas:\*\*\n([\s\S]*?)(?=\n\n|\*\*|$)/);
    if (focusMatch) {
      const items = focusMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());
      themes.push(...items);
    }

    // Also add category as a theme
    if (insight.category !== 'other') {
      themes.push(insight.category);
    }
  }

  // Deduplicate and limit
  const uniqueStrengths = [...new Set(strengths)].slice(0, 10);
  const uniqueGaps = [...new Set(gaps)].slice(0, 10);
  const uniqueThemes = [...new Set(themes)].slice(0, 10);

  console.log('[StrategySnapshot] Brain aggregation:', {
    strengths: uniqueStrengths.length,
    gaps: uniqueGaps.length,
    themes: uniqueThemes.length,
    recentCount: recentInsights.length,
  });

  return {
    strengths: uniqueStrengths,
    gaps: uniqueGaps,
    themes: uniqueThemes,
    recentInsightCount: recentInsights.length,
  };
}

// ============================================================================
// AI Synthesis
// ============================================================================

/**
 * Use AI to synthesize snapshot from scores and Brain insights
 */
async function synthesizeWithAI(
  companyId: string,
  companyName: string,
  scores: DiagnosticScores,
  overallScore: number | null,
  brainData: BrainAggregation
): Promise<SnapshotAIOutput> {
  console.log('[StrategySnapshot] Synthesizing with AI...');

  const systemPrompt = `You are a strategic marketing advisor synthesizing diagnostic results into an actionable strategic snapshot.

Output ONLY valid JSON matching this exact structure:
{
  "focusAreas": ["focus area 1", "focus area 2", "focus area 3", "focus area 4", "focus area 5"],
  "narrative90DayPlan": "A 2-3 paragraph strategic narrative explaining what the company should focus on over the next 90 days",
  "maturityStage": "One of: Basic, Developing, Good, Advanced, or World-Class",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "keyGaps": ["gap 1", "gap 2", "gap 3"]
}

Maturity Stage Guidelines (based on overall score):
- Basic: 0-39 - Foundational gaps, needs significant work
- Developing: 40-54 - Building capabilities, early stage
- Good: 55-69 - Solid foundation, room to grow
- Advanced: 70-84 - Strong performance, optimization phase
- World-Class: 85-100 - Industry leading, fine-tuning

Guidelines:
- Focus areas should be specific, actionable, and prioritized
- The 90-day narrative should be strategic and consultant-grade
- Keep lists to 3-5 items each`;

  const scoresFormatted = Object.entries(scores)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `- ${k}: ${v}/100`)
    .join('\n');

  const taskPrompt = `Create a strategic snapshot for ${companyName}.

**Overall Score:** ${overallScore ?? 'Not available'}/100

**Individual Diagnostic Scores:**
${scoresFormatted || 'No scores available'}

**From Brain - Identified Strengths:**
${brainData.strengths.length > 0 ? brainData.strengths.map(s => `- ${s}`).join('\n') : 'None identified'}

**From Brain - Identified Gaps:**
${brainData.gaps.length > 0 ? brainData.gaps.map(g => `- ${g}`).join('\n') : 'None identified'}

**Recurring Themes:**
${brainData.themes.length > 0 ? brainData.themes.join(', ') : 'None'}

Based on this data, synthesize:
1. The top 3-5 focus areas they should prioritize
2. A strategic 90-day plan narrative
3. An overall maturity stage assessment
4. Consolidated key strengths and gaps`;

  try {
    const result = await aiForCompany(companyId, {
      type: 'Strategy',
      tags: ['Strategy', 'Snapshot', 'Planning'],
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.4,
      jsonMode: true,
      maxTokens: 2000,
    });

    return JSON.parse(result.content);
  } catch (error) {
    console.error('[StrategySnapshot] AI synthesis failed:', error);

    // Return fallback based on raw data
    return {
      focusAreas: brainData.themes.slice(0, 5),
      narrative90DayPlan: overallScore !== null
        ? `Based on the diagnostic assessment score of ${overallScore}/100, ${companyName} should focus on addressing the identified gaps while building on existing strengths.`
        : `${companyName} should run diagnostic tools to establish a baseline and identify priority areas.`,
      maturityStage: overallScore !== null
        ? overallScore >= 85 ? 'World-Class' : overallScore >= 70 ? 'Advanced' : overallScore >= 55 ? 'Good' : overallScore >= 40 ? 'Developing' : 'Basic'
        : undefined,
      keyStrengths: brainData.strengths.slice(0, 3),
      keyGaps: brainData.gaps.slice(0, 3),
    };
  }
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Compute a strategic snapshot for a company
 *
 * This pulls from:
 * - Latest diagnostic run scores
 * - Brain entries (diagnostic summaries)
 * - AI synthesis for focus areas and narrative
 */
export async function computeCompanyStrategicSnapshot(
  companyId: string
): Promise<CompanyStrategicSnapshot> {
  console.log('[StrategySnapshot] Computing snapshot for:', companyId);

  // Get company info
  const company = await getCompanyById(companyId);
  const companyName = company?.name || 'Unknown Company';

  // Get diagnostic scores
  const { scores, latestRunId, sourceToolIds } = await getLatestDiagnosticScores(companyId);
  const overallScore = calculateOverallScore(scores);

  // Aggregate Brain insights
  const brainData = await aggregateBrainInsights(companyId);

  // Synthesize with AI
  const aiOutput = await synthesizeWithAI(
    companyId,
    companyName,
    scores,
    overallScore,
    brainData
  );

  // Build the snapshot
  const snapshot: CompanyStrategicSnapshot = {
    companyId,
    overallScore,
    maturityStage: aiOutput.maturityStage,
    updatedAt: new Date().toISOString(),
    keyStrengths: aiOutput.keyStrengths || brainData.strengths.slice(0, 5),
    keyGaps: aiOutput.keyGaps || brainData.gaps.slice(0, 5),
    focusAreas: aiOutput.focusAreas,
    narrative90DayPlan: aiOutput.narrative90DayPlan,
    sourceToolIds,
    lastDiagnosticRunId: latestRunId || undefined,
  };

  console.log('[StrategySnapshot] Computed snapshot:', {
    overallScore: snapshot.overallScore,
    maturityStage: snapshot.maturityStage,
    focusAreasCount: snapshot.focusAreas.length,
  });

  return snapshot;
}

/**
 * Compute and persist a strategic snapshot for a company
 *
 * Call this after diagnostic runs complete to update the snapshot.
 */
export async function refreshCompanyStrategicSnapshot(
  companyId: string
): Promise<CompanyStrategicSnapshot> {
  console.log('[StrategySnapshot] Refreshing snapshot for:', companyId);

  const snapshot = await computeCompanyStrategicSnapshot(companyId);
  return await upsertCompanyStrategySnapshot(snapshot);
}

// Re-export the getter
export { getCompanyStrategySnapshot };
