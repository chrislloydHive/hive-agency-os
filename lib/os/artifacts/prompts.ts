// lib/os/artifacts/prompts.ts
// AI prompt templates for artifact generation
//
// Each artifact type has a system prompt and task prompt builder

import type { ArtifactTypeDefinition, GeneratedArtifactOutputFormat } from './registry';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactGenerationContext {
  companyName: string;
  goalStatement?: string;
  positioning?: string;
  valueProposition?: string;
  primaryAudience?: string;
  icpDescription?: string;
  objectives: Array<{ text: string; metric?: string; target?: string }>;
  tactics: Array<{
    title: string;
    description?: string;
    channels?: string[];
    status: string;
  }>;
  strategyFrame?: string;
  // Plan-specific context
  planSummary?: string;
  planBudget?: { monthly?: number; quarterly?: number };
  planChannels?: string[];
  planCampaigns?: Array<{ name: string; channel: string; objective?: string }>;
  // Additional context
  promptHint?: string;
}

export interface PromptTemplate {
  systemPrompt: string;
  buildTaskPrompt: (context: ArtifactGenerationContext, sections?: string[]) => string;
}

// ============================================================================
// Shared Prompt Fragments
// ============================================================================

const OUTPUT_FORMAT_INSTRUCTIONS = {
  structured: `You must output valid JSON with this structure:
{
  "title": "Artifact title",
  "summary": "Brief summary of the artifact",
  "generatedAt": "ISO timestamp",
  "format": "structured",
  "sections": [
    {
      "id": "section_id",
      "title": "Section Title",
      "content": "Section content as prose or key points",
      "items": ["Optional bullet points"],
      "subsections": [{ "title": "Subsection", "content": "..." }]
    }
  ]
}`,

  markdown: `You must output valid JSON with this structure:
{
  "title": "Artifact title",
  "summary": "Brief summary",
  "generatedAt": "ISO timestamp",
  "format": "markdown",
  "content": "Full markdown content with ## headings"
}`,

  hybrid: `You must output valid JSON with this structure:
{
  "title": "Artifact title",
  "summary": "Brief summary",
  "generatedAt": "ISO timestamp",
  "format": "hybrid",
  "content": "Main content in markdown",
  "metadata": { "key": "value" },
  "sections": [...]
}`,
};

// ============================================================================
// Artifact-Specific Prompts
// ============================================================================

const CREATIVE_BRIEF_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior creative strategist inside Hive OS.
Your task is to generate a comprehensive Creative Brief that guides creative development.

The brief should be:
- Clear and actionable for creative teams
- Rooted in the strategy and audience insights
- Specific about messaging, tone, and creative direction
- Realistic about constraints and deliverables

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate a Creative Brief for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}
Value Proposition: ${ctx.valueProposition || 'Not specified'}

## Target Audience
Primary: ${ctx.primaryAudience || 'Not specified'}
ICP: ${ctx.icpDescription || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}${o.metric ? ` (${o.metric}: ${o.target})` : ''}`).join('\n')}

## Active Tactics
${ctx.tactics.filter(t => t.status === 'active' || t.status === 'proposed').map(t => `- ${t.title}: ${t.description || 'No description'}`).join('\n')}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'overview, audience, messaging, tone, creative_direction, deliverables, constraints'}`,
};

const MEDIA_BRIEF_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior media strategist inside Hive OS.
Your task is to generate a Media Brief for media planning and buying.

The brief should:
- Define clear media objectives aligned to strategy
- Recommend appropriate channels with rationale
- Include realistic budget allocation recommendations
- Define measurable KPIs

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate a Media Brief for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}

## Target Audience
Primary: ${ctx.primaryAudience || 'Not specified'}
ICP: ${ctx.icpDescription || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}${o.metric ? ` (${o.metric}: ${o.target})` : ''}`).join('\n')}

## Tactics (Media-Related)
${ctx.tactics.filter(t => t.channels?.some(c => ['media', 'social'].includes(c))).map(t => `- ${t.title}: ${t.description || ''}`).join('\n') || 'No specific media tactics defined'}

${ctx.planBudget ? `## Budget Context
Monthly: $${ctx.planBudget.monthly || 'TBD'}
Quarterly: $${ctx.planBudget.quarterly || 'TBD'}` : ''}

${ctx.planChannels?.length ? `## Planned Channels: ${ctx.planChannels.join(', ')}` : ''}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'objectives, target_audience, channels, budget, kpis, timeline, measurement'}`,
};

const CONTENT_BRIEF_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior content strategist inside Hive OS.
Your task is to generate a Content Brief for content creation.

The brief should:
- Define content themes and topics aligned to strategy
- Recommend content formats for each channel
- Include SEO considerations where relevant
- Define tone, voice, and editorial guidelines

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate a Content Brief for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}
Value Proposition: ${ctx.valueProposition || 'Not specified'}

## Target Audience
Primary: ${ctx.primaryAudience || 'Not specified'}
ICP: ${ctx.icpDescription || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}`).join('\n')}

## Content-Related Tactics
${ctx.tactics.filter(t => t.channels?.some(c => ['content', 'seo', 'social'].includes(c))).map(t => `- ${t.title}: ${t.description || ''}`).join('\n') || 'No specific content tactics'}

${ctx.planSummary ? `## Content Plan Summary\n${ctx.planSummary}` : ''}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'overview, topics, formats, audience, seo_keywords, tone_voice, distribution'}`,
};

const CAMPAIGN_BRIEF_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior integrated marketing strategist inside Hive OS.
Your task is to generate a Campaign Brief for multi-channel campaigns.

The brief should:
- Define a cohesive campaign concept
- Coordinate across channels
- Include clear objectives and success metrics
- Balance creative vision with practical execution

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate a Campaign Brief for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}
Value Proposition: ${ctx.valueProposition || 'Not specified'}

## Target Audience
Primary: ${ctx.primaryAudience || 'Not specified'}
ICP: ${ctx.icpDescription || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}${o.metric ? ` (${o.metric}: ${o.target})` : ''}`).join('\n')}

## Active Tactics
${ctx.tactics.filter(t => t.status === 'active' || t.status === 'proposed').map(t => `- ${t.title} [${t.channels?.join(', ') || 'General'}]: ${t.description || ''}`).join('\n')}

${ctx.planCampaigns?.length ? `## Planned Campaigns
${ctx.planCampaigns.map(c => `- ${c.name} (${c.channel}): ${c.objective || ''}`).join('\n')}` : ''}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'campaign_overview, objectives, target_audience, messaging, channels, creative_needs, timeline, budget, success_metrics'}`,
};

const STRATEGY_SUMMARY_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior marketing strategist inside Hive OS.
Your task is to generate a concise Strategy Summary suitable for executive review.

The summary should:
- Be clear and concise (1-2 pages equivalent)
- Highlight key strategic choices and rationale
- Focus on outcomes and priorities
- Be accessible to non-marketing stakeholders

${OUTPUT_FORMAT_INSTRUCTIONS.markdown}`,

  buildTaskPrompt: (ctx) => `Generate a Strategy Summary for ${ctx.companyName}.

## Strategy Context
Goal Statement: ${ctx.goalStatement || 'Not specified'}
Strategy Frame: ${ctx.strategyFrame || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}
Value Proposition: ${ctx.valueProposition || 'Not specified'}

## Target Audience
Primary: ${ctx.primaryAudience || 'Not specified'}
ICP Description: ${ctx.icpDescription || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}${o.metric ? ` (Metric: ${o.metric}, Target: ${o.target})` : ''}`).join('\n')}

## Key Tactics
${ctx.tactics.filter(t => t.status === 'active').map(t => `- ${t.title}: ${t.description || ''}`).join('\n')}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate a well-structured markdown document with:
- Executive Summary
- Strategic Objectives
- Key Initiatives
- Expected Outcomes
- Next Steps`,
};

const EXECUTION_PLAYBOOK_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior marketing operations strategist inside Hive OS.
Your task is to generate an Execution Playbook with step-by-step implementation guidance.

The playbook should:
- Break down strategy into actionable phases
- Define clear actions, owners, and timelines
- Identify dependencies and checkpoints
- Be practical and executable

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate an Execution Playbook for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Strategy Frame: ${ctx.strategyFrame || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}`).join('\n')}

## Tactics to Execute
${ctx.tactics.filter(t => t.status === 'active' || t.status === 'proposed').map(t => `- ${t.title} [${t.channels?.join(', ') || 'General'}]: ${t.description || ''}`).join('\n')}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'overview, phases, actions, owners, timeline, dependencies, checkpoints'}

For each phase, include:
- Phase name and objective
- Key actions with suggested owners
- Dependencies on other phases
- Success checkpoints`,
};

const SEO_BRIEF_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior SEO strategist inside Hive OS.
Your task is to generate an SEO Brief with keyword strategy and optimization recommendations.

The brief should:
- Define keyword clusters aligned to business objectives
- Include technical SEO requirements
- Recommend content optimizations
- Define measurable SEO goals

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate an SEO Brief for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}
Value Proposition: ${ctx.valueProposition || 'Not specified'}

## Target Audience
Primary: ${ctx.primaryAudience || 'Not specified'}
ICP: ${ctx.icpDescription || 'Not specified'}

## SEO-Related Tactics
${ctx.tactics.filter(t => t.channels?.includes('seo')).map(t => `- ${t.title}: ${t.description || ''}`).join('\n') || 'No specific SEO tactics defined'}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'keyword_strategy, content_recommendations, technical_requirements, link_building, measurement'}`,
};

const EXPERIMENT_ROADMAP_PROMPT: PromptTemplate = {
  systemPrompt: `You are a growth strategist inside Hive OS.
Your task is to generate an Experiment Roadmap for validating strategic hypotheses.

The roadmap should:
- Define clear hypotheses to test
- Design experiments with measurable outcomes
- Prioritize by impact and feasibility
- Include learning goals for each experiment

${OUTPUT_FORMAT_INSTRUCTIONS.structured}`,

  buildTaskPrompt: (ctx, sections) => `Generate an Experiment Roadmap for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Strategy Frame: ${ctx.strategyFrame || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}`).join('\n')}

## Proposed Tactics (Candidates for Testing)
${ctx.tactics.filter(t => t.status === 'proposed').map(t => `- ${t.title}: ${t.description || ''}`).join('\n')}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate sections: ${sections?.join(', ') || 'hypotheses, experiments, success_criteria, timeline, resources, learning_goals'}

For each experiment, include:
- Hypothesis being tested
- Experiment design
- Success criteria (quantitative)
- Learning goals (qualitative)
- Timeline and resources needed`,
};

const STAKEHOLDER_SUMMARY_PROMPT: PromptTemplate = {
  systemPrompt: `You are a senior marketing leader inside Hive OS.
Your task is to generate a Stakeholder Summary for internal communication.

The summary should:
- Be high-level and accessible
- Focus on business outcomes
- Highlight progress and next steps
- Address common stakeholder questions

${OUTPUT_FORMAT_INSTRUCTIONS.markdown}`,

  buildTaskPrompt: (ctx) => `Generate a Stakeholder Summary for ${ctx.companyName}.

## Strategy Context
Goal: ${ctx.goalStatement || 'Not specified'}
Positioning: ${ctx.positioning || 'Not specified'}

## Strategic Objectives
${ctx.objectives.map(o => `- ${o.text}${o.metric ? ` (${o.metric}: ${o.target})` : ''}`).join('\n')}

## Key Initiatives
${ctx.tactics.filter(t => t.status === 'active').map(t => `- ${t.title}`).join('\n')}

${ctx.promptHint ? `## Additional Context\n${ctx.promptHint}` : ''}

Generate a markdown document with:
- Executive Overview
- Key Priorities
- Progress Summary
- Upcoming Milestones
- Questions/Discussion Points`,
};

// ============================================================================
// Prompt Registry
// ============================================================================

export const ARTIFACT_PROMPTS: Record<string, PromptTemplate> = {
  creative_brief: CREATIVE_BRIEF_PROMPT,
  media_brief: MEDIA_BRIEF_PROMPT,
  content_brief: CONTENT_BRIEF_PROMPT,
  campaign_brief: CAMPAIGN_BRIEF_PROMPT,
  strategy_summary: STRATEGY_SUMMARY_PROMPT,
  execution_playbook: EXECUTION_PLAYBOOK_PROMPT,
  seo_brief: SEO_BRIEF_PROMPT,
  experiment_roadmap: EXPERIMENT_ROADMAP_PROMPT,
  stakeholder_summary: STAKEHOLDER_SUMMARY_PROMPT,
  // Default fallbacks
  acquisition_plan_summary: STRATEGY_SUMMARY_PROMPT,
  channel_analysis: MEDIA_BRIEF_PROMPT,
  competitive_positioning: STRATEGY_SUMMARY_PROMPT,
};

/**
 * Get prompt template for an artifact type
 */
export function getPromptTemplate(artifactTypeId: string): PromptTemplate | null {
  return ARTIFACT_PROMPTS[artifactTypeId] ?? null;
}

/**
 * Get output format instruction for JSON output
 */
export function getOutputFormatInstruction(format: GeneratedArtifactOutputFormat): string {
  return OUTPUT_FORMAT_INSTRUCTIONS[format];
}
