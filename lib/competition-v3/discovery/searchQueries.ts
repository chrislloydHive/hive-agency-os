// lib/competition-v3/discovery/searchQueries.ts
// Context-Driven Query Engine for Competition Lab V3
//
// Generates 15-30 targeted search queries based on:
// - Business model
// - Primary offers
// - ICP description
// - Geography
// - Market maturity
// - Value proposition
// - Price positioning
// - Strategic map nodes

import type { QueryContext, VerticalCategory } from '../types';
import { getVerticalSearchModifiers } from '../verticalClassifier';

// ============================================================================
// Vertical Query Template Types
// ============================================================================

/**
 * Vertical query templates can have nested sub-vertical templates
 */
type VerticalQueryTemplates = Record<string, string[] | Record<string, string[]>>;

// ============================================================================
// Query Templates
// ============================================================================

/**
 * Query template with context placeholders
 */
interface QueryTemplate {
  template: string;
  category: 'brand' | 'icp' | 'offer' | 'geo' | 'model' | 'value' | 'directory';
  priority: number; // 1-5, higher = more important
  requires: (keyof QueryContext)[]; // Required context fields
}

/**
 * NEUTRAL query templates - used when vertical is unknown
 * These avoid any industry-specific terms to prevent wrong competitor types
 */
const NEUTRAL_QUERY_TEMPLATES: QueryTemplate[] = [
  // Brand/Direct competitor queries (highest priority - always safe)
  { template: '{businessName} competitors', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: '{businessName} alternatives', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: 'companies like {businessName}', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: '{businessName} similar companies', category: 'brand', priority: 4, requires: ['businessName'] },
  { template: '{businessName} vs', category: 'brand', priority: 4, requires: ['businessName'] },

  // Industry-neutral queries
  { template: '{industry} companies', category: 'icp', priority: 4, requires: ['industry'] },
  { template: '{industry} {geography}', category: 'geo', priority: 4, requires: ['industry', 'geography'] },
  { template: 'top {industry} companies', category: 'icp', priority: 3, requires: ['industry'] },
  { template: '{primaryOffer} companies', category: 'offer', priority: 4, requires: ['primaryOffers'] },
  { template: '{primaryOffer} providers', category: 'offer', priority: 4, requires: ['primaryOffers'] },
];

/**
 * AGENCY-SPECIFIC query templates - ONLY for services vertical
 */
const AGENCY_QUERY_TEMPLATES: QueryTemplate[] = [
  // ICP + Stage driven queries (HIGH PRIORITY - these find the right shape competitors)
  { template: '{icpDescription} marketing agency for {icpStage} startups', category: 'icp', priority: 5, requires: ['icpDescription', 'icpStage'] },
  { template: 'B2B {icpStage} marketing agency', category: 'icp', priority: 5, requires: ['icpStage'] },
  { template: 'marketing partner for {icpStage} {targetIndustry} companies', category: 'icp', priority: 5, requires: ['icpStage', 'targetIndustries'] },
  { template: 'growth marketing partner for {icpDescription}', category: 'icp', priority: 4, requires: ['icpDescription'] },
  { template: '{industry} agency for {icpStage} companies', category: 'icp', priority: 4, requires: ['industry', 'icpStage'] },

  // Startup-focused agency queries (HIGH PRIORITY for startup ICP)
  { template: 'B2B startup marketing studio', category: 'icp', priority: 5, requires: [] },
  { template: 'marketing agency for seed stage startups', category: 'icp', priority: 4, requires: [] },
  { template: 'growth marketing partner for series A startups', category: 'icp', priority: 4, requires: [] },
  { template: 'startup marketing agency {geography}', category: 'icp', priority: 4, requires: ['geography'] },

  // Offer/Service queries (with ICP context)
  { template: 'boutique {primaryOffer} agency', category: 'offer', priority: 4, requires: ['primaryOffers'] },

  // Geographic queries (with ICP stage)
  { template: '{icpStage} marketing agency {geography}', category: 'geo', priority: 4, requires: ['icpStage', 'geography'] },
  { template: 'startup marketing agency {geography}', category: 'geo', priority: 4, requires: ['geography'] },

  // Value proposition / AI-oriented queries
  { template: 'AI-enabled marketing agency for startups', category: 'value', priority: 5, requires: [] },
  { template: 'AI-powered growth marketing studio', category: 'value', priority: 4, requires: [] },
  { template: '{differentiator} marketing agency', category: 'value', priority: 4, requires: ['differentiators'] },
  { template: 'tech-enabled marketing agency', category: 'value', priority: 3, requires: [] },

  // Directory queries (startup-focused)
  { template: 'clutch best startup marketing agencies', category: 'directory', priority: 4, requires: [] },
  { template: 'clutch {primaryOffer} agencies for startups', category: 'directory', priority: 4, requires: ['primaryOffers'] },
  { template: 'best B2B marketing agencies clutch {geography}', category: 'directory', priority: 3, requires: ['geography'] },
];

/**
 * COMMON query templates - used for all verticals
 */
const QUERY_TEMPLATES: QueryTemplate[] = [
  // Brand/Direct competitor queries (HIGH PRIORITY - know who mentions us)
  { template: '{businessName} competitors', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: '{businessName} alternatives', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: 'companies like {businessName}', category: 'brand', priority: 4, requires: ['businessName'] },

  // Offer/Service queries (neutral)
  { template: '{primaryOffer} for {icpDescription}', category: 'icp', priority: 5, requires: ['primaryOffers', 'icpDescription'] },
  { template: '{primaryOffer} for {icpStage} companies', category: 'offer', priority: 5, requires: ['primaryOffers', 'icpStage'] },
  { template: '{primaryOffer} firms {geography}', category: 'offer', priority: 4, requires: ['primaryOffers', 'geography'] },
];

// ============================================================================
// Competitor Type-Specific Query Templates
// ============================================================================

/**
 * Queries specifically for finding FRACTIONAL executive alternatives
 */
const FRACTIONAL_QUERY_TEMPLATES: string[] = [
  'fractional CMO firm {geography}',
  'fractional CMO for {icpStage} startups',
  'fractional marketing leader for startups',
  'part-time CMO services',
  'interim VP marketing for startups',
  'fractional chief marketing officer B2B',
  'outsourced CMO for SaaS',
  'fractional marketing executive',
];

/**
 * Queries specifically for finding AI/AUTOMATION agencies
 */
const AI_AGENCY_QUERY_TEMPLATES: string[] = [
  'AI marketing agency for startups',
  'AI-powered growth marketing studio',
  'AI-first marketing agency B2B',
  'automation-first marketing agency',
  'tech-enabled marketing firm for startups',
  'data-driven marketing agency SaaS',
];

/**
 * Queries for finding BOUTIQUE startup agencies
 */
const BOUTIQUE_AGENCY_QUERY_TEMPLATES: string[] = [
  'boutique B2B marketing agency',
  'boutique startup marketing studio',
  'small marketing agency for startups',
  'growth marketing partner for seed stage',
  'early stage startup marketing agency',
  'startup growth studio',
];

// ============================================================================
// Vertical-Specific Query Templates
// ============================================================================

/**
 * Query templates for RETAIL vertical
 */
const RETAIL_QUERY_TEMPLATES: Record<string, string[]> = {
  general: [
    '{businessName} competitors',
    '{businessName} alternatives',
    'stores like {businessName}',
    '{industry} stores {geography}',
    '{primaryOffer} retailers',
    '{primaryOffer} shops near me',
    'best {primaryOffer} stores',
  ],
  direct: [
    '{industry} retail stores',
    '{primaryOffer} specialty shops',
    'local {industry} stores',
  ],
  platform: [
    '{primaryOffer} on Amazon',
    '{primaryOffer} on eBay',
    '{primaryOffer} online retailers',
  ],
};

/**
 * Query templates for AUTOMOTIVE vertical
 */
const AUTOMOTIVE_QUERY_TEMPLATES: Record<string, string[] | Record<string, string[]>> = {
  general: [
    '{businessName} competitors',
    '{businessName} alternatives',
    'car electronics stores like {businessName}',
    'car audio shops {geography}',
    'mobile electronics installers {geography}',
    'car stereo installation near me',
    'best car audio shops',
  ],
  direct: [
    'car audio installation shops',
    'mobile electronics retailers',
    'car stereo stores {geography}',
    'remote start installers',
    'window tint shops {geography}',
    'custom car audio',
  ],
  platform: [
    'car audio on Amazon',
    'car electronics on eBay',
    'Crutchfield alternatives',
  ],
  subVertical: {
    'car-audio': [
      'car audio shops',
      'car stereo installation',
      'subwoofer installation',
      'speaker installation shops',
    ],
    'car-electronics': [
      'remote start installation',
      'dash cam installation',
      'backup camera installation',
    ],
    'window-tint': [
      'window tint shops',
      'ceramic tint installation',
      'automotive window film',
    ],
    'detailing': [
      'auto detailing shops',
      'ceramic coating installers',
      'paint protection film installers',
    ],
  },
};

/**
 * Query templates for SERVICES vertical (agencies, consulting)
 */
const SERVICES_QUERY_TEMPLATES: Record<string, string[]> = {
  general: [
    '{businessName} competitors',
    '{businessName} alternatives',
    'agencies like {businessName}',
    '{industry} agency {geography}',
    '{primaryOffer} consultants',
  ],
  direct: [
    '{industry} agencies',
    '{primaryOffer} firms',
    'boutique {industry} agency',
  ],
  fractional: [
    'fractional CMO',
    'fractional marketing executive',
    'part-time marketing director',
    'outsourced marketing leader',
  ],
  internal: [
    'hiring marketing director',
    'in-house marketing team',
    'marketing team vs agency',
  ],
};

/**
 * Query templates for SOFTWARE vertical
 */
const SOFTWARE_QUERY_TEMPLATES: Record<string, string[]> = {
  general: [
    '{businessName} competitors',
    '{businessName} alternatives',
    'software like {businessName}',
    '{primaryOffer} software',
    '{primaryOffer} platform',
  ],
  direct: [
    '{primaryOffer} software comparison',
    'best {primaryOffer} tools',
    '{industry} software',
  ],
  platform: [
    '{primaryOffer} alternatives',
    '{primaryOffer} integrations',
    '{primaryOffer} API',
  ],
};

/**
 * Query templates for CONSUMER-DTC vertical
 */
const CONSUMER_DTC_QUERY_TEMPLATES: Record<string, string[]> = {
  general: [
    '{businessName} competitors',
    '{businessName} alternatives',
    'brands like {businessName}',
    '{primaryOffer} brands',
    'best {primaryOffer} brands',
  ],
  direct: [
    '{primaryOffer} D2C brands',
    '{primaryOffer} direct to consumer',
    'new {primaryOffer} brands',
  ],
  platform: [
    '{primaryOffer} on Amazon',
    '{primaryOffer} subscription box',
  ],
};

/**
 * Query templates for MARKETPLACE vertical
 */
const MARKETPLACE_QUERY_TEMPLATES: Record<string, string[]> = {
  general: [
    '{businessName} competitors',
    '{businessName} alternatives',
    'marketplaces like {businessName}',
    '{marketplaceVertical} marketplace',
    '{marketplaceVertical} booking platform',
    'find {marketplaceVertical} near me',
    'book {marketplaceVertical} online',
  ],
  direct: [
    '{marketplaceVertical} marketplace app',
    '{marketplaceVertical} platform',
    '{marketplaceVertical} booking app',
    'best {marketplaceVertical} marketplace',
    '{marketplaceVertical} directory',
  ],
  platform: [
    '{marketplaceVertical} scheduling software',
    '{marketplaceVertical} booking software',
    '{marketplaceVertical} management platform',
  ],
};

/**
 * Marketplace sub-vertical specific queries
 */
const MARKETPLACE_SUBVERTICAL_QUERIES: Record<string, string[]> = {
  fitness: [
    'personal trainer marketplace',
    'fitness trainer booking app',
    'find personal trainers near me',
    'book fitness classes online',
    'fitness coach platform',
    'gym trainer marketplace',
    'online fitness marketplace',
    'TrainHeroic competitors',
    'Trainerize competitors',
    'personal training software alternatives',
  ],
  wellness: [
    'wellness provider marketplace',
    'spa booking platform',
    'massage therapist marketplace',
    'wellness practitioner booking',
    'alternative health marketplace',
  ],
  'home-services': [
    'home services marketplace',
    'handyman booking app',
    'home repair platform',
    'Thumbtack competitors',
    'TaskRabbit alternatives',
    'HomeAdvisor competitors',
  ],
  'professional-services': [
    'professional services marketplace',
    'consultant marketplace',
    'freelance professional platform',
    'Upwork alternatives',
    'Fiverr competitors',
  ],
  creative: [
    'creative freelancer marketplace',
    'designer marketplace',
    'photographer booking platform',
    '99designs competitors',
    'creative talent platform',
  ],
  education: [
    'tutoring marketplace',
    'online tutor platform',
    'private lessons marketplace',
    'Wyzant competitors',
    'TutorMe alternatives',
  ],
  rentals: [
    'rental marketplace',
    'vacation rental platform',
    'equipment rental marketplace',
    'Airbnb competitors',
    'VRBO alternatives',
  ],
  events: [
    'event vendor marketplace',
    'wedding vendor platform',
    'event services marketplace',
    'Thumbtack weddings',
    'GigSalad competitors',
  ],
};

/**
 * Get vertical-specific query templates
 */
function getVerticalQueryTemplates(vertical: VerticalCategory): VerticalQueryTemplates {
  switch (vertical) {
    case 'retail':
      return RETAIL_QUERY_TEMPLATES;
    case 'automotive':
      return AUTOMOTIVE_QUERY_TEMPLATES;
    case 'services':
      return SERVICES_QUERY_TEMPLATES;
    case 'software':
      return SOFTWARE_QUERY_TEMPLATES;
    case 'consumer-dtc':
      return CONSUMER_DTC_QUERY_TEMPLATES;
    case 'marketplace':
      return MARKETPLACE_QUERY_TEMPLATES;
    default:
      return {};
  }
}

// ============================================================================
// Query Generation
// ============================================================================

/**
 * Generate search queries from context
 *
 * Strategy:
 * 1. Start with vertical-specific queries if vertical is known
 * 2. Add ICP-aware queries that target the right company shape
 * 3. Add type-specific queries (fractional, AI-agencies, boutique) - only for relevant verticals
 * 4. Add brand/competitor queries if we have a business name
 * 5. Fill with directory queries
 */
export function generateSearchQueries(context: QueryContext): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();
  const vertical = context.verticalCategory || 'unknown';

  const addQuery = (query: string): boolean => {
    const normalized = normalizeQuery(query);
    if (normalized && !seen.has(normalized) && normalized.length >= 10) {
      seen.add(normalized);
      queries.push(query);
      return true;
    }
    return false;
  };

  // Get vertical-specific modifiers to filter irrelevant results
  const verticalMods = getVerticalSearchModifiers(vertical);

  // Phase 0: Add VERTICAL-SPECIFIC queries first (highest priority)
  const verticalTemplates = getVerticalQueryTemplates(vertical);
  if (Object.keys(verticalTemplates).length > 0) {
    console.log(`[competition-v3/queries] Using ${vertical} vertical-specific templates`);

    // Add general vertical queries
    const generalTemplates = verticalTemplates.general;
    if (Array.isArray(generalTemplates)) {
      for (const template of generalTemplates) {
        const expanded = expandVerticalTemplate(template, context);
        for (const q of expanded) {
          addQuery(q);
        }
      }
    }

    // Add direct competitor queries
    const directTemplates = verticalTemplates.direct;
    if (Array.isArray(directTemplates)) {
      for (const template of directTemplates) {
        const expanded = expandVerticalTemplate(template, context);
        for (const q of expanded) {
          addQuery(q);
        }
      }
    }

    // Add platform queries (only for verticals that have them)
    const platformTemplates = verticalTemplates.platform;
    if (Array.isArray(platformTemplates)) {
      for (const template of platformTemplates) {
        const expanded = expandVerticalTemplate(template, context);
        for (const q of expanded) {
          addQuery(q);
        }
      }
    }

    // Add sub-vertical queries if applicable (e.g., car-audio for automotive)
    if (context.subVertical && verticalTemplates.subVertical) {
      const subTemplates = (verticalTemplates.subVertical as Record<string, string[]>)[context.subVertical];
      if (subTemplates) {
        for (const template of subTemplates) {
          addQuery(template);
        }
      }
    }
  }

  // Phase 0b: Add MARKETPLACE SUB-VERTICAL queries if this is a marketplace
  if (vertical === 'marketplace' && context.marketplaceVertical) {
    const subVerticalQueries = MARKETPLACE_SUBVERTICAL_QUERIES[context.marketplaceVertical];
    if (subVerticalQueries) {
      console.log(`[competition-v3/queries] Adding ${context.marketplaceVertical} marketplace sub-vertical queries`);
      for (const query of subVerticalQueries) {
        addQuery(query);
      }
    }
  }

  // Phase 1: Add templated queries based on vertical
  // CRITICAL: For unknown verticals, use ONLY neutral queries - NO agency queries
  if (vertical === 'unknown') {
    console.log('[competition-v3/queries] Using NEUTRAL templates for unknown vertical');
    // Use neutral templates only - these are safe for any company type
    const sortedNeutral = [...NEUTRAL_QUERY_TEMPLATES].sort((a, b) => b.priority - a.priority);
    for (const template of sortedNeutral) {
      if (!hasRequiredFields(context, template.requires)) {
        continue;
      }
      const variations = expandTemplate(template.template, context);
      for (const query of variations) {
        addQuery(query);
      }
    }
  } else if (vertical === 'services') {
    console.log('[competition-v3/queries] Using AGENCY templates for services vertical');
    // For services vertical, add agency-specific templates
    const sortedAgency = [...AGENCY_QUERY_TEMPLATES, ...QUERY_TEMPLATES].sort((a, b) => b.priority - a.priority);
    for (const template of sortedAgency) {
      if (!hasRequiredFields(context, template.requires)) {
        continue;
      }
      const variations = expandTemplate(template.template, context);
      for (const query of variations) {
        addQuery(query);
      }
      if (queries.length >= 20) break;
    }
  } else {
    // For known non-services verticals, use common templates (already filtered by vertical-specific phase)
    const sortedTemplates = [...QUERY_TEMPLATES].sort((a, b) => b.priority - a.priority);
    for (const template of sortedTemplates) {
      // Skip agency templates for non-services verticals
      if (template.template.includes('agency') || template.template.includes('consultancy')) {
        continue;
      }
      if (!hasRequiredFields(context, template.requires)) {
        continue;
      }
      const variations = expandTemplate(template.template, context);
      for (const query of variations) {
        addQuery(query);
      }
      if (queries.length >= 20) break;
    }
  }

  // Phase 2: Add FRACTIONAL executive queries - ONLY for services vertical (NOT unknown!)
  if (vertical === 'services') {
    for (const template of FRACTIONAL_QUERY_TEMPLATES) {
      const expanded = expandSimpleTemplate(template, context);
      if (expanded) addQuery(expanded);
    }
  }

  // Phase 3: Add AI/AUTOMATION agency queries - ONLY for services vertical (NOT unknown!)
  if (vertical === 'services') {
    if (context.aiOrientation === 'ai-first' || context.aiOrientation === 'ai-augmented') {
      for (const template of AI_AGENCY_QUERY_TEMPLATES) {
        addQuery(template);
      }
    } else {
      // Add fewer AI queries for non-AI companies
      addQuery(AI_AGENCY_QUERY_TEMPLATES[0]);
      addQuery(AI_AGENCY_QUERY_TEMPLATES[1]);
    }
  }

  // Phase 4: Add BOUTIQUE agency queries - ONLY for services vertical (NOT unknown!)
  if (vertical === 'services') {
    if (context.icpStage === 'startup' || context.icpStage === 'growth') {
      for (const template of BOUTIQUE_AGENCY_QUERY_TEMPLATES) {
        addQuery(template);
      }
    }
  }

  // Phase 5: Add fallback queries if still under target
  if (queries.length < 25) {
    const fallbacks = generateFallbackQueries(context);
    for (const query of fallbacks) {
      // Filter out queries that don't match the vertical
      const lowerQuery = query.toLowerCase();
      const shouldExclude = verticalMods.exclude.some(ex => lowerQuery.includes(ex.toLowerCase()));
      if (shouldExclude) continue;

      addQuery(query);
      if (queries.length >= 30) break;
    }
  }

  console.log(`[competition-v3/queries] Generated ${queries.length} queries for ${context.businessName} (vertical: ${vertical})`);
  return queries;
}

/**
 * Expand a vertical-specific template
 */
function expandVerticalTemplate(template: string, context: QueryContext): string[] {
  const results: string[] = [];
  let query = template;

  // Replace single-value placeholders
  query = query.replace('{businessName}', context.businessName || '');
  query = query.replace('{industry}', context.industry || '');
  query = query.replace('{geography}', context.geography || '');
  query = query.replace('{marketplaceVertical}', context.marketplaceVertical || 'service');

  // Handle primaryOffer - generate multiple queries
  if (template.includes('{primaryOffer}')) {
    const offers = context.primaryOffers.slice(0, 3);
    if (offers.length > 0) {
      for (const offer of offers) {
        const expanded = query.replace('{primaryOffer}', offer);
        if (!expanded.includes('{') && expanded.length >= 10) {
          results.push(expanded.trim());
        }
      }
    }
    return results;
  }

  // Single query (no array expansion needed)
  if (!query.includes('{') && query.trim().length >= 10) {
    results.push(query.trim());
  }

  return results;
}

/**
 * Expand a simple template (single placeholders only)
 */
function expandSimpleTemplate(template: string, context: QueryContext): string | null {
  let query = template;

  // Replace placeholders
  query = query.replace('{geography}', context.geography || '');
  query = query.replace('{icpStage}', context.icpStage || '');
  query = query.replace('{industry}', context.industry || '');

  // Skip if has unreplaced placeholders or is too short
  if (query.includes('{') || query.includes('}')) return null;
  if (query.trim().length < 10) return null;

  return query.trim();
}

/**
 * Check if context has required fields
 */
function hasRequiredFields(context: QueryContext, required: (keyof QueryContext)[]): boolean {
  for (const field of required) {
    const value = context[field];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
  }
  return true;
}

/**
 * Expand template with context values
 */
function expandTemplate(template: string, context: QueryContext): string[] {
  const results: string[] = [];

  // Simple placeholder replacement
  let query = template;

  // Replace single-value placeholders
  query = query.replace('{businessName}', context.businessName || '');
  query = query.replace('{industry}', context.industry || '');
  query = query.replace('{businessModel}', context.businessModel || '');
  query = query.replace('{icpDescription}', context.icpDescription || '');
  query = query.replace('{icpStage}', context.icpStage || '');
  query = query.replace('{geography}', context.geography || '');
  query = query.replace('{valueProposition}', context.valueProposition || '');
  query = query.replace('{pricePositioning}', context.pricePositioning || '');
  query = query.replace('{serviceModel}', context.serviceModel || '');
  query = query.replace('{aiOrientation}', context.aiOrientation || '');

  // Handle array placeholders - generate multiple queries
  if (template.includes('{primaryOffer}')) {
    const offers = context.primaryOffers.slice(0, 3);
    for (const offer of offers) {
      results.push(query.replace('{primaryOffer}', offer));
    }
    // Also try with first offer if no results yet
    if (results.length === 0 && context.primaryOffers.length > 0) {
      results.push(query.replace('{primaryOffer}', context.primaryOffers[0]));
    }
  } else if (template.includes('{secondaryOffer}')) {
    const offers = context.primaryOffers.slice(1, 3);
    for (const offer of offers) {
      results.push(query.replace('{secondaryOffer}', offer));
    }
  } else if (template.includes('{targetIndustry}')) {
    const industries = context.targetIndustries.slice(0, 2);
    for (const ind of industries) {
      results.push(query.replace('{targetIndustry}', ind));
    }
  } else if (template.includes('{differentiator}')) {
    const diffs = context.differentiators.slice(0, 3);
    for (const diff of diffs) {
      results.push(query.replace('{differentiator}', diff));
    }
  } else if (template.includes('{serviceRegion}')) {
    const regions = context.serviceRegions.slice(0, 2);
    for (const region of regions) {
      results.push(query.replace('{serviceRegion}', region));
    }
  } else {
    // No array placeholder, just add the query
    results.push(query);
  }

  // Filter out queries with unreplaced placeholders
  return results.filter(q => !q.includes('{') && !q.includes('}'));
}

/**
 * Normalize query for deduplication
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate fallback queries when context is sparse
 * CRITICAL: These must be vertical-aware - NO agency queries for non-agency companies
 */
function generateFallbackQueries(context: QueryContext): string[] {
  const queries: string[] = [];
  const vertical = context.verticalCategory || 'unknown';

  // Always add brand-based queries (safe for any vertical)
  if (context.businessName) {
    queries.push(`${context.businessName} competitors`);
    queries.push(`${context.businessName} alternatives`);
    queries.push(`companies similar to ${context.businessName}`);
  }

  // Industry-specific queries (neutral)
  if (context.industry) {
    queries.push(`${context.industry} companies`);
    queries.push(`top ${context.industry} providers`);
    queries.push(`${context.industry} ${context.geography || ''}`);
  }

  // Offer queries (neutral)
  if (context.primaryOffers.length > 0) {
    const offer = context.primaryOffers[0];
    queries.push(`${offer} companies`);
    queries.push(`${offer} providers`);
  }

  // ONLY add agency queries if vertical is explicitly 'services'
  if (vertical === 'services') {
    if (context.industry) {
      queries.push(`${context.industry} agency for startups`);
      queries.push(`boutique ${context.industry} consultancy`);
    }
    if (context.primaryOffers.length > 0) {
      const offer = context.primaryOffers[0];
      queries.push(`${offer} agency for SaaS companies`);
    }
    queries.push('B2B startup marketing agency');
    queries.push('growth marketing studio for startups');
    queries.push('fractional CMO for startups');
  }

  return queries;
}

// ============================================================================
// Category-Specific Query Builders
// ============================================================================

/**
 * Build queries specifically for finding direct competitors
 */
export function buildDirectCompetitorQueries(context: QueryContext): string[] {
  const queries: string[] = [];

  if (context.businessName) {
    queries.push(`${context.businessName} competitors`);
    queries.push(`${context.businessName} alternatives`);
    queries.push(`companies like ${context.businessName}`);
  }

  if (context.industry && context.icpStage) {
    queries.push(`${context.industry} agency for ${context.icpStage} companies`);
  }

  if (context.primaryOffers.length > 0 && context.icpDescription) {
    queries.push(`${context.primaryOffers[0]} for ${context.icpDescription}`);
  }

  return queries;
}

/**
 * Build queries for finding fractional executive competitors
 */
export function buildFractionalQueries(context: QueryContext): string[] {
  const queries: string[] = [
    'fractional CMO services',
    'fractional marketing executive',
    'part-time CMO',
    'interim marketing director',
    'fractional growth leader',
  ];

  if (context.icpStage) {
    queries.push(`fractional CMO for ${context.icpStage} companies`);
  }

  if (context.geography) {
    queries.push(`fractional CMO ${context.geography}`);
  }

  return queries;
}

/**
 * Build queries for finding platform alternatives
 */
export function buildPlatformQueries(context: QueryContext): string[] {
  const queries: string[] = [
    'marketing automation software',
    'AI marketing platform',
    'growth marketing tools',
    'marketing analytics software',
    'campaign management platform',
  ];

  if (context.primaryOffers.length > 0) {
    for (const offer of context.primaryOffers.slice(0, 2)) {
      queries.push(`${offer} software`);
      queries.push(`${offer} platform`);
      queries.push(`${offer} tool`);
    }
  }

  return queries;
}

/**
 * Build queries for directory searches
 */
export function buildDirectoryQueries(context: QueryContext): string[] {
  const queries: string[] = [];
  const directories = ['clutch', 'g2', 'manifest', 'upcity'];

  for (const dir of directories) {
    if (context.industry) {
      queries.push(`${dir} top ${context.industry} agencies`);
    }
    if (context.geography) {
      queries.push(`${dir} agencies ${context.geography}`);
    }
    if (context.primaryOffers.length > 0) {
      queries.push(`${dir} ${context.primaryOffers[0]} agencies`);
    }
  }

  return queries;
}

// ============================================================================
// Context Loading
// ============================================================================

/**
 * Build QueryContext from Context Graph
 */
export function buildQueryContextFromGraph(graph: any): QueryContext {
  const identity = graph.identity || {};
  const audience = graph.audience || {};
  const productOffer = graph.productOffer || {};
  const brand = graph.brand || {};

  const icpDesc = audience.icpDescription?.value || audience.primaryAudience?.value || null;
  const icpStageRaw = extractIcpStage(icpDesc);
  const aiOrientationRaw = extractAiOrientation(brand, productOffer);

  // Determine business model category (B2B vs B2C vs Hybrid)
  const businessModelText = [
    identity.businessModel?.value,
    audience.customerType?.value,
    audience.targetAudience?.value,
    identity.industry?.value,
  ].join(' ').toLowerCase();

  const b2cIndicators = ['consumer', 'b2c', 'retail', 'household', 'individual', 'shopper', 'driver', 'customer'];
  const b2bIndicators = ['b2b', 'business', 'enterprise', 'company', 'organization', 'saas', 'client', 'corporate'];

  const hasB2C = b2cIndicators.some(indicator => businessModelText.includes(indicator));
  const hasB2B = b2bIndicators.some(indicator => businessModelText.includes(indicator));

  let businessModelCategory: QueryContext['businessModelCategory'] = null;
  if (hasB2C && hasB2B) {
    businessModelCategory = 'Hybrid';
  } else if (hasB2C) {
    businessModelCategory = 'B2C';
  } else if (hasB2B) {
    businessModelCategory = 'B2B';
  }

  return {
    businessName: identity.businessName?.value || graph.companyName || 'Unknown',
    domain: graph.meta?.domain || null,

    // Identity
    industry: identity.industry?.value || null,
    businessModel: identity.businessModel?.value || null,
    businessModelCategory,

    // Audience
    icpDescription: icpDesc,
    icpStage: icpStageRaw as QueryContext['icpStage'],
    targetIndustries: extractIndustries(audience),

    // Product/Offer
    primaryOffers: productOffer.productLines?.value || [],
    serviceModel: productOffer.serviceModel?.value || null,
    pricePositioning: productOffer.priceRange?.value || null,

    // Brand/Positioning
    valueProposition: brand.valueProps?.value?.[0] || null,
    differentiators: brand.differentiators?.value || [],

    // Geographic
    geography: identity.geographicFootprint?.value || null,
    serviceRegions: extractServiceRegions(identity),

    // Strategic
    aiOrientation: aiOrientationRaw as QueryContext['aiOrientation'],
  };
}

/**
 * Extract ICP stage from description
 */
function extractIcpStage(icpDescription: string | null): string | null {
  if (!icpDescription) return null;

  const lower = icpDescription.toLowerCase();

  if (lower.includes('startup') || lower.includes('early-stage') || lower.includes('seed')) {
    return 'startup';
  }
  if (lower.includes('growth') || lower.includes('series') || lower.includes('scaling')) {
    return 'growth';
  }
  if (lower.includes('enterprise') || lower.includes('large') || lower.includes('fortune')) {
    return 'enterprise';
  }
  if (lower.includes('smb') || lower.includes('small business') || lower.includes('mid-market')) {
    return 'mid-market';
  }

  return null;
}

/**
 * Extract target industries from audience
 */
function extractIndustries(audience: any): string[] {
  const industries: string[] = [];

  // Check segment details (ensure it's an array)
  const segments = audience.segmentDetails?.value;
  if (Array.isArray(segments)) {
    for (const segment of segments) {
      if (segment?.industry) {
        industries.push(segment.industry);
      }
    }
  }

  // Check core segments (ensure it's an array)
  const coreSegments = audience.coreSegments?.value;
  if (Array.isArray(coreSegments)) {
    for (const segment of coreSegments) {
      if (typeof segment === 'string' && segment.length < 50) {
        industries.push(segment);
      }
    }
  }

  return [...new Set(industries)].slice(0, 5);
}

/**
 * Extract service regions
 */
function extractServiceRegions(identity: any): string[] {
  const regions: string[] = [];

  const geo = identity.geographicFootprint?.value;
  if (geo) {
    regions.push(geo);
  }

  // Could also extract from other fields
  return regions;
}

/**
 * Extract AI orientation from brand/product
 */
function extractAiOrientation(brand: any, productOffer: any): string | null {
  const positioning = brand.positioning?.value?.toLowerCase() || '';
  const differentiators = (brand.differentiators?.value || []).join(' ').toLowerCase();
  const offers = (productOffer.productLines?.value || []).join(' ').toLowerCase();

  const combined = `${positioning} ${differentiators} ${offers}`;

  if (combined.includes('ai-first') || combined.includes('ai-powered') || combined.includes('ai-native')) {
    return 'ai-first';
  }
  if (combined.includes('ai-augmented') || combined.includes('ai-enhanced') || combined.includes('tech-enabled')) {
    return 'ai-augmented';
  }
  if (combined.includes('traditional') || combined.includes('white-glove') || combined.includes('high-touch')) {
    return 'traditional';
  }

  return null;
}
