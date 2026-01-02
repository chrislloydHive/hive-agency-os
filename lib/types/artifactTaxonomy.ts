// lib/types/artifactTaxonomy.ts
// CANONICAL ARTIFACT TAXONOMY - System Contract
//
// This file defines the authoritative enums for the artifact system.
// ALL artifact creation and indexing MUST use these enums.
// Do not add new values without updating this file.

// ============================================================================
// ArtifactPhase - Client lifecycle phase where artifact belongs
// ============================================================================

/**
 * Canonical phases in the client engagement lifecycle.
 * Every artifact must belong to exactly one phase.
 */
export enum ArtifactPhase {
  /** Discovery: Labs, diagnostics, research, audits */
  Discover = 'Discover',
  /** Decision: Strategy, planning, recommendations */
  Decide = 'Decide',
  /** Delivery: Proposals, RFPs, briefs, handoffs */
  Deliver = 'Deliver',
  /** Work: Execution outputs, deliverables, assets */
  Work = 'Work',
  /** Reporting: QBRs, performance reports, analysis */
  Report = 'Report',
  /** Legal: Contracts, agreements, compliance documents */
  Legal = 'Legal',
  /** Uncategorized */
  Other = 'Other',
}

// ============================================================================
// ArtifactType - Classification of artifact content
// ============================================================================

/**
 * Canonical artifact types for the entire system.
 * Determines UI rendering, icons, and behavior.
 */
export enum ArtifactType {
  // ---------------------------------------------------------------------------
  // Diagnostic Reports (Phase: Discover)
  // ---------------------------------------------------------------------------
  /** Website Lab diagnostic output */
  LabReportWebsite = 'lab_report_website',
  /** Brand Lab diagnostic output */
  LabReportBrand = 'lab_report_brand',
  /** SEO Lab diagnostic output */
  LabReportSeo = 'lab_report_seo',
  /** Content Lab diagnostic output */
  LabReportContent = 'lab_report_content',
  /** Demand Lab diagnostic output */
  LabReportDemand = 'lab_report_demand',
  /** Operations Lab diagnostic output */
  LabReportOps = 'lab_report_ops',
  /** Creative Lab diagnostic output */
  LabReportCreative = 'lab_report_creative',
  /** Competition Lab diagnostic output */
  LabReportCompetitor = 'lab_report_competitor',
  /** Audience Lab diagnostic output */
  LabReportAudience = 'lab_report_audience',
  /** Media Lab diagnostic output */
  LabReportMedia = 'lab_report_media',
  /** GAP Analysis - IA or Full */
  GapReport = 'gap_report',

  // ---------------------------------------------------------------------------
  // Strategy Documents (Phase: Decide)
  // ---------------------------------------------------------------------------
  /** Strategy summary document */
  StrategyDoc = 'strategy_doc',
  /** Strategy brief/presentation */
  StrategyBrief = 'strategy_brief',
  /** Acquisition plan summary */
  AcquisitionPlanSummary = 'acquisition_plan_summary',
  /** Execution playbook */
  ExecutionPlaybook = 'execution_playbook',
  /** Experiment roadmap */
  ExperimentRoadmap = 'experiment_roadmap',
  /** Channel analysis */
  ChannelAnalysis = 'channel_analysis',
  /** Competitive positioning */
  CompetitivePositioning = 'competitive_positioning',

  // ---------------------------------------------------------------------------
  // Proposal/RFP Documents (Phase: Deliver)
  // ---------------------------------------------------------------------------
  /** RFP response document */
  RfpResponse = 'rfp_response',
  /** Proposal slides/presentation */
  ProposalSlides = 'proposal_slides',
  /** Pricing sheet */
  PricingSheet = 'pricing_sheet',
  /** SOW/Timeline document */
  TimelineDoc = 'timeline_doc',

  // ---------------------------------------------------------------------------
  // Brief Documents (Phase: Deliver)
  // ---------------------------------------------------------------------------
  /** Content brief */
  ContentBrief = 'content_brief',
  /** Creative brief */
  CreativeBrief = 'creative_brief',
  /** Media brief */
  MediaBrief = 'media_brief',
  /** Campaign brief */
  CampaignBrief = 'campaign_brief',
  /** SEO brief */
  SeoBrief = 'seo_brief',
  /** Media plan spreadsheet */
  MediaPlan = 'media_plan',

  // ---------------------------------------------------------------------------
  // Reporting Documents (Phase: Report)
  // ---------------------------------------------------------------------------
  /** QBR slides/presentation */
  QbrSlides = 'qbr_slides',
  /** QBR report document */
  QbrReport = 'qbr_report',
  /** Stakeholder summary */
  StakeholderSummary = 'stakeholder_summary',

  // ---------------------------------------------------------------------------
  // Legal Documents (Phase: Legal)
  // ---------------------------------------------------------------------------
  /** Master services agreement */
  ContractMsa = 'contract_msa',
  /** Statement of work */
  ContractSow = 'contract_sow',
  /** NDA */
  ContractNda = 'contract_nda',
  /** Other legal document */
  ContractOther = 'contract_other',

  // ---------------------------------------------------------------------------
  // Work Outputs (Phase: Work)
  // ---------------------------------------------------------------------------
  /** Deliverable from completed work item */
  WorkDeliverable = 'work_deliverable',
  /** Work item attachment */
  WorkAttachment = 'work_attachment',

  // ---------------------------------------------------------------------------
  // Generic
  // ---------------------------------------------------------------------------
  /** Custom/other document */
  Custom = 'custom',
}

// ============================================================================
// ArtifactSource - How/where the artifact was created
// ============================================================================

/**
 * Canonical sources of artifact creation.
 * Determines traceability and update behavior.
 */
export enum ArtifactSource {
  // Lab/Diagnostic runs
  /** From Website Lab diagnostic run */
  DiagnosticWebsiteLab = 'diagnostic_website_lab',
  /** From Brand Lab diagnostic run */
  DiagnosticBrandLab = 'diagnostic_brand_lab',
  /** From Competition Lab diagnostic run */
  DiagnosticCompetitionLab = 'diagnostic_competition_lab',
  /** From GAP analysis run */
  DiagnosticGap = 'diagnostic_gap',
  /** From any other lab run */
  DiagnosticOther = 'diagnostic_other',

  // Strategy outputs
  /** From strategy handoff/completion */
  StrategyHandoff = 'strategy_handoff',
  /** From strategy export */
  StrategyExport = 'strategy_export',

  // RFP/Proposal workflow
  /** From RFP workflow */
  RfpExport = 'rfp_export',
  /** From proposal workflow */
  ProposalExport = 'proposal_export',

  // QBR workflow
  /** From QBR story export */
  QbrExport = 'qbr_export',

  // Brief exports
  /** From brief export */
  BriefExport = 'brief_export',
  /** From media plan export */
  MediaPlanExport = 'media_plan_export',

  // AI/Generation
  /** Created by AI artifact generator */
  AiGenerated = 'ai_generated',

  // Work outputs
  /** Created from work item output */
  WorkOutput = 'work_output',
  /** Attached to work item */
  WorkAttachment = 'work_attachment',

  // Manual
  /** Manually created by user */
  Manual = 'manual',
  /** Uploaded by user */
  Upload = 'upload',
  /** Instantiated from template */
  Template = 'template',

  // External
  /** Imported from external system */
  Import = 'import',
}

// ============================================================================
// ArtifactStorage - Where artifact content is stored
// ============================================================================

/**
 * Canonical storage locations for artifact content.
 */
export enum ArtifactStorage {
  /** Stored in Airtable rawData field (JSON) */
  Internal = 'internal',
  /** Stored in Google Drive (Docs/Sheets/Slides) */
  GoogleDrive = 'googleDrive',
  /** Stored in Airtable table record */
  Airtable = 'airtable',
  /** Both internal and Google Drive */
  Hybrid = 'hybrid',
  /** External URL reference */
  External = 'external',
}

// ============================================================================
// ArtifactStatus - Lifecycle status
// ============================================================================

/**
 * Canonical artifact lifecycle statuses.
 * Transitions: draft → final → archived
 */
export enum ArtifactStatus {
  /** Being edited, not yet shared */
  Draft = 'draft',
  /** Finalized and shared (immutable) */
  Final = 'final',
  /** No longer active */
  Archived = 'archived',
  /** Content is out of date */
  Stale = 'stale',
  /** Superseded by newer version */
  Superseded = 'superseded',
}

// ============================================================================
// ArtifactProvenance - Who created/edited the artifact
// ============================================================================

/**
 * Canonical provenance tracking for artifact authorship.
 * Indicates whether content is AI-generated, human-authored, or mixed.
 */
export enum ArtifactProvenance {
  /** Fully AI-generated, no human edits */
  AI = 'ai',
  /** Human-authored (manual creation or upload) */
  Human = 'human',
  /** AI-generated with human edits/review */
  Mixed = 'mixed',
}

// ============================================================================
// ArtifactFileType - File format for display
// ============================================================================

/**
 * File type for icon and rendering decisions.
 */
export enum ArtifactFileType {
  Doc = 'doc',
  Slides = 'slides',
  Sheet = 'sheet',
  Json = 'json',
  Pdf = 'pdf',
  Image = 'image',
  Video = 'video',
  Other = 'other',
}

// ============================================================================
// ArtifactVisibility - Where artifact appears in UI
// ============================================================================

/**
 * Controls where artifact appears in the application UI.
 *
 * CRITICAL: Opening a document from Documents library should NOT
 * create new nav items or pollute the company navigation.
 *
 * - documents_only: Artifact appears in Documents library only (default for lab reports)
 * - nav_visible: Artifact appears in company nav sidebar (e.g., pinned strategy docs)
 * - hidden: Artifact is hidden from both (archived, internal)
 */
export enum ArtifactVisibility {
  /** Appears in Documents library only - opening does NOT create nav items */
  DocumentsOnly = 'documents_only',
  /** Appears in company nav sidebar (pinned/primary artifacts) */
  NavVisible = 'nav_visible',
  /** Hidden from all UI surfaces (archived or internal) */
  Hidden = 'hidden',
}

/**
 * Get default visibility for artifact type.
 * Lab reports default to documents_only.
 * Strategy docs default to nav_visible.
 */
export function getDefaultVisibility(type: ArtifactType): ArtifactVisibility {
  // Strategy docs may appear in nav
  if (
    type === ArtifactType.StrategyDoc ||
    type === ArtifactType.StrategyBrief
  ) {
    return ArtifactVisibility.NavVisible;
  }

  // Lab reports are documents_only (never nav items)
  if (type.startsWith('lab_report_') || type === ArtifactType.GapReport) {
    return ArtifactVisibility.DocumentsOnly;
  }

  // Default to documents_only
  return ArtifactVisibility.DocumentsOnly;
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map ArtifactType to its canonical phase
 */
export function getPhaseForArtifactType(type: ArtifactType): ArtifactPhase {
  // Lab reports → Discover
  if (type.startsWith('lab_report_') || type === ArtifactType.GapReport) {
    return ArtifactPhase.Discover;
  }

  // Strategy docs → Decide
  if (
    type === ArtifactType.StrategyDoc ||
    type === ArtifactType.StrategyBrief ||
    type === ArtifactType.AcquisitionPlanSummary ||
    type === ArtifactType.ExecutionPlaybook ||
    type === ArtifactType.ExperimentRoadmap ||
    type === ArtifactType.ChannelAnalysis ||
    type === ArtifactType.CompetitivePositioning
  ) {
    return ArtifactPhase.Decide;
  }

  // RFP/Proposal/Briefs → Deliver
  if (
    type === ArtifactType.RfpResponse ||
    type === ArtifactType.ProposalSlides ||
    type === ArtifactType.PricingSheet ||
    type === ArtifactType.TimelineDoc ||
    type === ArtifactType.ContentBrief ||
    type === ArtifactType.CreativeBrief ||
    type === ArtifactType.MediaBrief ||
    type === ArtifactType.CampaignBrief ||
    type === ArtifactType.SeoBrief ||
    type === ArtifactType.MediaPlan
  ) {
    return ArtifactPhase.Deliver;
  }

  // Reporting → Report
  if (
    type === ArtifactType.QbrSlides ||
    type === ArtifactType.QbrReport ||
    type === ArtifactType.StakeholderSummary
  ) {
    return ArtifactPhase.Report;
  }

  // Contracts → Legal
  if (type.startsWith('contract_')) {
    return ArtifactPhase.Legal;
  }

  // Work outputs → Work
  if (type === ArtifactType.WorkDeliverable || type === ArtifactType.WorkAttachment) {
    return ArtifactPhase.Work;
  }

  // Custom → Other
  if (type === ArtifactType.Custom) {
    return ArtifactPhase.Other;
  }

  // Default
  return ArtifactPhase.Deliver;
}

/**
 * Map ArtifactType to file type for icons
 */
export function getFileTypeForArtifactType(type: ArtifactType): ArtifactFileType {
  // Lab/GAP reports are JSON
  if (type.startsWith('lab_report_') || type === ArtifactType.GapReport) {
    return ArtifactFileType.Json;
  }

  // Slides
  if (
    type === ArtifactType.QbrSlides ||
    type === ArtifactType.ProposalSlides ||
    type === ArtifactType.StrategyBrief
  ) {
    return ArtifactFileType.Slides;
  }

  // Sheets
  if (type === ArtifactType.MediaPlan || type === ArtifactType.PricingSheet) {
    return ArtifactFileType.Sheet;
  }

  // Everything else is a doc
  return ArtifactFileType.Doc;
}

/**
 * Map diagnostic tool ID to artifact type
 */
export function getArtifactTypeForDiagnostic(toolId: string): ArtifactType {
  switch (toolId) {
    case 'websiteLab':
    case 'websiteLabV5':
      return ArtifactType.LabReportWebsite;
    case 'brandLab':
      return ArtifactType.LabReportBrand;
    case 'competitionLab':
      return ArtifactType.LabReportCompetitor;
    case 'seoLab':
      return ArtifactType.LabReportSeo;
    case 'contentLab':
      return ArtifactType.LabReportContent;
    case 'demandLab':
      return ArtifactType.LabReportDemand;
    case 'opsLab':
      return ArtifactType.LabReportOps;
    case 'creativeLab':
      return ArtifactType.LabReportCreative;
    case 'audienceLab':
      return ArtifactType.LabReportAudience;
    case 'mediaLab':
      return ArtifactType.LabReportMedia;
    case 'gapPlan':
    case 'gapSnapshot':
      return ArtifactType.GapReport;
    default:
      return ArtifactType.Custom;
  }
}

/**
 * Map diagnostic tool ID to artifact source
 */
export function getSourceForDiagnostic(toolId: string): ArtifactSource {
  switch (toolId) {
    case 'websiteLab':
    case 'websiteLabV5':
      return ArtifactSource.DiagnosticWebsiteLab;
    case 'brandLab':
      return ArtifactSource.DiagnosticBrandLab;
    case 'competitionLab':
      return ArtifactSource.DiagnosticCompetitionLab;
    case 'gapPlan':
    case 'gapSnapshot':
      return ArtifactSource.DiagnosticGap;
    default:
      return ArtifactSource.DiagnosticOther;
  }
}

/**
 * Get human-readable label for artifact type
 */
export function getArtifactTypeLabel(type: ArtifactType): string {
  const labels: Record<ArtifactType, string> = {
    [ArtifactType.LabReportWebsite]: 'Website Lab Report',
    [ArtifactType.LabReportBrand]: 'Brand Lab Report',
    [ArtifactType.LabReportSeo]: 'SEO Lab Report',
    [ArtifactType.LabReportContent]: 'Content Lab Report',
    [ArtifactType.LabReportDemand]: 'Demand Lab Report',
    [ArtifactType.LabReportOps]: 'Ops Lab Report',
    [ArtifactType.LabReportCreative]: 'Creative Lab Report',
    [ArtifactType.LabReportCompetitor]: 'Competition Lab Report',
    [ArtifactType.LabReportAudience]: 'Audience Lab Report',
    [ArtifactType.LabReportMedia]: 'Media Lab Report',
    [ArtifactType.GapReport]: 'GAP Analysis',
    [ArtifactType.StrategyDoc]: 'Strategy Document',
    [ArtifactType.StrategyBrief]: 'Strategy Brief',
    [ArtifactType.AcquisitionPlanSummary]: 'Acquisition Plan',
    [ArtifactType.ExecutionPlaybook]: 'Execution Playbook',
    [ArtifactType.ExperimentRoadmap]: 'Experiment Roadmap',
    [ArtifactType.ChannelAnalysis]: 'Channel Analysis',
    [ArtifactType.CompetitivePositioning]: 'Competitive Positioning',
    [ArtifactType.RfpResponse]: 'RFP Response',
    [ArtifactType.ProposalSlides]: 'Proposal Slides',
    [ArtifactType.PricingSheet]: 'Pricing Sheet',
    [ArtifactType.TimelineDoc]: 'Timeline/SOW',
    [ArtifactType.ContentBrief]: 'Content Brief',
    [ArtifactType.CreativeBrief]: 'Creative Brief',
    [ArtifactType.MediaBrief]: 'Media Brief',
    [ArtifactType.CampaignBrief]: 'Campaign Brief',
    [ArtifactType.SeoBrief]: 'SEO Brief',
    [ArtifactType.MediaPlan]: 'Media Plan',
    [ArtifactType.QbrSlides]: 'QBR Slides',
    [ArtifactType.QbrReport]: 'QBR Report',
    [ArtifactType.StakeholderSummary]: 'Stakeholder Summary',
    [ArtifactType.ContractMsa]: 'MSA',
    [ArtifactType.ContractSow]: 'Statement of Work',
    [ArtifactType.ContractNda]: 'NDA',
    [ArtifactType.ContractOther]: 'Contract',
    [ArtifactType.WorkDeliverable]: 'Deliverable',
    [ArtifactType.WorkAttachment]: 'Attachment',
    [ArtifactType.Custom]: 'Document',
  };
  return labels[type] || 'Document';
}

/**
 * Get human-readable label for artifact phase
 */
export function getPhaseLabel(phase: ArtifactPhase): string {
  const labels: Record<ArtifactPhase, string> = {
    [ArtifactPhase.Discover]: 'Discover',
    [ArtifactPhase.Decide]: 'Decide',
    [ArtifactPhase.Deliver]: 'Deliver',
    [ArtifactPhase.Work]: 'Work',
    [ArtifactPhase.Report]: 'Report',
    [ArtifactPhase.Legal]: 'Legal',
    [ArtifactPhase.Other]: 'Other',
  };
  return labels[phase];
}

/**
 * Get human-readable label for artifact status
 */
export function getStatusLabel(status: ArtifactStatus): string {
  const labels: Record<ArtifactStatus, string> = {
    [ArtifactStatus.Draft]: 'Draft',
    [ArtifactStatus.Final]: 'Final',
    [ArtifactStatus.Archived]: 'Archived',
    [ArtifactStatus.Stale]: 'Needs Update',
    [ArtifactStatus.Superseded]: 'Superseded',
  };
  return labels[status];
}

/**
 * Get human-readable label for artifact provenance
 */
export function getProvenanceLabel(provenance: ArtifactProvenance): string {
  const labels: Record<ArtifactProvenance, string> = {
    [ArtifactProvenance.AI]: 'AI Generated',
    [ArtifactProvenance.Human]: 'Human',
    [ArtifactProvenance.Mixed]: 'AI + Human',
  };
  return labels[provenance];
}

/**
 * Get human-readable label for artifact source
 */
export function getSourceLabel(source: ArtifactSource): string {
  const labels: Record<ArtifactSource, string> = {
    [ArtifactSource.DiagnosticWebsiteLab]: 'Website Lab',
    [ArtifactSource.DiagnosticBrandLab]: 'Brand Lab',
    [ArtifactSource.DiagnosticCompetitionLab]: 'Competition Lab',
    [ArtifactSource.DiagnosticGap]: 'GAP Analysis',
    [ArtifactSource.DiagnosticOther]: 'Diagnostic',
    [ArtifactSource.StrategyHandoff]: 'Strategy Handoff',
    [ArtifactSource.StrategyExport]: 'Strategy Export',
    [ArtifactSource.RfpExport]: 'RFP Export',
    [ArtifactSource.ProposalExport]: 'Proposal Export',
    [ArtifactSource.QbrExport]: 'QBR Export',
    [ArtifactSource.BriefExport]: 'Brief Export',
    [ArtifactSource.MediaPlanExport]: 'Media Plan Export',
    [ArtifactSource.AiGenerated]: 'AI Generated',
    [ArtifactSource.WorkOutput]: 'Work Output',
    [ArtifactSource.WorkAttachment]: 'Work Attachment',
    [ArtifactSource.Manual]: 'Manual',
    [ArtifactSource.Upload]: 'Upload',
    [ArtifactSource.Template]: 'Template',
    [ArtifactSource.Import]: 'Import',
  };
  return labels[source];
}

// ============================================================================
// Validation Guards
// ============================================================================

/**
 * Validate that all required index fields are present.
 * Throws if any required field is missing.
 */
export function validateIndexInput(input: {
  phase?: ArtifactPhase;
  artifactType?: ArtifactType;
  source?: ArtifactSource;
  storage?: ArtifactStorage;
  groupKey?: string;
}): void {
  const missing: string[] = [];

  if (!input.phase) missing.push('phase');
  if (!input.artifactType) missing.push('artifactType');
  if (!input.source) missing.push('source');
  if (!input.storage) missing.push('storage');
  if (!input.groupKey) missing.push('groupKey');

  if (missing.length > 0) {
    throw new Error(
      `[ArtifactTaxonomy] Missing required fields for artifact indexing: ${missing.join(', ')}`
    );
  }
}

/**
 * Check if a value is a valid ArtifactPhase
 */
export function isValidPhase(value: string): value is ArtifactPhase {
  return Object.values(ArtifactPhase).includes(value as ArtifactPhase);
}

/**
 * Check if a value is a valid ArtifactType
 */
export function isValidArtifactType(value: string): value is ArtifactType {
  return Object.values(ArtifactType).includes(value as ArtifactType);
}

/**
 * Check if a value is a valid ArtifactSource
 */
export function isValidSource(value: string): value is ArtifactSource {
  return Object.values(ArtifactSource).includes(value as ArtifactSource);
}

/**
 * Check if a value is a valid ArtifactStorage
 */
export function isValidStorage(value: string): value is ArtifactStorage {
  return Object.values(ArtifactStorage).includes(value as ArtifactStorage);
}

/**
 * Check if a value is a valid ArtifactStatus
 */
export function isValidStatus(value: string): value is ArtifactStatus {
  return Object.values(ArtifactStatus).includes(value as ArtifactStatus);
}

// ============================================================================
// Group Key Generation
// ============================================================================

/**
 * Generate a canonical group key for an artifact.
 * Format depends on artifact type:
 * - Diagnostics: {toolId}-{runId}
 * - Strategy: strategy-{strategyId}
 * - RFP: rfp-{rfpId}
 * - QBR: qbr-{qbrId}
 * - Other: {type}-{date}
 */
export function generateGroupKey(options: {
  artifactType: ArtifactType;
  sourceId?: string;
  runId?: string;
  date?: Date;
}): string {
  const { artifactType, sourceId, runId, date = new Date() } = options;

  // Diagnostic reports use runId
  if (artifactType.startsWith('lab_report_') || artifactType === ArtifactType.GapReport) {
    if (runId) return `diagnostic-${runId}`;
    return `diagnostic-${date.toISOString().split('T')[0].replace(/-/g, '')}`;
  }

  // Strategy documents use strategyId
  if (
    artifactType === ArtifactType.StrategyDoc ||
    artifactType === ArtifactType.StrategyBrief
  ) {
    if (sourceId) return `strategy-${sourceId}`;
    return `strategy-${date.toISOString().split('T')[0].replace(/-/g, '')}`;
  }

  // RFP/Proposal documents use rfpId
  if (
    artifactType === ArtifactType.RfpResponse ||
    artifactType === ArtifactType.ProposalSlides
  ) {
    if (sourceId) return `rfp-${sourceId}`;
    return `rfp-${date.toISOString().split('T')[0].replace(/-/g, '')}`;
  }

  // QBR documents use qbrId
  if (artifactType === ArtifactType.QbrSlides || artifactType === ArtifactType.QbrReport) {
    if (sourceId) return `qbr-${sourceId}`;
    return `qbr-${date.toISOString().split('T')[0].replace(/-/g, '')}`;
  }

  // Default: type + date
  if (sourceId) return `${artifactType}-${sourceId}`;
  return `${artifactType}-${date.toISOString().split('T')[0].replace(/-/g, '')}`;
}
