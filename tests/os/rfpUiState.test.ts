// tests/os/rfpUiState.test.ts
// Unit tests for RFP builder UI state selector

import { describe, it, expect } from 'vitest';
import {
  deriveRfpBuilderState,
  getRfpUIState,
  type RfpDataInput,
} from '@/lib/os/ui/rfpUiState';
import type { Rfp, RfpSection, RfpBindings, RfpSectionKey } from '@/lib/types/rfp';
import type { FirmBrainHealth } from '@/lib/types/firmBrain';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeFirmBrainHealth(overrides: Partial<FirmBrainHealth>): FirmBrainHealth {
  return {
    hasAgencyProfile: true,
    teamMemberCount: 5,
    caseStudyCount: 3,
    referenceCount: 4,
    confirmedReferenceCount: 2,
    pricingTemplateCount: 2,
    planTemplateCount: 2,
    completenessScore: 100,
    readyForRfp: true,
    missingForRfp: [],
    ...overrides,
  };
}

function makeRfp(overrides: Partial<Rfp>): Rfp {
  return {
    id: 'rfp-123',
    companyId: 'test-company',
    opportunityId: null,
    title: 'Test RFP',
    status: 'assembling',
    dueDate: null,
    scopeSummary: 'Test scope summary',
    sourceDocUrl: null,
    requirementsChecklist: [],
    selectedPath: 'project',
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSection(
  sectionKey: RfpSectionKey,
  overrides: Partial<RfpSection>
): RfpSection {
  return {
    id: `section-${sectionKey}`,
    rfpId: 'rfp-123',
    sectionKey,
    title: sectionKey,
    status: 'empty',
    contentWorking: null,
    contentApproved: null,
    sourceType: null,
    generatedUsing: null,
    needsReview: false,
    lastGeneratedAt: null,
    isStale: false,
    staleReason: null,
    reviewNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAllSections(statusOverrides: Partial<Record<RfpSectionKey, Partial<RfpSection>>> = {}): RfpSection[] {
  const keys: RfpSectionKey[] = [
    'agency_overview',
    'approach',
    'team',
    'work_samples',
    'plan_timeline',
    'pricing',
    'references',
  ];
  return keys.map((key) => makeSection(key, statusOverrides[key] || {}));
}

function makeBindings(overrides: Partial<RfpBindings>): RfpBindings {
  return {
    id: 'bindings-123',
    rfpId: 'rfp-123',
    teamMemberIds: ['member-1', 'member-2'],
    caseStudyIds: ['case-1', 'case-2'],
    referenceIds: ['ref-1'],
    pricingTemplateId: 'pricing-1',
    planTemplateId: 'plan-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// State Derivation Tests
// ============================================================================

describe('deriveRfpBuilderState', () => {
  it('returns blocked_no_firm_brain when Firm Brain not ready', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false, missingForRfp: ['Agency Profile'] }),
    };
    expect(deriveRfpBuilderState(input)).toBe('blocked_no_firm_brain');
  });

  it('returns intake when no RFP exists', () => {
    const input: RfpDataInput = {
      rfp: null,
      sections: [],
      bindings: null,
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('intake');
  });

  it('returns intake when RFP status is intake', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'intake' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('intake');
  });

  it('returns submitted when RFP status is submitted', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'submitted' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('submitted');
  });

  it('returns closed_won when RFP status is won', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'won' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('closed_won');
  });

  it('returns closed_lost when RFP status is lost', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'lost' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('closed_lost');
  });

  it('returns assembling_no_bindings when no team members selected', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: [], caseStudyIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('assembling_no_bindings');
  });

  it('returns assembling_no_bindings when no case studies selected', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: ['member-1'], caseStudyIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('assembling_no_bindings');
  });

  it('returns assembling_ready when all sections empty and bindings complete', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('assembling_ready');
  });

  it('returns assembling_in_progress when some sections are draft', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections({
        agency_overview: { status: 'draft', contentWorking: 'Draft content' },
        approach: { status: 'draft', contentWorking: 'Draft content' },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('assembling_in_progress');
  });

  it('returns review_pending when all sections have content and none stale', () => {
    const allReady = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content here',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allReady,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('review_pending');
  });

  it('returns review_stale when some sections are stale', () => {
    const sections = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content here',
    }));
    sections[0].isStale = true;
    sections[0].staleReason = 'Agency Profile updated';

    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('review_stale');
  });

  it('returns ready_to_submit when all sections approved', () => {
    const allApproved = makeAllSections().map((s) => ({
      ...s,
      status: 'approved' as const,
      contentApproved: 'Approved content',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allApproved,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('ready_to_submit');
  });

  it('handles null bindings as no bindings', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: null,
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('assembling_no_bindings');
  });

  it('handles null firmBrainHealth as not ready', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: null,
    };
    expect(deriveRfpBuilderState(input)).toBe('blocked_no_firm_brain');
  });
});

// ============================================================================
// Banner Tests
// ============================================================================

describe('getRfpUIState banner', () => {
  it('shows blocked banner when Firm Brain not ready', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false, missingForRfp: ['Agency Profile'] }),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('blocked');
    expect(state.banner.title).toBe('Configure Firm Brain');
  });

  it('shows info banner during intake', () => {
    const input: RfpDataInput = {
      rfp: null,
      sections: [],
      bindings: null,
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('info');
    expect(state.banner.title).toBe('Start Your RFP Response');
  });

  it('shows warning banner when bindings missing', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: [], caseStudyIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('warning');
    expect(state.banner.title).toBe('Select Team & Work Samples');
  });

  it('shows info banner when ready to generate', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('info');
    expect(state.banner.title).toBe('Ready to Generate');
  });

  it('shows warning banner when sections stale', () => {
    const sections = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content',
    }));
    sections[0].isStale = true;

    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('warning');
    expect(state.banner.title).toBe('Sections Need Update');
  });

  it('shows success banner when ready to submit', () => {
    const allApproved = makeAllSections().map((s) => ({
      ...s,
      status: 'approved' as const,
      contentApproved: 'Approved',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allApproved,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('success');
    expect(state.banner.title).toBe('Ready to Submit');
  });

  it('shows success banner when closed_won', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'won' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.banner.tone).toBe('success');
    expect(state.banner.title).toBe('Deal Won');
  });
});

// ============================================================================
// CTA Tests
// ============================================================================

describe('getRfpUIState primaryCTA', () => {
  it('returns "Go to Settings" when blocked_no_firm_brain', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false }),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Go to Settings');
    expect(state.primaryCTA.action).toBe('navigate');
    expect(state.primaryCTA.href).toBe('/settings/firm-brain');
  });

  it('returns "Generate All Drafts" disabled when assembling_no_bindings', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: [], caseStudyIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Generate All Drafts');
    expect(state.primaryCTA.disabled).toBe(true);
    expect(state.primaryCTA.disabledReason).toContain('Select team');
  });

  it('returns "Generate All Drafts" enabled when assembling_ready', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Generate All Drafts');
    expect(state.primaryCTA.action).toBe('generate');
    expect(state.primaryCTA.disabled).toBeFalsy();
  });

  it('returns "Generate Remaining" when assembling_in_progress', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections({
        agency_overview: { status: 'draft', contentWorking: 'Draft' },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Generate Remaining');
  });

  it('returns "Approve All Ready" when review_pending', () => {
    const allReady = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allReady,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Approve All Ready');
    expect(state.primaryCTA.action).toBe('approve');
  });

  it('returns "Regenerate Stale" when review_stale', () => {
    const sections = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content',
    }));
    sections[0].isStale = true;

    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Regenerate Stale');
  });

  it('returns "Export to Google Doc" when ready_to_submit', () => {
    const allApproved = makeAllSections().map((s) => ({
      ...s,
      status: 'approved' as const,
      contentApproved: 'Approved',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allApproved,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('Export to Google Doc');
    expect(state.primaryCTA.action).toBe('export');
  });

  it('returns "View Document" when submitted', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'submitted' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.primaryCTA.label).toBe('View Document');
  });
});

describe('getRfpUIState secondaryCTA', () => {
  it('returns null when blocked', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false }),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.secondaryCTA).toBeNull();
  });

  it('returns "Preview Document" when assembling_in_progress', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections({
        agency_overview: { status: 'draft', contentWorking: 'Draft' },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.secondaryCTA?.label).toBe('Preview Document');
  });

  it('returns "Mark as Submitted" when ready_to_submit', () => {
    const allApproved = makeAllSections().map((s) => ({
      ...s,
      status: 'approved' as const,
      contentApproved: 'Approved',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allApproved,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.secondaryCTA?.label).toBe('Mark as Submitted');
    expect(state.secondaryCTA?.action).toBe('submit');
  });

  it('returns "Mark Won" when submitted', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'submitted' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.secondaryCTA?.label).toBe('Mark Won');
  });
});

// ============================================================================
// Visibility Tests
// ============================================================================

describe('getRfpUIState visibility', () => {
  it('hides sections nav when blocked', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false }),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.showSectionsNav).toBe(false);
    expect(state.showSectionEditor).toBe(false);
    expect(state.showBindingsPanel).toBe(false);
  });

  it('shows intake form only during intake', () => {
    const input: RfpDataInput = {
      rfp: null,
      sections: [],
      bindings: null,
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.showIntakeForm).toBe(true);
    expect(state.showSectionsNav).toBe(false);
  });

  it('shows sections nav and editor when assembling', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.showIntakeForm).toBe(false);
    expect(state.showSectionsNav).toBe(true);
    expect(state.showSectionEditor).toBe(true);
    expect(state.showBindingsPanel).toBe(true);
  });

  it('bindings panel editable when not closed', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.bindingsPanel.editable).toBe(true);
  });

  it('bindings panel not editable when closed', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'submitted' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.bindingsPanel.editable).toBe(false);
  });

  it('shows binding warnings when bindings incomplete', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: [], caseStudyIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.bindingsPanel.showWarnings).toBe(true);
    expect(state.bindingsPanel.warnings).toContain('Select at least one team member');
    expect(state.bindingsPanel.warnings).toContain('Select at least one case study');
  });
});

// ============================================================================
// Section Visibility Tests
// ============================================================================

describe('getRfpUIState sections', () => {
  it('returns all 7 sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections.length).toBe(7);
  });

  it('sections have correct keys in order', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections.map((s) => s.sectionKey)).toEqual([
      'agency_overview',
      'approach',
      'team',
      'work_samples',
      'plan_timeline',
      'pricing',
      'references',
    ]);
  });

  it('sections show stale status', () => {
    const sections = makeAllSections();
    sections[0] = { ...sections[0], isStale: true, staleReason: 'Profile updated' };

    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].isStale).toBe(true);
    expect(state.sections[1].isStale).toBe(false);
  });
});

// ============================================================================
// Section Actions Tests
// ============================================================================

describe('getRfpUIState section actions', () => {
  it('regenerate disabled when blocked_no_firm_brain', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({}),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false }),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.regenerateEnabled).toBe(false);
    expect(state.sections[0].actions.regenerateReason).toContain('Firm Brain');
  });

  it('regenerate disabled during intake', () => {
    const input: RfpDataInput = {
      rfp: null,
      sections: [],
      bindings: null,
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    // No sections in intake state
    expect(state.sections.every((s) => !s.actions.regenerateEnabled)).toBe(true);
  });

  it('regenerate disabled when no bindings', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: [], caseStudyIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.regenerateEnabled).toBe(false);
    expect(state.sections[0].actions.regenerateReason).toContain('team');
  });

  it('regenerate enabled when bindings complete', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.regenerateEnabled).toBe(true);
  });

  it('regenerate disabled when closed', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'submitted' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.regenerateEnabled).toBe(false);
    expect(state.sections[0].actions.regenerateReason).toContain('closed');
  });

  it('approve disabled for empty sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.approveEnabled).toBe(false);
    expect(state.sections[0].actions.approveReason).toContain('Generate');
  });

  it('approve enabled for draft sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections({
        agency_overview: { status: 'draft', contentWorking: 'Draft content' },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.approveEnabled).toBe(true);
  });

  it('approve disabled for stale sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: makeAllSections({
        agency_overview: {
          status: 'draft',
          contentWorking: 'Draft',
          isStale: true,
          staleReason: 'Profile updated',
        },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.approveEnabled).toBe(false);
    expect(state.sections[0].actions.approveReason).toContain('Regenerate');
  });

  it('approve disabled for already approved sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: makeAllSections({
        agency_overview: { status: 'approved', contentApproved: 'Approved' },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.approveEnabled).toBe(false);
    expect(state.sections[0].actions.approveReason).toContain('approved');
  });

  it('edit disabled when closed', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'won' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.sections[0].actions.editEnabled).toBe(false);
  });
});

// ============================================================================
// Progress Summary Tests
// ============================================================================

describe('getRfpUIState progressSummary', () => {
  it('reports correct counts for all empty sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.totalSections).toBe(7);
    expect(state.progressSummary.completedSections).toBe(0);
    expect(state.progressSummary.progressPercent).toBe(0);
  });

  it('reports correct counts for mixed sections', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: makeAllSections({
        agency_overview: { status: 'approved', contentApproved: 'Done' },
        approach: { status: 'ready', contentWorking: 'Ready' },
        team: { status: 'draft', contentWorking: 'Draft' },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.completedSections).toBe(1); // approved only
    expect(state.progressSummary.progressPercent).toBeGreaterThan(0);
  });

  it('reports staleSections count', () => {
    const sections = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content',
    }));
    sections[0].isStale = true;
    sections[1].isStale = true;

    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.staleSections).toBe(2);
  });

  it('canSubmit false when sections empty', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.canSubmit).toBe(false);
  });

  it('canSubmit false when sections stale', () => {
    const sections = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Content',
    }));
    sections[0].isStale = true;

    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.canSubmit).toBe(false);
  });

  it('canSubmit true when all sections approved', () => {
    const allApproved = makeAllSections().map((s) => ({
      ...s,
      status: 'approved' as const,
      contentApproved: 'Approved',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allApproved,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.canSubmit).toBe(true);
  });

  it('canSubmit true when all sections at least ready and not stale', () => {
    const allReady = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      contentWorking: 'Ready',
      isStale: false,
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allReady,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.progressSummary.canSubmit).toBe(true);
  });
});

// ============================================================================
// Debug Info Tests
// ============================================================================

describe('getRfpUIState debug', () => {
  it('provides accurate debug info for healthy state', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.debug.firmBrainReady).toBe(true);
    expect(state.debug.hasBindings).toBe(true);
    expect(state.debug.rfpStatus).toBe('assembling');
  });

  it('reports section stats correctly', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: makeAllSections({
        agency_overview: { status: 'approved', contentApproved: 'Done' },
        approach: { status: 'ready', contentWorking: 'Ready' },
        team: { status: 'draft', contentWorking: 'Draft' },
        work_samples: { status: 'draft', contentWorking: 'Draft', isStale: true },
      }),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    const state = getRfpUIState(input, 'test-company');
    expect(state.debug.sectionStats.approved).toBe(1);
    expect(state.debug.sectionStats.ready).toBe(1);
    expect(state.debug.sectionStats.draft).toBe(2);
    expect(state.debug.sectionStats.empty).toBe(3);
    expect(state.debug.sectionStats.stale).toBe(1);
  });
});

// ============================================================================
// State Transition Invariant Tests
// ============================================================================

describe('state transition invariants', () => {
  it('blocked_no_firm_brain takes precedence over all other states', () => {
    // Even with complete RFP, no firm brain should block
    const allApproved = makeAllSections().map((s) => ({
      ...s,
      status: 'approved' as const,
      contentApproved: 'Approved',
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'review' }),
      sections: allApproved,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({ readyForRfp: false }),
    };
    expect(deriveRfpBuilderState(input)).toBe('blocked_no_firm_brain');
  });

  it('terminal states (won/lost/submitted) take precedence over section states', () => {
    // Even with stale sections, submitted should remain submitted
    const sections = makeAllSections().map((s) => ({
      ...s,
      status: 'ready' as const,
      isStale: true,
    }));
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'submitted' }),
      sections,
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('submitted');
  });

  it('intake takes precedence when RFP status is intake', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'intake' }),
      sections: makeAllSections(),
      bindings: makeBindings({}),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('intake');
  });

  it('assembling_no_bindings comes before assembling_ready', () => {
    const input: RfpDataInput = {
      rfp: makeRfp({ status: 'assembling' }),
      sections: makeAllSections(),
      bindings: makeBindings({ teamMemberIds: [] }),
      firmBrainHealth: makeFirmBrainHealth({}),
    };
    expect(deriveRfpBuilderState(input)).toBe('assembling_no_bindings');
  });
});
