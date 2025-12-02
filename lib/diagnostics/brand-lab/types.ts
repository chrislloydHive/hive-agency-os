// lib/diagnostics/brand-lab/types.ts
// Brand Lab V2 Diagnostic Output Types
//
// These types define the structure of Brand Lab V2 diagnostic results that flow through:
// - Diagnostic runs
// - UI reports
// - Work item creation
// - Brain / Blueprint integration
//
// Brand Lab V2 follows the same pattern as SEO Lab and Content Lab:
// - overallScore, maturityStage, dataConfidence
// - dimensions[] with scores, issues, evidence
// - issues[], quickWins[], projects[]
// - findings for raw extracted signals

// ============================================================================
// Maturity Stages
// ============================================================================

/**
 * Brand maturity stages
 * - unproven: Unclear identity, weak positioning, minimal trust signals
 * - emerging: Some brand elements present, but gaps in clarity or consistency
 * - scaling: Solid brand foundation with room for differentiation
 * - established: Clear, consistent, differentiated brand with strong trust
 */
export type BrandMaturityStage = 'unproven' | 'emerging' | 'scaling' | 'established';

// ============================================================================
// Dimension Keys
// ============================================================================

/**
 * Brand Lab V2 dimension keys - 8 dimensions covering brand health
 */
export type BrandDimensionKey =
  | 'identity'      // Identity & Promise
  | 'messaging'     // Messaging & Value Props
  | 'positioning'   // Positioning & Differentiation
  | 'audienceFit'   // Audience Fit & ICP Alignment
  | 'trust'         // Trust & Proof
  | 'visual'        // Visual System
  | 'assets'        // Brand Assets & Guidelines
  | 'consistency';  // Brand Consistency & Coherence

export type BrandDimensionStatus = 'weak' | 'moderate' | 'strong';

// ============================================================================
// Evidence
// ============================================================================

/**
 * Evidence and findings that support a dimension score
 */
export interface BrandLabEvidence {
  /** What was found (positive signals) */
  found: string[];
  /** What was missing or problematic */
  missing: string[];
  /** Specific data points or metrics */
  dataPoints: Record<string, string | number | boolean | undefined>;
}

// ============================================================================
// Issues
// ============================================================================

export type BrandIssueCategory =
  | 'identity'
  | 'messaging'
  | 'positioning'
  | 'audienceFit'
  | 'trust'
  | 'visual'
  | 'assets'
  | 'consistency';

export type BrandIssueSeverity = 'low' | 'medium' | 'high';

export interface BrandLabIssue {
  id: string;
  category: BrandIssueCategory;
  severity: BrandIssueSeverity;
  title: string;
  description: string;
}

// ============================================================================
// Quick Wins
// ============================================================================

export interface BrandLabQuickWin {
  id: string;
  category: string;
  action: string;
  expectedImpact: 'low' | 'medium' | 'high';
  effortLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Projects
// ============================================================================

export interface BrandLabProject {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timeHorizon: 'near-term' | 'mid-term' | 'long-term';
}

// ============================================================================
// Dimensions
// ============================================================================

export interface BrandLabDimension {
  key: BrandDimensionKey;
  label: string;
  score: number; // 0-100
  status: BrandDimensionStatus;
  summary: string;
  issues: BrandLabIssue[];
  evidence?: BrandLabEvidence;
}

// ============================================================================
// Data Confidence
// ============================================================================

export type DataConfidenceLevel = 'low' | 'medium' | 'high';

export interface BrandDataConfidence {
  score: number; // 0-100
  level: DataConfidenceLevel;
  reason: string;
}

// ============================================================================
// Findings - Preserves V1 Detail
// ============================================================================

/**
 * Detailed findings from the analysis
 * Preserves V1 structures for backward compatibility and rich UI
 */
export interface BrandLabFindings {
  /** Full V1 diagnostic result for backward compatibility */
  diagnosticV1: any;

  /** Brand pillars identified */
  brandPillars?: any[];

  /** Identity system analysis */
  identitySystem?: any;

  /** Messaging system analysis */
  messagingSystem?: any;

  /** Positioning analysis */
  positioning?: any;

  /** Audience fit analysis */
  audienceFit?: any;

  /** Trust and proof analysis */
  trustAndProof?: any;

  /** Visual system analysis */
  visualSystem?: any;

  /** Brand assets inventory */
  brandAssets?: any;

  /** Inconsistencies detected */
  inconsistencies?: any[];

  /** Opportunities identified */
  opportunities?: any[];

  /** Risks identified */
  risks?: any[];

  /** Competitive landscape (if available) */
  competitiveLandscape?: any;
}

// ============================================================================
// Main Result Type
// ============================================================================

export interface BrandLabResult {
  /** Overall brand score (0-100) */
  overallScore: number;

  /** Maturity stage assessment */
  maturityStage: BrandMaturityStage;

  /** Data confidence assessment */
  dataConfidence: BrandDataConfidence;

  /** Narrative summary (2-3 sentences from strategist perspective) */
  narrativeSummary: string;

  /** Dimension scores and analysis */
  dimensions: BrandLabDimension[];

  /** All issues found */
  issues: BrandLabIssue[];

  /** Quick wins (high impact, low effort) */
  quickWins: BrandLabQuickWin[];

  /** Strategic projects */
  projects: BrandLabProject[];

  /** Detailed findings from the analysis (preserves V1 detail) */
  findings: BrandLabFindings;

  /** Timestamp */
  generatedAt: string;

  /** URL analyzed */
  url?: string;

  /** Company ID */
  companyId?: string;

  /** Company type */
  companyType?: string | null;
}

// ============================================================================
// Engine Result Wrapper
// ============================================================================

export interface BrandLabEngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  report?: BrandLabResult;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status from score
 */
export function getStatusFromScore(score: number): BrandDimensionStatus {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

/**
 * Get maturity stage from overall score
 */
export function getMaturityFromScore(score: number): BrandMaturityStage {
  if (score >= 85) return 'established';
  if (score >= 70) return 'scaling';
  if (score >= 50) return 'emerging';
  return 'unproven';
}

/**
 * Get human-readable label for dimension key
 */
export function getDimensionLabel(key: BrandDimensionKey): string {
  const labels: Record<BrandDimensionKey, string> = {
    identity: 'Identity & Promise',
    messaging: 'Messaging & Value Props',
    positioning: 'Positioning & Differentiation',
    audienceFit: 'Audience Fit & ICP',
    trust: 'Trust & Proof',
    visual: 'Visual System',
    assets: 'Brand Assets & Guidelines',
    consistency: 'Brand Consistency',
  };
  return labels[key] || key;
}

/**
 * Generate a unique ID for an issue
 */
export function generateIssueId(category: BrandIssueCategory, index: number): string {
  return `brand-${category}-${index}-${Date.now().toString(36)}`;
}
