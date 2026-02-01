// lib/airtable/tables.ts
// Central Airtable table name constants

/**
 * Canonical Airtable table names for the Hive OS / GAP Engine system
 */
export const AIRTABLE_TABLES = {
  // GAP System Tables
  GAP_IA_RUN: 'GAP-IA Run', // Initial Assessment Run (lead magnet)
  GAP_PLAN_RUN: 'GAP-Plan Run', // Execution run of the full GAP engine
  GAP_FULL_REPORT: 'GAP-Full Report', // Final structured GAP report
  GAP_HEAVY_RUN: 'GAP-Heavy Run', // Background worker runs

  // OS System Tables
  COMPANIES: 'Companies',
  WORK_ITEMS: 'Work Items',
  COMPANY_AI_CONTEXT: 'Company AI Context', // Client Brain - AI memory per company
  DIAGNOSTIC_RUNS: 'Diagnostic Runs', // Tool runs for diagnostics suite

  // Client Brain Tables
  CLIENT_INSIGHTS: 'Client Insights', // Strategic insights per company
  CLIENT_DOCUMENTS: 'Client Documents', // Uploaded documents per company
  COMPANY_STRATEGY_SNAPSHOTS: 'Company Strategy Snapshots', // Strategic snapshot per company

  // Workspace Settings
  WORKSPACE_SETTINGS: 'WorkspaceSettings', // OAuth tokens and workspace config

  // Media System Tables
  MEDIA_PROGRAMS: 'Media Programs',
  MEDIA_CAMPAIGNS: 'Media Campaigns',
  MEDIA_MARKETS: 'Media Markets',
  MEDIA_STORES: 'Media Stores',
  MEDIA_PERFORMANCE: 'Media Performance',

  // Media Lab Tables (Strategic Planning)
  MEDIA_PLANS: 'MediaPlans',
  MEDIA_PLAN_CHANNELS: 'MediaPlanChannels',
  MEDIA_PLAN_FLIGHTS: 'MediaPlanFlights',
  MEDIA_SCENARIOS: 'MediaScenarios',
  MEDIA_PROFILES: 'MediaProfiles', // Company-specific media configuration

  // Context Graph
  CONTEXT_GRAPHS: 'ContextGraphs', // Company Context Graph storage (JSON blobs)
  CONTEXT_GRAPH_VERSIONS: 'ContextGraphVersions', // Version history of context graphs
  CONTEXT_FIELDS_V4: 'ContextFieldsV4', // V4: First-class field records with status

  // Company Context (Draftable Resource)
  COMPANY_CONTEXT: 'Company Context', // Saved company context
  COMPANY_CONTEXT_DRAFTS: 'Company Context Drafts', // AI-generated context drafts

  // QBR Stories
  QBR_STORIES: 'QBR Stories', // QBR Story narratives (JSON blobs)

  // Audience Lab
  AUDIENCE_MODELS: 'AudienceModels', // Audience Model storage (JSON blobs)
  AUDIENCE_PERSONAS: 'AudiencePersonas', // Persona sets storage (JSON blobs)

  // Competition Lab
  COMPETITION_RUNS: 'Competition Runs', // Competition Lab run results (JSON blobs)

  // Programs
  PROGRAMS: 'Programs', // Program plans (website, content, media - MVP: website only)
  PLANNING_PROGRAMS: 'PlanningPrograms', // Strategy→Deliver→Work planning units (from tactics)

  // Context Proposals (AI-First Context)
  CONTEXT_PROPOSALS: 'ContextProposals', // AI-generated proposals awaiting confirmation

  // Strategy System Tables
  COMPANY_STRATEGIES: 'Company Strategies', // Strategy records
  STRATEGY_DRAFTS: 'StrategyDrafts', // AI-generated strategy field drafts awaiting confirmation
  STRATEGY_COMPARISONS: 'StrategyComparisons', // Strategy comparison artifacts
  PROGRAM_HANDOFF_DRAFTS: 'ProgramHandoffDrafts', // AI-generated program drafts from strategy handoff
  STRATEGY_REVISION_PROPOSALS: 'StrategyRevisionProposals', // Guided revision proposals from outcome signals
  STRATEGY_VERSIONS: 'StrategyVersions', // Versioned snapshots of strategy state
  STRATEGY_EVOLUTION_EVENTS: 'StrategyEvolutionEvents', // Append-only evolution history
  OUTCOME_SIGNALS: 'OutcomeSignals', // Persisted outcome signals from artifacts/work

  // Engagement System Tables
  COMPANY_ENGAGEMENTS: 'Engagements', // Engagement records (strategy vs project paths)

  // Project System Tables (Project-Scoped Strategy → Brief)
  PROJECTS: 'Projects', // Project entities within engagements
  PROJECT_STRATEGIES: 'ProjectStrategies', // Project-scoped strategy (collapses into brief)
  CREATIVE_REVIEW_SETS: 'Creative Review Sets', // One per (Project, Tactic, Set Name); stores Drive folder ID/URL

  // Canonical Brief System
  BRIEFS: 'Briefs', // Canonical briefs - single source of truth for all work

  // Workspace Artifacts (Google Drive integration)
  ARTIFACTS: 'Artifacts', // First-class artifacts linked to Google Drive/Docs/Slides
  ARTIFACT_INDEX: 'ArtifactIndex', // Canonical index of ALL company artifacts for Documents UI

  // Heavy Plans (structured planning objects - Decide → Deliver → Work bridge)
  HEAVY_MEDIA_PLANS: 'HeavyMediaPlans', // Heavy Media Plan entities
  HEAVY_CONTENT_PLANS: 'HeavyContentPlans', // Heavy Content Plan entities
  PLAN_PROPOSALS: 'PlanProposals', // AI-generated plan update proposals

  // Firm Brain Tables (Settings - Agency-wide knowledge)
  AGENCY_PROFILE: 'AgencyProfile', // Single record - agency overview, differentiators, services
  TEAM_MEMBERS: 'TeamMembers', // Agency team members for RFP proposals
  CASE_STUDIES: 'CaseStudies', // Portfolio work samples
  REFERENCES: 'References', // Client references with permission tracking
  PRICING_TEMPLATES: 'PricingTemplates', // Reusable pricing structures
  PLAN_TEMPLATES: 'PlanTemplates', // Reusable project plan structures

  // RFP System Tables (Deliver - Heavy RFP workflow)
  RFPS: 'RFPs', // RFP entities linked to companies
  RFP_SECTIONS: 'RfpSections', // Individual RFP sections (agency_overview, approach, team, etc.)
  RFP_BINDINGS: 'RfpBindings', // Links between RFPs and Firm Brain entities

  // Proposal System Tables (Deliver - converted from RFPs)
  PROPOSALS: 'Proposals', // Proposal entities (converted from RFPs or created fresh)
  PROPOSAL_SECTIONS: 'ProposalSections', // Individual proposal sections

  // Section Library (Reusable content - V3)
  SECTION_LIBRARY: 'SectionLibrary', // Reusable sections (company-scoped + global)

  // Jobs System Tables
  JOBS: 'Jobs', // Jobs with Drive folder provisioning
  COUNTERS: 'Counters', // Global sequence counters (job numbering, etc.)
  TEMPLATES: 'Templates', // Document templates (SOW, Brief, Timeline, MSA)
  TEMPLATE_PACKS: 'TemplatePacks', // Template bundles for quick provisioning
  JOB_DOCUMENTS: 'JobDocuments', // Documents created from templates per job

  // Legacy (use BRIEFS instead)
  CREATIVE_BRIEFS: 'CreativeBriefs', // Deprecated - use BRIEFS

  // Legacy/deprecated (for migration reference)
  // GAP_RUNS_OLD: 'GAP Runs',
  // FULL_REPORTS_OLD: 'Full Reports',
} as const;

/**
 * Get table name from environment variable or use default
 */
export function getTableName(
  key: keyof typeof AIRTABLE_TABLES,
  envVar?: string
): string {
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }
  return AIRTABLE_TABLES[key];
}
