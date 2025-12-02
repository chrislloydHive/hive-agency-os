// lib/diagnostics/content-lab/scoring.ts
// Content Lab Scoring Engine
//
// Scores 5 dimensions of content health:
// 1. Inventory & Presence - Do you have content?
// 2. Quality & Messaging - Is it well-written and clear?
// 3. Depth & Coverage - Does it cover your topics thoroughly?
// 4. Freshness - Is it up-to-date?
// 5. Content-Powered SEO - Is content driving search traffic?
//
// Company-type aware scoring adjusts expectations.

import type {
  ContentLabAnalysisOutput,
  ContentLabDimension,
  ContentLabIssue,
  ContentDimensionKey,
  ContentDimensionStatus,
  ContentIssueCategory,
  ContentMaturityStage,
  ContentLabEvidence,
} from './types';
import { getStatusFromScore, getMaturityFromScore, getDimensionLabel, generateIssueId } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ScoringOutput {
  overallScore: number;
  maturityStage: ContentMaturityStage;
  dimensions: ContentLabDimension[];
  issues: ContentLabIssue[];
}

type ContentCompanyType = 'b2b_services' | 'saas' | 'ecommerce' | 'local_service' | 'other' | 'unknown';

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score content lab dimensions based on analyzer output
 */
export function scoreContentLab(analysis: ContentLabAnalysisOutput): ScoringOutput {
  const companyType = normalizeCompanyType(analysis.companyType);
  const issues: ContentLabIssue[] = [];
  let issueIndex = 0;

  // Helper to create issues
  const mkIssue = (
    category: ContentIssueCategory,
    severity: 'low' | 'medium' | 'high',
    title: string,
    description: string
  ): ContentLabIssue => {
    return {
      id: generateIssueId(category, issueIndex++),
      category,
      severity,
      title,
      description,
    };
  };

  // Score each dimension
  const inventoryDim = scoreInventory(analysis, companyType, mkIssue);
  const qualityDim = scoreQuality(analysis, companyType, mkIssue);
  const depthDim = scoreDepth(analysis, companyType, mkIssue);
  const freshnessDim = scoreFreshness(analysis, companyType, mkIssue);
  const seoDim = scoreSeoSignals(analysis, companyType, mkIssue);

  const dimensions: ContentLabDimension[] = [
    inventoryDim,
    qualityDim,
    depthDim,
    freshnessDim,
    seoDim,
  ];

  // Collect all issues from dimensions
  for (const dim of dimensions) {
    issues.push(...dim.issues);
  }

  // Calculate overall score (weighted average)
  // Inventory and Freshness are slightly more important
  // V2: Handle null scores (not_evaluated dimensions)
  const weights: Record<ContentDimensionKey, number> = {
    inventory: 0.25,
    quality: 0.20,
    depth: 0.20,
    freshness: 0.20,
    seoSignals: 0.15,
  };

  let overallScore = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    if (dim.score !== null) {
      overallScore += dim.score * weights[dim.key];
      totalWeight += weights[dim.key];
    }
  }

  // Normalize by actual weight used (if some dimensions are not evaluated)
  if (totalWeight > 0) {
    overallScore = Math.round(overallScore / totalWeight * (totalWeight + (1 - totalWeight) * 0.5));
    // The above slightly penalizes missing data but doesn't tank the score
  }
  overallScore = Math.round(overallScore);

  // Apply safety cap: If no content exists, cap score at 35
  if (analysis.articleCount === 0 && !analysis.hasBlog) {
    overallScore = Math.min(overallScore, 35);
  }

  // If multiple dimensions are weak, cap score
  const weakDimensions = dimensions.filter(d => d.status === 'weak');
  if (weakDimensions.length >= 3) {
    overallScore = Math.min(overallScore, 45);
  }

  const maturityStage = getMaturityFromScore(overallScore);

  console.log('[ContentScoring] Complete:', {
    overallScore,
    maturityStage,
    dimensionScores: dimensions.map(d => ({ key: d.key, score: d.score, status: d.status })),
    issueCount: issues.length,
  });

  return {
    overallScore,
    maturityStage,
    dimensions,
    issues,
  };
}

// ============================================================================
// Dimension Scorers
// ============================================================================

type IssueMaker = (
  category: ContentIssueCategory,
  severity: 'low' | 'medium' | 'high',
  title: string,
  description: string
) => ContentLabIssue;

/**
 * Score Inventory & Presence dimension
 * - Do you have blog/articles?
 * - Case studies?
 * - Resources?
 */
function scoreInventory(
  analysis: ContentLabAnalysisOutput,
  companyType: ContentCompanyType,
  mkIssue: IssueMaker
): ContentLabDimension {
  let score = 50; // Start at moderate
  const issues: ContentLabIssue[] = [];
  const evidence: ContentLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  evidence.dataPoints['articleCount'] = analysis.articleCount;
  evidence.dataPoints['hasBlog'] = analysis.hasBlog;

  // Article count expectations by company type
  const expectations = {
    b2b_services: { min: 5, good: 15 },
    saas: { min: 10, good: 25 },
    ecommerce: { min: 3, good: 10 },
    local_service: { min: 2, good: 5 },
    other: { min: 3, good: 10 },
    unknown: { min: 3, good: 10 },
  };

  const exp = expectations[companyType];

  // Score based on article count
  if (analysis.articleCount === 0) {
    score = 25;
    issues.push(mkIssue(
      'Inventory',
      'high',
      'No blog or article content found',
      'Content is a critical trust builder and SEO driver. Starting a blog should be a priority.'
    ));
    evidence.missing.push('Blog or article content');
  } else if (analysis.articleCount < exp.min) {
    score = 40;
    issues.push(mkIssue(
      'Inventory',
      'medium',
      'Limited article inventory',
      `Only ${analysis.articleCount} articles found. Aim for at least ${exp.min} to establish credibility.`
    ));
    evidence.found.push(`${analysis.articleCount} articles`);
  } else if (analysis.articleCount >= exp.good) {
    score = 85;
    evidence.found.push(`${analysis.articleCount} articles (strong inventory)`);
  } else {
    score = 65;
    evidence.found.push(`${analysis.articleCount} articles`);
  }

  // Bonus for content variety
  if (analysis.hasCaseStudies) {
    score += 10;
    evidence.found.push('Case studies');
  } else if (companyType === 'b2b_services' || companyType === 'saas') {
    issues.push(mkIssue(
      'Inventory',
      'medium',
      'No case studies found',
      'Case studies are powerful proof points for B2B. Consider documenting client successes.'
    ));
    evidence.missing.push('Case studies');
  }

  if (analysis.hasResourcePages) {
    score += 5;
    evidence.found.push('Resource pages');
  }

  if (analysis.hasFaqContent) {
    score += 5;
    evidence.found.push('FAQ content');
  }

  // Cap at 100
  score = Math.min(100, score);

  return {
    key: 'inventory',
    label: getDimensionLabel('inventory'),
    score,
    status: getStatusFromScore(score),
    summary: buildInventorySummary(analysis, score),
    issues,
    evidence,
  };
}

/**
 * Score Quality & Messaging dimension
 * V1: Based on simple heuristics
 */
function scoreQuality(
  analysis: ContentLabAnalysisOutput,
  companyType: ContentCompanyType,
  mkIssue: IssueMaker
): ContentLabDimension {
  let score = 55; // Default moderate
  const issues: ContentLabIssue[] = [];
  const evidence: ContentLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  // If we have a GPT quality score, use it
  if (analysis.qualityScore !== undefined) {
    score = analysis.qualityScore;
    evidence.dataPoints['qualityScore'] = score;
    if (analysis.qualityNotes) {
      evidence.dataPoints['qualityNotes'] = analysis.qualityNotes;
    }
  }

  // Heuristic: Check article title quality
  if (analysis.extractedArticleTitles.length > 0) {
    const avgTitleLength = analysis.extractedArticleTitles.reduce((sum, t) => sum + t.length, 0)
      / analysis.extractedArticleTitles.length;

    evidence.dataPoints['avgTitleLength'] = Math.round(avgTitleLength);

    // Good titles are 30-70 characters
    if (avgTitleLength < 20) {
      score -= 10;
      issues.push(mkIssue(
        'Quality',
        'low',
        'Article titles are too short',
        'Short titles may lack context. Aim for descriptive, SEO-friendly titles.'
      ));
      evidence.missing.push('Descriptive titles');
    } else if (avgTitleLength > 80) {
      score -= 5;
      issues.push(mkIssue(
        'Quality',
        'low',
        'Article titles are too long',
        'Long titles get truncated in search results. Aim for 50-60 characters.'
      ));
    } else {
      evidence.found.push('Good title length');
    }

    // Check for keyword stuffing (multiple | or - separators)
    const stuffedTitles = analysis.extractedArticleTitles.filter(t =>
      (t.match(/[|]/g) || []).length > 1 || (t.match(/[-–]/g) || []).length > 2
    );
    if (stuffedTitles.length > analysis.extractedArticleTitles.length * 0.3) {
      score -= 5;
      evidence.missing.push('Clean title formatting');
    }
  } else if (analysis.articleCount === 0) {
    // No content to evaluate
    score = 40;
    issues.push(mkIssue(
      'Quality',
      'medium',
      'No content to evaluate quality',
      'Without content, we cannot assess quality. Start publishing to build your content library.'
    ));
  }

  // Pricing page presence is a quality signal for B2B/SaaS
  if ((companyType === 'b2b_services' || companyType === 'saas') && !analysis.hasPricingContent) {
    score -= 5;
    issues.push(mkIssue(
      'Quality',
      'low',
      'No pricing content found',
      'Transparent pricing builds trust. Consider adding pricing information or packages.'
    ));
    evidence.missing.push('Pricing content');
  } else if (analysis.hasPricingContent) {
    evidence.found.push('Pricing content');
  }

  score = Math.max(20, Math.min(100, score));

  return {
    key: 'quality',
    label: getDimensionLabel('quality'),
    score,
    status: getStatusFromScore(score),
    summary: buildQualitySummary(score),
    issues,
    evidence,
  };
}

/**
 * Score Depth & Coverage dimension V2
 * - Article count gates the maximum possible score
 * - Topic variety only adds bonuses if you have enough articles
 * - Content type variety adds modest bonuses
 */
function scoreDepth(
  analysis: ContentLabAnalysisOutput,
  companyType: ContentCompanyType,
  mkIssue: IssueMaker
): ContentLabDimension {
  const issues: ContentLabIssue[] = [];
  const evidence: ContentLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  const articleCount = analysis.articleCount;
  const topicCount = analysis.extractedTopics.length;

  // Count content types present
  let contentTypeCount = 0;
  if (analysis.hasBlog) contentTypeCount++;
  if (analysis.hasCaseStudies) contentTypeCount++;
  if (analysis.hasResourcePages) contentTypeCount++;
  if (analysis.hasFaqContent) contentTypeCount++;

  evidence.dataPoints['articleCount'] = articleCount;
  evidence.dataPoints['topicCount'] = topicCount;
  evidence.dataPoints['contentTypeCount'] = contentTypeCount;

  // V2: Article count gates the base score
  // Small libraries cannot claim "strong depth"
  let score = 60; // Neutral start

  if (articleCount === 0) {
    score = 30;
    evidence.missing.push('Any content to evaluate depth');
  } else if (articleCount < 3) {
    score = 40;
    issues.push(mkIssue(
      'Depth',
      'medium',
      'Very thin content library',
      `Only ${articleCount} article${articleCount === 1 ? '' : 's'} detected. Building depth requires consistent publishing.`
    ));
    evidence.found.push(`${articleCount} article${articleCount === 1 ? '' : 's'}`);
  } else if (articleCount < 7) {
    score = 55;
    issues.push(mkIssue(
      'Depth',
      'medium',
      'Thin content library',
      `Only ${articleCount} articles detected. Depth will improve as more content is published.`
    ));
    evidence.found.push(`${articleCount} articles`);
  } else if (articleCount < 15) {
    score = 65;
    evidence.found.push(`${articleCount} articles`);
  } else {
    score = 75;
    evidence.found.push(`${articleCount} articles (solid foundation)`);
  }

  // Topic richness bonuses - but ONLY if we have enough articles to justify it
  if (articleCount >= 7) {
    if (topicCount >= 5) {
      score += 10;
      evidence.found.push(`${topicCount} distinct topics`);
    } else if (topicCount >= 3) {
      score += 5;
      evidence.found.push(`${topicCount} topics identified`);
    }
  } else if (topicCount > 0) {
    // For small libraries, just note the topics without scoring boost
    evidence.found.push(`${topicCount} topic${topicCount === 1 ? '' : 's'} emerging`);
  }

  // Content format variety bonus
  if (contentTypeCount > 1) {
    score += 5;
    evidence.found.push('Multiple content formats');
  } else if (contentTypeCount <= 1 && articleCount > 0) {
    issues.push(mkIssue(
      'Depth',
      'low',
      'Limited content format variety',
      'Diversify with case studies, guides, or FAQs to serve different buyer needs.'
    ));
    evidence.missing.push('Content format variety');
  }

  // No topic clusters identified
  if (topicCount === 0 && articleCount > 0) {
    issues.push(mkIssue(
      'Depth',
      'low',
      'No clear topic clusters identified',
      'Content lacks thematic focus. Consider organizing around core topics.'
    ));
    evidence.missing.push('Topic clusters');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    key: 'depth',
    label: getDimensionLabel('depth'),
    score,
    status: getStatusFromScore(score),
    summary: buildDepthSummary(analysis, score),
    issues,
    evidence,
  };
}

/**
 * Score Content Freshness dimension
 * - Recent publications
 * - Last update dates
 */
function scoreFreshness(
  analysis: ContentLabAnalysisOutput,
  companyType: ContentCompanyType,
  mkIssue: IssueMaker
): ContentLabDimension {
  let score = 50;
  const issues: ContentLabIssue[] = [];
  const evidence: ContentLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  evidence.dataPoints['recentArticlesCount'] = analysis.recentArticlesCount;

  // No content = can't assess freshness
  if (analysis.articleCount === 0) {
    score = 30;
    evidence.missing.push('Content to assess freshness');
    return {
      key: 'freshness',
      label: getDimensionLabel('freshness'),
      score,
      status: getStatusFromScore(score),
      summary: 'No content found to assess freshness.',
      issues,
      evidence,
    };
  }

  // Recent articles scoring
  if (analysis.recentArticlesCount === 0) {
    score = 35;
    issues.push(mkIssue(
      'Freshness',
      'high',
      'No recent content published',
      'No articles from the last 6 months. Stale content signals neglect to both users and search engines.'
    ));
    evidence.missing.push('Recent publications');
  } else if (analysis.recentArticlesCount >= 5) {
    score = 85;
    evidence.found.push(`${analysis.recentArticlesCount} articles in last 6 months`);
  } else if (analysis.recentArticlesCount >= 2) {
    score = 65;
    evidence.found.push(`${analysis.recentArticlesCount} recent articles`);
  } else {
    score = 50;
    issues.push(mkIssue(
      'Freshness',
      'medium',
      'Limited recent publishing',
      'Only 1 article in the last 6 months. Aim for at least monthly content.'
    ));
  }

  // Check last updated dates
  if (analysis.lastUpdatedDates.length > 0) {
    const mostRecent = new Date(analysis.lastUpdatedDates[0]);
    const now = new Date();
    const monthsAgo = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24 * 30);

    evidence.dataPoints['mostRecentDate'] = analysis.lastUpdatedDates[0];
    evidence.dataPoints['monthsSinceUpdate'] = Math.round(monthsAgo);

    if (monthsAgo > 18) {
      score -= 15;
      issues.push(mkIssue(
        'Freshness',
        'high',
        'Content is significantly outdated',
        `Most recent content is from ${Math.round(monthsAgo)} months ago. This hurts SEO and user trust.`
      ));
      evidence.missing.push('Recent updates');
    } else if (monthsAgo > 12) {
      score -= 10;
      issues.push(mkIssue(
        'Freshness',
        'medium',
        'Content showing age',
        `Last update was ${Math.round(monthsAgo)} months ago. Consider refreshing key content.`
      ));
    } else if (monthsAgo < 3) {
      score += 10;
      evidence.found.push('Active publishing (last 3 months)');
    }
  }

  score = Math.max(20, Math.min(100, score));

  return {
    key: 'freshness',
    label: getDimensionLabel('freshness'),
    score,
    status: getStatusFromScore(score),
    summary: buildFreshnessSummary(analysis, score),
    issues,
    evidence,
  };
}

/**
 * Score Content-Powered SEO dimension V2
 * - If no GSC data, return "not_evaluated" with null score
 * - If GSC data available, score based on impressions, clicks, CTR
 * - If no content, still mark as weak
 */
function scoreSeoSignals(
  analysis: ContentLabAnalysisOutput,
  companyType: ContentCompanyType,
  mkIssue: IssueMaker
): ContentLabDimension {
  const issues: ContentLabIssue[] = [];
  const evidence: ContentLabEvidence = {
    found: [],
    missing: [],
    dataPoints: {},
  };

  const clicks = analysis.contentSearchClicks ?? null;
  const impressions = analysis.contentSearchImpressions ?? null;

  // If no content, can't have content SEO
  if (analysis.articleCount === 0) {
    issues.push(mkIssue(
      'SEO Signals',
      'high',
      'No content for search engines to index',
      'Without content, you miss organic search opportunities. Start publishing to capture search traffic.'
    ));
    evidence.missing.push('Content for indexing');
    return {
      key: 'seoSignals',
      label: getDimensionLabel('seoSignals'),
      score: 30,
      status: 'weak',
      summary: 'No content found for SEO analysis.',
      issues,
      evidence,
    };
  }

  // V2: If no GSC data, return not_evaluated with null score
  if (impressions === null || impressions === undefined) {
    // Note what we found (growing content)
    if (analysis.articleCount > 0) {
      evidence.found.push(`${analysis.articleCount} articles available for SEO`);
    }
    evidence.missing.push('Google Search Console data for accurate assessment');

    return {
      key: 'seoSignals',
      label: getDimensionLabel('seoSignals'),
      score: null,
      status: 'not_evaluated',
      summary: 'Connect Google Search Console for accurate content SEO assessment.',
      issues,
      evidence,
    };
  }

  // We have GSC data - score based on actual performance
  evidence.dataPoints['impressions'] = impressions;
  evidence.dataPoints['clicks'] = clicks ?? 0;

  let score = 50;

  if (impressions === 0) {
    score = 30;
    issues.push(mkIssue(
      'SEO Signals',
      'high',
      'Content not appearing in search results',
      'Zero impressions means content is not ranking. Review indexing and keyword targeting.'
    ));
    evidence.missing.push('Search visibility');
  } else {
    // We have impressions
    if (clicks === null || clicks === 0) {
      score = 45;
      issues.push(mkIssue(
        'SEO Signals',
        'medium',
        'Content has impressions but no clicks',
        'Content is appearing in search but not getting clicked. Improve titles and meta descriptions.'
      ));
      evidence.found.push(`${impressions.toLocaleString()} impressions`);
      evidence.missing.push('Search clicks');
    } else {
      // Calculate CTR
      const ctr = analysis.contentSearchCtr ?? (clicks / impressions);
      evidence.dataPoints['ctr'] = ctr;

      if (ctr >= 0.07) { // 7%+ CTR is exceptional
        score = 85;
        evidence.found.push(`${(ctr * 100).toFixed(1)}% CTR (excellent)`);
      } else if (ctr >= 0.03) { // 3%+ CTR is good
        score = 75;
        evidence.found.push(`${(ctr * 100).toFixed(1)}% CTR (good)`);
      } else if (ctr >= 0.01) { // 1%+ is okay
        score = 60;
        evidence.found.push(`${(ctr * 100).toFixed(1)}% CTR`);
        issues.push(mkIssue(
          'SEO Signals',
          'low',
          'Click-through rate has room to improve',
          `CTR of ${(ctr * 100).toFixed(1)}% is average. Optimize titles and meta descriptions.`
        ));
      } else {
        score = 45;
        issues.push(mkIssue(
          'SEO Signals',
          'medium',
          'Low click-through rate from search',
          `CTR of ${(ctr * 100).toFixed(1)}% is below average. Review and improve titles and snippets.`
        ));
      }

      evidence.found.push(`${clicks.toLocaleString()} clicks, ${impressions.toLocaleString()} impressions`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    key: 'seoSignals',
    label: getDimensionLabel('seoSignals'),
    score,
    status: getStatusFromScore(score),
    summary: buildSeoSummary(analysis, score),
    issues,
    evidence,
  };
}

// ============================================================================
// Summary Builders
// ============================================================================

function buildInventorySummary(analysis: ContentLabAnalysisOutput, score: number): string {
  if (analysis.articleCount === 0) {
    return 'No blog or article content was found. Content is essential for building trust and SEO.';
  }
  if (score >= 70) {
    const extras = [
      analysis.hasCaseStudies ? 'case studies' : '',
      analysis.hasResourcePages ? 'resources' : '',
    ].filter(Boolean).join(' and ');
    return `Strong content inventory with ${analysis.articleCount} articles${extras ? ` plus ${extras}` : ''}.`;
  }
  return `Content inventory includes ${analysis.articleCount} articles. Room to grow.`;
}

function buildQualitySummary(score: number): string {
  if (score >= 70) {
    return 'Content quality signals are positive with good formatting and structure.';
  }
  if (score >= 50) {
    return 'Content quality is acceptable but has room for improvement.';
  }
  return 'Content quality needs attention. Focus on clear, well-structured writing.';
}

function buildDepthSummary(analysis: ContentLabAnalysisOutput, score: number): string {
  const articleCount = analysis.articleCount;
  const topicCount = analysis.extractedTopics.length;

  if (articleCount === 0) {
    return 'No content to evaluate depth.';
  }

  if (articleCount < 5) {
    return `Only ${articleCount} articles detected. Depth will improve as content library grows.`;
  }

  if (topicCount === 0) {
    return 'Content lacks thematic focus. Consider organizing around core topics.';
  }

  if (score >= 70) {
    return `Solid depth with ${articleCount} articles across ${topicCount} topic clusters.`;
  }

  return `${articleCount} articles covering ${topicCount} topics. Consider expanding with guides and case studies.`;
}

function buildFreshnessSummary(analysis: ContentLabAnalysisOutput, score: number): string {
  if (analysis.articleCount === 0) {
    return 'No content found to assess freshness.';
  }
  if (analysis.recentArticlesCount === 0) {
    return 'No recent content found. The content library appears stale.';
  }
  if (score >= 70) {
    return `Active publishing with ${analysis.recentArticlesCount} pieces in the last 6 months.`;
  }
  return `Limited recent activity with ${analysis.recentArticlesCount} recent articles.`;
}

function buildSeoSummary(analysis: ContentLabAnalysisOutput, score: number | null): string {
  if (analysis.articleCount === 0) {
    return 'No content available to drive organic search traffic.';
  }

  // V2: Handle not_evaluated case
  if (score === null) {
    return 'Connect Google Search Console for accurate content SEO assessment.';
  }

  if (analysis.contentSearchImpressions !== undefined) {
    if (analysis.contentSearchImpressions === 0) {
      return 'Content is not appearing in search results. Review indexing and targeting.';
    }
    const clicks = analysis.contentSearchClicks || 0;
    const impressions = analysis.contentSearchImpressions;
    if (clicks > 0) {
      const ctr = (clicks / impressions * 100).toFixed(1);
      return `Content has ${impressions.toLocaleString()} impressions and ${clicks.toLocaleString()} clicks (${ctr}% CTR).`;
    }
    return `Content has ${impressions.toLocaleString()} impressions but no clicks yet.`;
  }

  return 'Connect Google Search Console for accurate content SEO assessment.';
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeCompanyType(raw?: string | null): ContentCompanyType {
  if (!raw) return 'unknown';
  const lowered = raw.toLowerCase().trim();

  if (lowered.includes('saas') || lowered.includes('software')) return 'saas';
  if (lowered.includes('ecom') || lowered.includes('shop') || lowered.includes('retail')) return 'ecommerce';
  if (lowered.includes('local')) return 'local_service';
  if (lowered.includes('b2b')) return 'b2b_services';
  if (lowered === 'services' || lowered.includes('agency') || lowered.includes('consult')) return 'b2b_services';

  return 'other';
}
