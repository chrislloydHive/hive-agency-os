// lib/contextGraph/schema/identity.ts
// Identity section schema definition for Context Graph UI

import type { CompanyContextGraph } from '../companyContextGraph';
import type { ProvenanceTag } from '../types';

/**
 * Field type for UI rendering
 */
export type FieldType = 'string' | 'string[]' | 'number' | 'boolean' | 'enum';

/**
 * Field definition for Context Graph UI
 */
export interface ContextFieldDefinition {
  path: string;
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  enumValues?: string[]; // For enum fields
}

/**
 * A context field with its current node data
 */
export interface ContextField {
  definition: ContextFieldDefinition;
  value: unknown;
  provenance: ProvenanceTag[];
  status: 'missing' | 'fresh' | 'stale' | 'conflicted';
  isHumanOverride: boolean;
}

/**
 * A section of context fields (e.g., Identity, Brand)
 */
export interface ContextSection {
  id: string;
  label: string;
  fields: ContextField[];
  coverage: number; // 0-100
  staleCount: number;
  missingCount: number;
}

/**
 * Identity section field definitions
 */
export const IDENTITY_FIELDS: ContextFieldDefinition[] = [
  // Core Identity
  {
    path: 'identity.businessName',
    key: 'businessName',
    label: 'Business Name',
    type: 'string',
    description: 'Official business name',
  },
  {
    path: 'identity.industry',
    key: 'industry',
    label: 'Industry',
    type: 'string',
    description: 'Primary industry or vertical',
  },
  {
    path: 'identity.businessModel',
    key: 'businessModel',
    label: 'Business Model',
    type: 'enum',
    description: 'How the business operates',
    enumValues: ['dtc', 'retail', 'ecommerce', 'b2b', 'b2b2c', 'saas', 'marketplace', 'franchise', 'subscription', 'services', 'healthcare', 'hospitality', 'real_estate', 'automotive', 'education', 'nonprofit', 'other'],
  },
  {
    path: 'identity.revenueModel',
    key: 'revenueModel',
    label: 'Revenue Model',
    type: 'string',
    description: 'How the business generates revenue',
  },

  // Market Position
  {
    path: 'identity.marketMaturity',
    key: 'marketMaturity',
    label: 'Market Maturity',
    type: 'enum',
    description: 'Stage of market development',
    enumValues: ['launch', 'growth', 'plateau', 'turnaround', 'exit', 'other'],
  },
  {
    path: 'identity.geographicFootprint',
    key: 'geographicFootprint',
    label: 'Geographic Footprint',
    type: 'string',
    description: 'Geographic scope of operations',
  },
  {
    path: 'identity.serviceArea',
    key: 'serviceArea',
    label: 'Service Area',
    type: 'string',
    description: 'Primary service regions',
  },

  // Competitive Context
  {
    path: 'identity.competitiveLandscape',
    key: 'competitiveLandscape',
    label: 'Competitive Landscape',
    type: 'string',
    description: 'Overview of competitive environment',
  },
  {
    path: 'identity.marketPosition',
    key: 'marketPosition',
    label: 'Market Position',
    type: 'string',
    description: 'Position relative to competitors',
  },
  {
    path: 'identity.primaryCompetitors',
    key: 'primaryCompetitors',
    label: 'Primary Competitors',
    type: 'string[]',
    description: 'Main competitor companies',
  },

  // Seasonality
  {
    path: 'identity.seasonalityNotes',
    key: 'seasonalityNotes',
    label: 'Seasonality Notes',
    type: 'string',
    description: 'How seasonality affects the business',
  },
  {
    path: 'identity.peakSeasons',
    key: 'peakSeasons',
    label: 'Peak Seasons',
    type: 'string[]',
    description: 'High-demand periods',
  },
  {
    path: 'identity.lowSeasons',
    key: 'lowSeasons',
    label: 'Low Seasons',
    type: 'string[]',
    description: 'Low-demand periods',
  },

  // Business Constraints
  {
    path: 'identity.profitCenters',
    key: 'profitCenters',
    label: 'Profit Centers',
    type: 'string[]',
    description: 'Primary revenue/profit drivers',
  },
  {
    path: 'identity.revenueStreams',
    key: 'revenueStreams',
    label: 'Revenue Streams',
    type: 'string[]',
    description: 'Different sources of revenue',
  },
];

/**
 * Calculate field status based on value and provenance
 */
function calculateFieldStatus(
  value: unknown,
  provenance: ProvenanceTag[]
): 'missing' | 'fresh' | 'stale' | 'conflicted' {
  // No value = missing
  if (value === null || value === undefined) {
    return 'missing';
  }
  if (Array.isArray(value) && value.length === 0) {
    return 'missing';
  }

  // Check for staleness based on provenance age
  if (provenance.length > 0) {
    const latestProvenance = provenance[0];
    const updatedAt = new Date(latestProvenance.updatedAt);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Consider stale if older than validForDays (default 90)
    const validForDays = latestProvenance.validForDays ?? 90;
    if (daysSinceUpdate > validForDays) {
      return 'stale';
    }

    // Check for conflicted (multiple sources with different values in history)
    if (provenance.length >= 2) {
      const sources = new Set(provenance.slice(0, 3).map(p => p.source));
      if (sources.size >= 2) {
        // Could mark as conflicted, but for now just check confidence
        const topConfidence = latestProvenance.confidence;
        const secondConfidence = provenance[1]?.confidence ?? 0;
        if (topConfidence - secondConfidence < 0.1) {
          return 'conflicted';
        }
      }
    }
  }

  return 'fresh';
}

/**
 * Check if a field was last edited by a human
 */
function isHumanOverride(provenance: ProvenanceTag[]): boolean {
  if (provenance.length === 0) return false;
  const latestSource = provenance[0].source;
  return latestSource === 'manual' || latestSource === 'setup_wizard' || latestSource === 'qbr';
}

/**
 * Build Identity section from context graph
 */
export function buildIdentitySection(graph: CompanyContextGraph): ContextSection {
  const fields: ContextField[] = [];
  let populatedCount = 0;
  let staleCount = 0;
  let missingCount = 0;

  for (const def of IDENTITY_FIELDS) {
    // Get the field data from the graph
    const fieldData = graph.identity[def.key as keyof typeof graph.identity];

    if (!fieldData) {
      // Field not found in schema - skip
      continue;
    }

    const value = fieldData.value;
    const provenance = fieldData.provenance || [];
    const status = calculateFieldStatus(value, provenance);

    if (status === 'missing') {
      missingCount++;
    } else {
      populatedCount++;
      if (status === 'stale') {
        staleCount++;
      }
    }

    fields.push({
      definition: def,
      value,
      provenance,
      status,
      isHumanOverride: isHumanOverride(provenance),
    });
  }

  const totalFields = IDENTITY_FIELDS.length;
  const coverage = totalFields > 0 ? Math.round((populatedCount / totalFields) * 100) : 0;

  return {
    id: 'identity',
    label: 'Identity',
    fields,
    coverage,
    staleCount,
    missingCount,
  };
}

/**
 * Get all section definitions (for future expansion)
 */
export const SECTION_DEFINITIONS = {
  identity: {
    id: 'identity',
    label: 'Identity',
    fields: IDENTITY_FIELDS,
  },
  // Future sections will be added here:
  // brand: { id: 'brand', label: 'Brand', fields: BRAND_FIELDS },
  // objectives: { id: 'objectives', label: 'Objectives', fields: OBJECTIVES_FIELDS },
  // etc.
};
