// lib/diagnostics/brand-lab/validation.ts
// Brand Lab Diagnostic Validation
//
// Detects when the LLM diagnostic returned a fallback/scaffold result
// instead of a real analysis. This prevents fake 50/100 diagnostics
// from being presented to users as valid results.

// ============================================================================
// Types
// ============================================================================

/**
 * Raw diagnostic response from V1 engine
 */
export interface BrandLabRawDiagnostic {
  diagnostic?: any;
  actionPlan?: any;
}

/**
 * Validation result indicating whether the diagnostic failed
 */
export interface BrandLabValidationResult {
  failed: boolean;
  reasons: string[];
}

// ============================================================================
// Failure Detection
// ============================================================================

/**
 * Detect if a Brand Lab diagnostic is actually a fallback/failed result.
 *
 * This inspects the raw V1 diagnostic and looks for telltale signs of
 * the fallback scaffold:
 * - Explicit failure language in summary or gaps
 * - "Unknown" values in major themes
 * - No brand pillars + no value props + generic score
 * - Zero findings with generic summary
 *
 * Returns { failed: true, reasons: [...] } if the diagnostic is invalid.
 */
export function detectBrandLabFailure(raw: BrandLabRawDiagnostic): BrandLabValidationResult {
  const reasons: string[] = [];

  const diag = raw.diagnostic ?? {};
  const actionPlan = raw.actionPlan ?? raw.diagnostic?.actionPlan ?? {};

  const summary: string = diag.summary ?? '';
  const overallScore = typeof diag.score === 'number' ? diag.score : undefined;

  const identitySystem = diag.identitySystem ?? {};
  const messagingSystem = diag.messagingSystem ?? {};
  const positioning = diag.positioning ?? {};
  const trustAndProof = diag.trustAndProof ?? {};
  const visualSystem = diag.visualSystem ?? {};
  const audienceFit = diag.audienceFit ?? {};
  const brandPillars = Array.isArray(diag.brandPillars) ? diag.brandPillars : [];

  const identityGaps: string[] = identitySystem.identityGaps ?? [];
  const clarityIssues: string[] = messagingSystem.clarityIssues ?? [];
  const positioningRisks: string[] = positioning.positioningRisks ?? [];
  const credibilityGaps: string[] = trustAndProof.credibilityGaps ?? [];
  const visualGaps: string[] = visualSystem.visualGaps ?? [];
  const misalignmentNotes: string[] = audienceFit.misalignmentNotes ?? [];

  // -------------------------------------------------------------------------
  // Heuristic 1: Explicit failure language in summary or gaps
  // -------------------------------------------------------------------------
  const failurePhrases = [
    'Unable to complete full brand analysis',
    'Unable to analyze - LLM diagnostic failed',
    'Analysis incomplete',
    'Visual analysis unavailable',
    'Basic diagnostic generated',
    'Full analysis unavailable',
    'Unable to assess positioning',
    'Limited asset analysis available',
    'Competitive analysis incomplete',
    'Competitive analysis failed',
    'Analysis unavailable',
  ];

  const textFieldsToScan: string[] = [
    summary,
    ...identityGaps,
    ...clarityIssues,
    ...positioningRisks,
    ...credibilityGaps,
    ...visualGaps,
    ...misalignmentNotes,
  ].filter(Boolean);

  const hasFailureLanguage = textFieldsToScan.some((text) =>
    failurePhrases.some((phrase) => text.toLowerCase().includes(phrase.toLowerCase()))
  );

  if (hasFailureLanguage) {
    reasons.push('LLM reported incomplete or failed analysis (failure language detected).');
  }

  // -------------------------------------------------------------------------
  // Heuristic 2: All major themes unknown or generic
  // -------------------------------------------------------------------------
  const positioningTheme = positioning.positioningTheme ?? '';
  const competitiveAngle = positioning.competitiveAngle ?? '';
  const trustArchetype = trustAndProof.trustArchetype ?? '';
  const paletteDescriptor = visualSystem.paletteDescriptor ?? '';
  const primaryICPDescription = audienceFit.primaryICPDescription ?? '';

  const unknownStrings = ['unknown', 'n/a', 'not available', 'unavailable'];

  function looksUnknown(value: string): boolean {
    if (!value) return true;
    const lower = value.toLowerCase().trim();
    return (
      unknownStrings.some((token) => lower === token) ||
      lower.includes('unable to assess') ||
      lower.includes('analysis unavailable')
    );
  }

  const unknownPositioning = looksUnknown(positioningTheme) && looksUnknown(competitiveAngle);
  const unknownAudience = looksUnknown(primaryICPDescription);
  const unknownVisual = looksUnknown(paletteDescriptor);
  const unknownTrust = looksUnknown(trustArchetype);

  const unknownMajorBlocksCount = [unknownPositioning, unknownAudience, unknownVisual, unknownTrust].filter(
    Boolean
  ).length;

  if (unknownMajorBlocksCount >= 3) {
    reasons.push('Most core brand blocks (positioning, audience, visual, trust) are unknown.');
  }

  // -------------------------------------------------------------------------
  // Heuristic 3: No pillars AND no value props AND overall score ~50
  // -------------------------------------------------------------------------
  const valueProps = Array.isArray(messagingSystem.valueProps) ? messagingSystem.valueProps : [];
  const differentiators = Array.isArray(messagingSystem.differentiators) ? messagingSystem.differentiators : [];
  const hasAnyPillarsOrValueProps = brandPillars.length > 0 || valueProps.length > 0 || differentiators.length > 0;

  // Check for default-looking score (exactly 50, or all dimension scores are 50)
  const isDefaultScore = overallScore === 50;
  const allCoreScoresAreFifty =
    identitySystem.taglineClarityScore === 50 &&
    identitySystem.corePromiseClarityScore === 50 &&
    messagingSystem.messagingFocusScore === 50 &&
    positioning.positioningClarityScore === 50;

  if (!hasAnyPillarsOrValueProps && (isDefaultScore || allCoreScoresAreFifty)) {
    reasons.push('No brand pillars, value props, or differentiators with default-looking scores.');
  }

  // -------------------------------------------------------------------------
  // Heuristic 4: Zero inconsistencies/opportunities/risks AND generic summary
  // -------------------------------------------------------------------------
  const inconsistencies = Array.isArray(diag.inconsistencies) ? diag.inconsistencies : [];
  const opportunities = Array.isArray(diag.opportunities) ? diag.opportunities : [];
  const risks = Array.isArray(diag.risks) ? diag.risks : [];

  const genericSummaryPhrases = [
    'Basic diagnostic generated',
    'Unable to complete full brand analysis',
    'Brand has a foundation but lacks clarity and differentiation. 0 inconsistencies found. 0 opportunities identified.',
  ];

  const hasGenericSummary = genericSummaryPhrases.some((p) => summary.toLowerCase().includes(p.toLowerCase()));

  if (hasGenericSummary && inconsistencies.length === 0 && opportunities.length === 0 && risks.length === 0) {
    reasons.push('Generic summary with no inconsistencies/opportunities/risks suggests fallback output.');
  }

  // -------------------------------------------------------------------------
  // Heuristic 5: Empty or near-empty action plan
  // -------------------------------------------------------------------------
  const nowItems = Array.isArray(actionPlan.now) ? actionPlan.now : [];
  const nextItems = Array.isArray(actionPlan.next) ? actionPlan.next : [];
  const laterItems = Array.isArray(actionPlan.later) ? actionPlan.later : [];
  const totalActionItems = nowItems.length + nextItems.length + laterItems.length;

  // If we have failure language AND no action items, this is definitely a fallback
  if (hasFailureLanguage && totalActionItems === 0) {
    reasons.push('No action plan items generated alongside failure indicators.');
  }

  // -------------------------------------------------------------------------
  // Final Decision
  // -------------------------------------------------------------------------
  const failed = reasons.length > 0;

  return { failed, reasons };
}

// ============================================================================
// Quick Validation Check
// ============================================================================

/**
 * Quick check to see if a V1 result looks like a fallback.
 * Less thorough than detectBrandLabFailure but faster for logging.
 */
export function isBrandLabFallback(v1Result: BrandLabRawDiagnostic): boolean {
  const diag = v1Result.diagnostic ?? {};
  const summary: string = diag.summary ?? '';
  const score = diag.score;

  // Quick checks
  if (summary.toLowerCase().includes('unable to complete full brand analysis')) return true;
  if (summary.toLowerCase().includes('basic diagnostic generated')) return true;
  if (score === 50 && !Array.isArray(diag.brandPillars) || (diag.brandPillars?.length === 0)) return true;

  return false;
}
