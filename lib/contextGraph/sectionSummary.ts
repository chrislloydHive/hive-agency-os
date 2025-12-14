// lib/contextGraph/sectionSummary.ts
// Section-level summary types and calculations for Context Graph

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import { DOMAIN_NAMES } from './companyContextGraph';
import type { ProvenanceTag } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary of a single section/domain in the context graph
 */
export interface ContextGraphSectionSummary {
  id: DomainName;
  label: string;
  coverage: number;      // 0-1 (percentage of fields with values)
  health: number;        // 0-1 (derived from freshness/confidence)
  missingCount: number;  // Number of fields without values
  totalFields: number;   // Total fields in this section
  staleCount: number;    // Number of stale fields
  populatedCount: number; // Number of fields with values
}

/**
 * Overall context graph summary with section breakdowns
 */
export interface ContextGraphSummary {
  companyId: string;
  health: number;              // 0-1 overall health score
  completeness: number;        // 0-1 overall coverage
  sections: ContextGraphSectionSummary[];
  totalFields: number;
  totalPopulated: number;
  totalMissing: number;
  totalStale: number;
  lastUpdatedAt: string;
}

// ============================================================================
// Section Labels
// ============================================================================

const SECTION_LABELS: Record<DomainName, string> = {
  identity: 'Identity',
  brand: 'Brand',
  objectives: 'Objectives',
  audience: 'Audience',
  productOffer: 'Product & Offer',
  digitalInfra: 'Digital Infra',
  website: 'Website',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  performanceMedia: 'Media',
  historical: 'Historical',
  creative: 'Creative',
  competitive: 'Competitive',
  budgetOps: 'Budget',
  operationalConstraints: 'Constraints',
  storeRisk: 'Store Risk',
  historyRefs: 'History Refs',
  social: 'Social & Local',
  capabilities: 'Capabilities',
};

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate freshness score for a provenance entry
 * Returns 0-1 where 1 is fresh and 0 is completely stale
 */
function calculateFreshnessScore(provenance: ProvenanceTag | undefined): number {
  if (!provenance) return 0;

  const updatedAt = new Date(provenance.updatedAt);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const validForDays = provenance.validForDays ?? 90;

  // Linear decay from 1.0 to 0.0 over validForDays
  const freshness = Math.max(0, 1 - (daysSinceUpdate / validForDays));
  return freshness;
}

/**
 * Determine if a field is stale based on its provenance
 */
function isFieldStale(provenance: ProvenanceTag | undefined): boolean {
  if (!provenance) return false; // Missing fields aren't stale, they're missing

  const updatedAt = new Date(provenance.updatedAt);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const validForDays = provenance.validForDays ?? 90;

  return daysSinceUpdate > validForDays;
}

/**
 * Calculate section summary for a single domain
 */
export function calculateSectionSummary(
  domain: unknown,
  domainId: DomainName
): ContextGraphSectionSummary {
  let totalFields = 0;
  let populatedFields = 0;
  let staleFields = 0;
  let totalFreshness = 0;
  let totalConfidence = 0;
  let fieldsWithProvenance = 0;

  function analyzeFields(obj: unknown, depth = 0): void {
    if (depth > 10) return;

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const record = obj as Record<string, unknown>;

      // Check if this is a WithMeta object
      if ('value' in record && 'provenance' in record) {
        totalFields++;
        const provenance = (record.provenance as ProvenanceTag[])?.[0];

        if (record.value !== null && record.value !== undefined) {
          // Check for empty arrays
          if (Array.isArray(record.value) && record.value.length === 0) {
            // Empty arrays don't count as populated
          } else {
            populatedFields++;

            if (provenance) {
              fieldsWithProvenance++;
              totalFreshness += calculateFreshnessScore(provenance);
              totalConfidence += provenance.confidence ?? 0;

              if (isFieldStale(provenance)) {
                staleFields++;
              }
            }
          }
        }
      } else {
        // Recurse into nested objects
        for (const value of Object.values(record)) {
          analyzeFields(value, depth + 1);
        }
      }
    }
  }

  analyzeFields(domain);

  // Calculate health as average of freshness and confidence
  const avgFreshness = fieldsWithProvenance > 0 ? totalFreshness / fieldsWithProvenance : 0;
  const avgConfidence = fieldsWithProvenance > 0 ? totalConfidence / fieldsWithProvenance : 0;
  const health = (avgFreshness + avgConfidence) / 2;

  return {
    id: domainId,
    label: SECTION_LABELS[domainId] || domainId,
    coverage: totalFields > 0 ? populatedFields / totalFields : 0,
    health,
    missingCount: totalFields - populatedFields,
    totalFields,
    staleCount: staleFields,
    populatedCount: populatedFields,
  };
}

/**
 * Calculate full graph summary from a CompanyContextGraph
 */
export function calculateGraphSummary(graph: CompanyContextGraph): ContextGraphSummary {
  const sections: ContextGraphSectionSummary[] = [];

  let totalFields = 0;
  let totalPopulated = 0;
  let totalStale = 0;
  let weightedHealth = 0;

  for (const domainId of DOMAIN_NAMES) {
    const domain = graph[domainId];
    const section = calculateSectionSummary(domain, domainId);
    sections.push(section);

    totalFields += section.totalFields;
    totalPopulated += section.populatedCount;
    totalStale += section.staleCount;

    // Weight health by number of fields in the section
    weightedHealth += section.health * section.totalFields;
  }

  const overallHealth = totalFields > 0 ? weightedHealth / totalFields : 0;
  const completeness = totalFields > 0 ? totalPopulated / totalFields : 0;

  return {
    companyId: graph.companyId,
    health: overallHealth,
    completeness,
    sections,
    totalFields,
    totalPopulated,
    totalMissing: totalFields - totalPopulated,
    totalStale,
    lastUpdatedAt: graph.meta.updatedAt,
  };
}

/**
 * Update summary for a single section (optimization for single-field updates)
 * Returns updated section summary only
 */
export function recalculateSectionFromPath(
  graph: CompanyContextGraph,
  path: string
): ContextGraphSectionSummary | null {
  // Extract domain from path (e.g., "identity.businessName" -> "identity")
  const domainId = path.split('.')[0] as DomainName;

  if (!DOMAIN_NAMES.includes(domainId)) {
    console.warn(`[SectionSummary] Unknown domain in path: ${path}`);
    return null;
  }

  const domain = graph[domainId];
  return calculateSectionSummary(domain, domainId);
}

/**
 * Format section summary for logging/debugging
 */
export function formatSummaryForLog(summary: ContextGraphSummary): string {
  const sectionLines = summary.sections
    .filter(s => s.totalFields > 0)
    .map(s => `  ${s.label}: ${Math.round(s.coverage * 100)}% coverage, ${Math.round(s.health * 100)}% health`)
    .join('\n');

  return `ContextGraph summary for ${summary.companyId}:
  Overall: health=${Math.round(summary.health * 100)}%, completeness=${Math.round(summary.completeness * 100)}%
  Fields: ${summary.totalPopulated}/${summary.totalFields} populated, ${summary.totalStale} stale
${sectionLines}`;
}
