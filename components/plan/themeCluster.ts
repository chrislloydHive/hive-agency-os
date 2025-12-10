// components/plan/themeCluster.ts
// Theme clustering logic for grouping findings into strategic themes
//
// This is frontend-only logic - no data persistence.
// Uses heuristics based on lab source, category, and keywords.

import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Theme Definitions
// ============================================================================

export interface Theme {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  keywords: string[];
  labs: string[];
  categories: string[];
}

export const STRATEGIC_THEMES: Theme[] = [
  {
    id: 'website-clarity',
    name: 'Website Clarity & Conversion',
    description: 'UX, messaging clarity, CTAs, and conversion optimization',
    icon: 'Globe',
    color: 'blue',
    keywords: ['cta', 'clarity', 'conversion', 'ux', 'usability', 'navigation', 'hero', 'form', 'button', 'layout', 'mobile', 'responsive'],
    labs: ['website'],
    categories: ['UX', 'Technical'],
  },
  {
    id: 'brand-positioning',
    name: 'Brand Positioning & Messaging',
    description: 'Differentiation, value proposition, and brand identity',
    icon: 'Sparkles',
    color: 'pink',
    keywords: ['brand', 'positioning', 'differentiation', 'value prop', 'messaging', 'identity', 'tagline', 'voice', 'tone'],
    labs: ['brand'],
    categories: ['Brand'],
  },
  {
    id: 'seo-visibility',
    name: 'SEO Visibility & Structure',
    description: 'Search rankings, technical SEO, and content optimization',
    icon: 'Search',
    color: 'cyan',
    keywords: ['seo', 'search', 'ranking', 'keyword', 'meta', 'title', 'description', 'structured', 'sitemap', 'robots', 'crawl', 'index'],
    labs: ['seo'],
    categories: ['SEO'],
  },
  {
    id: 'content-strategy',
    name: 'Content Strategy & Quality',
    description: 'Content gaps, quality, and engagement opportunities',
    icon: 'FileText',
    color: 'emerald',
    keywords: ['content', 'blog', 'article', 'copy', 'writing', 'headline', 'readability', 'engagement'],
    labs: ['content'],
    categories: ['Content'],
  },
  {
    id: 'analytics-ops',
    name: 'Analytics & Ops Infrastructure',
    description: 'Tracking, measurement, and operational systems',
    icon: 'BarChart3',
    color: 'purple',
    keywords: ['analytics', 'tracking', 'tag', 'pixel', 'gtm', 'google', 'measurement', 'ops', 'automation', 'crm', 'integration'],
    labs: ['ops', 'gap'],
    categories: ['Analytics', 'Ops'],
  },
  {
    id: 'demand-acquisition',
    name: 'Demand & Acquisition',
    description: 'Lead generation, funnel optimization, and demand creation',
    icon: 'TrendingUp',
    color: 'orange',
    keywords: ['demand', 'lead', 'funnel', 'acquisition', 'campaign', 'advertising', 'paid', 'social', 'channel'],
    labs: ['demand'],
    categories: ['Demand', 'Media'],
  },
  {
    id: 'other',
    name: 'Other Opportunities',
    description: 'Additional findings and opportunities',
    icon: 'Lightbulb',
    color: 'slate',
    keywords: [],
    labs: [],
    categories: [],
  },
];

// ============================================================================
// Clustering Functions
// ============================================================================

/**
 * Assign a finding to a theme based on heuristics
 */
export function assignTheme(finding: DiagnosticDetailFinding): string {
  const labSlug = (finding.labSlug || '').toLowerCase();
  const category = (finding.category || '').toLowerCase();
  const description = (finding.description || '').toLowerCase();
  const dimension = (finding.dimension || '').toLowerCase();

  // First, try to match by lab
  for (const theme of STRATEGIC_THEMES) {
    if (theme.id === 'other') continue; // Skip fallback
    if (theme.labs.some(l => labSlug.includes(l))) {
      return theme.id;
    }
  }

  // Then, try to match by category
  for (const theme of STRATEGIC_THEMES) {
    if (theme.id === 'other') continue;
    if (theme.categories.some(c => category.includes(c.toLowerCase()))) {
      return theme.id;
    }
  }

  // Finally, try to match by keywords in description/dimension
  const textToSearch = `${description} ${dimension}`;
  for (const theme of STRATEGIC_THEMES) {
    if (theme.id === 'other') continue;
    if (theme.keywords.some(k => textToSearch.includes(k))) {
      return theme.id;
    }
  }

  // Fallback
  return 'other';
}

/**
 * Group findings by theme
 */
export function clusterByTheme(
  findings: DiagnosticDetailFinding[]
): Map<string, DiagnosticDetailFinding[]> {
  const clusters = new Map<string, DiagnosticDetailFinding[]>();

  // Initialize all themes
  for (const theme of STRATEGIC_THEMES) {
    clusters.set(theme.id, []);
  }

  // Assign each finding
  for (const finding of findings) {
    const themeId = assignTheme(finding);
    const cluster = clusters.get(themeId) || [];
    cluster.push(finding);
    clusters.set(themeId, cluster);
  }

  return clusters;
}

/**
 * Get theme by ID
 */
export function getTheme(id: string): Theme | undefined {
  return STRATEGIC_THEMES.find(t => t.id === id);
}

/**
 * Get non-empty themes with their findings
 */
export function getNonEmptyThemes(
  findings: DiagnosticDetailFinding[]
): { theme: Theme; findings: DiagnosticDetailFinding[] }[] {
  const clusters = clusterByTheme(findings);
  const result: { theme: Theme; findings: DiagnosticDetailFinding[] }[] = [];

  for (const theme of STRATEGIC_THEMES) {
    const themeFindings = clusters.get(theme.id) || [];
    if (themeFindings.length > 0) {
      result.push({ theme, findings: themeFindings });
    }
  }

  return result;
}

// ============================================================================
// Priority Clustering
// ============================================================================

/**
 * Group findings by priority (severity)
 */
export function clusterByPriority(
  findings: DiagnosticDetailFinding[]
): Map<string, DiagnosticDetailFinding[]> {
  const clusters = new Map<string, DiagnosticDetailFinding[]>();

  // Initialize priority lanes
  const priorities = ['critical', 'high', 'medium', 'low'];
  for (const p of priorities) {
    clusters.set(p, []);
  }

  // Assign each finding
  for (const finding of findings) {
    const priority = finding.severity || 'medium';
    const cluster = clusters.get(priority) || [];
    cluster.push(finding);
    clusters.set(priority, cluster);
  }

  return clusters;
}

// ============================================================================
// Lab Clustering
// ============================================================================

/**
 * Group findings by lab source
 */
export function clusterByLab(
  findings: DiagnosticDetailFinding[]
): Map<string, DiagnosticDetailFinding[]> {
  const clusters = new Map<string, DiagnosticDetailFinding[]>();

  for (const finding of findings) {
    const lab = finding.labSlug || 'unknown';
    const cluster = clusters.get(lab) || [];
    cluster.push(finding);
    clusters.set(lab, cluster);
  }

  return clusters;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get theme statistics
 */
export function getThemeStats(findings: DiagnosticDetailFinding[]): {
  themes: { theme: Theme; count: number; criticalCount: number }[];
  totalByPriority: Record<string, number>;
} {
  const clusters = clusterByTheme(findings);
  const themes: { theme: Theme; count: number; criticalCount: number }[] = [];

  for (const theme of STRATEGIC_THEMES) {
    const themeFindings = clusters.get(theme.id) || [];
    if (themeFindings.length > 0) {
      themes.push({
        theme,
        count: themeFindings.length,
        criticalCount: themeFindings.filter(f => f.severity === 'critical' || f.severity === 'high').length,
      });
    }
  }

  // Sort by critical count, then total count
  themes.sort((a, b) => b.criticalCount - a.criticalCount || b.count - a.count);

  // Calculate totals by priority
  const totalByPriority: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const finding of findings) {
    const priority = finding.severity || 'medium';
    totalByPriority[priority] = (totalByPriority[priority] || 0) + 1;
  }

  return { themes, totalByPriority };
}
