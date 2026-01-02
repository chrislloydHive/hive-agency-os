// lib/os/diagnostics/qualityScore.ts
// Lab Quality Score (LQS) Computation Module
//
// Quantifies the quality of lab outputs using objective criteria:
// - Evidence Anchoring: % of findings with concrete evidence
// - Specificity: % of findings referencing specific pages/issues
// - Deduplicated Signal Density: unique findings / total findings
// - Persona Diagnostic Quality: clarity of persona journeys (Website Lab only)
// - Recommendation Traceability: % of recs linked to findings
//
// This is for diagnostics and observability only - does NOT affect
// pricing, scope, or facts logic.

import {
  type LabQualityScore,
  type LabQualityInput,
  type MetricResult,
  type MetricId,
  type QualityWarning,
  type RegressionInfo,
  type QualityBand,
  type PersonaJourney,
  METRIC_THRESHOLDS,
  DEFAULT_METRIC_WEIGHTS,
  NON_WEBSITE_LAB_WEIGHTS,
  GENERIC_PHRASES,
  getQualityBand,
} from '@/lib/types/labQualityScore';

// ============================================================================
// Metric Computation Functions
// ============================================================================

/**
 * Compute Evidence Anchoring Score
 * % of findings that include concrete evidence (page URL, selector, quoted text)
 */
export function computeEvidenceAnchoring(
  findings: LabQualityInput['findings']
): MetricResult {
  if (findings.length === 0) {
    return {
      metricId: 'evidenceAnchoring',
      name: 'Evidence Anchoring',
      score: 100, // No findings = perfect score (nothing to anchor)
      passed: true,
      threshold: METRIC_THRESHOLDS.evidenceAnchoring,
      details: {
        numerator: 0,
        denominator: 0,
        context: 'No findings to evaluate',
      },
    };
  }

  let anchored = 0;
  const unanchoredExamples: string[] = [];

  for (const finding of findings) {
    const hasEvidence =
      !!finding.pageUrl ||
      !!finding.selector ||
      !!finding.quotedText;

    if (hasEvidence) {
      anchored++;
    } else if (unanchoredExamples.length < 3) {
      // Capture first 3 unanchored findings as examples
      unanchoredExamples.push(finding.text.slice(0, 80) + '...');
    }
  }

  const score = Math.round((anchored / findings.length) * 100);
  const passed = score >= METRIC_THRESHOLDS.evidenceAnchoring;

  return {
    metricId: 'evidenceAnchoring',
    name: 'Evidence Anchoring',
    score,
    passed,
    threshold: METRIC_THRESHOLDS.evidenceAnchoring,
    details: {
      numerator: anchored,
      denominator: findings.length,
      issues: unanchoredExamples.length > 0 ? unanchoredExamples : undefined,
      context: `${anchored} of ${findings.length} findings have concrete evidence`,
    },
  };
}

/**
 * Check if text contains generic phrases
 */
function containsGenericPhrase(text: string): boolean {
  const lowerText = text.toLowerCase();
  return GENERIC_PHRASES.some(phrase => lowerText.includes(phrase));
}

/**
 * Compute Specificity Score
 * % of findings that reference specific pages/competitors and avoid generic phrases
 */
export function computeSpecificity(
  findings: LabQualityInput['findings']
): MetricResult {
  if (findings.length === 0) {
    return {
      metricId: 'specificity',
      name: 'Specificity',
      score: 100,
      passed: true,
      threshold: METRIC_THRESHOLDS.specificity,
      details: {
        numerator: 0,
        denominator: 0,
        context: 'No findings to evaluate',
      },
    };
  }

  let specific = 0;
  const genericExamples: string[] = [];

  for (const finding of findings) {
    const hasSpecificReference = !!finding.specificReference || !!finding.pageUrl;
    const hasGenericPhrase = containsGenericPhrase(finding.text);

    if (hasSpecificReference && !hasGenericPhrase) {
      specific++;
    } else if (hasGenericPhrase && genericExamples.length < 3) {
      // Capture first 3 generic findings as examples
      genericExamples.push(finding.text.slice(0, 80) + '...');
    }
  }

  const score = Math.round((specific / findings.length) * 100);
  const passed = score >= METRIC_THRESHOLDS.specificity;

  return {
    metricId: 'specificity',
    name: 'Specificity',
    score,
    passed,
    threshold: METRIC_THRESHOLDS.specificity,
    details: {
      numerator: specific,
      denominator: findings.length,
      issues: genericExamples.length > 0 ? genericExamples : undefined,
      context: `${specific} of ${findings.length} findings are specific and non-generic`,
    },
  };
}

/**
 * Compute Deduplicated Signal Density
 * Unique canonical findings / total findings
 * Penalizes high duplication before dedupe
 */
export function computeDeduplicatedSignalDensity(
  findings: LabQualityInput['findings']
): MetricResult {
  if (findings.length === 0) {
    return {
      metricId: 'deduplicatedSignalDensity',
      name: 'Signal Density',
      score: 100,
      passed: true,
      threshold: METRIC_THRESHOLDS.deduplicatedSignalDensity,
      details: {
        numerator: 0,
        denominator: 0,
        context: 'No findings to evaluate',
      },
    };
  }

  // Count unique canonical hashes
  const uniqueHashes = new Set(findings.map(f => f.canonicalHash));
  const uniqueCount = uniqueHashes.size;

  // Score is ratio of unique to total
  const ratio = uniqueCount / findings.length;
  const score = Math.round(ratio * 100);
  const passed = score >= METRIC_THRESHOLDS.deduplicatedSignalDensity;

  const duplicateCount = findings.length - uniqueCount;

  return {
    metricId: 'deduplicatedSignalDensity',
    name: 'Signal Density',
    score,
    passed,
    threshold: METRIC_THRESHOLDS.deduplicatedSignalDensity,
    details: {
      numerator: uniqueCount,
      denominator: findings.length,
      context: duplicateCount > 0
        ? `${uniqueCount} unique findings, ${duplicateCount} duplicates removed`
        : `${uniqueCount} unique findings, no duplicates`,
    },
  };
}

/**
 * Compute Persona Diagnostic Quality (Website Lab only)
 * % of persona journeys with clear goal and explicit failure point
 */
export function computePersonaDiagnosticQuality(
  journeys: LabQualityInput['personaJourneys']
): MetricResult | undefined {
  if (!journeys || journeys.length === 0) {
    return undefined; // Not applicable for non-Website labs
  }

  let quality = 0;
  const weakExamples: string[] = [];

  for (const journey of journeys) {
    const hasClearGoal = journey.hasClearGoal && !!journey.goal;
    const hasFailurePoint = journey.hasExplicitFailurePoint && !!journey.failurePointPage && !!journey.failureReason;

    if (hasClearGoal && hasFailurePoint) {
      quality++;
    } else if (weakExamples.length < 3) {
      const issue = !hasClearGoal
        ? `"${journey.personaName}" lacks clear goal`
        : `"${journey.personaName}" lacks explicit failure point`;
      weakExamples.push(issue);
    }
  }

  const score = Math.round((quality / journeys.length) * 100);
  const passed = score >= METRIC_THRESHOLDS.personaDiagnosticQuality;

  return {
    metricId: 'personaDiagnosticQuality',
    name: 'Persona Diagnostics',
    score,
    passed,
    threshold: METRIC_THRESHOLDS.personaDiagnosticQuality,
    details: {
      numerator: quality,
      denominator: journeys.length,
      issues: weakExamples.length > 0 ? weakExamples : undefined,
      context: `${quality} of ${journeys.length} persona journeys have clear goals and failure points`,
    },
  };
}

/**
 * Compute Recommendation Traceability
 * % of recommendations that map 1:1 to a finding ID
 */
export function computeRecommendationTraceability(
  findings: LabQualityInput['findings'],
  recommendations: LabQualityInput['recommendations']
): MetricResult {
  if (recommendations.length === 0) {
    return {
      metricId: 'recommendationTraceability',
      name: 'Recommendation Traceability',
      score: 100, // No recommendations = nothing to trace
      passed: true,
      threshold: METRIC_THRESHOLDS.recommendationTraceability,
      details: {
        numerator: 0,
        denominator: 0,
        context: 'No recommendations to evaluate',
      },
    };
  }

  // Build set of finding IDs for quick lookup
  const findingIds = new Set(findings.map(f => f.id));

  let traceable = 0;
  const orphanExamples: string[] = [];

  for (const rec of recommendations) {
    if (rec.linkedFindingId && findingIds.has(rec.linkedFindingId)) {
      traceable++;
    } else if (orphanExamples.length < 3) {
      orphanExamples.push(rec.text.slice(0, 80) + '...');
    }
  }

  const score = Math.round((traceable / recommendations.length) * 100);
  const passed = score >= METRIC_THRESHOLDS.recommendationTraceability;

  const orphanCount = recommendations.length - traceable;

  return {
    metricId: 'recommendationTraceability',
    name: 'Recommendation Traceability',
    score,
    passed,
    threshold: METRIC_THRESHOLDS.recommendationTraceability,
    details: {
      numerator: traceable,
      denominator: recommendations.length,
      issues: orphanExamples.length > 0 ? orphanExamples : undefined,
      context: orphanCount > 0
        ? `${traceable} of ${recommendations.length} recommendations linked to findings, ${orphanCount} orphaned`
        : `All ${recommendations.length} recommendations linked to findings`,
    },
  };
}

// ============================================================================
// Composite Score Calculation
// ============================================================================

/**
 * Calculate weighted composite score
 */
function calculateCompositeScore(
  metrics: {
    evidenceAnchoring: MetricResult;
    specificity: MetricResult;
    deduplicatedSignalDensity: MetricResult;
    personaDiagnosticQuality?: MetricResult;
    recommendationTraceability: MetricResult;
  },
  labKey: string
): { score: number; weights: Partial<Record<MetricId, number>> } {
  const isWebsiteLab = labKey === 'websiteLab';
  const hasPersonaMetric = !!metrics.personaDiagnosticQuality;

  // Use appropriate weights based on lab type
  let weights: Record<string, number>;

  if (isWebsiteLab && hasPersonaMetric) {
    weights = { ...DEFAULT_METRIC_WEIGHTS };
  } else {
    // Redistribute persona weight to other metrics
    weights = { ...NON_WEBSITE_LAB_WEIGHTS } as Record<string, number>;
  }

  // Calculate weighted sum
  let totalWeight = 0;
  let weightedSum = 0;

  // Evidence Anchoring
  weightedSum += metrics.evidenceAnchoring.score * (weights.evidenceAnchoring || 0);
  totalWeight += weights.evidenceAnchoring || 0;

  // Specificity
  weightedSum += metrics.specificity.score * (weights.specificity || 0);
  totalWeight += weights.specificity || 0;

  // Deduplication
  weightedSum += metrics.deduplicatedSignalDensity.score * (weights.deduplicatedSignalDensity || 0);
  totalWeight += weights.deduplicatedSignalDensity || 0;

  // Recommendation Traceability
  weightedSum += metrics.recommendationTraceability.score * (weights.recommendationTraceability || 0);
  totalWeight += weights.recommendationTraceability || 0;

  // Persona Diagnostics (if applicable)
  if (hasPersonaMetric && weights.personaDiagnosticQuality) {
    weightedSum += metrics.personaDiagnosticQuality!.score * weights.personaDiagnosticQuality;
    totalWeight += weights.personaDiagnosticQuality;
  }

  // Normalize to 0-100
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { score, weights: weights as Partial<Record<MetricId, number>> };
}

/**
 * Generate quality warnings based on metrics
 */
function generateWarnings(
  metrics: {
    evidenceAnchoring: MetricResult;
    specificity: MetricResult;
    deduplicatedSignalDensity: MetricResult;
    personaDiagnosticQuality?: MetricResult;
    recommendationTraceability: MetricResult;
  },
  qualityBand: QualityBand
): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  // Low evidence anchoring
  if (!metrics.evidenceAnchoring.passed) {
    warnings.push({
      type: 'low_evidence',
      message: `Only ${metrics.evidenceAnchoring.score}% of findings have concrete evidence (target: ${metrics.evidenceAnchoring.threshold}%)`,
      severity: metrics.evidenceAnchoring.score < 50 ? 'error' : 'warning',
      metricId: 'evidenceAnchoring',
    });
  }

  // High % generic findings
  if (!metrics.specificity.passed) {
    warnings.push({
      type: 'generic_findings',
      message: `High % of generic findings (${100 - metrics.specificity.score}% non-specific)`,
      severity: metrics.specificity.score < 50 ? 'error' : 'warning',
      metricId: 'specificity',
    });
  }

  // High duplication
  if (!metrics.deduplicatedSignalDensity.passed) {
    const dupRate = 100 - metrics.deduplicatedSignalDensity.score;
    warnings.push({
      type: 'high_duplication',
      message: `${dupRate}% of findings are duplicates`,
      severity: dupRate > 50 ? 'error' : 'warning',
      metricId: 'deduplicatedSignalDensity',
    });
  }

  // Weak persona diagnostics
  if (metrics.personaDiagnosticQuality && !metrics.personaDiagnosticQuality.passed) {
    warnings.push({
      type: 'weak_personas',
      message: `Low persona failure clarity (${metrics.personaDiagnosticQuality.score}%)`,
      severity: metrics.personaDiagnosticQuality.score < 50 ? 'error' : 'warning',
      metricId: 'personaDiagnosticQuality',
    });
  }

  // Orphan recommendations
  if (!metrics.recommendationTraceability.passed) {
    const orphanRate = 100 - metrics.recommendationTraceability.score;
    warnings.push({
      type: 'orphan_recommendations',
      message: `${orphanRate}% of recommendations not linked to findings`,
      severity: orphanRate > 50 ? 'error' : 'warning',
      metricId: 'recommendationTraceability',
    });
  }

  return warnings;
}

/**
 * Detect regression vs previous score
 */
function detectRegression(
  currentScore: number,
  previousScore?: LabQualityScore
): RegressionInfo | undefined {
  if (!previousScore) {
    return undefined;
  }

  const diff = currentScore - previousScore.score;
  const isRegression = diff <= -10; // 10+ point drop is a regression

  return {
    isRegression,
    pointDifference: diff,
    previousScore: previousScore.score,
    previousRunId: previousScore.runId,
    previousRunAt: previousScore.computedAt,
  };
}

// ============================================================================
// Main Computation Function
// ============================================================================

/**
 * Compute complete Lab Quality Score for a lab run
 *
 * Returns null if there's insufficient data to compute a meaningful score.
 */
export function computeLabQualityScore(input: LabQualityInput): LabQualityScore | null {
  // GUARD: If no findings AND no recommendations, we can't compute a quality score
  // This prevents bogus "100" scores for labs with no extractable data
  if (input.findings.length === 0 && input.recommendations.length === 0) {
    console.warn(`[QualityScore] No findings or recommendations for ${input.labKey} run ${input.runId} - cannot compute quality score`);
    return null;
  }

  // Compute individual metrics
  const evidenceAnchoring = computeEvidenceAnchoring(input.findings);
  const specificity = computeSpecificity(input.findings);
  const deduplicatedSignalDensity = computeDeduplicatedSignalDensity(input.findings);
  const personaDiagnosticQuality = computePersonaDiagnosticQuality(input.personaJourneys);
  const recommendationTraceability = computeRecommendationTraceability(
    input.findings,
    input.recommendations
  );

  const metrics = {
    evidenceAnchoring,
    specificity,
    deduplicatedSignalDensity,
    personaDiagnosticQuality,
    recommendationTraceability,
  };

  // Calculate composite score
  const { score, weights } = calculateCompositeScore(metrics, input.labKey);
  const qualityBand = getQualityBand(score);

  // Generate warnings
  const warnings = generateWarnings(metrics, qualityBand);

  // Detect regression
  const regression = detectRegression(score, input.previousScore);

  // Generate unique ID
  const id = `lqs-${input.companyId}-${input.labKey}-${input.runId}`;

  return {
    id,
    companyId: input.companyId,
    labKey: input.labKey,
    runId: input.runId,
    computedAt: new Date().toISOString(),
    score,
    qualityBand,
    metrics,
    weights,
    warnings,
    regression,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract quality-relevant data from raw lab output
 * Transforms raw lab JSON into LabQualityInput format
 */
export function extractQualityInputFromLabRaw(
  labKey: string,
  runId: string,
  companyId: string,
  rawJson: unknown
): LabQualityInput {
  const findings: LabQualityInput['findings'] = [];
  const recommendations: LabQualityInput['recommendations'] = [];
  const personaJourneys: LabQualityInput['personaJourneys'] = [];

  if (!rawJson || typeof rawJson !== 'object') {
    return { labKey: labKey as LabQualityInput['labKey'], runId, companyId, findings, recommendations };
  }

  const raw = rawJson as Record<string, unknown>;

  // Extract findings based on lab type
  if (labKey === 'websiteLab') {
    extractWebsiteLabQualityData(raw, findings, recommendations, personaJourneys);
  } else if (labKey === 'competitionLab') {
    extractCompetitionLabQualityData(raw, findings, recommendations);
  } else if (labKey === 'brandLab') {
    extractBrandLabQualityData(raw, findings, recommendations);
  } else if (labKey === 'gapPlan') {
    extractGapPlanQualityData(raw, findings, recommendations);
  } else if (labKey === 'audienceLab') {
    extractAudienceLabQualityData(raw, findings, recommendations);
  }

  return {
    labKey: labKey as LabQualityInput['labKey'],
    runId,
    companyId,
    findings,
    recommendations,
    personaJourneys: personaJourneys.length > 0 ? personaJourneys : undefined,
  };
}

/**
 * Extract quality data from Website Lab output
 *
 * ============================================================================
 * HARD CUTOVER: V5 is the ONLY authoritative source
 * ============================================================================
 *
 * V4 fallback is DISABLED. If V5 data is missing, we log an error and return
 * empty data. This ensures we don't produce misleading quality scores from
 * stale V4 data.
 */
function extractWebsiteLabQualityData(
  raw: Record<string, unknown>,
  findings: LabQualityInput['findings'],
  recommendations: LabQualityInput['recommendations'],
  personaJourneys: PersonaJourney[]
): void {
  let findingIndex = 0;
  let recIndex = 0;

  // ============================================================================
  // V5 EXTRACTION - The ONLY authoritative source
  // ============================================================================

  // Check for V5 data at top level or in rawEvidence.labResultV4
  const v5Diagnostic = raw.v5Diagnostic as Record<string, unknown> | undefined
    || ((raw.rawEvidence as Record<string, unknown>)?.labResultV4 as Record<string, unknown>)?.v5Diagnostic as Record<string, unknown> | undefined;

  // ============================================================================
  // FAIL LOUDLY: V5 is MANDATORY for quality scoring
  // ============================================================================
  if (!v5Diagnostic) {
    console.error('[QualityScore] V5_MISSING: Website Lab V5 data is REQUIRED for quality scoring', {
      hasRawEvidence: !!raw.rawEvidence,
      hasSiteAssessment: !!raw.siteAssessment,
      topLevelKeys: Object.keys(raw).slice(0, 10),
    });
    console.error('[QualityScore] V4 fallback is DISABLED. Re-run Website Lab to generate V5 data.');
    // Return without populating - empty arrays will result in perfect scores (no data to evaluate)
    return;
  }

  console.log('[QualityScore] [WebsiteLab] V5 canonical path active');

  // Extract blocking issues as findings (V5)
  const blockingIssues = v5Diagnostic.blockingIssues as unknown[];
  if (Array.isArray(blockingIssues)) {
    for (const issue of blockingIssues) {
      if (typeof issue === 'object' && issue) {
        const issueObj = issue as Record<string, unknown>;
        const concreteFix = issueObj.concreteFix as Record<string, unknown> | undefined;
        findings.push({
          id: `finding-${findingIndex++}`,
          text: String(issueObj.whyItBlocks || ''),
          pageUrl: issueObj.page as string | undefined,
          specificReference: issueObj.page as string | undefined,
          // V5 has structured fix info which counts as evidence
          quotedText: concreteFix ? `Fix: ${concreteFix.what} at ${concreteFix.where}` : undefined,
          canonicalHash: generateSimpleHash(String(issueObj.whyItBlocks || '')),
        });
      }
    }
  }

  // Extract observations as additional findings (V5)
  const observations = v5Diagnostic.observations as unknown[];
  if (Array.isArray(observations)) {
    for (const obs of observations) {
      if (typeof obs === 'object' && obs) {
        const obsObj = obs as Record<string, unknown>;
        const missingElements = obsObj.missingUnclearElements as string[] | undefined;
        // Each missing element is a finding
        if (Array.isArray(missingElements)) {
          for (const missing of missingElements) {
            findings.push({
              id: `finding-${findingIndex++}`,
              text: missing,
              pageUrl: obsObj.pagePath as string | undefined,
              specificReference: obsObj.pagePath as string | undefined,
              canonicalHash: generateSimpleHash(missing + String(obsObj.pagePath || '')),
            });
          }
        }
      }
    }
  }

  // Extract quick wins as recommendations (V5)
  const quickWins = v5Diagnostic.quickWins as unknown[];
  if (Array.isArray(quickWins)) {
    for (const qw of quickWins) {
      if (typeof qw === 'object' && qw) {
        const qwObj = qw as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(qwObj.action || qwObj.title || ''),
          // V5 links recommendations to issues via addressesIssueId
          linkedFindingId: qwObj.addressesIssueId ? `finding-${Number(qwObj.addressesIssueId) - 1}` : undefined,
        });
      }
    }
  }

  // Extract structural changes as additional recommendations (V5)
  const structuralChanges = v5Diagnostic.structuralChanges as unknown[];
  if (Array.isArray(structuralChanges)) {
    for (const change of structuralChanges) {
      if (typeof change === 'object' && change) {
        const changeObj = change as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(changeObj.title || '') + ': ' + String(changeObj.description || ''),
          // Structural changes may address multiple issues
          linkedFindingId: Array.isArray(changeObj.addressesIssueIds) && changeObj.addressesIssueIds.length > 0
            ? `finding-${Number(changeObj.addressesIssueIds[0]) - 1}`
            : undefined,
        });
      }
    }
  }

  // Extract persona journeys (V5)
  const v5Journeys = v5Diagnostic.personaJourneys as unknown[];
  if (Array.isArray(v5Journeys)) {
    for (const journey of v5Journeys) {
      if (typeof journey === 'object' && journey) {
        const j = journey as Record<string, unknown>;
        const succeeded = j.succeeded as boolean;
        const failurePointRaw = j.failurePoint;

        // Handle failurePoint as either string (legacy) or object (preferred)
        let failurePointPage: string | undefined;
        let failureReason: string | undefined;
        if (typeof failurePointRaw === 'string') {
          // Legacy format: failurePoint is just a page path string
          failurePointPage = failurePointRaw;
          failureReason = !succeeded ? `Journey failed at ${failurePointRaw}` : undefined;
        } else if (failurePointRaw && typeof failurePointRaw === 'object') {
          // Preferred format: failurePoint is { page, reason }
          const fp = failurePointRaw as Record<string, unknown>;
          failurePointPage = fp.page as string || undefined;
          failureReason = fp.reason as string || (!succeeded ? 'Journey failed' : undefined);
        }

        personaJourneys.push({
          personaName: String(j.persona || 'Unknown'),
          goal: j.intendedGoal as string | undefined,
          failurePointPage,
          failureReason,
          hasClearGoal: !!j.intendedGoal,
          // V5 has explicit succeeded flag and failurePoint
          hasExplicitFailurePoint: !succeeded && !!failurePointRaw,
        });
      }
    }
  }

  console.log('[QualityScore] V5 extraction complete:', {
    findings: findings.length,
    recommendations: recommendations.length,
    personaJourneys: personaJourneys.length,
  });
}

/**
 * Extract quality data from Competition Lab output
 */
function extractCompetitionLabQualityData(
  raw: Record<string, unknown>,
  findings: LabQualityInput['findings'],
  recommendations: LabQualityInput['recommendations']
): void {
  let findingIndex = 0;
  let recIndex = 0;

  // Check for V4 format (has scoredCompetitors with version: 4)
  const isV4 = raw.version === 4 && raw.scoredCompetitors;

  if (isV4) {
    // V4 format: Extract from scoredCompetitors buckets
    const scored = raw.scoredCompetitors as Record<string, unknown>;
    const allCompetitors = [
      ...((scored.primary || []) as Array<Record<string, unknown>>),
      ...((scored.contextual || []) as Array<Record<string, unknown>>),
      ...((scored.alternatives || []) as Array<Record<string, unknown>>),
    ];

    for (const comp of allCompetitors) {
      // Create finding with rich evidence from V4 data
      const reasons = Array.isArray(comp.reasons) ? (comp.reasons as string[]).join('; ') : '';
      const whyThisMatters = comp.whyThisMatters as string | undefined;
      const classification = comp.classification as string;
      const overlapScore = comp.overlapScore as number;

      const findingText = [
        `${comp.name} (${classification}, ${overlapScore}% overlap)`,
        whyThisMatters || '',
        reasons,
      ].filter(Boolean).join(' - ');

      findings.push({
        id: `finding-${findingIndex++}`,
        text: findingText,
        pageUrl: comp.domain as string | undefined,
        specificReference: comp.name as string | undefined,
        // V4 has structured signals as evidence
        quotedText: comp.signalsUsed ? JSON.stringify(comp.signalsUsed) : undefined,
        canonicalHash: generateSimpleHash(String(comp.name) + String(comp.domain || '')),
      });
    }

    // Extract summary insights as recommendations
    const summary = raw.summary as Record<string, unknown> | undefined;
    if (summary) {
      // Competitive positioning as recommendation
      if (summary.competitive_positioning) {
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(summary.competitive_positioning),
        });
      }

      // Differentiation axes as recommendations
      if (Array.isArray(summary.key_differentiation_axes)) {
        for (const axis of summary.key_differentiation_axes) {
          recommendations.push({
            id: `rec-${recIndex++}`,
            text: `Differentiation: ${String(axis)}`,
          });
        }
      }

      // Competitive risks as findings
      if (Array.isArray(summary.competitive_risks)) {
        for (const risk of summary.competitive_risks) {
          findings.push({
            id: `finding-${findingIndex++}`,
            text: `Risk: ${String(risk)}`,
            canonicalHash: generateSimpleHash(`risk:${String(risk)}`),
          });
        }
      }
    }

    // Modality inference as a finding (quality signal)
    const modalityInference = raw.modalityInference as Record<string, unknown> | undefined;
    if (modalityInference && modalityInference.modality) {
      findings.push({
        id: `finding-${findingIndex++}`,
        text: `Competitive Modality: ${modalityInference.modality} (${modalityInference.confidence}% confidence)`,
        quotedText: modalityInference.explanation as string | undefined,
        canonicalHash: generateSimpleHash(`modality:${modalityInference.modality}`),
      });
    }
  } else {
    // V3 format: Legacy extraction
    // Competitors as findings
    if (Array.isArray(raw.competitors)) {
      for (const comp of raw.competitors) {
        if (typeof comp === 'object' && comp) {
          const c = comp as Record<string, unknown>;
          findings.push({
            id: `finding-${findingIndex++}`,
            text: String(c.name || '') + ': ' + String(c.analysis || c.summary || ''),
            pageUrl: c.website as string | undefined,
            specificReference: c.name as string | undefined,
            canonicalHash: generateSimpleHash(String(c.name || '') + String(c.analysis || '')),
          });
        }
      }
    }

    // Insights as findings
    if (Array.isArray(raw.insights)) {
      for (const insight of raw.insights) {
        if (typeof insight === 'object' && insight) {
          const i = insight as Record<string, unknown>;
          findings.push({
            id: `finding-${findingIndex++}`,
            text: String(i.text || i.insight || i.description || ''),
            specificReference: i.competitor as string | undefined,
            canonicalHash: generateSimpleHash(String(i.text || i.insight || '')),
          });
        } else if (typeof insight === 'string') {
          findings.push({
            id: `finding-${findingIndex++}`,
            text: insight,
            canonicalHash: generateSimpleHash(insight),
          });
        }
      }
    }
  }

  // Recommendations (common to both V3 and V4)
  if (Array.isArray(raw.recommendations)) {
    for (const rec of raw.recommendations) {
      if (typeof rec === 'object' && rec) {
        const r = rec as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(r.text || r.recommendation || r.description || ''),
          linkedFindingId: r.insightId as string | undefined,
        });
      } else if (typeof rec === 'string') {
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: rec,
        });
      }
    }
  }
}

/**
 * Extract quality data from Brand Lab output
 */
function extractBrandLabQualityData(
  raw: Record<string, unknown>,
  findings: LabQualityInput['findings'],
  recommendations: LabQualityInput['recommendations']
): void {
  let findingIndex = 0;
  let recIndex = 0;

  // Issues as findings
  if (Array.isArray(raw.issues)) {
    for (const issue of raw.issues) {
      if (typeof issue === 'object' && issue) {
        const i = issue as Record<string, unknown>;
        findings.push({
          id: `finding-${findingIndex++}`,
          text: String(i.description || i.text || i.issue || ''),
          pageUrl: i.url as string | undefined,
          quotedText: i.evidence as string | undefined,
          canonicalHash: generateSimpleHash(String(i.description || i.text || '')),
        });
      } else if (typeof issue === 'string') {
        findings.push({
          id: `finding-${findingIndex++}`,
          text: issue,
          canonicalHash: generateSimpleHash(issue),
        });
      }
    }
  }

  // Extract from findings object
  const findingsObj = raw.findings as Record<string, unknown> | undefined;
  if (findingsObj) {
    const extractFromArray = (arr: unknown[], prefix: string) => {
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'object' && item) {
            const i = item as Record<string, unknown>;
            findings.push({
              id: `finding-${findingIndex++}`,
              text: String(i.description || i.text || ''),
              specificReference: prefix,
              canonicalHash: generateSimpleHash(prefix + String(i.description || i.text || '')),
            });
          } else if (typeof item === 'string') {
            findings.push({
              id: `finding-${findingIndex++}`,
              text: item,
              specificReference: prefix,
              canonicalHash: generateSimpleHash(prefix + item),
            });
          }
        }
      }
    };

    extractFromArray(findingsObj.inconsistencies as unknown[], 'Inconsistency');
    extractFromArray(findingsObj.opportunities as unknown[], 'Opportunity');
    extractFromArray(findingsObj.risks as unknown[], 'Risk');
  }

  // Quick wins as recommendations
  if (Array.isArray(raw.quickWins)) {
    for (const win of raw.quickWins) {
      if (typeof win === 'object' && win) {
        const w = win as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(w.description || w.text || w.action || ''),
          linkedFindingId: w.issueId as string | undefined,
        });
      } else if (typeof win === 'string') {
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: win,
        });
      }
    }
  }

  // Projects as recommendations
  if (Array.isArray(raw.projects)) {
    for (const proj of raw.projects) {
      if (typeof proj === 'object' && proj) {
        const p = proj as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(p.name || '') + ': ' + String(p.description || ''),
        });
      }
    }
  }
}

/**
 * Extract quality data from GAP Plan output
 */
function extractGapPlanQualityData(
  raw: Record<string, unknown>,
  findings: LabQualityInput['findings'],
  recommendations: LabQualityInput['recommendations']
): void {
  let findingIndex = 0;
  let recIndex = 0;

  const gapStructured = raw.gapStructured as Record<string, unknown> | undefined;

  // Primary offers as findings
  if (gapStructured && Array.isArray(gapStructured.primaryOffers)) {
    for (const offer of gapStructured.primaryOffers) {
      if (typeof offer === 'object' && offer) {
        const o = offer as Record<string, unknown>;
        findings.push({
          id: `finding-${findingIndex++}`,
          text: String(o.name || '') + ': ' + String(o.description || ''),
          specificReference: 'Primary Offer',
          canonicalHash: generateSimpleHash('offer' + String(o.name || '')),
        });
      }
    }
  }

  // Competitors as findings
  if (gapStructured && Array.isArray(gapStructured.competitors)) {
    for (const comp of gapStructured.competitors) {
      if (typeof comp === 'object' && comp) {
        const c = comp as Record<string, unknown>;
        findings.push({
          id: `finding-${findingIndex++}`,
          text: String(c.name || '') + ': ' + String(c.positioning || c.analysis || ''),
          pageUrl: c.url as string | undefined,
          specificReference: c.name as string | undefined,
          canonicalHash: generateSimpleHash('comp' + String(c.name || '')),
        });
      }
    }
  }

  // Audience summary as finding
  if (gapStructured?.audienceSummary) {
    findings.push({
      id: `finding-${findingIndex++}`,
      text: String(gapStructured.audienceSummary),
      specificReference: 'Audience',
      canonicalHash: generateSimpleHash('audience' + String(gapStructured.audienceSummary)),
    });
  }

  // Initiatives as recommendations
  if (Array.isArray(raw.initiatives)) {
    for (const init of raw.initiatives) {
      if (typeof init === 'object' && init) {
        const i = init as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(i.name || '') + ': ' + String(i.description || ''),
          linkedFindingId: i.relatedFindingId as string | undefined,
        });
      }
    }
  }

  // Recommendations array
  if (Array.isArray(raw.recommendations)) {
    for (const rec of raw.recommendations) {
      if (typeof rec === 'object' && rec) {
        const r = rec as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(r.text || r.description || ''),
          linkedFindingId: r.findingId as string | undefined,
        });
      } else if (typeof rec === 'string') {
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: rec,
        });
      }
    }
  }
}

/**
 * Extract quality data from Audience Lab output
 */
function extractAudienceLabQualityData(
  raw: Record<string, unknown>,
  findings: LabQualityInput['findings'],
  recommendations: LabQualityInput['recommendations']
): void {
  let findingIndex = 0;
  let recIndex = 0;

  // Issues as findings
  if (Array.isArray(raw.issues)) {
    for (const issue of raw.issues) {
      if (typeof issue === 'string' && issue.trim()) {
        findings.push({
          id: `finding-${findingIndex++}`,
          text: issue,
          specificReference: 'Audience Issue',
          canonicalHash: generateSimpleHash('audience-issue' + issue),
        });
      }
    }
  }

  // Audience segments as findings (with evidence)
  if (Array.isArray(raw.audienceSegments)) {
    for (const segment of raw.audienceSegments) {
      if (typeof segment === 'object' && segment) {
        const s = segment as Record<string, unknown>;
        const label = String(s.label || s.key || 'Unknown');
        const description = String(s.description || '');
        const whyExists = String(s.whyThisSegmentExists || '');

        // Each segment is a finding
        findings.push({
          id: `finding-${findingIndex++}`,
          text: `${label}: ${description}${whyExists ? ` (${whyExists})` : ''}`,
          specificReference: label,
          canonicalHash: generateSimpleHash('segment' + label),
        });

        // Evidence from segments counts as anchored findings
        const evidence = s.evidence as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(evidence)) {
          for (const e of evidence) {
            if (typeof e === 'object' && e) {
              findings.push({
                id: `finding-${findingIndex++}`,
                text: String(e.snippet || ''),
                pageUrl: e.sourceUrl as string | undefined,
                specificReference: label,
                quotedText: String(e.snippet || ''),
                canonicalHash: generateSimpleHash(label + String(e.snippet || '')),
              });
            }
          }
        }
      }
    }
  }

  // Signals as findings (each signal array element is evidence)
  const signals = raw.signals as Record<string, unknown> | undefined;
  if (signals && typeof signals === 'object') {
    const signalCategories = [
      { key: 'diySignals', ref: 'DIY Signal' },
      { key: 'doneForMeSignals', ref: 'Done-for-Me Signal' },
      { key: 'localSignals', ref: 'Local Signal' },
      { key: 'researchSignals', ref: 'Research Signal' },
      { key: 'trustSignals', ref: 'Trust Signal' },
      { key: 'proximitySignals', ref: 'Proximity Signal' },
    ];

    for (const { key, ref } of signalCategories) {
      const signalArray = signals[key] as string[] | undefined;
      if (Array.isArray(signalArray)) {
        for (const signal of signalArray) {
          if (typeof signal === 'string' && signal.trim()) {
            findings.push({
              id: `finding-${findingIndex++}`,
              text: signal,
              specificReference: ref,
              canonicalHash: generateSimpleHash(ref + signal),
            });
          }
        }
      }
    }
  }

  // Recommendations
  if (Array.isArray(raw.recommendations)) {
    for (const rec of raw.recommendations) {
      if (typeof rec === 'string' && rec.trim()) {
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: rec,
          // Try to link to an issue if the recommendation text matches
          linkedFindingId: findMatchingFinding(findings, rec),
        });
      } else if (typeof rec === 'object' && rec) {
        const r = rec as Record<string, unknown>;
        recommendations.push({
          id: `rec-${recIndex++}`,
          text: String(r.text || r.description || ''),
          linkedFindingId: r.issueId as string | undefined,
        });
      }
    }
  }

  console.log('[QualityScore] [AudienceLab] Extraction complete:', {
    findings: findings.length,
    recommendations: recommendations.length,
  });
}

/**
 * Try to find a matching finding for a recommendation (simple text matching)
 */
function findMatchingFinding(
  findings: LabQualityInput['findings'],
  recText: string
): string | undefined {
  const recLower = recText.toLowerCase();
  // Look for a finding that shares significant keywords with the recommendation
  for (const finding of findings) {
    const findingLower = finding.text.toLowerCase();
    // Simple overlap check - if they share 3+ words, consider it a match
    const recWords = new Set(recLower.split(/\s+/).filter(w => w.length > 3));
    const findingWords = findingLower.split(/\s+/).filter(w => w.length > 3);
    const overlap = findingWords.filter(w => recWords.has(w)).length;
    if (overlap >= 3) {
      return finding.id;
    }
  }
  return undefined;
}

/**
 * Generate simple hash for deduplication
 */
function generateSimpleHash(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================================================
// Exports for Testing
// ============================================================================

export {
  containsGenericPhrase,
  generateSimpleHash,
  extractWebsiteLabQualityData,
  extractCompetitionLabQualityData,
  extractBrandLabQualityData,
  extractGapPlanQualityData,
  extractAudienceLabQualityData,
};
