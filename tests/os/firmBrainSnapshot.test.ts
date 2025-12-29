// tests/os/firmBrainSnapshot.test.ts
// Tests for Firm Brain snapshot hashing and drift detection

import { describe, it, expect } from 'vitest';
import {
  createFirmBrainSnapshotRef,
  checkFirmBrainDrift,
  getDriftDetails,
} from '@/lib/os/ai/firmBrainSnapshot';
import type { FirmBrainSnapshot } from '@/lib/types/firmBrain';

// ============================================================================
// Test Fixtures
// ============================================================================

const createSnapshot = (overrides: Partial<FirmBrainSnapshot> = {}): FirmBrainSnapshot => ({
  agencyProfile: {
    id: 'profile-1',
    name: 'Test Agency',
    oneLiner: 'We help brands grow',
    overviewLong: 'Full overview',
    differentiators: ['Fast', 'Good'],
    services: ['Strategy'],
    industries: ['Tech'],
    approachSummary: 'Our approach',
    collaborationModel: 'Embedded',
    aiStyleGuide: null,
    defaultAssumptions: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  teamMembers: [
    { id: 'tm-1', name: 'Alice', role: 'Lead', bio: null, strengths: [], functions: [], availabilityStatus: 'available', defaultOnRfp: false, headshotUrl: null, linkedinUrl: null, createdAt: null, updatedAt: '2024-01-01' },
    { id: 'tm-2', name: 'Bob', role: 'Designer', bio: null, strengths: [], functions: [], availabilityStatus: 'available', defaultOnRfp: false, headshotUrl: null, linkedinUrl: null, createdAt: null, updatedAt: '2024-01-01' },
  ],
  caseStudies: [
    { id: 'cs-1', title: 'Case 1', client: 'Client 1', industry: 'Tech', services: [], summary: null, problem: null, approach: null, outcome: null, metrics: [], assets: [], tags: [], permissionLevel: 'public', visibility: 'public', caseStudyUrl: null, visuals: [], createdAt: null, updatedAt: '2024-01-01' },
  ],
  references: [
    { id: 'ref-1', client: 'Ref Client', contactName: 'John', email: null, phone: null, engagementType: null, industries: [], permissionStatus: 'confirmed', notes: null, lastConfirmedAt: null, createdAt: null, updatedAt: '2024-01-01' },
  ],
  pricingTemplates: [
    { id: 'pt-1', name: 'Standard', description: '', linkedAgencyId: null, examplePricingFiles: [], relevantOpportunities: [], createdAt: null, updatedAt: '2024-01-01' },
  ],
  planTemplates: [
    { id: 'pl-1', templateName: 'Standard Plan', useCase: null, phases: [], dependencies: [], typicalTimeline: null, createdAt: null, updatedAt: '2024-01-01' },
  ],
  snapshotAt: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Tests: createFirmBrainSnapshotRef
// ============================================================================

describe('createFirmBrainSnapshotRef', () => {
  it('creates a snapshot reference with hash and timestamp', () => {
    const snapshot = createSnapshot();
    const ref = createFirmBrainSnapshotRef(snapshot);

    expect(ref.hash).toBeDefined();
    expect(typeof ref.hash).toBe('string');
    expect(ref.hash.length).toBeGreaterThan(0);
    expect(ref.createdAt).toBeDefined();
  });

  it('creates consistent hashes for identical snapshots', () => {
    const snapshot1 = createSnapshot();
    const snapshot2 = createSnapshot();

    const ref1 = createFirmBrainSnapshotRef(snapshot1);
    const ref2 = createFirmBrainSnapshotRef(snapshot2);

    expect(ref1.hash).toBe(ref2.hash);
  });

  it('creates different hashes when team member is added', () => {
    const snapshot1 = createSnapshot();
    const snapshot2 = createSnapshot({
      teamMembers: [
        ...createSnapshot().teamMembers,
        { id: 'tm-3', name: 'Charlie', role: 'Dev', bio: null, strengths: [], functions: [], availabilityStatus: 'available', defaultOnRfp: false, headshotUrl: null, linkedinUrl: null, createdAt: null, updatedAt: '2024-01-02' },
      ],
    });

    const ref1 = createFirmBrainSnapshotRef(snapshot1);
    const ref2 = createFirmBrainSnapshotRef(snapshot2);

    expect(ref1.hash).not.toBe(ref2.hash);
  });

  it('creates different hashes when team member is updated', () => {
    const snapshot1 = createSnapshot();
    const snapshot2 = createSnapshot({
      teamMembers: [
        { ...createSnapshot().teamMembers[0], updatedAt: '2024-02-01' },
        createSnapshot().teamMembers[1],
      ],
    });

    const ref1 = createFirmBrainSnapshotRef(snapshot1);
    const ref2 = createFirmBrainSnapshotRef(snapshot2);

    expect(ref1.hash).not.toBe(ref2.hash);
  });

  it('creates different hashes when case study is removed', () => {
    const snapshot1 = createSnapshot();
    const snapshot2 = createSnapshot({
      caseStudies: [],
    });

    const ref1 = createFirmBrainSnapshotRef(snapshot1);
    const ref2 = createFirmBrainSnapshotRef(snapshot2);

    expect(ref1.hash).not.toBe(ref2.hash);
  });

  it('handles null agency profile', () => {
    const snapshot = createSnapshot({ agencyProfile: null });
    const ref = createFirmBrainSnapshotRef(snapshot);

    expect(ref.hash).toBeDefined();
    expect(ref.hash.length).toBeGreaterThan(0);
  });

  it('handles empty arrays', () => {
    const snapshot = createSnapshot({
      teamMembers: [],
      caseStudies: [],
      references: [],
      pricingTemplates: [],
      planTemplates: [],
    });
    const ref = createFirmBrainSnapshotRef(snapshot);

    expect(ref.hash).toBeDefined();
  });
});

// ============================================================================
// Tests: checkFirmBrainDrift
// ============================================================================

describe('checkFirmBrainDrift', () => {
  it('returns no drift when savedRef is null', () => {
    const snapshot = createSnapshot();
    const result = checkFirmBrainDrift(snapshot, null);

    expect(result.hasDrifted).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('returns no drift when savedRef is undefined', () => {
    const snapshot = createSnapshot();
    const result = checkFirmBrainDrift(snapshot, undefined);

    expect(result.hasDrifted).toBe(false);
  });

  it('returns no drift when hashes match', () => {
    const snapshot = createSnapshot();
    const savedRef = createFirmBrainSnapshotRef(snapshot);
    const result = checkFirmBrainDrift(snapshot, savedRef);

    expect(result.hasDrifted).toBe(false);
  });

  it('detects drift when hashes differ', () => {
    const originalSnapshot = createSnapshot();
    const savedRef = createFirmBrainSnapshotRef(originalSnapshot);

    const currentSnapshot = createSnapshot({
      teamMembers: [
        ...createSnapshot().teamMembers,
        { id: 'tm-new', name: 'New', role: 'New', bio: null, strengths: [], functions: [], availabilityStatus: 'available', defaultOnRfp: false, headshotUrl: null, linkedinUrl: null, createdAt: null, updatedAt: '2024-02-01' },
      ],
    });

    const result = checkFirmBrainDrift(currentSnapshot, savedRef);

    expect(result.hasDrifted).toBe(true);
    expect(result.reason).toBe('Firm Brain has been updated since this RFP was created');
    expect(result.savedHash).toBe(savedRef.hash);
    expect(result.currentHash).not.toBe(savedRef.hash);
  });

  it('includes savedAt in result', () => {
    const snapshot = createSnapshot();
    const savedRef = createFirmBrainSnapshotRef(snapshot);
    const result = checkFirmBrainDrift(snapshot, savedRef);

    expect(result.savedAt).toBe(savedRef.createdAt);
  });
});

// ============================================================================
// Tests: getDriftDetails
// ============================================================================

describe('getDriftDetails', () => {
  it('returns no drift details when no drift', () => {
    const snapshot = createSnapshot();
    const savedRef = createFirmBrainSnapshotRef(snapshot);
    const details = getDriftDetails(snapshot, savedRef);

    expect(details.hasDrifted).toBe(false);
    expect(details.message).toBeNull();
    expect(details.recommendation).toBeNull();
    expect(details.severity).toBe('none');
  });

  it('returns drift details with warning severity', () => {
    const originalSnapshot = createSnapshot();
    const savedRef = createFirmBrainSnapshotRef(originalSnapshot);

    const currentSnapshot = createSnapshot({
      caseStudies: [], // Remove all case studies
    });

    const details = getDriftDetails(currentSnapshot, savedRef);

    expect(details.hasDrifted).toBe(true);
    expect(details.message).toBe('Firm Brain has changed since this RFP was created');
    expect(details.recommendation).toContain('regenerat');
    expect(details.severity).toBe('warning');
  });

  it('handles null savedRef gracefully', () => {
    const snapshot = createSnapshot();
    const details = getDriftDetails(snapshot, null);

    expect(details.hasDrifted).toBe(false);
    expect(details.severity).toBe('none');
  });

  it('handles undefined savedRef gracefully', () => {
    const snapshot = createSnapshot();
    const details = getDriftDetails(snapshot, undefined);

    expect(details.hasDrifted).toBe(false);
    expect(details.severity).toBe('none');
  });
});
