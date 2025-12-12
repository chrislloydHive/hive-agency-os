// lib/os/globalContext/types.ts
// OS Global Context Types - Hive Doctrine
//
// These types define the shape of the immutable, code-defined
// Hive OS operating context. AI cannot modify these values.

// ============================================================================
// Operating Principles
// ============================================================================

export interface OperatingPrinciple {
  /** Unique identifier for the principle */
  id: string;
  /** Short name */
  name: string;
  /** Full description */
  description: string;
  /** How this affects AI behavior */
  aiImplication: string;
}

// ============================================================================
// Terminology Definitions
// ============================================================================

export interface TermDefinition {
  /** The term being defined */
  term: string;
  /** Definition */
  definition: string;
  /** Usage examples */
  examples?: string[];
  /** Related terms */
  relatedTerms?: string[];
}

// ============================================================================
// Output Tone Rules
// ============================================================================

export interface ToneRule {
  /** Rule identifier */
  id: string;
  /** What to do */
  rule: string;
  /** What to avoid */
  avoid?: string;
  /** Example of correct output */
  goodExample?: string;
  /** Example of incorrect output */
  badExample?: string;
}

// ============================================================================
// Source Selection Rules
// ============================================================================

export interface SourceSelectionRule {
  /** What data source this applies to */
  domain: string;
  /** Preferred source (e.g., 'v4') */
  preferredSource: string;
  /** Fallback source (e.g., 'v3') */
  fallbackSource?: string;
  /** Never use these sources together */
  mutuallyExclusive?: string[];
  /** Description of the rule */
  description: string;
}

// ============================================================================
// Data Confidence Posture
// ============================================================================

export interface ConfidencePosture {
  /** How to handle high-confidence data */
  highConfidence: string;
  /** How to handle medium-confidence data */
  mediumConfidence: string;
  /** How to handle low-confidence data */
  lowConfidence: string;
  /** How to handle missing data */
  missingData: string;
  /** What to do with assumptions */
  assumptions: string;
}

// ============================================================================
// Forbidden Patterns
// ============================================================================

export interface ForbiddenPattern {
  /** Pattern identifier */
  id: string;
  /** Category of the pattern */
  category: 'language' | 'content' | 'behavior' | 'structure';
  /** What is forbidden */
  pattern: string;
  /** Why it's forbidden */
  reason: string;
  /** What to do instead */
  alternative: string;
  /** Examples of the forbidden pattern */
  examples?: string[];
}

// ============================================================================
// Main OS Global Context Type
// ============================================================================

export interface OSGlobalContext {
  // Core principles
  operatingPrinciples: OperatingPrinciple[];

  // Terminology
  terminology: TermDefinition[];

  // Output rules
  toneRules: ToneRule[];
  forbiddenPatterns: ForbiddenPattern[];

  // Data handling
  confidencePosture: ConfidencePosture;
  sourceSelectionRules: SourceSelectionRule[];

  // Strategy-specific doctrine
  strategyDoctrine: {
    coreDefinition: string;
    pillarsAreBets: string;
    choicesOverActivities: string;
    tradeoffsRequired: string;
  };

  // Protection rules
  protectionRules: {
    userConfirmedImmutable: string;
    aiCanOnlyPropose: string;
    conflictsMustSurface: string;
    regenerationNonDestructive: string;
  };
}

// ============================================================================
// Versioned Context Wrapper
// ============================================================================

export interface VersionedOSContext {
  /** Semantic version of the doctrine */
  version: string;
  /** When this version was defined */
  definedAt: string;
  /** The doctrine content */
  doctrine: OSGlobalContext;
}
