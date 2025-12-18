// tests/fixtures/labs/scenarios/new-b2c-pet-food-baseline.ts
// Golden scenario: New B2C pet food company baseline run
//
// This represents a typical first-time brand lab run for a B2C pet food company.
// Used to verify extractors correctly handle consumer-focused content.

import type { LabTestScenario } from '../types';
import { GOLDEN_SCENARIOS } from '../types';

/**
 * New B2C Pet Food Baseline Scenario
 *
 * Tests:
 * - B2C-specific positioning acceptance (consumer language)
 * - Pet industry terminology recognition
 * - Baseline mode lenient filtering
 * - Consumer audience extraction
 */
export const newB2cPetFoodBaseline: LabTestScenario = {
  name: GOLDEN_SCENARIOS.NEW_B2C_PET_FOOD_BASELINE,
  tags: ['golden', 'b2c', 'baseline', 'brand'],

  snapshot: {
    id: 'snap-b2c-pet-001',
    labKey: 'brand',
    companyProfile: {
      businessModel: 'b2c',
      industry: 'Pet Food & Supplies',
      stage: 'new',
      companyName: 'Happy Tails Pet Co',
    },
    runPurpose: 'baseline',
    capturedAt: '2024-12-15T10:00:00Z',
    description: 'Brand lab output for a new B2C pet food startup',

    rawLabOutput: {
      findings: {
        positioning: {
          statement: 'Premium organic dog food for health-conscious pet parents in urban areas who want restaurant-quality meals for their furry family members',
          clarity: 85,
          differentiation: 78,
        },
        valueProp: {
          primary: 'Human-grade, USDA-certified organic ingredients in every recipe',
          bullets: [
            'Locally-sourced proteins from family farms',
            'No artificial preservatives, colors, or flavors',
            'Veterinarian-formulated for optimal nutrition',
            'Subscription delivery with flexible scheduling',
          ],
        },
        differentiators: [
          'Only pet food brand with full supply chain transparency',
          'Farm-to-bowl traceability via QR codes on every package',
          'Carbon-neutral manufacturing and shipping',
        ],
        icp: {
          primaryAudience: 'Urban millennial and Gen-Z pet owners ages 25-40 with household incomes over $75K who treat their dogs as family members and prioritize premium, healthy food options',
          segments: [
            'Health-conscious urban professionals',
            'Dog parents with food allergy concerns',
            'Eco-conscious consumers seeking sustainable pet products',
          ],
        },
        tone: {
          descriptors: ['warm', 'caring', 'knowledgeable', 'playful'],
          examples: [
            'Because they deserve the good stuff',
            'Made with love, backed by science',
          ],
        },
        businessContext: {
          model: 'D2C subscription + retail partnerships',
          industry: 'Premium pet food',
        },
      },
    },
  },

  expectedExtraction: {
    accepted: {
      positioning: 'Premium organic dog food for health-conscious pet parents',
      value_prop: 'Human-grade, USDA-certified organic ingredients',
      differentiators: ['Only pet food brand with full supply chain transparency'],
      audience_icp_primary: 'Urban millennial and Gen-Z pet owners ages 25-40',
      brand_tone: 'warm',
    },
    rejected: {
      // These should NOT be rejected - B2C allows consumer-friendly language
    },
    provenanceNotes: {
      positioning: 'Extracted from brand lab positioning statement',
    },
  },

  expectedGraphState: {
    domainCoverage: {
      brand: 80,
      audience: 60,
    },
    fieldsPresent: [
      'brand.positioning',
      'brand.valueProps',
      'brand.differentiators',
      'audience.primaryAudience',
    ],
    fieldsAbsent: [
      'competitive.competitors', // Not from brand lab
    ],
  },
};
