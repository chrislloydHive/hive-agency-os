// lib/os/tools/definitions.ts
// OS Tool Definitions Registry
//
// This is the SINGLE SOURCE OF TRUTH for all OS tool definitions visible in
// the Diagnostics & Tools grid. All new tools must be defined here first so
// the OS can auto-render them in Diagnostics & Tools and Blueprint.
//
// This registry provides rich metadata for each tool including:
// - Strategic impact and recommended run order
// - Run time estimates and frequency hints
// - Key questions each tool answers
// - Primary outputs and system influences
//
// For runtime tool behavior (API paths, view paths, etc.), see lib/tools/registry.ts

// ============================================================================
// Types
// ============================================================================

/**
 * Tool impact level for strategic planning
 */
export type ToolImpact = 'foundational' | 'high' | 'medium' | 'exploratory';

/**
 * Tool availability status
 */
export type ToolStatus = 'available' | 'locked' | 'comingSoon';

/**
 * Tool kind for categorization
 */
export type ToolKind = 'gap' | 'lab' | 'analytics' | 'other';

/**
 * Recommended run order in the diagnostic workflow
 */
export type RecommendedOrder = 'runFirst' | 'runNext' | 'runAfterLabs' | 'asNeeded';

/**
 * System areas that a tool influences
 */
export type ToolInfluence = 'Strategy' | 'Blueprint Focus' | 'Work' | 'Brain' | 'Analytics';

/**
 * Complete OS Tool Definition
 *
 * Rich metadata for each diagnostic tool including strategic context,
 * timing recommendations, and system integration points.
 */
export interface OsToolDefinition {
  /** Unique identifier (kebab-case): "gap-ia", "full-gap", "website-lab", etc. */
  id: string;

  /** Human-readable name: "GAP IA", "Full GAP", "Website Lab", etc. */
  name: string;

  /** Tool category: gap, lab, analytics, other */
  kind: ToolKind;

  /** When to run this tool in the diagnostic workflow */
  recommendedOrder: RecommendedOrder;

  /** Strategic impact level */
  impact: ToolImpact;

  /** Estimated run time (human-readable): "~2–3 min" */
  estimatedRunTime: string;

  /** When to run hint: "Run monthly", "Run after major site changes" */
  frequencyHint: string;

  /** One-line summary for card display */
  shortSummary: string;

  /** Detailed summary for tooltips and detail views */
  detailedSummary: string;

  /** The key question this tool helps answer */
  helpsAnswer: string;

  /** Primary outputs/deliverables from the tool */
  primaryOutputs: string[];

  /** What parts of the system this tool influences */
  influences: ToolInfluence[];

  /** Optional requirements to run the tool */
  requirements?: string[];

  /** Current availability status */
  status: ToolStatus;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * All OS Tool Definitions
 *
 * This array contains every tool that appears in the Diagnostics & Tools grid.
 * Tools are ordered by their recommended run sequence.
 */
export const OS_TOOL_DEFINITIONS: OsToolDefinition[] = [
  // ==========================================================================
  // GAP Tools (Strategic Assessment)
  // ==========================================================================
  {
    id: 'gap-ia',
    name: 'GAP IA',
    kind: 'gap',
    recommendedOrder: 'runFirst',
    impact: 'foundational',
    estimatedRunTime: '~2–3 min',
    frequencyHint: 'Run whenever you add a new company or after a major website change.',
    shortSummary: 'Fast, URL-only marketing health snapshot.',
    detailedSummary:
      'GAP IA gives you a fast, AI-powered snapshot of how this company is performing across brand clarity, website effectiveness, content depth, and SEO fundamentals—using just a URL.',
    helpsAnswer:
      'How strong is this company\'s overall marketing foundation right now?',
    primaryOutputs: [
      'Marketing Maturity Score',
      'Top strengths & gaps',
      'High-level improvement opportunities',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
    status: 'available',
  },
  {
    id: 'full-gap',
    name: 'Full GAP',
    kind: 'gap',
    recommendedOrder: 'runAfterLabs',
    impact: 'high',
    estimatedRunTime: '~15–20 min',
    frequencyHint: 'Run for serious prospects/clients and refresh a few times per year.',
    shortSummary: 'Full Growth Acceleration Plan across all channels.',
    detailedSummary:
      'Full GAP turns diagnostics, analytics, and context into a structured Growth Acceleration Plan—covering brand, web, content, demand, and ops with a clear roadmap.',
    helpsAnswer:
      'What is our full, prioritized growth plan across brand, web, content, demand, and ops?',
    primaryOutputs: [
      'Full Growth Acceleration Plan',
      'Prioritized roadmap',
      'Channel-by-channel strategy recommendations',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
    status: 'available',
  },
  {
    id: 'gap-heavy',
    name: 'GAP Heavy',
    kind: 'gap',
    recommendedOrder: 'runAfterLabs',
    impact: 'high',
    estimatedRunTime: '~10–15 min',
    frequencyHint: 'Run for high-value companies when you need deep competitive intelligence.',
    shortSummary: 'Deep competitive & category intelligence scan.',
    detailedSummary:
      'GAP Heavy analyzes competitors, category, search visibility, local/social signals, and funnel gaps to reveal where competitors are winning and where the biggest growth opportunities are.',
    helpsAnswer:
      'How does this company compare to competitors, and where are the biggest opportunities to win?',
    primaryOutputs: [
      'Competitor landscape',
      'Search & visibility map',
      'Strategic priorities and opportunity zones',
      'Funnel and category gaps',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain', 'Analytics'],
    status: 'available',
  },

  // ==========================================================================
  // Lab Tools (Deep Diagnostics)
  // ==========================================================================
  {
    id: 'website-lab',
    name: 'Website Lab',
    kind: 'lab',
    recommendedOrder: 'runNext',
    impact: 'high',
    estimatedRunTime: '~5–8 min',
    frequencyHint: 'Run after major site changes or at least quarterly.',
    shortSummary: 'Deep UX & conversion analysis across key pages.',
    detailedSummary:
      'Website Lab runs a multi-page UX & conversion analysis to assess structure, clarity, navigation, CTAs, and friction across the core funnel.',
    helpsAnswer:
      'How well does the website guide visitors to take action, and where is the funnel breaking?',
    primaryOutputs: [
      'Website & conversion score',
      'UX and funnel issues',
      'Quick wins to improve conversion',
      'Project ideas for redesign or testing',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work'],
    status: 'available',
  },
  {
    id: 'seo-lab',
    name: 'SEO Lab',
    kind: 'lab',
    recommendedOrder: 'runNext',
    impact: 'high',
    estimatedRunTime: '~5–10 min',
    frequencyHint: 'Run monthly or after major content / structure changes.',
    shortSummary: 'On-site SEO and search performance lab.',
    detailedSummary:
      'SEO Lab combines on-site SEO analysis with search performance and visibility signals to produce dual scores, maturity stage, and prioritized SEO work.',
    helpsAnswer:
      'Is this site set up to be found in search, and how well is it actually performing today?',
    primaryOutputs: [
      'On-site SEO score',
      'Search performance score',
      'SEO maturity stage',
      'Prioritized SEO issues, quick wins, and projects',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Analytics'],
    requirements: ['Connect Search Console (recommended)'],
    status: 'available',
  },
  {
    id: 'brand-lab',
    name: 'Brand Lab',
    kind: 'lab',
    recommendedOrder: 'runNext',
    impact: 'high',
    estimatedRunTime: '~3–5 min',
    frequencyHint: 'Run when repositioning or before major campaigns.',
    shortSummary: 'Brand clarity, positioning, and proof lab.',
    detailedSummary:
      'Brand Lab evaluates how clearly the brand shows up across the site and key touchpoints—positioning, promise, proof, and differentiation.',
    helpsAnswer:
      'Is the brand clear, credible, and differentiated enough to support growth?',
    primaryOutputs: [
      'Brand clarity & strength assessment',
      'Positioning and message gaps',
      'Proof and trust-building opportunities',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Brain'],
    status: 'available',
  },
  {
    id: 'content-lab',
    name: 'Content Lab',
    kind: 'lab',
    recommendedOrder: 'runNext',
    impact: 'high',
    estimatedRunTime: '~3–5 min',
    frequencyHint: 'Run for content-heavy companies or before content sprints.',
    shortSummary: 'Analyzes your content inventory, quality, depth, freshness, and content-driven search signals.',
    detailedSummary:
      'Content Lab evaluates your content across 5 dimensions: inventory & presence, quality & messaging, depth & coverage, freshness, and content-powered SEO signals. Returns maturity stage, scored dimensions, quick wins, and strategic projects.',
    helpsAnswer:
      'Do we have enough of the right content to educate, nurture, and convert our best customers?',
    primaryOutputs: [
      'Content maturity score (0-100)',
      '5 dimension scores with issues',
      'Quick wins for immediate action',
      'Strategic projects for deeper improvement',
      'Topic clusters and content inventory',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
    status: 'available',
  },
  {
    id: 'demand-lab',
    name: 'Demand Lab',
    kind: 'lab',
    recommendedOrder: 'runNext',
    impact: 'high',
    estimatedRunTime: '~3–5 min',
    frequencyHint: 'Run when planning or optimizing paid/organic demand programs.',
    shortSummary: 'Demand gen across 5 dimensions with quick wins & projects.',
    detailedSummary:
      'Demand Lab evaluates demand generation across 5 dimensions: channel mix, targeting, creative, funnel architecture, and measurement. Returns maturity stage, scored dimensions, quick wins, and strategic projects.',
    helpsAnswer:
      'How mature is our demand generation engine and what are the biggest gaps holding back growth?',
    primaryOutputs: [
      'Demand maturity score (0-100)',
      '5 dimension scores with issues',
      'Quick wins for immediate action',
      'Strategic projects for deeper improvement',
      'Analytics snapshot (if connected)',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Analytics'],
    status: 'available',
  },
  {
    id: 'ops-lab',
    name: 'Ops Lab',
    kind: 'lab',
    recommendedOrder: 'runNext',
    impact: 'medium',
    estimatedRunTime: '~3–5 min',
    frequencyHint:
      'Run when evaluating marketing tech stack, scaling operations, or assessing analytics maturity.',
    shortSummary: 'Marketing operations & analytics readiness across 5 dimensions.',
    detailedSummary:
      'Ops Lab evaluates marketing operations readiness across 5 dimensions: tracking & instrumentation, data quality & governance, CRM & pipeline hygiene, automation & journeys, and experimentation & optimization. Returns maturity stage, scored dimensions, quick wins, and strategic projects.',
    helpsAnswer:
      'Is this company set up to measure, automate, and scale what marketing is doing?',
    primaryOutputs: [
      'Ops maturity score (0-100)',
      '5 dimension scores with evidence',
      'Stack & signals (GA4, GTM, CRM, automation tools)',
      'Quick wins for immediate action',
      'Strategic projects for deeper improvement',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Analytics'],
    status: 'available',
  },

  // ==========================================================================
  // Analytics Tools
  // ==========================================================================
  {
    id: 'analytics-scan',
    name: 'Analytics Scan',
    kind: 'analytics',
    recommendedOrder: 'asNeeded',
    impact: 'medium',
    estimatedRunTime: '~3–5 min',
    frequencyHint: 'Run monthly or before strategic reviews.',
    shortSummary: 'GA4/GSC-driven performance and trend review.',
    detailedSummary:
      'Analytics Scan pulls in GA4/Search Console data to highlight key trends, bottlenecks, and anomalies, feeding directly into Blueprint and Work.',
    helpsAnswer:
      'What is actually happening in the data—traffic, behavior, and outcomes—and where is performance stuck or breaking down?',
    primaryOutputs: [
      'Key trends & anomalies',
      'Channel performance insights',
      'Conversion bottlenecks',
      'Suggested work items',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Analytics'],
    requirements: ['Connect GA4', 'Connect Search Console (recommended)'],
    status: 'available',
  },

  // ==========================================================================
  // Strategic Tools
  // ==========================================================================
  {
    id: 'media-lab',
    name: 'Media Lab',
    kind: 'other',
    recommendedOrder: 'asNeeded',
    impact: 'high',
    estimatedRunTime: '~5–10 min',
    frequencyHint: 'Run when planning or optimizing paid media programs.',
    shortSummary: 'AI-powered media strategy planner with channel mix and budgets.',
    detailedSummary:
      'Media Lab designs AI-powered media strategies with channel recommendations, budget allocation, and performance forecasts. Compare scenarios and promote plans into active media programs.',
    helpsAnswer:
      'What is the optimal media mix and budget allocation to achieve our marketing objectives?',
    primaryOutputs: [
      'Channel mix recommendations',
      'Budget allocation plan',
      'Performance forecasts',
      'Scenario comparisons',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work'],
    status: 'available',
  },
  {
    id: 'audience-lab',
    name: 'Audience Lab',
    kind: 'other',
    recommendedOrder: 'asNeeded',
    impact: 'high',
    estimatedRunTime: '~5–10 min',
    frequencyHint: 'Run when defining or refining target audiences and personas.',
    shortSummary: 'Define audience segments and personas for targeting and messaging.',
    detailedSummary:
      'Audience Lab helps define and manage audience segments and personas. AI-powered generation from diagnostic signals, with packs for Media Lab and Creative briefs.',
    helpsAnswer:
      'Who are our target audiences and how should we speak to them?',
    primaryOutputs: [
      'Audience segments',
      'Persona profiles',
      'Targeting recommendations',
      'Messaging guidance',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Brain'],
    status: 'available',
  },
  {
    id: 'creative-lab',
    name: 'Creative Lab',
    kind: 'lab',
    recommendedOrder: 'asNeeded',
    impact: 'high',
    estimatedRunTime: '~5–10 min',
    frequencyHint: 'Run when developing campaigns, refreshing brand messaging, or planning ad creative.',
    shortSummary: 'AI-powered creative strategy with messaging, territories, and campaign concepts.',
    detailedSummary:
      'Creative Lab generates a complete creative strategy including messaging architecture, creative territories, campaign concepts, channel-specific patterns, testing roadmaps, and production-ready asset specs. Integrates with Brand Lab guardrails and Strategic Plan alignment.',
    helpsAnswer:
      'What should our messaging say, how should it look, and what campaigns should we run?',
    primaryOutputs: [
      'Messaging architecture',
      'Creative territories',
      'Campaign concepts',
      'Channel-specific patterns',
      'Testing roadmap',
      'Asset specs for production',
    ],
    influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
    status: 'available',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a tool definition by its ID
 */
export function getOsToolById(toolId: string): OsToolDefinition | undefined {
  return OS_TOOL_DEFINITIONS.find((tool) => tool.id === toolId);
}

/**
 * Get all available tools (status !== 'comingSoon')
 */
export function getAvailableOsTools(): OsToolDefinition[] {
  return OS_TOOL_DEFINITIONS.filter((tool) => tool.status !== 'comingSoon');
}

/**
 * Get all coming soon tools
 */
export function getComingSoonOsTools(): OsToolDefinition[] {
  return OS_TOOL_DEFINITIONS.filter((tool) => tool.status === 'comingSoon');
}

/**
 * Get tools by kind
 */
export function getOsToolsByKind(kind: ToolKind): OsToolDefinition[] {
  return OS_TOOL_DEFINITIONS.filter((tool) => tool.kind === kind);
}

/**
 * Get tools by impact level
 */
export function getOsToolsByImpact(impact: ToolImpact): OsToolDefinition[] {
  return OS_TOOL_DEFINITIONS.filter((tool) => tool.impact === impact);
}

/**
 * Get tools that should be run first (foundational tools)
 */
export function getFoundationalOsTools(): OsToolDefinition[] {
  return OS_TOOL_DEFINITIONS.filter((tool) => tool.recommendedOrder === 'runFirst');
}

/**
 * Get tools that should be run next (after foundational)
 */
export function getNextOsTools(): OsToolDefinition[] {
  return OS_TOOL_DEFINITIONS.filter((tool) => tool.recommendedOrder === 'runNext');
}

/**
 * Map from OsToolDefinition.id to CompanyToolId (from lib/tools/registry.ts)
 * This provides compatibility between the two registries
 */
export function osToolIdToCompanyToolId(osToolId: string): string | undefined {
  const mapping: Record<string, string> = {
    'gap-ia': 'gapIa',
    'full-gap': 'gapPlan',
    'gap-heavy': 'gapHeavy',
    'website-lab': 'websiteLab',
    'seo-lab': 'seoLab',
    'brand-lab': 'brandLab',
    'content-lab': 'contentLab',
    'demand-lab': 'demandLab',
    'ops-lab': 'opsLab',
    'analytics-scan': 'analyticsScan',
    'media-lab': 'mediaLab',
    'audience-lab': 'audienceLab',
    'creative-lab': 'creativeLab',
  };
  return mapping[osToolId];
}

/**
 * Map from CompanyToolId to OsToolDefinition.id
 */
export function companyToolIdToOsToolId(companyToolId: string): string | undefined {
  const mapping: Record<string, string> = {
    gapIa: 'gap-ia',
    gapPlan: 'full-gap',
    gapHeavy: 'gap-heavy',
    websiteLab: 'website-lab',
    seoLab: 'seo-lab',
    brandLab: 'brand-lab',
    contentLab: 'content-lab',
    demandLab: 'demand-lab',
    opsLab: 'ops-lab',
    analyticsScan: 'analytics-scan',
    mediaLab: 'media-lab',
    audienceLab: 'audience-lab',
    creativeLab: 'creative-lab',
  };
  return mapping[companyToolId];
}

/**
 * Get color classes for tool impact
 */
export function getImpactColorClasses(impact: ToolImpact): string {
  switch (impact) {
    case 'foundational':
      return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
    case 'high':
      return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    case 'medium':
      return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
    case 'exploratory':
      return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
  }
}

/**
 * Get color classes for tool status
 */
export function getStatusColorClasses(status: ToolStatus): string {
  switch (status) {
    case 'available':
      return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    case 'locked':
      return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
    case 'comingSoon':
      return 'text-slate-400 border-slate-400/30 bg-slate-400/10';
  }
}

/**
 * Get icon name for a tool (maps to existing ToolIcon type)
 */
export function getToolIconName(toolId: string): string {
  const iconMapping: Record<string, string> = {
    'gap-ia': 'zap',
    'full-gap': 'fileText',
    'gap-heavy': 'layers',
    'website-lab': 'globe',
    'seo-lab': 'search',
    'brand-lab': 'sparkles',
    'content-lab': 'fileEdit',
    'demand-lab': 'trendingUp',
    'ops-lab': 'settings',
    'analytics-scan': 'barChart',
    'media-lab': 'tv',
    'audience-lab': 'users',
    'creative-lab': 'sparkles',
  };
  return iconMapping[toolId] || 'zap';
}
