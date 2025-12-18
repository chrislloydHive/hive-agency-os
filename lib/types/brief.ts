// lib/types/brief.ts
// Canonical Brief System - Single source of truth for all work
//
// Product Rule (NON-NEGOTIABLE):
// If work is being done, there must be a Brief — and the Brief is the source of truth.
//
// This unifies Print Ad, Creative Campaigns, SEO projects, Content Strategy,
// Website projects, and Programs under a single Brief entity.

// ============================================================================
// Brief Types
// ============================================================================

/**
 * Brief type - determines which extension fields are used
 */
export type BriefType =
  | 'creative'   // Print ads, single creative assets
  | 'campaign'   // Multi-channel campaigns
  | 'seo'        // SEO projects
  | 'content'    // Content strategy projects
  | 'website'    // Website builds/redesigns
  | 'program';   // Programs (stub for now)

/**
 * Brief lifecycle status
 */
export type BriefStatus =
  | 'draft'      // Initial generation, editable
  | 'in_review'  // Under review before approval
  | 'approved'   // Approved, ready for work generation
  | 'locked';    // Locked, strategy frozen

// ============================================================================
// Brief Core Fields (All brief types)
// ============================================================================

/**
 * Core fields present on every brief regardless of type
 */
export interface BriefCore {
  /** What this brief aims to achieve */
  objective: string;

  /** Who this work is for */
  targetAudience: string;

  /** The key problem this work addresses (from GAP) */
  problemToSolve: string;

  /** The single most important focus/message */
  singleMindedFocus: string;

  /** Constraints and limitations */
  constraints: string[];

  /** How we'll know this worked */
  successDefinition: string;

  /** Assumptions we're making (from GAP confidence + bet tradeoffs) */
  assumptions: string[];
}

// ============================================================================
// Type-Specific Extensions
// ============================================================================

/**
 * Creative/Campaign extension fields
 * Used for: creative, campaign brief types
 */
export interface CreativeCampaignExtension {
  /** The primary message to communicate */
  keyMessage: string;

  /** Supporting messages that reinforce the key message */
  supportingMessages: string[];

  /** Visual direction and style guidance */
  visualDirection: string;

  /** Tone of voice */
  tone: string;

  /** Call to action */
  cta: string;

  /** Required elements (logos, disclaimers, etc.) */
  mandatories: string[];

  /** Format specifications */
  formatSpecs: {
    size?: string;
    dimensions?: string;
    colorMode?: string;
    bleed?: string;
    fileFormat?: string;
    publication?: string;
    channels?: string[];
  };
}

/**
 * SEO extension fields
 */
export interface SeoExtension {
  /** Primary search intent to target */
  searchIntent: string;

  /** Priority topics to focus on */
  priorityTopics: string[];

  /** Keyword themes and clusters */
  keywordThemes: string[];

  /** Technical constraints and requirements */
  technicalConstraints: string[];

  /** Measurement window for results */
  measurementWindow: string;
}

/**
 * Content extension fields
 */
export interface ContentExtension {
  /** Content pillars to build around */
  contentPillars: string[];

  /** Stage in the customer journey */
  journeyStage: string;

  /** Publishing cadence */
  cadence: string;

  /** Distribution channels */
  distributionChannels: string[];
}

/**
 * Website extension fields
 */
export interface WebsiteExtension {
  /** Primary user flows to design for */
  primaryUserFlows: string[];

  /** Conversion goals */
  conversionGoals: string[];

  /** Information architecture notes */
  informationArchitectureNotes: string;

  /** CMS constraints and requirements */
  cmsConstraints: string;
}

/**
 * Program extension (stub for now)
 */
export interface ProgramExtension {
  /** Program type */
  programType?: string;

  /** Program-specific notes */
  programNotes?: string;
}

/**
 * Union of all extension types
 */
export type BriefExtension =
  | CreativeCampaignExtension
  | SeoExtension
  | ContentExtension
  | WebsiteExtension
  | ProgramExtension;

// ============================================================================
// Brief Traceability
// ============================================================================

/**
 * Traceability - links brief back to its source inputs
 */
export interface BriefTraceability {
  /** Context snapshot ID used for generation */
  sourceContextSnapshotId?: string;

  /** GAP run ID used for generation */
  sourceGapRunId?: string;

  /** Strategic bet IDs that were accepted and flowed into brief */
  sourceStrategicBetIds: string[];

  /** Input hashes for change detection */
  inputHashes?: {
    contextHash?: string;
    gapHash?: string;
    betsHash?: string;
  };
}

// ============================================================================
// Change Log (Audit Trail)
// ============================================================================

/**
 * Change source - who/what made the change
 */
export type BriefChangeSource = 'user' | 'ai';

/**
 * Single change log entry for auditing brief modifications
 */
export interface BriefChangeLogEntry {
  /** When the change was made */
  at: string;
  /** Who made the change (user ID or "ai") */
  actor?: string;
  /** Which field was changed (e.g., "core.objective") */
  fieldPath: string;
  /** Previous value */
  from: unknown;
  /** New value */
  to: unknown;
  /** Source of the change */
  source: BriefChangeSource;
}

// ============================================================================
// Brief Entity
// ============================================================================

/**
 * The canonical Brief entity
 * Single source of truth for all work across engagement types
 */
export interface Brief {
  id: string;
  companyId: string;

  /** Engagement this brief belongs to (optional - briefs are project/work-centric) */
  engagementId?: string;

  /** Project this brief belongs to */
  projectId?: string;

  /** Work item this brief belongs to (for prescribed work briefs) */
  workItemId?: string;

  /** Brief title */
  title: string;

  /** Brief type determines which extension is used */
  type: BriefType;

  /** Lifecycle status */
  status: BriefStatus;

  /** Core fields (all brief types) */
  core: BriefCore;

  /** Type-specific extension fields (stored as JSON) */
  extension: BriefExtension;

  /** Traceability back to source inputs */
  traceability: BriefTraceability;

  /** Lock state */
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockedReason?: string;
  unlockReason?: string;

  /** Change log for audit trail */
  changeLog: BriefChangeLogEntry[];

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

// ============================================================================
// Brief Input Types
// ============================================================================

/**
 * Input for creating a new brief
 */
export interface CreateBriefInput {
  companyId: string;
  /** Optional - briefs are project/work-centric */
  engagementId?: string;
  /** Project this brief belongs to */
  projectId?: string;
  /** Work item this brief belongs to (for prescribed work briefs) */
  workItemId?: string;
  title: string;
  type: BriefType;
}

/**
 * Brief generation mode
 */
export type BriefGenerationMode = 'create' | 'replace' | 'improve';

/**
 * Input for generating brief content
 */
export interface GenerateBriefInput {
  companyId: string;
  engagementId: string;
  projectId?: string;
  type: BriefType;
  mode: BriefGenerationMode;
  guidance?: string;
}

/**
 * Field-level AI helper action
 */
export type BriefFieldAction = 'suggest' | 'refine' | 'shorten' | 'expand' | 'variants';

/**
 * Input for field-level AI helper
 */
export interface BriefFieldHelperInput {
  briefId: string;
  /** e.g., "core.singleMindedFocus" or "extension.visualDirection" */
  fieldPath: string;
  action: BriefFieldAction;
  currentValue: string;
  guidance?: string;
}

/**
 * Output from field-level AI helper
 */
export interface BriefFieldHelperOutput {
  /** Single suggestion (for suggest/refine/shorten/expand) */
  value?: string;
  /** Multiple variants (for variants action) */
  variants?: string[];
}

// ============================================================================
// Brief Generation Context
// ============================================================================

/**
 * Context inputs for brief generation
 */
export interface BriefGenerationContext {
  /** Company context graph data */
  contextSnapshot: {
    id: string;
    audience?: unknown;
    brand?: unknown;
    productOffer?: unknown;
    constraints?: unknown;
  };

  /** GAP analysis data */
  gapData: {
    runId: string;
    primaryBlockers: string[];
    rankedOpportunities: string[];
    confidenceLevel?: number;
    blindSpots?: string[];
  };

  /** Accepted strategic bets */
  acceptedBets: Array<{
    id: string;
    title: string;
    intent: string;
    pros: string[];
    cons: string[];
    tradeoffs: string[];
    scope?: string;
    exclusions?: string[];
  }>;
}

/**
 * Structured error payload for brief operations
 */
export interface BriefOperationError {
  /** Error code for programmatic handling */
  code: 'GAP_MISSING' | 'NO_BETS_ACCEPTED' | 'CONTEXT_INCOMPLETE' | 'BRIEF_LOCKED' | 'NOT_APPROVED' | 'VALIDATION_FAILED';
  /** Human-readable title */
  title: string;
  /** Detailed message */
  message: string;
  /** List of missing items (for gating errors) */
  missing?: string[];
}

/**
 * Result of brief generation validation
 */
export interface BriefGenerationValidation {
  valid: boolean;
  /** Structured error if validation failed */
  error?: BriefOperationError;
  missingRequirements?: {
    gapMissing: boolean;
    noBetsAccepted: boolean;
    contextIncomplete: boolean;
  };
  /** Loaded context IDs for traceability */
  contextSnapshotId?: string;
  gapRunId?: string;
}

// ============================================================================
// Display Constants
// ============================================================================

export const BRIEF_TYPE_LABELS: Record<BriefType, string> = {
  creative: 'Creative',
  campaign: 'Campaign',
  seo: 'SEO',
  content: 'Content',
  website: 'Website',
  program: 'Program',
};

export const BRIEF_TYPE_DESCRIPTIONS: Record<BriefType, string> = {
  creative: 'Single creative assets like print ads, banners, etc.',
  campaign: 'Multi-channel marketing campaigns',
  seo: 'Search engine optimization projects',
  content: 'Content strategy and production',
  website: 'Website builds, redesigns, or improvements',
  program: 'Ongoing programs with multiple phases',
};

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  locked: 'Locked',
};

export const BRIEF_STATUS_COLORS: Record<BriefStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  in_review: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  locked: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

// ============================================================================
// Brief Field Definitions (for UI rendering)
// ============================================================================

export interface BriefFieldDefinition {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'textarea' | 'list' | 'object';
  required: boolean;
}

export const BRIEF_CORE_FIELDS: BriefFieldDefinition[] = [
  {
    key: 'objective',
    label: 'Objective',
    description: 'What this brief aims to achieve',
    type: 'textarea',
    required: true,
  },
  {
    key: 'targetAudience',
    label: 'Target Audience',
    description: 'Who this work is for',
    type: 'textarea',
    required: true,
  },
  {
    key: 'problemToSolve',
    label: 'Problem to Solve',
    description: 'The key problem this work addresses',
    type: 'textarea',
    required: true,
  },
  {
    key: 'singleMindedFocus',
    label: 'Single-Minded Focus',
    description: 'The single most important focus/message',
    type: 'textarea',
    required: true,
  },
  {
    key: 'constraints',
    label: 'Constraints',
    description: 'Constraints and limitations',
    type: 'list',
    required: true,
  },
  {
    key: 'successDefinition',
    label: 'Success Definition',
    description: "How we'll know this worked",
    type: 'textarea',
    required: true,
  },
  {
    key: 'assumptions',
    label: 'Assumptions',
    description: 'Assumptions we are making',
    type: 'list',
    required: true,
  },
];

export const CREATIVE_CAMPAIGN_FIELDS: BriefFieldDefinition[] = [
  { key: 'keyMessage', label: 'Key Message', description: 'The primary message to communicate', type: 'textarea', required: true },
  { key: 'supportingMessages', label: 'Supporting Messages', description: 'Messages that reinforce the key message', type: 'list', required: true },
  { key: 'visualDirection', label: 'Visual Direction', description: 'Visual style guidance', type: 'textarea', required: true },
  { key: 'tone', label: 'Tone', description: 'Tone of voice', type: 'text', required: true },
  { key: 'cta', label: 'Call to Action', description: 'What we want the audience to do', type: 'text', required: true },
  { key: 'mandatories', label: 'Mandatories', description: 'Required elements', type: 'list', required: true },
  { key: 'formatSpecs', label: 'Format Specs', description: 'Format specifications', type: 'object', required: false },
];

export const SEO_FIELDS: BriefFieldDefinition[] = [
  { key: 'searchIntent', label: 'Search Intent', description: 'Primary search intent to target', type: 'textarea', required: true },
  { key: 'priorityTopics', label: 'Priority Topics', description: 'Topics to focus on', type: 'list', required: true },
  { key: 'keywordThemes', label: 'Keyword Themes', description: 'Keyword themes and clusters', type: 'list', required: true },
  { key: 'technicalConstraints', label: 'Technical Constraints', description: 'Technical requirements', type: 'list', required: false },
  { key: 'measurementWindow', label: 'Measurement Window', description: 'Window for measuring results', type: 'text', required: true },
];

export const CONTENT_FIELDS: BriefFieldDefinition[] = [
  { key: 'contentPillars', label: 'Content Pillars', description: 'Pillars to build around', type: 'list', required: true },
  { key: 'journeyStage', label: 'Journey Stage', description: 'Customer journey stage', type: 'text', required: true },
  { key: 'cadence', label: 'Cadence', description: 'Publishing cadence', type: 'text', required: true },
  { key: 'distributionChannels', label: 'Distribution Channels', description: 'Where content will be distributed', type: 'list', required: true },
];

export const WEBSITE_FIELDS: BriefFieldDefinition[] = [
  { key: 'primaryUserFlows', label: 'Primary User Flows', description: 'User flows to design for', type: 'list', required: true },
  { key: 'conversionGoals', label: 'Conversion Goals', description: 'Conversion objectives', type: 'list', required: true },
  { key: 'informationArchitectureNotes', label: 'IA Notes', description: 'Information architecture notes', type: 'textarea', required: false },
  { key: 'cmsConstraints', label: 'CMS Constraints', description: 'CMS requirements', type: 'textarea', required: false },
];

/**
 * Get field definitions for a brief type
 */
export function getExtensionFieldsForType(type: BriefType): BriefFieldDefinition[] {
  switch (type) {
    case 'creative':
    case 'campaign':
      return CREATIVE_CAMPAIGN_FIELDS;
    case 'seo':
      return SEO_FIELDS;
    case 'content':
      return CONTENT_FIELDS;
    case 'website':
      return WEBSITE_FIELDS;
    case 'program':
      return [];
    default:
      return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a brief can generate work
 * INVARIANT: Work can only be generated from approved or locked briefs
 */
export function canGenerateWork(brief: Brief): boolean {
  return brief.status === 'approved' || brief.status === 'locked';
}

/**
 * Check if a brief can be edited
 * LOCKING SEMANTICS:
 * - approved = ready for execution; editable but audited
 * - locked = execution started; edits blocked unless unlocked with reason
 */
export function canEditBrief(brief: Brief): boolean {
  // Locked briefs cannot be edited
  if (brief.status === 'locked' || brief.isLocked) {
    return false;
  }
  // Draft, in_review, and approved can be edited (approved is audited)
  return brief.status === 'draft' || brief.status === 'in_review' || brief.status === 'approved';
}

/**
 * Check if a brief can be approved
 */
export function canApproveBrief(brief: Brief): boolean {
  return brief.status === 'draft' || brief.status === 'in_review';
}

/**
 * Check if a brief can be locked
 * Brief must be approved first
 */
export function canLockBrief(brief: Brief): boolean {
  return brief.status === 'approved' && !brief.isLocked;
}

/**
 * Check if a brief can be unlocked
 * Only locked briefs can be unlocked
 */
export function canUnlockBrief(brief: Brief): boolean {
  return brief.status === 'locked' || brief.isLocked;
}

/**
 * Get structured error for locked brief
 */
export function getLockedBriefError(): BriefOperationError {
  return {
    code: 'BRIEF_LOCKED',
    title: 'Brief is Locked',
    message: 'This brief is locked and cannot be edited. Unlock it first to make changes.',
  };
}

/**
 * Get structured error for work generation without approved brief
 */
export function getNotApprovedError(brief: Brief): BriefOperationError {
  return {
    code: 'NOT_APPROVED',
    title: 'Brief Not Approved',
    message: `Brief must be approved before generating work. Current status: ${brief.status}`,
  };
}

/**
 * Create empty core fields
 */
export function createEmptyBriefCore(): BriefCore {
  return {
    objective: '',
    targetAudience: '',
    problemToSolve: '',
    singleMindedFocus: '',
    constraints: [],
    successDefinition: '',
    assumptions: [],
  };
}

/**
 * Create empty extension for a brief type
 */
export function createEmptyExtension(type: BriefType): BriefExtension {
  switch (type) {
    case 'creative':
    case 'campaign':
      return {
        keyMessage: '',
        supportingMessages: [],
        visualDirection: '',
        tone: '',
        cta: '',
        mandatories: [],
        formatSpecs: {},
      } as CreativeCampaignExtension;
    case 'seo':
      return {
        searchIntent: '',
        priorityTopics: [],
        keywordThemes: [],
        technicalConstraints: [],
        measurementWindow: '',
      } as SeoExtension;
    case 'content':
      return {
        contentPillars: [],
        journeyStage: '',
        cadence: '',
        distributionChannels: [],
      } as ContentExtension;
    case 'website':
      return {
        primaryUserFlows: [],
        conversionGoals: [],
        informationArchitectureNotes: '',
        cmsConstraints: '',
      } as WebsiteExtension;
    case 'program':
      return {
        programType: '',
        programNotes: '',
      } as ProgramExtension;
    default:
      return {} as BriefExtension;
  }
}
