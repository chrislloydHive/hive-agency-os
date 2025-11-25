// lib/os/diagnostics/tools.ts
// Central registry of diagnostic tools for Hive OS
//
// This provides a single source of truth for tool configurations,
// making it easy to add new tools and keep the UI consistent.

import type { DiagnosticToolId } from './runs';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool category groupings
 */
export type DiagnosticToolCategory =
  | 'strategy'  // High-level strategic assessments
  | 'website'   // Website/UX focused tools
  | 'brand'     // Brand & positioning tools
  | 'content'   // Content quality tools
  | 'seo'       // SEO & search tools
  | 'demand'    // Demand gen & funnel tools
  | 'ops';      // Operations & process tools

/**
 * Configuration for a single diagnostic tool
 */
export interface DiagnosticToolConfig {
  /** Unique identifier for the tool */
  id: DiagnosticToolId;

  /** Human-readable label (e.g., "GAP Snapshot") */
  label: string;

  /** Short label for compact displays (e.g., "Website") */
  shortLabel?: string;

  /** Short description of what the tool does */
  description: string;

  /** Label for the primary action button (e.g., "Run Assessment") */
  primaryActionLabel: string;

  /** Category for grouping in the UI */
  category: DiagnosticToolCategory;

  /** API endpoint path for running the tool */
  runApiPath: string;

  /** Path template for hub (use {companyId} placeholder) */
  hubPath: string;

  /** Path template for viewing a run (use {companyId} and {runId} placeholders) */
  viewPath?: string;

  /** Whether this tool produces a numeric score */
  supportsScore: boolean;

  /** Whether this tool is enabled by default */
  defaultEnabled: boolean;

  /** Icon name (Lucide icon name) */
  icon: string;

  /** Estimated run time description */
  estimatedTime?: string;
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All available diagnostic tools in the Diagnostics Suite
 */
export const DIAGNOSTIC_TOOLS: DiagnosticToolConfig[] = [
  // ========================================================================
  // Strategy Tools
  // ========================================================================
  {
    id: 'gapSnapshot',
    label: 'GAP Snapshot',
    shortLabel: 'Snapshot',
    description: 'Quick initial assessment of marketing presence, scores, and maturity stage. Great for prospects and new companies.',
    primaryActionLabel: 'Run Snapshot',
    category: 'strategy',
    runApiPath: '/api/os/diagnostics/run/gap-snapshot',
    hubPath: '/c/{companyId}/diagnostics',
    viewPath: '/c/{companyId}/diagnostics/gap-snapshot/{runId}',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'Zap',
    estimatedTime: '1-2 min',
  },
  {
    id: 'gapPlan',
    label: 'GAP Plan',
    shortLabel: 'Plan',
    description: 'Comprehensive Growth Acceleration Plan with strategic initiatives, quick wins, and 90-day roadmap.',
    primaryActionLabel: 'Generate Plan',
    category: 'strategy',
    runApiPath: '/api/os/diagnostics/run/gap-plan',
    hubPath: '/c/{companyId}/plan',
    viewPath: '/c/{companyId}/plan',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'FileText',
    estimatedTime: '3-5 min',
  },

  // ========================================================================
  // Website Tools
  // ========================================================================
  {
    id: 'websiteLab',
    label: 'Website Lab',
    shortLabel: 'Website',
    description: 'Multi-page UX & conversion diagnostic. Evaluates page structure, CTAs, messaging clarity, and conversion optimization.',
    primaryActionLabel: 'Run Website Diagnostic',
    category: 'website',
    runApiPath: '/api/os/diagnostics/run/website-lab',
    hubPath: '/c/{companyId}/diagnostics/website',
    viewPath: '/c/{companyId}/diagnostics/website',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'Globe',
    estimatedTime: '2-4 min',
  },

  // ========================================================================
  // Brand Tools
  // ========================================================================
  {
    id: 'brandLab',
    label: 'Brand Lab',
    shortLabel: 'Brand',
    description: 'Brand health, clarity, and positioning analysis. Evaluates brand coherence, differentiation, and market positioning.',
    primaryActionLabel: 'Run Brand Diagnostic',
    category: 'brand',
    runApiPath: '/api/os/diagnostics/run/brand-lab',
    hubPath: '/c/{companyId}/diagnostics/brand',
    viewPath: '/c/{companyId}/diagnostics/brand',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'Sparkles',
    estimatedTime: '2-3 min',
  },

  // ========================================================================
  // Content Tools
  // ========================================================================
  {
    id: 'contentLab',
    label: 'Content Lab',
    shortLabel: 'Content',
    description: 'Content inventory and quality assessment. Analyzes blog, resources, case studies, and content strategy.',
    primaryActionLabel: 'Run Content Diagnostic',
    category: 'content',
    runApiPath: '/api/os/diagnostics/run/content-lab',
    hubPath: '/c/{companyId}/diagnostics/content',
    viewPath: '/c/{companyId}/diagnostics/content',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'FileEdit',
    estimatedTime: '2-3 min',
  },

  // ========================================================================
  // SEO Tools
  // ========================================================================
  {
    id: 'seoLab',
    label: 'SEO Lab',
    shortLabel: 'SEO',
    description: 'Search engine optimization analysis. Evaluates technical SEO, content optimization, and search visibility.',
    primaryActionLabel: 'Run SEO Diagnostic',
    category: 'seo',
    runApiPath: '/api/os/diagnostics/run/seo-lab',
    hubPath: '/c/{companyId}/diagnostics/seo',
    viewPath: '/c/{companyId}/diagnostics/seo',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'Search',
    estimatedTime: '2-3 min',
  },

  // ========================================================================
  // Demand Tools
  // ========================================================================
  {
    id: 'demandLab',
    label: 'Demand Lab',
    shortLabel: 'Demand',
    description: 'Demand generation and funnel analysis. Evaluates lead capture, nurture flows, and conversion paths.',
    primaryActionLabel: 'Run Demand Diagnostic',
    category: 'demand',
    runApiPath: '/api/os/diagnostics/run/demand-lab',
    hubPath: '/c/{companyId}/diagnostics/demand',
    viewPath: '/c/{companyId}/diagnostics/demand',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'TrendingUp',
    estimatedTime: '2-3 min',
  },

  // ========================================================================
  // Ops Tools
  // ========================================================================
  {
    id: 'opsLab',
    label: 'Ops Lab',
    shortLabel: 'Ops',
    description: 'Marketing operations assessment. Evaluates processes, tooling, automation, and operational efficiency.',
    primaryActionLabel: 'Run Ops Diagnostic',
    category: 'ops',
    runApiPath: '/api/os/diagnostics/run/ops-lab',
    hubPath: '/c/{companyId}/diagnostics/ops',
    viewPath: '/c/{companyId}/diagnostics/ops',
    supportsScore: true,
    defaultEnabled: true,
    icon: 'Settings',
    estimatedTime: '2-3 min',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the hub path for a tool and company
 */
export function getToolHubPath(tool: DiagnosticToolConfig, companyId: string): string {
  return tool.hubPath.replace('{companyId}', companyId);
}

/**
 * Get the view path for a specific run
 */
export function getToolViewPath(tool: DiagnosticToolConfig, companyId: string, runId: string): string {
  if (!tool.viewPath) return getToolHubPath(tool, companyId);
  return tool.viewPath.replace('{companyId}', companyId).replace('{runId}', runId);
}

/**
 * Get a tool config by ID
 */
export function getToolConfig(toolId: DiagnosticToolId): DiagnosticToolConfig | undefined {
  return DIAGNOSTIC_TOOLS.find((t) => t.id === toolId);
}

/**
 * Get all tools in a category
 */
export function getToolsByCategory(category: DiagnosticToolCategory): DiagnosticToolConfig[] {
  return DIAGNOSTIC_TOOLS.filter((t) => t.category === category);
}

/**
 * Get all enabled tools
 */
export function getEnabledTools(): DiagnosticToolConfig[] {
  return DIAGNOSTIC_TOOLS.filter((t) => t.defaultEnabled);
}

/**
 * Get tool categories with their tools
 */
export function getToolsGroupedByCategory(): Map<DiagnosticToolCategory, DiagnosticToolConfig[]> {
  const grouped = new Map<DiagnosticToolCategory, DiagnosticToolConfig[]>();

  for (const tool of DIAGNOSTIC_TOOLS) {
    const existing = grouped.get(tool.category) || [];
    existing.push(tool);
    grouped.set(tool.category, existing);
  }

  return grouped;
}

/**
 * Get human-readable category label
 */
export function getCategoryLabel(category: DiagnosticToolCategory): string {
  const labels: Record<DiagnosticToolCategory, string> = {
    strategy: 'Strategic Assessment',
    website: 'Website & UX',
    brand: 'Brand & Positioning',
    content: 'Content & Messaging',
    seo: 'SEO & Search',
    demand: 'Demand Generation',
    ops: 'Marketing Ops',
  };
  return labels[category] || category;
}

/**
 * Get category color class
 */
export function getCategoryColor(category: DiagnosticToolCategory): string {
  const colors: Record<DiagnosticToolCategory, string> = {
    strategy: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    website: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    brand: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    content: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    seo: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
    demand: 'text-pink-400 border-pink-400/30 bg-pink-400/10',
    ops: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  };
  return colors[category] || 'text-slate-400 border-slate-400/30 bg-slate-400/10';
}

/**
 * Get all diagnostic tool categories in display order
 */
export function getAllCategories(): DiagnosticToolCategory[] {
  return ['strategy', 'website', 'brand', 'content', 'seo', 'demand', 'ops'];
}
