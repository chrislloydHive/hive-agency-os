// lib/nav/companyNav.ts
// Centralized navigation helpers for company routes
//
// Used by:
// - CompanyTabs (company-level navigation)
// - BrainSubNav (brain workspace navigation)
// - QbrSubNav (QBR workspace navigation)
// - BlueprintSubNav (blueprint workspace navigation)

// ============================================================================
// Company-Level Navigation
// ============================================================================

export type CompanyTabId =
  | 'overview'
  | 'context'
  | 'diagnostics'
  | 'strategy'
  | 'readiness'
  | 'work'
  | 'reports'
  | 'documents'
  | 'blueprint'
  | 'brain'
  | 'findings';

export interface CompanyTab {
  id: CompanyTabId;
  name: string;
  href: (companyId: string) => string;
  description?: string;
  /** If true, tab is shown in primary navigation */
  primary?: boolean;
  /** If true, tab is hidden from navigation but routes still work */
  hidden?: boolean;
}

export const COMPANY_TABS: CompanyTab[] = [
  // === Primary Navigation (MVP 1.0) ===
  {
    id: 'overview',
    name: 'Overview',
    href: (companyId) => `/c/${companyId}`,
    description: 'Company dashboard with health summary and quick actions',
    primary: true,
  },
  {
    id: 'context',
    name: 'Context',
    href: (companyId) => `/c/${companyId}/context`,
    description: 'Editable company context: business model, audience, objectives, constraints',
    primary: true,
  },
  {
    id: 'diagnostics',
    name: 'Diagnostics',
    href: (companyId) => `/c/${companyId}/diagnostics`,
    description: 'Run labs and GAP assessments to uncover issues and opportunities',
    primary: true,
  },
  {
    id: 'strategy',
    name: 'Strategy',
    href: (companyId) => `/c/${companyId}/strategy`,
    description: 'Marketing strategy with pillars, objectives, and AI-assisted planning',
    primary: true,
  },
  {
    id: 'readiness',
    name: 'Readiness',
    href: (companyId) => `/c/${companyId}/readiness`,
    description: 'Flow readiness: what is ready and what needs attention',
    primary: true,
  },
  {
    id: 'work',
    name: 'Work',
    href: (companyId) => `/c/${companyId}/work`,
    description: 'Active tasks, workstreams, and 90-day plan',
    primary: true,
  },
  {
    id: 'reports',
    name: 'Reports',
    href: (companyId) => `/c/${companyId}/reports`,
    description: 'Monthly reports, QBRs, and strategic documents',
    primary: true,
  },
  {
    id: 'documents',
    name: 'Documents',
    href: (companyId) => `/c/${companyId}/documents`,
    description: 'Briefs, proposals, and generated documents',
    primary: true,
  },
  // === Secondary Navigation (accessible but not in main tabs) ===
  {
    id: 'blueprint',
    name: 'Labs',
    href: (companyId) => `/c/${companyId}/blueprint`,
    description: 'Run labs and assessments to uncover issues and opportunities',
    primary: false,
  },
  {
    id: 'brain',
    name: 'Brain',
    href: (companyId) => `/c/${companyId}/brain`,
    description: 'Company memory & intelligence hub',
    primary: false,
  },
  {
    id: 'findings',
    name: 'Findings',
    href: (companyId) => `/c/${companyId}/findings`,
    description: 'Issues and opportunities from diagnostics',
    primary: false,
  },
];

/**
 * Get only the primary navigation tabs for display
 */
export function getPrimaryCompanyTabs(): CompanyTab[] {
  return COMPANY_TABS.filter(tab => tab.primary !== false && !tab.hidden);
}

/**
 * Get all navigation tabs including secondary ones
 */
export function getAllCompanyTabs(): CompanyTab[] {
  return COMPANY_TABS.filter(tab => !tab.hidden);
}

/**
 * Determine which company tab is active based on pathname
 */
export function getCompanyTabFromPath(pathname: string, companyId: string): CompanyTabId {
  // Check for specific tab routes (order matters - check more specific routes first)
  // New MVP 1.0 routes
  if (pathname.startsWith(`/c/${companyId}/context`)) return 'context';
  if (pathname.startsWith(`/c/${companyId}/diagnostics`)) return 'diagnostics';
  if (pathname.startsWith(`/c/${companyId}/strategy`)) return 'strategy';
  if (pathname.startsWith(`/c/${companyId}/readiness`)) return 'readiness';
  if (pathname.startsWith(`/c/${companyId}/documents`)) return 'documents';
  // Existing routes
  if (pathname.startsWith(`/c/${companyId}/blueprint`)) return 'diagnostics'; // Blueprint now maps to diagnostics
  if (pathname.startsWith(`/c/${companyId}/brain`)) return 'brain';
  if (pathname.startsWith(`/c/${companyId}/findings`)) return 'findings';
  if (pathname.startsWith(`/c/${companyId}/work`)) return 'work';
  if (pathname.startsWith(`/c/${companyId}/reports`)) return 'reports';
  // Legacy routes
  if (pathname.startsWith(`/c/${companyId}/qbr`)) return 'reports';
  if (pathname.startsWith(`/c/${companyId}/labs`)) return 'diagnostics';

  // Default to overview for exact match or unknown routes
  return 'overview';
}

// ============================================================================
// Context V4 Sub-Navigation
// ============================================================================
// Context V4 is the modern fact-review workspace:
// - Fact Sheet: Confirmed facts organized by domain (read view)
// - Review: Proposed facts awaiting confirmation (triage view)
// - Fields: All fields in a searchable table (data view)

export type ContextV4TabId = 'facts' | 'review' | 'fields';

export interface ContextV4Tab {
  id: ContextV4TabId;
  name: string;
  /** Short action label shown below tab name */
  subLabel: string;
  href: (companyId: string) => string;
  tooltip: {
    title: string;
    description: string;
  };
  /** Badge count key from API response (optional) */
  badgeKey?: 'proposed' | 'confirmed';
}

export const CONTEXT_V4_TABS: ContextV4Tab[] = [
  {
    id: 'facts',
    name: 'Fact Sheet',
    subLabel: 'Confirmed',
    href: (companyId) => `/context-v4/${companyId}`,
    tooltip: {
      title: 'Confirmed Facts',
      description: 'View all confirmed context facts organized by domain. The source of truth for strategy generation.',
    },
    badgeKey: 'confirmed',
  },
  {
    id: 'review',
    name: 'Review',
    subLabel: 'Triage',
    href: (companyId) => `/context-v4/${companyId}/review`,
    tooltip: {
      title: 'Review Queue',
      description: 'Triage proposed facts from Labs and AI. Confirm or reject each proposal before it becomes permanent.',
    },
    badgeKey: 'proposed',
  },
  {
    id: 'fields',
    name: 'Fields',
    subLabel: 'All Data',
    href: (companyId) => `/context-v4/${companyId}/fields`,
    tooltip: {
      title: 'All Fields',
      description: 'Searchable table of all context fields with status, source, and confidence. Export and bulk edit.',
    },
  },
];

/**
 * Determine which Context V4 tab is active based on pathname
 */
export function getContextV4TabFromPath(pathname: string): ContextV4TabId | null {
  // Match context-v4 routes
  if (!pathname.includes('/context-v4/')) return null;

  // Extract the part after /context-v4/{companyId}
  const match = pathname.match(/\/context-v4\/[^/]+(.*)$/);
  if (!match) return null;

  const subPath = match[1];

  if (subPath === '' || subPath === '/') return 'facts';
  if (subPath.startsWith('/review')) return 'review';
  if (subPath.startsWith('/fields')) return 'fields';

  return 'facts'; // Default to facts
}

// ============================================================================
// Brain Sub-Navigation (3-Tab Structure)
// ============================================================================
// Brain is purely context/memory oriented:
// - Context: Field-level editor for company data
// - Insights: AI-generated analysis and patterns
// - History: Timeline of changes and updates
//
// Note: Labs have moved to Diagnostics (/blueprint)

export type BrainTabId = 'context' | 'insights' | 'history';

export interface BrainTab {
  id: BrainTabId;
  name: string;
  /** Short action label shown below tab name (e.g., "Edit", "Analyze") */
  subLabel: string;
  href: (companyId: string) => string;
  tooltip: {
    title: string;
    description: string;
  };
}

export const BRAIN_TABS: BrainTab[] = [
  {
    id: 'context',
    name: 'Context',
    subLabel: 'Edit',
    href: (companyId) => `/c/${companyId}/brain/context`,
    tooltip: {
      title: 'Context Editor',
      description: 'Field-level editor for company context. View and edit all structured data with inline editing and provenance tracking.',
    },
  },
  {
    id: 'insights',
    name: 'Insights',
    subLabel: 'Analyze',
    href: (companyId) => `/c/${companyId}/brain/insights`,
    tooltip: {
      title: 'AI-Generated Insights',
      description: 'Strategic recommendations and patterns surfaced by analyzing the context graph.',
    },
  },
  {
    id: 'history',
    name: 'History',
    subLabel: 'Review',
    href: (companyId) => `/c/${companyId}/brain/history`,
    tooltip: {
      title: 'Context History',
      description: 'Timeline of changes, updates, and events across the context graph.',
    },
  },
];

/**
 * Determine which brain tab is active based on pathname
 */
export function getBrainTabFromPath(pathname: string, companyId: string): BrainTabId | null {
  const brainBase = `/c/${companyId}/brain`;

  if (!pathname.startsWith(brainBase)) return null;

  const subPath = pathname.slice(brainBase.length);

  // Match brain routes (3-tab structure: Context | Insights | History)
  if (subPath.startsWith('/context')) return 'context';
  if (subPath.startsWith('/insights')) return 'insights';
  if (subPath.startsWith('/history')) return 'history';

  // Legacy route mappings (redirect to context)
  if (subPath.startsWith('/explorer')) return 'context'; // Explorer → Context
  if (subPath.startsWith('/map')) return 'context'; // Old strategic map → Context
  if (subPath.startsWith('/library')) return 'context'; // Library → Context
  if (subPath.startsWith('/setup')) return 'context'; // Setup → Context
  // Note: /labs should redirect to /blueprint (Diagnostics) - handled by page redirect

  // Default: bare /brain → context (context-first)
  if (subPath === '' || subPath === '/') return 'context';

  return 'context'; // Fallback to context
}

// ============================================================================
// Reports Sub-Navigation
// ============================================================================

export type ReportsTabId = 'hub' | 'annual' | 'qbr' | 'diagnostics';

export interface ReportsTab {
  id: ReportsTabId;
  name: string;
  href: (companyId: string) => string;
  description?: string;
}

export const REPORTS_TABS: ReportsTab[] = [
  {
    id: 'hub',
    name: 'All Reports',
    href: (companyId) => `/c/${companyId}/reports`,
    description: 'Reports dashboard and generation',
  },
  {
    id: 'annual',
    name: 'Annual Plan',
    href: (companyId) => `/c/${companyId}/reports/annual`,
    description: 'Yearly strategic and marketing plan',
  },
  {
    id: 'qbr',
    name: 'QBR',
    href: (companyId) => `/c/${companyId}/reports/qbr`,
    description: 'Quarterly Business Review',
  },
  {
    id: 'diagnostics',
    name: 'Diagnostics',
    href: (companyId) => `/c/${companyId}/reports/diagnostics`,
    description: 'GAP analyses, lab runs, and diagnostic reports',
  },
];

/**
 * Determine which Reports tab is active based on pathname
 */
export function getReportsTabFromPath(pathname: string, companyId: string): ReportsTabId | null {
  const reportsBase = `/c/${companyId}/reports`;

  if (!pathname.startsWith(reportsBase)) return null;

  const subPath = pathname.slice(reportsBase.length);

  // Match specific Reports routes
  if (subPath === '' || subPath === '/') return 'hub';
  if (subPath.startsWith('/annual')) return 'annual';
  if (subPath.startsWith('/qbr')) return 'qbr';
  if (subPath.startsWith('/diagnostics')) return 'diagnostics';

  return 'hub'; // Default to hub
}

// ============================================================================
// QBR Sub-Navigation (Legacy - redirects to /reports/qbr)
// ============================================================================

export type QbrTabId = 'story' | 'scorecard' | 'history';

export interface QbrTab {
  id: QbrTabId;
  name: string;
  href: (companyId: string) => string;
  description?: string;
}

export const QBR_TABS: QbrTab[] = [
  {
    id: 'story',
    name: 'Story',
    href: (companyId) => `/c/${companyId}/reports/qbr/story`,
    description: 'AI-generated narrative with chapters by domain',
  },
  {
    id: 'scorecard',
    name: 'Scorecard',
    href: (companyId) => `/c/${companyId}/reports/qbr/scorecard`,
    description: 'Key performance indicators & metrics',
  },
  {
    id: 'history',
    name: 'History',
    href: (companyId) => `/c/${companyId}/reports/qbr/history`,
    description: 'Past QBR runs and exports',
  },
];

/**
 * Determine which QBR tab is active based on pathname
 */
export function getQbrTabFromPath(pathname: string, companyId: string): QbrTabId | null {
  // Support both legacy /qbr and new /reports/qbr paths
  const legacyBase = `/c/${companyId}/qbr`;
  const newBase = `/c/${companyId}/reports/qbr`;

  let subPath: string;
  if (pathname.startsWith(newBase)) {
    subPath = pathname.slice(newBase.length);
  } else if (pathname.startsWith(legacyBase)) {
    subPath = pathname.slice(legacyBase.length);
  } else {
    return null;
  }

  // Match specific QBR routes
  if (subPath === '' || subPath === '/' || subPath.startsWith('/story')) return 'story';
  if (subPath.startsWith('/scorecard') || subPath.startsWith('/kpis')) return 'scorecard';
  if (subPath.startsWith('/history')) return 'history';

  // Legacy routes map to story
  if (subPath.startsWith('/strategic-plan') || subPath.startsWith('/priorities') ||
      subPath.startsWith('/next-quarter') || subPath.startsWith('/risks')) {
    return 'story';
  }

  return 'story'; // Default to story
}

// ============================================================================
// Blueprint Sub-Navigation
// ============================================================================

export type BlueprintTabId = 'map' | 'plan' | 'pillars' | 'programs';

export interface BlueprintTab {
  id: BlueprintTabId;
  name: string;
  href: (companyId: string) => string;
  description?: string;
}

export const BLUEPRINT_TABS: BlueprintTab[] = [
  {
    id: 'map',
    name: 'Map',
    href: (companyId) => `/c/${companyId}/blueprint`,
    description: 'Strategic map in decision mode with pillars and sliders',
  },
  {
    id: 'plan',
    name: 'Plan',
    href: (companyId) => `/c/${companyId}/blueprint/plan`,
    description: 'Growth plan with initiatives and roadmap',
  },
  {
    id: 'pillars',
    name: 'Pillars',
    href: (companyId) => `/c/${companyId}/blueprint/pillars`,
    description: 'Strategic pillars and themes',
  },
  {
    id: 'programs',
    name: 'Programs',
    href: (companyId) => `/c/${companyId}/blueprint/programs`,
    description: 'Programs and tracks',
  },
];

/**
 * Determine which blueprint tab is active based on pathname
 */
export function getBlueprintTabFromPath(pathname: string, companyId: string): BlueprintTabId | null {
  const blueprintBase = `/c/${companyId}/blueprint`;

  if (!pathname.startsWith(blueprintBase)) return null;

  const subPath = pathname.slice(blueprintBase.length);

  // Match specific blueprint routes
  if (subPath === '' || subPath === '/') return 'map';
  if (subPath.startsWith('/plan')) return 'plan';
  if (subPath.startsWith('/pillars')) return 'pillars';
  if (subPath.startsWith('/programs')) return 'programs';

  return 'map'; // Default to map
}

// ============================================================================
// Labs Navigation
// ============================================================================

export type LabId = 'competition' | 'creative' | 'competitor' | 'website' | 'brand' | 'audience' | 'content' | 'seo' | 'demand' | 'ops' | 'media' | 'analytics';

export interface Lab {
  id: LabId;
  name: string;
  href: (companyId: string) => string;
  description: string;
  status: 'active' | 'coming_soon';
}

// ============================================================================
// Canonical Lab Routes
// ============================================================================
// All labs use the canonical pattern: /c/[companyId]/diagnostics/[labSlug]
// Legacy paths (/brain/labs/*, /labs/*) redirect to canonical routes.

export const LABS: Lab[] = [
  {
    id: 'competition',
    name: 'Competition Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/competition`,
    description: 'Map the competitive landscape: core competitors, alternatives, and strategic differentiation.',
    status: 'active',
  },
  {
    id: 'creative',
    name: 'Creative Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/creative`,
    description: 'Generate messaging frameworks, campaign concepts, and creative territories.',
    status: 'active',
  },
  {
    id: 'competitor',
    name: 'Competitor Deep Dive',
    href: (companyId) => `/c/${companyId}/diagnostics/competitor`,
    description: 'Analyze individual competitors in-depth: positioning, messaging, strengths, and weaknesses.',
    status: 'active',
  },
  {
    id: 'website',
    name: 'Website Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/website`,
    description: 'Audit website structure, messaging clarity, conversion paths, and SEO foundations.',
    status: 'active',
  },
  {
    id: 'brand',
    name: 'Brand Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/brand`,
    description: 'Analyze brand voice, visual identity, and market positioning consistency.',
    status: 'active',
  },
  {
    id: 'audience',
    name: 'Audience Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/audience`,
    description: 'Deep-dive into audience segments, personas, and behavioral insights.',
    status: 'active',
  },
  {
    id: 'content',
    name: 'Content Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/content`,
    description: 'Analyze content inventory, quality, depth, freshness, and SEO signals.',
    status: 'active',
  },
  {
    id: 'seo',
    name: 'SEO Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/seo`,
    description: 'Comprehensive SEO diagnostic with technical analysis and search performance.',
    status: 'active',
  },
  {
    id: 'demand',
    name: 'Demand Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/demand`,
    description: 'Evaluate demand generation across paid, organic, and conversion channels.',
    status: 'active',
  },
  {
    id: 'ops',
    name: 'Ops Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/ops`,
    description: 'Assess marketing operations, analytics setup, and process maturity.',
    status: 'active',
  },
  {
    id: 'media',
    name: 'Media Lab',
    href: (companyId) => `/c/${companyId}/diagnostics/media`,
    description: 'AI-powered media strategy with channel mix, budgets, and forecasts.',
    status: 'active',
  },
  {
    id: 'analytics',
    name: 'Analytics Lab',
    href: (companyId) => `/c/${companyId}/labs/analytics`,
    description: 'Unified analytics dashboard aggregating GA4, Search Console, GBP, and paid media.',
    status: 'active',
  },
];

/**
 * Get URL to a specific lab with optional source tracking
 */
export function getLabUrl(companyId: string, labId: LabId, from?: 'blueprint' | 'qbr' | 'strategic-map'): string {
  const lab = LABS.find(l => l.id === labId);
  if (!lab) return `/c/${companyId}/brain/labs`;

  const baseUrl = lab.href(companyId);
  if (from) {
    return `${baseUrl}?from=${from}`;
  }
  return baseUrl;
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Extract companyId from a pathname
 */
export function extractCompanyIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Check if a path is a child route of a given base path
 */
export function isChildRoute(pathname: string, basePath: string): boolean {
  if (pathname === basePath) return true;
  return pathname.startsWith(basePath + '/');
}
