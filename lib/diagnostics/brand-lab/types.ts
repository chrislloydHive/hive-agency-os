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

  /** V1 positioning analysis (raw analysis, not canonical output) */
  positioningAnalysis?: any;

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

  // ========== CANONICAL FINDINGS (NEW) ==========
  // These are the customer-facing outputs for Strategy Frame
  // RULES:
  // - NO competitor mentions (no "vs", no competitor names)
  // - NO comparative claims ("differentiated vs", "unique compared to", "competitive advantage")
  // - NO evaluative statements as outputs ("Positioning is clear/vague/generic")

  /** Positioning statement and summary */
  positioning?: {
    /** Customer-facing positioning statement (1-2 sentences) */
    statement: string;
    /** Rationale/summary referencing on-site signals only (2-4 sentences) */
    summary: string;
    confidence: number;
  };

  /** Value proposition (headline + description) */
  valueProp?: {
    /** Short value prop headline */
    headline: string;
    /** Extended description (1-2 sentences) */
    description: string;
    confidence: number;
  };

  /** Key differentiators (3-7 bullets) */
  differentiators?: {
    bullets: string[];
    confidence: number;
  };

  /** Ideal customer profile / target audience */
  icp?: {
    /** Primary audience description (1-2 sentences) */
    primaryAudience: string;
    /** Buyer roles (optional) */
    buyerRoles?: string[];
    confidence: number;
  };

  /** Brand tone of voice */
  toneOfVoice?: {
    enabled: boolean;
    descriptor?: string;
    doList?: string[];
    dontList?: string[];
    confidence?: number;
  };

  /** Messaging pillars (3-6 pillars) */
  messaging?: {
    pillars: Array<{ title: string; support: string }>;
    proofPoints?: string[];
    confidence: number;
  };
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

/**
 * Engine status for Brand Lab diagnostic
 * - ok: Diagnostic completed successfully with valid results
 * - failed: Diagnostic could not complete a reliable analysis
 */
export type BrandLabEngineStatus = 'ok' | 'failed';

/**
 * Error details when Brand Lab fails validation
 */
export interface BrandLabEngineError {
  reason: string;
  details?: string[];
}

/**
 * Result wrapper that includes validation status.
 * Used by the engine to indicate whether the diagnostic is valid.
 */
export interface BrandLabValidatedResult {
  status: BrandLabEngineStatus;
  result?: BrandLabResult;
  error?: BrandLabEngineError;
}

/**
 * Legacy engine result wrapper for backward compatibility.
 * Used by runBrandLabEngine() function.
 */
export interface BrandLabEngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  report?: BrandLabResult;
  error?: string;
}

/**
 * Fallback data confidence for failed runs.
 * Used when the diagnostic fails validation.
 */
export const BRAND_LAB_FAILED_CONFIDENCE: BrandDataConfidence = {
  score: 20,
  level: 'low',
  reason: 'Brand Lab could not complete a reliable analysis. Insights are not available for this run.',
};

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// FINDINGS VALIDATION (No Competitive Claims Rule)
// ============================================================================

/**
 * Banned phrases that indicate competitive claims (not allowed in Brand Lab outputs)
 */
const COMPETITIVE_CLAIM_PATTERNS = [
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompared to\b/i,
  /\bcompetitor[s]?\b/i,
  /\bcompetitive advantage\b/i,
  /\bdifferentiated from\b/i,
  /\bunique vs\b/i,
  /\bmarket leader\b/i,
  /\bbeat[s]?\b/i,
  /\boutperform[s]?\b/i,
];

/**
 * Evaluative patterns that should not appear in customer-facing outputs
 */
const EVALUATIVE_PATTERNS = [
  /^positioning is\b/i,
  /^value prop is\b/i,
  /^differentiation is\b/i,
  /\bis (clear|vague|generic|strong|weak)\b/i,
  /\bcould be (sharper|clearer|stronger|better)\b/i,
  /\bneeds (work|improvement)\b/i,
  /\bis present but\b/i,
  /\bpartially defined\b/i,
  /\bserviceable but\b/i,
];

/**
 * Check if text contains competitive claims
 */
function containsCompetitiveClaims(text: string): boolean {
  return COMPETITIVE_CLAIM_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if text is evaluative (meta-comment about quality)
 */
function isEvaluativeStatement(text: string): boolean {
  return EVALUATIVE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if a string is valid for Brand Lab findings
 * Returns false if empty, competitive, or evaluative
 */
function isValidFindingText(text: string | undefined | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  if (containsCompetitiveClaims(trimmed)) return false;
  if (isEvaluativeStatement(trimmed)) return false;
  return true;
}

/**
 * Validation result for findings
 */
export interface FindingsValidationResult {
  valid: boolean;
  strippedFields: string[];
  errors: string[];
}

/**
 * Validate and sanitize Brand Lab findings.
 * Strips fields that contain competitive claims or evaluative statements.
 *
 * RULES:
 * - NO competitor mentions (no "vs", no competitor names)
 * - NO comparative claims ("differentiated vs", "unique compared to", "competitive advantage")
 * - NO evaluative statements as outputs ("Positioning is clear/vague/generic")
 *
 * @param findings - The findings to validate
 * @returns Sanitized findings with invalid fields stripped
 */
export function validateAndSanitizeBrandFindings(
  findings: BrandLabFindings
): { sanitized: BrandLabFindings; validation: FindingsValidationResult } {
  const strippedFields: string[] = [];
  const errors: string[] = [];
  const sanitized = { ...findings };

  // Validate positioning
  if (sanitized.positioning) {
    if (!isValidFindingText(sanitized.positioning.statement)) {
      strippedFields.push('positioning.statement');
      sanitized.positioning = undefined;
    } else if (!isValidFindingText(sanitized.positioning.summary)) {
      // Keep statement if valid, just clear summary
      sanitized.positioning = {
        ...sanitized.positioning,
        summary: '',
      };
      strippedFields.push('positioning.summary');
    }
  }

  // Validate valueProp
  if (sanitized.valueProp) {
    if (!isValidFindingText(sanitized.valueProp.headline)) {
      strippedFields.push('valueProp.headline');
      sanitized.valueProp = undefined;
    } else if (!isValidFindingText(sanitized.valueProp.description)) {
      sanitized.valueProp = {
        ...sanitized.valueProp,
        description: '',
      };
      strippedFields.push('valueProp.description');
    }
  }

  // Validate differentiators
  if (sanitized.differentiators?.bullets) {
    const validBullets = sanitized.differentiators.bullets.filter(b => {
      if (!b || b.trim().length < 5) return false;
      if (containsCompetitiveClaims(b)) {
        strippedFields.push(`differentiators.bullet: "${b.slice(0, 30)}..."`);
        return false;
      }
      if (isEvaluativeStatement(b)) {
        strippedFields.push(`differentiators.bullet (evaluative): "${b.slice(0, 30)}..."`);
        return false;
      }
      return true;
    });

    if (validBullets.length === 0) {
      sanitized.differentiators = undefined;
      strippedFields.push('differentiators (all invalid)');
    } else {
      sanitized.differentiators = {
        ...sanitized.differentiators,
        bullets: validBullets,
      };
    }
  }

  // Validate ICP
  if (sanitized.icp) {
    if (!isValidFindingText(sanitized.icp.primaryAudience)) {
      strippedFields.push('icp.primaryAudience');
      sanitized.icp = undefined;
    }
  }

  // Validate messaging pillars
  if (sanitized.messaging?.pillars) {
    const validPillars = sanitized.messaging.pillars.filter(p => {
      if (!p.title || p.title.trim().length < 3) return false;
      if (containsCompetitiveClaims(p.title) || containsCompetitiveClaims(p.support || '')) {
        strippedFields.push(`messaging.pillar: "${p.title}"`);
        return false;
      }
      return true;
    });

    if (validPillars.length === 0) {
      sanitized.messaging = undefined;
    } else {
      sanitized.messaging = {
        ...sanitized.messaging,
        pillars: validPillars,
      };
    }
  }

  return {
    sanitized,
    validation: {
      valid: strippedFields.length === 0,
      strippedFields,
      errors,
    },
  };
}

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
