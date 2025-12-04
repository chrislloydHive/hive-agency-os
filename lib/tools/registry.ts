// lib/tools/registry.ts
// Unified Tool Registry for Hive OS
//
// This is the SINGLE SOURCE OF TRUTH for all company-level tools.
// All tools that can run on a Company are defined here, including:
// - Strategic assessments (GAP IA, Full GAP, GAP Heavy)
// - Diagnostic labs (Website, Brand, Content, SEO, Demand, Ops)
// - Analytics tools
//
// This replaces both:
// - lib/os/diagnostics/tools.ts (DIAGNOSTIC_TOOLS)
// - lib/tools/companyTools.ts (COMPANY_TOOLS)

import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Types
// ============================================================================

/**
 * Unified tool identifier for all company-level tools
 */
export type CompanyToolId =
  | 'gapIa'          // GAP Initial Assessment (quick snapshot)
  | 'gapPlan'        // Full GAP Plan (comprehensive)
  | 'gapHeavy'       // GAP Heavy (deep multi-source)
  | 'websiteLab'     // Website UX/Conversion Lab
  | 'brandLab'       // Brand Health Lab
  | 'contentLab'     // Content Strategy Lab
  | 'seoLab'         // SEO Lab (deep SEO + GSC + analytics)
  | 'demandLab'      // Demand Generation Lab
  | 'opsLab'         // Marketing Operations Lab
  | 'analyticsScan'  // Analytics Scan (GA4 + GSC)
  | 'mediaLab';      // Media Lab (AI media planner)

/**
 * Tool category for grouping in the UI
 */
export type ToolCategory =
  | 'Strategic Assessment'
  | 'Website & UX'
  | 'Brand & Positioning'
  | 'Content & Messaging'
  | 'SEO & Search'
  | 'Demand Generation'
  | 'Marketing Ops'
  | 'Analytics'
  | 'Media & Advertising';

/**
 * Tool section for high-level grouping in the Tools hub
 * - diagnostic: Assessment and analysis tools (run on company data)
 * - strategic: Planning and strategy tools (design forward-looking plans)
 */
export type ToolSection = 'diagnostic' | 'strategic';

/**
 * Tool behavior type
 * - diagnosticRun: Creates a DiagnosticRun record, runs via API
 * - openRoute: Simply navigates to another page (e.g., Analytics)
 */
export type ToolBehavior = 'diagnosticRun' | 'openRoute';

/**
 * Tool status for UI display
 */
export type ToolStatus = 'enabled' | 'comingSoon' | 'beta';

/**
 * Icon identifier for tools
 */
export type ToolIcon =
  | 'zap'        // Quick/fast tools
  | 'fileText'   // Document/plan tools
  | 'layers'     // Multi-layer/deep tools
  | 'globe'      // Website tools
  | 'sparkles'   // Brand/creative tools
  | 'fileEdit'   // Content tools
  | 'search'     // SEO/search tools
  | 'trendingUp' // Growth/demand tools
  | 'settings'   // Operations tools
  | 'barChart'   // Analytics tools
  | 'tv';        // Media/advertising tools

/**
 * Blueprint-specific metadata for tool recommendations
 * Used by the strategy engine to explain WHY each tool matters
 */
export interface BlueprintToolMeta {
  /** Short explanation in plain language of why to run this tool */
  whyRun: string;
  /** Key strategic question this tool answers */
  answersQuestion: string;
  /** What this tool influences in the system */
  influences: ('Strategy' | 'Blueprint Focus' | 'Work' | 'Brain' | 'Analytics')[];
  /** What inputs/data sources this tool uses */
  inputs: ('Website' | 'Content' | 'SEO' | 'Analytics' | 'GAP IA' | 'Social' | 'Competitors')[];
  /** When you should typically run this tool */
  typicalUseWhen: string;
}

/**
 * Complete tool definition
 */
export interface CompanyToolDefinition {
  /** Unique identifier for the tool */
  id: CompanyToolId;

  /** Human-readable label (e.g., "GAP IA") */
  label: string;

  /** Short label for compact displays */
  shortLabel?: string;

  /** Description of what the tool does */
  description: string;

  /** Category for grouping in the UI */
  category: ToolCategory;

  /** Section for high-level grouping (diagnostic vs strategic) */
  section: ToolSection;

  /** How the tool behaves when activated */
  behavior: ToolBehavior;

  /** Current status of the tool */
  status: ToolStatus;

  // -------------------------------------------------------------------------
  // For diagnosticRun tools
  // -------------------------------------------------------------------------

  /** Maps to DiagnosticRuns.toolId - required for diagnosticRun behavior */
  diagnosticToolId?: DiagnosticToolId;

  /** API endpoint for running the tool */
  runApiPath?: string;

  /** URL slug for the tool (used in routes like /reports/{toolSlug}/{runId}) */
  urlSlug?: string;

  /** Function to generate the view/report path */
  viewPath?: (companyId: string, runId?: string) => string;

  // -------------------------------------------------------------------------
  // For openRoute tools
  // -------------------------------------------------------------------------

  /** Path to open when tool is activated (for openRoute behavior) */
  openPath?: (companyId: string) => string;

  // -------------------------------------------------------------------------
  // Common metadata
  // -------------------------------------------------------------------------

  /** Whether the tool requires a website URL to run */
  requiresWebsite?: boolean;

  /** Estimated time to complete in minutes */
  estimatedMinutes?: number;

  /** Icon identifier */
  icon: ToolIcon;

  /** Label for the primary action button */
  primaryActionLabel?: string;

  /** Blueprint-specific metadata for intelligent recommendations */
  blueprintMeta?: BlueprintToolMeta;
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All company-level tools in Hive OS
 */
export const COMPANY_TOOL_DEFS: CompanyToolDefinition[] = [
  // ==========================================================================
  // Strategic Assessment
  // ==========================================================================
  {
    id: 'gapIa',
    label: 'GAP IA',
    shortLabel: 'IA',
    description: 'Quick AI-powered marketing assessment across brand, website, content, and SEO. Great for prospects and initial evaluations.',
    category: 'Strategic Assessment',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'gapSnapshot',
    runApiPath: '/api/os/diagnostics/run/gap-snapshot',
    urlSlug: 'gap-ia',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/gap-ia/${runId}` : `/c/${companyId}/diagnostics?tool=gapIa`,
    requiresWebsite: true,
    estimatedMinutes: 2,
    icon: 'zap',
    primaryActionLabel: 'Run Assessment',
    blueprintMeta: {
      whyRun: 'Get a quick baseline of marketing health across brand, website, content, and SEO in under 2 minutes.',
      answersQuestion: 'What are the biggest gaps in this company\'s marketing foundation?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
      inputs: ['Website', 'Content', 'SEO'],
      typicalUseWhen: 'Starting with a new company, onboarding a prospect, or when you need a quick health check.',
    },
  },
  {
    id: 'gapPlan',
    label: 'Full GAP',
    shortLabel: 'Full',
    description: 'Comprehensive Growth Acceleration Plan with strategic initiatives, quick wins, and 90-day roadmap.',
    category: 'Strategic Assessment',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'gapPlan',
    runApiPath: '/api/os/diagnostics/run/gap-plan',
    urlSlug: 'gap-plan',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/gap-plan/${runId}` : `/c/${companyId}/diagnostics?tool=gapPlan`,
    requiresWebsite: true,
    estimatedMinutes: 5,
    icon: 'fileText',
    primaryActionLabel: 'Generate Plan',
    blueprintMeta: {
      whyRun: 'Generate a complete 90-day growth plan with strategic initiatives, quick wins, and prioritized actions.',
      answersQuestion: 'What should be the strategic priorities and 90-day roadmap for this company?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
      inputs: ['Website', 'Content', 'SEO', 'GAP IA'],
      typicalUseWhen: 'After GAP IA confirms issues, when building a quarterly plan, or when strategy needs a refresh.',
    },
  },
  {
    id: 'gapHeavy',
    label: 'GAP Heavy',
    shortLabel: 'Heavy',
    description: 'Deep multi-source marketing diagnostic. Analyzes competitors, sitemap, social presence, and analytics for comprehensive insights.',
    category: 'Strategic Assessment',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'gapHeavy',
    runApiPath: '/api/tools/gap-heavy/run',
    urlSlug: 'gap-heavy',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/gap-heavy/${runId}` : `/c/${companyId}/diagnostics?tool=gapHeavy`,
    requiresWebsite: true,
    estimatedMinutes: 10,
    icon: 'layers',
    primaryActionLabel: 'Run Heavy Diagnostic',
    blueprintMeta: {
      whyRun: 'Get deep competitive intelligence and multi-source analysis including social, sitemap, and competitor data.',
      answersQuestion: 'How does this company compare to competitors and what are the hidden growth opportunities?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain', 'Analytics'],
      inputs: ['Website', 'Content', 'SEO', 'Social', 'Competitors', 'Analytics'],
      typicalUseWhen: 'For strategic planning, competitive analysis, or when you need the most comprehensive view.',
    },
  },

  // ==========================================================================
  // Website & UX
  // ==========================================================================
  {
    id: 'websiteLab',
    label: 'Website Lab',
    shortLabel: 'Website',
    description: 'Multi-page UX & conversion diagnostic. Evaluates page structure, CTAs, messaging clarity, and conversion optimization.',
    category: 'Website & UX',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'websiteLab',
    runApiPath: '/api/os/diagnostics/run/website-lab',
    urlSlug: 'website-lab',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/website-lab/${runId}` : `/c/${companyId}/diagnostics?tool=websiteLab`,
    requiresWebsite: true,
    estimatedMinutes: 4,
    icon: 'globe',
    primaryActionLabel: 'Run Website Diagnostic',
    blueprintMeta: {
      whyRun: 'Evaluate website UX, conversion paths, CTAs, and messaging clarity across multiple pages.',
      answersQuestion: 'Is the website effectively converting visitors and communicating value?',
      influences: ['Strategy', 'Blueprint Focus', 'Work'],
      inputs: ['Website'],
      typicalUseWhen: 'Conversion rates are low, after website changes, or when evaluating user experience.',
    },
  },

  // ==========================================================================
  // Brand & Positioning
  // ==========================================================================
  {
    id: 'brandLab',
    label: 'Brand Lab',
    shortLabel: 'Brand',
    description: 'Brand health, clarity, differentiation, and positioning analysis. Evaluates brand coherence, differentiation, and market positioning.',
    category: 'Brand & Positioning',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'brandLab',
    runApiPath: '/api/os/diagnostics/run/brand-lab',
    urlSlug: 'brand-lab',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/brand-lab/${runId}` : `/c/${companyId}/diagnostics?tool=brandLab`,
    requiresWebsite: true,
    estimatedMinutes: 3,
    icon: 'sparkles',
    primaryActionLabel: 'Run Brand Diagnostic',
    blueprintMeta: {
      whyRun: 'Analyze brand clarity, differentiation, and positioning relative to the market.',
      answersQuestion: 'Is the brand clearly differentiated and compelling to the target audience?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
      inputs: ['Website', 'Content'],
      typicalUseWhen: 'Brand feels unclear, after rebranding, or when differentiation needs strengthening.',
    },
  },

  // ==========================================================================
  // Content & Messaging
  // ==========================================================================
  {
    id: 'contentLab',
    label: 'Content Lab',
    shortLabel: 'Content',
    description: 'Content inventory, quality, depth, freshness, and SEO signals diagnostic. Analyzes blog, resources, case studies, and content strategy with 5 scored dimensions.',
    category: 'Content & Messaging',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'contentLab',
    runApiPath: '/api/os/diagnostics/run/content-lab',
    urlSlug: 'content-lab',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/content-lab/${runId}` : `/c/${companyId}/diagnostics/content`,
    requiresWebsite: true,
    estimatedMinutes: 3,
    icon: 'fileEdit',
    primaryActionLabel: 'Run Content Lab',
    blueprintMeta: {
      whyRun: 'Evaluate content across 5 dimensions: inventory, quality, depth, freshness, and SEO signals. Get a maturity score and actionable quick wins.',
      answersQuestion: 'How mature is our content engine and what are the biggest gaps holding back organic growth?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain'],
      inputs: ['Website', 'Content', 'SEO'],
      typicalUseWhen: 'Content feels stale, organic traffic is declining, or planning a content refresh.',
    },
  },

  // ==========================================================================
  // SEO & Search
  // ==========================================================================
  {
    id: 'seoLab',
    label: 'SEO Lab',
    shortLabel: 'SEO',
    description: 'Comprehensive SEO diagnostic combining website crawl, technical analysis, GSC data, and issue tracking with work item creation.',
    category: 'SEO & Search',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'seoLab',
    runApiPath: '/api/os/diagnostics/run/seo-lab',
    urlSlug: 'seo-lab',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/seo-lab/${runId}` : `/c/${companyId}/diagnostics?tool=seoLab`,
    requiresWebsite: true,
    estimatedMinutes: 5,
    icon: 'search',
    primaryActionLabel: 'Run SEO Lab',
    blueprintMeta: {
      whyRun: 'Get a comprehensive SEO analysis with subscores, issue tracking, GSC analytics, quick wins, and projects - all actionable with one-click work item creation.',
      answersQuestion: 'What are all the SEO issues affecting this site and how should we prioritize fixing them?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Brain', 'Analytics'],
      inputs: ['Website', 'Content', 'SEO', 'Analytics'],
      typicalUseWhen: 'Need deep SEO insights, planning an SEO project, or when organic performance needs a comprehensive audit.',
    },
  },

  // ==========================================================================
  // Demand Generation
  // ==========================================================================
  {
    id: 'demandLab',
    label: 'Demand Lab',
    shortLabel: 'Demand',
    description: 'Company-type aware demand generation diagnostic across 5 dimensions: channel mix, targeting, creative, funnel, and measurement. Includes quick wins, projects, and maturity scoring.',
    category: 'Demand Generation',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'demandLab',
    runApiPath: '/api/os/diagnostics/run/demand-lab',
    urlSlug: 'demand-lab',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/demand/${runId}` : `/c/${companyId}/diagnostics/demand`,
    requiresWebsite: true,
    estimatedMinutes: 3,
    icon: 'trendingUp',
    primaryActionLabel: 'Run Demand Lab',
    blueprintMeta: {
      whyRun: 'Evaluate demand generation across channel mix, targeting, creative, funnel architecture, and measurement with company-type aware scoring. Get a maturity score and actionable quick wins.',
      answersQuestion: 'How mature is the demand generation engine and what are the biggest gaps for this business model?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Analytics'],
      inputs: ['Website', 'Analytics'],
      typicalUseWhen: 'Lead volume is low, conversion rates are dropping, or when evaluating demand generation maturity.',
    },
  },

  // ==========================================================================
  // Marketing Ops
  // ==========================================================================
  {
    id: 'opsLab',
    label: 'Ops Lab',
    shortLabel: 'Ops',
    description: 'Marketing operations & analytics readiness diagnostic across 5 dimensions: tracking, data governance, CRM, automation, and experimentation. Includes quick wins, projects, and maturity scoring.',
    category: 'Marketing Ops',
    section: 'diagnostic',
    behavior: 'diagnosticRun',
    status: 'enabled',
    diagnosticToolId: 'opsLab',
    runApiPath: '/api/os/diagnostics/run/ops-lab',
    urlSlug: 'ops-lab',
    viewPath: (companyId, runId) =>
      runId ? `/c/${companyId}/diagnostics/ops/${runId}` : `/c/${companyId}/diagnostics/ops`,
    requiresWebsite: true,
    estimatedMinutes: 3,
    icon: 'settings',
    primaryActionLabel: 'Run Ops Lab',
    blueprintMeta: {
      whyRun: 'Evaluate marketing operations readiness across tracking & instrumentation, data quality, CRM, automation, and experimentation capabilities.',
      answersQuestion: 'Is this company set up to measure, automate, and scale what marketing is doing?',
      influences: ['Strategy', 'Blueprint Focus', 'Work', 'Analytics'],
      inputs: ['Website', 'Analytics'],
      typicalUseWhen: 'Evaluating marketing ops maturity, checking tracking setup, planning automation initiatives, or assessing experimentation readiness.',
    },
  },

  // ==========================================================================
  // Analytics
  // ==========================================================================
  {
    id: 'analyticsScan',
    label: 'Analytics Scan',
    shortLabel: 'Analytics',
    description: 'Live GA4 + Search Console data with AI insights. View traffic, engagement, and search performance.',
    category: 'Analytics',
    section: 'diagnostic',
    behavior: 'openRoute',
    status: 'enabled',
    openPath: (companyId) => `/c/${companyId}/analytics`,
    requiresWebsite: false,
    icon: 'barChart',
    primaryActionLabel: 'Open Analytics',
    blueprintMeta: {
      whyRun: 'Review real-time traffic, engagement, and search performance with AI-powered insights.',
      answersQuestion: 'What do the numbers say about current performance and trends?',
      influences: ['Strategy', 'Blueprint Focus', 'Analytics'],
      inputs: ['Analytics'],
      typicalUseWhen: 'Checking performance trends, before strategy sessions, or investigating anomalies.',
    },
  },

  // ==========================================================================
  // Strategic Tools - Media & Advertising
  // ==========================================================================
  {
    id: 'mediaLab',
    label: 'Media Lab',
    shortLabel: 'Media',
    description: 'AI-powered media strategy planner. Designs channel mix, budgets, and forecasted outcomes, compares scenarios, and promotes plans into active media programs.',
    category: 'Media & Advertising',
    section: 'strategic',
    behavior: 'openRoute',
    status: 'enabled',
    openPath: (companyId) => `/c/${companyId}/diagnostics/media`,
    urlSlug: 'media-lab',
    requiresWebsite: false,
    estimatedMinutes: 7,
    icon: 'tv',
    primaryActionLabel: 'Open Media Lab',
    blueprintMeta: {
      whyRun: 'Design an AI-powered media strategy with channel recommendations, budget allocation, and performance forecasts.',
      answersQuestion: 'What is the optimal media mix and budget allocation to achieve our marketing objectives?',
      influences: ['Strategy', 'Blueprint Focus', 'Work'],
      inputs: ['Analytics', 'GAP IA'],
      typicalUseWhen: 'Planning a media campaign, evaluating channel mix, or when building a new demand generation program.',
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a tool definition by its ID
 */
export function getToolById(toolId: CompanyToolId): CompanyToolDefinition | undefined {
  return COMPANY_TOOL_DEFS.find((tool) => tool.id === toolId);
}

/**
 * Get a tool definition by its diagnostic tool ID
 */
export function getToolByDiagnosticId(diagnosticToolId: DiagnosticToolId): CompanyToolDefinition | undefined {
  return COMPANY_TOOL_DEFS.find((tool) => tool.diagnosticToolId === diagnosticToolId);
}

/**
 * Get a tool definition by its URL slug
 */
export function getToolBySlug(urlSlug: string): CompanyToolDefinition | undefined {
  return COMPANY_TOOL_DEFS.find((tool) => tool.urlSlug === urlSlug);
}

/**
 * Get all enabled tools (status !== 'comingSoon')
 */
export function getEnabledTools(): CompanyToolDefinition[] {
  return COMPANY_TOOL_DEFS.filter((tool) => tool.status === 'enabled');
}

/**
 * Get all tools that are coming soon
 */
export function getComingSoonTools(): CompanyToolDefinition[] {
  return COMPANY_TOOL_DEFS.filter((tool) => tool.status === 'comingSoon');
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): CompanyToolDefinition[] {
  return COMPANY_TOOL_DEFS.filter((tool) => tool.category === category);
}

/**
 * Get tools by section (diagnostic vs strategic)
 */
export function getToolsBySection(section: ToolSection): CompanyToolDefinition[] {
  return COMPANY_TOOL_DEFS.filter((tool) => tool.section === section);
}

/**
 * Get all diagnostic tools
 */
export function getDiagnosticTools(): CompanyToolDefinition[] {
  return getToolsBySection('diagnostic');
}

/**
 * Get all strategic tools
 */
export function getStrategicTools(): CompanyToolDefinition[] {
  return getToolsBySection('strategic');
}

/**
 * Get all unique categories in display order
 */
export function getAllCategories(): ToolCategory[] {
  return [
    'Strategic Assessment',
    'Website & UX',
    'Brand & Positioning',
    'Content & Messaging',
    'SEO & Search',
    'Demand Generation',
    'Marketing Ops',
    'Analytics',
    'Media & Advertising',
  ];
}

/**
 * Get tools grouped by category
 */
export function getToolsGroupedByCategory(): Map<ToolCategory, CompanyToolDefinition[]> {
  const grouped = new Map<ToolCategory, CompanyToolDefinition[]>();

  for (const category of getAllCategories()) {
    const tools = getToolsByCategory(category);
    if (tools.length > 0) {
      grouped.set(category, tools);
    }
  }

  return grouped;
}

/**
 * Get category color classes for UI
 */
export function getCategoryColor(category: ToolCategory): string {
  const colors: Record<ToolCategory, string> = {
    'Strategic Assessment': 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    'Website & UX': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    'Brand & Positioning': 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    'Content & Messaging': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    'SEO & Search': 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
    'Demand Generation': 'text-pink-400 border-pink-400/30 bg-pink-400/10',
    'Marketing Ops': 'text-orange-400 border-orange-400/30 bg-orange-400/10',
    'Analytics': 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10',
    'Media & Advertising': 'text-rose-400 border-rose-400/30 bg-rose-400/10',
  };
  return colors[category] || 'text-slate-400 border-slate-400/30 bg-slate-400/10';
}

/**
 * Map from old DiagnosticToolId to new CompanyToolId
 * Used for backward compatibility during migration
 */
export function diagnosticToolIdToCompanyToolId(diagnosticToolId: DiagnosticToolId): CompanyToolId | undefined {
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
  return mapping[diagnosticToolId];
}

// ============================================================================
// Legacy Compatibility Re-exports
// ============================================================================

// Re-export types with old names for backward compatibility during migration
export type { DiagnosticToolId };

/**
 * @deprecated Use COMPANY_TOOL_DEFS instead
 * Legacy alias for backward compatibility
 */
export const DIAGNOSTIC_TOOLS = COMPANY_TOOL_DEFS;

/**
 * @deprecated Use CompanyToolDefinition instead
 */
export type DiagnosticToolConfig = CompanyToolDefinition;

/**
 * @deprecated Use ToolCategory instead
 */
export type DiagnosticToolCategory = ToolCategory;

/**
 * @deprecated Use getToolById instead
 */
export function getToolConfig(toolId: CompanyToolId): CompanyToolDefinition | undefined {
  return getToolById(toolId);
}

/**
 * @deprecated Use getCategoryColor instead
 */
export function getCategoryLabel(category: ToolCategory): string {
  return category; // Categories are now human-readable by default
}
