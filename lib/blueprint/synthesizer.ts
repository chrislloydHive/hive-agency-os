// lib/blueprint/synthesizer.ts
// Strategy Synthesizer with AI Layer
//
// Takes the complete Blueprint pipeline output and generates
// strategic synthesis using AI, producing:
// - Strategic narrative
// - Top focus areas with rationale
// - Prioritized actions
// - Suggested tools to run
// - 90-day plan (now/next/later)

import OpenAI from 'openai';
import type {
  BlueprintPipelineData,
  DiagnosticIssue,
  DiagnosticRecommendation,
  ToolRunStatus,
} from './pipeline';

// ============================================================================
// Types
// ============================================================================

/**
 * A focus area identified by the strategy synthesis
 */
export interface StrategicFocusArea {
  title: string;
  rationale: string;
  supportingSignals: string[];
  /** A single, actionable micro-action that can be sent to Work */
  suggestedAction?: {
    title: string;
    description?: string;
    area?: string;
    priority?: 'high' | 'medium' | 'low';
  };
}

/**
 * A prioritized action item
 */
export interface PrioritizedAction {
  title: string;
  description?: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  source: 'analytics' | 'diagnostics' | 'brain' | 'work';
  area?: string;
}

/**
 * A suggested tool to run
 */
export interface SuggestedTool {
  toolId: string;
  toolLabel: string;
  reason: string;
  urgency: 'run-now' | 'stale' | 'not-run';
}

/**
 * The 90-day plan structure
 */
export interface NinetyDayPlan {
  now: string[];    // Immediate (Week 1-2)
  next: string[];   // Short-term (Week 3-6)
  later: string[];  // Medium-term (Week 7-12)
}

/**
 * Complete strategy synthesis output
 */
export interface StrategySynthesis {
  strategicNarrative: string;
  topFocusAreas: StrategicFocusArea[];
  prioritizedActions: PrioritizedAction[];
  suggestedTools: SuggestedTool[];
  ninetyDayPlan: NinetyDayPlan;
  generatedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// AI Synthesis
// ============================================================================

/**
 * Build the prompt for strategy synthesis
 */
function buildSynthesisPrompt(data: BlueprintPipelineData): string {
  const { diagnostics, analytics, brain, work } = data;

  // Build context sections
  const sections: string[] = [];

  // Diagnostics context
  sections.push('## DIAGNOSTICS DATA');
  if (diagnostics.overallScore !== null) {
    sections.push(`Overall Health Score: ${diagnostics.overallScore}/100`);
  }
  sections.push(`Scores by area:`);
  if (diagnostics.scores.website !== null) sections.push(`- Website: ${diagnostics.scores.website}/100`);
  if (diagnostics.scores.brand !== null) sections.push(`- Brand: ${diagnostics.scores.brand}/100`);
  if (diagnostics.scores.seo !== null) sections.push(`- SEO: ${diagnostics.scores.seo}/100`);
  if (diagnostics.scores.content !== null) sections.push(`- Content: ${diagnostics.scores.content}/100`);
  if (diagnostics.scores.gap !== null) sections.push(`- Strategic Assessment: ${diagnostics.scores.gap}/100`);

  if (diagnostics.issues.length > 0) {
    sections.push('\nTop Issues:');
    for (const issue of diagnostics.issues.slice(0, 8)) {
      sections.push(`- [${issue.severity.toUpperCase()}] ${issue.title} (${issue.area})`);
    }
  }

  if (diagnostics.recommendations.length > 0) {
    sections.push('\nTop Recommendations:');
    for (const rec of diagnostics.recommendations.slice(0, 8)) {
      sections.push(`- [${rec.priority.toUpperCase()}] ${rec.title} (${rec.area})`);
    }
  }

  // Analytics context
  sections.push('\n## ANALYTICS DATA (7-day trends)');
  sections.push(`Traffic trend: ${analytics.trafficTrend}`);
  sections.push(`Conversion trend: ${analytics.conversionTrend}`);
  sections.push(`SEO visibility trend: ${analytics.seoTrend}`);
  if (analytics.performancePulse?.currentSessions) {
    sections.push(`Current sessions: ${analytics.performancePulse.currentSessions.toLocaleString()}`);
  }
  if (analytics.topIssues.length > 0) {
    sections.push('Analytics issues:');
    for (const issue of analytics.topIssues) {
      sections.push(`- ${issue}`);
    }
  }
  if (analytics.hasAnomalies && analytics.anomalySummary) {
    sections.push(`ANOMALY DETECTED: ${analytics.anomalySummary}`);
  }

  // Work context
  sections.push('\n## WORK STATUS');
  sections.push(`Total work items: ${work.total}`);
  sections.push(`In progress: ${work.inProgress.length}`);
  sections.push(`Backlog: ${work.backlog.length}`);
  sections.push(`Overdue: ${work.overdue.length}`);
  sections.push(`Recently completed: ${work.recentlyCompleted.length}`);
  if (work.overdue.length > 0) {
    sections.push('Overdue items:');
    for (const item of work.overdue.slice(0, 3)) {
      sections.push(`- ${item.title} (${item.area || 'General'})`);
    }
  }

  // Tool run status
  sections.push('\n## TOOL RUN STATUS');
  const staleTools = diagnostics.toolStatuses.filter(t => t.status === 'stale');
  const notRunTools = diagnostics.toolStatuses.filter(t => t.status === 'not-run');
  if (staleTools.length > 0) {
    sections.push('Stale tools (> 30 days):');
    for (const tool of staleTools) {
      sections.push(`- ${tool.toolLabel}: ${tool.daysAgo} days ago`);
    }
  }
  if (notRunTools.length > 0) {
    sections.push('Never run:');
    for (const tool of notRunTools) {
      sections.push(`- ${tool.toolLabel}`);
    }
  }

  return sections.join('\n');
}

/**
 * Generate strategy synthesis using AI
 */
export async function generateStrategySynthesis(
  data: BlueprintPipelineData
): Promise<StrategySynthesis> {
  console.log('[Synthesizer] Generating strategy synthesis for:', data.companyId);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const contextPrompt = buildSynthesisPrompt(data);

  const systemPrompt = `You are a strategic marketing consultant AI analyzing a company's marketing health.
Based on the provided diagnostics, analytics, and work data, synthesize a strategic plan.

IMPORTANT NARRATIVE GUIDELINES:
- The strategicNarrative must be SPECIFIC to the actual data, not generic observations
- Focus on concrete numbers, scores, and specific issues from the data
- NEVER use generic phrases like "experiencing significant decline" or "urgent need to address"
- Instead, cite specific scores (e.g., "SEO score of 45 indicates technical debt") or metrics
- Lead with the most actionable insight, not the most obvious trend observation
- If multiple areas need attention, prioritize based on impact, don't just list trends

Output your response as valid JSON matching this exact structure:
{
  "strategicNarrative": "Lead with the primary strategic opportunity or risk, backed by specific data points. What should change and why.",
  "topFocusAreas": [
    {
      "title": "Focus area name",
      "rationale": "Why this area needs attention",
      "supportingSignals": ["Signal 1", "Signal 2"],
      "suggestedAction": {
        "title": "A single, specific micro-action (e.g., 'Audit top 10 landing pages for CTA clarity')",
        "description": "Brief description of the action",
        "area": "Website|SEO|Brand|Content|Strategy|Funnel",
        "priority": "high|medium|low"
      }
    }
  ],
  "prioritizedActions": [
    {
      "title": "Action to take",
      "description": "Brief description",
      "impact": "high|medium|low",
      "effort": "low|medium|high",
      "source": "analytics|diagnostics|brain|work",
      "area": "Website|SEO|Brand|Content|Strategy"
    }
  ],
  "suggestedTools": [
    {
      "toolId": "websiteLab|seoLab|brandLab|gapSnapshot|gapPlan",
      "toolLabel": "Human-readable name",
      "reason": "Why this tool should be run",
      "urgency": "run-now|stale|not-run"
    }
  ],
  "ninetyDayPlan": {
    "now": ["Immediate action 1", "Immediate action 2"],
    "next": ["Short-term action 1", "Short-term action 2"],
    "later": ["Medium-term action 1", "Medium-term action 2"]
  }
}

Guidelines:
- Focus on actionable, specific recommendations with concrete outcomes
- Prioritize high-impact, low-effort actions first
- Consider the current work status and avoid overwhelming
- Reference specific diagnostic scores and issues by name
- Keep the strategic narrative punchy - 2 sentences max, data-backed
- Avoid vague language like "significant", "urgent", "critical" without data
- Include 3-5 focus areas max
- Include 5-8 prioritized actions max
- Include 2-4 suggested tools max
- Keep 90-day plan items specific and measurable`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content) as StrategySynthesis;

    // Determine confidence based on data availability
    let confidence: 'high' | 'medium' | 'low' = 'low';
    const hasScores = data.diagnostics.overallScore !== null;
    const hasAnalytics = data.analytics.performancePulse !== null;
    const hasMultipleTools = Object.values(data.diagnostics.latestByTool).filter(Boolean).length >= 2;

    if (hasScores && hasAnalytics && hasMultipleTools) {
      confidence = 'high';
    } else if (hasScores || hasAnalytics) {
      confidence = 'medium';
    }

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
      confidence,
    };
  } catch (error) {
    console.error('[Synthesizer] AI synthesis failed:', error);
    // Return a fallback synthesis based on rules
    return generateFallbackSynthesis(data);
  }
}

/**
 * Generate a fallback synthesis without AI
 */
function generateFallbackSynthesis(data: BlueprintPipelineData): StrategySynthesis {
  const { diagnostics, analytics, work } = data;

  // Build strategic narrative
  const narrativeParts: string[] = [];
  if (diagnostics.overallScore !== null) {
    if (diagnostics.overallScore >= 70) {
      narrativeParts.push('Marketing foundations are solid');
    } else if (diagnostics.overallScore >= 50) {
      narrativeParts.push('Marketing presence shows potential but has gaps to address');
    } else {
      narrativeParts.push('Marketing foundations need significant improvement');
    }
  }
  if (analytics.trafficTrend === 'down') {
    narrativeParts.push('traffic is declining');
  }
  if (work.overdue.length > 0) {
    narrativeParts.push(`${work.overdue.length} overdue work items need attention`);
  }

  const strategicNarrative = narrativeParts.length > 0
    ? narrativeParts.join(', ') + '.'
    : 'Run diagnostic tools to generate strategic insights.';

  // Build focus areas from issues
  const focusAreas: StrategicFocusArea[] = [];
  const issuesByArea = new Map<string, DiagnosticIssue[]>();
  for (const issue of diagnostics.issues) {
    const existing = issuesByArea.get(issue.area) || [];
    existing.push(issue);
    issuesByArea.set(issue.area, existing);
  }

  for (const [area, issues] of issuesByArea) {
    if (focusAreas.length >= 4) break;
    const criticalCount = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length;
    if (criticalCount > 0) {
      // Generate a suggested action based on the top issue
      const topIssue = issues[0];
      focusAreas.push({
        title: `Improve ${area}`,
        rationale: `${criticalCount} high-priority issues identified`,
        supportingSignals: issues.slice(0, 3).map(i => i.title),
        suggestedAction: {
          title: `Address: ${topIssue.title}`,
          description: topIssue.description || `Fix the top ${area} issue to improve overall score`,
          area: area,
          priority: topIssue.severity === 'critical' ? 'high' : topIssue.severity === 'high' ? 'high' : 'medium',
        },
      });
    }
  }

  // Build prioritized actions from recommendations
  const prioritizedActions: PrioritizedAction[] = diagnostics.recommendations
    .slice(0, 6)
    .map(rec => ({
      title: rec.title,
      description: rec.description,
      impact: rec.impact || rec.priority,
      effort: rec.effort || 'medium',
      source: 'diagnostics' as const,
      area: rec.area,
    }));

  // Add analytics-driven actions
  if (analytics.trafficTrend === 'down') {
    prioritizedActions.unshift({
      title: 'Investigate traffic decline',
      description: 'Analyze traffic sources and identify drop-off points',
      impact: 'high',
      effort: 'low',
      source: 'analytics',
      area: 'Analytics',
    });
  }

  // Build suggested tools
  const suggestedTools: SuggestedTool[] = [];
  for (const status of diagnostics.toolStatuses) {
    if (status.status === 'not-run') {
      suggestedTools.push({
        toolId: status.toolId,
        toolLabel: status.toolLabel,
        reason: `Never run - establish baseline`,
        urgency: 'not-run',
      });
    } else if (status.status === 'stale' && status.recommendation) {
      suggestedTools.push({
        toolId: status.toolId,
        toolLabel: status.toolLabel,
        reason: status.recommendation,
        urgency: 'stale',
      });
    }
  }

  // Build 90-day plan
  const ninetyDayPlan: NinetyDayPlan = {
    now: [],
    next: [],
    later: [],
  };

  // Add immediate items from overdue work
  for (const item of work.overdue.slice(0, 2)) {
    ninetyDayPlan.now.push(`Complete overdue: ${item.title}`);
  }

  // Add high-priority actions to "now"
  for (const action of prioritizedActions.filter(a => a.impact === 'high').slice(0, 3)) {
    if (ninetyDayPlan.now.length < 4) {
      ninetyDayPlan.now.push(action.title);
    }
  }

  // Add medium-priority actions to "next"
  for (const action of prioritizedActions.filter(a => a.impact === 'medium').slice(0, 3)) {
    ninetyDayPlan.next.push(action.title);
  }

  // Add low-priority or lower effort items to "later"
  for (const action of prioritizedActions.filter(a => a.impact === 'low').slice(0, 2)) {
    ninetyDayPlan.later.push(action.title);
  }

  // Ensure at least some items in each bucket
  if (ninetyDayPlan.now.length === 0) {
    ninetyDayPlan.now.push('Run initial diagnostic tools to assess current state');
  }
  if (ninetyDayPlan.next.length === 0) {
    ninetyDayPlan.next.push('Review diagnostic results and create action plan');
  }
  if (ninetyDayPlan.later.length === 0) {
    ninetyDayPlan.later.push('Implement long-term strategic initiatives');
  }

  return {
    strategicNarrative,
    topFocusAreas: focusAreas,
    prioritizedActions: prioritizedActions.slice(0, 8),
    suggestedTools: suggestedTools.slice(0, 4),
    ninetyDayPlan,
    generatedAt: new Date().toISOString(),
    confidence: 'low',
  };
}

// ============================================================================
// Full Synthesis Pipeline
// ============================================================================

/**
 * Run the complete synthesis pipeline
 */
export async function synthesizeStrategy(
  pipelineData: BlueprintPipelineData,
  options: { useAI?: boolean } = {}
): Promise<StrategySynthesis> {
  const { useAI = true } = options;

  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      return await generateStrategySynthesis(pipelineData);
    } catch (error) {
      console.warn('[Synthesizer] AI synthesis failed, using fallback:', error);
      return generateFallbackSynthesis(pipelineData);
    }
  }

  return generateFallbackSynthesis(pipelineData);
}
