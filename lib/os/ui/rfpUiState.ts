// lib/os/ui/rfpUiState.ts
// RFP Builder UI State Selector
//
// Single source of truth for RFP builder page state derivation.
// Maps raw API data → discrete UI state → visibility rules.

import type {
  Rfp,
  RfpSection,
  RfpBindings,
  RfpSectionKey,
  RfpStatus,
  RfpProgress,
  RFP_SECTION_ORDER,
} from '@/lib/types/rfp';
import type { FirmBrainHealth } from '@/lib/types/firmBrain';
import { computeRfpProgress } from '@/lib/types/rfp';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the RFP builder experience
 */
export type RfpBuilderState =
  | 'blocked_no_firm_brain'    // Firm Brain not configured
  | 'intake'                   // Gathering initial data
  | 'assembling_no_bindings'   // No team/cases/refs selected
  | 'assembling_ready'         // Can generate sections
  | 'assembling_in_progress'   // Sections being generated
  | 'review_pending'           // Sections drafted, awaiting review
  | 'review_stale'             // Some sections stale
  | 'ready_to_submit'          // All sections approved
  | 'submitted'                // Submitted to prospect
  | 'closed_won'               // Deal won
  | 'closed_lost';             // Deal lost

/**
 * Banner tone for the current state
 */
export type RfpBannerTone = 'blocked' | 'info' | 'warning' | 'success' | 'neutral';

/**
 * Banner configuration
 */
export interface RfpBanner {
  tone: RfpBannerTone;
  title: string;
  body: string;
}

/**
 * CTA configuration
 */
export interface RfpCTA {
  label: string;
  action: 'navigate' | 'generate' | 'approve' | 'submit' | 'export' | 'none';
  href?: string;
  variant: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Section action configuration
 */
export interface RfpSectionAction {
  regenerateEnabled: boolean;
  approveEnabled: boolean;
  editEnabled: boolean;
  regenerateReason?: string;
  approveReason?: string;
}

/**
 * Section visibility configuration
 */
export interface RfpSectionVisibility {
  sectionKey: RfpSectionKey;
  visible: boolean;
  status: RfpSection['status'];
  isStale: boolean;
  needsReview: boolean;
  actions: RfpSectionAction;
}

/**
 * Bindings panel configuration
 */
export interface RfpBindingsPanel {
  visible: boolean;
  editable: boolean;
  showWarnings: boolean;
  warnings: string[];
}

/**
 * Progress summary
 */
export interface RfpProgressSummary {
  totalSections: number;
  completedSections: number;
  staleSections: number;
  needsReviewSections: number;
  progressPercent: number;
  canSubmit: boolean;
  blockers: string[];
}

/**
 * Debug info for development
 */
export interface RfpDebugInfo {
  firmBrainReady: boolean;
  hasBindings: boolean;
  rfpStatus: RfpStatus;
  sectionStats: {
    empty: number;
    draft: number;
    ready: number;
    approved: number;
    stale: number;
  };
}

/**
 * Full UI state derived from data
 */
export interface RfpUIState {
  state: RfpBuilderState;
  banner: RfpBanner;
  showIntakeForm: boolean;
  showSectionsNav: boolean;
  showSectionEditor: boolean;
  showBindingsPanel: boolean;
  bindingsPanel: RfpBindingsPanel;
  sections: RfpSectionVisibility[];
  primaryCTA: RfpCTA;
  secondaryCTA: RfpCTA | null;
  progressSummary: RfpProgressSummary;
  debug: RfpDebugInfo;
}

/**
 * Raw data inputs for state derivation
 */
export interface RfpDataInput {
  rfp: Rfp | null;
  sections: RfpSection[];
  bindings: RfpBindings | null;
  firmBrainHealth: FirmBrainHealth | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum bindings required to generate sections
 */
const MIN_TEAM_MEMBERS = 1;
const MIN_CASE_STUDIES = 1;

/**
 * Section order for display
 */
const SECTION_ORDER: RfpSectionKey[] = [
  'agency_overview',
  'approach',
  'team',
  'work_samples',
  'plan_timeline',
  'pricing',
  'references',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if bindings meet minimum requirements for generation
 */
function hasMinimalBindings(bindings: RfpBindings | null): boolean {
  if (!bindings) return false;
  return (
    bindings.teamMemberIds.length >= MIN_TEAM_MEMBERS &&
    bindings.caseStudyIds.length >= MIN_CASE_STUDIES
  );
}

/**
 * Get binding warnings
 */
function getBindingWarnings(bindings: RfpBindings | null): string[] {
  const warnings: string[] = [];
  if (!bindings) {
    warnings.push('No bindings configured');
    return warnings;
  }

  if (bindings.teamMemberIds.length === 0) {
    warnings.push('Select at least one team member');
  }
  if (bindings.caseStudyIds.length === 0) {
    warnings.push('Select at least one case study');
  }
  if (bindings.referenceIds.length === 0) {
    warnings.push('Consider adding references');
  }
  if (!bindings.pricingTemplateId) {
    warnings.push('No pricing template selected');
  }
  if (!bindings.planTemplateId) {
    warnings.push('No plan template selected');
  }

  return warnings;
}

/**
 * Compute progress summary from sections
 */
function getProgressSummary(sections: RfpSection[]): RfpProgressSummary {
  const progress = computeRfpProgress(sections);

  return {
    totalSections: progress.totalSections,
    completedSections: progress.approvedSections,
    staleSections: progress.staleSections,
    needsReviewSections: progress.needsReviewSections,
    progressPercent: progress.progressPercent,
    canSubmit: progress.canSubmit,
    blockers: progress.blockers,
  };
}

/**
 * Get section action configuration
 */
function getSectionActions(
  section: RfpSection,
  state: RfpBuilderState,
  hasBindings: boolean
): RfpSectionAction {
  const isBlocked = state === 'blocked_no_firm_brain';
  const isIntake = state === 'intake';
  const isClosed = state === 'submitted' || state === 'closed_won' || state === 'closed_lost';

  // Can regenerate if: not blocked, not intake, has bindings, section has content or is draft
  const regenerateEnabled = !isBlocked && !isIntake && !isClosed && hasBindings;
  const regenerateReason = !regenerateEnabled
    ? isBlocked
      ? 'Configure Firm Brain first'
      : isIntake
        ? 'Complete intake first'
        : isClosed
          ? 'RFP is closed'
          : !hasBindings
            ? 'Select team and cases first'
            : undefined
    : undefined;

  // Can approve if: not blocked, section is draft or ready, not stale
  const canApprove = !isBlocked && !isClosed &&
    (section.status === 'draft' || section.status === 'ready') &&
    !section.isStale;
  const approveReason = !canApprove
    ? section.status === 'empty'
      ? 'Generate content first'
      : section.status === 'approved'
        ? 'Already approved'
        : section.isStale
          ? 'Regenerate stale section first'
          : isClosed
            ? 'RFP is closed'
            : 'Cannot approve'
    : undefined;

  // Can edit if: not blocked, not closed
  const editEnabled = !isBlocked && !isClosed;

  return {
    regenerateEnabled,
    approveEnabled: canApprove,
    editEnabled,
    regenerateReason,
    approveReason,
  };
}

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete RfpBuilderState from raw data
 */
export function deriveRfpBuilderState(input: RfpDataInput): RfpBuilderState {
  const { rfp, sections, bindings, firmBrainHealth } = input;

  // Check firm brain readiness
  if (!firmBrainHealth?.readyForRfp) {
    return 'blocked_no_firm_brain';
  }

  // If no RFP, we're in intake
  if (!rfp) {
    return 'intake';
  }

  // Check RFP status for terminal states
  if (rfp.status === 'submitted') {
    return 'submitted';
  }
  if (rfp.status === 'won') {
    return 'closed_won';
  }
  if (rfp.status === 'lost') {
    return 'closed_lost';
  }

  // For intake status RFP
  if (rfp.status === 'intake') {
    return 'intake';
  }

  // Check bindings
  const hasBindings = hasMinimalBindings(bindings);
  if (!hasBindings) {
    return 'assembling_no_bindings';
  }

  // Check section states
  const emptySections = sections.filter(s => s.status === 'empty');
  const draftSections = sections.filter(s => s.status === 'draft');
  const staleSections = sections.filter(s => s.isStale);
  const approvedSections = sections.filter(s => s.status === 'approved');

  // All sections empty → ready to generate
  if (emptySections.length === sections.length) {
    return 'assembling_ready';
  }

  // Some sections empty, some in progress → in progress
  if (emptySections.length > 0 || draftSections.length > 0) {
    return 'assembling_in_progress';
  }

  // All sections have content - check for staleness
  if (staleSections.length > 0) {
    return 'review_stale';
  }

  // All sections approved → ready to submit
  if (approvedSections.length === sections.length) {
    return 'ready_to_submit';
  }

  // Sections ready for review
  return 'review_pending';
}

// ============================================================================
// Banner Configuration
// ============================================================================

/**
 * Get banner configuration for a state
 */
function getBanner(
  state: RfpBuilderState,
  input: RfpDataInput
): RfpBanner {
  const { firmBrainHealth, sections } = input;
  const staleSections = sections.filter(s => s.isStale);

  switch (state) {
    case 'blocked_no_firm_brain':
      return {
        tone: 'blocked',
        title: 'Configure Firm Brain',
        body: `Missing: ${firmBrainHealth?.missingForRfp?.join(', ') || 'required settings'}. Go to Settings to configure.`,
      };

    case 'intake':
      return {
        tone: 'info',
        title: 'Start Your RFP Response',
        body: 'Enter the RFP details and scope summary to begin.',
      };

    case 'assembling_no_bindings':
      return {
        tone: 'warning',
        title: 'Select Team & Work Samples',
        body: 'Choose team members and case studies in the Bindings panel to generate sections.',
      };

    case 'assembling_ready':
      return {
        tone: 'info',
        title: 'Ready to Generate',
        body: 'Click "Generate All Drafts" to create content for all sections.',
      };

    case 'assembling_in_progress':
      return {
        tone: 'info',
        title: 'Building Your Response',
        body: 'Review and complete each section. Generate remaining sections as needed.',
      };

    case 'review_pending':
      return {
        tone: 'info',
        title: 'Review & Approve Sections',
        body: 'All sections have content. Review and approve each to finalize.',
      };

    case 'review_stale':
      return {
        tone: 'warning',
        title: 'Sections Need Update',
        body: `${staleSections.length} section${staleSections.length > 1 ? 's' : ''} stale due to changes. Regenerate before submitting.`,
      };

    case 'ready_to_submit':
      return {
        tone: 'success',
        title: 'Ready to Submit',
        body: 'All sections approved. Export your RFP response document.',
      };

    case 'submitted':
      return {
        tone: 'neutral',
        title: 'RFP Submitted',
        body: 'This RFP response has been submitted. Awaiting outcome.',
      };

    case 'closed_won':
      return {
        tone: 'success',
        title: 'Deal Won',
        body: 'Congratulations! This RFP resulted in a won deal.',
      };

    case 'closed_lost':
      return {
        tone: 'neutral',
        title: 'Deal Lost',
        body: 'This RFP did not result in a deal.',
      };
  }
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get the primary CTA for a state
 */
function getPrimaryCTA(
  state: RfpBuilderState,
  companyId: string,
  rfpId: string | null,
  progressSummary: RfpProgressSummary
): RfpCTA {
  switch (state) {
    case 'blocked_no_firm_brain':
      return {
        label: 'Go to Settings',
        action: 'navigate',
        href: `/settings/firm-brain`,
        variant: 'primary',
      };

    case 'intake':
      return {
        label: 'Save & Continue',
        action: 'navigate',
        href: rfpId ? `/c/${companyId}/deliver/rfp/${rfpId}` : undefined,
        variant: 'primary',
        disabled: !rfpId,
        disabledReason: 'Enter RFP details first',
      };

    case 'assembling_no_bindings':
      return {
        label: 'Generate All Drafts',
        action: 'generate',
        variant: 'primary',
        disabled: true,
        disabledReason: 'Select team and cases first',
      };

    case 'assembling_ready':
      return {
        label: 'Generate All Drafts',
        action: 'generate',
        variant: 'primary',
      };

    case 'assembling_in_progress':
      return {
        label: 'Generate Remaining',
        action: 'generate',
        variant: 'primary',
      };

    case 'review_pending':
      return {
        label: 'Approve All Ready',
        action: 'approve',
        variant: 'primary',
      };

    case 'review_stale':
      return {
        label: 'Regenerate Stale',
        action: 'generate',
        variant: 'primary',
      };

    case 'ready_to_submit':
      return {
        label: 'Export to Google Doc',
        action: 'export',
        variant: 'primary',
      };

    case 'submitted':
    case 'closed_won':
    case 'closed_lost':
      return {
        label: 'View Document',
        action: 'navigate',
        href: `/c/${companyId}/documents`,
        variant: 'secondary',
      };
  }
}

/**
 * Get optional secondary CTA
 */
function getSecondaryCTA(
  state: RfpBuilderState,
  companyId: string,
  rfpId: string | null
): RfpCTA | null {
  switch (state) {
    case 'assembling_in_progress':
    case 'review_pending':
      return {
        label: 'Preview Document',
        action: 'navigate',
        href: rfpId ? `/c/${companyId}/deliver/rfp/${rfpId}/preview` : undefined,
        variant: 'secondary',
      };

    case 'ready_to_submit':
      return {
        label: 'Mark as Submitted',
        action: 'submit',
        variant: 'secondary',
      };

    case 'submitted':
      return {
        label: 'Mark Won',
        action: 'navigate',
        href: rfpId ? `/c/${companyId}/deliver/rfp/${rfpId}?action=won` : undefined,
        variant: 'primary',
      };

    default:
      return null;
  }
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete RFP builder UI state from raw data
 *
 * This is the single source of truth for all RFP builder page UI decisions.
 * All conditional rendering should flow from this selector.
 *
 * @param input - Raw data from APIs
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getRfpUIState(
  input: RfpDataInput,
  companyId: string
): RfpUIState {
  const { rfp, sections, bindings, firmBrainHealth } = input;

  // Derive state
  const state = deriveRfpBuilderState(input);

  // Compute intermediate values
  const hasBindings = hasMinimalBindings(bindings);
  const bindingWarnings = getBindingWarnings(bindings);
  const progressSummary = getProgressSummary(sections);

  // Get banner and CTAs
  const banner = getBanner(state, input);
  const primaryCTA = getPrimaryCTA(state, companyId, rfp?.id || null, progressSummary);
  const secondaryCTA = getSecondaryCTA(state, companyId, rfp?.id || null);

  // Visibility rules
  const isBlocked = state === 'blocked_no_firm_brain';
  const isIntake = state === 'intake';
  const isClosed = state === 'submitted' || state === 'closed_won' || state === 'closed_lost';

  const showIntakeForm = isIntake;
  const showSectionsNav = !isBlocked && !isIntake;
  const showSectionEditor = !isBlocked && !isIntake;
  const showBindingsPanel = !isBlocked && !isIntake;

  // Bindings panel config
  const bindingsPanel: RfpBindingsPanel = {
    visible: showBindingsPanel,
    editable: !isClosed,
    showWarnings: !hasBindings && !isIntake,
    warnings: bindingWarnings,
  };

  // Section visibility
  const sectionVisibility: RfpSectionVisibility[] = SECTION_ORDER.map((sectionKey) => {
    const section = sections.find(s => s.sectionKey === sectionKey);
    const defaultSection: RfpSection = {
      id: '',
      rfpId: rfp?.id || '',
      sectionKey,
      title: '',
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
      createdAt: null,
      updatedAt: null,
    };

    const effectiveSection = section || defaultSection;
    const actions = getSectionActions(effectiveSection, state, hasBindings);

    return {
      sectionKey,
      visible: showSectionsNav,
      status: effectiveSection.status,
      isStale: effectiveSection.isStale,
      needsReview: effectiveSection.needsReview,
      actions,
    };
  });

  // Compute section stats for debug
  const sectionStats = {
    empty: sections.filter(s => s.status === 'empty').length,
    draft: sections.filter(s => s.status === 'draft').length,
    ready: sections.filter(s => s.status === 'ready').length,
    approved: sections.filter(s => s.status === 'approved').length,
    stale: sections.filter(s => s.isStale).length,
  };

  return {
    state,
    banner,
    showIntakeForm,
    showSectionsNav,
    showSectionEditor,
    showBindingsPanel,
    bindingsPanel,
    sections: sectionVisibility,
    primaryCTA,
    secondaryCTA,
    progressSummary,
    debug: {
      firmBrainReady: firmBrainHealth?.readyForRfp ?? false,
      hasBindings,
      rfpStatus: rfp?.status || 'intake',
      sectionStats,
    },
  };
}
