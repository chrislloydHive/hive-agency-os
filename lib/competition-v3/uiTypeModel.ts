// lib/competition-v3/uiTypeModel.ts
// Vertical-Aware UI Type Model for Competition Lab
//
// This module provides:
// - UI competitor type configuration (labels, colors, badges)
// - Context-aware type filtering based on business model and vertical
// - B2C/retail companies won't see B2B-only types like "Internal Hire" or "Fractional"
// - B2B services will see the full marketing-services taxonomy

// ============================================================================
// Type Definitions
// ============================================================================

export type UiCompetitorTypeKey =
  | 'direct'
  | 'partial'
  | 'marketplace'
  | 'substitute'
  | 'internal'
  | 'fractional'
  | 'platform';

export interface UiCompetitorTypeConfig {
  key: UiCompetitorTypeKey;
  label: string;
  badgeLabel: string;
  description: string;
  colorToken: string;
  hexColor: string;
  tailwind: {
    bg: string;
    text: string;
    fill: string;
  };
}

export interface UiTypeModel {
  allowedTypes: UiCompetitorTypeKey[];
  legendOrder: UiCompetitorTypeKey[];
  displayName: string;
}

export type BusinessModelCategory = 'B2B' | 'B2C' | 'Hybrid' | 'Unknown';
export type VerticalCategory = 'retail' | 'automotive' | 'services' | 'software' | 'consumer-dtc' | 'manufacturing' | 'unknown';

// ============================================================================
// UI Competitor Type Configuration
// ============================================================================

export const UI_COMPETITOR_TYPE_CONFIG: Record<UiCompetitorTypeKey, UiCompetitorTypeConfig> = {
  direct: {
    key: 'direct',
    label: 'Direct Competitor',
    badgeLabel: 'Direct',
    description: 'Same business model, same ICP, overlapping products/services',
    colorToken: 'red',
    hexColor: '#ef4444',
    tailwind: {
      bg: 'bg-red-500',
      text: 'text-red-400',
      fill: 'fill-red-500/80 stroke-red-800',
    },
  },
  partial: {
    key: 'partial',
    label: 'Partial Overlap',
    badgeLabel: 'Partial',
    description: 'Shares ICP or products but not both',
    colorToken: 'orange',
    hexColor: '#fb923c',
    tailwind: {
      bg: 'bg-orange-400',
      text: 'text-orange-400',
      fill: 'fill-orange-400/80 stroke-orange-800',
    },
  },
  marketplace: {
    key: 'marketplace',
    label: 'Marketplace / Online Giant',
    badgeLabel: 'Marketplace',
    description: 'Large online platform that competes for the same customers (Amazon, eBay, etc.)',
    colorToken: 'yellow',
    hexColor: '#fcd34d',
    tailwind: {
      bg: 'bg-amber-300',
      text: 'text-amber-400',
      fill: 'fill-amber-300/80 stroke-amber-700',
    },
  },
  substitute: {
    key: 'substitute',
    label: 'Category Substitute',
    badgeLabel: 'Substitute',
    description: 'Different product category that solves the same need',
    colorToken: 'teal',
    hexColor: '#2dd4bf',
    tailwind: {
      bg: 'bg-teal-400',
      text: 'text-teal-400',
      fill: 'fill-teal-400/80 stroke-teal-800',
    },
  },
  internal: {
    key: 'internal',
    label: 'Internal Hire Alternative',
    badgeLabel: 'Internal',
    description: 'What they might hire internally instead of using your service',
    colorToken: 'blue',
    hexColor: '#60a5fa',
    tailwind: {
      bg: 'bg-blue-400',
      text: 'text-blue-400',
      fill: 'fill-blue-400/80 stroke-blue-800',
    },
  },
  fractional: {
    key: 'fractional',
    label: 'Fractional / Freelance Alternative',
    badgeLabel: 'Fractional',
    description: 'Fractional executive or freelance services (CMO, advisor)',
    colorToken: 'indigo',
    hexColor: '#818cf8',
    tailwind: {
      bg: 'bg-indigo-400',
      text: 'text-indigo-400',
      fill: 'fill-indigo-400/80 stroke-indigo-800',
    },
  },
  platform: {
    key: 'platform',
    label: 'Software / Platform Alternative',
    badgeLabel: 'Platform',
    description: 'SaaS tools that replace part of your service',
    colorToken: 'purple',
    hexColor: '#c084fc',
    tailwind: {
      bg: 'bg-purple-400',
      text: 'text-purple-400',
      fill: 'fill-purple-400/80 stroke-purple-800',
    },
  },
};

// ============================================================================
// Vertical-Specific Type Models
// ============================================================================

/**
 * B2C Retail Model
 * - Physical retail stores, local shops, e-commerce
 * - Excludes: internal, fractional (not relevant for retail)
 */
const B2C_RETAIL_MODEL: UiTypeModel = {
  allowedTypes: ['direct', 'partial', 'marketplace', 'substitute'],
  legendOrder: ['direct', 'partial', 'marketplace', 'substitute'],
  displayName: 'B2C Retail',
};

/**
 * Automotive Model
 * - Car audio, auto parts, service centers
 * - Similar to retail - excludes B2B alternatives
 */
const AUTOMOTIVE_MODEL: UiTypeModel = {
  allowedTypes: ['direct', 'partial', 'marketplace', 'substitute'],
  legendOrder: ['direct', 'partial', 'marketplace', 'substitute'],
  displayName: 'Automotive Retail/Service',
};

/**
 * B2B Services Model
 * - Agencies, consulting, professional services
 * - Full marketing-services taxonomy including internal/fractional
 */
const B2B_SERVICES_MODEL: UiTypeModel = {
  allowedTypes: ['direct', 'partial', 'internal', 'fractional', 'platform'],
  legendOrder: ['direct', 'partial', 'fractional', 'platform', 'internal'],
  displayName: 'B2B Services',
};

/**
 * B2B Software/SaaS Model
 * - Software platforms, SaaS products
 * - Includes platform alternatives but not internal hire
 */
const B2B_SOFTWARE_MODEL: UiTypeModel = {
  allowedTypes: ['direct', 'partial', 'platform', 'substitute'],
  legendOrder: ['direct', 'partial', 'platform', 'substitute'],
  displayName: 'B2B Software/SaaS',
};

/**
 * Consumer DTC Model
 * - Direct-to-consumer brands
 * - Similar to retail, excludes B2B alternatives
 */
const CONSUMER_DTC_MODEL: UiTypeModel = {
  allowedTypes: ['direct', 'partial', 'marketplace', 'substitute'],
  legendOrder: ['direct', 'partial', 'marketplace', 'substitute'],
  displayName: 'Consumer DTC',
};

/**
 * General/Default Model
 * - Used when vertical is unknown
 * - Includes all types for maximum flexibility
 */
const DEFAULT_MODEL: UiTypeModel = {
  allowedTypes: ['direct', 'partial', 'fractional', 'platform', 'internal'],
  legendOrder: ['direct', 'partial', 'fractional', 'platform', 'internal'],
  displayName: 'General Business',
};

// ============================================================================
// Main Function: Get UI Type Model for Context
// ============================================================================

export interface UiTypeModelContext {
  businessModelCategory?: BusinessModelCategory | null;
  verticalCategory?: VerticalCategory | string | null;
}

/**
 * Get the appropriate UI type model based on business context
 *
 * @param args - Business model and vertical context
 * @returns UiTypeModel with allowed types and legend order
 *
 * @example
 * // B2C retail company like Car Toys
 * const model = getUiTypeModelForContext({
 *   businessModelCategory: 'B2C',
 *   verticalCategory: 'automotive'
 * });
 * // model.allowedTypes = ['direct', 'partial', 'marketplace', 'substitute']
 *
 * @example
 * // B2B agency like Hive
 * const model = getUiTypeModelForContext({
 *   businessModelCategory: 'B2B',
 *   verticalCategory: 'services'
 * });
 * // model.allowedTypes = ['direct', 'partial', 'internal', 'fractional', 'platform']
 */
export function getUiTypeModelForContext(args: UiTypeModelContext): UiTypeModel {
  const { businessModelCategory, verticalCategory } = args;

  // Normalize vertical category
  const normalizedVertical = verticalCategory?.toLowerCase() ?? 'unknown';

  // Check vertical-specific models first
  if (normalizedVertical === 'automotive') {
    return AUTOMOTIVE_MODEL;
  }

  if (normalizedVertical === 'retail') {
    return B2C_RETAIL_MODEL;
  }

  if (normalizedVertical === 'consumer-dtc') {
    return CONSUMER_DTC_MODEL;
  }

  if (normalizedVertical === 'software') {
    return B2B_SOFTWARE_MODEL;
  }

  if (normalizedVertical === 'services') {
    return B2B_SERVICES_MODEL;
  }

  // Fall back to business model category
  if (businessModelCategory === 'B2C') {
    return B2C_RETAIL_MODEL;
  }

  if (businessModelCategory === 'B2B') {
    // Default B2B to services model (most common)
    return B2B_SERVICES_MODEL;
  }

  if (businessModelCategory === 'Hybrid') {
    // Hybrid businesses get the retail model (excludes B2B-only types)
    return B2C_RETAIL_MODEL;
  }

  // Default/Unknown
  return DEFAULT_MODEL;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a competitor type is allowed for a given context
 */
export function isTypeAllowedForContext(
  type: UiCompetitorTypeKey | string,
  context: UiTypeModelContext
): boolean {
  const model = getUiTypeModelForContext(context);
  return model.allowedTypes.includes(type as UiCompetitorTypeKey);
}

/**
 * Get configuration for a specific type
 */
export function getTypeConfig(type: UiCompetitorTypeKey): UiCompetitorTypeConfig {
  return UI_COMPETITOR_TYPE_CONFIG[type];
}

/**
 * Get hex color for a type (for canvas/SVG rendering)
 */
export function getTypeHexColor(type: UiCompetitorTypeKey | string): string {
  const config = UI_COMPETITOR_TYPE_CONFIG[type as UiCompetitorTypeKey];
  return config?.hexColor ?? '#64748b'; // slate-500 fallback
}

/**
 * Get Tailwind classes for a type
 */
export function getTypeTailwindClasses(type: UiCompetitorTypeKey | string): UiCompetitorTypeConfig['tailwind'] {
  const config = UI_COMPETITOR_TYPE_CONFIG[type as UiCompetitorTypeKey];
  return config?.tailwind ?? {
    bg: 'bg-slate-500',
    text: 'text-slate-400',
    fill: 'fill-slate-500/40 stroke-slate-600',
  };
}

/**
 * Get display label for a type
 */
export function getTypeLabel(type: UiCompetitorTypeKey | string): string {
  const config = UI_COMPETITOR_TYPE_CONFIG[type as UiCompetitorTypeKey];
  return config?.label ?? type;
}

/**
 * Get badge label for a type (shorter version for chips)
 */
export function getTypeBadgeLabel(type: UiCompetitorTypeKey | string): string {
  const config = UI_COMPETITOR_TYPE_CONFIG[type as UiCompetitorTypeKey];
  return config?.badgeLabel ?? type;
}

/**
 * Map legacy competitor type to new UI type
 *
 * This handles the mapping from the backend CompetitorType to our UI types
 */
export function mapLegacyTypeToUiType(legacyType: string): UiCompetitorTypeKey {
  switch (legacyType) {
    case 'direct':
      return 'direct';
    case 'partial':
      return 'partial';
    case 'fractional':
      return 'fractional';
    case 'internal':
      return 'internal';
    case 'platform':
      // For B2C contexts, 'platform' from backend maps to 'marketplace'
      // The calling code should handle this context-aware mapping
      return 'platform';
    case 'irrelevant':
      // Map irrelevant to partial as a safe fallback
      return 'partial';
    default:
      return 'partial';
  }
}

/**
 * Map backend type to context-appropriate UI type
 *
 * For B2C companies, 'platform' becomes 'marketplace'
 */
export function mapTypeForContext(
  backendType: string,
  context: UiTypeModelContext
): UiCompetitorTypeKey {
  const baseType = mapLegacyTypeToUiType(backendType);

  // For B2C/retail, map 'platform' to 'marketplace'
  if (
    baseType === 'platform' &&
    (context.businessModelCategory === 'B2C' ||
     context.verticalCategory === 'retail' ||
     context.verticalCategory === 'automotive')
  ) {
    return 'marketplace';
  }

  return baseType;
}

// ============================================================================
// Export Models for Testing
// ============================================================================

export const _testing = {
  B2C_RETAIL_MODEL,
  AUTOMOTIVE_MODEL,
  B2B_SERVICES_MODEL,
  B2B_SOFTWARE_MODEL,
  CONSUMER_DTC_MODEL,
  DEFAULT_MODEL,
};
