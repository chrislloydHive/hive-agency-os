// lib/blueprint/recommendations.ts
// Blueprint Tool Recommendation Engine
//
// This module generates intelligent tool recommendations based on:
// - Current diagnostic run history
// - Analytics trends (traffic, conversions, SEO)
// - Blueprint focus areas
// - Score analysis

import {
  COMPANY_TOOL_DEFS,
  getToolById,
  type CompanyToolId,
  type CompanyToolDefinition,
  type BlueprintToolMeta,
} from '@/lib/tools/registry';
import {
  getRecentRunsForCompany,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import type { BlueprintPipelineData } from './pipeline';
import type { StrategySynthesis } from './synthesizer';

// ============================================================================
// Types
// ============================================================================

export interface RecommendedTool {
  toolId: CompanyToolId;
  tool: CompanyToolDefinition;
  scoreImpact: 'high' | 'medium' | 'low';
  urgency: 'now' | 'next' | 'later';
  reason: string;
  blueprintMeta: BlueprintToolMeta;
  hasRecentRun: boolean;
  lastRunAt?: string;
  lastScore?: number | null;
  /** Days since last run, null if never run */
  daysSinceRun: number | null;
}

export interface ToolRecommendationContext {
  companyId: string;
  pipelineData?: BlueprintPipelineData | null;
  strategySynthesis?: StrategySynthesis | null;
  hasWebsite: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STALE_THRESHOLD_DAYS = 60;
const RECENT_THRESHOLD_DAYS = 14;

// ============================================================================
// Helper Functions
// ============================================================================

function calculateDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function getLatestRunForTool(
  runs: DiagnosticRun[],
  diagnosticToolId: DiagnosticToolId
): DiagnosticRun | null {
  const toolRuns = runs
    .filter(r => r.toolId === diagnosticToolId && r.status === 'complete')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return toolRuns[0] || null;
}

function mapDiagnosticToCompanyToolId(diagnosticToolId: DiagnosticToolId): CompanyToolId | null {
  const mapping: Record<DiagnosticToolId, CompanyToolId> = {
    gapSnapshot: 'gapIa',
    gapPlan: 'gapPlan',
    gapHeavy: 'gapHeavy',
    websiteLab: 'websiteLab',
    brandLab: 'brandLab',
    contentLab: 'contentLab',
    seoLab: 'seoLab',
    demandLab: 'demandLab',
    opsLab: 'opsLab',
  };
  return mapping[diagnosticToolId] || null;
}

// ============================================================================
// Main Recommendation Function
// ============================================================================

/**
 * Generate intelligent tool recommendations for Blueprint
 */
export async function getRecommendedToolsForBlueprint(
  context: ToolRecommendationContext
): Promise<RecommendedTool[]> {
  const { companyId, pipelineData, strategySynthesis, hasWebsite } = context;

  console.log('[BlueprintRecommendations] Generating for company:', companyId);

  // Fetch recent diagnostic runs
  const runs = await getRecentRunsForCompany(companyId, 50).catch(() => []);

  // Build recommendations based on heuristics
  const recommendations: RecommendedTool[] = [];

  // Get enabled tools only (status === 'enabled')
  const enabledTools = COMPANY_TOOL_DEFS.filter(t => t.status === 'enabled' && t.behavior === 'diagnosticRun');

  for (const tool of enabledTools) {
    // Skip if requires website and none available
    if (tool.requiresWebsite && !hasWebsite) continue;
    if (!tool.blueprintMeta || !tool.diagnosticToolId) continue;

    const latestRun = getLatestRunForTool(runs, tool.diagnosticToolId);
    const daysSinceRun = latestRun ? calculateDaysSince(latestRun.createdAt) : null;
    const hasRecentRun = daysSinceRun !== null && daysSinceRun <= RECENT_THRESHOLD_DAYS;
    const isStale = daysSinceRun !== null && daysSinceRun > STALE_THRESHOLD_DAYS;
    const neverRun = daysSinceRun === null;

    let scoreImpact: 'high' | 'medium' | 'low' = 'medium';
    let urgency: 'now' | 'next' | 'later' = 'later';
    let reason = '';

    // Build recommendation based on tool and context
    switch (tool.id) {
      case 'gapIa':
        if (neverRun) {
          scoreImpact = 'high';
          urgency = 'now';
          reason = 'No baseline assessment exists. Run GAP IA to establish marketing health baseline.';
        } else if (isStale) {
          scoreImpact = 'medium';
          urgency = 'next';
          reason = `Last assessment was ${daysSinceRun} days ago. Re-run to check for changes.`;
        } else {
          continue; // Don't recommend if recent
        }
        break;

      case 'gapPlan':
        if (neverRun) {
          // Check if GAP IA has been run
          const hasGapIa = runs.some(r => r.toolId === 'gapSnapshot' && r.status === 'complete');
          if (hasGapIa) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'GAP IA complete but no full plan exists. Generate a comprehensive growth plan.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = 'Run GAP IA first, then generate a Full GAP plan for strategic direction.';
          }
        } else if (isStale) {
          scoreImpact = 'high';
          urgency = 'now';
          reason = `Growth plan is ${daysSinceRun} days old. Refresh to align with current priorities.`;
        } else if (daysSinceRun && daysSinceRun > 30) {
          scoreImpact = 'medium';
          urgency = 'next';
          reason = `Growth plan is ${daysSinceRun} days old. Consider refreshing for quarterly planning.`;
        } else {
          continue;
        }
        break;

      case 'gapHeavy':
        if (neverRun) {
          scoreImpact = 'medium';
          urgency = 'next';
          reason = 'No deep analysis exists. Run GAP Heavy for competitive intelligence and multi-source insights.';
        } else if (isStale) {
          scoreImpact = 'medium';
          urgency = 'later';
          reason = `Deep analysis is ${daysSinceRun} days old. Consider refreshing for strategic planning.`;
        } else {
          continue;
        }
        break;

      case 'websiteLab':
        if (neverRun) {
          scoreImpact = 'high';
          urgency = 'now';
          reason = 'No website diagnostic exists. Evaluate UX and conversion paths.';
        } else if (isStale) {
          // Check analytics context
          const conversionDown = pipelineData?.analytics?.conversionTrend === 'down';
          if (conversionDown) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'Conversions are declining and website analysis is stale. Re-run to identify UX issues.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = `Website analysis is ${daysSinceRun} days old. Re-run to catch UX drift.`;
          }
        } else if (pipelineData?.analytics?.conversionTrend === 'down') {
          scoreImpact = 'high';
          urgency = 'now';
          reason = 'Conversions are declining. Re-run Website Lab to identify conversion blockers.';
        } else {
          continue;
        }
        break;

      default:
        // For other tools, basic staleness logic
        if (neverRun) {
          scoreImpact = 'low';
          urgency = 'later';
          reason = `No ${tool.label} analysis exists. Run to expand strategic coverage.`;
        } else if (isStale) {
          scoreImpact = 'low';
          urgency = 'later';
          reason = `${tool.label} is ${daysSinceRun} days old. Consider refreshing.`;
        } else {
          continue;
        }
    }

    // Check if tool aligns with current focus areas
    if (strategySynthesis?.topFocusAreas?.length) {
      const focusAreaTitles = strategySynthesis.topFocusAreas.map(a => a.title.toLowerCase());
      const toolCategory = tool.category.toLowerCase();

      if (focusAreaTitles.some(f =>
        f.includes('website') && toolCategory.includes('website') ||
        f.includes('brand') && toolCategory.includes('brand') ||
        f.includes('seo') && toolCategory.includes('seo') ||
        f.includes('content') && toolCategory.includes('content') ||
        f.includes('conversion') && toolCategory.includes('website')
      )) {
        // Boost urgency if tool aligns with focus areas
        if (urgency === 'later') urgency = 'next';
        if (urgency === 'next' && scoreImpact !== 'high') urgency = 'now';
        reason += ' Aligns with current strategic focus.';
      }
    }

    recommendations.push({
      toolId: tool.id,
      tool,
      scoreImpact,
      urgency,
      reason: reason.trim(),
      blueprintMeta: tool.blueprintMeta,
      hasRecentRun,
      lastRunAt: latestRun?.createdAt,
      lastScore: latestRun?.score ?? null,
      daysSinceRun,
    });
  }

  // Sort by urgency and impact
  const urgencyOrder = { now: 0, next: 1, later: 2 };
  const impactOrder = { high: 0, medium: 1, low: 2 };

  recommendations.sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return impactOrder[a.scoreImpact] - impactOrder[b.scoreImpact];
  });

  // Return top 5 recommendations
  const topRecommendations = recommendations.slice(0, 5);

  console.log('[BlueprintRecommendations] Generated:', topRecommendations.length, 'recommendations');

  return topRecommendations;
}

// ============================================================================
// Work Item Creation from Recommended Tool
// ============================================================================

export interface CreateWorkFromToolParams {
  companyId: string;
  tool: RecommendedTool;
}

/**
 * Create a work item from a recommended tool
 */
export async function createWorkFromRecommendedTool(
  params: CreateWorkFromToolParams
): Promise<{ success: boolean; workItemId?: string; error?: string }> {
  const { companyId, tool } = params;

  const title = `Run ${tool.tool.label}`;
  const description = [
    tool.reason,
    '',
    `**Why this matters:** ${tool.blueprintMeta.whyRun}`,
    '',
    `**This helps answer:** ${tool.blueprintMeta.answersQuestion}`,
    '',
    `**Best time to run:** ${tool.blueprintMeta.typicalUseWhen}`,
  ].join('\n');

  // Map tool category to work area
  const areaMapping: Record<string, string> = {
    'Strategic Assessment': 'Strategy',
    'Website & UX': 'Website UX',
    'Brand & Positioning': 'Brand',
    'Content & Messaging': 'Content',
    'SEO & Search': 'SEO',
    'Demand Generation': 'Funnel',
    'Marketing Ops': 'Other',
    'Analytics': 'Funnel',
  };

  // Map impact to priority
  const priorityMapping: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  try {
    const response = await fetch('/api/os/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes: description,
        companyId,
        area: areaMapping[tool.tool.category] || 'Other',
        severity: priorityMapping[tool.scoreImpact] || 'Medium',
        status: 'Planned',
        source: {
          sourceType: 'blueprint_tool_recommendation',
          toolId: tool.toolId,
          toolLabel: tool.tool.label,
          urgency: tool.urgency,
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to create work item' };
    }

    const data = await response.json();
    return { success: true, workItemId: data.id };
  } catch (error) {
    console.error('[BlueprintRecommendations] Failed to create work item:', error);
    return { success: false, error: 'Network error creating work item' };
  }
}
