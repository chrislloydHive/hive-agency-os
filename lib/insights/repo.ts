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

export interface BulkInsightResult {
  created: ClientInsight[];
  failed: { title: string; error: string }[];
  skipped: string[];
}

// ============================================================================
// Create Insights
// ============================================================================

/**
 * Create multiple insights from extracted InsightUnits
 * Returns structured result with created/failed/skipped counts for resilient ingestion.
 */
export async function createInsightsFromUnits(
  params: BulkInsightInput
): Promise<BulkInsightResult> {
  const { units, companyId, sourceType, sourceRunId, toolSlug } = params;

  const result: BulkInsightResult = {
    created: [],
    failed: [],
    skipped: [],
  };

  for (const unit of units) {
    // Skip units with no title
    if (!unit.title?.trim()) {
      result.skipped.push('(empty title)');
      continue;
    }

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
      result.created.push(insight);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[InsightRepo] Failed to create insight:', unit.title, errorMsg);
      result.failed.push({ title: unit.title, error: errorMsg });
      // Continue with next insight - don't break the batch
    }
  }

  console.log(`[InsightRepo] Insights: ${result.created.length} created, ${result.failed.length} failed, ${result.skipped.length} skipped for ${companyId}`);
  return result;
}

/**
 * Map extracted category to ClientInsight category
 * Note: Airtable Category field has limited options - map to closest match
 *
 * Actual Airtable categories (from Airtable UI):
 * brand, content, seo, website, analytics, demand, ops, competitive, structural, product, other
 *
 * Note: Final coercion happens in clientBrain.ts via coerceInsightCategory()
 * This pre-mapping helps align AI outputs to valid categories.
 */
function mapExtractedCategory(category: string): InsightCategory {
  // Normalize input
  const normalized = category?.toLowerCase().trim() || 'other';

  // Map all categories to Airtable-compatible ones
  const airtableMappings: Record<string, InsightCategory> = {
    // Direct matches (these exist in Airtable)
    brand: 'brand',
    content: 'content',
    seo: 'seo',
    website: 'website',
    analytics: 'analytics',
    demand: 'demand',
    ops: 'ops',
    competitive: 'competitive',
    structural: 'structural',
    product: 'product',
    other: 'other',

    // Map common AI outputs to valid categories
    audience: 'brand',          // No 'audience' - map to brand (ICP/targeting)
    strategy: 'structural',     // No 'strategy' - map to structural
    media: 'demand',            // Media relates to demand gen
    conversion: 'demand',       // Conversion relates to demand
    funnel: 'demand',
    leads: 'demand',
    pipeline: 'demand',
    creative: 'brand',          // Creative relates to brand
    messaging: 'brand',
    positioning: 'brand',
    trust: 'brand',
    visual: 'brand',
    identity: 'brand',
    seo_content: 'seo',
    technical: 'website',
    performance: 'website',
    ux: 'website',
    kpi_risk: 'analytics',
    metrics: 'analytics',
    tracking: 'analytics',
    growth_opportunity: 'demand',
    digitalFootprint: 'website',
    operations: 'ops',
    process: 'ops',
    competition: 'competitive',
    competitors: 'competitive',
  };

  return airtableMappings[normalized] || 'other';
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
): Promise<{ created: ClientInsight[]; skipped: number; failed: number }> {
  const { units, companyId } = params;

  const toCreate: InsightUnit[] = [];
  let skippedDupes = 0;

  for (const unit of units) {
    const existing = await findSimilarInsight(
      companyId,
      unit.title,
      mapExtractedCategory(unit.category)
    );

    if (existing) {
      console.log(`[InsightRepo] Skipping duplicate: "${unit.title}"`);
      skippedDupes++;
    } else {
      toCreate.push(unit);
    }
  }

  const result = await createInsightsFromUnits({
    ...params,
    units: toCreate,
  });

  return {
    created: result.created,
    skipped: skippedDupes + result.skipped.length,
    failed: result.failed.length,
  };
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
