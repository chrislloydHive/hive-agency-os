// lib/competition-v4/candidateExpansion.ts
// Candidate Recall Expansion Module
//
// Expands competitor candidate discovery to improve recall for hybrid retail+installation
// businesses by generating local-search style queries based on service areas.

import type { ProposedCompetitor, CandidateExpansionStats, CompetitiveModalityType } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ExpansionInput {
  /** Service areas from context (cities, regions, states) */
  serviceAreas?: string[];
  /** Product categories from context */
  productCategories?: string[];
  /** Service categories from context */
  serviceCategories?: string[];
  /** Competitive modality */
  modality?: CompetitiveModalityType;
  /** Company's geographic scope */
  geographicScope?: 'local' | 'regional' | 'national';
}

export interface ExpansionResult {
  /** Generated expansion queries */
  queries: string[];
  /** Cities/regions used */
  serviceAreas: string[];
  /** Stats for debugging */
  stats: {
    queriesGenerated: number;
    serviceAreasUsed: number;
  };
}

// ============================================================================
// State Abbreviation Mapping
// ============================================================================

const STATE_CITIES: Record<string, string[]> = {
  // Pacific Northwest
  WA: ['Seattle', 'Tacoma', 'Bellevue', 'Spokane', 'Vancouver', 'Everett'],
  OR: ['Portland', 'Eugene', 'Salem', 'Bend', 'Medford', 'Hillsboro'],
  // Mountain
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood'],
  UT: ['Salt Lake City', 'Provo', 'West Valley City', 'Ogden', 'Sandy'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Gilbert'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
  // California
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno'],
  // Texas
  TX: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso'],
  // Florida
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'St. Petersburg'],
  // Northeast
  NY: ['New York', 'Buffalo', 'Rochester', 'Syracuse', 'Albany', 'Yonkers'],
  NJ: ['Newark', 'Jersey City', 'Trenton', 'Paterson', 'Elizabeth'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
  // Midwest
  IL: ['Chicago', 'Aurora', 'Naperville', 'Rockford', 'Joliet', 'Springfield'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Ann Arbor', 'Lansing', 'Flint'],
  MN: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'],
  // Southeast
  GA: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Macon'],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem'],
  VA: ['Virginia Beach', 'Norfolk', 'Richmond', 'Chesapeake', 'Arlington'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Murfreesboro'],
};

// ============================================================================
// Service Category Templates
// ============================================================================

const SERVICE_QUERY_TEMPLATES: Record<string, string[]> = {
  // Car audio / mobile electronics
  'car audio': [
    'car audio installation {city}',
    'car stereo installation {city}',
    'car speaker installation {city}',
    'mobile electronics {city}',
    '12 volt shop {city}',
  ],
  'car electronics': [
    'car electronics installation {city}',
    'car alarm installation {city}',
    'car amplifier installation {city}',
  ],
  'remote start': [
    'remote start installation {city}',
    'remote car starter {city}',
  ],
  'window tinting': [
    'window tinting {city}',
    'car window tint {city}',
    'auto tint {city}',
  ],
  // HVAC
  hvac: [
    'hvac installation {city}',
    'air conditioning installation {city}',
    'furnace installation {city}',
    'hvac repair {city}',
  ],
  // Plumbing
  plumbing: [
    'plumber {city}',
    'plumbing service {city}',
    'plumbing repair {city}',
    'water heater installation {city}',
  ],
  // Electrical
  electrical: [
    'electrician {city}',
    'electrical service {city}',
    'electrical installation {city}',
  ],
  // General installation
  installation: [
    'installation service {city}',
    'professional installation {city}',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract states from service areas string
 */
function extractStates(serviceAreas: string[]): string[] {
  const states: Set<string> = new Set();

  for (const area of serviceAreas) {
    // Check for state abbreviations
    const stateMatch = area.match(/\b([A-Z]{2})\b/);
    if (stateMatch && STATE_CITIES[stateMatch[1]]) {
      states.add(stateMatch[1]);
    }

    // Check for full state names
    const stateNames: Record<string, string> = {
      'washington': 'WA',
      'oregon': 'OR',
      'colorado': 'CO',
      'california': 'CA',
      'texas': 'TX',
      'florida': 'FL',
      'new york': 'NY',
      'illinois': 'IL',
      'ohio': 'OH',
      'michigan': 'MI',
      'georgia': 'GA',
      'north carolina': 'NC',
      'arizona': 'AZ',
      'nevada': 'NV',
    };

    const lowerArea = area.toLowerCase();
    for (const [name, abbr] of Object.entries(stateNames)) {
      if (lowerArea.includes(name)) {
        states.add(abbr);
      }
    }
  }

  return Array.from(states);
}

/**
 * Get cities for a set of states
 */
function getCitiesForStates(states: string[], maxPerState: number = 4): string[] {
  const cities: string[] = [];

  for (const state of states) {
    const stateCities = STATE_CITIES[state];
    if (stateCities) {
      cities.push(...stateCities.slice(0, maxPerState));
    }
  }

  return cities;
}

/**
 * Map service categories to query templates
 */
function getQueryTemplates(serviceCategories: string[]): string[] {
  const templates: Set<string> = new Set();

  for (const category of serviceCategories) {
    const lowerCategory = category.toLowerCase();

    // Direct match
    for (const [key, queryTemplates] of Object.entries(SERVICE_QUERY_TEMPLATES)) {
      if (lowerCategory.includes(key) || key.includes(lowerCategory)) {
        queryTemplates.forEach(t => templates.add(t));
      }
    }

    // Fuzzy match on keywords
    if (lowerCategory.includes('audio') || lowerCategory.includes('stereo')) {
      SERVICE_QUERY_TEMPLATES['car audio']?.forEach(t => templates.add(t));
    }
    if (lowerCategory.includes('install')) {
      SERVICE_QUERY_TEMPLATES['installation']?.forEach(t => templates.add(t));
    }
    if (lowerCategory.includes('tint')) {
      SERVICE_QUERY_TEMPLATES['window tinting']?.forEach(t => templates.add(t));
    }
    if (lowerCategory.includes('remote') || lowerCategory.includes('start')) {
      SERVICE_QUERY_TEMPLATES['remote start']?.forEach(t => templates.add(t));
    }
  }

  return Array.from(templates);
}

// ============================================================================
// Main Expansion Function
// ============================================================================

/**
 * Generate expansion queries for improved competitor recall
 */
export function generateExpansionQueries(input: ExpansionInput): ExpansionResult {
  const queries: string[] = [];
  let serviceAreas: string[] = [];

  // Step 1: Determine service areas
  if (input.serviceAreas && input.serviceAreas.length > 0) {
    // Extract states and get representative cities
    const states = extractStates(input.serviceAreas);
    if (states.length > 0) {
      serviceAreas = getCitiesForStates(states, 4);
    }

    // Also include any direct city mentions
    for (const area of input.serviceAreas) {
      // Check if this is a city name (not a state)
      const isCityLike = !area.match(/^[A-Z]{2}$/) &&
                         !Object.keys(STATE_CITIES).some(s => area.toLowerCase().includes(s.toLowerCase()));
      if (isCityLike && area.length > 2) {
        serviceAreas.push(area);
      }
    }
  }

  // Default to national scope if no service areas
  if (serviceAreas.length === 0 && input.geographicScope === 'national') {
    // Use major metro areas for national businesses
    serviceAreas = ['Seattle', 'Los Angeles', 'Chicago', 'New York', 'Houston'];
  }

  // Step 2: Get query templates based on service categories
  let templates: string[] = [];

  if (input.serviceCategories && input.serviceCategories.length > 0) {
    templates = getQueryTemplates(input.serviceCategories);
  }

  // Add product category-based queries for hybrid businesses
  if ((input.modality === 'Retail+Installation' || input.modality === 'RetailWithInstallAddon') &&
      input.productCategories && input.productCategories.length > 0) {
    for (const product of input.productCategories.slice(0, 3)) {
      templates.push(`${product} store {city}`);
      templates.push(`${product} installation {city}`);
      templates.push(`buy ${product} {city}`);
    }
  }

  // Step 3: Generate queries by combining templates with cities
  const uniqueCities = Array.from(new Set(serviceAreas)).slice(0, 6); // Limit to 6 cities

  for (const template of templates.slice(0, 8)) { // Limit templates
    for (const city of uniqueCities) {
      queries.push(template.replace('{city}', city));
    }
  }

  return {
    queries: queries.slice(0, 30), // Cap at 30 queries
    serviceAreas: uniqueCities,
    stats: {
      queriesGenerated: queries.length,
      serviceAreasUsed: uniqueCities.length,
    },
  };
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Normalize domain for deduplication
 */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/$/, '')
    .split('/')[0];
}

/**
 * Deduplicate competitors by normalized domain
 */
export function deduplicateCompetitors(
  competitors: ProposedCompetitor[]
): { deduplicated: ProposedCompetitor[]; duplicatesRemoved: number } {
  const seen = new Map<string, ProposedCompetitor>();

  for (const competitor of competitors) {
    const domain = competitor.domain ? normalizeDomain(competitor.domain) : competitor.name.toLowerCase();

    if (!seen.has(domain)) {
      seen.set(domain, competitor);
    } else {
      // Keep the one with higher confidence
      const existing = seen.get(domain)!;
      if ((competitor.confidence ?? 0) > (existing.confidence ?? 0)) {
        seen.set(domain, competitor);
      }
    }
  }

  const deduplicated = Array.from(seen.values());

  return {
    deduplicated,
    duplicatesRemoved: competitors.length - deduplicated.length,
  };
}

// ============================================================================
// Stats Builder
// ============================================================================

/**
 * Build expansion stats for debugging
 */
export function buildExpansionStats(
  initialCount: number,
  expandedCount: number,
  dedupedCount: number,
  finalCount: number,
  queries: string[],
  serviceAreas: string[]
): CandidateExpansionStats {
  return {
    initialCandidates: initialCount,
    expandedCandidates: expandedCount,
    dedupedCandidates: dedupedCount,
    keptAfterFilter: finalCount,
    expansionQueries: queries.slice(0, 10), // Keep first 10 for debugging
    serviceAreas,
  };
}
