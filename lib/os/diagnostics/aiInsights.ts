// lib/os/diagnostics/aiInsights.ts
// AI Insights types and client utilities for diagnostic tools
//
// This module provides types for AI-generated insights and a client-side
// helper for fetching insights from the API.

import type { DiagnosticToolId } from './runs';

// ============================================================================
// Types
// ============================================================================

/**
 * Suggested experiment from AI analysis
 */
export interface DiagnosticExperiment {
  name: string;
  hypothesis: string;
  steps: string[];
  successMetric: string;
}

/**
 * Suggested work item from AI analysis
 */
export interface SuggestedWorkItem {
  title: string;
  area: 'strategy' | 'website' | 'brand' | 'content' | 'seo' | 'demand' | 'ops';
  description: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * AI-generated insights for a diagnostic run
 */
export interface DiagnosticInsights {
  summary: string;
  strengths: string[];
  issues: string[];
  quickWins: string[];
  experiments: DiagnosticExperiment[];
  suggestedWorkItems: SuggestedWorkItem[];
}

/**
 * Response from the AI insights API
 */
export interface DiagnosticInsightsResponse {
  toolId: DiagnosticToolId;
  companyId: string;
  runId: string;
  insights: DiagnosticInsights;
  generatedAt: string;
}

/**
 * Error response from the AI insights API
 */
export interface DiagnosticInsightsError {
  error: string;
  toolId?: DiagnosticToolId;
  companyId?: string;
}

// ============================================================================
// Tool-Specific System Prompts
// ============================================================================

/**
 * Get the system prompt for a specific diagnostic tool
 */
export function getToolSystemPrompt(toolId: DiagnosticToolId): string {
  const prompts: Record<DiagnosticToolId, string> = {
    gapSnapshot: `You are Hive OS GAP Snapshot Analyzer. You analyze initial marketing assessments that score companies on their overall marketing maturity.

The data includes:
- Overall marketing scores (0-100)
- Maturity stage classification
- Channel presence analysis
- Basic brand and content metrics

Focus your analysis on:
- Quick wins that can improve scores immediately
- The most impactful areas to address first
- Red flags that indicate deeper issues
- Competitive positioning insights`,

    gapPlan: `You are Hive OS GAP Plan Analyzer. You analyze comprehensive Growth Acceleration Plans that include strategic initiatives and 90-day roadmaps.

The data includes:
- Strategic initiatives with priorities
- Quick wins and immediate actions
- 90-day implementation roadmap
- Resource allocation recommendations

Focus your analysis on:
- Whether the initiatives align with business goals
- Sequencing and dependencies between initiatives
- Risk factors and mitigation strategies
- Success metrics and measurement approaches`,

    websiteLab: `You are Hive OS Website Lab Analyzer. You analyze multi-page website UX and conversion diagnostics.

The data includes:
- Page-by-page UX assessments
- Conversion optimization opportunities
- CTA effectiveness analysis
- Messaging clarity scores
- Technical performance metrics

Focus your analysis on:
- Conversion blockers and friction points
- User experience improvements
- Messaging and copy recommendations
- Technical optimizations for performance`,

    brandLab: `You are Hive OS Brand Lab Analyzer. You analyze brand health, clarity, and positioning assessments.

The data includes:
- Brand coherence scores
- Visual identity consistency
- Messaging alignment
- Competitive differentiation analysis
- Brand promise delivery

Focus your analysis on:
- Brand clarity and memorability
- Consistency across touchpoints
- Differentiation opportunities
- Brand story effectiveness`,

    contentLab: `You are Hive OS Content Lab Analyzer. You analyze content inventory and quality assessments.

The data includes:
- Content audit results
- Blog and resource analysis
- Case study effectiveness
- Content strategy alignment
- SEO content metrics

Focus your analysis on:
- Content gaps and opportunities
- Quality improvements needed
- Topic authority building
- Content distribution effectiveness`,

    seoLab: `You are Hive OS SEO Lab Analyzer. You analyze comprehensive deep SEO diagnostics that combine website crawl data, GSC analytics, and issue tracking.

The data includes:
- Overall SEO maturity score and stage
- Subscores for Technical SEO, On-page & Content, Authority & Links, SERP & Visibility
- Detailed issue list with severity levels (critical, high, medium, low)
- Quick wins with impact and effort ratings
- SEO projects with time horizons
- Google Search Console analytics (clicks, impressions, CTR, avg position)
- Top queries and landing pages

Focus your analysis on:
- Critical and high-severity issues that need immediate attention
- Subscores that are weak and dragging down overall performance
- Quick wins with high impact and low effort
- GSC metrics trends and top-performing queries
- Strategic SEO projects for the roadmap`,

    demandLab: `You are Hive OS Demand Lab Analyzer. You analyze demand generation and funnel diagnostics.

The data includes:
- Lead capture effectiveness
- Funnel conversion rates
- Campaign performance
- Nurture flow analysis
- Attribution data

Focus your analysis on:
- Funnel leak identification
- Lead quality improvements
- Campaign optimization
- Nurture sequence effectiveness`,

    opsLab: `You are Hive OS Ops Lab Analyzer. You analyze marketing operations and process assessments.

The data includes:
- Process efficiency scores
- Tool stack analysis
- Automation coverage
- Data quality metrics
- Team capacity utilization

Focus your analysis on:
- Process bottlenecks
- Automation opportunities
- Tool consolidation
- Data hygiene improvements`,

    gapHeavy: `You are Hive OS GAP Heavy Analyzer. You analyze comprehensive multi-source marketing diagnostics that include deep analysis across all marketing dimensions.

The data includes:
- Competitor landscape analysis
- Multi-page website assessment
- Brand positioning evaluation
- Content strategy analysis
- SEO technical and content audit
- Demand generation funnel analysis
- Marketing operations efficiency
- Strategic themes and roadmap

Focus your analysis on:
- Cross-dimensional insights and patterns
- Strategic priorities based on multiple data sources
- Competitive positioning opportunities
- Resource allocation recommendations
- Quick wins with high impact across channels`,
  };

  return prompts[toolId] || prompts.gapSnapshot;
}

// ============================================================================
// Client Utilities
// ============================================================================

/**
 * Fetch AI insights for a diagnostic tool
 */
export async function fetchToolInsights(
  toolId: DiagnosticToolId,
  companyId: string,
  runId?: string
): Promise<DiagnosticInsightsResponse> {
  const response = await fetch(`/api/os/diagnostics/ai-insights/${toolId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, runId }),
  });

  if (!response.ok) {
    const error: DiagnosticInsightsError = await response.json().catch(() => ({
      error: `Failed to fetch insights: ${response.status}`,
    }));
    throw new Error(error.error);
  }

  return response.json();
}

/**
 * Create an empty insights object for loading/error states
 */
export function createEmptyInsights(): DiagnosticInsights {
  return {
    summary: '',
    strengths: [],
    issues: [],
    quickWins: [],
    experiments: [],
    suggestedWorkItems: [],
  };
}

// ============================================================================
// Brain Entry Generation
// ============================================================================

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { createClientInsight } from '@/lib/airtable/clientBrain';
import { getCompanyById } from '@/lib/airtable/companies';
import type { DiagnosticRun } from './runs';
import type {
  CompanyToolDefinition,
  ToolCategory,
} from '@/lib/tools/registry';
import { getToolByDiagnosticId } from '@/lib/tools/registry';
import type { InsightCategory, InsightSeverity } from '@/lib/types/clientBrain';

/**
 * AI-generated summary for Brain entries
 */
export interface DiagnosticSummaryForBrain {
  overallAssessment: string;
  keyStrengths: string[];
  keyGaps: string[];
  recommendedFocusAreas: string[];
}

/**
 * Options for the summarizer
 */
export interface SummarizeOptions {
  /** Skip if a recent insight already exists for this run */
  skipIfExists?: boolean;
  /** Additional context to include in the prompt */
  additionalContext?: string;
}

/**
 * Map tool category to insight category
 */
function toolCategoryToInsightCategory(category: ToolCategory): InsightCategory {
  const mapping: Record<ToolCategory, InsightCategory> = {
    'Strategic Assessment': 'other',
    'Website & UX': 'website',
    'Brand & Positioning': 'brand',
    'Content & Messaging': 'content',
    'SEO & Search': 'seo',
    'Demand Generation': 'demand',
    'Marketing Ops': 'ops',
    'Analytics': 'analytics',
    'Media & Advertising': 'demand', // Media maps to demand generation insights
  };
  return mapping[category] || 'other';
}

/**
 * Determine severity based on score
 */
function scoreToSeverity(score: number | null): InsightSeverity {
  if (score === null) return 'medium';
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

/**
 * Extract scores from diagnostic run rawJson
 */
function extractScoresFromRun(run: DiagnosticRun): Record<string, number | null> {
  const scores: Record<string, number | null> = {
    overall: run.score,
  };

  if (!run.rawJson || typeof run.rawJson !== 'object') {
    return scores;
  }

  const raw = run.rawJson as Record<string, unknown>;

  // GAP IA structure
  if (raw.initialAssessment && typeof raw.initialAssessment === 'object') {
    const ia = raw.initialAssessment as Record<string, unknown>;
    if (ia.summary && typeof ia.summary === 'object') {
      const summary = ia.summary as Record<string, unknown>;
      scores.overall = typeof summary.overallScore === 'number' ? summary.overallScore : scores.overall;
    }
    if (ia.dimensions && typeof ia.dimensions === 'object') {
      const dims = ia.dimensions as Record<string, unknown>;
      for (const [key, dim] of Object.entries(dims)) {
        if (dim && typeof dim === 'object' && 'score' in dim) {
          scores[key] = (dim as Record<string, unknown>).score as number;
        }
      }
    }
  }

  // Direct scores object
  if (raw.scores && typeof raw.scores === 'object') {
    const s = raw.scores as Record<string, unknown>;
    for (const [key, value] of Object.entries(s)) {
      if (typeof value === 'number') {
        scores[key] = value;
      }
    }
  }

  // Website Lab structure
  if (raw.siteAssessment && typeof raw.siteAssessment === 'object') {
    const site = raw.siteAssessment as Record<string, unknown>;
    scores.overall = typeof site.overallScore === 'number' ? site.overallScore : scores.overall;
    if (site.dimensions && typeof site.dimensions === 'object') {
      const dims = site.dimensions as Record<string, unknown>;
      for (const [key, dim] of Object.entries(dims)) {
        if (dim && typeof dim === 'object' && 'score' in dim) {
          scores[key] = (dim as Record<string, unknown>).score as number;
        }
      }
    }
  }

  // SEO Lab structure (SeoLabReport)
  if (typeof raw.overallScore === 'number') {
    scores.overall = raw.overallScore;
  }
  if (Array.isArray(raw.subscores)) {
    for (const sub of raw.subscores) {
      if (sub && typeof sub === 'object' && 'label' in sub && 'score' in sub) {
        const label = String((sub as Record<string, unknown>).label).replace(/\s+/g, '');
        const score = (sub as Record<string, unknown>).score;
        if (typeof score === 'number') {
          scores[label] = score;
        }
      }
    }
  }

  return scores;
}

/**
 * Extract key findings from diagnostic run
 */
function extractKeyFindings(run: DiagnosticRun): {
  strengths: string[];
  issues: string[];
  recommendations: string[];
} {
  const result = {
    strengths: [] as string[],
    issues: [] as string[],
    recommendations: [] as string[],
  };

  if (!run.rawJson || typeof run.rawJson !== 'object') {
    return result;
  }

  const raw = run.rawJson as Record<string, unknown>;

  // Direct arrays
  if (Array.isArray(raw.strengths)) {
    result.strengths = raw.strengths.filter((s): s is string => typeof s === 'string').slice(0, 5);
  }
  if (Array.isArray(raw.issues)) {
    result.issues = raw.issues
      .map((i) => (typeof i === 'string' ? i : typeof i === 'object' && i && 'title' in i ? String((i as Record<string, unknown>).title) : null))
      .filter((i): i is string => i !== null)
      .slice(0, 5);
  }
  if (Array.isArray(raw.recommendations)) {
    result.recommendations = raw.recommendations
      .map((r) => (typeof r === 'string' ? r : typeof r === 'object' && r && 'title' in r ? String((r as Record<string, unknown>).title) : null))
      .filter((r): r is string => r !== null)
      .slice(0, 5);
  }

  // GAP IA insights
  if (raw.initialAssessment && typeof raw.initialAssessment === 'object') {
    const ia = raw.initialAssessment as Record<string, unknown>;
    if (ia.insights && typeof ia.insights === 'object') {
      const insights = ia.insights as Record<string, unknown>;
      if (Array.isArray(insights.strengths)) {
        result.strengths = insights.strengths.filter((s): s is string => typeof s === 'string').slice(0, 5);
      }
      if (Array.isArray(insights.weaknesses)) {
        result.issues = insights.weaknesses.filter((s): s is string => typeof s === 'string').slice(0, 5);
      }
      if (Array.isArray(insights.recommendations)) {
        result.recommendations = insights.recommendations.filter((s): s is string => typeof s === 'string').slice(0, 5);
      }
    }
  }

  // Website Lab siteAssessment
  if (raw.siteAssessment && typeof raw.siteAssessment === 'object') {
    const site = raw.siteAssessment as Record<string, unknown>;
    if (Array.isArray(site.criticalIssues)) {
      result.issues = site.criticalIssues
        .map((i) => typeof i === 'string' ? i : typeof i === 'object' && i && 'title' in i ? String((i as Record<string, unknown>).title) : null)
        .filter((i): i is string => i !== null)
        .slice(0, 5);
    }
    if (Array.isArray(site.quickWins)) {
      result.recommendations = site.quickWins
        .map((q) => typeof q === 'string' ? q : typeof q === 'object' && q && 'title' in q ? String((q as Record<string, unknown>).title) : null)
        .filter((q): q is string => q !== null)
        .slice(0, 5);
    }
  }

  // SEO Lab structure (SeoLabReport)
  if (Array.isArray(raw.topStrengths)) {
    result.strengths = raw.topStrengths.filter((s): s is string => typeof s === 'string').slice(0, 5);
  }
  if (Array.isArray(raw.topGaps)) {
    result.issues = raw.topGaps.filter((g): g is string => typeof g === 'string').slice(0, 5);
  }
  if (Array.isArray(raw.quickWins)) {
    result.recommendations = raw.quickWins
      .map((q) => typeof q === 'string' ? q : typeof q === 'object' && q && 'title' in q ? String((q as Record<string, unknown>).title) : null)
      .filter((q): q is string => q !== null)
      .slice(0, 5);
  }
  // Also extract from issues array (SeoIssue[])
  if (Array.isArray(raw.issues) && result.issues.length === 0) {
    result.issues = raw.issues
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
      .filter((i) => i.severity === 'critical' || i.severity === 'high')
      .map((i) => String(i.title || i.description))
      .filter((i): i is string => i.length > 0)
      .slice(0, 5);
  }

  return result;
}

/**
 * Generate an AI summary of a diagnostic run and write it to the Brain
 *
 * This function:
 * 1. Extracts scores and findings from the run
 * 2. Uses AI to generate a structured summary
 * 3. Creates a normalized Brain entry
 */
export async function summarizeDiagnosticRunForBrain(
  companyId: string,
  run: DiagnosticRun,
  toolDef?: CompanyToolDefinition,
  options: SummarizeOptions = {}
): Promise<void> {
  console.log('[aiInsights] Summarizing diagnostic run for Brain:', {
    companyId,
    runId: run.id,
    toolId: run.toolId,
  });

  // Get tool definition if not provided
  const tool = toolDef || getToolByDiagnosticId(run.toolId);
  if (!tool) {
    console.warn('[aiInsights] No tool definition found for:', run.toolId);
    return;
  }

  // Get company info for context
  const company = await getCompanyById(companyId);
  if (!company) {
    console.warn('[aiInsights] Company not found:', companyId);
    return;
  }

  // Extract data from the run
  const scores = extractScoresFromRun(run);
  const findings = extractKeyFindings(run);

  // Build the AI prompt
  const systemPrompt = `You are a strategic marketing analyst for Hive OS, a marketing agency management system.

Your task is to synthesize diagnostic results into actionable insights for the company's "Brain" - a strategic memory system.

Output ONLY valid JSON matching this exact structure:
{
  "overallAssessment": "2-3 sentence summary of the diagnostic findings",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "keyGaps": ["gap 1", "gap 2", "gap 3"],
  "recommendedFocusAreas": ["focus area 1", "focus area 2", "focus area 3"]
}

Guidelines:
- Keep strengths/gaps/focusAreas to 3-5 items each
- Be specific and actionable, not generic
- Focus on strategic implications, not just observations
- Use the company's actual name and context`;

  const taskPrompt = `Analyze this diagnostic run for ${company.name}:

**Tool:** ${tool.label} (${tool.category})
**Overall Score:** ${scores.overall ?? 'N/A'}/100

**Dimension Scores:**
${Object.entries(scores)
  .filter(([k]) => k !== 'overall')
  .map(([k, v]) => `- ${k}: ${v ?? 'N/A'}`)
  .join('\n') || 'No dimension scores available'}

**Existing Findings:**
${findings.strengths.length > 0 ? `Strengths: ${findings.strengths.join(', ')}` : 'No strengths identified'}
${findings.issues.length > 0 ? `Issues: ${findings.issues.join(', ')}` : 'No issues identified'}
${findings.recommendations.length > 0 ? `Recommendations: ${findings.recommendations.join(', ')}` : 'No recommendations available'}

**Run Summary:** ${run.summary || 'No summary available'}

${options.additionalContext || ''}

Generate a Brain entry that captures the strategic implications of these findings.`;

  try {
    // Call AI to generate summary
    const result = await aiForCompany(companyId, {
      type: 'Diagnostic Summary',
      tags: ['Diagnostic', 'Strategy', tool.category, tool.label],
      relatedEntityId: run.id,
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 1000,
    });

    // Parse the AI response
    let summary: DiagnosticSummaryForBrain;
    try {
      summary = JSON.parse(result.content);
    } catch {
      console.error('[aiInsights] Failed to parse AI response');
      // Create a fallback summary from extracted data
      summary = {
        overallAssessment: run.summary || `${tool.label} diagnostic completed with a score of ${scores.overall ?? 'N/A'}/100.`,
        keyStrengths: findings.strengths.slice(0, 3),
        keyGaps: findings.issues.slice(0, 3),
        recommendedFocusAreas: findings.recommendations.slice(0, 3),
      };
    }

    // Create the Brain entry
    const insightCategory = toolCategoryToInsightCategory(tool.category);
    const severity = scoreToSeverity(scores.overall);

    // Build the insight body with structured data
    const bodyParts: string[] = [
      summary.overallAssessment,
      '',
      '**Key Strengths:**',
      ...summary.keyStrengths.map(s => `- ${s}`),
      '',
      '**Key Gaps:**',
      ...summary.keyGaps.map(g => `- ${g}`),
      '',
      '**Recommended Focus Areas:**',
      ...summary.recommendedFocusAreas.map(f => `- ${f}`),
    ];

    await createClientInsight(companyId, {
      title: `${tool.label} Diagnostic Summary`,
      body: bodyParts.join('\n'),
      category: insightCategory,
      severity,
      source: {
        type: 'tool_run',
        toolSlug: tool.urlSlug || tool.id,
        toolRunId: run.id,
      },
    });

    console.log('[aiInsights] Brain entry created successfully:', {
      companyId,
      toolId: tool.id,
      runId: run.id,
    });
  } catch (error) {
    console.error('[aiInsights] Failed to summarize diagnostic run:', error);
    // Don't throw - we don't want to break the main flow
  }
}

/**
 * Check if a diagnostic summary insight already exists for a run
 */
export async function hasDiagnosticSummary(
  companyId: string,
  runId: string
): Promise<boolean> {
  const { getCompanyInsights } = await import('@/lib/airtable/clientBrain');
  const insights = await getCompanyInsights(companyId, { limit: 100 });

  return insights.some(
    (insight) =>
      insight.source.type === 'tool_run' &&
      (insight.source as { toolRunId?: string }).toolRunId === runId
  );
}
