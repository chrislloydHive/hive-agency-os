// tests/fixtures/labs/scenarios/local-service-business.ts
// Golden scenario: Local service business baseline
//
// Tests handling of local/SMB business context where "generic" thresholds differ.

import type { LabTestScenario } from '../types';
import { GOLDEN_SCENARIOS } from '../types';

/**
 * Local Service Business Scenario
 *
 * Tests:
 * - Local business positioning acceptance
 * - Geographic-specific content recognition
 * - Service business terminology
 * - SMB-appropriate filtering thresholds
 */
export const localServiceBusiness: LabTestScenario = {
  name: GOLDEN_SCENARIOS.LOCAL_SERVICE_BUSINESS,
  tags: ['golden', 'local', 'baseline', 'brand'],

  snapshot: {
    id: 'snap-local-001',
    labKey: 'brand',
    companyProfile: {
      businessModel: 'local',
      industry: 'Home Services',
      stage: 'new',
      companyName: 'Denver Pro Plumbing',
    },
    runPurpose: 'baseline',
    capturedAt: '2024-12-15T13:00:00Z',
    description: 'Brand lab output for a local plumbing service',

    rawLabOutput: {
      findings: {
        positioning: {
          // Local businesses have naturally more generic positioning - this should pass
          statement: 'Denver\'s most trusted 24/7 emergency plumbing service with same-day response and upfront pricing for residential and commercial properties',
          clarity: 80,
          differentiation: 70,
        },
        valueProp: {
          primary: '24/7 emergency service with guaranteed 60-minute response time in the Denver metro area',
          bullets: [
            'Licensed and insured master plumbers with 15+ years experience',
            'Upfront pricing with no hidden fees - quote before we start',
            'Same-day service for most repairs',
            'Senior and military discounts available',
          ],
        },
        differentiators: [
          'Only plumber in Denver with guaranteed 60-minute emergency response',
          'Family-owned since 2005 with 4.9-star Google rating',
          'All plumbers are W-2 employees, not contractors',
        ],
        icp: {
          // Geographic specificity makes this acceptable
          primaryAudience: 'Homeowners in Denver metro area (including Aurora, Lakewood, Littleton) who need reliable plumbing service and value quality work over lowest price',
          segments: [
            'Denver homeowners with older homes needing pipe replacement',
            'Property managers with multiple rental units',
            'Commercial building owners in downtown Denver',
          ],
        },
        tone: {
          descriptors: ['friendly', 'trustworthy', 'local', 'professional'],
        },
        businessContext: {
          model: 'Local service business',
          industry: 'Plumbing',
          serviceArea: 'Denver Metro',
        },
      },
    },
  },

  expectedExtraction: {
    accepted: {
      positioning: 'Denver\'s most trusted 24/7 emergency plumbing service',
      value_prop: '24/7 emergency service with guaranteed 60-minute response time',
      audience_icp_primary: 'Homeowners in Denver metro area',
      differentiators: ['Only plumber in Denver with guaranteed 60-minute emergency response'],
    },
    rejected: {
      // Local business content should NOT be rejected as too generic
    },
  },

  expectedGraphState: {
    domainCoverage: {
      brand: 75,
      audience: 50,
    },
    fieldsPresent: [
      'brand.positioning',
      'brand.valueProps',
      'audience.primaryAudience',
    ],
    fieldsAbsent: [],
  },
};
