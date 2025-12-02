// lib/brandLab/normalizeBrandLab.ts
// Brand Lab V2 Normalizer
//
// Transforms raw Brand Lab JSON into a normalized structure that:
// A) Ensures stable scores from JSON (no recalculation)
// B) Deduplicates quick wins and projects
// C) Removes fallback/incomplete analysis artifacts
// D) Maps dimension summaries correctly
// E) Sources maturityStage directly from JSON

import {
  type NormalizedBrandLabResult,
  type BrandDimension,
  type BrandIssue,
  type BrandQuickWin,
  type BrandProject,
  type BrandPillar,
  type BrandPositioning,
  type BrandMessaging,
  type BrandIdentity,
  type BrandTrust,
  type BrandAudienceFit,
  type BrandDataConfidence,
  type BrandMaturityStage,
  type BrandIssueSeverity,
  type BrandDimensionKey,
  DIMENSION_LABELS,
} from './brandLabTypes';

// ============================================================================
// Deduplication Helper
// ============================================================================

/**
 * Deduplicate array by title/action field
 * Returns unique items, keeping the first occurrence
 */
function dedupeByTitle<T extends { title?: string; action?: string }>(arr: T[]): T[] {
  const map = new Map<string, T>();
  arr.forEach((item) => {
    const key = (item.title || item.action || '').toLowerCase().trim();
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

// ============================================================================
// Fallback Detection
// ============================================================================

const FALLBACK_PHRASES = [
  'unable to complete full brand analysis',
  'unable to analyze - llm diagnostic failed',
  'analysis incomplete',
  'visual analysis unavailable',
  'basic diagnostic generated',
  'full analysis unavailable',
  'unable to assess positioning',
  'limited asset analysis available',
  'competitive analysis incomplete',
  'competitive analysis failed',
  'analysis unavailable',
];

/**
 * Check if a string contains fallback/incomplete analysis language
 */
function containsFallbackLanguage(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FALLBACK_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Filter out items with fallback language
 */
function filterFallbackItems<T extends { title?: string; description?: string; action?: string }>(
  items: T[]
): T[] {
  return items.filter((item) => {
    const text = `${item.title || ''} ${item.description || ''} ${item.action || ''}`;
    return !containsFallbackLanguage(text);
  });
}

// ============================================================================
// Score Validation
// ============================================================================

/**
 * Ensure score is a valid number between 0-100
 */
function validateScore(score: any, fallback: number = 50): number {
  if (typeof score === 'number' && !isNaN(score)) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  return fallback;
}

/**
 * Get status from score
 */
function getStatusFromScore(score: number): 'weak' | 'moderate' | 'strong' {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

// ============================================================================
// Main Normalizer
// ============================================================================

/**
 * Normalize Brand Lab result from raw JSON
 *
 * This function:
 * 1. Extracts scores directly from JSON (no recalculation)
 * 2. Deduplicates quick wins and projects
 * 3. Removes fallback/incomplete analysis artifacts
 * 4. Maps dimensions with standardized labels
 * 5. Sources maturityStage directly from JSON
 */
export function normalizeBrandLab(rawResult: any): NormalizedBrandLabResult {
  // Handle both V1 (diagnostic wrapper) and V2 (flat) formats
  const content = rawResult.diagnostic || rawResult;
  const findings = content.findings || {};
  const actionPlan = rawResult.actionPlan || content.actionPlan || {};

  // =========================================================================
  // A) Core Metrics - Directly from JSON
  // =========================================================================

  const overallScore = validateScore(content.overallScore ?? content.score, 50);

  // Maturity stage - directly from JSON, no inference
  const maturityStage: BrandMaturityStage =
    content.maturityStage ||
    (overallScore >= 85
      ? 'established'
      : overallScore >= 70
        ? 'scaling'
        : overallScore >= 50
          ? 'emerging'
          : 'unproven');

  // Data confidence - directly from JSON
  const dataConfidence: BrandDataConfidence = {
    score: validateScore(content.dataConfidence?.score, 50),
    level: content.dataConfidence?.level || 'medium',
    reason: content.dataConfidence?.reason || '',
  };

  // Narrative summary - directly from JSON, no regeneration
  const narrativeSummary = content.narrativeSummary || content.summary || '';

  // =========================================================================
  // B) Dimensions - With Standardized Labels
  // =========================================================================

  const dimensions: BrandDimension[] = [];

  if (content.dimensions && Array.isArray(content.dimensions)) {
    // V2 format: dimensions array
    content.dimensions.forEach((dim: any) => {
      const key = dim.key as BrandDimensionKey;
      const label = DIMENSION_LABELS[key] || dim.label || key;
      const score = validateScore(dim.score);

      dimensions.push({
        key,
        label,
        score,
        status: getStatusFromScore(score),
        summary: dim.summary || '',
      });
    });
  } else {
    // V1 format: extract from subsystems
    const v1Mappings: Array<{ key: BrandDimensionKey; source: string; scoreFields: string[] }> = [
      { key: 'identity', source: 'identitySystem', scoreFields: ['taglineClarityScore', 'corePromiseClarityScore'] },
      { key: 'messaging', source: 'messagingSystem', scoreFields: ['messagingFocusScore', 'icpClarityScore'] },
      { key: 'positioning', source: 'positioning', scoreFields: ['positioningClarityScore'] },
      { key: 'audienceFit', source: 'audienceFit', scoreFields: ['alignmentScore'] },
      { key: 'trust', source: 'trustAndProof', scoreFields: ['trustSignalsScore', 'humanPresenceScore'] },
      { key: 'visual', source: 'visualSystem', scoreFields: ['visualConsistencyScore'] },
      { key: 'assets', source: 'brandAssets', scoreFields: ['assetCoverageScore'] },
      { key: 'consistency', source: 'brandConsistency', scoreFields: ['consistencyScore'] },
    ];

    v1Mappings.forEach(({ key, source, scoreFields }) => {
      const subsystem = content[source] || findings[source];
      if (subsystem) {
        const scores = scoreFields.map((f) => subsystem[f]).filter((v): v is number => typeof v === 'number');
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;

        dimensions.push({
          key,
          label: DIMENSION_LABELS[key],
          score: avgScore,
          status: getStatusFromScore(avgScore),
          summary: '',
        });
      }
    });
  }

  // =========================================================================
  // C) Issues - Sorted by Severity then Category
  // =========================================================================

  let issues: BrandIssue[] = [];

  if (content.issues && Array.isArray(content.issues)) {
    issues = content.issues
      .filter((issue: any) => issue?.title && !containsFallbackLanguage(issue.title))
      .map((issue: any, idx: number) => ({
        id: issue.id || `issue-${idx}`,
        title: issue.title,
        description: issue.description || '',
        severity: (issue.severity as BrandIssueSeverity) || 'medium',
        category: (issue.category as BrandDimensionKey) || 'identity',
      }));
  }

  // Sort: high -> medium -> low, then alphabetically by category
  const severityOrder: Record<BrandIssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.category.localeCompare(b.category);
  });

  // =========================================================================
  // D) Quick Wins - Deduped
  // =========================================================================

  let quickWins: BrandQuickWin[] = [];

  if (content.quickWins && Array.isArray(content.quickWins)) {
    quickWins = content.quickWins.map((qw: any, idx: number) => ({
      id: qw.id || `qw-${idx}`,
      action: qw.action || qw.title || '',
      category: qw.category || 'brand',
      expectedImpact: qw.expectedImpact || 'medium',
      effortLevel: qw.effortLevel || 'low',
    }));
  } else if (actionPlan.now && Array.isArray(actionPlan.now)) {
    quickWins = actionPlan.now.slice(0, 5).map((item: any, idx: number) => ({
      id: item.id || `qw-${idx}`,
      action: item.title || item.description || '',
      category: item.dimension || item.serviceArea || 'brand',
      expectedImpact: item.impactScore >= 4 ? 'high' : item.impactScore >= 2 ? 'medium' : 'low',
      effortLevel: item.effortScore <= 2 ? 'low' : item.effortScore <= 3 ? 'medium' : 'high',
    }));
  }

  // Filter fallback items and dedupe
  quickWins = filterFallbackItems(quickWins);
  quickWins = dedupeByTitle(quickWins);

  // =========================================================================
  // E) Projects - Deduped
  // =========================================================================

  let projects: BrandProject[] = [];

  if (content.projects && Array.isArray(content.projects)) {
    projects = content.projects.map((proj: any, idx: number) => ({
      id: proj.id || `proj-${idx}`,
      title: proj.title || '',
      description: proj.description || '',
      category: proj.category || 'brand',
      impact: proj.impact || 'medium',
      timeHorizon: proj.timeHorizon || 'mid-term',
    }));
  }

  // Filter fallback items and dedupe
  projects = filterFallbackItems(projects);
  projects = dedupeByTitle(projects);

  // Remove projects that duplicate quick wins
  const quickWinTitles = new Set(quickWins.map((qw) => qw.action.toLowerCase().trim()));
  projects = projects.filter((proj) => !quickWinTitles.has(proj.title.toLowerCase().trim()));

  // =========================================================================
  // F) Top Opportunities - Deduped, Limited to 5
  // =========================================================================

  const topOpportunities: Array<{ title: string; type: 'quickWin' | 'project' }> = [];
  const seenTitles = new Set<string>();

  // Add quick wins first
  quickWins.forEach((qw) => {
    const key = qw.action.toLowerCase().trim();
    if (!seenTitles.has(key) && topOpportunities.length < 5) {
      seenTitles.add(key);
      topOpportunities.push({ title: qw.action, type: 'quickWin' });
    }
  });

  // Then add projects
  projects.forEach((proj) => {
    const key = proj.title.toLowerCase().trim();
    if (!seenTitles.has(key) && topOpportunities.length < 5) {
      seenTitles.add(key);
      topOpportunities.push({ title: proj.title, type: 'project' });
    }
  });

  // =========================================================================
  // G) Brand Pillars
  // =========================================================================

  let brandPillars: BrandPillar[] = [];

  const pillarsSource = content.brandPillars || findings.brandPillars;
  if (pillarsSource && Array.isArray(pillarsSource)) {
    brandPillars = pillarsSource
      .filter((p: any) => p?.name)
      .map((p: any) => ({
        name: p.name,
        description: p.description || '',
        strengthScore: validateScore(p.strengthScore, 50),
        isExplicit: p.isExplicit ?? false,
        isPerceived: p.isPerceived ?? false,
      }));
  }

  // =========================================================================
  // H) Positioning - Directly from JSON
  // =========================================================================

  const positioningSource = findings.positioning || content.positioning || {};
  const positioning: BrandPositioning = {
    theme: positioningSource.positioningTheme || positioningSource.theme || positioningSource.statement || '',
    competitiveAngle: positioningSource.competitiveAngle || positioningSource.category || '',
    clarityScore: validateScore(positioningSource.positioningClarityScore || positioningSource.clarityScore, 50),
    risks: Array.isArray(positioningSource.positioningRisks)
      ? positioningSource.positioningRisks.filter((r: any) => r && !containsFallbackLanguage(r))
      : [],
  };

  // =========================================================================
  // I) Messaging - Directly from JSON
  // =========================================================================

  const messagingSource = findings.messagingSystem || content.messagingSystem || content.messaging || {};
  const messaging: BrandMessaging = {
    benefitVsFeature: validateScore(messagingSource.benefitVsFeatureRatio, 50),
    icpClarity: validateScore(messagingSource.icpClarityScore, 50),
    messagingFocus: validateScore(messagingSource.messagingFocusScore, 50),
    valueProps: Array.isArray(messagingSource.valueProps)
      ? messagingSource.valueProps.map((vp: any) => ({
          statement: typeof vp === 'string' ? vp : vp.statement || '',
          clarityScore: typeof vp === 'object' ? vp.clarityScore : undefined,
          uniquenessScore: typeof vp === 'object' ? vp.uniquenessScore : undefined,
        }))
      : [],
    clarityIssues: Array.isArray(messagingSource.clarityIssues)
      ? messagingSource.clarityIssues.filter((c: any) => c && !containsFallbackLanguage(c))
      : [],
    differentiators: Array.isArray(messagingSource.differentiators)
      ? messagingSource.differentiators.map((d: any) => (typeof d === 'string' ? d : d.statement || ''))
      : [],
    headlines: Array.isArray(messagingSource.headlines) ? messagingSource.headlines : [],
  };

  // =========================================================================
  // J) Identity - Directly from JSON
  // =========================================================================

  const identitySource = findings.identitySystem || content.identitySystem || {};
  const identity: BrandIdentity = {
    tagline: identitySource.tagline || '',
    taglineClarityScore: validateScore(identitySource.taglineClarityScore, 50),
    corePromise: identitySource.corePromise || '',
    corePromiseClarityScore: validateScore(identitySource.corePromiseClarityScore, 50),
    toneOfVoice: identitySource.toneOfVoice || '',
    toneConsistencyScore: validateScore(identitySource.toneConsistencyScore, 50),
    personalityTraits: Array.isArray(identitySource.personalityTraits) ? identitySource.personalityTraits : [],
    identityGaps: Array.isArray(identitySource.identityGaps)
      ? identitySource.identityGaps.filter((g: any) => g && !containsFallbackLanguage(g))
      : [],
  };

  // =========================================================================
  // K) Trust - Directly from JSON
  // =========================================================================

  const trustSource = findings.trustAndProof || content.trustAndProof || {};
  const trust: BrandTrust = {
    trustArchetype: trustSource.trustArchetype || '',
    trustSignalsScore: validateScore(trustSource.trustSignalsScore, 50),
    humanPresenceScore: validateScore(trustSource.humanPresenceScore, 50),
    credibilityGaps: Array.isArray(trustSource.credibilityGaps)
      ? trustSource.credibilityGaps.filter((g: any) => g && !containsFallbackLanguage(g))
      : [],
  };

  // =========================================================================
  // L) Audience Fit - Directly from JSON
  // =========================================================================

  const audienceSource = findings.audienceFit || content.audienceFit || {};
  const audienceFit: BrandAudienceFit = {
    primaryICPDescription: audienceSource.primaryICPDescription || '',
    alignmentScore: validateScore(audienceSource.alignmentScore, 50),
    icpSignals: Array.isArray(audienceSource.icpSignals) ? audienceSource.icpSignals : [],
    misalignmentNotes: Array.isArray(audienceSource.misalignmentNotes)
      ? audienceSource.misalignmentNotes.filter((n: any) => n && !containsFallbackLanguage(n))
      : [],
  };

  // =========================================================================
  // Return Normalized Result
  // =========================================================================

  return {
    overallScore,
    maturityStage,
    dataConfidence,
    narrativeSummary,
    dimensions,
    issues,
    quickWins,
    projects,
    topOpportunities,
    brandPillars,
    positioning,
    messaging,
    identity,
    trust,
    audienceFit,
    generatedAt: content.generatedAt || new Date().toISOString(),
    url: content.url,
    companyId: content.companyId,
    rawFindings: findings,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export * from './brandLabTypes';
