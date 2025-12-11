// lib/os/context/types.ts
// Core types for the Context Graph Integrity Engine

/**
 * Source of a context value
 */
export type ContextSource =
  | 'user'           // Manually entered by user
  | 'ai-inferred'    // Inferred by AI from other data
  | 'scrape'         // Scraped from website
  | 'api'            // From external API (GBP, social, etc.)
  | 'import'         // Imported from file/external source
  | 'default';       // System default

/**
 * Freshness status
 */
export type FreshnessStatus = 'fresh' | 'stale' | 'expired' | 'unknown';

/**
 * Conflict resolution strategy
 */
export type ResolutionStrategy =
  | 'user-wins'      // User-provided value takes precedence
  | 'newer-wins'     // Most recent value wins
  | 'source-wins'    // Specific source takes precedence
  | 'manual'         // Requires manual resolution
  | 'merge';         // Values can be merged

/**
 * Provenance record for a context field
 */
export interface FieldProvenance {
  /** Field path (e.g., "company.name", "socials.facebook.url") */
  fieldPath: string;
  /** Current value */
  value: unknown;
  /** Source of current value */
  source: ContextSource;
  /** When this value was set */
  setAt: string;
  /** When this value was last verified */
  verifiedAt?: string;
  /** Previous values (for history) */
  history?: Array<{
    value: unknown;
    source: ContextSource;
    setAt: string;
    replacedAt: string;
  }>;
  /** Confidence in this value (0-100) */
  confidence: number;
  /** Whether this field is locked (won't be auto-updated) */
  locked: boolean;
  /** Lock reason if locked */
  lockReason?: string;
}

/**
 * Conflict between sources
 */
export interface FieldConflict {
  /** Field path with conflict */
  fieldPath: string;
  /** Current value */
  currentValue: unknown;
  /** Current source */
  currentSource: ContextSource;
  /** Conflicting value */
  conflictingValue: unknown;
  /** Conflicting source */
  conflictingSource: ContextSource;
  /** When conflict was detected */
  detectedAt: string;
  /** Recommended resolution */
  recommendedResolution: ResolutionStrategy;
  /** Has been resolved */
  resolved: boolean;
  /** Resolution if resolved */
  resolution?: {
    chosenValue: unknown;
    chosenSource: ContextSource;
    resolvedAt: string;
    resolvedBy: 'auto' | 'user';
  };
}

/**
 * Freshness score for a field
 */
export interface FreshnessScore {
  /** Field path */
  fieldPath: string;
  /** Current value age in days */
  ageInDays: number;
  /** Freshness status */
  status: FreshnessStatus;
  /** Score (0-100, 100 = fresh) */
  score: number;
  /** Recommended refresh date */
  refreshBy?: string;
  /** How to refresh this field */
  refreshMethod?: 'scrape' | 'api' | 'manual';
}

/**
 * Missing field indicator
 */
export interface MissingField {
  /** Field path */
  fieldPath: string;
  /** Display name */
  displayName: string;
  /** Importance (critical, high, medium, low) */
  importance: 'critical' | 'high' | 'medium' | 'low';
  /** Why this field is important */
  reason: string;
  /** Suggested sources to populate */
  suggestedSources: ContextSource[];
}

/**
 * Context health score
 */
export interface ContextHealth {
  /** Overall health score (0-100) */
  overallScore: number;
  /** Completeness score (% of fields filled) */
  completenessScore: number;
  /** Freshness score (average freshness) */
  freshnessScore: number;
  /** Consistency score (no conflicts) */
  consistencyScore: number;
  /** Confidence score (average confidence) */
  confidenceScore: number;
  /** Number of conflicts */
  conflictCount: number;
  /** Number of stale fields */
  staleFieldCount: number;
  /** Number of missing critical fields */
  missingCriticalCount: number;
  /** Last health check */
  checkedAt: string;
}

/**
 * Context integrity check result
 */
export interface IntegrityCheckResult {
  /** Health summary */
  health: ContextHealth;
  /** Field provenance map */
  provenance: Map<string, FieldProvenance>;
  /** Active conflicts */
  conflicts: FieldConflict[];
  /** Freshness scores by field */
  freshness: FreshnessScore[];
  /** Missing fields */
  missingFields: MissingField[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Auto-resolution rule
 */
export interface AutoResolutionRule {
  /** Rule ID */
  id: string;
  /** Field pattern (supports wildcards) */
  fieldPattern: string;
  /** Source priority order (first wins) */
  sourcePriority: ContextSource[];
  /** Conditions for applying this rule */
  conditions?: {
    /** Only if current value is older than X days */
    olderThanDays?: number;
    /** Only if confidence is below X */
    confidenceBelow?: number;
    /** Only from specific sources */
    fromSources?: ContextSource[];
  };
  /** Whether this rule is enabled */
  enabled: boolean;
}

/**
 * Default auto-resolution rules
 */
export const DEFAULT_AUTO_RULES: AutoResolutionRule[] = [
  {
    id: 'user-always-wins',
    fieldPattern: '*',
    sourcePriority: ['user', 'api', 'scrape', 'ai-inferred', 'import', 'default'],
    enabled: true,
  },
  {
    id: 'api-wins-for-socials',
    fieldPattern: 'socials.*',
    sourcePriority: ['user', 'api', 'scrape', 'ai-inferred'],
    enabled: true,
  },
  {
    id: 'scrape-wins-for-website',
    fieldPattern: 'website.*',
    sourcePriority: ['user', 'scrape', 'api', 'ai-inferred'],
    enabled: true,
  },
];

/**
 * Freshness thresholds in days
 */
export const FRESHNESS_THRESHOLDS: Record<string, { fresh: number; stale: number; expired: number }> = {
  // Business info (rarely changes)
  'company.name': { fresh: 365, stale: 730, expired: 1095 },
  'company.address': { fresh: 180, stale: 365, expired: 730 },
  'company.phone': { fresh: 90, stale: 180, expired: 365 },

  // Social profiles (moderate change)
  'socials.*': { fresh: 30, stale: 90, expired: 180 },

  // Website content (changes more often)
  'website.*': { fresh: 14, stale: 30, expired: 90 },

  // GBP (needs regular verification)
  'gbp.*': { fresh: 30, stale: 60, expired: 120 },

  // Default
  '*': { fresh: 30, stale: 90, expired: 180 },
};

/**
 * Required context fields with importance
 */
export const REQUIRED_FIELDS: Array<{
  path: string;
  displayName: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}> = [
  // Critical fields
  {
    path: 'company.name',
    displayName: 'Business Name',
    importance: 'critical',
    reason: 'Required for all marketing and SEO activities',
  },
  {
    path: 'company.website',
    displayName: 'Website URL',
    importance: 'critical',
    reason: 'Central hub for all online presence',
  },
  {
    path: 'company.industry',
    displayName: 'Industry',
    importance: 'critical',
    reason: 'Needed for competitive analysis and targeting',
  },

  // High importance
  {
    path: 'company.address',
    displayName: 'Business Address',
    importance: 'high',
    reason: 'Required for local SEO and GBP',
  },
  {
    path: 'company.phone',
    displayName: 'Phone Number',
    importance: 'high',
    reason: 'Key contact information for customers',
  },
  {
    path: 'gbp.url',
    displayName: 'Google Business Profile',
    importance: 'high',
    reason: 'Essential for local search visibility',
  },

  // Medium importance
  {
    path: 'socials.facebook',
    displayName: 'Facebook Page',
    importance: 'medium',
    reason: 'Major social platform for engagement',
  },
  {
    path: 'socials.instagram',
    displayName: 'Instagram Profile',
    importance: 'medium',
    reason: 'Visual marketing channel',
  },
  {
    path: 'company.description',
    displayName: 'Business Description',
    importance: 'medium',
    reason: 'Used in GBP and social profiles',
  },

  // Low importance
  {
    path: 'socials.linkedin',
    displayName: 'LinkedIn Company Page',
    importance: 'low',
    reason: 'B2B networking and credibility',
  },
  {
    path: 'socials.youtube',
    displayName: 'YouTube Channel',
    importance: 'low',
    reason: 'Video marketing channel',
  },
];
