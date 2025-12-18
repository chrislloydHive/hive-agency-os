// tests/fixtures/labs/types.ts
// Type definitions for lab snapshot testing
//
// These types define the structure for snapshot-based lab testing,
// allowing fast iteration on extractors without running actual LLM calls.

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Lab keys that can be tested via snapshots
 */
export type LabKey =
  | 'brand'
  | 'website'
  | 'seo'
  | 'content'
  | 'demand'
  | 'ops'
  | 'audience'
  | 'competitor';

/**
 * Company profile for test scenario context
 */
export interface CompanyProfile {
  /** Business model affects what "generic" means in filters */
  businessModel: 'b2b' | 'b2c' | 'local';
  /** Industry for context */
  industry: string;
  /** Company stage affects filter strictness */
  stage: 'new' | 'existing';
  /** Optional: Company name for display */
  companyName?: string;
}

/**
 * A single lab snapshot - the core unit of test data
 */
export interface LabSnapshot {
  /** Unique ID for this snapshot */
  id: string;
  /** Which lab this output is from */
  labKey: LabKey;
  /** Company profile for this scenario */
  companyProfile: CompanyProfile;
  /** Purpose of the run (affects filter strictness) */
  runPurpose: 'baseline' | 'refinement';
  /** The raw LLM output before any extraction */
  rawLabOutput: unknown;
  /** Human-readable description of this scenario */
  description?: string;
  /** When this snapshot was captured */
  capturedAt?: string;
  /** Version of the lab that produced this output */
  labVersion?: string;
}

/**
 * Expected extraction results for a snapshot
 */
export interface ExpectedExtractionResults {
  /** Fields expected to be accepted (key -> expected value or just presence check) */
  accepted: Record<string, unknown>;
  /** Fields expected to be rejected (key -> rejection reason pattern) */
  rejected: Record<string, string>;
  /** Optional: expected provenance notes */
  provenanceNotes?: Record<string, string>;
}

/**
 * Expected context graph state after applying snapshot
 */
export interface ExpectedGraphState {
  /** Domain coverage percentages (0-100) */
  domainCoverage: Partial<Record<string, number>>;
  /** Fields expected to be present in the graph */
  fieldsPresent: string[];
  /** Fields expected to NOT be present */
  fieldsAbsent?: string[];
  /** Optional: specific field values to check */
  fieldValues?: Record<string, unknown>;
}

/**
 * A complete test scenario combining snapshot with expectations
 */
export interface LabTestScenario {
  /** Human-readable name for this scenario */
  name: string;
  /** The snapshot data */
  snapshot: LabSnapshot;
  /** Expected extraction results */
  expectedExtraction: ExpectedExtractionResults;
  /** Expected graph state after applying */
  expectedGraphState: ExpectedGraphState;
  /** Tags for filtering tests */
  tags?: string[];
}

// ============================================================================
// Golden Scenario Names
// ============================================================================

/**
 * Named golden scenarios that serve as guardrails
 * Any filter changes must pass these scenarios
 */
export const GOLDEN_SCENARIOS = {
  NEW_B2C_PET_FOOD_BASELINE: 'new_b2c_pet_food_baseline',
  NEW_B2B_SAAS_BASELINE: 'new_b2b_saas_baseline',
  EXISTING_COMPANY_REFINEMENT: 'existing_company_refinement',
  LOCAL_SERVICE_BUSINESS: 'local_service_business',
  B2B_ENTERPRISE_BASELINE: 'b2b_enterprise_baseline',
  B2C_ECOMMERCE_BASELINE: 'b2c_ecommerce_baseline',
} as const;

export type GoldenScenarioName = typeof GOLDEN_SCENARIOS[keyof typeof GOLDEN_SCENARIOS];

// ============================================================================
// Fixture Registry
// ============================================================================

/**
 * Registry of all available test scenarios by name
 */
export interface ScenarioRegistry {
  scenarios: Map<string, LabTestScenario>;
  getScenario(name: string): LabTestScenario | undefined;
  getScenariosForLab(labKey: LabKey): LabTestScenario[];
  getScenariosWithTag(tag: string): LabTestScenario[];
  getGoldenScenarios(): LabTestScenario[];
}

// ============================================================================
// Test Result Types
// ============================================================================

/**
 * Result of running an extractor against a snapshot
 */
export interface ExtractorTestResult {
  scenarioName: string;
  passed: boolean;
  /** Fields that were correctly accepted */
  correctlyAccepted: string[];
  /** Fields that were correctly rejected */
  correctlyRejected: string[];
  /** Fields that were unexpectedly accepted (should have been rejected) */
  unexpectedlyAccepted: string[];
  /** Fields that were unexpectedly rejected (should have been accepted) */
  unexpectedlyRejected: string[];
  /** Detailed errors */
  errors: string[];
  /** Execution time in ms */
  durationMs: number;
}

/**
 * Result of running context graph integration test
 */
export interface GraphIntegrationTestResult {
  scenarioName: string;
  passed: boolean;
  /** Domain coverage matches */
  coverageMatches: Record<string, boolean>;
  /** Fields that are present as expected */
  fieldsCorrect: string[];
  /** Fields that are missing unexpectedly */
  fieldsMissing: string[];
  /** Fields that are present unexpectedly */
  fieldsUnexpected: string[];
  /** Detailed errors */
  errors: string[];
  /** Execution time in ms */
  durationMs: number;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * ExtractionContext for controlling filter strictness (matches lib/os/context/extractors/)
 */
export interface ExtractionContext {
  companyStage: 'new' | 'existing';
  businessModel?: 'b2b' | 'b2c' | 'local';
  runPurpose: 'baseline' | 'refinement';
}

/**
 * Convert CompanyProfile to ExtractionContext
 */
export function toExtractionContext(
  profile: CompanyProfile,
  runPurpose: 'baseline' | 'refinement'
): ExtractionContext {
  return {
    companyStage: profile.stage,
    businessModel: profile.businessModel,
    runPurpose,
  };
}
