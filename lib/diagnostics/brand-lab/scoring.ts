// lib/diagnostics/brand-lab/scoring.ts
// Brand Lab V2 Scoring Module
//
// Transforms V1 diagnostic results into V2 dimension-based scoring.
// Each dimension gets a score (0-100), status (weak/moderate/strong),
// a summary, and a list of issues.

import type {
  BrandLabDimension,
  BrandLabIssue,
  BrandDimensionKey,
  BrandDimensionStatus,
  BrandLabEvidence,
  BrandIssueCategory,
  BrandIssueSeverity,
  BrandDataConfidence,
  BrandMaturityStage,
} from './types';
import { getStatusFromScore, getDimensionLabel, getMaturityFromScore } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ScoringOutput {
  dimensions: BrandLabDimension[];
  issues: BrandLabIssue[];
  overallScore: number;
  maturityStage: BrandMaturityStage;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Build dimensions and issues from V1 diagnostic
 */
export function buildBrandDimensionsFromV1(diagnostic: any): ScoringOutput {
  const allIssues: BrandLabIssue[] = [];
  let issueIdCounter = 0;

  const mkIssue = (
    category: BrandIssueCategory,
    severity: BrandIssueSeverity,
    title: string,
    description: string
  ): BrandLabIssue => ({
    id: `brand-${issueIdCounter++}`,
    category,
    severity,
    title,
    description,
  });

  const dimensions: BrandLabDimension[] = [];

  // -------------------------------------------------------------------------
  // 1. Identity & Promise
  // -------------------------------------------------------------------------
  const identity = diagnostic.identitySystem ?? {};
  const identityScore = avgDefined(
    [
      identity.taglineClarityScore,
      identity.corePromiseClarityScore,
      identity.toneConsistencyScore,
    ],
    65
  );

  const identityIssues: BrandLabIssue[] = [];
  const identityEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (identity.tagline) {
    identityEvidence.found.push(`Tagline detected: "${identity.tagline}"`);
  } else {
    identityEvidence.missing.push('No tagline found');
  }

  if (identity.corePromise) {
    identityEvidence.found.push(`Core promise identified: "${identity.corePromise}"`);
  }

  if (Array.isArray(identity.identityGaps) && identity.identityGaps.length > 0) {
    identity.identityGaps.forEach((gap: string) => {
      identityIssues.push(mkIssue('identity', 'medium', 'Identity gap detected', gap));
      identityEvidence.missing.push(gap);
    });
  }

  identityEvidence.dataPoints.taglineClarityScore = identity.taglineClarityScore;
  identityEvidence.dataPoints.corePromiseClarityScore = identity.corePromiseClarityScore;
  identityEvidence.dataPoints.toneConsistencyScore = identity.toneConsistencyScore;

  dimensions.push({
    key: 'identity',
    label: getDimensionLabel('identity'),
    score: identityScore,
    status: getStatusFromScore(identityScore),
    summary: identitySummary(identity, identityScore),
    issues: identityIssues,
    evidence: identityEvidence,
  });
  allIssues.push(...identityIssues);

  // -------------------------------------------------------------------------
  // 2. Messaging & Value Props
  // -------------------------------------------------------------------------
  const messaging = diagnostic.messagingSystem ?? {};
  const messagingScore = avgDefined(
    [messaging.benefitVsFeatureRatio, messaging.icpClarityScore, messaging.messagingFocusScore],
    60
  );

  const messagingIssues: BrandLabIssue[] = [];
  const messagingEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (Array.isArray(messaging.valueProps) && messaging.valueProps.length > 0) {
    identityEvidence.found.push(`${messaging.valueProps.length} value propositions identified`);
  }

  if (Array.isArray(messaging.differentiators) && messaging.differentiators.length > 0) {
    messagingEvidence.found.push(`Differentiators: ${messaging.differentiators.slice(0, 3).join(', ')}`);
  }

  if (Array.isArray(messaging.clarityIssues) && messaging.clarityIssues.length > 0) {
    messaging.clarityIssues.forEach((issue: string) => {
      messagingIssues.push(mkIssue('messaging', 'medium', 'Messaging clarity issue', issue));
      messagingEvidence.missing.push(issue);
    });
  }

  messagingEvidence.dataPoints.benefitVsFeatureRatio = messaging.benefitVsFeatureRatio;
  messagingEvidence.dataPoints.icpClarityScore = messaging.icpClarityScore;
  messagingEvidence.dataPoints.messagingFocusScore = messaging.messagingFocusScore;

  dimensions.push({
    key: 'messaging',
    label: getDimensionLabel('messaging'),
    score: messagingScore,
    status: getStatusFromScore(messagingScore),
    summary: messagingSummary(messaging, messagingScore),
    issues: messagingIssues,
    evidence: messagingEvidence,
  });
  allIssues.push(...messagingIssues);

  // -------------------------------------------------------------------------
  // 3. Positioning & Differentiation
  // -------------------------------------------------------------------------
  const positioning = diagnostic.positioning ?? {};
  const positioningScore = positioning.positioningClarityScore ?? 60;

  const positioningIssues: BrandLabIssue[] = [];
  const positioningEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (positioning.positioningTheme) {
    positioningEvidence.found.push(`Positioning theme: "${positioning.positioningTheme}"`);
  }

  if (positioning.competitiveAngle) {
    positioningEvidence.found.push(`Competitive angle: ${positioning.competitiveAngle}`);
  }

  if (!positioning.isClearWhoThisIsFor) {
    positioningEvidence.missing.push('Target audience is not clearly defined');
    positioningIssues.push(
      mkIssue('positioning', 'high', 'Unclear target audience', 'It is not clear who this product/service is for.')
    );
  }

  if (Array.isArray(positioning.positioningRisks) && positioning.positioningRisks.length > 0) {
    positioning.positioningRisks.forEach((risk: string) => {
      positioningIssues.push(mkIssue('positioning', 'medium', 'Positioning risk', risk));
      positioningEvidence.missing.push(risk);
    });
  }

  positioningEvidence.dataPoints.positioningClarityScore = positioning.positioningClarityScore;
  positioningEvidence.dataPoints.competitiveAngle = positioning.competitiveAngle;

  dimensions.push({
    key: 'positioning',
    label: getDimensionLabel('positioning'),
    score: positioningScore,
    status: getStatusFromScore(positioningScore),
    summary: positioningSummary(positioning, positioningScore),
    issues: positioningIssues,
    evidence: positioningEvidence,
  });
  allIssues.push(...positioningIssues);

  // -------------------------------------------------------------------------
  // 4. Audience Fit & ICP Alignment
  // -------------------------------------------------------------------------
  const audience = diagnostic.audienceFit ?? {};
  const audienceScore = audience.alignmentScore ?? 65;

  const audienceIssues: BrandLabIssue[] = [];
  const audienceEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (audience.primaryICPDescription) {
    audienceEvidence.found.push(`Primary ICP: ${audience.primaryICPDescription}`);
  }

  if (Array.isArray(audience.icpSignals) && audience.icpSignals.length > 0) {
    audienceEvidence.found.push(`ICP signals: ${audience.icpSignals.slice(0, 3).join(', ')}`);
  }

  if (Array.isArray(audience.misalignmentNotes) && audience.misalignmentNotes.length > 0) {
    audience.misalignmentNotes.forEach((note: string) => {
      audienceIssues.push(mkIssue('audienceFit', 'medium', 'Audience misalignment', note));
      audienceEvidence.missing.push(note);
    });
  }

  audienceEvidence.dataPoints.alignmentScore = audience.alignmentScore;

  dimensions.push({
    key: 'audienceFit',
    label: getDimensionLabel('audienceFit'),
    score: audienceScore,
    status: getStatusFromScore(audienceScore),
    summary: audienceSummary(audience, audienceScore),
    issues: audienceIssues,
    evidence: audienceEvidence,
  });
  allIssues.push(...audienceIssues);

  // -------------------------------------------------------------------------
  // 5. Trust & Proof
  // -------------------------------------------------------------------------
  const trust = diagnostic.trustAndProof ?? {};
  const trustScore = avgDefined([trust.trustSignalsScore, trust.humanPresenceScore], 60);

  const trustIssues: BrandLabIssue[] = [];
  const trustEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (trust.trustArchetype) {
    trustEvidence.found.push(`Trust archetype: ${trust.trustArchetype}`);
  }

  if (trust.trustSignalsScore >= 70) {
    trustEvidence.found.push('Strong trust signals present');
  }

  if (trust.humanPresenceScore >= 70) {
    trustEvidence.found.push('Good human presence (team, founder visibility)');
  } else if (trust.humanPresenceScore < 50) {
    trustEvidence.missing.push('Low human presence - brand feels impersonal');
  }

  if (Array.isArray(trust.credibilityGaps) && trust.credibilityGaps.length > 0) {
    trust.credibilityGaps.forEach((gap: string) => {
      trustIssues.push(mkIssue('trust', 'medium', 'Credibility gap', gap));
      trustEvidence.missing.push(gap);
    });
  }

  trustEvidence.dataPoints.trustSignalsScore = trust.trustSignalsScore;
  trustEvidence.dataPoints.humanPresenceScore = trust.humanPresenceScore;

  dimensions.push({
    key: 'trust',
    label: getDimensionLabel('trust'),
    score: trustScore,
    status: getStatusFromScore(trustScore),
    summary: trustSummary(trust, trustScore),
    issues: trustIssues,
    evidence: trustEvidence,
  });
  allIssues.push(...trustIssues);

  // -------------------------------------------------------------------------
  // 6. Visual System
  // -------------------------------------------------------------------------
  const visual = diagnostic.visualSystem ?? {};
  const visualScore = avgDefined([visual.visualConsistencyScore, visual.brandRecognitionScore], 60);

  const visualIssues: BrandLabIssue[] = [];
  const visualEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (visual.paletteDescriptor) {
    visualEvidence.found.push(`Palette: ${visual.paletteDescriptor}`);
  }

  if (Array.isArray(visual.visualPersonalityWords) && visual.visualPersonalityWords.length > 0) {
    visualEvidence.found.push(`Visual personality: ${visual.visualPersonalityWords.slice(0, 3).join(', ')}`);
  }

  if (Array.isArray(visual.visualGaps) && visual.visualGaps.length > 0) {
    visual.visualGaps.forEach((gap: string) => {
      visualIssues.push(mkIssue('visual', 'low', 'Visual gap', gap));
      visualEvidence.missing.push(gap);
    });
  }

  visualEvidence.dataPoints.visualConsistencyScore = visual.visualConsistencyScore;
  visualEvidence.dataPoints.brandRecognitionScore = visual.brandRecognitionScore;

  dimensions.push({
    key: 'visual',
    label: getDimensionLabel('visual'),
    score: visualScore,
    status: getStatusFromScore(visualScore),
    summary: visualSummary(visual, visualScore),
    issues: visualIssues,
    evidence: visualEvidence,
  });
  allIssues.push(...visualIssues);

  // -------------------------------------------------------------------------
  // 7. Brand Assets & Guidelines
  // -------------------------------------------------------------------------
  const assets = diagnostic.brandAssets ?? {};
  const assetsScore = assets.assetCoverageScore ?? 50;

  const assetsIssues: BrandLabIssue[] = [];
  const assetsEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (assets.hasLogoVariants) assetsEvidence.found.push('Logo variants present');
  if (assets.hasFavicons) assetsEvidence.found.push('Favicons present');
  if (assets.hasBrandGuidelines) assetsEvidence.found.push('Brand guidelines documented');

  if (!assets.hasBrandGuidelines) {
    assetsEvidence.missing.push('No brand guidelines');
    assetsIssues.push(
      mkIssue('assets', 'low', 'Missing brand guidelines', 'No formal brand guidelines document found.')
    );
  }

  if (!assets.hasIllustrationStyle && !assets.hasPhotographyStyle) {
    assetsEvidence.missing.push('No defined illustration or photography style');
  }

  if (Array.isArray(assets.assetNotes) && assets.assetNotes.length > 0) {
    assets.assetNotes.forEach((note: string) => {
      assetsIssues.push(mkIssue('assets', 'low', 'Brand asset gap', note));
    });
  }

  assetsEvidence.dataPoints.assetCoverageScore = assets.assetCoverageScore;
  assetsEvidence.dataPoints.hasLogoVariants = assets.hasLogoVariants;
  assetsEvidence.dataPoints.hasBrandGuidelines = assets.hasBrandGuidelines;

  dimensions.push({
    key: 'assets',
    label: getDimensionLabel('assets'),
    score: assetsScore,
    status: getStatusFromScore(assetsScore),
    summary: assetsSummary(assets, assetsScore),
    issues: assetsIssues,
    evidence: assetsEvidence,
  });
  allIssues.push(...assetsIssues);

  // -------------------------------------------------------------------------
  // 8. Brand Consistency
  // -------------------------------------------------------------------------
  const inconsistencies = Array.isArray(diagnostic.inconsistencies) ? diagnostic.inconsistencies : [];

  // Score based on number and severity of inconsistencies
  let consistencyScore = 80; // Start high
  const highSeverity = inconsistencies.filter((i: any) => i.severity === 'high').length;
  const mediumSeverity = inconsistencies.filter((i: any) => i.severity === 'medium').length;
  const lowSeverity = inconsistencies.filter((i: any) => i.severity === 'low').length;

  consistencyScore -= highSeverity * 15;
  consistencyScore -= mediumSeverity * 8;
  consistencyScore -= lowSeverity * 3;
  consistencyScore = Math.max(20, Math.min(100, consistencyScore));

  const consistencyIssues: BrandLabIssue[] = [];
  const consistencyEvidence: BrandLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  if (inconsistencies.length === 0) {
    consistencyEvidence.found.push('No brand inconsistencies detected');
  } else {
    consistencyEvidence.found.push(`${inconsistencies.length} inconsistencies detected`);
    inconsistencies.forEach((inc: any) => {
      const severity: BrandIssueSeverity = inc.severity === 'high' ? 'high' : inc.severity === 'medium' ? 'medium' : 'low';
      consistencyIssues.push(
        mkIssue(
          'consistency',
          severity,
          `${inc.type} inconsistency: ${inc.location}`,
          inc.description ?? 'Brand inconsistency detected.'
        )
      );
    });
  }

  consistencyEvidence.dataPoints.totalInconsistencies = inconsistencies.length;
  consistencyEvidence.dataPoints.highSeverityCount = highSeverity;

  dimensions.push({
    key: 'consistency',
    label: getDimensionLabel('consistency'),
    score: consistencyScore,
    status: getStatusFromScore(consistencyScore),
    summary: consistencySummary(inconsistencies, consistencyScore),
    issues: consistencyIssues,
    evidence: consistencyEvidence,
  });
  allIssues.push(...consistencyIssues);

  // -------------------------------------------------------------------------
  // Calculate Overall Score
  // -------------------------------------------------------------------------
  const weights: Record<BrandDimensionKey, number> = {
    identity: 0.18,
    messaging: 0.16,
    positioning: 0.16,
    audienceFit: 0.12,
    trust: 0.14,
    visual: 0.10,
    assets: 0.06,
    consistency: 0.08,
  };

  let overallScore = 0;
  for (const dim of dimensions) {
    overallScore += dim.score * (weights[dim.key] ?? 0.125);
  }
  overallScore = Math.round(overallScore);

  const maturityStage = getMaturityFromScore(overallScore);

  return { dimensions, issues: allIssues, overallScore, maturityStage };
}

// ============================================================================
// Data Confidence
// ============================================================================

/**
 * Compute data confidence based on available brand signals
 */
export function computeBrandDataConfidence(diagnostic: any): BrandDataConfidence {
  let score = 40; // Base score
  const reasons: string[] = [];

  const hasVisual = !!diagnostic.visualSystem;
  const hasAssets = !!diagnostic.brandAssets;
  const hasMessaging = !!diagnostic.messagingSystem;
  const hasPillars = Array.isArray(diagnostic.brandPillars) && diagnostic.brandPillars.length > 0;
  const hasPositioning = !!diagnostic.positioning;
  const hasTrust = !!diagnostic.trustAndProof;

  if (hasVisual) {
    score += 10;
    reasons.push('Visual system analyzed');
  }
  if (hasAssets) {
    score += 8;
    reasons.push('Brand assets evaluated');
  }
  if (hasMessaging) {
    score += 12;
    reasons.push('Messaging system analyzed');
  }
  if (hasPillars) {
    score += 10;
    reasons.push('Brand pillars identified');
  }
  if (hasPositioning) {
    score += 10;
    reasons.push('Positioning evaluated');
  }
  if (hasTrust) {
    score += 10;
    reasons.push('Trust signals assessed');
  }

  const finalScore = Math.max(20, Math.min(100, score));
  const level: BrandDataConfidence['level'] =
    finalScore >= 70 ? 'high' : finalScore >= 45 ? 'medium' : 'low';

  const reason = reasons.length > 0
    ? reasons.join('. ') + '.'
    : 'Limited brand signals detected. Treat insights as directional.';

  return { score: finalScore, level, reason };
}

// ============================================================================
// Summary Helpers
// ============================================================================

function identitySummary(identity: any, score: number): string {
  if (score < 50)
    return 'Brand identity is unclear or inconsistent. Visitors may not quickly understand who you are and what you stand for.';
  if (score < 70)
    return 'Brand identity is partially defined but has gaps in clarity or consistency.';
  return 'Brand identity is clear and mostly consistent across key elements.';
}

function messagingSummary(messaging: any, score: number): string {
  if (score < 50)
    return 'Messaging is unclear or generic, making it hard for visitors to understand the value you provide.';
  if (score < 70) return 'Messaging is serviceable but could be sharper and more differentiated.';
  return 'Messaging is clear and reasonably focused on benefits.';
}

function positioningSummary(positioning: any, score: number): string {
  if (score < 50)
    return 'Positioning is vague or indistinguishable from competitors. No clear competitive angle.';
  if (score < 70)
    return 'Positioning is present but could be sharper. Differentiation is not immediately clear.';
  return 'Positioning is clear with a defined competitive angle.';
}

function audienceSummary(audience: any, score: number): string {
  if (score < 50)
    return 'Target audience is not clearly defined. Messaging does not resonate with a specific ICP.';
  if (score < 70) return 'Audience is partially defined but messaging could better align with ICP needs.';
  return 'Clear audience targeting with messaging aligned to ICP.';
}

function trustSummary(trust: any, score: number): string {
  if (score < 50)
    return 'Trust signals are weak. Missing social proof, testimonials, or human presence.';
  if (score < 70)
    return 'Some trust signals present but room for more proof points and human elements.';
  return 'Strong trust signals with good social proof and human presence.';
}

function visualSummary(visual: any, score: number): string {
  if (score < 50)
    return 'Visual brand is inconsistent or unmemorable. No cohesive visual system.';
  if (score < 70)
    return 'Visual brand is present but could be more distinctive and consistent.';
  return 'Visual brand is cohesive and recognizable.';
}

function assetsSummary(assets: any, score: number): string {
  if (score < 50)
    return 'Brand assets are minimal. No brand guidelines or consistent asset library.';
  if (score < 70)
    return 'Some brand assets present but gaps in documentation or coverage.';
  return 'Brand assets are well-documented with good coverage.';
}

function consistencySummary(inconsistencies: any[], score: number): string {
  if (inconsistencies.length === 0) return 'Brand is consistent across touchpoints. No inconsistencies detected.';
  if (score < 50)
    return `Multiple brand inconsistencies detected (${inconsistencies.length}). Brand experience varies significantly.`;
  if (score < 70)
    return `Some brand inconsistencies found (${inconsistencies.length}). Minor variations in brand expression.`;
  return 'Brand is mostly consistent with minor variations.';
}

// ============================================================================
// Utility Functions
// ============================================================================

function avgDefined(values: (number | undefined)[], fallback: number): number {
  const filtered = values.filter((v): v is number => typeof v === 'number');
  if (filtered.length === 0) return fallback;
  return Math.round(filtered.reduce((sum, v) => sum + v, 0) / filtered.length);
}
