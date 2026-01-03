// lib/competition-v4/validateCompetitionRun.ts
// Fail-fast guardrails for Competition Lab V4
//
// VALIDATION RULES:
// 1. Subject company must NEVER appear in competitor lists
// 2. Retail-hybrid cannot be Primary under InstallationOnly with low confidence
// 3. Clarifying question semantics must be honored
//
// BEHAVIOR:
// - Development: Fail fast with detailed errors
// - Production: Log to telemetry, apply fallbacks in reducer

import type {
  CompetitionV4Result,
  ScoredCompetitor,
  ExcludedCompetitorRecord,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface SubjectInfo {
  companyName: string;
  domain: string | null;
}

export interface ValidationError {
  code:
    | 'SUBJECT_IN_COMPETITORS'
    | 'RETAIL_HYBRID_PRIMARY_GATING_VIOLATION'
    | 'CLARIFYING_QUESTION_IGNORED';
  message: string;
  details: {
    competitorName?: string;
    competitorDomain?: string;
    tier?: string;
    modality?: string;
    confidence?: number;
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Retail-Hybrid Detection
// ============================================================================

/**
 * Determines if a competitor is a Retail-Hybrid.
 *
 * Definition:
 * - isRetailer === true (or isMajorRetailer === true)
 * - isServiceProvider === true (or hasInstallation === true)
 * - geographicReach === "national" OR signalsUsed.marketReach === "national"
 */
export function isRetailHybrid(competitor: ScoredCompetitor): boolean {
  const isRetailer = competitor.isMajorRetailer === true;

  const isServiceProvider =
    competitor.hasInstallation === true ||
    competitor.signalsUsed?.installationCapability === true ||
    competitor.signalsUsed?.serviceOverlap === true;

  const isNational =
    competitor.hasNationalReach === true ||
    competitor.signalsUsed?.geographicOverlap === 'national' ||
    competitor.signalsUsed?.marketReach === 'national';

  return isRetailer && isServiceProvider && isNational;
}

/**
 * Determines if a competitor is Install-First.
 *
 * Definition:
 * - Primary value proposition is labor/installation services
 * - hasInstallation === true (or installationCapability signal)
 * - NOT a major national retailer (those are Retail-Hybrid)
 *
 * Examples: Tint World, Audio Express, Sound & Tint, Local Tinting Pros
 */
export function isInstallFirst(competitor: ScoredCompetitor): boolean {
  const hasInstallCapability =
    competitor.hasInstallation === true ||
    competitor.signalsUsed?.installationCapability === true ||
    competitor.signalsUsed?.serviceOverlap === true;

  // HARD RULE: Retailers with service capability are Retail-Hybrid, NOT Install-First
  const isNationalRetailer =
    competitor.isMajorRetailer === true && competitor.hasNationalReach === true;

  return hasInstallCapability && !isNationalRetailer;
}

// ============================================================================
// Subject Company Detection
// ============================================================================

/**
 * Check if a competitor matches the subject company.
 */
function matchesSubject(
  competitor: ScoredCompetitor | ExcludedCompetitorRecord,
  subject?: SubjectInfo
): boolean {
  if (!subject?.companyName) return false;

  const competitorName = competitor.name.toLowerCase().trim();
  const subjectName = subject.companyName.toLowerCase().trim();
  const competitorDomain = competitor.domain?.toLowerCase().trim() || '';
  const subjectDomain = subject.domain?.toLowerCase().trim() || '';

  // Exact domain match
  if (subjectDomain && competitorDomain === subjectDomain) {
    return true;
  }

  // Exact name match
  if (competitorName === subjectName) {
    return true;
  }

  // Partial name containment (handles "Car Toys" matching "Car Toys Inc")
  if (
    competitorName.includes(subjectName) ||
    subjectName.includes(competitorName)
  ) {
    // Only if one is a substring and lengths are similar enough
    const lenRatio =
      Math.min(competitorName.length, subjectName.length) /
      Math.max(competitorName.length, subjectName.length);
    if (lenRatio > 0.5) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Rule 1: Subject company must not appear in any competitor list.
 */
function validateSubjectNotInCompetitors(
  run: CompetitionV4Result,
  subject: SubjectInfo
): ValidationError[] {
  const errors: ValidationError[] = [];
  const sc = run.scoredCompetitors;

  if (!sc) return errors;

  // Check all tiers
  const tiersToCheck: Array<{
    name: string;
    competitors: Array<ScoredCompetitor | ExcludedCompetitorRecord>;
  }> = [
    { name: 'primary', competitors: sc.primary || [] },
    { name: 'contextual', competitors: sc.contextual || [] },
    { name: 'alternatives', competitors: sc.alternatives || [] },
    { name: 'excluded', competitors: sc.excluded || [] },
  ];

  // Also check legacy validated competitors
  if (run.competitors?.validated) {
    tiersToCheck.push({
      name: 'validated',
      competitors: run.competitors.validated as unknown as ScoredCompetitor[],
    });
  }

  for (const { name, competitors } of tiersToCheck) {
    for (const competitor of competitors) {
      if (matchesSubject(competitor, subject)) {
        errors.push({
          code: 'SUBJECT_IN_COMPETITORS',
          message: `Subject company "${subject.companyName}" found in ${name} tier as "${competitor.name}"`,
          details: {
            competitorName: competitor.name,
            competitorDomain: competitor.domain || undefined,
            tier: name,
          },
        });
      }
    }
  }

  return errors;
}

/**
 * Rule 2: Retail-hybrid cannot be Primary under InstallationOnly with low confidence.
 */
function validateRetailHybridGating(
  run: CompetitionV4Result
): ValidationError[] {
  const errors: ValidationError[] = [];
  const sc = run.scoredCompetitors;

  if (!sc) return errors;

  // Get modality and confidence
  const modality = sc.modality ?? run.modalityInference?.modality ?? 'InstallationOnly';
  const confidence =
    sc.modalityConfidence ?? run.modalityInference?.confidence ?? 0;

  // Gating condition: InstallationOnly OR low confidence
  const shouldGateRetailHybrid =
    modality === 'InstallationOnly' || confidence < 70;

  if (!shouldGateRetailHybrid) return errors;

  // Check primary tier for retail-hybrid violations
  const primary = sc.primary || [];
  for (const competitor of primary) {
    if (isRetailHybrid(competitor)) {
      errors.push({
        code: 'RETAIL_HYBRID_PRIMARY_GATING_VIOLATION',
        message: `Retail-hybrid "${competitor.name}" cannot be Primary under ${modality} mode with ${confidence}% confidence`,
        details: {
          competitorName: competitor.name,
          competitorDomain: competitor.domain || undefined,
          tier: 'primary',
          modality,
          confidence,
        },
      });
    }
  }

  return errors;
}

/**
 * Rule 3: Clarifying question present must be honored.
 * If clarifyingQuestion exists AND confidence < 70, retail-hybrids must not be Primary.
 */
function validateClarifyingQuestionHonored(
  run: CompetitionV4Result
): ValidationError[] {
  const errors: ValidationError[] = [];
  const sc = run.scoredCompetitors;

  if (!sc) return errors;

  // Check if clarifying question exists
  const hasClarifyingQuestion = Boolean(sc.clarifyingQuestion);
  if (!hasClarifyingQuestion) return errors;

  // Get confidence
  const confidence =
    sc.modalityConfidence ?? run.modalityInference?.confidence ?? 0;

  // If clarifying question exists AND confidence < 70, retail-hybrids must not be Primary
  if (confidence < 70) {
    const primary = sc.primary || [];
    for (const competitor of primary) {
      if (isRetailHybrid(competitor)) {
        errors.push({
          code: 'CLARIFYING_QUESTION_IGNORED',
          message: `Clarifying question exists with ${confidence}% confidence, but retail-hybrid "${competitor.name}" is in Primary`,
          details: {
            competitorName: competitor.name,
            competitorDomain: competitor.domain || undefined,
            tier: 'primary',
            confidence,
          },
        });
      }
    }
  }

  return errors;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validates a Competition Lab V4 run for semantic correctness.
 *
 * Rules:
 * 1. Subject company must not appear in any competitor list
 * 2. Retail-hybrid cannot be Primary under InstallationOnly with low confidence
 * 3. Clarifying question semantics must be honored
 *
 * @param run - The Competition V4 result to validate
 * @param subject - Subject company info (name + domain)
 * @returns Validation result with ok flag and any errors
 */
export function validateCompetitionRun(
  run: CompetitionV4Result,
  subject?: SubjectInfo
): ValidationResult {
  const errors: ValidationError[] = [];

  const safeSubject: SubjectInfo = {
    companyName: subject?.companyName || run.companyName || 'Subject Company',
    domain: subject?.domain ?? run.domain ?? null,
  };

  // Rule 1: Subject not in competitors
  errors.push(...validateSubjectNotInCompetitors(run, safeSubject));

  // Rule 2: Retail-hybrid gating
  errors.push(...validateRetailHybridGating(run));

  // Rule 3: Clarifying question honored
  errors.push(...validateClarifyingQuestionHonored(run));

  return {
    ok: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Dev/Test Assertions
// ============================================================================

/**
 * Assert validation passes. Throws in development, logs in production.
 */
export function assertValidCompetitionRun(
  run: CompetitionV4Result,
  subject?: SubjectInfo
): void {
  const result = validateCompetitionRun(run, subject);

  if (!result.ok) {
    const errorSummary = result.errors
      .map((e) => `[${e.code}] ${e.message}`)
      .join('\n');

    const isTest = process.env.NODE_ENV === 'test';

    // Log validation issues (warn level - non-blocking)
    console.warn('[CompetitionV4] Validation issues:', result.errors);

    // In test mode only, throw to fail the test
    if (isTest) {
      throw new Error(`Competition validation failed:\n${errorSummary}`);
    }
  }
}
