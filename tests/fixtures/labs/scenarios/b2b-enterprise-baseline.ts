// tests/fixtures/labs/scenarios/b2b-enterprise-baseline.ts
// Golden scenario: B2B Enterprise company baseline
//
// Tests handling of complex enterprise B2B content with multiple stakeholders.

import type { LabTestScenario } from '../types';

/**
 * B2B Enterprise Baseline Scenario
 *
 * Tests:
 * - Enterprise-grade positioning specificity
 * - Multi-stakeholder audience handling
 * - Technical differentiation extraction
 * - Complex value proposition parsing
 */
export const b2bEnterpriseBaseline: LabTestScenario = {
  name: 'b2b_enterprise_baseline',
  tags: ['golden', 'b2b', 'baseline', 'brand', 'enterprise'],

  snapshot: {
    id: 'snap-b2b-enterprise-001',
    labKey: 'brand',
    companyProfile: {
      businessModel: 'b2b',
      industry: 'Enterprise Security',
      stage: 'new',
      companyName: 'SecureCloud Systems',
    },
    runPurpose: 'baseline',
    capturedAt: '2024-12-15T14:00:00Z',
    description: 'Brand lab output for an enterprise security company',

    rawLabOutput: {
      findings: {
        positioning: {
          statement: 'Zero-trust security platform for Fortune 500 companies that reduces breach risk by 90% while cutting security operations costs by 40% through AI-powered threat detection',
          clarity: 90,
          differentiation: 85,
        },
        valueProp: {
          primary: 'Deploy enterprise-wide zero-trust security in 30 days with our AI platform that analyzes 10M+ security events per second',
          bullets: [
            'FedRAMP High and SOC 2 Type II certified',
            'Integrates with existing SIEM, SOAR, and IAM systems',
            'Reduces mean-time-to-detection from hours to seconds',
            'Proven at 50+ Fortune 500 companies including 3 of top 5 banks',
          ],
        },
        differentiators: [
          'Only zero-trust platform with real-time AI threat prediction',
          'Patent-pending behavioral analysis engine',
          'Largest security data lake for ML training (2PB+)',
        ],
        icp: {
          primaryAudience: 'CISOs and Security Directors at Fortune 1000 companies with 5000+ employees, $10M+ annual security budgets, and regulatory compliance requirements (SOX, HIPAA, PCI-DSS)',
          segments: [
            'CISOs at financial services firms facing regulatory pressure',
            'Security leaders at healthcare organizations with HIPAA requirements',
            'Government contractors needing FedRAMP compliance',
          ],
        },
        tone: {
          descriptors: ['authoritative', 'technical', 'trustworthy', 'precise'],
        },
        businessContext: {
          model: 'Enterprise SaaS with professional services',
          industry: 'Cybersecurity',
          dealSize: '$500K-5M ACV',
        },
      },
    },
  },

  expectedExtraction: {
    accepted: {
      positioning: 'Zero-trust security platform for Fortune 500 companies that reduces breach risk by 90%',
      value_prop: 'Deploy enterprise-wide zero-trust security in 30 days',
      audience_icp_primary: 'CISOs and Security Directors at Fortune 1000 companies',
      differentiators: ['Only zero-trust platform with real-time AI threat prediction'],
      business_model: 'Enterprise SaaS',
    },
    rejected: {},
  },

  expectedGraphState: {
    domainCoverage: {
      brand: 90,
      audience: 75,
      identity: 50,
    },
    fieldsPresent: [
      'brand.positioning',
      'brand.valueProps',
      'brand.differentiators',
      'audience.primaryAudience',
      'audience.segments',
      'identity.businessModel',
    ],
    fieldsAbsent: [],
  },
};
