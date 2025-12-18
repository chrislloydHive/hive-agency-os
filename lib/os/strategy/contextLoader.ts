// lib/os/strategy/contextLoader.ts
// Canonical Context Loader for Strategy
//
// IMPORTANT: This is the SINGLE source for loading Context into Strategy.
// No silent fallbacks. Explicit source tracking. Mapping report for debugging.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Context load result with explicit source tracking
 */
export interface ContextLoadResult {
  success: boolean;
  context: CompanyContextGraph | null;
  source: 'contextGraph' | 'none';
  loadedAt: string;
  error?: string;
  meta?: {
    updatedAt: string | null;
    completenessScore: number | null;
  };
}

/**
 * Field mapping attempt result
 */
export interface FieldMappingAttempt {
  field: string;
  attemptedPaths: string[];
  found: boolean;
  valuePreview: string | null;
  reason: string | null;
}

/**
 * Complete mapping report for debugging
 */
export interface MappingReport {
  companyId: string;
  contextLoaded: boolean;
  contextSource: string;
  contextUpdatedAt: string | null;
  fields: FieldMappingAttempt[];
  missingFields: string[];
  sourceUsed: string;
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load Context for Strategy - canonical loader
 *
 * Uses the same loader as the Context page.
 * Returns explicit success/failure with source tracking.
 */
export async function loadContextForStrategy(
  companyId: string
): Promise<ContextLoadResult> {
  const loadedAt = new Date().toISOString();

  try {
    // Use the canonical contextGraph loader (same as Context page)
    const context = await loadContextGraph(companyId);

    if (!context) {
      return {
        success: false,
        context: null,
        source: 'none',
        loadedAt,
        error: 'Context graph not found for company',
      };
    }

    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[STRATEGY_HYDRATION]', {
        companyId,
        contextLoaded: true,
        sourceUsed: 'contextGraph',
        updatedAt: context.meta?.updatedAt || null,
      });
    }

    return {
      success: true,
      context,
      source: 'contextGraph',
      loadedAt,
      meta: {
        updatedAt: context.meta?.updatedAt || null,
        completenessScore: context.meta?.completenessScore || null,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      console.error('[STRATEGY_HYDRATION] Load failed:', {
        companyId,
        error: errorMessage,
      });
    }

    return {
      success: false,
      context: null,
      source: 'none',
      loadedAt,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Field Mapping with Explicit Reporting
// ============================================================================

/**
 * Safely extract value from WithMeta wrapper
 */
function unwrap<T>(field: { value: T | null } | undefined | null): T | null {
  if (!field) return null;
  return field.value ?? null;
}

/**
 * Truncate value for preview
 */
function truncateForPreview(value: unknown, maxLength: number = 50): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? `[${value.length} items]` : '[]';
  }
  return String(value).substring(0, maxLength);
}

/**
 * Map Context fields to Strategy Frame with explicit reporting
 */
export function mapContextToFrame(
  context: CompanyContextGraph | null,
  companyId: string
): {
  frame: {
    audience: string | null;
    offering: string | null;
    valueProp: string | null;
    positioning: string | null;
    constraints: string | null;
  };
  report: MappingReport;
} {
  const fields: FieldMappingAttempt[] = [];
  const frame = {
    audience: null as string | null,
    offering: null as string | null,
    valueProp: null as string | null,
    positioning: null as string | null,
    constraints: null as string | null,
  };

  if (!context) {
    // No context - all fields missing
    const fieldNames = ['audience', 'offering', 'valueProp', 'positioning', 'constraints'];
    for (const field of fieldNames) {
      fields.push({
        field,
        attemptedPaths: [],
        found: false,
        valuePreview: null,
        reason: 'Context not loaded',
      });
    }

    return {
      frame,
      report: {
        companyId,
        contextLoaded: false,
        contextSource: 'none',
        contextUpdatedAt: null,
        fields,
        missingFields: fieldNames,
        sourceUsed: 'none',
      },
    };
  }

  // --- Audience ---
  {
    const attemptedPaths = ['audience.primaryAudience', 'audience.icpDescription'];
    const audiencePrimary = unwrap(context.audience?.primaryAudience);
    const audienceIcp = unwrap(context.audience?.icpDescription);

    if (audiencePrimary) {
      frame.audience = audiencePrimary;
      fields.push({
        field: 'audience',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(audiencePrimary),
        reason: null,
      });
    } else if (audienceIcp) {
      frame.audience = audienceIcp;
      fields.push({
        field: 'audience',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(audienceIcp),
        reason: 'Fallback to audience.icpDescription',
      });
    } else {
      fields.push({
        field: 'audience',
        attemptedPaths,
        found: false,
        valuePreview: null,
        reason: 'No value in audience.primaryAudience or audience.icpDescription',
      });
    }
  }

  // --- Offering ---
  {
    const attemptedPaths = ['productOffer.primaryProducts', 'productOffer.services'];
    const primaryProducts = unwrap(context.productOffer?.primaryProducts);
    const services = unwrap(context.productOffer?.services);

    // Handle both string and array values
    const formatValue = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0) return val.join(', ');
      return null;
    };

    const offeringFromProducts = formatValue(primaryProducts);
    const offeringFromServices = formatValue(services);

    if (offeringFromProducts) {
      frame.offering = offeringFromProducts;
      fields.push({
        field: 'offering',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(offeringFromProducts),
        reason: null,
      });
    } else if (offeringFromServices) {
      frame.offering = offeringFromServices;
      fields.push({
        field: 'offering',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(offeringFromServices),
        reason: 'Fallback to productOffer.services',
      });
    } else {
      fields.push({
        field: 'offering',
        attemptedPaths,
        found: false,
        valuePreview: null,
        reason: 'No value in productOffer.primaryProducts or productOffer.services',
      });
    }
  }

  // --- Value Proposition ---
  {
    const attemptedPaths = ['productOffer.valueProposition'];
    const valueProp = unwrap(context.productOffer?.valueProposition);

    if (valueProp) {
      frame.valueProp = valueProp;
      fields.push({
        field: 'valueProp',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(valueProp),
        reason: null,
      });
    } else {
      fields.push({
        field: 'valueProp',
        attemptedPaths,
        found: false,
        valuePreview: null,
        reason: 'No value in productOffer.valueProposition',
      });
    }
  }

  // --- Positioning ---
  {
    const attemptedPaths = ['identity.marketPosition', 'productOffer.keyDifferentiators'];
    const marketPosition = unwrap(context.identity?.marketPosition);
    const differentiators = unwrap(context.productOffer?.keyDifferentiators);

    // Handle both string and array values
    const formatDifferentiators = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0) return val.join('; ');
      return null;
    };

    if (marketPosition && typeof marketPosition === 'string') {
      frame.positioning = marketPosition;
      fields.push({
        field: 'positioning',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(marketPosition),
        reason: null,
      });
    } else {
      const positioningFromDiff = formatDifferentiators(differentiators);
      if (positioningFromDiff) {
        frame.positioning = positioningFromDiff;
        fields.push({
          field: 'positioning',
          attemptedPaths,
          found: true,
          valuePreview: truncateForPreview(positioningFromDiff),
          reason: 'Fallback to productOffer.keyDifferentiators',
        });
      } else {
        fields.push({
          field: 'positioning',
          attemptedPaths,
          found: false,
          valuePreview: null,
          reason: 'No value in identity.marketPosition or productOffer.keyDifferentiators',
        });
      }
    }
  }

  // --- Constraints ---
  {
    const attemptedPaths = [
      'operationalConstraints.legalRestrictions',
      'operationalConstraints.industryRegulations',
      'identity.geographicFootprint',
    ];
    const constraintParts: string[] = [];

    const legalRestrictions = unwrap(context.operationalConstraints?.legalRestrictions);
    const regulations = unwrap(context.operationalConstraints?.industryRegulations);
    const geography = unwrap(context.identity?.geographicFootprint);

    // Helper to safely convert any value to string
    const toStr = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.join(', ');
      return String(val);
    };

    const legalStr = toStr(legalRestrictions);
    const regStr = toStr(regulations);
    const geoStr = toStr(geography);

    if (legalStr) constraintParts.push(`Legal: ${legalStr}`);
    if (regStr) constraintParts.push(`Regulatory: ${regStr}`);
    if (geoStr) constraintParts.push(`Geography: ${geoStr}`);

    if (constraintParts.length > 0) {
      frame.constraints = constraintParts.join('; ');
      fields.push({
        field: 'constraints',
        attemptedPaths,
        found: true,
        valuePreview: truncateForPreview(constraintParts.join('; ')),
        reason: null,
      });
    } else {
      fields.push({
        field: 'constraints',
        attemptedPaths,
        found: false,
        valuePreview: null,
        reason: 'No values in any constraint paths',
      });
    }
  }

  const missingFields = fields.filter(f => !f.found).map(f => f.field);

  // Dev logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[STRATEGY_HYDRATION]', {
      companyId,
      contextLoaded: true,
      missingFields,
      sourceUsed: 'contextGraph',
    });
  }

  return {
    frame,
    report: {
      companyId,
      contextLoaded: true,
      contextSource: 'contextGraph',
      contextUpdatedAt: context.meta?.updatedAt || null,
      fields,
      missingFields,
      sourceUsed: 'contextGraph',
    },
  };
}
