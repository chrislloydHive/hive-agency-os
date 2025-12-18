// tests/fixtures/labs/scenarios/existing-company-refinement.ts
// Golden scenario: Existing company refinement run
//
// This represents a refinement run where the company already has context.
// Tests that strict filtering is applied in refinement mode.

import type { LabTestScenario } from '../types';
import { GOLDEN_SCENARIOS } from '../types';

/**
 * Existing Company Refinement Scenario
 *
 * Tests:
 * - Refinement mode strict filtering
 * - Generic content rejection in existing context
 * - High-specificity requirements
 * - Preservation of existing good content
 */
export const existingCompanyRefinement: LabTestScenario = {
  name: GOLDEN_SCENARIOS.EXISTING_COMPANY_REFINEMENT,
  tags: ['golden', 'b2b', 'refinement', 'brand'],

  snapshot: {
    id: 'snap-refinement-001',
    labKey: 'brand',
    companyProfile: {
      businessModel: 'b2b',
      industry: 'Marketing Technology',
      stage: 'existing',
      companyName: 'MarketForce Analytics',
    },
    runPurpose: 'refinement',
    capturedAt: '2024-12-15T12:00:00Z',
    description: 'Brand lab refinement run for an existing martech company',

    rawLabOutput: {
      findings: {
        positioning: {
          // Good, specific positioning - should be accepted
          statement: 'AI-powered attribution platform that increases marketing ROI by 35% for e-commerce brands spending $100K+ monthly on paid media',
          clarity: 88,
          differentiation: 82,
        },
        valueProp: {
          primary: 'See exactly which touchpoints drive conversions with ML-powered multi-touch attribution across 50+ ad platforms',
          bullets: [
            'Integrates with Google Ads, Meta, TikTok, and 47 other platforms in under 5 minutes',
            'Real-time budget optimization recommendations',
            'Privacy-first approach with first-party data only',
            'Average 35% increase in ROAS within 90 days',
          ],
        },
        differentiators: [
          'Only attribution platform with native creative performance analysis',
          'Cookieless attribution using probabilistic modeling',
          'Self-serve implementation with no engineering required',
        ],
        icp: {
          // Very specific - should be accepted even in strict mode
          primaryAudience: 'Growth marketing leaders and CMOs at D2C e-commerce brands with $10M-100M revenue who manage $100K+ monthly ad spend across 3+ channels',
          segments: [
            'VP Marketing at Shopify Plus brands',
            'Performance marketing agencies managing 10+ clients',
            'E-commerce CMOs frustrated with last-click attribution',
          ],
        },
        tone: {
          descriptors: ['data-driven', 'confident', 'direct', 'results-focused'],
        },

        // Generic content that MUST be rejected in refinement mode
        _shouldReject: {
          genericPositioning: 'A marketing analytics company focused on helping businesses grow',
          buzzwordValueProp: 'We deliver innovative solutions with a customer-first approach',
          vagueAudience: 'Marketing professionals at growing companies',
          evaluativeComment: 'The current positioning is present but could be clearer',
          placeholderText: 'N/A - to be determined based on further research',
        },
      },
    },
  },

  expectedExtraction: {
    accepted: {
      positioning: 'AI-powered attribution platform that increases marketing ROI by 35%',
      value_prop: 'See exactly which touchpoints drive conversions with ML-powered multi-touch attribution',
      audience_icp_primary: 'Growth marketing leaders and CMOs at D2C e-commerce brands',
      differentiators: ['Only attribution platform with native creative performance analysis'],
    },
    rejected: {
      // All generic content MUST be rejected in refinement mode
      '_shouldReject.genericPositioning': 'too_generic',
      '_shouldReject.buzzwordValueProp': 'buzzword_only',
      '_shouldReject.vagueAudience': 'too_generic',
      '_shouldReject.evaluativeComment': 'evaluation_not_fact',
      '_shouldReject.placeholderText': 'placeholder',
    },
    provenanceNotes: {
      positioning: 'Refinement mode - strict specificity required',
    },
  },

  expectedGraphState: {
    domainCoverage: {
      brand: 90,
      audience: 70,
    },
    fieldsPresent: [
      'brand.positioning',
      'brand.valueProps',
      'brand.differentiators',
      'brand.toneOfVoice',
      'audience.primaryAudience',
      'audience.segments',
    ],
    fieldsAbsent: [],
    fieldValues: {
      // Specific values we expect in the graph
      'brand.positioning': 'AI-powered attribution platform',
    },
  },
};
