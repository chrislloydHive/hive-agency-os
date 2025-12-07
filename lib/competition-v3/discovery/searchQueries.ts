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

import type { QueryContext } from '../types';

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

const QUERY_TEMPLATES: QueryTemplate[] = [
  // Brand/Direct competitor queries (HIGH PRIORITY - know who mentions us)
  { template: '{businessName} competitors', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: '{businessName} alternatives', category: 'brand', priority: 5, requires: ['businessName'] },
  { template: 'companies like {businessName}', category: 'brand', priority: 4, requires: ['businessName'] },

  // ICP + Stage driven queries (HIGH PRIORITY - these find the right shape competitors)
  { template: '{icpDescription} marketing agency for {icpStage} startups', category: 'icp', priority: 5, requires: ['icpDescription', 'icpStage'] },
  { template: 'B2B {icpStage} marketing agency', category: 'icp', priority: 5, requires: ['icpStage'] },
  { template: '{primaryOffer} for {icpDescription}', category: 'icp', priority: 5, requires: ['primaryOffers', 'icpDescription'] },
  { template: 'marketing partner for {icpStage} {targetIndustry} companies', category: 'icp', priority: 5, requires: ['icpStage', 'targetIndustries'] },
  { template: 'growth marketing partner for {icpDescription}', category: 'icp', priority: 4, requires: ['icpDescription'] },
  { template: '{industry} agency for {icpStage} companies', category: 'icp', priority: 4, requires: ['industry', 'icpStage'] },

  // Startup-focused agency queries (HIGH PRIORITY for startup ICP)
  { template: 'B2B startup marketing studio', category: 'icp', priority: 5, requires: [] },
  { template: 'marketing agency for seed stage startups', category: 'icp', priority: 4, requires: [] },
  { template: 'growth marketing partner for series A startups', category: 'icp', priority: 4, requires: [] },
  { template: 'startup marketing agency {geography}', category: 'icp', priority: 4, requires: ['geography'] },

  // Offer/Service queries (with ICP context)
  { template: '{primaryOffer} for {icpStage} companies', category: 'offer', priority: 5, requires: ['primaryOffers', 'icpStage'] },
  { template: 'boutique {primaryOffer} agency', category: 'offer', priority: 4, requires: ['primaryOffers'] },
  { template: '{primaryOffer} firms {geography}', category: 'offer', priority: 4, requires: ['primaryOffers', 'geography'] },

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
// Query Generation
// ============================================================================

/**
 * Generate search queries from context
 *
 * Strategy:
 * 1. Start with ICP-aware queries that target the right company shape
 * 2. Add type-specific queries (fractional, AI-agencies, boutique)
 * 3. Add brand/competitor queries if we have a business name
 * 4. Fill with directory queries
 */
export function generateSearchQueries(context: QueryContext): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  const addQuery = (query: string): boolean => {
    const normalized = normalizeQuery(query);
    if (normalized && !seen.has(normalized) && normalized.length >= 10) {
      seen.add(normalized);
      queries.push(query);
      return true;
    }
    return false;
  };

  // Sort templates by priority
  const sortedTemplates = [...QUERY_TEMPLATES].sort((a, b) => b.priority - a.priority);

  // Phase 1: Add templated queries (ICP-driven, brand, etc.)
  for (const template of sortedTemplates) {
    if (!hasRequiredFields(context, template.requires)) {
      continue;
    }

    const variations = expandTemplate(template.template, context);
    for (const query of variations) {
      addQuery(query);
    }

    if (queries.length >= 20) break;
  }

  // Phase 2: Add FRACTIONAL executive queries (always relevant for agencies)
  for (const template of FRACTIONAL_QUERY_TEMPLATES) {
    const expanded = expandSimpleTemplate(template, context);
    if (expanded) addQuery(expanded);
  }

  // Phase 3: Add AI/AUTOMATION agency queries (especially if AI-oriented)
  if (context.aiOrientation === 'ai-first' || context.aiOrientation === 'ai-augmented') {
    for (const template of AI_AGENCY_QUERY_TEMPLATES) {
      addQuery(template);
    }
  } else {
    // Add fewer AI queries for non-AI companies
    addQuery(AI_AGENCY_QUERY_TEMPLATES[0]);
    addQuery(AI_AGENCY_QUERY_TEMPLATES[1]);
  }

  // Phase 4: Add BOUTIQUE agency queries (for startup ICPs)
  if (context.icpStage === 'startup' || context.icpStage === 'growth') {
    for (const template of BOUTIQUE_AGENCY_QUERY_TEMPLATES) {
      addQuery(template);
    }
  }

  // Phase 5: Add fallback queries if still under target
  if (queries.length < 25) {
    const fallbacks = generateFallbackQueries(context);
    for (const query of fallbacks) {
      addQuery(query);
      if (queries.length >= 30) break;
    }
  }

  console.log(`[competition-v3/queries] Generated ${queries.length} queries for ${context.businessName}`);
  return queries;
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
 * Focused on startup/growth stage agencies, not generic enterprise
 */
function generateFallbackQueries(context: QueryContext): string[] {
  const queries: string[] = [];

  // Industry-specific but ICP-aware
  if (context.industry) {
    queries.push(`${context.industry} agency for startups`);
    queries.push(`boutique ${context.industry} consultancy`);
  }

  // Offer queries with startup focus
  if (context.primaryOffers.length > 0) {
    const offer = context.primaryOffers[0];
    queries.push(`${offer} for B2B startups`);
    queries.push(`${offer} agency for SaaS companies`);
  }

  // Startup-focused agency queries (avoid generic "digital marketing agency")
  queries.push('B2B startup marketing agency');
  queries.push('growth marketing studio for startups');
  queries.push('SaaS marketing agency');
  queries.push('demand generation agency for startups');
  queries.push('content marketing for B2B startups');
  queries.push('brand strategy agency for tech startups');

  // Fractional alternatives (important competitor type)
  queries.push('fractional CMO for startups');
  queries.push('part-time marketing director');

  // Platform alternatives (limited - not the primary competition)
  queries.push('AI marketing platform for startups');
  queries.push('marketing automation for small teams');

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

  const icpDesc = identity.icpDescription?.value || audience.primaryAudience?.value || null;
  const icpStageRaw = extractIcpStage(icpDesc);
  const aiOrientationRaw = extractAiOrientation(brand, productOffer);

  return {
    businessName: identity.businessName?.value || graph.companyName || 'Unknown',
    domain: graph.meta?.domain || null,

    // Identity
    industry: identity.industry?.value || null,
    businessModel: identity.businessModel?.value || null,

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

  // Check segment details
  const segments = audience.segmentDetails?.value || [];
  for (const segment of segments) {
    if (segment.industry) {
      industries.push(segment.industry);
    }
  }

  // Check core segments
  const coreSegments = audience.coreSegments?.value || [];
  for (const segment of coreSegments) {
    if (typeof segment === 'string' && segment.length < 50) {
      industries.push(segment);
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
