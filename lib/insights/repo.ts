// lib/insights/repo.ts
// Repository functions for Brain Insights - extends clientBrain

import {
  createClientInsight,
  getCompanyInsights,
  updateClientInsight,
} from '@/lib/airtable/clientBrain';
import type {
  ClientInsight,
  CreateClientInsightInput,
  InsightCategory,
  InsightSeverity,
  InsightStatus,
  InsightSourceType,
} from '@/lib/types/clientBrain';
import type { InsightUnit } from './extractorSchema';

// ============================================================================
// Types
// ============================================================================

export interface InsightFilters {
  category?: InsightCategory;
  severity?: InsightSeverity;
  status?: InsightStatus;
  sourceType?: InsightSourceType;
  limit?: number;
  excludeDismissed?: boolean;
}

export interface BulkInsightInput {
  units: InsightUnit[];
  companyId: string;
  sourceType: InsightSourceType;
  sourceRunId?: string;
  toolSlug?: string;
}

// ============================================================================
// Create Insights
// ============================================================================

/**
 * Create multiple insights from extracted InsightUnits
 */
export async function createInsightsFromUnits(
  params: BulkInsightInput
): Promise<ClientInsight[]> {
  const { units, companyId, sourceType, sourceRunId, toolSlug } = params;

  const created: ClientInsight[] = [];

  for (const unit of units) {
    try {
      // Build the body with summary + recommendation
      const bodyParts = [unit.summary];
      if (unit.recommendation) {
        bodyParts.push('', '**Recommendation:**', unit.recommendation);
      }
      if (unit.rationale) {
        bodyParts.push('', '**Why this matters:**', unit.rationale);
      }
      if (unit.metrics && Object.keys(unit.metrics).length > 0) {
        bodyParts.push('', '**Metrics:**');
        for (const [key, value] of Object.entries(unit.metrics)) {
          bodyParts.push(`- ${key}: ${value}`);
        }
      }

      const input: CreateClientInsightInput = {
        title: unit.title,
        body: bodyParts.join('\n'),
        category: mapExtractedCategory(unit.category),
        severity: unit.severity,
        status: 'open',
        source: {
          type: 'tool_run',
          toolSlug,
          toolRunId: sourceRunId,
        },
        recommendation: unit.recommendation,
        rationale: unit.rationale,
        contextPaths: unit.contextPaths,
        metrics: unit.metrics,
      };

      const insight = await createClientInsight(companyId, input);
      created.push(insight);
    } catch (error) {
      console.error('[InsightRepo] Failed to create insight:', unit.title, error);
    }
  }

  console.log(`[InsightRepo] Created ${created.length}/${units.length} insights for ${companyId}`);
  return created;
}

/**
 * Map extracted category to ClientInsight category
 * Note: Airtable Category field has limited options - map to closest match
 *
 * Known Airtable categories (based on successful creates):
 * - brand, website, content, seo, audience, other
 *
 * Categories that DON'T exist in Airtable:
 * - media, conversion, kpi_risk, growth_opportunity, competitive, ops, demand, creative
 */
function mapExtractedCategory(category: string): InsightCategory {
  // Map all categories to Airtable-compatible ones
  const airtableMappings: Record<string, InsightCategory> = {
    // Direct matches (these exist in Airtable)
    brand: 'brand',
    website: 'website',
    content: 'content',
    seo: 'seo',
    audience: 'audience',
    other: 'other',

    // Map to closest Airtable category
    seo_content: 'seo',
    media: 'other',           // No media category in Airtable
    conversion: 'website',    // Conversion relates to website
    kpi_risk: 'other',        // No kpi_risk in Airtable
    growth_opportunity: 'other',
    competitive: 'other',
    ops: 'other',
    demand: 'other',
    creative: 'brand',        // Creative relates to brand
    digitalFootprint: 'other',
  };

  return airtableMappings[category] || 'other';
}

// ============================================================================
// Query Insights
// ============================================================================

/**
 * Get insights for a company with filters
 */
export async function getInsightsForCompany(
  companyId: string,
  filters: InsightFilters = {}
): Promise<ClientInsight[]> {
  const insights = await getCompanyInsights(companyId, {
    category: filters.category,
    severity: filters.severity,
    limit: filters.limit || 100,
  });

  // Apply additional filters not supported by Airtable query
  let filtered = insights;

  if (filters.excludeDismissed) {
    filtered = filtered.filter((i) => i.status !== 'dismissed');
  }

  if (filters.status) {
    filtered = filtered.filter((i) => i.status === filters.status);
  }

  if (filters.sourceType) {
    filtered = filtered.filter((i) => i.source.type === filters.sourceType);
  }

  return filtered;
}

/**
 * Get ranked insights for Brain UI
 */
export async function getRankedInsightsForCompany(
  companyId: string
): Promise<ClientInsight[]> {
  const insights = await getInsightsForCompany(companyId, {
    excludeDismissed: true,
    limit: 100,
  });

  // Sort by severity (critical first), then by date (newest first)
  const severityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return insights.sort((a, b) => {
    // First by severity
    const severityDiff =
      (severityOrder[b.severity || 'medium'] || 2) -
      (severityOrder[a.severity || 'medium'] || 2);
    if (severityDiff !== 0) return severityDiff;

    // Then by status (open first)
    const statusOrder: Record<string, number> = {
      open: 3,
      in_progress: 2,
      resolved: 1,
      dismissed: 0,
    };
    const statusDiff =
      (statusOrder[b.status || 'open'] || 3) -
      (statusOrder[a.status || 'open'] || 3);
    if (statusDiff !== 0) return statusDiff;

    // Then by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ============================================================================
// Update Insights
// ============================================================================

/**
 * Update insight status
 */
export async function updateInsightStatus(
  insightId: string,
  status: InsightStatus
): Promise<ClientInsight> {
  return updateClientInsight(insightId, { status });
}

/**
 * Link insight to work item
 */
export async function linkInsightToWorkItem(
  insightId: string,
  workItemId: string
): Promise<ClientInsight> {
  return updateClientInsight(insightId, {
    linkedWorkItemId: workItemId,
    status: 'in_progress',
  });
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Check if a similar insight already exists
 */
export async function findSimilarInsight(
  companyId: string,
  title: string,
  category: InsightCategory
): Promise<ClientInsight | null> {
  const insights = await getInsightsForCompany(companyId, {
    category,
    limit: 50,
  });

  // Simple title similarity check
  const normalizedTitle = title.toLowerCase().trim();
  return (
    insights.find((i) => {
      const existingTitle = i.title.toLowerCase().trim();
      // Exact match or very similar
      return (
        existingTitle === normalizedTitle ||
        existingTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(existingTitle)
      );
    }) || null
  );
}

/**
 * Deduplicate insights before creating
 */
export async function deduplicateAndCreate(
  params: BulkInsightInput
): Promise<{ created: ClientInsight[]; skipped: number }> {
  const { units, companyId } = params;

  const toCreate: InsightUnit[] = [];
  let skipped = 0;

  for (const unit of units) {
    const existing = await findSimilarInsight(
      companyId,
      unit.title,
      mapExtractedCategory(unit.category)
    );

    if (existing) {
      console.log(`[InsightRepo] Skipping duplicate: "${unit.title}"`);
      skipped++;
    } else {
      toCreate.push(unit);
    }
  }

  const created = await createInsightsFromUnits({
    ...params,
    units: toCreate,
  });

  return { created, skipped };
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get insight counts by status
 */
export async function getInsightStats(
  companyId: string
): Promise<{
  open: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
  total: number;
}> {
  const insights = await getInsightsForCompany(companyId, { limit: 500 });

  const stats = {
    open: 0,
    inProgress: 0,
    resolved: 0,
    dismissed: 0,
    total: insights.length,
  };

  for (const insight of insights) {
    switch (insight.status) {
      case 'open':
        stats.open++;
        break;
      case 'in_progress':
        stats.inProgress++;
        break;
      case 'resolved':
        stats.resolved++;
        break;
      case 'dismissed':
        stats.dismissed++;
        break;
      default:
        stats.open++; // Default to open
    }
  }

  return stats;
}
