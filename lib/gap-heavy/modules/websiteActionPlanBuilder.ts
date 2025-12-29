// lib/gap-heavy/modules/websiteActionPlanBuilder.ts
// Website Diagnostic Action Plan Builder
//
// This module synthesizes Website Lab analysis into a structured,
// prioritized action plan for Hive strategists.

import type {
  WebsiteActionPlan,
  WebsiteWorkItem,
  WebsiteActionTheme,
  WebsiteExperiment,
  StrategyChange,
} from './websiteActionPlan';
import { dimensionToServiceArea } from './websiteActionPlan';
import type {
  WebsiteUXLabResultV4,
  WebsiteUxDimensionKey,
  BenchmarkLabel,
} from './websiteLab';

// ============================================================================
// MAIN BUILDER FUNCTION
// ============================================================================

/**
 * Build a WebsiteActionPlan from a WebsiteUXLabResultV4
 *
 * This is the **synthesis layer** that converts rich diagnostic data
 * into a prioritized set of actions for Hive strategists.
 *
 * @param labResult - Complete Website Lab analysis result
 * @returns Structured action plan
 */
export function buildWebsiteActionPlan(
  labResult: WebsiteUXLabResultV4
): WebsiteActionPlan {
  console.log('[WebsiteActionPlanBuilder] Building action plan from lab result...');

  const { siteAssessment } = labResult;

  // ========================================================================
  // 1. Generate Summary
  // ========================================================================
  // Use LLM-generated executive summary if available, otherwise fall back to template
  const summary = siteAssessment.executiveSummary || generateActionSummary(labResult);
  const overallScore = siteAssessment.score || 0;
  const benchmarkLabel: BenchmarkLabel = siteAssessment.benchmarkLabel || 'average';

  // ========================================================================
  // 2. Identify Key Themes
  // ========================================================================
  const keyThemes = identifyKeyThemes(labResult);

  // ========================================================================
  // 3. Synthesize Work Items from Multiple Sources
  // ========================================================================
  const allWorkItems = synthesizeWorkItems(labResult);

  // ========================================================================
  // 4. Assign to Priority Buckets (Now / Next / Later)
  // ========================================================================
  const now: WebsiteWorkItem[] = [];
  const next: WebsiteWorkItem[] = [];
  const later: WebsiteWorkItem[] = [];

  for (const item of allWorkItems) {
    if (item.priority === 'now') {
      now.push(item);
    } else if (item.priority === 'next') {
      next.push(item);
    } else {
      later.push(item);
    }
  }

  // Sort by impact*lift, descending
  const sortByImpact = (a: WebsiteWorkItem, b: WebsiteWorkItem) => {
    const aScore = a.impactScore * (a.estimatedLift || 1);
    const bScore = b.impactScore * (b.estimatedLift || 1);
    return bScore - aScore;
  };

  now.sort(sortByImpact);
  next.sort(sortByImpact);
  later.sort(sortByImpact);

  // ========================================================================
  // 5. Generate Experiments
  // ========================================================================
  const experiments = generateExperiments(labResult);

  // ========================================================================
  // 6. Generate Strategic Changes
  // ========================================================================
  const strategicChanges = generateStrategicChanges(labResult);

  // ========================================================================
  // 7. Assemble Final Plan
  // ========================================================================
  const actionPlan: WebsiteActionPlan = {
    summary,
    overallScore,
    benchmarkLabel,
    keyThemes,
    now,
    next,
    later,
    experiments,
    strategicChanges,
    supportingNarrative: siteAssessment.strategistView,
  };

  console.log('[WebsiteActionPlanBuilder] ✓ Action plan built:');
  console.log(`  - ${now.length} items in NOW bucket`);
  console.log(`  - ${next.length} items in NEXT bucket`);
  console.log(`  - ${later.length} items in LATER bucket`);
  console.log(`  - ${keyThemes.length} themes identified`);
  console.log(`  - ${experiments.length} experiments proposed`);

  return actionPlan;
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

function generateActionSummary(labResult: WebsiteUXLabResultV4): string {
  const { siteAssessment, impactMatrix, siteGraph } = labResult;
  const pageCount = siteGraph.pages.length;
  const score = siteAssessment.score || 0;
  const benchmarkLabel = siteAssessment.benchmarkLabel || 'average';

  const quickWinsCount = impactMatrix?.quickWins?.length || 0;
  const majorIssuesCount =
    siteAssessment.issues?.filter((i) => i.severity === 'high').length || 0;

  let summary = `**${benchmarkLabel.toUpperCase()} (${score}/100)** - Analyzed ${pageCount} pages\n\n`;

  if (score < 60) {
    summary += `This website has **significant UX and conversion issues** that need immediate attention. ${majorIssuesCount} critical issues were identified. `;
  } else if (score < 80) {
    summary += `This website has a **solid foundation** but substantial room for improvement. ${majorIssuesCount} critical issues were identified. `;
  } else {
    summary += `This website performs **well** but still has optimization opportunities. ${majorIssuesCount} critical issues were identified. `;
  }

  summary += `${quickWinsCount} quick wins available for immediate impact.\n\n`;

  summary += `**Focus Areas:** `;
  const focusAreas = siteAssessment.focusAreas || [];
  if (focusAreas.length > 0) {
    summary += focusAreas
      .map((area) => {
        const labels: Record<WebsiteUxDimensionKey, string> = {
          overall_experience: 'Overall Experience',
          hero_and_value_prop: 'Hero & Value Prop',
          navigation_and_structure: 'Navigation',
          trust_and_social_proof: 'Trust Signals',
          conversion_flow: 'Conversion Flow',
          content_and_clarity: 'Content Clarity',
          visual_and_mobile: 'Visual & Mobile',
          intent_alignment: 'Intent Alignment',
        };
        return labels[area] || area;
      })
      .join(', ');
  } else {
    summary += 'Overall experience, conversion flow, and trust signals';
  }

  return summary;
}

// ============================================================================
// THEME IDENTIFICATION
// ============================================================================

function identifyKeyThemes(labResult: WebsiteUXLabResultV4): WebsiteActionTheme[] {
  const themes: WebsiteActionTheme[] = [];
  const { siteAssessment, trustAnalysis, ctaIntelligence, contentIntelligence } = labResult;

  // Theme 1: Trust & Social Proof
  if (trustAnalysis && trustAnalysis.trustScore < 70) {
    themes.push({
      id: 'theme-trust',
      label: 'Trust & Social Proof',
      description:
        'Trust signals are weak or missing. Adding testimonials, logos, case studies, and proof statements will increase credibility and reduce bounce.',
      priority: trustAnalysis.trustScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['trust_and_social_proof'],
      linkedPages: trustAnalysis.distribution?.pagesMissingTrust || [],
      expectedImpactSummary: 'Improve conversion by 10-20% through increased credibility',
    });
  }

  // Theme 2: Value Proposition & Hero
  const heroScore = siteAssessment.sectionScores?.hierarchy || 0;
  if (heroScore < 70) {
    themes.push({
      id: 'theme-hero',
      label: 'Hero & Value Proposition',
      description:
        "The homepage hero lacks clarity, differentiation, or urgency. Visitors don't immediately understand what you do or why it matters.",
      priority: heroScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['hero_and_value_prop', 'content_and_clarity'],
      expectedImpactSummary: 'Reduce bounce rate by 15-25% with clearer value communication',
    });
  }

  // Theme 3: Conversion Flow & CTAs
  if (ctaIntelligence && ctaIntelligence.summaryScore < 70) {
    themes.push({
      id: 'theme-conversion',
      label: 'Conversion Flow & CTAs',
      description:
        "CTAs are weak, inconsistent, or missing. Visitors don't have a clear next step, leading to drop-off.",
      priority: ctaIntelligence.summaryScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['conversion_flow'],
      linkedPages: ctaIntelligence.patterns?.pagesMissingCtas || [],
      expectedImpactSummary: 'Increase conversion rate by 20-40% with stronger CTAs',
    });
  }

  // Theme 4: Navigation & Structure
  const navScore = siteAssessment.sectionScores?.navigation || 0;
  if (navScore < 70 || (siteAssessment.funnelHealthScore || 0) < 70) {
    themes.push({
      id: 'theme-navigation',
      label: 'Navigation & Path to Conversion',
      description:
        'Navigation is confusing, or key pages are too many clicks away. Visitors struggle to find pricing or contact info.',
      priority: navScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['navigation_and_structure', 'conversion_flow'],
      expectedImpactSummary: 'Reduce friction and improve path-to-conversion',
    });
  }

  // Theme 5: Content Clarity
  if (contentIntelligence && contentIntelligence.summaryScore < 70) {
    themes.push({
      id: 'theme-content',
      label: 'Content Clarity & Messaging',
      description:
        "Messaging is vague, jargon-heavy, or feature-focused instead of benefit-focused. Visitors can't quickly grasp value.",
      priority: contentIntelligence.summaryScore < 50 ? 'critical' : 'important',
      linkedDimensions: ['content_and_clarity'],
      expectedImpactSummary: 'Improve engagement and reduce bounce',
    });
  }

  // Theme 6: Visual & Brand Consistency
  const visualScore = siteAssessment.sectionScores?.visualDesign || 0;
  if (visualScore < 70) {
    themes.push({
      id: 'theme-visual',
      label: 'Visual & Brand Consistency',
      description:
        'Visual design is inconsistent, cluttered, or outdated. This reduces trust and makes the experience feel unprofessional.',
      priority: visualScore < 50 ? 'important' : 'nice_to_have',
      linkedDimensions: ['visual_and_mobile'],
      expectedImpactSummary: 'Increase trust and perceived quality',
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, nice_to_have: 2 };
  themes.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return themes.slice(0, 5); // Top 5 themes
}

// ============================================================================
// WORK ITEM SYNTHESIS
// ============================================================================

function synthesizeWorkItems(labResult: WebsiteUXLabResultV4): WebsiteWorkItem[] {
  const items: WebsiteWorkItem[] = [];

  // Pull from impact matrix (primary source)
  items.push(...synthesizeFromImpactMatrix(labResult));

  // Pull from assessment issues
  items.push(...synthesizeFromIssues(labResult));

  // Pull from persona friction
  items.push(...synthesizeFromPersonas(labResult));

  // Pull from strategist views
  items.push(...synthesizeFromStrategistViews(labResult));

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

function synthesizeFromImpactMatrix(labResult: WebsiteUXLabResultV4): WebsiteWorkItem[] {
  const { impactMatrix } = labResult;
  if (!impactMatrix) return [];

  const items: WebsiteWorkItem[] = [];

  for (const matrixItem of impactMatrix.items || []) {
    const dimension = matrixItem.dimensions?.[0] || 'overall_experience';
    const serviceArea = dimensionToServiceArea(dimension);

    items.push({
      id: matrixItem.id,
      title: matrixItem.title,
      description: matrixItem.description,
      rationale: matrixItem.rationale,
      evidenceRefs: [matrixItem.id],
      dimension,
      serviceArea,
      impactScore: matrixItem.impact,
      effortScore: matrixItem.effort,
      estimatedLift: matrixItem.estimatedLift,
      priority: matrixItem.priority,
      recommendedTimebox: inferTimebox(matrixItem.effort),
      status: 'backlog',
      tags: inferTags(matrixItem.title, matrixItem.description),
    });
  }

  return items;
}

function synthesizeFromIssues(labResult: WebsiteUXLabResultV4): WebsiteWorkItem[] {
  const { siteAssessment } = labResult;
  const issues = siteAssessment.issues || [];
  const items: WebsiteWorkItem[] = [];

  // Only create work items for high-severity issues
  const highSeverityIssues = issues.filter((issue) => issue.severity === 'high');

  for (const issue of highSeverityIssues) {
    // Infer dimension from tag
    const dimension = inferDimensionFromTag(issue.tag);
    const serviceArea = dimensionToServiceArea(dimension);

    // Estimate impact/effort heuristically
    const impactScore = 4; // High severity = high impact
    const effortScore = 3; // Medium effort by default

    items.push({
      id: `issue-${issue.id}`,
      title: `Fix: ${issue.tag}`,
      description: issue.description,
      rationale: `High-severity issue: ${issue.evidence || 'Multiple instances detected'}`,
      evidenceRefs: [issue.id || ''],
      dimension,
      serviceArea,
      impactScore,
      effortScore,
      priority: 'now',
      status: 'backlog',
      recommendedTimebox: inferTimebox(effortScore),
      tags: inferTags(issue.tag, issue.description),
    });
  }

  return items;
}

function synthesizeFromPersonas(labResult: WebsiteUXLabResultV4): WebsiteWorkItem[] {
  const { personas } = labResult;
  if (!personas) return [];

  const items: WebsiteWorkItem[] = [];

  for (const persona of personas) {
    if (persona.success) continue; // Only care about failures

    const fixes = persona.personaSpecificFixes || persona.frictionNotes || [];
    for (const fix of fixes.slice(0, 2)) {
      // Top 2 fixes per persona
      const dimension = inferDimensionFromFix(fix);
      const serviceArea = dimensionToServiceArea(dimension);

      // Build meaningful rationale
      const personaName = persona.persona.replace(/_/g, ' ');
      const failureContext = persona.frictionNotes?.[0] || 'encountered friction in the user journey';
      const rationale = `${personaName} personas couldn't achieve "${persona.goal}" because ${failureContext}. Fixing this removes a key barrier to conversion.`;

      items.push({
        id: `persona-${persona.persona}-${Math.random().toString(36).substring(7)}`,
        title: `Improve for ${personaName} persona`,
        description: fix,
        rationale,
        evidenceRefs: [`persona-${persona.persona}`],
        dimension,
        serviceArea,
        impactScore: 3,
        effortScore: 2,
        priority: 'next',
        status: 'backlog',
        recommendedTimebox: '3-5 days',
        tags: [persona.persona, 'persona'],
      });
    }
  }

  return items;
}

function synthesizeFromStrategistViews(labResult: WebsiteUXLabResultV4): WebsiteWorkItem[] {
  const { strategistViews } = labResult;
  if (!strategistViews) return [];

  const items: WebsiteWorkItem[] = [];

  // Conversion strategist opportunities
  const conversionOpportunities = strategistViews.conversion?.opportunities || [];
  for (const opportunity of conversionOpportunities.slice(0, 3)) {
    const readinessScore = strategistViews.conversion.conversionReadinessScore;
    const rationale = `Conversion analysis identified this as a critical gap (readiness score: ${readinessScore}/100). ${readinessScore < 50 ? 'Site is not optimized for conversion.' : 'Addressing this will significantly improve conversion rates.'}`;

    items.push({
      id: `conv-opp-${Math.random().toString(36).substring(7)}`,
      title: opportunity,
      description: `Conversion optimization opportunity identified by strategist analysis`,
      rationale,
      dimension: 'conversion_flow',
      serviceArea: 'website',
      impactScore: 4,
      effortScore: 3,
      priority: 'now',
      status: 'backlog',
      recommendedTimebox: '1-2 weeks',
      tags: ['conversion', 'strategist'],
    });
  }

  // Copywriting messaging issues
  const messagingIssues = strategistViews.copywriting?.messagingIssues || [];
  for (const issue of messagingIssues.slice(0, 2)) {
    items.push({
      id: `copy-issue-${Math.random().toString(36).substring(7)}`,
      title: `Fix messaging: ${issue}`,
      description: issue,
      rationale: `Messaging clarity score: ${strategistViews.copywriting.messagingClarityScore}/100`,
      dimension: 'content_and_clarity',
      serviceArea: 'content',
      impactScore: 3,
      effortScore: 2,
      priority: 'next',
      status: 'backlog',
      recommendedTimebox: '3-5 days',
      tags: ['copywriting', 'messaging'],
    });
  }

  return items;
}

// ============================================================================
// EXPERIMENT GENERATION
// ============================================================================

function generateExperiments(labResult: WebsiteUXLabResultV4): WebsiteExperiment[] {
  const experiments: WebsiteExperiment[] = [];
  const { strategistViews, ctaIntelligence, trustAnalysis } = labResult;

  // From strategist test recommendations
  const testRecs = strategistViews?.conversion?.testRecommendations || [];
  for (const rec of testRecs.slice(0, 3)) {
    experiments.push({
      id: `exp-${Math.random().toString(36).substring(7)}`,
      hypothesis: rec,
      description: `Test recommended by conversion strategist analysis`,
      metric: 'Conversion rate',
      expectedLift: 15,
      effortScore: 2,
    });
  }

  // CTA tests
  if (ctaIntelligence && ctaIntelligence.summaryScore < 70) {
    const topCta = ctaIntelligence.ctas?.[0];
    if (topCta && topCta.suggestions.length > 0) {
      experiments.push({
        id: 'exp-cta-1',
        hypothesis: `Improving CTA copy from "${topCta.text}" will increase conversion`,
        description: topCta.suggestions[0],
        metric: 'CTA click-through rate',
        pages: [topCta.pagePath],
        expectedLift: 20,
        effortScore: 1,
      });
    }
  }

  // Trust signal placement tests
  if (trustAnalysis && trustAnalysis.trustScore < 70) {
    const pagesWithoutTrust = trustAnalysis.distribution?.pagesMissingTrust || [];
    if (pagesWithoutTrust.length > 0) {
      experiments.push({
        id: 'exp-trust-1',
        hypothesis: 'Adding trust signals above the fold will reduce bounce rate',
        description: `Test adding 2-3 trust signals (logos, testimonials, metrics) to pages: ${pagesWithoutTrust.slice(0, 2).join(', ')}`,
        metric: 'Bounce rate',
        pages: pagesWithoutTrust.slice(0, 2),
        expectedLift: 15,
        effortScore: 2,
      });
    }
  }

  return experiments;
}

// ============================================================================
// STRATEGIC CHANGE GENERATION
// ============================================================================

function generateStrategicChanges(labResult: WebsiteUXLabResultV4): StrategyChange[] {
  const changes: StrategyChange[] = [];
  const { strategistViews, contentIntelligence, siteAssessment } = labResult;

  // Messaging strategy changes
  if (strategistViews?.copywriting) {
    const differentiationRecs =
      strategistViews.copywriting.differentiationAnalysis?.recommendations || [];
    if (differentiationRecs.length > 0) {
      changes.push({
        id: 'strat-differentiation',
        title: 'Strengthen competitive differentiation',
        description: differentiationRecs.join(' '),
        reasoning: `Uniqueness canon is not clear. ${strategistViews.copywriting.differentiationAnalysis.competitivePositioning}`,
        linkedFindings: ['copywriting-strategist'],
      });
    }
  }

  // Content strategy changes
  if (contentIntelligence && contentIntelligence.qualityMetrics.benefitRatio < 50) {
    changes.push({
      id: 'strat-benefits',
      title: 'Shift from feature-first to benefit-first messaging',
      description:
        'Current content is too feature-focused. Rewrite key pages to lead with customer outcomes and benefits, then support with features.',
      reasoning: `Benefit ratio is only ${contentIntelligence.qualityMetrics.benefitRatio}% (should be >60%)`,
      linkedFindings: ['content-intelligence'],
    });
  }

  // Funnel strategy changes
  if ((siteAssessment.funnelHealthScore || 0) < 60) {
    changes.push({
      id: 'strat-funnel',
      title: 'Redesign conversion funnel architecture',
      description:
        'Current funnel has dead ends and unclear paths. Map a clear Home → Product/Service → Pricing → Contact journey with consistent CTAs at each step.',
      reasoning: `Funnel health score is ${siteAssessment.funnelHealthScore}/100`,
      linkedFindings: ['funnel-health'],
    });
  }

  return changes;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function inferTimebox(effortScore: number): string {
  if (effortScore <= 2) return '1-3 days';
  if (effortScore <= 3) return '1 week';
  if (effortScore <= 4) return '2-3 weeks';
  return '1 month';
}

function inferTags(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const tags: string[] = [];

  if (/cta|call.?to.?action|button/i.test(text)) tags.push('cta');
  if (/trust|testimonial|social.?proof|logo/i.test(text)) tags.push('trust');
  if (/hero|value.?prop/i.test(text)) tags.push('hero');
  if (/pricing|price/i.test(text)) tags.push('pricing');
  if (/navigation|nav|menu/i.test(text)) tags.push('navigation');
  if (/mobile|responsive/i.test(text)) tags.push('mobile');
  if (/content|copy|messaging/i.test(text)) tags.push('content');
  if (/visual|design|brand/i.test(text)) tags.push('visual');

  return tags;
}

function inferDimensionFromTag(tag: string): WebsiteUxDimensionKey {
  const tagLower = tag.toLowerCase();

  if (/hero|value.*prop/i.test(tagLower)) return 'hero_and_value_prop';
  if (/trust|social.*proof/i.test(tagLower)) return 'trust_and_social_proof';
  if (/nav|navigation|structure/i.test(tagLower)) return 'navigation_and_structure';
  if (/conversion|cta|funnel/i.test(tagLower)) return 'conversion_flow';
  if (/content|clarity|messaging|copy/i.test(tagLower)) return 'content_and_clarity';
  if (/visual|mobile|design|brand/i.test(tagLower)) return 'visual_and_mobile';
  if (/intent/i.test(tagLower)) return 'intent_alignment';

  return 'overall_experience';
}

function inferDimensionFromFix(fix: string): WebsiteUxDimensionKey {
  const fixLower = fix.toLowerCase();

  if (/pricing|price/i.test(fixLower)) return 'navigation_and_structure';
  if (/cta|button|action/i.test(fixLower)) return 'conversion_flow';
  if (/trust|proof|testimonial/i.test(fixLower)) return 'trust_and_social_proof';
  if (/value|hero/i.test(fixLower)) return 'hero_and_value_prop';
  if (/clear|messaging|understand/i.test(fixLower)) return 'content_and_clarity';
  if (/mobile|visual/i.test(fixLower)) return 'visual_and_mobile';

  return 'overall_experience';
}
