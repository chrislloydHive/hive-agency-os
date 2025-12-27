// tests/os/firmBrainReadiness.test.ts
// Tests for Firm Brain readiness scoring

import { describe, it, expect } from 'vitest';
import {
  calculateFirmBrainReadiness,
  getReadinessLabel,
  getReadinessColorClass,
} from '@/lib/os/ai/firmBrainReadiness';
import type { FirmBrainSnapshot, AgencyProfile, TeamMember, CaseStudy, Reference, PricingTemplate, PlanTemplate } from '@/lib/types/firmBrain';

// ============================================================================
// Test Fixtures
// ============================================================================

const emptySnapshot: FirmBrainSnapshot = {
  agencyProfile: null,
  teamMembers: [],
  caseStudies: [],
  references: [],
  pricingTemplates: [],
  planTemplates: [],
  snapshotAt: new Date().toISOString(),
};

const minimalProfile: AgencyProfile = {
  id: 'profile-1',
  name: 'Test Agency',
  oneLiner: null,
  overviewLong: null,
  differentiators: [],
  services: [],
  industries: [],
  approachSummary: null,
  collaborationModel: null,
  aiStyleGuide: null,
  defaultAssumptions: [],
  createdAt: null,
  updatedAt: null,
};

const fullProfile: AgencyProfile = {
  id: 'profile-1',
  name: 'Test Agency',
  oneLiner: 'We help brands grow',
  overviewLong: 'A full-service marketing agency with 10+ years experience',
  differentiators: ['Data-driven', 'Creative excellence', 'Industry expertise'],
  services: ['Strategy', 'Creative', 'Media'],
  industries: ['Tech', 'Healthcare', 'Finance'],
  approachSummary: 'We start with insights and build from there',
  collaborationModel: 'Embedded team model',
  aiStyleGuide: 'Confident but humble',
  defaultAssumptions: ['30-day payment terms'],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const createTeamMember = (id: string, withQuality: boolean = false): TeamMember => ({
  id,
  name: `Team Member ${id}`,
  role: 'Strategist',
  bio: withQuality ? 'Experienced strategist with 10+ years in marketing' : null,
  strengths: withQuality ? ['Strategy', 'Client Relations'] : [],
  functions: withQuality ? ['strategy'] : [],
  availabilityStatus: 'available',
  defaultOnRfp: false,
  headshotUrl: null,
  linkedinUrl: null,
  createdAt: null,
  updatedAt: null,
});

const createCaseStudy = (id: string, withQuality: boolean = false): CaseStudy => ({
  id,
  title: `Case Study ${id}`,
  client: `Client ${id}`,
  industry: 'Tech',
  services: ['Strategy'],
  summary: 'A summary',
  problem: withQuality ? 'The client faced a challenge' : null,
  approach: withQuality ? 'We developed a solution' : null,
  outcome: withQuality ? 'Results were achieved' : null,
  metrics: withQuality ? [{ label: 'ROI', value: '150%' }] : [],
  assets: [],
  tags: [],
  permissionLevel: 'public',
  caseStudyUrl: null,
  createdAt: null,
  updatedAt: null,
});

const createReference = (id: string, confirmed: boolean = false): Reference => ({
  id,
  client: `Reference ${id}`,
  contactName: `Contact ${id}`,
  email: confirmed ? 'test@example.com' : null,
  phone: null,
  engagementType: 'Strategy',
  industries: ['Tech'],
  permissionStatus: confirmed ? 'confirmed' : 'pending',
  notes: null,
  lastConfirmedAt: null,
  createdAt: null,
  updatedAt: null,
});

const createPricingTemplate = (id: string, withQuality: boolean = false): PricingTemplate => ({
  id,
  templateName: `Pricing ${id}`,
  useCase: 'Strategy',
  lineItems: withQuality ? [{ id: '1', category: 'Strategy', description: 'Work', unit: 'fixed', rate: 10000, quantity: 1, optional: false }] : [],
  assumptions: withQuality ? ['Assumption 1'] : [],
  exclusions: [],
  optionSets: [],
  createdAt: null,
  updatedAt: null,
});

const createPlanTemplate = (id: string, withQuality: boolean = false): PlanTemplate => ({
  id,
  templateName: `Plan ${id}`,
  useCase: 'Strategy',
  phases: withQuality ? [
    { id: '1', name: 'Phase 1', order: 1, deliverables: [], milestones: [] },
    { id: '2', name: 'Phase 2', order: 2, deliverables: [], milestones: [] },
  ] : [],
  dependencies: [],
  typicalTimeline: '8 weeks',
  createdAt: null,
  updatedAt: null,
});

// ============================================================================
// Tests
// ============================================================================

describe('calculateFirmBrainReadiness', () => {
  describe('empty snapshot', () => {
    it('returns 0 score for empty snapshot', () => {
      const result = calculateFirmBrainReadiness(emptySnapshot);
      expect(result.score).toBe(0);
      expect(result.missing).toContain('Agency Profile');
      expect(result.missing).toContain('Team Members');
      expect(result.missing).toContain('Case Studies');
      expect(result.recommendGeneration).toBe(false);
    });

    it('identifies all components as missing', () => {
      const result = calculateFirmBrainReadiness(emptySnapshot);
      expect(result.missing.length).toBe(6);
      expect(result.weak.length).toBe(0);
    });
  });

  describe('agency profile scoring', () => {
    it('scores minimal profile as weak', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        agencyProfile: minimalProfile,
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.agencyProfile.status).toBe('weak');
      expect(result.components.agencyProfile.sufficient).toBe(false);
    });

    it('scores full profile as excellent', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        agencyProfile: fullProfile,
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.agencyProfile.status).toBe('excellent');
      expect(result.components.agencyProfile.sufficient).toBe(true);
    });
  });

  describe('team members scoring', () => {
    it('scores no team members as missing', () => {
      const result = calculateFirmBrainReadiness(emptySnapshot);
      expect(result.components.teamMembers.status).toBe('missing');
      expect(result.components.teamMembers.count).toBe(0);
    });

    it('scores 1 team member without quality as weak', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        teamMembers: [createTeamMember('1', false)],
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.teamMembers.status).toBe('weak');
    });

    it('scores 3+ quality team members as good', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        teamMembers: [
          createTeamMember('1', true),
          createTeamMember('2', true),
          createTeamMember('3', true),
        ],
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.teamMembers.status).toBe('good');
    });
  });

  describe('case studies scoring', () => {
    it('scores no case studies as missing with quality warning', () => {
      const result = calculateFirmBrainReadiness(emptySnapshot);
      expect(result.components.caseStudies.status).toBe('missing');
      expect(result.qualityWarnings).toContain('Work samples section may lack concrete examples');
    });

    it('scores case studies with problem/approach/outcome as higher quality', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        caseStudies: [
          createCaseStudy('1', true),
          createCaseStudy('2', true),
          createCaseStudy('3', true),
        ],
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.caseStudies.status).toBe('good');
    });
  });

  describe('references scoring', () => {
    it('scores no references as missing', () => {
      const result = calculateFirmBrainReadiness(emptySnapshot);
      expect(result.components.references.status).toBe('missing');
    });

    it('only counts confirmed references', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        references: [
          createReference('1', false), // pending
          createReference('2', false), // pending
        ],
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.references.status).toBe('missing');
      expect(result.components.references.count).toBe(0);
    });

    it('scores confirmed references correctly', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        references: [
          createReference('1', true),
          createReference('2', true),
        ],
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.components.references.status).toBe('good');
      expect(result.components.references.count).toBe(2);
    });
  });

  describe('overall scoring', () => {
    it('calculates weighted score correctly', () => {
      const fullSnapshot: FirmBrainSnapshot = {
        agencyProfile: fullProfile,
        teamMembers: [
          createTeamMember('1', true),
          createTeamMember('2', true),
          createTeamMember('3', true),
        ],
        caseStudies: [
          createCaseStudy('1', true),
          createCaseStudy('2', true),
          createCaseStudy('3', true),
        ],
        references: [
          createReference('1', true),
          createReference('2', true),
        ],
        pricingTemplates: [createPricingTemplate('1', true)],
        planTemplates: [createPlanTemplate('1', true)],
        snapshotAt: new Date().toISOString(),
      };
      const result = calculateFirmBrainReadiness(fullSnapshot);
      expect(result.score).toBeGreaterThan(80);
      expect(result.recommendGeneration).toBe(true);
      expect(result.missing.length).toBe(0);
    });
  });

  describe('quality warnings', () => {
    it('generates appropriate quality warnings for missing inputs', () => {
      const snapshot: FirmBrainSnapshot = {
        ...emptySnapshot,
        agencyProfile: fullProfile,
        teamMembers: [createTeamMember('1', true)],
      };
      const result = calculateFirmBrainReadiness(snapshot);
      expect(result.qualityWarnings).toContain('Work samples section may lack concrete examples');
      expect(result.qualityWarnings).toContain('References section will be minimal');
    });
  });
});

describe('getReadinessLabel', () => {
  it('returns correct labels for score ranges', () => {
    expect(getReadinessLabel(90)).toBe('Excellent');
    expect(getReadinessLabel(70)).toBe('Good');
    expect(getReadinessLabel(50)).toBe('Fair');
    expect(getReadinessLabel(30)).toBe('Limited');
    expect(getReadinessLabel(10)).toBe('Not Ready');
  });
});

describe('getReadinessColorClass', () => {
  it('returns correct color classes for score ranges', () => {
    expect(getReadinessColorClass(90)).toBe('text-emerald-400');
    expect(getReadinessColorClass(70)).toBe('text-blue-400');
    expect(getReadinessColorClass(50)).toBe('text-amber-400');
    expect(getReadinessColorClass(10)).toBe('text-red-400');
  });
});
