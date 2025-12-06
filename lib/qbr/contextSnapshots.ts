// lib/qbr/contextSnapshots.ts
// Context Graph Snapshot Enrichment for QBR
//
// Creates enriched field snapshots from the Context Graph with full metadata
// including status, confidence, freshness, and source tracking.

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { ProvenanceTag, WithMetaType } from '@/lib/contextGraph/types';
import { DEFAULT_VALIDITY_DAYS, getMostRecent, getHighestConfidence } from '@/lib/contextGraph/types';
import type { QbrDomain } from './qbrTypes';

// ============================================================================
// Types
// ============================================================================

export type ContextFieldStatus = 'ok' | 'conflicted' | 'missing' | 'stale';

export interface ContextFieldSource {
  source: string;
  confidence: number;
  timestamp: string;
}

export interface ContextFieldSnapshot {
  /** Full field path, e.g., "identity.revenueModel" */
  key: string;
  /** Mapped QBR domain */
  domain: QbrDomain;
  /** Current value */
  value: any;
  /** Field status based on provenance analysis */
  status: ContextFieldStatus;
  /** Aggregated confidence score 0-100 */
  confidence: number;
  /** Freshness score 0-100 based on age and validity period */
  freshness: number;
  /** Whether the field has a human override (user/manual source) */
  isHumanOverride: boolean;
  /** Source history with confidence and timestamps */
  sources: ContextFieldSource[];
}

// ============================================================================
// Domain Mapping
// ============================================================================

const CONTEXT_DOMAIN_TO_QBR: Record<string, QbrDomain> = {
  identity: 'strategy',
  objectives: 'strategy',
  brand: 'brand',
  audience: 'audience',
  productOffer: 'strategy',
  website: 'website',
  seo: 'seo',
  content: 'content',
  creative: 'content',
  performanceMedia: 'media',
  budgetOps: 'media',
  ops: 'analytics',
  digitalInfra: 'analytics',
  historical: 'analytics',
  competitive: 'strategy',
  operationalConstraints: 'analytics',
  storeRisk: 'analytics',
  historyRefs: 'analytics',
};

function mapToQbrDomain(contextDomain: string): QbrDomain {
  return CONTEXT_DOMAIN_TO_QBR[contextDomain] || 'strategy';
}

// ============================================================================
// Human Source Detection
// ============================================================================

const HUMAN_SOURCES = new Set(['user', 'manual', 'setup_wizard']);

function isHumanSource(source: string): boolean {
  return HUMAN_SOURCES.has(source);
}

// ============================================================================
// Freshness Calculation
// ============================================================================

function computeFreshness(provenance: ProvenanceTag[]): number {
  if (provenance.length === 0) return 0;

  const mostRecent = getMostRecent(provenance);
  if (!mostRecent) return 0;

  const updatedAt = new Date(mostRecent.updatedAt).getTime();
  const now = Date.now();
  const ageInDays = (now - updatedAt) / (1000 * 60 * 60 * 24);

  // Get validity period (default or explicit)
  const validForDays = mostRecent.validForDays || DEFAULT_VALIDITY_DAYS[mostRecent.source] || 90;

  // Calculate freshness as percentage of remaining validity
  if (ageInDays >= validForDays) {
    return 0; // Fully stale
  }

  const freshnessRatio = 1 - (ageInDays / validForDays);
  return Math.round(freshnessRatio * 100);
}

// ============================================================================
// Conflict Detection
// ============================================================================

function detectConflict(provenance: ProvenanceTag[]): boolean {
  if (provenance.length < 2) return false;

  // Get recent sources (within last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSources = provenance.filter(
    p => new Date(p.updatedAt).getTime() > thirtyDaysAgo
  );

  if (recentSources.length < 2) return false;

  // Check for significant confidence divergence
  const confidences = recentSources.map(p => p.confidence);
  const maxConf = Math.max(...confidences);
  const minConf = Math.min(...confidences);

  // If confidence diverges by more than 0.3, it's a potential conflict
  return (maxConf - minConf) > 0.3;
}

// ============================================================================
// Field Status Determination
// ============================================================================

function determineFieldStatus(
  value: any,
  provenance: ProvenanceTag[],
  freshness: number
): ContextFieldStatus {
  // Missing if no value
  if (value === null || value === undefined || value === '') {
    return 'missing';
  }

  // Check for conflicts
  if (detectConflict(provenance)) {
    return 'conflicted';
  }

  // Stale if freshness is below threshold
  if (freshness < 60) {
    return 'stale';
  }

  return 'ok';
}

// ============================================================================
// Field Extraction
// ============================================================================

function extractFieldSnapshot(
  key: string,
  domain: string,
  field: WithMetaType<any>
): ContextFieldSnapshot {
  const provenance = field.provenance || [];
  const value = field.value;

  // Compute metrics
  const freshness = computeFreshness(provenance);
  const highestConfProv = getHighestConfidence(provenance);
  const confidence = highestConfProv
    ? Math.round(highestConfProv.confidence * 100)
    : 0;

  // Check for human override
  const isHumanOverride = provenance.some(p => isHumanSource(p.source));

  // Build sources array
  const sources: ContextFieldSource[] = provenance.map(p => ({
    source: p.source,
    confidence: Math.round(p.confidence * 100),
    timestamp: p.updatedAt,
  }));

  // Determine status
  const status = determineFieldStatus(value, provenance, freshness);

  return {
    key,
    domain: mapToQbrDomain(domain),
    value,
    status,
    confidence,
    freshness,
    isHumanOverride,
    sources,
  };
}

// ============================================================================
// Graph Traversal
// ============================================================================

function isWithMetaField(obj: any): obj is WithMetaType<any> {
  return obj && typeof obj === 'object' && 'provenance' in obj && Array.isArray(obj.provenance);
}

function extractFieldsFromDomain(
  domainName: string,
  domainData: any,
  prefix: string = ''
): ContextFieldSnapshot[] {
  const fields: ContextFieldSnapshot[] = [];

  if (!domainData || typeof domainData !== 'object') {
    return fields;
  }

  for (const [fieldName, fieldValue] of Object.entries(domainData)) {
    const key = prefix ? `${prefix}.${fieldName}` : `${domainName}.${fieldName}`;

    if (isWithMetaField(fieldValue)) {
      // This is a WithMeta field
      fields.push(extractFieldSnapshot(key, domainName, fieldValue));
    } else if (typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue)) {
      // Nested object - recurse
      fields.push(...extractFieldsFromDomain(domainName, fieldValue, key));
    }
  }

  return fields;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Create enriched context field snapshots from a CompanyContextGraph
 */
export function createContextSnapshots(
  graph: CompanyContextGraph | null
): ContextFieldSnapshot[] {
  if (!graph) return [];

  const snapshots: ContextFieldSnapshot[] = [];

  // Domains to extract
  const domains = [
    'identity',
    'objectives',
    'brand',
    'audience',
    'productOffer',
    'website',
    'seo',
    'content',
    'creative',
    'performanceMedia',
    'budgetOps',
    'ops',
    'digitalInfra',
    'historical',
    'competitive',
    'operationalConstraints',
    'storeRisk',
    'historyRefs',
  ] as const;

  for (const domainName of domains) {
    const domainData = (graph as any)[domainName];
    if (domainData) {
      snapshots.push(...extractFieldsFromDomain(domainName, domainData));
    }
  }

  return snapshots;
}

/**
 * Group snapshots by QBR domain
 */
export function groupSnapshotsByDomain(
  snapshots: ContextFieldSnapshot[]
): Map<QbrDomain, ContextFieldSnapshot[]> {
  const grouped = new Map<QbrDomain, ContextFieldSnapshot[]>();

  for (const snapshot of snapshots) {
    const existing = grouped.get(snapshot.domain) || [];
    existing.push(snapshot);
    grouped.set(snapshot.domain, existing);
  }

  return grouped;
}

/**
 * Get critical identity fields (used for confidence scoring)
 */
export function getCriticalIdentityFields(): string[] {
  return [
    'identity.businessName',
    'identity.industry',
    'identity.revenueModel',
    'identity.businessType',
    'objectives.primaryObjective',
    'brand.positioning',
    'audience.primaryIcp',
  ];
}

/**
 * Filter snapshots to only problematic ones
 */
export function getProblematicSnapshots(
  snapshots: ContextFieldSnapshot[]
): ContextFieldSnapshot[] {
  return snapshots.filter(
    s => s.status === 'conflicted' || s.status === 'stale' || s.confidence < 70
  );
}
