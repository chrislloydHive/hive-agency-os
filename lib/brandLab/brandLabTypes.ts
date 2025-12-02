// lib/brandLab/brandLabTypes.ts
// Brand Lab Normalized Types
//
// These types define the normalized structure for Brand Lab results
// that flow directly to the UI without recalculation or inference.

// ============================================================================
// Maturity Stages
// ============================================================================

export type BrandMaturityStage = 'unproven' | 'emerging' | 'scaling' | 'established';

// ============================================================================
// Dimension Labels (Standardized)
// ============================================================================

export const DIMENSION_LABELS = {
  identity: 'Identity & Promise',
  messaging: 'Messaging & Value Props',
  positioning: 'Positioning & Differentiation',
  audienceFit: 'Audience Fit & ICP',
  trust: 'Trust & Proof',
  visual: 'Visual System',
  assets: 'Brand Assets & Guidelines',
  consistency: 'Brand Consistency',
} as const;

export type BrandDimensionKey = keyof typeof DIMENSION_LABELS;

// ============================================================================
// Data Confidence
// ============================================================================

export interface BrandDataConfidence {
  score: number;
  level: 'low' | 'medium' | 'high';
  reason: string;
}

// ============================================================================
// Dimension
// ============================================================================

export interface BrandDimension {
  key: BrandDimensionKey;
  label: string;
  score: number;
  status: 'weak' | 'moderate' | 'strong';
  summary: string;
}

// ============================================================================
// Issue
// ============================================================================

export type BrandIssueSeverity = 'low' | 'medium' | 'high';
export type BrandIssueCategory = BrandDimensionKey;

export interface BrandIssue {
  id: string;
  title: string;
  description: string;
  severity: BrandIssueSeverity;
  category: BrandIssueCategory;
}

// ============================================================================
// Quick Win
// ============================================================================

export interface BrandQuickWin {
  id: string;
  action: string;
  category: string;
  expectedImpact: 'low' | 'medium' | 'high';
  effortLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Project
// ============================================================================

export interface BrandProject {
  id: string;
  title: string;
  description: string;
  category: string;
  impact: 'low' | 'medium' | 'high';
  timeHorizon: 'near-term' | 'mid-term' | 'long-term';
}

// ============================================================================
// Brand Pillar
// ============================================================================

export interface BrandPillar {
  name: string;
  description: string;
  strengthScore: number;
  isExplicit: boolean;
  isPerceived: boolean;
}

// ============================================================================
// Positioning
// ============================================================================

export interface BrandPositioning {
  theme: string;
  competitiveAngle: string;
  clarityScore: number;
  risks: string[];
}

// ============================================================================
// Messaging
// ============================================================================

export interface BrandValueProp {
  statement: string;
  clarityScore?: number;
  uniquenessScore?: number;
}

export interface BrandMessaging {
  benefitVsFeature: number;
  icpClarity: number;
  messagingFocus: number;
  valueProps: BrandValueProp[];
  clarityIssues: string[];
  differentiators: string[];
  headlines: string[];
}

// ============================================================================
// Identity
// ============================================================================

export interface BrandIdentity {
  tagline: string;
  taglineClarityScore: number;
  corePromise: string;
  corePromiseClarityScore: number;
  toneOfVoice: string;
  toneConsistencyScore: number;
  personalityTraits: string[];
  identityGaps: string[];
}

// ============================================================================
// Trust
// ============================================================================

export interface BrandTrust {
  trustArchetype: string;
  trustSignalsScore: number;
  humanPresenceScore: number;
  credibilityGaps: string[];
}

// ============================================================================
// Audience Fit
// ============================================================================

export interface BrandAudienceFit {
  primaryICPDescription: string;
  alignmentScore: number;
  icpSignals: string[];
  misalignmentNotes: string[];
}

// ============================================================================
// Normalized Brand Lab Result
// ============================================================================

export interface NormalizedBrandLabResult {
  // Core metrics - directly from JSON, no inference
  overallScore: number;
  maturityStage: BrandMaturityStage;
  dataConfidence: BrandDataConfidence;

  // Executive summary - directly from JSON
  narrativeSummary: string;

  // Dimensions with standardized labels
  dimensions: BrandDimension[];

  // Issues - sorted by severity then category
  issues: BrandIssue[];

  // Deduped quick wins and projects
  quickWins: BrandQuickWin[];
  projects: BrandProject[];

  // Top opportunities (deduped, limited to 5)
  topOpportunities: Array<{ title: string; type: 'quickWin' | 'project' }>;

  // Brand pillars
  brandPillars: BrandPillar[];

  // Section data
  positioning: BrandPositioning;
  messaging: BrandMessaging;
  identity: BrandIdentity;
  trust: BrandTrust;
  audienceFit: BrandAudienceFit;

  // Metadata
  generatedAt: string;
  url?: string;
  companyId?: string;

  // Raw findings for backward compatibility
  rawFindings?: any;
}
