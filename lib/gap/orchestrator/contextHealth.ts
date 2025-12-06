// lib/gap/orchestrator/contextHealth.ts
// Context health assessment for the GAP Orchestrator

import type { CompanyContextGraph, DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType } from '@/lib/contextGraph/types';
import type { ContextHealthAssessment } from './types';

// ============================================================================
// Critical Fields Definition
// ============================================================================

/**
 * Fields that are critical for Labs to run effectively.
 * These are prioritized when assessing context health.
 */
const CRITICAL_FIELDS: string[] = [
  // Identity - foundational
  'identity.businessName',
  'identity.industry',
  'identity.businessModel',
  'identity.uniqueSellingPoints',

  // Brand - required for brand/creative labs
  'brand.positioning',
  'brand.valueProps',
  'brand.differentiators',
  'brand.toneOfVoice',

  // Audience - required for audience lab
  'audience.coreSegments',
  'audience.demographics',
  'audience.painPoints',
  'audience.motivations',

  // Objectives - required for strategic recommendations
  'objectives.primaryObjective',
  'objectives.kpiLabels',

  // Website - required for website lab
  'website.primaryUrl',

  // SEO - required for SEO lab
  'seo.targetKeywords',
  'seo.competitorDomains',

  // Content - required for content lab
  'content.contentTypes',
  'content.topicClusters',

  // Performance Media - required for media lab
  'performanceMedia.activeChannels',
  'performanceMedia.blendedCpa',
  'performanceMedia.blendedRoas',
];

/**
 * Freshness threshold in days - fields older than this are considered stale
 */
const FRESHNESS_THRESHOLD_DAYS = 90;

// ============================================================================
// Health Assessment Functions
// ============================================================================

/**
 * Assess the health of a company's context graph.
 *
 * Returns completeness, freshness, and lists of missing/stale fields.
 */
export function assessContextHealth(graph: CompanyContextGraph | null): ContextHealthAssessment {
  if (!graph) {
    return {
      completeness: 0,
      freshness: 0,
      missingCriticalFields: [...CRITICAL_FIELDS],
      staleFields: [],
      staleSections: [],
      recommendations: ['No context graph exists. Run Setup wizard or import company data.'],
    };
  }

  const missingCriticalFields: string[] = [];
  const staleFields: string[] = [];
  const staleSections = new Set<string>();
  const now = Date.now();
  const thresholdMs = FRESHNESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  let totalFields = 0;
  let populatedFields = 0;
  let freshFields = 0;

  // Check all fields in the graph
  for (const domainKey of Object.keys(graph) as (keyof CompanyContextGraph)[]) {
    // Skip non-domain keys
    if (['companyId', 'companyName', 'meta'].includes(domainKey)) continue;

    const domain = graph[domainKey];
    if (!domain || typeof domain !== 'object') continue;

    for (const [fieldName, fieldValue] of Object.entries(domain)) {
      // Check if this is a WithMeta field
      if (!fieldValue || typeof fieldValue !== 'object' || !('value' in fieldValue)) {
        continue;
      }

      const field = fieldValue as WithMetaType<unknown>;
      const fieldPath = `${domainKey}.${fieldName}`;
      totalFields++;

      // Check if populated
      const value = field.value;
      const isPopulated =
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'string' && value.trim() === '');

      if (isPopulated) {
        populatedFields++;

        // Check freshness
        const provenance = field.provenance || [];
        const lastUpdate = provenance[0]?.updatedAt;

        if (lastUpdate) {
          const updateTime = new Date(lastUpdate).getTime();
          const age = now - updateTime;

          if (age > thresholdMs) {
            staleFields.push(fieldPath);
            staleSections.add(domainKey);
          } else {
            freshFields++;
          }
        } else {
          // No provenance = consider stale
          staleFields.push(fieldPath);
          staleSections.add(domainKey);
        }
      }

      // Check if critical and missing
      if (!isPopulated && CRITICAL_FIELDS.includes(fieldPath)) {
        missingCriticalFields.push(fieldPath);
      }
    }
  }

  // Calculate scores
  const completeness = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
  const freshness = populatedFields > 0 ? Math.round((freshFields / populatedFields) * 100) : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (missingCriticalFields.length > 0) {
    const byDomain = groupByDomain(missingCriticalFields);
    for (const [domain, fields] of Object.entries(byDomain)) {
      recommendations.push(`Run ${getLabNameForDomain(domain)} to populate: ${fields.join(', ')}`);
    }
  }

  if (staleFields.length > 5) {
    recommendations.push(`${staleFields.length} fields are stale (>90 days). Consider running a full refresh.`);
  }

  if (completeness < 30) {
    recommendations.push('Context is very incomplete. Run Setup wizard to bootstrap company data.');
  }

  return {
    completeness,
    freshness,
    missingCriticalFields,
    staleFields,
    staleSections: Array.from(staleSections),
    recommendations,
  };
}

/**
 * Get a quick health score (0-100) combining completeness and freshness
 */
export function getQuickHealthScore(graph: CompanyContextGraph | null): number {
  const health = assessContextHealth(graph);
  // Weight completeness more heavily than freshness
  return Math.round(health.completeness * 0.7 + health.freshness * 0.3);
}

// ============================================================================
// Helpers
// ============================================================================

function groupByDomain(fields: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const field of fields) {
    const [domain, fieldName] = field.split('.');
    if (!result[domain]) result[domain] = [];
    result[domain].push(fieldName);
  }
  return result;
}

function getLabNameForDomain(domain: string): string {
  const map: Record<string, string> = {
    identity: 'Setup wizard',
    brand: 'Brand Lab',
    audience: 'Audience Lab',
    objectives: 'Setup wizard',
    website: 'Website Lab',
    seo: 'SEO Lab',
    content: 'Content Lab',
    performanceMedia: 'Media Lab',
    ops: 'Ops Lab',
    digitalInfra: 'Demand Lab',
    creative: 'Creative Lab',
  };
  return map[domain] || 'appropriate Lab';
}

/**
 * Get fields that should be filled by a specific lab
 */
export function getCriticalFieldsForLab(labId: string): string[] {
  const labFieldMap: Record<string, string[]> = {
    brand: CRITICAL_FIELDS.filter((f) => f.startsWith('brand.')),
    audience: CRITICAL_FIELDS.filter((f) => f.startsWith('audience.')),
    website: CRITICAL_FIELDS.filter((f) => f.startsWith('website.')),
    seo: CRITICAL_FIELDS.filter((f) => f.startsWith('seo.')),
    content: CRITICAL_FIELDS.filter((f) => f.startsWith('content.')),
    media: CRITICAL_FIELDS.filter((f) => f.startsWith('performanceMedia.')),
    ops: CRITICAL_FIELDS.filter((f) => f.startsWith('ops.')),
    demand: CRITICAL_FIELDS.filter((f) => f.startsWith('digitalInfra.')),
    creative: CRITICAL_FIELDS.filter((f) => f.startsWith('creative.')),
  };
  return labFieldMap[labId] || [];
}
