// lib/testing/goldenCompanies.ts
// Golden Test Set - Canonical test companies for validating diagnostics
//
// These companies represent different verticals and archetypes to validate:
// - Vertical classification
// - Archetype detection
// - Competition discovery (no agency bias for non-agencies)
// - Context generation
// - Strategy generation

import type { VerticalCategory, CompanyArchetype } from '@/lib/competition-v3/types';

// ============================================================================
// Golden Company Definition
// ============================================================================

export interface GoldenCompany {
  /** Unique identifier for this test case */
  id: string;

  /** Human-readable name */
  name: string;

  /** Primary domain (used for lookup or creation) */
  domain: string;

  /** Website URL for diagnostics */
  website: string;

  /** Expected vertical classification */
  expectedVertical: VerticalCategory;

  /** Expected archetype classification */
  expectedArchetype: CompanyArchetype;

  /** Brief description of why this company is in the golden set */
  rationale: string;

  /** What we're specifically validating with this company */
  validates: string[];

  /** Optional: Airtable company ID if already exists */
  companyId?: string;
}

// ============================================================================
// Golden Test Set
// ============================================================================

export const GOLDEN_COMPANIES: GoldenCompany[] = [
  {
    id: 'golden-marketplace-fitness',
    name: 'TrainrHub (Fitness Marketplace)',
    domain: 'trainrhub.com',
    website: 'https://trainrhub.com',
    expectedVertical: 'marketplace',
    expectedArchetype: 'two_sided_marketplace',
    rationale: 'Two-sided fitness marketplace connecting trainers and clients',
    validates: [
      'Marketplace vertical detection',
      'Two-sided marketplace archetype',
      'Should NOT get agency competitors',
      'Should get other fitness platforms as competitors',
    ],
  },
  {
    id: 'golden-financial-bank',
    name: 'Portage Bank (Financial Institution)',
    domain: 'portage.bank',
    website: 'https://portage.bank',
    expectedVertical: 'financial-services',
    expectedArchetype: 'local_service',
    rationale: 'Community bank with .bank TLD - clear financial services',
    validates: [
      'Financial services vertical detection',
      '.bank TLD recognition',
      'Should NOT get agency competitors',
      'Should get other banks/credit unions as competitors',
    ],
  },
  {
    id: 'golden-saas-product',
    name: 'Calendly (SaaS Scheduling)',
    domain: 'calendly.com',
    website: 'https://calendly.com',
    expectedVertical: 'software',
    expectedArchetype: 'saas',
    rationale: 'Well-known SaaS product for scheduling',
    validates: [
      'Software vertical detection',
      'SaaS archetype detection',
      'Should NOT get agency competitors',
      'Should get other scheduling tools as competitors',
    ],
  },
  {
    id: 'golden-local-service',
    name: 'Mobile Edge (Car Audio Installer)',
    domain: 'mobileedge.com',
    website: 'https://mobileedge.com',
    expectedVertical: 'automotive',
    expectedArchetype: 'local_service',
    rationale: 'Local car audio installation business - automotive retail/service',
    validates: [
      'Automotive vertical detection',
      'Local service archetype',
      'Should NOT get agency competitors',
      'Should get other car audio shops as competitors',
    ],
  },
  {
    id: 'golden-agency-control',
    name: 'Directive Consulting (Marketing Agency)',
    domain: 'directiveconsulting.com',
    website: 'https://directiveconsulting.com',
    expectedVertical: 'services',
    expectedArchetype: 'agency',
    rationale: 'Marketing agency - CONTROL case where agency competitors ARE valid',
    validates: [
      'Services vertical detection',
      'Agency archetype detection',
      'SHOULD get other agency competitors (this is valid)',
      'Should include fractional/internal alternatives',
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all golden companies
 */
export function getGoldenCompanies(): GoldenCompany[] {
  return GOLDEN_COMPANIES;
}

/**
 * Get a golden company by ID
 */
export function getGoldenCompanyById(id: string): GoldenCompany | undefined {
  return GOLDEN_COMPANIES.find(c => c.id === id);
}

/**
 * Get golden companies by vertical
 */
export function getGoldenCompaniesByVertical(vertical: VerticalCategory): GoldenCompany[] {
  return GOLDEN_COMPANIES.filter(c => c.expectedVertical === vertical);
}

/**
 * Get the control company (agency) for comparison
 */
export function getControlCompany(): GoldenCompany {
  return GOLDEN_COMPANIES.find(c => c.id === 'golden-agency-control')!;
}

/**
 * Get non-agency companies (should NOT get agency competitors)
 */
export function getNonAgencyCompanies(): GoldenCompany[] {
  return GOLDEN_COMPANIES.filter(c => c.expectedArchetype !== 'agency');
}
