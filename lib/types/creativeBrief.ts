// lib/types/creativeBrief.ts
// Creative Brief types for project deliverables
//
// The Creative Brief is the terminal artifact of project-scoped strategy.
// After approval, the brief becomes the canonical document that drives execution.
// Strategy is locked once brief is approved.

import type { ProjectType } from './project';
import type { ProjectStrategicFrame } from './projectStrategy';
import type { FieldProvenance } from './strategy';

// ============================================================================
// Brief Status Types
// ============================================================================

/**
 * Brief status lifecycle
 */
export type BriefStatus =
  | 'draft'           // Initial creation/editing
  | 'in_review'       // Ready for review
  | 'approved';       // Approved, locked

// ============================================================================
// Brief Content Schemas
// ============================================================================

/**
 * Base brief content fields (common to all project types)
 */
export interface BaseBriefContent {
  // Project identity
  projectName: string;
  projectOverview?: string;

  // Strategic context
  objective: string;
  communicationObjective?: string;

  // Audience
  primaryAudience: string;
  audienceInsights?: string;

  // Message
  singleMindedMessage: string;
  supportingPoints: string[];
  proofPoints?: string[];

  // Offer (if applicable)
  offer?: string;

  // Brand
  brandVoice: string;
  brandGuidelines?: string;

  // Requirements
  mandatories: string[];          // logos, legal, disclaimers, CTA
  constraints: string[];          // format, placement, budget, dates

  // Success
  successDefinition: string;
  kpis?: string[];

  // Timeline
  deadline?: string;
  milestones?: Array<{ date: string; milestone: string }>;

  // Budget
  budget?: string;
  budgetNotes?: string;
}

/**
 * Print Ad specific brief fields
 */
export interface PrintAdBriefContent extends BaseBriefContent {
  projectType: 'print_ad';

  // Format specifications
  formatSpecs: {
    size: string;                 // e.g., "Full page", "Half page"
    dimensions?: string;          // e.g., "8.5x11", "A4"
    bleed?: string;               // Bleed area
    safeArea?: string;            // Safe area
    colorMode?: 'CMYK' | 'RGB' | 'Grayscale';
  };

  // Publication
  publication?: string;           // Target publication
  placementNotes?: string;        // Placement requirements

  // Creative direction
  cta: string;                    // Call to action
  headlineOptions?: string[];     // Optional headline suggestions
  visualDirection: string;        // Art direction notes
  heroImageConcept?: string;      // Main visual concept
  layoutPreference?: string;      // Layout notes
  copyTone: string;               // Copy tone/style

  // References
  examplesOrReferences?: string[];

  // Legal
  disclaimers?: string[];
  legalReviewRequired?: boolean;
}

/**
 * Website brief fields (future)
 */
export interface WebsiteBriefContent extends BaseBriefContent {
  projectType: 'website';

  // Site structure
  siteStructure?: string[];
  pageCount?: number;
  userJourneys?: string[];

  // Technical
  technicalRequirements?: string[];
  platformPreference?: string;
  integrations?: string[];

  // Content
  contentRequirements?: string;
  copywritingNeeded?: boolean;
}

/**
 * Campaign brief fields (future)
 */
export interface CampaignBriefContent extends BaseBriefContent {
  projectType: 'campaign';

  // Campaign scope
  channels: string[];
  flightDates?: { start: string; end: string };
  mediaObjectives?: string[];

  // Budget allocation
  budgetByChannel?: Record<string, number>;

  // Targeting
  targetingCriteria?: string[];
  geographicScope?: string;
}

/**
 * Content brief fields (future)
 */
export interface ContentBriefContent extends BaseBriefContent {
  projectType: 'content';

  // Content pillars
  contentPillars?: string[];
  contentTypes?: string[];

  // Distribution
  distributionChannels?: string[];
  publishingCadence?: string;

  // Editorial
  editorialCalendarIncluded?: boolean;
  contentGuidelines?: string;
}

/**
 * Other project brief (minimal structure for custom projects)
 */
export interface OtherBriefContent extends BaseBriefContent {
  projectType: 'other';

  // Flexible additional fields
  customFields?: Record<string, unknown>;
}

/**
 * Union type for all brief content types
 */
export type BriefContent =
  | PrintAdBriefContent
  | WebsiteBriefContent
  | CampaignBriefContent
  | ContentBriefContent
  | OtherBriefContent;

// ============================================================================
// Source Snapshot
// ============================================================================

/**
 * Source snapshot - preserves strategy state at brief generation
 * This is frozen at generation time for traceability
 */
export interface BriefSourceSnapshot {
  // Strategy snapshot
  projectStrategyId: string;
  strategySnapshotAt: string;
  strategyHash?: string;

  // Frame snapshot
  projectStrategyFrame: ProjectStrategicFrame;

  // Objectives at time of generation
  objectives: Array<{ id: string; text: string; metric?: string; target?: string }>;

  // Accepted bets at time of generation (full data for traceability)
  acceptedBets: Array<{
    id: string;
    title: string;
    intent: string;
    pros: string[];
    cons: string[];
    tradeoffs: string[];
  }>;

  // Company context snapshot
  companyContextHash?: string;
  companyName?: string;
  companyAudience?: string;
  companyValueProp?: string;

  // GAP report reference
  gapReportId?: string;
  gapScore?: number;

  // Input hashes for staleness detection
  inputHashes: {
    contextHash?: string;
    strategyHash?: string;
  };
}

// ============================================================================
// Field Provenance
// ============================================================================

/**
 * Field-level provenance for brief fields
 */
export interface BriefFieldProvenance {
  [fieldPath: string]: FieldProvenance;
}

// ============================================================================
// Creative Brief Entity
// ============================================================================

/**
 * Creative Brief entity
 */
export interface CreativeBrief {
  id: string;
  companyId: string;
  projectId: string;
  projectType: ProjectType;

  // Brief content
  title: string;
  content: BriefContent;

  // Status
  status: BriefStatus;

  // Source snapshot (frozen at generation time)
  sourceSnapshot: BriefSourceSnapshot;

  // Field provenance (AI generation tracking)
  fieldProvenance?: BriefFieldProvenance;

  // Approval workflow
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;

  // Version tracking
  version: number;
  previousVersionId?: string;

  // Lock state
  isLocked: boolean;
  lockedAt?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;           // When AI generated
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Generate brief request
 */
export interface GenerateBriefRequest {
  projectId: string;
  mode: 'create' | 'replace' | 'improve';
  guidance?: string;
}

/**
 * Generate brief response
 */
export interface GenerateBriefResponse {
  brief: CreativeBrief;
  reasoning: string;
  inputsUsed: {
    projectStrategy: boolean;
    companyContext: boolean;
    gapReport: boolean;
    acceptedBetsCount: number;
  };
  inputsUsedBadges: string[];     // e.g., ['GAP', 'Context', 'Frame', 'Objectives', 'Bets']
}

/**
 * Field AI helper request
 */
export interface BriefFieldAIRequest {
  projectId: string;
  fieldPath: string;              // e.g., 'content.singleMindedMessage'
  currentValue?: string;
  action: 'suggest' | 'refine' | 'shorten' | 'expand' | 'variants';
  guidance?: string;
}

/**
 * Field AI helper response
 */
export interface BriefFieldAIResponse {
  value?: string;                 // Single suggestion
  variants?: string[];            // Multiple variants
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

/**
 * Approve brief request
 */
export interface ApproveBriefRequest {
  projectId: string;
  briefId: string;
  approvalNotes?: string;
}

/**
 * Approve brief response - includes lock status
 */
export interface ApproveBriefResponse {
  brief: CreativeBrief;
  projectLocked: boolean;
  strategyLocked: boolean;
}

// ============================================================================
// Display Constants
// ============================================================================

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
};

export const BRIEF_STATUS_COLORS: Record<BriefStatus, string> = {
  draft: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  in_review: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

// ============================================================================
// Brief Field Schemas (for UI rendering)
// ============================================================================

/**
 * Brief section definition for UI rendering
 */
export interface BriefSection {
  id: string;
  title: string;
  fields: BriefFieldDefinition[];
}

/**
 * Brief field definition for UI rendering
 */
export interface BriefFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'list' | 'object';
  required: boolean;
  aiEnabled: boolean;
  placeholder?: string;
  description?: string;
}

/**
 * Base brief sections (common to all project types)
 */
export const BASE_BRIEF_SECTIONS: BriefSection[] = [
  {
    id: 'context',
    title: 'Strategic Context',
    fields: [
      { key: 'objective', label: 'Objective', type: 'textarea', required: true, aiEnabled: true },
      { key: 'primaryAudience', label: 'Primary Audience', type: 'textarea', required: true, aiEnabled: true },
      { key: 'audienceInsights', label: 'Audience Insights', type: 'textarea', required: false, aiEnabled: true },
    ],
  },
  {
    id: 'message',
    title: 'Message',
    fields: [
      { key: 'singleMindedMessage', label: 'Single-Minded Message', type: 'textarea', required: true, aiEnabled: true },
      { key: 'supportingPoints', label: 'Supporting Points', type: 'list', required: true, aiEnabled: true },
      { key: 'proofPoints', label: 'Proof Points', type: 'list', required: false, aiEnabled: true },
    ],
  },
  {
    id: 'brand',
    title: 'Brand',
    fields: [
      { key: 'brandVoice', label: 'Brand Voice', type: 'textarea', required: true, aiEnabled: true },
      { key: 'offer', label: 'Offer', type: 'text', required: false, aiEnabled: true },
    ],
  },
  {
    id: 'requirements',
    title: 'Requirements',
    fields: [
      { key: 'mandatories', label: 'Mandatories', type: 'list', required: true, aiEnabled: false },
      { key: 'constraints', label: 'Constraints', type: 'list', required: true, aiEnabled: false },
    ],
  },
  {
    id: 'success',
    title: 'Success Definition',
    fields: [
      { key: 'successDefinition', label: 'How We Know It Worked', type: 'textarea', required: true, aiEnabled: true },
    ],
  },
];

/**
 * Print Ad specific sections
 */
export const PRINT_AD_BRIEF_SECTIONS: BriefSection[] = [
  ...BASE_BRIEF_SECTIONS,
  {
    id: 'format',
    title: 'Format Specifications',
    fields: [
      { key: 'formatSpecs.size', label: 'Size', type: 'text', required: true, aiEnabled: false },
      { key: 'formatSpecs.dimensions', label: 'Dimensions', type: 'text', required: false, aiEnabled: false },
      { key: 'formatSpecs.colorMode', label: 'Color Mode', type: 'text', required: false, aiEnabled: false },
      { key: 'publication', label: 'Publication', type: 'text', required: false, aiEnabled: false },
    ],
  },
  {
    id: 'creative',
    title: 'Creative Direction',
    fields: [
      { key: 'cta', label: 'Call to Action', type: 'text', required: true, aiEnabled: true },
      { key: 'headlineOptions', label: 'Headline Options', type: 'list', required: false, aiEnabled: true },
      { key: 'visualDirection', label: 'Visual Direction', type: 'textarea', required: true, aiEnabled: true },
      { key: 'copyTone', label: 'Copy Tone', type: 'textarea', required: true, aiEnabled: true },
    ],
  },
];

/**
 * Get brief sections for a project type
 */
export function getBriefSectionsForType(projectType: ProjectType): BriefSection[] {
  switch (projectType) {
    case 'print_ad':
      return PRINT_AD_BRIEF_SECTIONS;
    // Future: Add other project type sections
    default:
      return BASE_BRIEF_SECTIONS;
  }
}
