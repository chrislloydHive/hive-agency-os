// lib/competition-v3/orchestrator/verticalModels.ts
// Competition Lab V3.6 - Vertical-Aware Competitive Models
//
// Provides competitor type dictionaries for each business vertical.
// Used to:
// - Filter inappropriate competitor types
// - Generate vertical-specific narratives
// - Drive correct terminology in UI
// - Ensure B2C companies don't show B2B competitor types

import type { VerticalCategory, CompetitorType } from '../types';

// ============================================================================
// Vertical Competitor Model Type
// ============================================================================

export interface VerticalCompetitorModel {
  /** Vertical category this model applies to */
  vertical: VerticalCategory;

  /** Human-readable name for this vertical */
  displayName: string;

  /** Description of this vertical */
  description: string;

  /** Competitor types allowed for this vertical */
  allowedTypes: CompetitorType[];

  /** Competitor types NOT allowed for this vertical */
  disallowedTypes: CompetitorType[];

  /** Should 'internal hire' alternatives be shown? */
  noInternalHire: boolean;

  /** Should 'fractional' alternatives be shown? */
  noFractional: boolean;

  /** Type labels for this vertical (overrides defaults) */
  typeLabels: Record<CompetitorType, string>;

  /** Type descriptions for this vertical */
  typeDescriptions: Record<CompetitorType, string>;

  /** Threat terminology for this vertical */
  threatTerminology: {
    competitor: string;      // "competitor" vs "competing store"
    competitors: string;     // "competitors" vs "competing stores"
    customer: string;        // "customer" vs "shopper"
    customers: string;       // "customers" vs "shoppers"
    market: string;          // "market" vs "local market"
    threats: string[];       // Common threat types
  };

  /** Narrative templates for this vertical */
  narrativeTemplates: {
    marketDynamics: string;
    positioningAdvice: string;
    threatContext: string;
  };
}

// ============================================================================
// B2C Retail Model
// ============================================================================

export const B2C_RETAIL_MODEL: VerticalCompetitorModel = {
  vertical: 'retail',
  displayName: 'B2C Retail',
  description: 'Physical retail stores, local shops, and consumer-facing businesses',

  allowedTypes: ['direct', 'partial', 'platform'],
  disallowedTypes: ['fractional', 'internal', 'irrelevant'],

  noInternalHire: true,
  noFractional: true,

  typeLabels: {
    direct: 'Direct Retail Competitor',
    partial: 'Category Substitute',
    platform: 'Marketplace / Online Giant',
    fractional: 'N/A',
    internal: 'N/A',
    irrelevant: 'Not a Competitor',
  },

  typeDescriptions: {
    direct: 'Stores offering the same products to the same customers in your market',
    partial: 'Retailers in adjacent categories that could attract your customers',
    platform: 'Online marketplaces like Amazon, eBay, or big-box retailers',
    fractional: 'Not applicable for retail businesses',
    internal: 'Not applicable for retail businesses',
    irrelevant: 'Not a relevant competitor',
  },

  threatTerminology: {
    competitor: 'competing store',
    competitors: 'competing stores',
    customer: 'shopper',
    customers: 'shoppers',
    market: 'local market',
    threats: [
      'big-box retailers',
      'online giants',
      'national chains',
      'local independents',
      'category specialists',
    ],
  },

  narrativeTemplates: {
    marketDynamics: 'The local retail landscape in {geography} shows {competitorCount} competing stores vying for {customer} attention. The primary competitive pressure comes from {topThreat}.',
    positioningAdvice: 'To stand out in this retail environment, focus on {differentiator}. Your local presence is an advantage over online competitors.',
    threatContext: 'The biggest threat to your business is {threatName}, which competes for the same {customer}s through {threatReason}.',
  },
};

// ============================================================================
// Automotive Model
// ============================================================================

export const AUTOMOTIVE_MODEL: VerticalCompetitorModel = {
  vertical: 'automotive',
  displayName: 'Automotive Retail/Service',
  description: 'Car audio shops, auto parts, service centers, and automotive aftermarket',

  allowedTypes: ['direct', 'partial', 'platform'],
  disallowedTypes: ['fractional', 'internal', 'irrelevant'],

  noInternalHire: true,
  noFractional: true,

  typeLabels: {
    direct: 'Competing Shop',
    partial: 'Category Overlap',
    platform: 'Online Retailer',
    fractional: 'N/A',
    internal: 'N/A',
    irrelevant: 'Not a Competitor',
  },

  typeDescriptions: {
    direct: 'Shops offering the same services and products to vehicle owners',
    partial: 'Businesses in adjacent automotive categories',
    platform: 'Online retailers like Amazon, Crutchfield, or eBay sellers',
    fractional: 'Not applicable for automotive retail',
    internal: 'Not applicable for automotive retail',
    irrelevant: 'Not a relevant competitor',
  },

  threatTerminology: {
    competitor: 'competing shop',
    competitors: 'competing shops',
    customer: 'vehicle owner',
    customers: 'vehicle owners',
    market: 'automotive aftermarket',
    threats: [
      'national chains',
      'dealership service departments',
      'online retailers',
      'DIY installations',
      'mobile installers',
    ],
  },

  narrativeTemplates: {
    marketDynamics: 'The automotive aftermarket in {geography} features {competitorCount} shops competing for {customer} business. Key competitive factors include installation quality, brand selection, and customer service.',
    positioningAdvice: 'Differentiate through {differentiator}. Professional installation expertise and local trust are advantages over online-only competitors.',
    threatContext: '{threatName} threatens your position through {threatReason}. Counter this by emphasizing your professional installation and warranty coverage.',
  },
};

// ============================================================================
// B2B Services Model
// ============================================================================

export const B2B_SERVICES_MODEL: VerticalCompetitorModel = {
  vertical: 'services',
  displayName: 'B2B Services',
  description: 'Agencies, consulting firms, and professional service providers',

  allowedTypes: ['direct', 'partial', 'fractional', 'internal', 'platform'],
  disallowedTypes: ['irrelevant'],

  noInternalHire: false,
  noFractional: false,

  typeLabels: {
    direct: 'Direct Competitor',
    partial: 'Partial Overlap',
    platform: 'Platform Alternative',
    fractional: 'Fractional Alternative',
    internal: 'Internal Hire Alternative',
    irrelevant: 'Not a Competitor',
  },

  typeDescriptions: {
    direct: 'Agencies/firms with the same service model targeting the same clients',
    partial: 'Service providers with overlapping offerings or client base',
    platform: 'SaaS tools that automate or replace some services',
    fractional: 'Fractional executives or part-time consultants',
    internal: 'Clients hiring in-house instead of using an agency',
    irrelevant: 'Not a relevant competitor',
  },

  threatTerminology: {
    competitor: 'competing agency',
    competitors: 'competing agencies',
    customer: 'client',
    customers: 'clients',
    market: 'B2B services market',
    threats: [
      'in-house teams',
      'freelancers',
      'AI tools',
      'larger agencies',
      'boutique specialists',
    ],
  },

  narrativeTemplates: {
    marketDynamics: 'The {industry} services market shows {competitorCount} agencies competing for similar {customer}s. The landscape includes direct competitors, fractional alternatives, and increasingly, platform-based solutions.',
    positioningAdvice: 'Position against internal hires by emphasizing {differentiator}. Your agency model provides flexibility and expertise that in-house teams struggle to match.',
    threatContext: 'The internal hire alternative represents a structural threat. Counter by demonstrating ROI and reducing perceived switching costs.',
  },
};

// ============================================================================
// B2B Software Model
// ============================================================================

export const B2B_SOFTWARE_MODEL: VerticalCompetitorModel = {
  vertical: 'software',
  displayName: 'B2B Software/SaaS',
  description: 'Software platforms, SaaS products, and technology solutions',

  allowedTypes: ['direct', 'partial', 'platform'],
  disallowedTypes: ['fractional', 'internal', 'irrelevant'],

  noInternalHire: true,
  noFractional: true,

  typeLabels: {
    direct: 'Direct Competitor',
    partial: 'Partial Overlap',
    platform: 'Platform Ecosystem',
    fractional: 'N/A',
    internal: 'N/A',
    irrelevant: 'Not a Competitor',
  },

  typeDescriptions: {
    direct: 'Software products solving the same problem for the same users',
    partial: 'Products with overlapping features or adjacent use cases',
    platform: 'Larger platforms that include your functionality',
    fractional: 'Not applicable for software companies',
    internal: 'Not applicable for software companies',
    irrelevant: 'Not a relevant competitor',
  },

  threatTerminology: {
    competitor: 'competing platform',
    competitors: 'competing platforms',
    customer: 'user',
    customers: 'users',
    market: 'software market',
    threats: [
      'enterprise incumbents',
      'open source alternatives',
      'platform bundling',
      'emerging startups',
      'AI-native tools',
    ],
  },

  narrativeTemplates: {
    marketDynamics: 'The {industry} software market features {competitorCount} solutions competing for {customer} adoption. Key differentiators include feature depth, integrations, and user experience.',
    positioningAdvice: 'Differentiate through {differentiator}. Focus on the specific pain points your target {customer}s face that incumbents don\'t address well.',
    threatContext: '{threatName} poses a competitive threat through {threatReason}. Build moats through integrations, data network effects, or switching cost accumulation.',
  },
};

// ============================================================================
// Consumer DTC Model
// ============================================================================

export const CONSUMER_DTC_MODEL: VerticalCompetitorModel = {
  vertical: 'consumer-dtc',
  displayName: 'Consumer DTC',
  description: 'Direct-to-consumer brands selling online-first',

  allowedTypes: ['direct', 'partial', 'platform'],
  disallowedTypes: ['fractional', 'internal', 'irrelevant'],

  noInternalHire: true,
  noFractional: true,

  typeLabels: {
    direct: 'Competing Brand',
    partial: 'Category Adjacent',
    platform: 'Marketplace',
    fractional: 'N/A',
    internal: 'N/A',
    irrelevant: 'Not a Competitor',
  },

  typeDescriptions: {
    direct: 'Brands selling similar products to the same consumer audience',
    partial: 'Brands in adjacent categories competing for wallet share',
    platform: 'Marketplaces like Amazon where consumers might buy instead',
    fractional: 'Not applicable for DTC brands',
    internal: 'Not applicable for DTC brands',
    irrelevant: 'Not a relevant competitor',
  },

  threatTerminology: {
    competitor: 'competing brand',
    competitors: 'competing brands',
    customer: 'consumer',
    customers: 'consumers',
    market: 'DTC market',
    threats: [
      'legacy brands',
      'Amazon private label',
      'influencer brands',
      'category disruptors',
      'subscription fatigue',
    ],
  },

  narrativeTemplates: {
    marketDynamics: 'The DTC landscape in {industry} shows {competitorCount} brands competing for {customer} attention. Success depends on brand storytelling, unit economics, and acquisition efficiency.',
    positioningAdvice: 'Build brand equity through {differentiator}. Direct relationship with {customer}s is your moat against marketplace competition.',
    threatContext: '{threatName} competes through {threatReason}. Counter with stronger brand positioning and community building.',
  },
};

// ============================================================================
// Unknown/Default Model
// ============================================================================

export const UNKNOWN_MODEL: VerticalCompetitorModel = {
  vertical: 'unknown',
  displayName: 'General Business',
  description: 'Business type not clearly identified',

  allowedTypes: ['direct', 'partial', 'fractional', 'internal', 'platform'],
  disallowedTypes: ['irrelevant'],

  noInternalHire: false,
  noFractional: false,

  typeLabels: {
    direct: 'Direct Competitor',
    partial: 'Partial Overlap',
    platform: 'Platform Alternative',
    fractional: 'Fractional Alternative',
    internal: 'Internal Alternative',
    irrelevant: 'Not a Competitor',
  },

  typeDescriptions: {
    direct: 'Businesses offering similar products/services',
    partial: 'Businesses with some overlap in offerings or customers',
    platform: 'Technology platforms that compete with the offering',
    fractional: 'Part-time or fractional service alternatives',
    internal: 'In-house alternatives to the offering',
    irrelevant: 'Not a relevant competitor',
  },

  threatTerminology: {
    competitor: 'competitor',
    competitors: 'competitors',
    customer: 'customer',
    customers: 'customers',
    market: 'market',
    threats: [
      'direct competitors',
      'new entrants',
      'substitutes',
      'platform disruption',
    ],
  },

  narrativeTemplates: {
    marketDynamics: 'The competitive landscape shows {competitorCount} alternatives competing for {customer} attention.',
    positioningAdvice: 'Focus on {differentiator} to stand out from competitors.',
    threatContext: '{threatName} poses a competitive threat through {threatReason}.',
  },
};

// ============================================================================
// Model Registry
// ============================================================================

export const VERTICAL_MODELS: Record<VerticalCategory, VerticalCompetitorModel> = {
  retail: B2C_RETAIL_MODEL,
  automotive: AUTOMOTIVE_MODEL,
  services: B2B_SERVICES_MODEL,
  software: B2B_SOFTWARE_MODEL,
  'consumer-dtc': CONSUMER_DTC_MODEL,
  manufacturing: UNKNOWN_MODEL, // Default to unknown for manufacturing
  unknown: UNKNOWN_MODEL,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the competitor model for a vertical
 */
export function getVerticalModel(vertical: VerticalCategory): VerticalCompetitorModel {
  return VERTICAL_MODELS[vertical] || UNKNOWN_MODEL;
}

/**
 * Get allowed competitor types for a vertical
 */
export function getAllowedTypesForVertical(vertical: VerticalCategory): CompetitorType[] {
  const model = getVerticalModel(vertical);
  return model.allowedTypes;
}

/**
 * Get disallowed competitor types for a vertical
 */
export function getDisallowedTypesForVertical(vertical: VerticalCategory): CompetitorType[] {
  const model = getVerticalModel(vertical);
  return model.disallowedTypes;
}

/**
 * Check if a competitor type is allowed for a vertical
 */
export function isTypeAllowedForVertical(
  type: CompetitorType,
  vertical: VerticalCategory
): boolean {
  const model = getVerticalModel(vertical);
  return model.allowedTypes.includes(type);
}

/**
 * Get the display label for a competitor type in a vertical
 */
export function getTypeLabel(
  type: CompetitorType,
  vertical: VerticalCategory
): string {
  const model = getVerticalModel(vertical);
  return model.typeLabels[type] || type;
}

/**
 * Get terminology for a vertical
 */
export function getTerminology(vertical: VerticalCategory): VerticalCompetitorModel['threatTerminology'] {
  const model = getVerticalModel(vertical);
  return model.threatTerminology;
}

/**
 * Filter competitors by vertical-allowed types
 */
export function filterCompetitorsByVertical<T extends { type?: CompetitorType; classification?: { type?: CompetitorType } }>(
  competitors: T[],
  vertical: VerticalCategory
): T[] {
  const allowedTypes = getAllowedTypesForVertical(vertical);
  return competitors.filter(c => {
    const type = c.type || c.classification?.type;
    return type && allowedTypes.includes(type);
  });
}

/**
 * Should internal hire alternatives be hidden for this vertical?
 */
export function shouldHideInternalHire(vertical: VerticalCategory): boolean {
  const model = getVerticalModel(vertical);
  return model.noInternalHire;
}

/**
 * Should fractional alternatives be hidden for this vertical?
 */
export function shouldHideFractional(vertical: VerticalCategory): boolean {
  const model = getVerticalModel(vertical);
  return model.noFractional;
}
