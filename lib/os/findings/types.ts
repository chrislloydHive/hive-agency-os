// lib/os/findings/types.ts
// Core types for the Findings Standardization Engine

/**
 * Finding category - what area of digital presence
 */
export type FindingCategory =
  | 'seo'
  | 'listings'
  | 'social'
  | 'website'
  | 'reputation'
  | 'content'
  | 'technical'
  | 'competitive';

/**
 * Finding dimension - what aspect of the category
 */
export type FindingDimension =
  | 'presence'
  | 'accuracy'
  | 'completeness'
  | 'consistency'
  | 'performance'
  | 'visibility'
  | 'engagement'
  | 'authority'
  | 'compliance';

/**
 * Severity levels
 */
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Lab identifiers
 */
export type LabSlug =
  | 'gbp'
  | 'social'
  | 'citations'
  | 'reviews'
  | 'website'
  | 'schema'
  | 'competition'
  | 'audience'
  | 'rankings'
  | 'content'
  | 'technical'
  | 'brand';

/**
 * Location context for a finding
 */
export interface FindingLocation {
  /** URL where issue was found */
  url?: string;
  /** Page path */
  path?: string;
  /** Platform (e.g., "facebook", "google") */
  platform?: string;
  /** Element selector or identifier */
  element?: string;
  /** Line number if relevant */
  line?: number;
}

/**
 * Estimated impact of addressing the finding
 */
export interface FindingImpact {
  /** Overall impact level */
  level: 'high' | 'medium' | 'low';
  /** Affected metric (e.g., "visibility", "conversions", "rankings") */
  metric?: string;
  /** Estimated effort to fix */
  effort: 'quick' | 'moderate' | 'significant';
  /** Expected timeline for results */
  resultsTimeline?: 'immediate' | 'weeks' | 'months';
}

/**
 * A standardized finding from any lab
 */
export interface Finding {
  /** Unique identifier for this finding */
  id: string;
  /** Source lab that generated this finding */
  labSlug: LabSlug;
  /** Category of finding */
  category: FindingCategory;
  /** Dimension within category */
  dimension: FindingDimension;
  /** Severity level */
  severity: FindingSeverity;
  /** Where the issue was found */
  location: FindingLocation;
  /** Unique key for deduplication (e.g., "missing-gbp-hours") */
  issueKey: string;
  /** Human-readable description of the issue */
  description: string;
  /** Recommended action to address */
  recommendation: string;
  /** Impact assessment */
  estimatedImpact: FindingImpact;
  /** Confidence score (0-100) */
  confidence: number;
  /** Raw data from the lab */
  rawData?: unknown;
  /** When this finding was generated */
  detectedAt: string;
  /** Optional tags for grouping */
  tags?: string[];
}

/**
 * Result of standardizing findings
 */
export interface StandardizationResult {
  /** Standardized findings */
  findings: Finding[];
  /** Number of raw items processed */
  rawCount: number;
  /** Number of findings after standardization */
  standardizedCount: number;
  /** Number of duplicates merged */
  mergedCount: number;
  /** Any issues during standardization */
  warnings: string[];
}

/**
 * Issue key patterns for common problems
 */
export const ISSUE_KEYS = {
  // GBP Issues
  GBP_MISSING: 'gbp-missing',
  GBP_UNCLAIMED: 'gbp-unclaimed',
  GBP_INCOMPLETE_HOURS: 'gbp-incomplete-hours',
  GBP_MISSING_PHOTOS: 'gbp-missing-photos',
  GBP_OUTDATED_INFO: 'gbp-outdated-info',
  GBP_LOW_REVIEWS: 'gbp-low-reviews',
  GBP_NEGATIVE_REVIEWS: 'gbp-negative-reviews',

  // Social Issues
  SOCIAL_MISSING_PLATFORM: 'social-missing-platform',
  SOCIAL_INACTIVE: 'social-inactive',
  SOCIAL_LOW_ENGAGEMENT: 'social-low-engagement',
  SOCIAL_INCONSISTENT_BRANDING: 'social-inconsistent-branding',
  SOCIAL_MISSING_LINK: 'social-missing-link',

  // Citation Issues
  CITATION_NAP_INCONSISTENT: 'citation-nap-inconsistent',
  CITATION_MISSING_MAJOR: 'citation-missing-major',
  CITATION_DUPLICATE: 'citation-duplicate',
  CITATION_OUTDATED: 'citation-outdated',

  // Website Issues
  WEBSITE_SLOW_LOAD: 'website-slow-load',
  WEBSITE_NOT_MOBILE: 'website-not-mobile',
  WEBSITE_MISSING_META: 'website-missing-meta',
  WEBSITE_BROKEN_LINKS: 'website-broken-links',
  WEBSITE_MISSING_SSL: 'website-missing-ssl',
  WEBSITE_MISSING_SCHEMA: 'website-missing-schema',

  // Schema Issues
  SCHEMA_MISSING: 'schema-missing',
  SCHEMA_INVALID: 'schema-invalid',
  SCHEMA_INCOMPLETE: 'schema-incomplete',

  // Content Issues
  CONTENT_THIN: 'content-thin',
  CONTENT_DUPLICATE: 'content-duplicate',
  CONTENT_MISSING_KEYWORDS: 'content-missing-keywords',
  CONTENT_OUTDATED: 'content-outdated',

  // Technical Issues
  TECHNICAL_404_ERRORS: 'technical-404-errors',
  TECHNICAL_REDIRECT_CHAIN: 'technical-redirect-chain',
  TECHNICAL_CANONICAL_ISSUE: 'technical-canonical-issue',
  TECHNICAL_INDEXING_BLOCKED: 'technical-indexing-blocked',

  // Competition Issues
  COMPETITION_OUTRANKED: 'competition-outranked',
  COMPETITION_VISIBILITY_GAP: 'competition-visibility-gap',
  COMPETITION_REVIEW_GAP: 'competition-review-gap',
} as const;

/**
 * Severity scoring rules
 */
export const SEVERITY_RULES: Record<string, FindingSeverity> = {
  // Critical issues
  [ISSUE_KEYS.GBP_MISSING]: 'critical',
  [ISSUE_KEYS.WEBSITE_MISSING_SSL]: 'critical',
  [ISSUE_KEYS.TECHNICAL_INDEXING_BLOCKED]: 'critical',

  // High severity
  [ISSUE_KEYS.GBP_UNCLAIMED]: 'high',
  [ISSUE_KEYS.GBP_NEGATIVE_REVIEWS]: 'high',
  [ISSUE_KEYS.CITATION_NAP_INCONSISTENT]: 'high',
  [ISSUE_KEYS.WEBSITE_NOT_MOBILE]: 'high',
  [ISSUE_KEYS.SCHEMA_MISSING]: 'high',

  // Medium severity
  [ISSUE_KEYS.GBP_INCOMPLETE_HOURS]: 'medium',
  [ISSUE_KEYS.GBP_MISSING_PHOTOS]: 'medium',
  [ISSUE_KEYS.SOCIAL_MISSING_PLATFORM]: 'medium',
  [ISSUE_KEYS.SOCIAL_INACTIVE]: 'medium',
  [ISSUE_KEYS.CITATION_MISSING_MAJOR]: 'medium',
  [ISSUE_KEYS.WEBSITE_SLOW_LOAD]: 'medium',
  [ISSUE_KEYS.WEBSITE_MISSING_META]: 'medium',
  [ISSUE_KEYS.CONTENT_THIN]: 'medium',

  // Low severity
  [ISSUE_KEYS.GBP_LOW_REVIEWS]: 'low',
  [ISSUE_KEYS.SOCIAL_LOW_ENGAGEMENT]: 'low',
  [ISSUE_KEYS.WEBSITE_BROKEN_LINKS]: 'low',
  [ISSUE_KEYS.CONTENT_OUTDATED]: 'low',

  // Info level
  [ISSUE_KEYS.COMPETITION_OUTRANKED]: 'info',
  [ISSUE_KEYS.COMPETITION_VISIBILITY_GAP]: 'info',
};

/**
 * Category mappings for issue keys
 */
export const CATEGORY_MAPPINGS: Record<string, FindingCategory> = {
  gbp: 'listings',
  social: 'social',
  citation: 'listings',
  website: 'website',
  schema: 'technical',
  content: 'content',
  technical: 'technical',
  competition: 'competitive',
  review: 'reputation',
};

/**
 * Dimension mappings for issue keys
 */
export const DIMENSION_MAPPINGS: Record<string, FindingDimension> = {
  missing: 'presence',
  incomplete: 'completeness',
  inconsistent: 'consistency',
  outdated: 'accuracy',
  slow: 'performance',
  low: 'engagement',
  negative: 'authority',
  blocked: 'visibility',
};
