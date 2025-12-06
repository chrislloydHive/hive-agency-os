// lib/os/diagnostics/tools.ts
// DEPRECATED: This file is a backward-compatibility shim.
// All tool definitions have been moved to lib/tools/registry.ts
//
// New code should import from '@/lib/tools/registry' directly.
// This file re-exports the unified registry with legacy type mappings.

import type { DiagnosticToolId } from './runs';
import {
  COMPANY_TOOL_DEFS,
  type CompanyToolDefinition,
  type ToolCategory,
  getToolById,
  getToolsByCategory as getToolsByCategoryNew,
  getEnabledTools as getEnabledToolsNew,
  getToolsGroupedByCategory as getToolsGroupedByCategoryNew,
  getAllCategories as getAllCategoriesNew,
  getCategoryColor as getCategoryColorNew,
} from '@/lib/tools/registry';

// ============================================================================
// Legacy Type Aliases
// ============================================================================

/**
 * @deprecated Use ToolCategory from lib/tools/registry instead
 */
export type DiagnosticToolCategory =
  | 'strategy'
  | 'website'
  | 'brand'
  | 'content'
  | 'seo'
  | 'demand'
  | 'ops';

/**
 * @deprecated Use CompanyToolDefinition from lib/tools/registry instead
 */
export interface DiagnosticToolConfig {
  id: DiagnosticToolId;
  label: string;
  shortLabel?: string;
  description: string;
  primaryActionLabel: string;
  category: DiagnosticToolCategory;
  runApiPath: string;
  hubPath: string;
  viewPath?: string;
  supportsScore: boolean;
  defaultEnabled: boolean;
  icon: string;
  estimatedTime?: string;
}

// ============================================================================
// Category Mapping
// ============================================================================

const newCategoryToOld: Record<ToolCategory, DiagnosticToolCategory> = {
  'Strategic Assessment': 'strategy',
  'Website & UX': 'website',
  'Brand & Positioning': 'brand',
  'Content & Messaging': 'content',
  'SEO & Search': 'seo',
  'Demand Generation': 'demand',
  'Marketing Ops': 'ops',
  'Analytics': 'ops', // Analytics doesn't map cleanly, but it's rarely used in legacy code
  'Media & Advertising': 'demand', // Media maps to demand in legacy code
  'Audience & Targeting': 'demand', // Audience maps to demand in legacy code
  'Competitive Intelligence': 'strategy', // Competitive maps to strategy in legacy code
};

const oldCategoryToNew: Record<DiagnosticToolCategory, ToolCategory> = {
  strategy: 'Strategic Assessment',
  website: 'Website & UX',
  brand: 'Brand & Positioning',
  content: 'Content & Messaging',
  seo: 'SEO & Search',
  demand: 'Demand Generation',
  ops: 'Marketing Ops',
};

// ============================================================================
// Convert New Tool Definition to Legacy Format
// ============================================================================

function tolegacyConfig(tool: CompanyToolDefinition): DiagnosticToolConfig | null {
  // Skip tools that don't have a diagnosticToolId (like analyticsScan)
  if (!tool.diagnosticToolId) return null;

  return {
    id: tool.diagnosticToolId,
    label: tool.label,
    shortLabel: tool.shortLabel,
    description: tool.description,
    primaryActionLabel: tool.primaryActionLabel || 'Run',
    category: newCategoryToOld[tool.category],
    runApiPath: tool.runApiPath || '',
    hubPath: `/c/{companyId}/tools`, // Updated to point to new tools hub
    viewPath: tool.urlSlug ? `/c/{companyId}/reports/${tool.urlSlug}/{runId}` : undefined,
    supportsScore: true,
    defaultEnabled: tool.status === 'enabled',
    icon: tool.icon.charAt(0).toUpperCase() + tool.icon.slice(1), // Capitalize for Lucide
    estimatedTime: tool.estimatedMinutes ? `${tool.estimatedMinutes} min` : undefined,
  };
}

// ============================================================================
// Legacy Tool Registry
// ============================================================================

/**
 * @deprecated Use COMPANY_TOOL_DEFS from lib/tools/registry instead
 */
export const DIAGNOSTIC_TOOLS: DiagnosticToolConfig[] = COMPANY_TOOL_DEFS
  .map(tolegacyConfig)
  .filter((t): t is DiagnosticToolConfig => t !== null);

// ============================================================================
// Legacy Helper Functions
// ============================================================================

/**
 * @deprecated Use viewPath from CompanyToolDefinition instead
 */
export function getToolHubPath(tool: DiagnosticToolConfig, companyId: string): string {
  return tool.hubPath.replace('{companyId}', companyId);
}

/**
 * @deprecated Use viewPath from CompanyToolDefinition instead
 */
export function getToolViewPath(tool: DiagnosticToolConfig, companyId: string, runId: string): string {
  if (!tool.viewPath) return getToolHubPath(tool, companyId);
  return tool.viewPath.replace('{companyId}', companyId).replace('{runId}', runId);
}

/**
 * @deprecated Use getToolById or getToolByDiagnosticId from lib/tools/registry instead
 */
export function getToolConfig(toolId: DiagnosticToolId): DiagnosticToolConfig | undefined {
  return DIAGNOSTIC_TOOLS.find((t) => t.id === toolId);
}

/**
 * @deprecated Use getToolsByCategory from lib/tools/registry instead
 */
export function getToolsByCategory(category: DiagnosticToolCategory): DiagnosticToolConfig[] {
  return DIAGNOSTIC_TOOLS.filter((t) => t.category === category);
}

/**
 * @deprecated Use getEnabledTools from lib/tools/registry instead
 */
export function getEnabledTools(): DiagnosticToolConfig[] {
  return DIAGNOSTIC_TOOLS.filter((t) => t.defaultEnabled);
}

/**
 * @deprecated Use getToolsGroupedByCategory from lib/tools/registry instead
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
 * @deprecated Categories are now human-readable in lib/tools/registry
 */
export function getCategoryLabel(category: DiagnosticToolCategory): string {
  return oldCategoryToNew[category] || category;
}

/**
 * @deprecated Use getCategoryColor from lib/tools/registry instead
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
 * @deprecated Use getAllCategories from lib/tools/registry instead
 */
export function getAllCategories(): DiagnosticToolCategory[] {
  return ['strategy', 'website', 'brand', 'content', 'seo', 'demand', 'ops'];
}
