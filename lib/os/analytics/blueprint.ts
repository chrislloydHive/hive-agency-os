// lib/os/analytics/blueprint.ts
// Unified Blueprint Domain Model for Hive OS
//
// A Blueprint is a strategic playbook derived from analytics data (funnel, GA4, GSC, GAP).
// It provides actionable themes, plays, experiments, and KPIs for improving performance.
//
// CURRENT IMPLEMENTED SOURCES:
// - "dma": DMA acquisition funnel (DigitalMarketingAudit.ai)
// - "company": Company-specific funnel data from GA4/GSC
// - "workspace": Aggregated workspace-level funnel data
//
// WHERE BLUEPRINTS ARE DISPLAYED:
// - DMA Funnel page (/analytics/dma) - Blueprint tab
// - Company Plan page (/c/[companyId]/plan)
// - Workspace Analytics (/analytics) - Blueprint tab
//
// FUTURE SOURCES:
// - "gap": Full GAP analysis reports
// - "brand_lab": Brand diagnostics
//
// To add a new source:
// 1. Add to BlueprintSourceType
// 2. Create a data fetcher that returns FunnelDataset (or similar)
// 3. Call generateBlueprintFromFunnel() with appropriate context

import type { FunnelDataset } from './funnel';
import { getOpenAI } from '@/lib/openai';

// ============================================================================
// Source Types
// ============================================================================

export type BlueprintSourceType = 'dma' | 'company' | 'workspace' | 'gap';

// ============================================================================
// Metric References
// ============================================================================

export interface BlueprintMetricRef {
  /** Type of metric source */
  type: 'funnel' | 'ga4' | 'gsc' | 'gap' | 'custom';
  /** Optional ID reference (e.g., funnel stage ID, metric ID) */
  id?: string;
  /** Human-readable label (e.g., "DMA Funnel Completion Rate", "Organic Sessions") */
  label: string;
}

// ============================================================================
// KPIs
// ============================================================================

export interface BlueprintKpi {
  /** Unique identifier */
  id: string;
  /** KPI label (e.g., "Increase organic sessions") */
  label: string;
  /** Target description (e.g., "+30% in 90 days") */
  target?: string;
  /** Related metrics to track */
  metricRefs?: BlueprintMetricRef[];
}

// ============================================================================
// Experiments
// ============================================================================

export interface BlueprintExperiment {
  /** Unique identifier */
  id: string;
  /** Experiment name (e.g., "Direct Traffic Onboarding Experiment") */
  label: string;
  /** What we believe will happen */
  hypothesis: string;
  /** Detailed description of what to do */
  description: string;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Effort estimate */
  effort?: 'high' | 'medium' | 'low';
  /** KPIs this experiment should impact */
  relatedKpis?: string[];
}

// ============================================================================
// Plays
// ============================================================================

export interface BlueprintPlay {
  /** Unique identifier */
  id: string;
  /** Play name (e.g., "Fix direct traffic conversion") */
  label: string;
  /** What this play aims to achieve */
  description: string;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** When to execute */
  timeframe: 'now' | 'next' | 'later';
  /** KPIs to track for this play */
  kpis: BlueprintKpi[];
  /** Experiments to run as part of this play */
  experiments: BlueprintExperiment[];
}

// ============================================================================
// Themes
// ============================================================================

export interface BlueprintTheme {
  /** Unique identifier */
  id: string;
  /** Theme name (e.g., "Improve Organic Search", "Fix Funnel Drop-off") */
  label: string;
  /** Why this theme matters */
  description: string;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Plays within this theme */
  plays: BlueprintPlay[];
}

// ============================================================================
// Blueprint Summary
// ============================================================================

export interface BlueprintSummary {
  /** Blueprint title (e.g., "Acquisition Funnel Blueprint") */
  title: string;
  /** Period covered (e.g., "Oct 31 - Nov 29, 2025") */
  periodLabel?: string;
  /** Source type */
  sourceType: BlueprintSourceType;
  /** Source identifier (companyId, workspace id, etc.) */
  sourceId?: string;
  /** Source name for display */
  sourceName?: string;
  /** When this blueprint was generated */
  generatedAt: string;
}

// ============================================================================
// Complete Blueprint
// ============================================================================

export interface Blueprint {
  /** Summary metadata */
  summary: BlueprintSummary;
  /** Strategic themes */
  themes: BlueprintTheme[];
  /** High-level narrative/notes for strategists */
  notes?: string;
}

// ============================================================================
// Input Types for Generators
// ============================================================================

export interface FunnelBlueprintInput {
  /** Funnel dataset to analyze */
  dataset: FunnelDataset;
  /** Context for generation */
  context: {
    sourceType: BlueprintSourceType;
    companyId?: string;
    companyName?: string;
    workspaceName?: string;
  };
}

// ============================================================================
// AI Generation
// ============================================================================

const BLUEPRINT_SYSTEM_PROMPT = `You are a strategic analytics expert for Hive OS, a marketing operating system.

Given funnel performance data, create a "Strategic Blueprint" - an actionable playbook with:
- THEMES: High-level strategic focus areas (2-4 themes)
- PLAYS: Specific initiatives within each theme (1-3 per theme)
- KPIs: Measurable targets for each play (1-3 per play)
- EXPERIMENTS: Testable hypotheses to validate (1-3 per play)

IMPORTANT: Return ONLY valid JSON matching this exact structure:

{
  "themes": [
    {
      "id": "theme_1",
      "label": "Theme Name",
      "description": "Why this theme matters",
      "priority": "high" | "medium" | "low",
      "plays": [
        {
          "id": "play_1_1",
          "label": "Play Name",
          "description": "What to do",
          "priority": "high" | "medium" | "low",
          "timeframe": "now" | "next" | "later",
          "kpis": [
            {
              "id": "kpi_1_1_1",
              "label": "KPI description",
              "target": "+X% in Y days",
              "metricRefs": [{"type": "funnel", "label": "Metric name"}]
            }
          ],
          "experiments": [
            {
              "id": "exp_1_1_1",
              "label": "Experiment name",
              "hypothesis": "If we do X, then Y will happen",
              "description": "Detailed steps to execute",
              "priority": "high" | "medium" | "low",
              "effort": "low" | "medium" | "high",
              "relatedKpis": ["kpi_1_1_1"]
            }
          ]
        }
      ]
    }
  ],
  "notes": "2-3 sentence strategic summary for the team"
}

GUIDELINES:
- Completion rate above 60% is strong, 40-60% is average, below 40% needs work
- Prioritize "now" plays for urgent issues (low completion, high drop-off)
- Prioritize "next" plays for growth opportunities (scale successful channels)
- Prioritize "later" plays for optimization (already performing well)
- Quick wins: high impact + low effort experiments
- Each experiment should be testable within 2-4 weeks
- KPIs should be specific and measurable

Return ONLY the JSON object, no markdown code blocks or explanations.`;

/**
 * Build a user prompt from funnel data
 */
function buildFunnelUserPrompt(input: FunnelBlueprintInput): string {
  const { dataset, context } = input;
  const parts: string[] = [];

  // Header
  const sourceName = context.companyName || context.workspaceName || 'Workspace';
  parts.push(`=== ${context.sourceType.toUpperCase()} FUNNEL BLUEPRINT REQUEST ===`);
  parts.push(`Source: ${sourceName}`);
  parts.push('');

  // Summary metrics
  parts.push('FUNNEL SUMMARY:');
  parts.push(`- Total Sessions: ${dataset.summary.totalSessions.toLocaleString()}`);
  parts.push(`- Total Conversions: ${dataset.summary.totalConversions.toLocaleString()}`);
  parts.push(`- Overall Conversion Rate: ${(dataset.summary.overallConversionRate * 100).toFixed(1)}%`);
  if (dataset.summary.topChannel) {
    parts.push(`- Top Channel: ${dataset.summary.topChannel}`);
  }
  if (dataset.summary.periodChange !== null) {
    const changeDir = dataset.summary.periodChange >= 0 ? '+' : '';
    parts.push(`- Period Change: ${changeDir}${(dataset.summary.periodChange * 100).toFixed(1)}%`);
  }
  parts.push('');

  // Stage breakdown
  if (dataset.stages.length > 0) {
    parts.push('FUNNEL STAGES:');
    for (const stage of dataset.stages) {
      const convRate = stage.conversionFromPrevious
        ? ` (${(stage.conversionFromPrevious * 100).toFixed(1)}% from previous)`
        : '';
      parts.push(`- ${stage.label}: ${stage.value.toLocaleString()}${convRate}`);
    }
    parts.push('');
  }

  // Channel performance
  if (dataset.channels.length > 0) {
    parts.push('CHANNEL PERFORMANCE (Top 10):');
    const topChannels = dataset.channels.slice(0, 10);
    for (const ch of topChannels) {
      parts.push(`- ${ch.channel}: ${ch.sessions} sessions, ${ch.conversions} conversions (${(ch.conversionRate * 100).toFixed(1)}% rate)`);
    }
    parts.push('');
  }

  // Campaign performance
  if (dataset.campaigns.length > 0) {
    parts.push('TOP CAMPAIGNS:');
    const topCampaigns = dataset.campaigns.slice(0, 5);
    for (const camp of topCampaigns) {
      parts.push(`- ${camp.campaign}: ${camp.sessions} sessions, ${camp.conversions} conversions (${(camp.conversionRate * 100).toFixed(1)}%)`);
    }
    parts.push('');
  }

  // Time range
  parts.push('DATE RANGE:');
  parts.push(`- From: ${dataset.range.startDate} to ${dataset.range.endDate}`);
  if (dataset.range.preset) {
    parts.push(`- Preset: ${dataset.range.preset}`);
  }
  parts.push('');

  // Request
  parts.push('=== ANALYSIS REQUEST ===');
  parts.push('');
  parts.push('Based on this funnel data, create a Strategic Blueprint with:');
  parts.push('- 2-4 strategic THEMES (e.g., "Fix Conversion Drop-off", "Scale Top Channels")');
  parts.push('- 1-3 PLAYS per theme with specific actions');
  parts.push('- 1-3 measurable KPIs per play');
  parts.push('- 1-3 testable EXPERIMENTS per play');
  parts.push('');
  parts.push('Consider:');
  parts.push('- Which stages have the biggest drop-off?');
  parts.push('- Which channels have volume but poor conversion?');
  parts.push('- Which channels are performing well and can be scaled?');
  parts.push('- What quick wins could improve overall performance?');

  return parts.join('\n');
}

/**
 * Generate a Blueprint from funnel data using AI
 */
export async function generateBlueprintFromFunnel(
  input: FunnelBlueprintInput
): Promise<Blueprint> {
  const { dataset, context } = input;

  console.log('[Blueprint] Generating blueprint from funnel:', {
    sourceType: context.sourceType,
    companyId: context.companyId,
    stages: dataset.stages.length,
    channels: dataset.channels.length,
  });

  // Build user prompt
  const userPrompt = buildFunnelUserPrompt(input);

  // Call OpenAI
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: BLUEPRINT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 3000,
  });

  const rawContent = response.choices[0].message?.content || '{}';

  // Parse response
  let parsed: { themes?: BlueprintTheme[]; notes?: string };
  try {
    parsed = JSON.parse(rawContent);
  } catch (parseError) {
    console.error('[Blueprint] Failed to parse AI response:', rawContent);
    throw new Error('Failed to parse AI response');
  }

  // Build period label
  const startDate = new Date(dataset.range.startDate);
  const endDate = new Date(dataset.range.endDate);
  const periodLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Build source name
  let sourceName = 'Workspace';
  if (context.sourceType === 'dma') {
    sourceName = 'DMA Acquisition Funnel';
  } else if (context.sourceType === 'company' && context.companyName) {
    sourceName = context.companyName;
  } else if (context.workspaceName) {
    sourceName = context.workspaceName;
  }

  // Build title
  let title = 'Strategic Blueprint';
  if (context.sourceType === 'dma') {
    title = 'DMA Funnel Blueprint';
  } else if (context.sourceType === 'company') {
    title = `${context.companyName || 'Company'} Blueprint`;
  } else if (context.sourceType === 'workspace') {
    title = 'Workspace Blueprint';
  }

  const blueprint: Blueprint = {
    summary: {
      title,
      periodLabel,
      sourceType: context.sourceType,
      sourceId: context.companyId,
      sourceName,
      generatedAt: new Date().toISOString(),
    },
    themes: parsed.themes || [],
    notes: parsed.notes,
  };

  console.log('[Blueprint] Blueprint generated:', {
    title: blueprint.summary.title,
    themes: blueprint.themes.length,
    plays: blueprint.themes.reduce((sum, t) => sum + t.plays.length, 0),
  });

  return blueprint;
}

// ============================================================================
// Quick Blueprint Generation (without AI, rule-based)
// ============================================================================

/**
 * Generate a quick blueprint without AI (rule-based)
 * Useful for instant feedback while AI generates
 */
export function generateQuickBlueprint(input: FunnelBlueprintInput): Blueprint {
  const { dataset, context } = input;

  const themes: BlueprintTheme[] = [];

  // Analyze completion rate
  const overallRate = dataset.summary.overallConversionRate;

  // Theme 1: Conversion optimization (if rate < 50%)
  if (overallRate < 0.5) {
    const plays: BlueprintPlay[] = [];

    // Find biggest drop-off
    let biggestDropStage: string | null = null;
    let biggestDrop = 1;
    for (const stage of dataset.stages) {
      if (stage.conversionFromPrevious !== null && stage.conversionFromPrevious < biggestDrop) {
        biggestDrop = stage.conversionFromPrevious;
        biggestDropStage = stage.label;
      }
    }

    if (biggestDropStage) {
      plays.push({
        id: 'play_conversion_1',
        label: `Fix ${biggestDropStage} drop-off`,
        description: `The ${biggestDropStage} stage has a ${(biggestDrop * 100).toFixed(0)}% conversion rate. Focus on reducing friction at this stage.`,
        priority: 'high',
        timeframe: 'now',
        kpis: [
          {
            id: 'kpi_conv_1',
            label: `Increase ${biggestDropStage} conversion`,
            target: '+20% in 30 days',
            metricRefs: [{ type: 'funnel', label: `${biggestDropStage} conversion rate` }],
          },
        ],
        experiments: [
          {
            id: 'exp_conv_1',
            label: 'Simplify form fields',
            hypothesis: 'Reducing form fields will increase completion rate',
            description: 'Test removing optional fields or breaking the form into steps',
            priority: 'high',
            effort: 'low',
            relatedKpis: ['kpi_conv_1'],
          },
        ],
      });
    }

    themes.push({
      id: 'theme_conversion',
      label: 'Improve Conversion Rate',
      description: `Overall conversion is ${(overallRate * 100).toFixed(1)}%, below the 50% benchmark. Focus on reducing friction.`,
      priority: 'high',
      plays,
    });
  }

  // Theme 2: Channel optimization
  const lowConvChannels = dataset.channels.filter(
    (ch) => ch.sessions > 10 && ch.conversionRate < 0.3
  );
  const highConvChannels = dataset.channels.filter(
    (ch) => ch.sessions > 10 && ch.conversionRate > 0.5
  );

  if (lowConvChannels.length > 0 || highConvChannels.length > 0) {
    const plays: BlueprintPlay[] = [];

    if (lowConvChannels.length > 0) {
      const channel = lowConvChannels[0];
      plays.push({
        id: 'play_channel_fix',
        label: `Fix ${channel.channel} conversion`,
        description: `${channel.channel} brings ${channel.sessions} sessions but only ${(channel.conversionRate * 100).toFixed(0)}% convert.`,
        priority: 'medium',
        timeframe: 'next',
        kpis: [
          {
            id: 'kpi_channel_1',
            label: `${channel.channel} conversion rate`,
            target: '+15% in 30 days',
          },
        ],
        experiments: [
          {
            id: 'exp_channel_1',
            label: 'Channel-specific landing page',
            hypothesis: 'A dedicated landing page will improve conversion',
            description: `Create a landing page optimized for ${channel.channel} traffic`,
            priority: 'medium',
            effort: 'medium',
          },
        ],
      });
    }

    if (highConvChannels.length > 0) {
      const channel = highConvChannels[0];
      plays.push({
        id: 'play_channel_scale',
        label: `Scale ${channel.channel}`,
        description: `${channel.channel} converts at ${(channel.conversionRate * 100).toFixed(0)}%. Increase investment.`,
        priority: 'medium',
        timeframe: 'next',
        kpis: [
          {
            id: 'kpi_channel_2',
            label: `${channel.channel} traffic volume`,
            target: '+50% in 60 days',
          },
        ],
        experiments: [
          {
            id: 'exp_channel_2',
            label: 'Double down on high-performing channel',
            hypothesis: 'Increasing spend will scale results proportionally',
            description: `Test 50% budget increase for ${channel.channel}`,
            priority: 'medium',
            effort: 'low',
          },
        ],
      });
    }

    themes.push({
      id: 'theme_channels',
      label: 'Optimize Channel Mix',
      description: 'Different channels have varying performance. Focus resources on what works.',
      priority: 'medium',
      plays,
    });
  }

  // Build summary
  const startDate = new Date(dataset.range.startDate);
  const endDate = new Date(dataset.range.endDate);
  const periodLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  let title = 'Quick Blueprint';
  let sourceName = context.companyName || context.workspaceName || 'Workspace';
  if (context.sourceType === 'dma') {
    title = 'DMA Funnel Quick Blueprint';
    sourceName = 'DMA Acquisition Funnel';
  }

  return {
    summary: {
      title,
      periodLabel,
      sourceType: context.sourceType,
      sourceId: context.companyId,
      sourceName,
      generatedAt: new Date().toISOString(),
    },
    themes,
    notes: `Quick analysis based on ${dataset.summary.totalSessions.toLocaleString()} sessions with ${(dataset.summary.overallConversionRate * 100).toFixed(1)}% conversion. Full AI analysis recommended.`,
  };
}
