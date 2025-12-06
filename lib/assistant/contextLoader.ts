// lib/assistant/contextLoader.ts
// Load comprehensive context for the Company Assistant

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { calculateCompleteness, calculateDomainCoverage } from '@/lib/contextGraph/companyContextGraph';
import { getHealthStatus, computeContextHealthScoreFromCompleteness } from '@/lib/contextGraph/contextHealth';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { listClientInsightsForCompany } from '@/lib/airtable/clientInsights';
import { getWorkItems } from '@/lib/work/workItems';
import { isHumanSource } from '@/lib/contextGraph/sourcePriority';
import type { CompanyContextGraph, DomainName, DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';
import type { AssistantContext, DomainSummary, FieldSummary } from './types';

// Domains in display order with their critical fields
const DOMAIN_CONFIG: Record<string, { label: string; criticalFields: string[] }> = {
  identity: {
    label: 'Identity',
    criticalFields: ['businessName', 'industry', 'icpDescription'],
  },
  brand: {
    label: 'Brand',
    criticalFields: ['positioning', 'differentiators', 'valueProposition'],
  },
  audience: {
    label: 'Audience',
    criticalFields: ['icpDescription', 'primarySegments', 'painPoints'],
  },
  creative: {
    label: 'Creative',
    criticalFields: ['keyMessages', 'proofPoints'],
  },
  objectives: {
    label: 'Objectives',
    criticalFields: ['primaryObjective', 'kpis'],
  },
  productOffer: {
    label: 'Product/Offer',
    criticalFields: ['products', 'keyBenefits'],
  },
  website: {
    label: 'Website',
    criticalFields: ['primaryUrl', 'cmsUsed'],
  },
  content: {
    label: 'Content',
    criticalFields: ['contentThemes', 'contentTypes'],
  },
  seo: {
    label: 'SEO',
    criticalFields: ['primaryKeywords', 'targetKeywords'],
  },
  performanceMedia: {
    label: 'Performance Media',
    criticalFields: ['activeChannels', 'monthlyBudget'],
  },
  competitive: {
    label: 'Competitive',
    criticalFields: ['primaryCompetitors', 'positioningAxes'],
  },
};

/**
 * Load full context for the assistant
 */
export async function loadAssistantContext(companyId: string): Promise<AssistantContext | null> {
  try {
    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      console.log(`[AssistantContext] No context graph found for ${companyId}`);
      return null;
    }

    // Calculate completeness and health
    const completeness = calculateCompleteness(graph);
    const healthScore = computeContextHealthScoreFromCompleteness(completeness);
    const healthStatus = getHealthStatus(healthScore);

    // Get refresh report for detailed diagnostics
    const refreshReport = getNeedsRefreshReport(graph);

    // Build domain summaries
    const domainSummaries = buildDomainSummaries(graph);

    // Find missing critical fields and weak sections
    const missingCritical: string[] = [];
    const weakSections: string[] = [];

    Object.entries(domainSummaries).forEach(([domainName, summary]) => {
      if (summary.criticalMissing.length > 0) {
        missingCritical.push(...summary.criticalMissing.map(f => `${domainName}.${f}`));
      }
      if (summary.completeness < 30) {
        weakSections.push(domainName);
      }
    });

    // Load insights (top 10 open)
    const allInsights = await listClientInsightsForCompany(companyId, { limit: 10 });
    const insights = allInsights
      .filter(i => i.status !== 'dismissed' && i.status !== 'resolved')
      .slice(0, 10)
      .map(i => ({
        id: i.id,
        title: i.title,
        category: i.category,
        severity: i.severity || 'medium',
        status: i.status || 'open',
      }));

    // Load work items (top 10 open)
    const allWorkItems = await getWorkItems(companyId);
    const workItems = allWorkItems
      .filter(w => w.status !== 'Done')
      .slice(0, 10)
      .map(w => ({
        id: w.id,
        title: w.title,
        area: w.area || 'Other',
        status: w.status || 'Backlog',
        priority: w.priority || 'P2',
      }));

    // Build company info from graph
    const company = {
      id: companyId,
      name: graph.companyName || graph.identity.businessName?.value || 'Unknown Company',
      industry: graph.identity.industry?.value || undefined,
      marketMaturity: graph.identity.marketMaturity?.value || undefined,
      tier: undefined, // Could be loaded from company record if needed
    };

    return {
      company,
      contextGraph: {
        domains: domainSummaries,
        completeness,
      },
      contextHealth: {
        score: healthScore,
        status: healthStatus,
        missingCritical,
        weakSections,
      },
      insights,
      workItems,
    };
  } catch (error) {
    console.error('[AssistantContext] Error loading context:', error);
    return null;
  }
}

/**
 * Build domain summaries from the context graph
 */
function buildDomainSummaries(graph: CompanyContextGraph): Record<string, DomainSummary> {
  const summaries: Record<string, DomainSummary> = {};
  const coverage = calculateDomainCoverage(graph);

  for (const [domainName, config] of Object.entries(DOMAIN_CONFIG)) {
    const domainObj = graph[domainName as DomainName];
    if (!domainObj || typeof domainObj !== 'object') continue;

    const domainCoverage = coverage[domainName as DomainName];
    const fields: Record<string, FieldSummary> = {};
    const criticalMissing: string[] = [];
    let populatedCount = 0;
    let totalCount = 0;

    // Iterate through domain fields
    for (const [fieldName, fieldData] of Object.entries(domainObj)) {
      if (!fieldData || typeof fieldData !== 'object') continue;
      if (!('value' in fieldData) || !('provenance' in fieldData)) continue;

      totalCount++;
      const hasValue = fieldData.value !== null && fieldData.value !== undefined &&
        !(Array.isArray(fieldData.value) && fieldData.value.length === 0);

      if (hasValue) {
        populatedCount++;
      }

      const topProvenance = fieldData.provenance?.[0];
      const isHumanOverride = topProvenance ? isHumanSource(topProvenance.source) : false;

      fields[fieldName] = {
        value: fieldData.value,
        hasValue,
        confidence: topProvenance?.confidence ?? 0,
        source: topProvenance?.source,
        isHumanOverride,
        provenance: (fieldData.provenance || []).slice(0, 3).map((p: any) => ({
          source: p.source,
          confidence: p.confidence,
          updatedAt: p.updatedAt,
        })),
      };

      // Check if this is a critical field that's missing
      if (!hasValue && config.criticalFields.includes(fieldName)) {
        criticalMissing.push(fieldName);
      }
    }

    summaries[domainName] = {
      name: config.label,
      completeness: totalCount > 0 ? Math.round((populatedCount / totalCount) * 100) : 0,
      populatedFields: populatedCount,
      totalFields: totalCount,
      criticalMissing,
      fields,
    };
  }

  return summaries;
}

/**
 * Format context for the AI prompt
 */
export function formatContextForPrompt(context: AssistantContext): string {
  const sections: string[] = [];

  // Company header
  sections.push(`## Company: ${context.company.name}`);
  if (context.company.industry) {
    sections.push(`Industry: ${context.company.industry}`);
  }
  if (context.company.marketMaturity) {
    sections.push(`Market Maturity: ${context.company.marketMaturity}`);
  }

  // Context Health
  sections.push(`\n## Context Health`);
  sections.push(`Score: ${context.contextHealth.score}% (${context.contextHealth.status})`);
  sections.push(`Overall Completeness: ${context.contextGraph.completeness}%`);

  if (context.contextHealth.missingCritical.length > 0) {
    sections.push(`\nMissing Critical Fields:`);
    context.contextHealth.missingCritical.slice(0, 10).forEach(field => {
      sections.push(`- ${field}`);
    });
  }

  if (context.contextHealth.weakSections.length > 0) {
    sections.push(`\nWeak Sections (< 30% complete):`);
    context.contextHealth.weakSections.forEach(section => {
      const domain = context.contextGraph.domains[section];
      sections.push(`- ${domain?.name || section}: ${domain?.completeness || 0}%`);
    });
  }

  // Domain-by-domain summary
  sections.push(`\n## Context Graph Summary`);

  for (const [domainName, domain] of Object.entries(context.contextGraph.domains)) {
    if (domain.completeness === 0) continue;

    sections.push(`\n### ${domain.name} (${domain.completeness}% complete)`);

    // Show populated fields with their values (truncated)
    const populatedFields = Object.entries(domain.fields)
      .filter(([_, f]) => f.hasValue)
      .slice(0, 8);

    populatedFields.forEach(([fieldName, field]) => {
      const valueStr = formatFieldValue(field.value);
      const sourceTag = field.isHumanOverride ? ' [HUMAN]' : field.source ? ` [${field.source}]` : '';
      sections.push(`- ${fieldName}: ${valueStr}${sourceTag}`);
    });

    // Note remaining fields
    const remainingCount = Object.keys(domain.fields).filter(k =>
      domain.fields[k].hasValue && !populatedFields.find(([name]) => name === k)
    ).length;
    if (remainingCount > 0) {
      sections.push(`  ... and ${remainingCount} more fields`);
    }
  }

  // Recent Insights
  if (context.insights && context.insights.length > 0) {
    sections.push(`\n## Recent Insights`);
    context.insights.slice(0, 5).forEach(insight => {
      sections.push(`- [${insight.severity}] ${insight.title} (${insight.category})`);
    });
  }

  // Open Work Items
  if (context.workItems && context.workItems.length > 0) {
    sections.push(`\n## Open Work Items`);
    context.workItems.slice(0, 5).forEach(item => {
      sections.push(`- [${item.priority}] ${item.title} (${item.area})`);
    });
  }

  return sections.join('\n');
}

/**
 * Format a field value for display (truncate long values)
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';

  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty array)';
    if (typeof value[0] === 'string') {
      const preview = value.slice(0, 3).join(', ');
      return value.length > 3 ? `[${preview}, ...]` : `[${preview}]`;
    }
    return `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as object);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }

  const str = String(value);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
}
