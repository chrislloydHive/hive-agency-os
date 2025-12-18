// tests/fixtures/labs/scenarios/new-b2b-saas-baseline.ts
// Golden scenario: New B2B SaaS company baseline run
//
// This represents a typical first-time brand lab run for a B2B SaaS company.
// Used to verify extractors correctly handle enterprise/professional content.

import type { LabTestScenario } from '../types';
import { GOLDEN_SCENARIOS } from '../types';

/**
 * New B2B SaaS Baseline Scenario
 *
 * Tests:
 * - B2B positioning with technical specificity
 * - Enterprise audience terminology
 * - Baseline mode filtering for professional content
 * - Generic buzzword rejection
 */
export const newB2bSaasBaseline: LabTestScenario = {
  name: GOLDEN_SCENARIOS.NEW_B2B_SAAS_BASELINE,
  tags: ['golden', 'b2b', 'baseline', 'brand'],

  snapshot: {
    id: 'snap-b2b-saas-001',
    labKey: 'brand',
    companyProfile: {
      businessModel: 'b2b',
      industry: 'Enterprise Software',
      stage: 'new',
      companyName: 'DataSync Pro',
    },
    runPurpose: 'baseline',
    capturedAt: '2024-12-15T11:00:00Z',
    description: 'Brand lab output for a new B2B data integration SaaS',

    rawLabOutput: {
      findings: {
        positioning: {
          statement: 'Enterprise data integration platform that reduces ETL pipeline development time by 80% for data engineering teams at mid-market companies with 500-5000 employees',
          clarity: 82,
          differentiation: 75,
        },
        valueProp: {
          primary: 'Build production-ready data pipelines in hours, not weeks, with no-code connectors to 200+ data sources',
          bullets: [
            'Pre-built connectors for Salesforce, HubSpot, Snowflake, and 200+ other sources',
            'SOC 2 Type II compliant with enterprise-grade security',
            'Automatic schema detection and data quality monitoring',
            '99.99% uptime SLA with 24/7 support',
          ],
        },
        differentiators: [
          'Only platform with native reverse ETL and forward ETL in one tool',
          'Real-time sync capabilities vs competitors\' batch-only approach',
          'Pricing based on active pipelines, not data volume',
        ],
        icp: {
          primaryAudience: 'Data engineers and analytics leaders at mid-market SaaS companies (500-5000 employees) spending $50K+ annually on data infrastructure who need to reduce time-to-insight',
          segments: [
            'Data engineering teams drowning in maintenance',
            'Analytics leaders needing faster data access',
            'CTOs evaluating modern data stack solutions',
          ],
        },
        tone: {
          descriptors: ['technical', 'confident', 'precise', 'helpful'],
          examples: [
            'Built by data engineers, for data engineers',
            'Your data, your way, in real-time',
          ],
        },
        businessContext: {
          model: 'SaaS subscription, usage-based pricing',
          industry: 'Data integration / ETL',
        },

        // Include some generic content that SHOULD be rejected
        _genericContent: {
          badPositioning: 'A solutions provider with a focus on innovation and customer success',
          badValueProp: 'We deliver quality and excellence',
          evaluativeText: 'The positioning could be stronger and needs more clarity',
        },
      },
    },
  },

  expectedExtraction: {
    accepted: {
      positioning: 'Enterprise data integration platform that reduces ETL pipeline development time by 80%',
      value_prop: 'Build production-ready data pipelines in hours, not weeks',
      differentiators: ['Only platform with native reverse ETL and forward ETL in one tool'],
      audience_icp_primary: 'Data engineers and analytics leaders at mid-market SaaS companies',
      business_model: 'SaaS subscription',
    },
    rejected: {
      // Generic content should be rejected
      '_genericContent.badPositioning': 'too_generic',
      '_genericContent.badValueProp': 'buzzword_only',
      '_genericContent.evaluativeText': 'evaluation_not_fact',
    },
  },

  expectedGraphState: {
    domainCoverage: {
      brand: 85,
      audience: 65,
      identity: 40,
    },
    fieldsPresent: [
      'brand.positioning',
      'brand.valueProps',
      'brand.differentiators',
      'audience.primaryAudience',
      'identity.businessModel',
    ],
    fieldsAbsent: [
      'competitive.competitors',
      'seo.keywords', // Not from brand lab
    ],
  },
};
