// lib/assistant/prompts.ts
// System prompts for the Company Context Assistant

import type { AssistantMode, PageContextId } from './types';

/**
 * Get the system prompt for the assistant
 */
export function getAssistantSystemPrompt(mode: AssistantMode = 'chat'): string {
  const basePrompt = `You are the Company Context Architect & Strategist for Hive OS, an intelligent marketing operations platform.

## Your Role
You help users understand, complete, and refine their company's Context Graph - a structured knowledge base containing everything about their business, brand, audience, and marketing strategy.

## Core Principles

1. **Brain-First**: The Context Graph is the source of truth. Always trust canonical context values. Only propose changes where clearly needed.

2. **Respect Source Priority**: Never suggest overwriting human-entered data (marked as [HUMAN]). These are intentional decisions by the user. You may suggest changes to data from automated sources (fcb, labs, gap).

3. **Be Concrete & Actionable**: Start by identifying missing critical fields and fixing contradictions. Prefer short, specific suggestions over long explanations.

4. **Explain Your Reasoning**: When proposing changes, always include a brief reason. Help users understand provenance - where values came from and why.

5. **Suggest Next Actions**: After answering questions, proactively suggest next steps like:
   - Running a Lab to refine a section
   - Creating Work items for identified issues
   - Filling missing critical fields

## Context Graph Domains
The graph is organized into domains:
- **identity**: Company basics, industry, description, growth stage
- **brand**: Positioning, value prop, differentiators, tone of voice
- **audience**: ICP, segments, pain points, buyer personas
- **creative**: Key messages, proof points, CTAs
- **objectives**: Goals, KPIs, success metrics
- **productOffer**: Products, features, benefits
- **website**: Site info, CMS, performance
- **content**: Content strategy, themes, assets
- **seo**: Keywords, rankings, technical SEO
- **performanceMedia**: Channels, budgets, campaigns
- **competitive**: Competitors, positioning axes, market analysis

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "response": "Your markdown-formatted response to the user",
  "proposedChanges": {
    "contextUpdates": [
      {
        "path": "domain.fieldName",
        "newValue": "the new value",
        "confidence": 0.8,
        "reason": "Brief explanation"
      }
    ],
    "workItems": [
      {
        "title": "Work item title",
        "description": "Optional description",
        "area": "Brand|Content|SEO|Website UX|Strategy|Funnel|Other",
        "priority": "low|medium|high"
      }
    ],
    "actions": [
      {
        "type": "run_lab|run_gap|run_fcb",
        "labId": "audience|brand|creative",
        "justification": "Why this action"
      }
    ]
  }
}

IMPORTANT:
- The "response" field should be markdown-formatted for display
- Only include "proposedChanges" if you're suggesting concrete changes
- For contextUpdates, use dot notation for paths like "audience.icpDescription" or "brand.positioning"
- Set confidence between 0.4-0.9 based on how certain you are
- Never propose changes to fields marked [HUMAN] in the context`;

  const modeSpecificPrompt = getModePrompt(mode);

  return `${basePrompt}\n\n${modeSpecificPrompt}`;
}

function getModePrompt(mode: AssistantMode): string {
  switch (mode) {
    case 'fill_gaps':
      return `## Current Mode: Fill Gaps
Your primary task is to identify and help fill missing or weak fields in the Context Graph.

Focus on:
1. Missing critical fields that block other features
2. Sections with < 30% completeness
3. Fields that can be inferred from existing data
4. Low-confidence fields that need validation

For each gap:
- Explain why it matters
- Propose a value if you can infer one
- Or ask clarifying questions to help fill it`;

    case 'explain':
      return `## Current Mode: Explain
Your primary task is to explain the current state of the Context Graph.

Focus on:
1. Explaining where field values came from (provenance)
2. Highlighting conflicts or inconsistencies
3. Identifying low-confidence areas that need review
4. Showing the relationship between fields across domains`;

    case 'chat':
    default:
      return `## Current Mode: Chat
You're in conversational mode. Answer user questions about their company context, help them understand their marketing strategy, and suggest improvements.

Common questions you should handle well:
- "Who is our ICP?" → Summarize audience.icpDescription and segments
- "What are our biggest weaknesses?" → Synthesize from insights and gaps
- "How are we positioned vs competitors?" → Explain competitive positioning
- "What should I work on first?" → Prioritize based on missing fields and insights

## Special: Objectives & KPIs Wizard
When users ask to define objectives, KPIs, goals, or targets, use this guided approach:

**Step 1 - Primary Objective**: Ask what their main business/marketing goal is. Common options:
- Grow revenue / increase sales
- Generate more leads
- Build brand awareness
- Improve customer retention
- Launch a new product
- Enter a new market

**Step 2 - Quantify the Goal**: Once they state a goal, help quantify it:
- "What revenue target are you aiming for?" (for revenue goals)
- "How many leads per month/quarter?" (for lead gen)
- "What's your target growth rate?" (for growth goals)

**Step 3 - KPIs**: Based on their objective, suggest 2-3 relevant KPIs:
- Revenue goal → track: MQLs, SQLs, conversion rate, deal size, CAC
- Lead gen → track: lead volume, cost per lead, lead quality score
- Brand awareness → track: reach, impressions, share of voice, brand recall

**Step 4 - Timeframe**: Ask about their planning horizon (quarterly, annual, etc.)

After gathering this info, propose contextUpdates to fill:
- objectives.primaryObjective (text description)
- objectives.primaryBusinessGoal (the category: revenue, leads, awareness, etc.)
- objectives.revenueGoal or objectives.leadGoal (numeric target)
- objectives.kpiLabels (array of KPI names)
- objectives.timeHorizon (quarterly, annual, etc.)

Use confidence 0.85+ for objectives since these are human-provided business decisions.

Example flow:
User: "Help me set my objectives"
You: "Let's define your marketing objectives! First, what's the primary goal you're trying to achieve? Are you focused on:
- 📈 Growing revenue
- 🎯 Generating more leads
- 🌟 Building brand awareness
- 🔄 Improving retention
- 🚀 Something else?"

Then guide them through quantification and KPIs conversationally.`;
  }
}

/**
 * Build the task prompt with user message and context
 */
export function buildTaskPrompt(
  userMessage: string,
  formattedContext: string,
  conversationHistory?: Array<{ type: string; content: string }>
): string {
  let prompt = `## Company Context\n${formattedContext}\n\n`;

  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `## Conversation History\n`;
    conversationHistory.slice(-6).forEach(msg => {
      prompt += `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 500)}\n\n`;
    });
  }

  prompt += `## User Message\n${userMessage}\n\n`;
  prompt += `## Instructions\nRespond to the user's message based on the context provided. Output valid JSON as specified in the system prompt.`;

  return prompt;
}

/**
 * Generate quick action prompts based on context
 */
export function generateQuickActions(context: {
  missingCritical: string[];
  weakSections: string[];
  healthScore: number;
}): Array<{ label: string; prompt: string }> {
  const actions: Array<{ label: string; prompt: string }> = [];

  // Always include general help
  actions.push({
    label: 'What should I focus on?',
    prompt: 'Based on my current context health and gaps, what should I prioritize working on first?',
  });

  // Missing critical fields
  if (context.missingCritical.length > 0) {
    const firstMissing = context.missingCritical[0];
    const domain = firstMissing.split('.')[0];

    if (firstMissing.includes('icpDescription') || firstMissing.includes('primarySegments')) {
      actions.push({
        label: 'Help define my ICP',
        prompt: 'Help me define our Ideal Customer Profile. What information do you need from me?',
      });
    } else if (firstMissing.includes('positioning') || firstMissing.includes('valueProposition')) {
      actions.push({
        label: 'Define our positioning',
        prompt: 'Help me articulate our brand positioning and value proposition.',
      });
    } else if (firstMissing.includes('primaryObjective') || firstMissing.includes('kpis')) {
      actions.push({
        label: 'Set objectives',
        prompt: 'Help me define our primary marketing objectives and KPIs.',
      });
    } else if (firstMissing.includes('Competitor')) {
      actions.push({
        label: 'Map competitors',
        prompt: 'Help me identify and map our competitive landscape.',
      });
    }
  }

  // Weak sections
  if (context.weakSections.includes('competitive')) {
    actions.push({
      label: 'Fill competitive landscape',
      prompt: 'Help me fill in our competitive landscape. Who are our main competitors and how do we differentiate?',
    });
  }

  if (context.weakSections.includes('objectives')) {
    actions.push({
      label: 'Define objectives',
      prompt: 'Help me define our marketing objectives, goals, and success metrics.',
    });
  }

  // Context health based
  if (context.healthScore < 50) {
    actions.push({
      label: 'Improve context health',
      prompt: 'My context health is low. What are the most impactful fields I should fill to improve it?',
    });
  }

  // Add analysis options
  actions.push({
    label: 'Summarize strengths/weaknesses',
    prompt: 'Based on our context and any insights, what are our key marketing strengths and weaknesses?',
  });

  // Dedupe and limit
  const seen = new Set<string>();
  return actions.filter(a => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  }).slice(0, 5);
}

// ============================================================================
// Page-Aware Quick Actions
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

export interface PageQuickActionContext {
  contextHealth?: number;
  weakSections?: string[];
  missingCritical?: string[];
  hasDiagnostics?: boolean;
  hasQbrSnapshot?: boolean;
  hasInsights?: boolean;
}

/**
 * Generate page-specific quick actions based on current page and context
 */
export function getQuickActionsForPage(
  page: PageContextId,
  opts: PageQuickActionContext = {}
): QuickAction[] {
  const actions: QuickAction[] = [];

  switch (page) {
    // =========================================================================
    // Overview
    // =========================================================================
    case 'overview':
      actions.push({
        id: 'overview-focus',
        label: 'What should I focus on first?',
        prompt: 'Based on my context health and current gaps, what should I prioritize working on first to improve my marketing operations?',
      });
      actions.push({
        id: 'overview-strengths',
        label: 'Summarize strengths & weaknesses',
        prompt: 'Based on our context and any insights, provide a concise summary of our key marketing strengths and weaknesses.',
      });
      actions.push({
        id: 'overview-icp',
        label: 'Help define my ICP',
        prompt: 'Help me define our Ideal Customer Profile. What information do you need from me to build a clear ICP?',
      });

      if (opts.contextHealth && opts.contextHealth < 60) {
        actions.push({
          id: 'overview-health',
          label: 'Improve context health',
          prompt: 'My context health is low. What are the most impactful fields I should fill to quickly improve it?',
        });
      }

      if (!opts.hasDiagnostics) {
        actions.push({
          id: 'overview-diagnostic',
          label: 'Which diagnostic should I run first?',
          prompt: 'I haven\'t run any diagnostics yet. Which Lab or analysis should I run first to get the most value?',
        });
      }
      break;

    // =========================================================================
    // Brain → Context
    // =========================================================================
    case 'brain_context':
      // Objectives wizard is prominent if objectives section is weak
      if (opts.weakSections?.includes('objectives') || opts.missingCritical?.some(f => f.startsWith('objectives.'))) {
        actions.push({
          id: 'context-objectives-wizard',
          label: '🎯 Set objectives & KPIs',
          prompt: 'Help me define my marketing objectives and KPIs. Walk me through setting up my goals step by step.',
        });
      }

      actions.push({
        id: 'context-health',
        label: 'Improve context health',
        prompt: 'Analyze my context health and suggest the highest-impact fields to fill or improve.',
      });
      actions.push({
        id: 'context-critical',
        label: 'Fill missing critical fields',
        prompt: 'What critical fields am I missing? Help me fill the most important ones.',
      });

      if (opts.weakSections?.includes('competitive')) {
        actions.push({
          id: 'context-competitive',
          label: 'Fill competitive landscape',
          prompt: 'Help me fill in our competitive landscape. Who are our main competitors and how do we differentiate?',
        });
      }

      actions.push({
        id: 'context-explain',
        label: 'Explain field provenance',
        prompt: 'Explain where my context values came from. Which fields are AI-inferred vs human-entered?',
      });
      break;

    // =========================================================================
    // Brain → Insights
    // =========================================================================
    case 'brain_insights':
      actions.push({
        id: 'insights-themes',
        label: 'Group into strategic themes',
        prompt: 'Group my current insights into 3-5 strategic themes. What patterns do you see?',
      });
      actions.push({
        id: 'insights-priority',
        label: 'Top 5 insights to act on',
        prompt: 'Which 5 insights should we prioritize acting on this quarter? Explain why.',
      });
      actions.push({
        id: 'insights-work',
        label: 'Turn insights into Work items',
        prompt: 'Review my top insights and propose concrete Work items we can execute on.',
      });
      actions.push({
        id: 'insights-gaps',
        label: 'What gaps do insights reveal?',
        prompt: 'What strategic or operational gaps do our insights reveal? What should we address?',
      });
      break;

    // =========================================================================
    // Brain → Library
    // =========================================================================
    case 'brain_library':
      actions.push({
        id: 'library-summarize',
        label: 'Summarize our content strategy',
        prompt: 'Based on our content library and context, summarize our content strategy and key themes.',
      });
      actions.push({
        id: 'library-gaps',
        label: 'Identify content gaps',
        prompt: 'What content gaps exist in our library? What topics or formats should we create?',
      });
      actions.push({
        id: 'library-repurpose',
        label: 'Suggest content to repurpose',
        prompt: 'Which existing content could be repurposed or updated for better performance?',
      });
      break;

    // =========================================================================
    // Blueprint
    // =========================================================================
    case 'blueprint':
      actions.push({
        id: 'blueprint-summarize',
        label: 'Summarize strategy in one page',
        prompt: 'Synthesize our current strategy into a clear one-page summary covering positioning, audience, and priorities.',
      });
      actions.push({
        id: 'blueprint-priorities',
        label: 'Suggest 3 strategic priorities',
        prompt: 'Based on our context and gaps, suggest 3 strategic priorities for next quarter.',
      });
      actions.push({
        id: 'blueprint-consistency',
        label: 'Check for inconsistencies',
        prompt: 'Check our strategy for inconsistencies between positioning, audience targeting, and messaging. Flag any conflicts.',
      });
      actions.push({
        id: 'blueprint-recommend',
        label: 'Recommend next actions',
        prompt: 'What tools or Labs should I run next to strengthen our strategic blueprint?',
      });
      break;

    // =========================================================================
    // QBR
    // =========================================================================
    case 'qbr':
      actions.push({
        id: 'qbr-summary',
        label: 'Draft executive summary',
        prompt: 'Draft an executive summary for this QBR covering key achievements, challenges, and recommendations.',
      });
      actions.push({
        id: 'qbr-performance',
        label: 'Highlight performance vs goals',
        prompt: 'Summarize how we performed against our stated objectives and KPIs.',
      });
      actions.push({
        id: 'qbr-initiatives',
        label: 'Propose 3 key initiatives',
        prompt: 'Based on our performance and insights, propose 3 key initiatives for next quarter.',
      });
      actions.push({
        id: 'qbr-risks',
        label: 'Identify risks & opportunities',
        prompt: 'What risks and opportunities should we highlight in this QBR?',
      });
      break;

    // =========================================================================
    // Setup
    // =========================================================================
    case 'setup':
      actions.push({
        id: 'setup-objective',
        label: 'Help define my objective',
        prompt: 'Help me define our primary marketing objective. What should our main goal be?',
      });
      actions.push({
        id: 'setup-kpis',
        label: 'Help refine my KPIs',
        prompt: 'Help me define the right KPIs to track our marketing success.',
      });
      actions.push({
        id: 'setup-targets',
        label: 'Suggest realistic targets',
        prompt: 'Based on our context and industry, suggest realistic targets for our KPIs.',
      });
      actions.push({
        id: 'setup-basics',
        label: 'What else should I set up?',
        prompt: 'What other basic context should I fill in during setup? Walk me through it.',
      });
      break;

    // =========================================================================
    // Audience Lab
    // =========================================================================
    case 'lab_audience':
      actions.push({
        id: 'audience-icp',
        label: 'Refine our ICP',
        prompt: 'Based on our current context, help me refine our Ideal Customer Profile to be more specific and actionable.',
      });
      actions.push({
        id: 'audience-segments',
        label: 'Check segment alignment',
        prompt: 'Do our audience segments align well with our positioning and value proposition? Flag any mismatches.',
      });
      actions.push({
        id: 'audience-new',
        label: 'Propose 2-3 new segments',
        prompt: 'Based on our market and offering, propose 2-3 new audience segments we should consider testing.',
      });
      actions.push({
        id: 'audience-pains',
        label: 'Deepen pain points',
        prompt: 'Help me articulate deeper, more specific pain points for our primary audience segments.',
      });
      break;

    // =========================================================================
    // Brand Lab
    // =========================================================================
    case 'lab_brand':
      actions.push({
        id: 'brand-pillars',
        label: 'Evaluate brand pillars',
        prompt: 'Evaluate whether our brand pillars are consistent and support our positioning. Suggest improvements.',
      });
      actions.push({
        id: 'brand-positioning',
        label: 'Sharpen positioning statement',
        prompt: 'Help me craft a sharper, more differentiated positioning statement.',
      });
      actions.push({
        id: 'brand-whitespace',
        label: 'Identify messaging whitespace',
        prompt: 'What messaging whitespace exists versus our competitors? What can we uniquely own?',
      });
      actions.push({
        id: 'brand-tone',
        label: 'Refine tone of voice',
        prompt: 'Help me define a clearer, more actionable tone of voice for our brand.',
      });
      break;

    // =========================================================================
    // Creative Lab
    // =========================================================================
    case 'lab_creative':
      actions.push({
        id: 'creative-messages',
        label: 'Strengthen key messages',
        prompt: 'Review our key messages and suggest ways to make them more compelling and differentiated.',
      });
      actions.push({
        id: 'creative-proof',
        label: 'Enhance proof points',
        prompt: 'Help me develop stronger proof points and evidence to support our claims.',
      });
      actions.push({
        id: 'creative-ctas',
        label: 'Optimize CTAs',
        prompt: 'Suggest more compelling CTAs for different stages of the buyer journey.',
      });
      actions.push({
        id: 'creative-headlines',
        label: 'Generate headline variants',
        prompt: 'Generate 5 compelling headline variants for our primary audience segment.',
      });
      break;

    // =========================================================================
    // Competitor Lab
    // =========================================================================
    case 'lab_competitor':
      actions.push({
        id: 'competitor-landscape',
        label: 'Map competitive landscape',
        prompt: 'Help me map out our competitive landscape with direct, indirect, and aspirational competitors.',
      });
      actions.push({
        id: 'competitor-differentiate',
        label: 'How do we differentiate?',
        prompt: 'Based on our competitors, what are our strongest differentiation opportunities?',
      });
      actions.push({
        id: 'competitor-threats',
        label: 'Assess competitive threats',
        prompt: 'Which competitors pose the biggest threat and why? What should we watch for?',
      });
      actions.push({
        id: 'competitor-gaps',
        label: 'Find market whitespace',
        prompt: 'What whitespace opportunities exist in our market that competitors aren\'t addressing?',
      });
      break;

    // =========================================================================
    // Website Lab
    // =========================================================================
    case 'lab_website':
      actions.push({
        id: 'website-audit',
        label: 'Summarize website issues',
        prompt: 'Summarize the key issues with our website based on the diagnostic results.',
      });
      actions.push({
        id: 'website-priorities',
        label: 'Prioritize fixes',
        prompt: 'What website fixes should we prioritize to have the biggest impact on conversions?',
      });
      actions.push({
        id: 'website-messaging',
        label: 'Improve homepage messaging',
        prompt: 'How can we improve our homepage messaging to better communicate our value proposition?',
      });
      break;

    // =========================================================================
    // Media Lab
    // =========================================================================
    case 'lab_media':
      actions.push({
        id: 'media-channels',
        label: 'Recommend channels',
        prompt: 'Based on our audience and objectives, which paid media channels should we prioritize?',
      });
      actions.push({
        id: 'media-budget',
        label: 'Suggest budget allocation',
        prompt: 'How should we allocate our media budget across channels for maximum impact?',
      });
      actions.push({
        id: 'media-creative',
        label: 'Suggest ad creative themes',
        prompt: 'What creative themes and messaging angles should we test in our paid campaigns?',
      });
      break;

    // =========================================================================
    // Unknown / Fallback
    // =========================================================================
    case 'unknown':
    default:
      actions.push({
        id: 'fallback-focus',
        label: 'What should I focus on next?',
        prompt: 'Based on my current context and gaps, what should I focus on next?',
      });
      actions.push({
        id: 'fallback-summarize',
        label: 'Summarize this company',
        prompt: 'Give me a quick summary of this company\'s marketing situation, strengths, and key gaps.',
      });
      if (opts.contextHealth && opts.contextHealth < 60) {
        actions.push({
          id: 'fallback-health',
          label: 'Improve context health',
          prompt: 'My context health is low. What should I fill in first?',
        });
      }
      break;
  }

  // Always include a generic helpful action at the end if we have room
  if (actions.length < 4) {
    actions.push({
      id: 'general-help',
      label: 'Help me with something else',
      prompt: 'What can you help me with on this page?',
    });
  }

  // Limit to 5 actions max
  return actions.slice(0, 5);
}

/**
 * Get a page-specific system prompt hint for the AI
 */
export function getPageContextHint(page: PageContextId): string {
  const hints: Record<PageContextId, string> = {
    overview: 'The user is on the OVERVIEW page - a high-level dashboard of their company. Focus on prioritization and quick wins.',
    blueprint: 'The user is on the BLUEPRINT page - viewing their strategic plan. Help with strategy synthesis and consistency checks.',
    brain_context: 'The user is on BRAIN → CONTEXT - viewing/editing their Context Graph. Focus on field completeness, provenance, and data quality.',
    brain_insights: 'The user is on BRAIN → INSIGHTS - viewing extracted insights. Help synthesize, prioritize, and action insights.',
    brain_library: 'The user is on BRAIN → LIBRARY - viewing content assets. Help with content strategy and gap analysis.',
    qbr: 'The user is on the QBR page - preparing a Quarterly Business Review. Focus on performance summaries and recommendations.',
    setup: 'The user is on SETUP - configuring basic company context. Guide them through defining objectives, KPIs, and core identity.',
    lab_audience: 'The user is in AUDIENCE LAB - refining audience/ICP data. Focus on segment clarity, pain points, and targeting.',
    lab_brand: 'The user is in BRAND LAB - refining brand positioning. Focus on differentiation, messaging pillars, and tone.',
    lab_creative: 'The user is in CREATIVE LAB - refining creative messaging. Focus on key messages, proof points, and CTAs.',
    lab_competitor: 'The user is in COMPETITOR LAB - analyzing competition. Focus on competitive positioning, threats, and whitespace.',
    lab_website: 'The user is in WEBSITE LAB - analyzing their website. Focus on conversion optimization and messaging clarity.',
    lab_media: 'The user is in MEDIA LAB - planning paid media. Focus on channel strategy, budget allocation, and creative.',
    unknown: 'The user is viewing company context.',
  };

  return hints[page] || hints.unknown;
}
