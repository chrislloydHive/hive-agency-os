// tests/labs/extractorReplay.test.ts
// Extractor Replay Tests
//
// Runs extractors against snapshot fixtures to validate extraction logic
// without making actual LLM calls.
//
// Usage:
//   pnpm test tests/labs/extractorReplay.test.ts
//   pnpm test tests/labs/extractorReplay.test.ts -- --scenario=new_b2c_pet_food_baseline
//   pnpm test:labs --scenario=new_b2c_pet_food_baseline

import { describe, it, expect, beforeAll } from 'vitest';
import {
  scenarioRegistry,
  type LabTestScenario,
  type ExtractorTestResult,
  toExtractionContext,
} from '../fixtures/labs';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Get scenario filter from environment/command line
 * Supports: --scenario=name, SCENARIO=name
 */
function getScenarioFilter(): string | null {
  // Check command line args
  const scenarioArg = process.argv.find((arg) => arg.startsWith('--scenario='));
  if (scenarioArg) {
    return scenarioArg.split('=')[1];
  }

  // Check environment variable
  if (process.env.SCENARIO) {
    return process.env.SCENARIO;
  }

  // Check for tag filter
  const tagArg = process.argv.find((arg) => arg.startsWith('--tag='));
  if (tagArg) {
    return `tag:${tagArg.split('=')[1]}`;
  }

  return null;
}

// ============================================================================
// Mock Extractor (Simulates lib/os/context/extractors/)
// ============================================================================

/**
 * Rejection rules and their patterns
 * These match the patterns in lib/os/context/extractors/index.ts
 */
const REJECTION_RULES = {
  too_generic: [
    /^a\s+(solutions?|company|business)\s+provider/i,
    /focused?\s+on\s+(helping|innovation|growth)/i,
    /organizations?\s+seeking/i,
    /growing\s+companies/i,
    /professionals?\s+at\s+growing/i,
  ],
  buzzword_only: [
    /^(innovation|quality|excellence)\s+(and|&)\s+(quality|excellence|customer)/i,
    /customer[- ]first\s+approach/i,
    /innovative\s+solutions/i,
    /deliver(s|ing)?\s+(quality|value|excellence)/i,
  ],
  evaluation_not_fact: [
    /is\s+present\s+but/i,
    /could\s+be\s+(stronger|clearer|improved)/i,
    /needs?\s+(more|to\s+be|improvement)/i,
    /is\s+unclear/i,
  ],
  placeholder: [
    /^(N\/A|TBD|Unknown|None|Not\s+specified)/i,
    /to\s+be\s+determined/i,
  ],
};

interface ExtractionResult {
  accepted: Map<string, { value: unknown; provenance?: string }>;
  rejected: Map<string, { value: unknown; reason: string; pattern?: string }>;
}

/**
 * Simulate running an extractor against raw lab output
 */
function runExtractor(
  labOutput: unknown,
  context: { companyStage: 'new' | 'existing'; businessModel?: string; runPurpose: 'baseline' | 'refinement' }
): ExtractionResult {
  const accepted = new Map<string, { value: unknown; provenance?: string }>();
  const rejected = new Map<string, { value: unknown; reason: string; pattern?: string }>();

  // Check if this is a findings-based lab output
  const findings = (labOutput as Record<string, unknown>)?.findings as Record<string, unknown> | undefined;
  if (!findings) {
    return { accepted, rejected };
  }

  // Process each field
  processField('positioning', findings.positioning, accepted, rejected, context);
  processField('valueProp', findings.valueProp, accepted, rejected, context);
  processField('differentiators', findings.differentiators, accepted, rejected, context);
  processField('icp', findings.icp, accepted, rejected, context);
  processField('tone', findings.tone, accepted, rejected, context);

  // Process explicitly marked rejection fields
  const shouldReject = (findings as Record<string, unknown>)._shouldReject as Record<string, unknown> | undefined;
  if (shouldReject) {
    for (const [key, value] of Object.entries(shouldReject)) {
      const reason = checkRejectionRules(String(value), context);
      if (reason) {
        rejected.set(`_shouldReject.${key}`, { value, ...reason });
      }
    }
  }

  return { accepted, rejected };
}

/**
 * Process a single field for extraction
 */
function processField(
  fieldName: string,
  fieldValue: unknown,
  accepted: Map<string, { value: unknown; provenance?: string }>,
  rejected: Map<string, { value: unknown; reason: string; pattern?: string }>,
  context: { companyStage: 'new' | 'existing'; businessModel?: string; runPurpose: 'baseline' | 'refinement' }
): void {
  if (!fieldValue) return;

  // Handle object fields (like positioning.statement)
  if (typeof fieldValue === 'object' && fieldValue !== null) {
    const obj = fieldValue as Record<string, unknown>;

    // Check for statement field (positioning)
    if (obj.statement && typeof obj.statement === 'string') {
      const reason = checkRejectionRules(obj.statement, context);
      if (reason) {
        rejected.set(fieldName, { value: obj.statement, ...reason });
      } else {
        accepted.set(fieldName, { value: obj.statement, provenance: `Extracted from ${fieldName}.statement` });
      }
    }

    // Check for primary field (valueProp)
    if (obj.primary && typeof obj.primary === 'string') {
      const reason = checkRejectionRules(obj.primary, context);
      if (reason) {
        rejected.set(`${fieldName}_primary`, { value: obj.primary, ...reason });
      } else {
        accepted.set(`${fieldName}_primary`, { value: obj.primary, provenance: `Extracted from ${fieldName}.primary` });
      }
    }

    // Check for primaryAudience (icp)
    if (obj.primaryAudience && typeof obj.primaryAudience === 'string') {
      const reason = checkRejectionRules(obj.primaryAudience, context);
      if (reason) {
        rejected.set('audience_icp_primary', { value: obj.primaryAudience, ...reason });
      } else {
        accepted.set('audience_icp_primary', { value: obj.primaryAudience, provenance: 'Extracted from icp.primaryAudience' });
      }
    }

    // Handle arrays (like differentiators)
    if (Array.isArray(fieldValue)) {
      const acceptedItems: string[] = [];
      for (const item of fieldValue) {
        if (typeof item === 'string') {
          const reason = checkRejectionRules(item, context);
          if (!reason) {
            acceptedItems.push(item);
          }
        }
      }
      if (acceptedItems.length > 0) {
        accepted.set(fieldName, { value: acceptedItems, provenance: `Extracted ${acceptedItems.length} items` });
      }
    }
  }

  // Handle direct arrays
  if (Array.isArray(fieldValue)) {
    const acceptedItems: string[] = [];
    for (const item of fieldValue) {
      if (typeof item === 'string') {
        const reason = checkRejectionRules(item, context);
        if (!reason) {
          acceptedItems.push(item);
        }
      }
    }
    if (acceptedItems.length > 0) {
      accepted.set(fieldName, { value: acceptedItems, provenance: `Extracted ${acceptedItems.length} items` });
    }
  }
}

/**
 * Check if a value should be rejected based on rules
 */
function checkRejectionRules(
  value: string,
  context: { companyStage: 'new' | 'existing'; businessModel?: string; runPurpose: 'baseline' | 'refinement' }
): { reason: string; pattern: string } | null {
  // In refinement mode, be stricter
  const isStrict = context.runPurpose === 'refinement' || context.companyStage === 'existing';

  for (const [reason, patterns] of Object.entries(REJECTION_RULES)) {
    for (const pattern of patterns) {
      if (pattern.test(value)) {
        // In baseline mode for new companies, be more lenient with some patterns
        if (!isStrict && reason === 'too_generic' && context.businessModel === 'b2c') {
          // B2C baseline allows more general language
          continue;
        }
        return { reason, pattern: pattern.toString() };
      }
    }
  }

  return null;
}

// ============================================================================
// Failure Diagnostics
// ============================================================================

interface DiagnosticReport {
  scenario: string;
  passed: boolean;
  summary: string;
  details: {
    unexpectedAccepts: Array<{ field: string; value: string; expectedRejection: string }>;
    unexpectedRejects: Array<{ field: string; value: string; reason: string; pattern: string }>;
    correctAccepts: string[];
    correctRejects: string[];
  };
}

function buildDiagnosticReport(
  scenario: LabTestScenario,
  result: ExtractionResult
): DiagnosticReport {
  const report: DiagnosticReport = {
    scenario: scenario.name,
    passed: true,
    summary: '',
    details: {
      unexpectedAccepts: [],
      unexpectedRejects: [],
      correctAccepts: [],
      correctRejects: [],
    },
  };

  const expected = scenario.expectedExtraction;

  // Check accepted fields
  for (const [key] of Object.entries(expected.accepted)) {
    if (result.accepted.has(key) || result.accepted.has(`${key}_primary`)) {
      report.details.correctAccepts.push(key);
    } else if (result.rejected.has(key)) {
      const rejection = result.rejected.get(key)!;
      report.details.unexpectedRejects.push({
        field: key,
        value: String(rejection.value).slice(0, 100),
        reason: rejection.reason,
        pattern: rejection.pattern || 'unknown',
      });
      report.passed = false;
    }
  }

  // Check rejected fields
  for (const [key, expectedReason] of Object.entries(expected.rejected)) {
    if (result.rejected.has(key)) {
      report.details.correctRejects.push(key);
    } else if (result.accepted.has(key)) {
      const accepted = result.accepted.get(key)!;
      report.details.unexpectedAccepts.push({
        field: key,
        value: String(accepted.value).slice(0, 100),
        expectedRejection: expectedReason,
      });
      report.passed = false;
    }
  }

  // Build summary
  if (report.passed) {
    report.summary = `All ${report.details.correctAccepts.length} accepted, ${report.details.correctRejects.length} rejected as expected`;
  } else {
    const issues: string[] = [];
    if (report.details.unexpectedAccepts.length > 0) {
      issues.push(`${report.details.unexpectedAccepts.length} unexpected accepts`);
    }
    if (report.details.unexpectedRejects.length > 0) {
      issues.push(`${report.details.unexpectedRejects.length} unexpected rejects`);
    }
    report.summary = issues.join(', ');
  }

  return report;
}

function printDiagnosticReport(report: DiagnosticReport): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scenario: ${report.scenario}`);
  console.log(`Status: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Summary: ${report.summary}`);

  if (!report.passed) {
    if (report.details.unexpectedRejects.length > 0) {
      console.log(`\n  UNEXPECTED REJECTIONS:`);
      for (const rej of report.details.unexpectedRejects) {
        console.log(`    Field: ${rej.field}`);
        console.log(`    Value: "${rej.value}..."`);
        console.log(`    Rejected by: ${rej.reason}`);
        console.log(`    Pattern: ${rej.pattern}`);
        console.log('');
      }
    }

    if (report.details.unexpectedAccepts.length > 0) {
      console.log(`\n  UNEXPECTED ACCEPTS:`);
      for (const acc of report.details.unexpectedAccepts) {
        console.log(`    Field: ${acc.field}`);
        console.log(`    Value: "${acc.value}..."`);
        console.log(`    Should have been rejected: ${acc.expectedRejection}`);
        console.log('');
      }
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

// ============================================================================
// Tests
// ============================================================================

describe('Extractor Replay Tests', () => {
  const scenarioFilter = getScenarioFilter();
  let scenarios: LabTestScenario[];

  beforeAll(() => {
    // Get scenarios based on filter
    if (scenarioFilter?.startsWith('tag:')) {
      const tag = scenarioFilter.slice(4);
      scenarios = scenarioRegistry.getScenariosWithTag(tag);
    } else if (scenarioFilter) {
      const scenario = scenarioRegistry.getScenario(scenarioFilter);
      scenarios = scenario ? [scenario] : [];
    } else {
      scenarios = scenarioRegistry.getAllScenarios();
    }

    if (scenarios.length === 0) {
      console.warn(`No scenarios found for filter: ${scenarioFilter}`);
      console.log('Available scenarios:', scenarioRegistry.getScenarioNames());
    } else {
      console.log(`Running ${scenarios.length} scenario(s)${scenarioFilter ? ` (filter: ${scenarioFilter})` : ''}`);
    }
  });

  it('should have scenarios to test', () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  // Dynamic tests for each scenario
  describe.each(
    scenarioRegistry.getAllScenarios().map((s) => [s.name, s] as const)
  )('Scenario: %s', (name, scenario) => {
    // Skip if not in filter
    const filter = getScenarioFilter();
    const shouldRun =
      !filter ||
      filter === name ||
      (filter.startsWith('tag:') && scenario.tags?.includes(filter.slice(4)));

    it.skipIf(!shouldRun)('extracts fields correctly', () => {
      const context = toExtractionContext(
        scenario.snapshot.companyProfile,
        scenario.snapshot.runPurpose
      );

      const result = runExtractor(scenario.snapshot.rawLabOutput, context);
      const report = buildDiagnosticReport(scenario, result);

      // Print detailed diagnostics
      printDiagnosticReport(report);

      // Assert
      expect(report.details.unexpectedRejects).toHaveLength(0);
      expect(report.details.unexpectedAccepts).toHaveLength(0);
      expect(report.passed).toBe(true);
    });
  });
});

// ============================================================================
// Golden Scenario Tests
// ============================================================================

describe('Golden Scenarios (Guardrails)', () => {
  const goldenScenarios = scenarioRegistry.getGoldenScenarios();

  it('should have at least 5 golden scenarios', () => {
    expect(goldenScenarios.length).toBeGreaterThanOrEqual(5);
  });

  describe.each(goldenScenarios.map((s) => [s.name, s] as const))(
    'Golden: %s',
    (name, scenario) => {
      it('passes all extraction checks', () => {
        const context = toExtractionContext(
          scenario.snapshot.companyProfile,
          scenario.snapshot.runPurpose
        );

        const result = runExtractor(scenario.snapshot.rawLabOutput, context);
        const report = buildDiagnosticReport(scenario, result);

        if (!report.passed) {
          printDiagnosticReport(report);
        }

        expect(report.passed).toBe(true);
      });
    }
  );
});
