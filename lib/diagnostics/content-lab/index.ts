// lib/diagnostics/content-lab/index.ts
// Content Lab V1 Main Entry Point
//
// This is the main orchestrator that:
// 1. Runs the analyzer to collect content signals
// 2. Scores the content system (company-type aware)
// 3. Generates narrative summary
// 4. Builds quick wins and projects
// 5. Returns the complete ContentLabResult

import type {
  ContentLabResult,
  ContentLabEngineResult,
  ContentLabQuickWin,
  ContentLabProject,
  ContentLabFindings,
  ContentAnalyticsSnapshot,
} from './types';
import { analyzeContentInputs } from './analyzer';
import { scoreContentLab, ScoringOutput } from './scoring';
import { generateContentNarrative } from './narrative';
import { ensureCanonical } from '@/lib/diagnostics/shared';

// Re-export types for convenience
export * from './types';

// ============================================================================
// Main Run Function
// ============================================================================

export interface RunContentLabParams {
  companyId?: string;
  url: string;
  companyType?: string | null;
  workspaceId?: string;
  // Legacy support
  websiteUrl?: string;
}

/**
 * Run Content Lab diagnostic
 * V1: Company-type aware content analysis and scoring
 *
 * This is the main entry point that orchestrates:
 * 1. Signal collection (crawling content pages)
 * 2. Company-type aware scoring across 5 dimensions
 * 3. Narrative generation
 * 4. Quick wins and projects derivation
 */
export async function runContentLab(
  params: RunContentLabParams
): Promise<ContentLabResult> {
  // Support both url and websiteUrl for backwards compatibility
  const websiteUrl = params.url || params.websiteUrl || '';
  const { companyId, companyType, workspaceId } = params;

  console.log('[ContentLab V1] Starting analysis:', { companyId, websiteUrl, companyType });

  // 1. Collect content signals
  const analysis = await analyzeContentInputs({
    companyId,
    url: websiteUrl,
    companyType,
    workspaceId,
  });

  console.log('[ContentLab V1] Analysis complete:', {
    articleCount: analysis.articleCount,
    hasBlog: analysis.hasBlog,
    hasCaseStudies: analysis.hasCaseStudies,
    topics: analysis.extractedTopics.length,
    recentArticles: analysis.recentArticlesCount,
    dataConfidence: analysis.dataConfidence.level,
  });

  // 2. Score the content system (company-type aware)
  const scoring = scoreContentLab(analysis);

  console.log('[ContentLab V1] Scoring complete:', {
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
    issueCount: scoring.issues.length,
  });

  // 3. Generate narrative summary
  const narrativeSummary = generateContentNarrative({
    dimensions: scoring.dimensions,
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
    articleCount: analysis.articleCount,
    recentArticlesCount: analysis.recentArticlesCount,
  });

  // 4. Build quick wins
  const quickWins = buildContentQuickWins(scoring, analysis);

  // 5. Build projects
  const projects = buildContentProjects(scoring, analysis);

  // Build analytics snapshot if GSC data available
  let analyticsSnapshot: ContentAnalyticsSnapshot | undefined;
  if (analysis.contentSearchImpressions !== undefined) {
    analyticsSnapshot = {
      clicks: analysis.contentSearchClicks,
      impressions: analysis.contentSearchImpressions,
      ctr: analysis.contentSearchCtr,
    };
  }

  // Build findings
  const findings: ContentLabFindings = {
    contentUrls: analysis.contentUrls,
    articleTitles: analysis.extractedArticleTitles,
    topics: analysis.extractedTopics,
    contentTypes: [],
  };

  // CANONICAL CONTRACT: Ensure all required fields are present
  const canonicalInput = {
    maturityStage: scoring.maturityStage,
    contentTypes: analysis.hasBlog ? ['blog'] : [],
    topTopics: analysis.extractedTopics.slice(0, 10),
    topIssues: scoring.issues.slice(0, 5).map((i) => ({
      title: i.title,
      severity: i.severity,
    })),
  };

  const canonicalResult = ensureCanonical({
    labType: 'content',
    canonical: canonicalInput,
    v1Result: { ...analysis, ...scoring } as Record<string, unknown>,
  });

  if (canonicalResult.synthesizedFields.length > 0) {
    console.log('[ContentLab V1] Synthesized canonical fields:', canonicalResult.synthesizedFields);
  }

  console.log('[ContentLab V1] Complete:', {
    issues: scoring.issues.length,
    quickWins: quickWins.length,
    projects: projects.length,
    topics: analysis.extractedTopics.slice(0, 5),
    canonicalValid: canonicalResult.valid,
  });

  return {
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
    dataConfidence: analysis.dataConfidence,
    narrativeSummary,
    dimensions: scoring.dimensions,
    issues: scoring.issues,
    quickWins,
    projects,
    analyticsSnapshot,
    findings,
    generatedAt: new Date().toISOString(),
    url: websiteUrl,
    companyId,
    companyType: analysis.companyType,
  };
}

/**
 * Run Content Lab and wrap result in engine result format
 */
export async function runContentLabEngine(
  params: RunContentLabParams
): Promise<ContentLabEngineResult> {
  try {
    const report = await runContentLab(params);

    return {
      success: true,
      score: report.overallScore,
      summary: report.narrativeSummary,
      report,
    };
  } catch (error) {
    console.error('[ContentLab V1] Engine error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Quick Wins Builder
// ============================================================================

/**
 * Build quick wins from scoring results
 */
function buildContentQuickWins(
  scoring: ScoringOutput,
  analysis: ReturnType<typeof analyzeContentInputs> extends Promise<infer T> ? T : never
): ContentLabQuickWin[] {
  const wins: ContentLabQuickWin[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    action: string,
    impact: 'low' | 'medium' | 'high',
    effort: 'low' | 'medium' | 'high'
  ) => {
    wins.push({
      id: `cq-${idCounter++}`,
      category,
      action,
      expectedImpact: impact,
      effortLevel: effort,
    });
  };

  const inventory = scoring.dimensions.find(d => d.key === 'inventory');
  const quality = scoring.dimensions.find(d => d.key === 'quality');
  const depth = scoring.dimensions.find(d => d.key === 'depth');
  const freshness = scoring.dimensions.find(d => d.key === 'freshness');
  const seo = scoring.dimensions.find(d => d.key === 'seoSignals');

  // Inventory quick wins
  if (analysis.articleCount === 0) {
    add(
      'Inventory',
      'Publish your first 3 blog articles addressing common customer questions.',
      'high',
      'medium'
    );
    add(
      'Inventory',
      'Create a Resources or Blog hub page to house content.',
      'high',
      'low'
    );
  } else if (inventory && inventory.score !== null && inventory.score < 60) {
    add(
      'Inventory',
      'Expand content library by publishing 1-2 articles per month consistently.',
      'high',
      'medium'
    );
  }

  // Case study quick win
  if (!analysis.hasCaseStudies && analysis.articleCount > 0) {
    add(
      'Inventory',
      'Document one client success story as a case study.',
      'high',
      'medium'
    );
  }

  // Quality quick wins
  if (quality && quality.score !== null && quality.score < 60) {
    add(
      'Quality',
      'Audit top 5 articles for clear headlines, structure, and CTAs.',
      'medium',
      'low'
    );
  }

  // Freshness quick wins
  if (freshness && freshness.score !== null && freshness.score < 60) {
    add(
      'Freshness',
      'Update your 3 most-visited articles with current information.',
      'medium',
      'low'
    );
    if (analysis.recentArticlesCount === 0) {
      add(
        'Freshness',
        'Commit to publishing at least one article in the next 30 days.',
        'high',
        'medium'
      );
    }
  }

  // Depth quick wins - V2: use meaningful multi-word topics
  if (depth && depth.score !== null && depth.score < 60) {
    const meaningfulTopics = (analysis.extractedTopics ?? [])
      .filter(t => t.split(' ').length >= 2);

    if (meaningfulTopics.length > 0) {
      const primaryTopic = meaningfulTopics[0];
      add(
        'Depth',
        `Create a comprehensive guide around "${primaryTopic}".`,
        'high',
        'medium'
      );
    } else if (analysis.extractedTopics.length > 0) {
      // Fall back to single-word topics if no multi-word ones
      add(
        'Depth',
        'Identify and develop 2-3 core topic areas for your content strategy.',
        'high',
        'medium'
      );
    }
  }

  // SEO quick wins - V2: handle null (not_evaluated) score
  if (seo && seo.score !== null && seo.score < 60) {
    add(
      'SEO Signals',
      'Optimize meta titles and descriptions for your top 5 content pages.',
      'medium',
      'low'
    );
  } else if (seo && seo.score === null) {
    // GSC not connected
    add(
      'SEO Signals',
      'Connect Google Search Console to track content search performance.',
      'medium',
      'low'
    );
  }

  // FAQ content quick win
  if (!analysis.hasFaqContent) {
    add(
      'Inventory',
      'Create an FAQ page addressing your top 10 customer questions.',
      'medium',
      'low'
    );
  }

  // Sort by impact and limit
  return wins
    .sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.expectedImpact] - impactOrder[b.expectedImpact];
    })
    .slice(0, 5);
}

// ============================================================================
// Projects Builder
// ============================================================================

/**
 * Build strategic projects from scoring results
 */
function buildContentProjects(
  scoring: ScoringOutput,
  analysis: ReturnType<typeof analyzeContentInputs> extends Promise<infer T> ? T : never
): ContentLabProject[] {
  const projects: ContentLabProject[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    title: string,
    description: string,
    impact: 'low' | 'medium' | 'high',
    timeHorizon: 'near-term' | 'mid-term' | 'long-term'
  ) => {
    projects.push({
      id: `cp-${idCounter++}`,
      category,
      title,
      description,
      impact,
      timeHorizon,
    });
  };

  // Find weakest dimension for primary project
  // V2: Handle null scores - treat null as 50 (neutral) for sorting
  const weakest = [...scoring.dimensions]
    .filter(d => d.score !== null) // Only consider evaluated dimensions
    .sort((a, b) => (a.score ?? 50) - (b.score ?? 50))[0];

  // Add project based on weakest dimension
  if (weakest) {
    if (weakest.key === 'inventory') {
      add(
        'Inventory',
        'Build a foundational content library',
        'Create 10-15 core articles covering your key topics, services, and frequently asked questions. Include a mix of how-to guides, thought leadership, and product/service explanations.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'quality') {
      add(
        'Quality',
        'Implement content quality standards',
        'Define editorial guidelines, create content templates, and establish a review process. Audit and refresh existing content to meet new standards.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'depth') {
      add(
        'Depth',
        'Build topic cluster content strategy',
        'Identify 3-5 core topic areas and create comprehensive content clusters around each. Include pillar pages linked to supporting articles.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'freshness') {
      add(
        'Freshness',
        'Establish content publishing cadence',
        'Create an editorial calendar with monthly publishing targets. Set up content refresh cycles for evergreen pieces.',
        'high',
        'near-term'
      );
    } else if (weakest.key === 'seoSignals') {
      add(
        'SEO Signals',
        'Implement content SEO optimization',
        'Perform keyword research, optimize existing content for target keywords, and implement technical SEO best practices across content pages.',
        'high',
        'mid-term'
      );
    }
  }

  // Add maturity-based projects
  if (scoring.maturityStage === 'unproven') {
    add(
      'Foundation',
      'Launch content marketing program',
      'Establish the basics: blog infrastructure, editorial calendar, content templates, and initial topic strategy. This foundational work enables all future content efforts.',
      'high',
      'near-term'
    );
  } else if (scoring.maturityStage === 'emerging') {
    add(
      'Scale',
      'Scale content production',
      'Increase publishing frequency, diversify content formats (videos, podcasts, infographics), and build a content repurposing workflow.',
      'high',
      'mid-term'
    );
  } else if (scoring.maturityStage === 'scaling') {
    add(
      'Optimization',
      'Optimize content performance',
      'Implement A/B testing for content, build conversion funnels from content, and establish content attribution tracking.',
      'high',
      'mid-term'
    );
  }

  // V2: Topic cluster project - only if we have meaningful multi-word topics
  const meaningfulTopics = (analysis.extractedTopics ?? [])
    .filter(t => t.split(' ').length >= 2); // Only multi-word phrases

  if (meaningfulTopics.length >= 2) {
    const topTopics = meaningfulTopics.slice(0, 3);
    const topicsStr = topTopics.join(', ');
    add(
      'Depth',
      `Build topic authority in ${topicsStr}`,
      `Create comprehensive content clusters around your key topics: ${topicsStr}. Each cluster should have a pillar page and 3-7 supporting articles.`,
      'medium',
      'mid-term'
    );
  } else if (meaningfulTopics.length === 1) {
    add(
      'Depth',
      `Build topic authority in ${meaningfulTopics[0]}`,
      `Create a comprehensive content cluster around "${meaningfulTopics[0]}" with a pillar page and 3-5 supporting articles.`,
      'medium',
      'mid-term'
    );
  }

  // Case study library project
  if (!analysis.hasCaseStudies) {
    add(
      'Inventory',
      'Create case study library',
      'Document 3-5 client success stories as detailed case studies. Include problem, solution, results, and testimonials. Create a dedicated case studies section.',
      'medium',
      'mid-term'
    );
  }

  // Add secondary projects for other weak dimensions
  const weakDimensions = scoring.dimensions.filter(
    d => d.status === 'weak' && d.key !== weakest?.key
  );
  for (const dim of weakDimensions.slice(0, 2)) {
    const projectTemplates: Record<string, { title: string; description: string }> = {
      inventory: {
        title: 'Expand content library',
        description: 'Systematically build out content across all key topics and buyer journey stages.',
      },
      quality: {
        title: 'Improve content quality',
        description: 'Audit existing content, establish quality standards, and refresh underperforming pieces.',
      },
      depth: {
        title: 'Deepen topic coverage',
        description: 'Create comprehensive resources, guides, and pillar content for core topics.',
      },
      freshness: {
        title: 'Revitalize content program',
        description: 'Resume regular publishing, update stale content, and maintain editorial momentum.',
      },
      seoSignals: {
        title: 'Boost content SEO',
        description: 'Optimize content for search, improve internal linking, and target strategic keywords.',
      },
    };

    const template = projectTemplates[dim.key];
    if (template) {
      add(dim.label, template.title, template.description, 'medium', 'mid-term');
    }
  }

  // Limit to top 5 projects
  return projects.slice(0, 5);
}
