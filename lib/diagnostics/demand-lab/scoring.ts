// lib/diagnostics/demand-lab/scoring.ts
// Demand Lab V2 Scoring Logic
//
// Company-type-aware scoring across five dimensions:
// 1. Channel Mix & Budget Allocation (20%)
// 2. Campaign Structure & Targeting (20%)
// 3. Creative & Messaging (20%)
// 4. Funnel Architecture (20%)
// 5. Measurement & Optimization (20%)

import type {
  DemandAnalyzerOutput,
  DemandLabDimension,
  DemandLabIssue,
  DemandMaturityStage,
  DemandDimensionStatus,
  DemandIssueCategory,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface ScoringOutput {
  dimensions: DemandLabDimension[];
  overallScore: number;
  maturityStage: DemandMaturityStage;
  issues: DemandLabIssue[];
}

// Helper to track evidence during scoring
interface EvidenceBuilder {
  found: string[];
  missing: string[];
  dataPoints: Record<string, string | number | boolean>;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score demand generation based on analyzer output
 * V2: Company-type aware scoring with realistic expectations
 */
export function scoreDemandLab(analysis: DemandAnalyzerOutput): ScoringOutput {
  const { companyType, analyticsSnapshot, dataConfidence } = analysis;

  // Helper for status from score
  function statusFromScore(score: number): DemandDimensionStatus {
    if (score < 50) return 'weak';
    if (score < 70) return 'moderate';
    return 'strong';
  }

  // Issue collection
  const allIssues: DemandLabIssue[] = [];
  let issueIdCounter = 0;

  const mkIssue = (
    category: DemandIssueCategory,
    severity: 'low' | 'medium' | 'high',
    title: string,
    description: string
  ): DemandLabIssue => {
    return {
      id: `demand-${issueIdCounter++}`,
      category,
      severity,
      title,
      description,
    };
  };

  // Traffic and paid signals
  const traffic = analyticsSnapshot;
  const paidShare = traffic?.paidShare ?? traffic?.paidTrafficShare ?? 0;
  const sessionVolume = traffic?.sessionVolume ?? traffic?.totalSessions ?? 0;
  const hasTraffic = sessionVolume > 0;

  const dims: DemandLabDimension[] = [];

  // ============================================================================
  // CHANNEL MIX & BUDGET
  // Starts at 65, can be reduced significantly for missing paid/retargeting
  // ============================================================================

  let channelScore = 65;
  const channelIssues: DemandLabIssue[] = [];
  const channelEvidence: EvidenceBuilder = { found: [], missing: [], dataPoints: {} };

  channelEvidence.dataPoints.sessionVolume = sessionVolume;
  channelEvidence.dataPoints.paidTrafficShare = paidShare ? `${(paidShare * 100).toFixed(1)}%` : '0%';

  if (!hasTraffic) {
    channelScore = 30;
    channelEvidence.missing.push('Meaningful traffic volume (needed for channel analysis)');
    const issue = mkIssue(
      'Channel Mix',
      'high',
      'Limited traffic footprint',
      'Traffic volume is low, making it difficult to validate channel strategy.'
    );
    channelIssues.push(issue);
    allIssues.push(issue);
  } else {
    channelEvidence.found.push(`${sessionVolume.toLocaleString()} sessions in last 30 days`);

    // Company-type-aware paid channel expectations - HARSHER penalties
    if (companyType === 'b2b_services' || companyType === 'saas') {
      if (paidShare === 0 && !analysis.hasPaidTraffic) {
        channelScore -= 25; // Was -15, now -25
        channelEvidence.missing.push('Paid search or social demand channels');
        const issue = mkIssue(
          'Channel Mix',
          'medium',
          'No paid demand channels detected',
          'For B2B and SaaS, a paid demand layer (search or social) typically accelerates pipeline.'
        );
        channelIssues.push(issue);
        allIssues.push(issue);
      } else if (paidShare < 0.05 && !analysis.hasPaidTraffic) {
        channelScore -= 15;
        channelEvidence.missing.push('Adequate paid demand footprint');
        const issue = mkIssue(
          'Channel Mix',
          'medium',
          'Very light paid demand footprint',
          'Paid channels appear underdeveloped relative to typical B2B/SaaS demand engines.'
        );
        channelIssues.push(issue);
        allIssues.push(issue);
      } else if (analysis.hasPaidTraffic) {
        channelEvidence.found.push('Active paid traffic channels detected');
      }
    }

    if (companyType === 'local_service') {
      if (paidShare === 0 && !analysis.hasPaidTraffic) {
        channelScore -= 15;
        channelEvidence.missing.push('Local paid search or maps advertising');
        const issue = mkIssue(
          'Channel Mix',
          'medium',
          'No local paid visibility detected',
          'Local services often benefit from always-on local search or maps ads.'
        );
        channelIssues.push(issue);
        allIssues.push(issue);
      }
    }

    if (companyType === 'ecommerce') {
      if (paidShare < 0.1 && !analysis.hasPaidTraffic) {
        channelScore -= 25;
        channelEvidence.missing.push('Performance marketing channels (Shopping, Display, Social)');
        const issue = mkIssue(
          'Channel Mix',
          'high',
          'Weak performance marketing footprint',
          'Ecommerce typically requires strong performance marketing (Shopping, social, remarketing) to drive sales.'
        );
        channelIssues.push(issue);
        allIssues.push(issue);
      }
    }

    // Retargeting check - HARSHER penalty
    if (!analysis.hasRetargetingSignals) {
      channelScore -= 10;
      channelEvidence.missing.push('Retargeting pixels (Facebook, LinkedIn, or Google)');
      const issue = mkIssue(
        'Channel Mix',
        'medium',
        'No retargeting layer detected',
        'Adding retargeting can capture visitors who did not convert on the first visit.'
      );
      channelIssues.push(issue);
      allIssues.push(issue);
    } else {
      channelScore += 5; // Reduced bonus
      channelEvidence.found.push('Retargeting infrastructure in place');
    }

    // Channel diversity - reduced bonus
    if (traffic?.topChannels && traffic.topChannels.length >= 4) {
      channelScore += 10;
      channelEvidence.found.push(`Multi-channel traffic (${traffic.topChannels.length} channels: ${traffic.topChannels.slice(0, 4).join(', ')})`);
    } else if (traffic?.topChannels && traffic.topChannels.length >= 2) {
      channelScore += 5;
      channelEvidence.found.push(`Traffic from ${traffic.topChannels.length} channels: ${traffic.topChannels.join(', ')}`);
    } else {
      channelEvidence.missing.push('Diversified traffic sources');
    }
  }

  channelScore = Math.max(0, Math.min(100, channelScore));
  dims.push({
    key: 'channelMix',
    label: 'Channel Mix & Budget',
    score: channelScore,
    status: statusFromScore(channelScore),
    summary:
      channelScore < 50
        ? 'Channel mix is underdeveloped for this business model.'
        : channelScore < 70
          ? 'Channel mix is partially aligned but has gaps for this business model.'
          : 'Channel mix looks generally appropriate for this business model.',
    issues: channelIssues,
    evidence: {
      found: channelEvidence.found,
      missing: channelEvidence.missing,
      dataPoints: channelEvidence.dataPoints,
    },
  });

  // ============================================================================
  // CAMPAIGN STRUCTURE & TARGETING
  // ============================================================================

  let targetingScore = 55;
  const targetingIssues: DemandLabIssue[] = [];
  const targetingEvidence: EvidenceBuilder = { found: [], missing: [], dataPoints: {} };

  targetingEvidence.dataPoints.hasPaidTraffic = analysis.hasPaidTraffic;
  targetingEvidence.dataPoints.hasRetargeting = analysis.hasRetargetingSignals;
  targetingEvidence.dataPoints.landingPageCount = analysis.landingPages.landingPageCount;

  if (!analysis.hasPaidTraffic) {
    targetingScore = 35; // Was 40, now 35
    targetingEvidence.missing.push('Active paid campaign traffic');
    const issue = mkIssue(
      'Targeting',
      'medium',
      'No active paid campaigns detected',
      'Without paid campaigns, targeting and segmentation are likely minimal or nonexistent.'
    );
    targetingIssues.push(issue);
    allIssues.push(issue);
  } else {
    targetingEvidence.found.push('Paid campaign traffic detected');
    if (!analysis.hasRetargetingSignals) {
      targetingScore -= 10;
      targetingEvidence.missing.push('Retargeting layer for non-converters');
      const issue = mkIssue(
        'Targeting',
        'medium',
        'No clear retargeting layer detected',
        'Adding retargeting can capture visitors who did not convert on the first visit.'
      );
      targetingIssues.push(issue);
      allIssues.push(issue);
    } else {
      targetingEvidence.found.push('Retargeting pixels active');
    }
  }

  // Dedicated landing pages check
  if (analysis.hasDedicatedLandingPages) {
    targetingScore += 15;
    targetingEvidence.found.push(`${analysis.landingPages.landingPageUrls.length} dedicated landing pages found`);
  } else {
    targetingEvidence.missing.push('Dedicated campaign landing pages');
    const issue = mkIssue(
      'Targeting',
      'medium',
      'No dedicated campaign landing pages detected',
      'Sending campaign traffic to generic pages can reduce relevance and conversion rates.'
    );
    targetingIssues.push(issue);
    allIssues.push(issue);
  }

  targetingScore = Math.max(0, Math.min(100, targetingScore));
  dims.push({
    key: 'targeting',
    label: 'Campaign Structure & Targeting',
    score: targetingScore,
    status: statusFromScore(targetingScore),
    summary:
      targetingScore < 50
        ? 'Campaign structure and targeting appear weak or missing.'
        : targetingScore < 70
          ? 'Targeting is present but not fully segmented or layered.'
          : 'Campaigns appear reasonably structured with layered targeting.',
    issues: targetingIssues,
    evidence: {
      found: targetingEvidence.found,
      missing: targetingEvidence.missing,
      dataPoints: targetingEvidence.dataPoints,
    },
  });

  // ============================================================================
  // CREATIVE & MESSAGING
  // ============================================================================

  let creativeScore = 55;
  const creativeIssues: DemandLabIssue[] = [];
  const creativeEvidence: EvidenceBuilder = { found: [], missing: [], dataPoints: {} };

  creativeEvidence.dataPoints.ctaCount = analysis.ctas.ctaCount;
  creativeEvidence.dataPoints.ctaClarityScore = analysis.ctas.ctaClarityScore;
  if (analysis.ctas.primaryCta) {
    creativeEvidence.dataPoints.primaryCta = analysis.ctas.primaryCta;
  }

  if (!analysis.hasDedicatedLandingPages) {
    creativeScore -= 10;
    creativeEvidence.missing.push('Dedicated landing pages with focused messaging');
  } else {
    creativeEvidence.found.push('Dedicated landing pages present');
  }

  if (!analysis.hasClearPrimaryCTA) {
    creativeScore -= 15;
    creativeEvidence.missing.push('Clear, prominent primary CTA');
    const issue = mkIssue(
      'Creative',
      'high',
      'Weak or unclear primary calls-to-action',
      'Demand systems perform better when CTAs are prominent and specific.'
    );
    creativeIssues.push(issue);
    allIssues.push(issue);
  } else {
    creativeScore += 15;
    creativeEvidence.found.push(`Primary CTA identified: "${analysis.ctas.primaryCta}"`);
  }

  // CTA variety and clarity from detailed signals
  if (analysis.ctas.ctaClarityScore >= 80) {
    creativeScore += 10;
    creativeEvidence.found.push(`High CTA clarity score (${analysis.ctas.ctaClarityScore}/100)`);
  } else if (analysis.ctas.ctaClarityScore < 50) {
    creativeEvidence.missing.push('Clear, focused CTA strategy');
    const issue = mkIssue(
      'Creative',
      'medium',
      'Low CTA clarity',
      'Calls-to-action could be clearer. Use action-oriented, benefit-focused CTA copy.'
    );
    creativeIssues.push(issue);
    allIssues.push(issue);
  }

  // Add CTA types found
  if (analysis.ctas.ctaTypes.length > 0) {
    creativeEvidence.found.push(`CTA types found: ${analysis.ctas.ctaTypes.join(', ')}`);
  }

  if (analysis.ctas.hasCompetingCtas) {
    creativeEvidence.missing.push('Focused CTA strategy (multiple competing CTAs detected)');
  }

  creativeScore = Math.max(0, Math.min(100, creativeScore));
  dims.push({
    key: 'creative',
    label: 'Creative & Messaging',
    score: creativeScore,
    status: statusFromScore(creativeScore),
    summary:
      creativeScore < 50
        ? 'Creative and messaging are underpowered for effective demand generation.'
        : creativeScore < 70
          ? 'Messaging is partially effective but lacks depth or variation.'
          : 'Creative and messaging appear reasonably strong.',
    issues: creativeIssues,
    evidence: {
      found: creativeEvidence.found,
      missing: creativeEvidence.missing,
      dataPoints: creativeEvidence.dataPoints,
    },
  });

  // ============================================================================
  // FUNNEL ARCHITECTURE
  // Now with conversion rate sanity checks
  // ============================================================================

  let funnelScore = 60; // Start at 60
  const funnelIssues: DemandLabIssue[] = [];
  const funnelEvidence: EvidenceBuilder = { found: [], missing: [], dataPoints: {} };

  funnelEvidence.dataPoints.hasLeadCapture = analysis.hasLeadCapture;
  funnelEvidence.dataPoints.hasPrimaryCta = !!analysis.ctas.primaryCta;

  // Get conversion rate (should be a fraction, e.g., 0.03 for 3%)
  const cr = traffic?.conversionRate ?? null;

  // Store human-readable conversion rate in evidence
  if (cr !== null) {
    // If cr > 1, it was stored as percentage not fraction - still show it
    const displayCr = cr > 1 ? cr : cr * 100;
    funnelEvidence.dataPoints.conversionRate = `${displayCr.toFixed(2)}%`;
  }

  // Reward basic funnel elements
  if (analysis.hasLeadCapture) {
    funnelScore += 10;
    funnelEvidence.found.push('Lead capture forms detected on site');
  } else {
    funnelEvidence.missing.push('Lead capture forms');
    if (companyType === 'b2b_services' || companyType === 'saas') {
      funnelScore -= 15;
      const issue = mkIssue(
        'Funnel',
        'high',
        'No clear lead capture mechanism',
        'B2B and SaaS demand programs need simple, obvious ways for qualified visitors to raise their hands.'
      );
      funnelIssues.push(issue);
      allIssues.push(issue);
    } else if (companyType === 'ecommerce') {
      funnelScore -= 5;
      const issue = mkIssue(
        'Funnel',
        'medium',
        'Weak email capture for non-buyers',
        'Building an email list can help recover and nurture non-purchasing visitors.'
      );
      funnelIssues.push(issue);
      allIssues.push(issue);
    } else {
      funnelScore -= 10;
      const issue = mkIssue(
        'Funnel',
        'high',
        'No lead capture forms detected',
        'Add email capture forms to convert visitors into leads before they leave.'
      );
      funnelIssues.push(issue);
      allIssues.push(issue);
    }
  }

  // Primary CTA check
  if (analysis.ctas.primaryCta) {
    funnelScore += 10;
    funnelEvidence.found.push(`Clear conversion path with primary CTA: "${analysis.ctas.primaryCta}"`);
  } else {
    funnelEvidence.missing.push('Clear primary conversion action');
    const issue = mkIssue(
      'Funnel',
      'medium',
      'No clear primary conversion path',
      'Define and highlight a primary conversion action for each landing page.'
    );
    funnelIssues.push(issue);
    allIssues.push(issue);
  }

  // Conversion rate impact (ONLY when believable)
  // cr should be a fraction (0.03 = 3%)
  if (cr !== null && sessionVolume >= 50) {
    if (cr < 0.005) {
      // <0.5% - poor
      funnelScore -= 10;
      funnelEvidence.missing.push(`Higher conversion rate (currently ${(cr * 100).toFixed(2)}%)`);
      const issue = mkIssue(
        'Funnel',
        'high',
        'Low conversion rate',
        `Conversion rate of ${(cr * 100).toFixed(1)}% indicates funnel friction. Optimize landing pages and reduce barriers.`
      );
      funnelIssues.push(issue);
      allIssues.push(issue);
    } else if (cr >= 0.005 && cr < 0.03) {
      // 0.5-3% - neutral, typical range
      funnelEvidence.found.push(`Conversion rate in typical range: ${(cr * 100).toFixed(1)}%`);
    } else if (cr >= 0.03 && cr < 0.08) {
      // 3-8% - good
      funnelScore += 5;
      funnelEvidence.found.push(`Good conversion rate: ${(cr * 100).toFixed(1)}%`);
    } else if (cr >= 0.08 && cr < 0.20) {
      // 8-20% - very strong
      funnelScore += 10;
      funnelEvidence.found.push(`Strong conversion rate: ${(cr * 100).toFixed(1)}%`);
    } else if (cr >= 0.20 && cr <= 0.40) {
      // 20-40% - extremely strong but plausible for demo forms
      funnelScore += 12;
      funnelEvidence.found.push(`Very strong conversion rate: ${(cr * 100).toFixed(1)}%`);
    } else if (cr > 0.40) {
      // >40% is almost always tracking noise
      funnelScore -= 10;
      funnelEvidence.missing.push('Accurate conversion tracking configuration');
      const issue = mkIssue(
        'Measurement',
        'medium',
        'Conversion rate appears unrealistically high',
        `Conversion rate of ${(cr * 100).toFixed(0)}% is likely caused by misconfigured tracking. Audit GA4 conversion definitions.`
      );
      funnelIssues.push(issue);
      allIssues.push(issue);
    }
  } else if (cr === null) {
    funnelEvidence.missing.push('Conversion tracking data');
  } else if (sessionVolume < 50) {
    funnelEvidence.dataPoints.sessionVolumeNote = 'Insufficient sessions for reliable conversion rate analysis';
  }

  // Cap funnel based on confidence and data volume
  if (sessionVolume < 50 || dataConfidence.level === 'low') {
    funnelScore = Math.min(funnelScore, 75);
  }

  funnelScore = Math.max(0, Math.min(100, funnelScore));
  dims.push({
    key: 'funnel',
    label: 'Funnel Architecture',
    score: funnelScore,
    status: statusFromScore(funnelScore),
    summary:
      funnelScore < 50
        ? 'Funnel paths are unclear or missing key steps.'
        : funnelScore < 70
          ? 'Funnel exists but has friction or missing nurture layers.'
          : 'Funnel structure is reasonably defined.',
    issues: funnelIssues,
    evidence: {
      found: funnelEvidence.found,
      missing: funnelEvidence.missing,
      dataPoints: funnelEvidence.dataPoints,
    },
  });

  // ============================================================================
  // MEASUREMENT & OPTIMIZATION
  // Now more honest about UTM importance
  // ============================================================================

  let measurementScore = 55; // Start at 55
  const measurementIssues: DemandLabIssue[] = [];
  const measurementEvidence: EvidenceBuilder = { found: [], missing: [], dataPoints: {} };

  measurementEvidence.dataPoints.hasAnalytics = analysis.tracking.hasAnalytics;
  measurementEvidence.dataPoints.hasConversionTracking = analysis.conversionEventsImplemented;
  measurementEvidence.dataPoints.utmUsageLevel = analysis.utmUsageLevel;

  // Conversion events
  if (!analysis.conversionEventsImplemented) {
    measurementScore -= 20;
    measurementEvidence.missing.push('Conversion event tracking');
    const issue = mkIssue(
      'Measurement',
      'high',
      'No conversion events configured in analytics',
      'Without conversion tracking, it\'s difficult to optimize demand efficiently.'
    );
    measurementIssues.push(issue);
    allIssues.push(issue);
  } else {
    measurementScore += 10; // Reduced from +20
    measurementEvidence.found.push('Conversion events implemented');
  }

  // UTM usage - HARSHER penalty for none
  if (analysis.utmUsageLevel === 'none') {
    measurementScore -= 20; // Was -15, now -20
    measurementEvidence.missing.push('UTM parameter tracking');
    const issue = mkIssue(
      'Measurement',
      'medium',
      'No UTM usage detected',
      'UTM parameters are essential for understanding which campaigns and channels work.'
    );
    measurementIssues.push(issue);
    allIssues.push(issue);
  } else if (analysis.utmUsageLevel === 'some') {
    measurementScore -= 5;
    measurementEvidence.found.push('Some UTM usage detected');
    measurementEvidence.missing.push('Consistent UTM naming conventions');
    const issue = mkIssue(
      'Measurement',
      'low',
      'Inconsistent UTM usage',
      'Standardizing UTMs will improve reporting clarity and optimization.'
    );
    measurementIssues.push(issue);
    allIssues.push(issue);
  } else {
    measurementScore += 10;
    measurementEvidence.found.push('Consistent UTM tracking in place');
  }

  // Analytics presence - mild reward
  if (analysis.tracking.hasAnalytics) {
    measurementScore += 5; // Reduced from +15
    measurementEvidence.found.push('Analytics platform detected (Google Analytics/GTM)');
  } else {
    measurementEvidence.missing.push('Web analytics platform');
    const issue = mkIssue(
      'Measurement',
      'high',
      'No analytics detected',
      'Install Google Analytics or similar to track visitor behavior and conversions.'
    );
    measurementIssues.push(issue);
    allIssues.push(issue);
    measurementScore -= 15;
  }

  // Additional tracking tech as evidence
  if (analysis.tracking.hasRetargetingPixels) {
    measurementEvidence.found.push('Retargeting/conversion pixels installed');
  }

  // Cap measurement when data confidence is low
  if (dataConfidence.level === 'low') {
    measurementScore = Math.min(measurementScore, 65);
  }

  measurementScore = Math.max(0, Math.min(100, measurementScore));
  dims.push({
    key: 'measurement',
    label: 'Measurement & Optimization',
    score: measurementScore,
    status: statusFromScore(measurementScore),
    summary:
      measurementScore < 50
        ? 'Measurement foundations are too weak to reliably optimize demand.'
        : measurementScore < 70
          ? 'Measurement is partially in place but has gaps that limit optimization.'
          : 'Measurement systems are strong enough to support ongoing testing.',
    issues: measurementIssues,
    evidence: {
      found: measurementEvidence.found,
      missing: measurementEvidence.missing,
      dataPoints: measurementEvidence.dataPoints,
    },
  });

  // ============================================================================
  // OVERALL SCORE & MATURITY
  // With safety cap for false confidence
  // ============================================================================

  let overallScore = Math.round(
    dims.reduce((sum, d) => sum + d.score, 0) / dims.length
  );

  // Safety cap: If both Channel Mix AND Targeting are weak, cap overall at 55
  const channelDim = dims.find(d => d.key === 'channelMix');
  const targetingDim = dims.find(d => d.key === 'targeting');

  if (channelDim && targetingDim && channelDim.score < 50 && targetingDim.score < 50) {
    overallScore = Math.min(overallScore, 55);
  }

  // Additional cap if data confidence is low
  if (dataConfidence.level === 'low') {
    overallScore = Math.min(overallScore, 65);
  }

  let maturityStage: DemandMaturityStage;
  if (overallScore < 50) maturityStage = 'unproven';
  else if (overallScore < 70) maturityStage = 'emerging';
  else if (overallScore < 85) maturityStage = 'scaling';
  else maturityStage = 'established';

  return {
    dimensions: dims,
    overallScore,
    maturityStage,
    issues: allIssues,
  };
}

// ============================================================================
// Legacy Export (backwards compatibility)
// ============================================================================

// Re-export types used by other modules
export type { ScoringOutput as DemandScoringOutput };
