// lib/diagnostics/ops-lab/scoring.ts
// Ops Lab Scoring - Evaluates marketing ops & analytics readiness
//
// Dimensions:
// 1. Tracking & Instrumentation (25%)
// 2. Data Quality & Governance (20%)
// 3. CRM & Pipeline Hygiene (20%)
// 4. Automation & Journeys (20%)
// 5. Experimentation & Optimization (15%)

import type {
  OpsLabDimension,
  OpsLabIssue,
  OpsDimensionKey,
  OpsMaturityStage,
  OpsDimensionEvidence,
} from './types';
import { getStatusFromScore, getMaturityFromScore, getDimensionLabel, DIMENSION_WEIGHTS } from './types';
import type { OpsAnalyzerOutput } from './analyzer';

// ============================================================================
// Types
// ============================================================================

export interface OpsScoringOutput {
  dimensions: OpsLabDimension[];
  issues: OpsLabIssue[];
  overallScore: number;
  maturityStage: OpsMaturityStage;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score the ops & analytics readiness based on analyzer output
 */
export function scoreOpsLab(analysis: OpsAnalyzerOutput): OpsScoringOutput {
  const dimensions: OpsLabDimension[] = [];
  const allIssues: OpsLabIssue[] = [];
  let issueIdCounter = 0;

  const createIssue = (
    category: OpsDimensionKey,
    severity: OpsLabIssue['severity'],
    title: string,
    description: string
  ): OpsLabIssue => ({
    id: `ops-issue-${issueIdCounter++}`,
    category,
    severity,
    title,
    description,
  });

  // =========================================================================
  // 1. Tracking & Instrumentation (25%)
  // =========================================================================
  const trackingDim = scoreTrackingDimension(analysis, createIssue);
  dimensions.push(trackingDim);
  allIssues.push(...trackingDim.issues);

  // =========================================================================
  // 2. Data Quality & Governance (20%)
  // =========================================================================
  const dataDim = scoreDataDimension(analysis, createIssue);
  dimensions.push(dataDim);
  allIssues.push(...dataDim.issues);

  // =========================================================================
  // 3. CRM & Pipeline Hygiene (20%)
  // =========================================================================
  const crmDim = scoreCrmDimension(analysis, createIssue);
  dimensions.push(crmDim);
  allIssues.push(...crmDim.issues);

  // =========================================================================
  // 4. Automation & Journeys (20%)
  // =========================================================================
  const automationDim = scoreAutomationDimension(analysis, createIssue);
  dimensions.push(automationDim);
  allIssues.push(...automationDim.issues);

  // =========================================================================
  // 5. Experimentation & Optimization (15%)
  // =========================================================================
  const experimentationDim = scoreExperimentationDimension(analysis, createIssue);
  dimensions.push(experimentationDim);
  allIssues.push(...experimentationDim.issues);

  // =========================================================================
  // Calculate Overall Score (Weighted Average)
  // =========================================================================
  let overallScore = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const weight = DIMENSION_WEIGHTS[dim.key] || 0.2;
    const score = dim.score ?? 0;
    overallScore += score * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    overallScore = Math.round(overallScore / totalWeight);
  }

  // Cap score if data confidence is low
  if (analysis.dataConfidence.level === 'low' && overallScore > 60) {
    overallScore = 60;
  }

  const maturityStage = getMaturityFromScore(overallScore);

  console.log('[OpsScoring] Complete:', {
    overallScore,
    maturityStage,
    issueCount: allIssues.length,
    dimensionScores: dimensions.map((d) => ({ key: d.key, score: d.score })),
  });

  return {
    dimensions,
    issues: allIssues,
    overallScore,
    maturityStage,
  };
}

// ============================================================================
// Dimension Scorers
// ============================================================================

type IssueCreator = (
  category: OpsDimensionKey,
  severity: OpsLabIssue['severity'],
  title: string,
  description: string
) => OpsLabIssue;

/**
 * Score Tracking & Instrumentation dimension
 */
function scoreTrackingDimension(
  analysis: OpsAnalyzerOutput,
  createIssue: IssueCreator
): OpsLabDimension {
  let score = 40; // Base score
  const issues: OpsLabIssue[] = [];
  const evidence: OpsDimensionEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  // GA4 presence (+25)
  if (analysis.hasGa4) {
    score += 25;
    evidence.found.push('GA4 analytics detected');
    evidence.dataPoints.hasGa4 = true;
  } else {
    issues.push(createIssue(
      'tracking',
      'high',
      'No GA4 Analytics Detected',
      'Google Analytics 4 is the industry standard for web analytics. Without it, you lack visibility into user behavior and conversions.'
    ));
    evidence.missing.push('GA4 analytics');
  }

  // GTM presence (+15)
  if (analysis.hasGtm) {
    score += 15;
    evidence.found.push('Google Tag Manager detected');
    evidence.dataPoints.hasGtm = true;
  } else {
    issues.push(createIssue(
      'tracking',
      'medium',
      'No Tag Manager Detected',
      'Google Tag Manager enables flexible tag deployment without code changes. Without it, implementing new tracking requires developer involvement.'
    ));
    evidence.missing.push('Tag manager');
  }

  // Retargeting pixels (+10 each)
  if (analysis.hasFacebookPixel) {
    score += 10;
    evidence.found.push('Facebook Pixel detected');
  }
  if (analysis.hasLinkedinInsight) {
    score += 5;
    evidence.found.push('LinkedIn Insight Tag detected');
  }
  if (analysis.hasGoogleAds) {
    score += 5;
    evidence.found.push('Google Ads conversion tracking detected');
  }

  // No retargeting at all
  if (!analysis.hasFacebookPixel && !analysis.hasLinkedinInsight && !analysis.hasGoogleAds) {
    issues.push(createIssue(
      'tracking',
      'medium',
      'No Retargeting Infrastructure',
      'No advertising pixels detected. Retargeting is essential for efficient paid marketing.'
    ));
    evidence.missing.push('Retargeting pixels');
  }

  // Conversion tracking (+5)
  if (analysis.hasConversionTracking) {
    score += 5;
    evidence.found.push('Conversion tracking signals detected');
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  const summary = buildSummary('Tracking & Instrumentation', evidence, score);

  return {
    key: 'tracking',
    label: getDimensionLabel('tracking'),
    score,
    status: getStatusFromScore(score),
    summary,
    issues,
    evidence,
  };
}

/**
 * Score Data Quality & Governance dimension
 */
function scoreDataDimension(
  analysis: OpsAnalyzerOutput,
  createIssue: IssueCreator
): OpsLabDimension {
  let score = 45; // Base score
  const issues: OpsLabIssue[] = [];
  const evidence: OpsDimensionEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  // UTM usage
  evidence.dataPoints.utmUsageLevel = analysis.utmUsageLevel;
  if (analysis.utmUsageLevel === 'consistent') {
    score += 30;
    evidence.found.push('Consistent UTM parameter usage');
  } else if (analysis.utmUsageLevel === 'basic') {
    score += 15;
    evidence.found.push('Basic UTM usage detected');
    issues.push(createIssue(
      'data',
      'medium',
      'Inconsistent UTM Usage',
      'UTM parameters are used inconsistently. Standardize UTM naming conventions for accurate attribution.'
    ));
  } else {
    issues.push(createIssue(
      'data',
      'high',
      'No UTM Tracking',
      'No UTM parameters detected. Without UTMs, you cannot accurately attribute traffic sources.'
    ));
    evidence.missing.push('UTM parameters');
  }

  // Clean URL structure (+10)
  if (analysis.hasCleanUrlStructure) {
    score += 10;
    evidence.found.push('Clean URL structure');
  } else {
    evidence.missing.push('Clean URL structure');
  }

  // GTM indicates some governance (+10)
  if (analysis.hasGtm) {
    score += 10;
    evidence.found.push('Tag management in place (GTM)');
  }

  // Analytics tools diversity (indicates mature data stack)
  if (analysis.trackingTools.length >= 3) {
    score += 5;
    evidence.found.push(`Multiple analytics tools (${analysis.trackingTools.length})`);
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  const summary = buildSummary('Data Quality & Governance', evidence, score);

  return {
    key: 'data',
    label: getDimensionLabel('data'),
    score,
    status: getStatusFromScore(score),
    summary,
    issues,
    evidence,
  };
}

/**
 * Score CRM & Pipeline Hygiene dimension
 */
function scoreCrmDimension(
  analysis: OpsAnalyzerOutput,
  createIssue: IssueCreator
): OpsLabDimension {
  let score = 30; // Base score (lower base since CRM is often not visible on website)
  const issues: OpsLabIssue[] = [];
  const evidence: OpsDimensionEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  evidence.dataPoints.hasCrm = analysis.hasCrm;
  evidence.dataPoints.crmTools = analysis.crmTools.join(', ');

  // CRM detected (+40)
  if (analysis.hasCrm) {
    score += 40;
    evidence.found.push(`CRM detected: ${analysis.crmTools.join(', ')}`);

    // Specific CRM bonuses
    if (analysis.crmTools.includes('HubSpot') || analysis.crmTools.includes('Salesforce')) {
      score += 10;
      evidence.found.push('Enterprise-grade CRM');
    }
  } else {
    issues.push(createIssue(
      'crm',
      'medium',
      'No CRM Integration Detected',
      'No CRM signals found on the website. CRM integration is essential for tracking leads through the funnel.'
    ));
    evidence.missing.push('CRM integration');
  }

  // Form tracking (indicates lead capture wiring)
  if (analysis.hasConversionTracking) {
    score += 10;
    evidence.found.push('Form/conversion tracking detected');
  }

  // HubSpot forms specifically (+5)
  if (analysis.findings.crmSignals.tools.includes('HubSpot')) {
    score += 5;
    evidence.found.push('HubSpot forms integration');
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // If no CRM detected, cap score lower
  if (!analysis.hasCrm && score > 50) {
    score = 50;
  }

  const summary = buildSummary('CRM & Pipeline Hygiene', evidence, score);

  return {
    key: 'crm',
    label: getDimensionLabel('crm'),
    score,
    status: getStatusFromScore(score),
    summary,
    issues,
    evidence,
  };
}

/**
 * Score Automation & Journeys dimension
 */
function scoreAutomationDimension(
  analysis: OpsAnalyzerOutput,
  createIssue: IssueCreator
): OpsLabDimension {
  let score = 25; // Base score (lower base since automation often not visible)
  const issues: OpsLabIssue[] = [];
  const evidence: OpsDimensionEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  evidence.dataPoints.hasAutomationPlatform = analysis.hasAutomationPlatform;
  evidence.dataPoints.automationTools = analysis.automationTools.join(', ');

  // Automation platform detected (+45)
  if (analysis.hasAutomationPlatform) {
    score += 45;
    evidence.found.push(`Automation platform: ${analysis.automationTools.join(', ')}`);

    // Enterprise platforms bonus
    if (analysis.automationTools.includes('HubSpot') ||
        analysis.automationTools.includes('Marketo') ||
        analysis.automationTools.includes('ActiveCampaign')) {
      score += 10;
      evidence.found.push('Enterprise-grade automation');
    }
  } else {
    issues.push(createIssue(
      'automation',
      'medium',
      'No Marketing Automation Detected',
      'No marketing automation platform detected. Automation enables scalable lead nurturing and customer journeys.'
    ));
    evidence.missing.push('Marketing automation platform');
  }

  // Chat/engagement tools (+10)
  if (analysis.automationTools.includes('Intercom') ||
      analysis.automationTools.includes('Drift')) {
    score += 10;
    evidence.found.push('Chat/engagement automation');
  }

  // Email marketing (+5)
  if (analysis.automationTools.includes('Mailchimp') ||
      analysis.automationTools.includes('Klaviyo')) {
    score += 5;
    evidence.found.push('Email marketing tool');
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // If no automation detected, cap score
  if (!analysis.hasAutomationPlatform && score > 45) {
    score = 45;
  }

  const summary = buildSummary('Automation & Journeys', evidence, score);

  return {
    key: 'automation',
    label: getDimensionLabel('automation'),
    score,
    status: getStatusFromScore(score),
    summary,
    issues,
    evidence,
  };
}

/**
 * Score Experimentation & Optimization dimension
 */
function scoreExperimentationDimension(
  analysis: OpsAnalyzerOutput,
  createIssue: IssueCreator
): OpsLabDimension {
  let score = 20; // Base score (very low since experimentation often invisible)
  const issues: OpsLabIssue[] = [];
  const evidence: OpsDimensionEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  evidence.dataPoints.hasExperimentationTool = analysis.hasExperimentationTool;
  evidence.dataPoints.experimentationTools = analysis.experimentationTools.join(', ');

  // Experimentation tool detected (+50)
  if (analysis.hasExperimentationTool) {
    score += 50;
    evidence.found.push(`Experimentation tool: ${analysis.experimentationTools.join(', ')}`);

    // Specific tool bonuses
    if (analysis.experimentationTools.includes('Optimizely') ||
        analysis.experimentationTools.includes('VWO')) {
      score += 10;
      evidence.found.push('Enterprise experimentation platform');
    }
  } else {
    issues.push(createIssue(
      'experimentation',
      'low',
      'No Experimentation Platform Detected',
      'No A/B testing or experimentation tools detected. Testing infrastructure enables data-driven optimization.'
    ));
    evidence.missing.push('Experimentation platform');
  }

  // GA4 indicates some ability to measure experiments (+10)
  if (analysis.hasGa4) {
    score += 10;
    evidence.found.push('Analytics in place for measurement');
  }

  // Behavior analytics (+10)
  if (analysis.trackingTools.includes('Hotjar') ||
      analysis.trackingTools.includes('Heap') ||
      analysis.trackingTools.includes('Mixpanel')) {
    score += 10;
    evidence.found.push('Behavior analytics tool');
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // If no experimentation tool, cap score
  if (!analysis.hasExperimentationTool && score > 50) {
    score = 50;
  }

  const summary = buildSummary('Experimentation & Optimization', evidence, score);

  return {
    key: 'experimentation',
    label: getDimensionLabel('experimentation'),
    score,
    status: getStatusFromScore(score),
    summary,
    issues,
    evidence,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function buildSummary(
  dimensionName: string,
  evidence: OpsDimensionEvidence,
  score: number
): string {
  const status = getStatusFromScore(score);

  if (status === 'strong') {
    if (evidence.found.length > 0) {
      return `Strong ${dimensionName.toLowerCase()} with ${evidence.found.slice(0, 2).join(' and ').toLowerCase()}.`;
    }
    return `Strong ${dimensionName.toLowerCase()} foundation in place.`;
  } else if (status === 'moderate') {
    if (evidence.missing.length > 0) {
      return `Moderate ${dimensionName.toLowerCase()}, but missing ${evidence.missing[0].toLowerCase()}.`;
    }
    return `Moderate ${dimensionName.toLowerCase()} with room for improvement.`;
  } else {
    if (evidence.missing.length > 0) {
      return `Weak ${dimensionName.toLowerCase()}. Missing ${evidence.missing.slice(0, 2).join(' and ').toLowerCase()}.`;
    }
    return `${dimensionName} needs significant improvement.`;
  }
}
