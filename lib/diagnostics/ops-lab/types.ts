// lib/diagnostics/ops-lab/types.ts
// Ops Lab Diagnostic Output Types
//
// These types define the structure of Ops Lab diagnostic results that flow through:
// - Diagnostic runs
// - UI reports
// - Work item creation
// - Brain / Blueprint integration

// ============================================================================
// Maturity Stages
// ============================================================================

/**
 * Operations maturity stages
 * - unproven: No clear ops infrastructure, ad-hoc measurement
 * - emerging: Basic tracking, some tools in place, gaps across stack
 * - scaling: Strong ops foundations, integrated systems, optimization underway
 * - established: Robust, integrated marketing ops stack, experimentation culture
 */
export type OpsMaturityStage = 'unproven' | 'emerging' | 'scaling' | 'established';

// ============================================================================
// Dimension Keys & Status
// ============================================================================

export type OpsDimensionKey =
  | 'tracking'
  | 'data'
  | 'crm'
  | 'automation'
  | 'experimentation';

export type OpsDimensionStatus = 'weak' | 'moderate' | 'strong' | 'not_evaluated';

// ============================================================================
// Issues
// ============================================================================

export type OpsIssueSeverity = 'low' | 'medium' | 'high';

export interface OpsLabIssue {
  id: string;
  category: OpsDimensionKey;
  severity: OpsIssueSeverity;
  title: string;
  description: string;
}

// ============================================================================
// Dimensions
// ============================================================================

export interface OpsDimensionEvidence {
  /** What was found (positive signals) */
  found: string[];
  /** What was missing or problematic */
  missing: string[];
  /** Specific data points or metrics */
  dataPoints: Record<string, string | number | boolean>;
}

export interface OpsLabDimension {
  key: OpsDimensionKey;
  label: string;
  score: number | null;
  status: OpsDimensionStatus;
  summary: string;
  issues: OpsLabIssue[];
  evidence: OpsDimensionEvidence;
}

// ============================================================================
// Quick Wins
// ============================================================================

export interface OpsLabQuickWin {
  id: string;
  category: string;
  action: string;
  expectedImpact: 'low' | 'medium' | 'high';
  effortLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Projects
// ============================================================================

export interface OpsLabProject {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timeHorizon: 'near-term' | 'mid-term' | 'long-term';
}

// ============================================================================
// Analytics Snapshot
// ============================================================================

export interface OpsLabAnalyticsSnapshot {
  /** Tracking stack detected (e.g. ['GA4', 'GTM', 'Facebook Pixel']) */
  trackingStack: string[];

  /** Has Google Analytics 4 */
  hasGa4: boolean;

  /** Has Google Search Console (via workspace integration) */
  hasGsc?: boolean;

  /** Has Google Tag Manager */
  hasGtm: boolean;

  /** Has Facebook Pixel */
  hasFacebookPixel: boolean;

  /** Has LinkedIn Insight Tag */
  hasLinkedinInsight: boolean;

  /** Has CRM detected */
  hasCrm: boolean;

  /** Has marketing automation platform */
  hasAutomationPlatform: boolean;

  /** Event volume in last 30 days (if available) */
  eventVolumeLast30d?: number | null;

  /** UTM usage level */
  utmUsageLevel?: 'none' | 'basic' | 'consistent' | null;
}

// ============================================================================
// Findings
// ============================================================================

export interface OpsLabFindings {
  /** Tracking tools detected */
  trackingDetected: {
    tools: string[];
    notes: string[];
  };

  /** CRM signals */
  crmSignals: {
    tools: string[];
    notes: string[];
  };

  /** Automation signals */
  automationSignals: {
    tools: string[];
    notes: string[];
  };

  /** Process signals */
  processSignals: {
    notes: string[];
  };
}

// ============================================================================
// Data Confidence
// ============================================================================

export type OpsDataConfidenceLevel = 'low' | 'medium' | 'high';

export interface OpsDataConfidence {
  score: number; // 0-100
  level: OpsDataConfidenceLevel;
  reason: string;
}

// ============================================================================
// Main Result Type
// ============================================================================

export interface OpsLabResult {
  /** Company ID */
  companyId: string;

  /** Company type for context */
  companyType?: string | null;

  /** Website URL analyzed */
  url: string;

  /** Overall ops readiness score (0-100) */
  overallScore: number;

  /** Maturity stage assessment */
  maturityStage: OpsMaturityStage;

  /** Data confidence assessment */
  dataConfidence: OpsDataConfidence;

  /** Narrative summary (2-3 sentences from strategist perspective) */
  narrativeSummary: string;

  /** Dimension scores and analysis */
  dimensions: OpsLabDimension[];

  /** All issues found */
  issues: OpsLabIssue[];

  /** Quick wins (high impact, low effort) */
  quickWins: OpsLabQuickWin[];

  /** Strategic projects */
  projects: OpsLabProject[];

  /** Analytics snapshot with detected tools */
  analyticsSnapshot: OpsLabAnalyticsSnapshot;

  /** Detailed findings from the analysis */
  findings: OpsLabFindings;

  /** Timestamp */
  generatedAt: string;
}

// ============================================================================
// Engine Result Wrapper
// ============================================================================

export interface OpsLabEngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  report?: OpsLabResult;
  error?: string;
}

// ============================================================================
// Analyzer Input/Output Types
// ============================================================================

export interface OpsLabAnalyzerInput {
  companyId?: string;
  url: string;
  companyType?: string | null;
  workspaceId?: string;
  // Raw HTML summary from existing crawl
  htmlSummary?: any;
  // Analytics data if available
  analyticsSummary?: any;
  // Tech stack signals from existing detection
  techStackSignals?: any;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status from score
 */
export function getStatusFromScore(score: number | null): OpsDimensionStatus {
  if (score === null) return 'not_evaluated';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

/**
 * Get maturity stage from overall score
 */
export function getMaturityFromScore(score: number): OpsMaturityStage {
  if (score >= 80) return 'established';
  if (score >= 60) return 'scaling';
  if (score >= 35) return 'emerging';
  return 'unproven';
}

/**
 * Get human-readable label for maturity stage
 */
export function getMaturityStageLabel(stage: OpsMaturityStage): string {
  const labels: Record<OpsMaturityStage, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };
  return labels[stage] || stage;
}

/**
 * Get description for maturity stage
 */
export function getMaturityStageDescription(stage: OpsMaturityStage): string {
  const descriptions: Record<OpsMaturityStage, string> = {
    unproven: 'Foundational ops, limited measurement.',
    emerging: 'Some systems in place, gaps across stack.',
    scaling: 'Strong ops foundations with a few key gaps.',
    established: 'Robust, integrated marketing ops stack.',
  };
  return descriptions[stage] || '';
}

/**
 * Get color class for maturity stage
 */
export function getMaturityStageColor(stage: OpsMaturityStage): string {
  const colors: Record<OpsMaturityStage, string> = {
    unproven: 'text-red-400',
    emerging: 'text-amber-400',
    scaling: 'text-cyan-400',
    established: 'text-emerald-400',
  };
  return colors[stage] || 'text-slate-400';
}

/**
 * Get color class for dimension status
 */
export function getDimensionStatusColor(status: OpsDimensionStatus): string {
  const colors: Record<OpsDimensionStatus, string> = {
    weak: 'text-red-400',
    moderate: 'text-amber-400',
    strong: 'text-emerald-400',
    not_evaluated: 'text-slate-400',
  };
  return colors[status] || 'text-slate-400';
}

/**
 * Get color class for data confidence level
 */
export function getDataConfidenceColor(level: OpsDataConfidenceLevel): string {
  const colors: Record<OpsDataConfidenceLevel, string> = {
    low: 'text-amber-400',
    medium: 'text-cyan-400',
    high: 'text-emerald-400',
  };
  return colors[level] || 'text-slate-400';
}

/**
 * Get dimension label from key
 */
export function getDimensionLabel(key: OpsDimensionKey): string {
  const labels: Record<OpsDimensionKey, string> = {
    tracking: 'Tracking & Instrumentation',
    data: 'Data Quality & Governance',
    crm: 'CRM & Pipeline Hygiene',
    automation: 'Automation & Journeys',
    experimentation: 'Experimentation & Optimization',
  };
  return labels[key] || key;
}

/**
 * Generate a unique ID for an issue
 */
export function generateIssueId(category: OpsDimensionKey, index: number): string {
  return `ops-${category}-${index}-${Date.now().toString(36)}`;
}

/**
 * Dimension weights for overall score calculation
 */
export const DIMENSION_WEIGHTS: Record<OpsDimensionKey, number> = {
  tracking: 0.25,      // 25%
  data: 0.20,          // 20%
  crm: 0.20,           // 20%
  automation: 0.20,    // 20%
  experimentation: 0.15, // 15%
};
