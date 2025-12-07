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
  /** ID of the last run, for building view/report URLs */
  lastRunId?: string;
  /** Days since last run, null if never run */
  daysSinceRun: number | null;
  /** Status of the last run (complete, failed, running) */
  lastRunStatus?: 'complete' | 'failed' | 'running';
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
  // Get latest complete run for score/view purposes
  const toolRuns = runs
    .filter(r => r.toolId === diagnosticToolId && r.status === 'complete')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return toolRuns[0] || null;
}

function getLatestRunAnyStatus(
  runs: DiagnosticRun[],
  diagnosticToolId: DiagnosticToolId
): DiagnosticRun | null {
  // Get latest run regardless of status (for showing failed/running states)
  const toolRuns = runs
    .filter(r => r.toolId === diagnosticToolId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return toolRuns[0] || null;
}

function mapDiagnosticToCompanyToolId(diagnosticToolId: DiagnosticToolId): CompanyToolId | null {
  const mapping: Record<DiagnosticToolId, CompanyToolId> = {
    gapSnapshot: 'gapIa',
    gapIa: 'gapIa',
    gapPlan: 'gapPlan',
    gapHeavy: 'gapHeavy',
    websiteLab: 'websiteLab',
    brandLab: 'brandLab',
    audienceLab: 'audienceLab',
    mediaLab: 'mediaLab',
    contentLab: 'contentLab',
    seoLab: 'seoLab',
    demandLab: 'demandLab',
    opsLab: 'opsLab',
    creativeLab: 'creativeLab',
    competitorLab: 'competitorLab',
    competitionLab: 'competitorLab', // Competition Lab v2 maps to same tool
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
  // Include both diagnosticRun tools AND strategic openRoute tools (like Media Lab, Audience Lab, Creative Lab)
  const enabledTools = COMPANY_TOOL_DEFS.filter(t =>
    t.status === 'enabled' &&
    (t.behavior === 'diagnosticRun' || (t.behavior === 'openRoute' && t.section === 'strategic'))
  );

  for (const tool of enabledTools) {
    // Skip if requires website and none available
    if (tool.requiresWebsite && !hasWebsite) continue;
    if (!tool.blueprintMeta) continue;

    // For strategic tools without diagnosticToolId, they always appear as "never run"
    // since they don't track runs the same way
    const latestCompleteRun = tool.diagnosticToolId
      ? getLatestRunForTool(runs, tool.diagnosticToolId)
      : null;
    const latestRunAny = tool.diagnosticToolId
      ? getLatestRunAnyStatus(runs, tool.diagnosticToolId)
      : null;

    // Use complete run for daysSinceRun calculations
    const daysSinceRun = latestCompleteRun ? calculateDaysSince(latestCompleteRun.createdAt) : null;
    const hasRecentRun = daysSinceRun !== null && daysSinceRun <= RECENT_THRESHOLD_DAYS;
    const isStale = daysSinceRun !== null && daysSinceRun > STALE_THRESHOLD_DAYS;
    const neverRun = daysSinceRun === null;

    // Check for failed or running status from latest run (any status)
    const lastRunStatus = latestRunAny?.status as 'complete' | 'failed' | 'running' | undefined;
    const hasFailed = lastRunStatus === 'failed';

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

      case 'seoLab':
        if (neverRun) {
          // Check if we have any SEO-related data indicating issues
          const hasSeoFocusArea = strategySynthesis?.topFocusAreas?.some(
            a => a.title.toLowerCase().includes('seo') || a.title.toLowerCase().includes('search')
          );
          if (hasSeoFocusArea) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'SEO is a strategic focus area but no deep analysis exists. Run SEO Lab for comprehensive insights.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = 'No deep SEO analysis exists. Run SEO Lab for technical audit, issue tracking, and GSC analytics.';
          }
        } else if (isStale) {
          scoreImpact = 'medium';
          urgency = 'next';
          reason = `SEO Lab analysis is ${daysSinceRun} days old. Re-run to catch SEO drift and track issues.`;
        } else if (latestCompleteRun?.score !== undefined && latestCompleteRun.score !== null && latestCompleteRun.score < 60) {
          scoreImpact = 'high';
          urgency = 'now';
          reason = `Previous SEO score was ${latestCompleteRun.score}/100. Re-run to track improvement and prioritize fixes.`;
        } else {
          continue;
        }
        break;

      case 'creativeLab':
        // Creative Lab - for messaging, creative territories, and campaigns
        if (neverRun) {
          // Check if Brand Lab has been run (creative should come after brand)
          const hasBrandLab = runs.some(r => r.toolId === 'brandLab' && r.status === 'complete');
          if (hasBrandLab) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'Brand Lab complete. Generate creative strategy with messaging, territories, and campaign concepts.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = 'Run Brand Lab first, then Creative Lab for complete messaging architecture.';
          }
        } else if (isStale) {
          scoreImpact = 'medium';
          urgency = 'next';
          reason = `Creative strategy is ${daysSinceRun} days old. Refresh for new campaigns or messaging updates.`;
        } else {
          continue;
        }
        break;

      case 'mediaLab':
        // Media Lab - for media strategy and budget planning
        // Strategic tool without run tracking - check if audience work exists
        if (neverRun) {
          const hasGapIa = runs.some(r => r.toolId === 'gapSnapshot' && r.status === 'complete');
          if (hasGapIa) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'Design media strategy with channel mix and budget allocation.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = 'Run GAP IA first, then plan media strategy with channel recommendations.';
          }
        } else {
          continue;
        }
        break;

      case 'audienceLab':
        // Audience Lab - for audience segments and personas
        // Strategic tool without run tracking
        if (neverRun) {
          const hasGapIa = runs.some(r => r.toolId === 'gapSnapshot' && r.status === 'complete');
          if (hasGapIa) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'GAP IA complete. Define target audiences and personas for better targeting.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = 'Define audience segments and personas for targeting and messaging.';
          }
        } else {
          continue;
        }
        break;

      case 'competitorLab':
        // Competitor Lab - for competitive intelligence
        if (neverRun) {
          // Check if Brand Lab or GAP IA has been run (competitor analysis benefits from brand context)
          const hasBrandLab = runs.some(r => r.toolId === 'brandLab' && r.status === 'complete');
          const hasGapIa = runs.some(r => r.toolId === 'gapSnapshot' && r.status === 'complete');
          if (hasBrandLab || hasGapIa) {
            scoreImpact = 'high';
            urgency = 'now';
            reason = 'Brand context established. Map competitive landscape and identify positioning opportunities.';
          } else {
            scoreImpact = 'medium';
            urgency = 'next';
            reason = 'Profile competitors and map market positioning for strategic differentiation.';
          }
        } else if (isStale) {
          scoreImpact = 'medium';
          urgency = 'next';
          reason = `Competitive intelligence is ${daysSinceRun} days old. Refresh to stay current on competitor movements.`;
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
      const toolId = tool.id.toLowerCase();

      if (focusAreaTitles.some(f =>
        f.includes('website') && toolCategory.includes('website') ||
        f.includes('brand') && toolCategory.includes('brand') ||
        f.includes('seo') && toolCategory.includes('seo') ||
        f.includes('content') && toolCategory.includes('content') ||
        f.includes('conversion') && toolCategory.includes('website') ||
        f.includes('creative') && (toolId.includes('creative') || toolCategory.includes('messaging')) ||
        f.includes('messaging') && (toolId.includes('creative') || toolCategory.includes('messaging')) ||
        f.includes('campaign') && toolId.includes('creative') ||
        f.includes('media') && toolId.includes('media') ||
        f.includes('audience') && toolId.includes('audience') ||
        f.includes('targeting') && toolId.includes('audience') ||
        f.includes('competitor') && toolId.includes('competitor') ||
        f.includes('competitive') && toolId.includes('competitor') ||
        f.includes('positioning') && toolId.includes('competitor') ||
        f.includes('differentiation') && toolId.includes('competitor')
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
      lastRunAt: latestCompleteRun?.createdAt,
      lastScore: latestCompleteRun?.score ?? null,
      lastRunId: latestCompleteRun?.id,
      daysSinceRun,
      lastRunStatus,
    });
  }

  // Deduplicate by toolId (keep first occurrence in case of duplicates)
  const seenToolIds = new Set<CompanyToolId>();
  const dedupedRecommendations = recommendations.filter(rec => {
    if (seenToolIds.has(rec.toolId)) return false;
    seenToolIds.add(rec.toolId);
    return true;
  });

  // Sort by urgency and impact
  const urgencyOrder = { now: 0, next: 1, later: 2 };
  const impactOrder = { high: 0, medium: 1, low: 2 };

  dedupedRecommendations.sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return impactOrder[a.scoreImpact] - impactOrder[b.scoreImpact];
  });

  // Return top 5 recommendations
  const topRecommendations = dedupedRecommendations.slice(0, 5);

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
    'Media & Advertising': 'Funnel',
    'Audience & Targeting': 'Strategy',
    'Competitive Intelligence': 'Strategy',
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
