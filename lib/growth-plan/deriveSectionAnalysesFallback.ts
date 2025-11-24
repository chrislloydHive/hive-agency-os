/**
 * Fallback generator for sectionAnalyses
 * 
 * Ensures that sectionAnalyses always has content for all four areas
 * even if the LLM under-fills or omits data.
 */

import type { GrowthAccelerationPlan } from './types';
import type { SectionAnalysis } from './types';

export interface GapSectionAnalyses {
  brand?: SectionAnalysis;
  content?: SectionAnalysis;
  seo?: SectionAnalysis;
  website?: SectionAnalysis;
}

/**
 * Ensure sectionAnalyses has content for all four areas
 * Falls back to generating minimal summaries from existing data if missing
 */
export function withSectionAnalysesFallback(
  plan: GrowthAccelerationPlan
): GrowthAccelerationPlan {
  const base = plan.sectionAnalyses ?? {};
  
  // Use new format if available, otherwise check legacy format
  const existing = {
    brand: base.brand || (plan.sectionAnalysesLegacy as any)?.brandAndPositioning,
    content: base.content || (plan.sectionAnalysesLegacy as any)?.contentAndMessaging,
    seo: base.seo || (plan.sectionAnalysesLegacy as any)?.seoAndVisibility,
    website: base.website || (plan.sectionAnalysesLegacy as any)?.websiteAndConversion,
  };

  function ensureArea(
    key: 'brand' | 'content' | 'seo' | 'website',
    label: string,
    sectionKey: 'brandAndPositioning' | 'contentAndMessaging' | 'seoAndVisibility' | 'websiteAndConversion'
  ): SectionAnalysis {
    const existingSection = existing[key];
    
    // If we have a complete section with rich diagnostics, use it
    if (existingSection && existingSection.label && existingSection.score !== undefined) {
      return {
        label: existingSection.label,
        score: existingSection.score,
        grade: existingSection.grade || (existingSection.score >= 85 ? 'A' : existingSection.score >= 70 ? 'B' : existingSection.score >= 50 ? 'C' : 'D'),
        cardLevel: existingSection.cardLevel || {
          verdict: existingSection.verdict || existingSection.summary?.split('.')[0] + '.' || `${label} scores ${existingSection.score}/100.`,
          summary: existingSection.summary || '',
        },
        deepDive: existingSection.deepDive || {
          strengths: existingSection.strengths || [],
          issues: existingSection.issues || [],
          recommendations: existingSection.recommendations || [],
          impactEstimate: existingSection.impactEstimate || 'Medium',
        },
        verdict: existingSection.verdict || existingSection.summary?.split('.')[0] + '.' || `${label} scores ${existingSection.score}/100.`,
        summary: existingSection.summary || '',
        strengths: existingSection.strengths || [],
        issues: existingSection.issues || [],
        recommendations: existingSection.recommendations || [],
        impactEstimate: existingSection.impactEstimate || 'Medium',
        // Preserve legacy fields
        keyFindings: existingSection.keyFindings,
        quickWins: existingSection.quickWins,
        deeperInitiatives: existingSection.deeperInitiatives,
        maturityNotes: existingSection.maturityNotes,
      };
    }
    
    // If we have legacy section with summary/content, enrich it
    if (existingSection && (existingSection.summary || existingSection.strengths?.length || existingSection.issues?.length)) {
      const score = existingSection.score ?? plan.scorecard?.[key === 'website' ? 'website' : key] ?? 0;
      const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';

      const verdict = existingSection.verdict || existingSection.summary?.split('.')[0] + '.' || `${label} scores ${score}/100.`;
      const summary = existingSection.summary || '';
      const strengths = existingSection.strengths || existingSection.keyFindings?.slice(0, 2).filter((f: string) =>
        f.toLowerCase().includes('strong') ||
        f.toLowerCase().includes('good') ||
        f.toLowerCase().includes('effective') ||
        f.toLowerCase().includes('well')
      ) || [];
      const issues = existingSection.issues || existingSection.keyFindings?.slice(0, 3).filter((f: string) =>
        !f.toLowerCase().includes('strong') &&
        !f.toLowerCase().includes('good') &&
        !f.toLowerCase().includes('effective')
      ) || [];
      const recommendations = existingSection.recommendations || existingSection.quickWins?.slice(0, 2) || [];
      const impactEstimate = existingSection.impactEstimate || (score < 50 ? 'High' : score < 70 ? 'Medium' : 'Low');

      return {
        label,
        score,
        grade,
        cardLevel: {
          verdict,
          summary,
        },
        deepDive: {
          strengths,
          issues,
          recommendations,
          impactEstimate,
        },
        verdict,
        summary,
        strengths,
        issues,
        recommendations,
        impactEstimate,
        // Preserve legacy fields
        keyFindings: existingSection.keyFindings,
        quickWins: existingSection.quickWins,
        deeperInitiatives: existingSection.deeperInitiatives,
        maturityNotes: existingSection.maturityNotes,
      };
    }

    // Fallback: generate minimal content from available data
    const scoreKey = key === 'website' ? 'website' : key;
    const score = plan.scorecard?.[scoreKey as keyof typeof plan.scorecard] as number | undefined;
    
    const overallStrengths = plan.executiveSummary?.strengths ?? [];
    const overallIssues = plan.executiveSummary?.keyIssues ?? [];
    
    // Extract area-specific content from quick wins and initiatives
    const areaQuickWins = plan.quickWins?.filter(qw => {
      const serviceArea = qw.serviceArea?.toLowerCase() || '';
      if (key === 'brand') return serviceArea.includes('brand');
      if (key === 'content') return serviceArea.includes('content');
      if (key === 'seo') return serviceArea.includes('seo');
      if (key === 'website') return serviceArea.includes('website') || serviceArea.includes('conversion');
      return false;
    }) || [];
    
    const areaInitiatives = plan.strategicInitiatives?.filter(si => {
      const serviceArea = si.serviceArea?.toLowerCase() || '';
      if (key === 'brand') return serviceArea.includes('brand');
      if (key === 'content') return serviceArea.includes('content');
      if (key === 'seo') return serviceArea.includes('seo');
      if (key === 'website') return serviceArea.includes('website') || serviceArea.includes('conversion');
      return false;
    }) || [];

    // Build strengths from area-specific quick wins that are positive
    const areaStrengths = areaQuickWins
      .filter(qw => {
        const desc = (qw.description || '').toLowerCase();
        return desc.includes('strong') || desc.includes('good') || desc.includes('effective') || desc.includes('well');
      })
      .slice(0, 2)
      .map(qw => qw.title);
    
    // Build issues from area-specific quick wins that identify problems
    const areaIssues = areaQuickWins
      .filter(qw => {
        const desc = (qw.description || '').toLowerCase();
        return desc.includes('missing') || desc.includes('lack') || desc.includes('improve') || desc.includes('weak');
      })
      .slice(0, 2)
      .map(qw => qw.title);
    
    const scoreValue = score ?? 0;
    const grade = scoreValue >= 85 ? 'A' : scoreValue >= 70 ? 'B' : scoreValue >= 50 ? 'C' : scoreValue >= 30 ? 'D' : 'F';
    const verdict = scoreValue >= 70
      ? `${label} shows strong performance with room for optimization.`
      : `${label} needs improvement to reach best-in-class standards.`;
    
    const summary = score != null
      ? `${label} currently scores ${score}/100. This area shows some strengths but also clear opportunities for improvement based on our analysis.`
      : `${label} shows a mix of strengths and opportunities for improvement, but we did not generate a dedicated narrative in this run.`;

    const strengths = areaStrengths.length > 0
      ? areaStrengths
      : overallStrengths.slice(0, 2).filter(s => {
          const lower = s.toLowerCase();
          return lower.includes('brand') || lower.includes('content') || lower.includes('seo') || lower.includes('website') || lower.includes('conversion');
        }).length > 0
        ? overallStrengths.slice(0, 2)
        : [`${label} has foundational elements in place`];

    const issues = areaIssues.length > 0
      ? areaIssues
      : overallIssues.slice(0, 2).filter(i => {
          const lower = i.toLowerCase();
          return lower.includes('brand') || lower.includes('content') || lower.includes('seo') || lower.includes('website') || lower.includes('conversion');
        }).length > 0
        ? overallIssues.slice(0, 2)
        : [`${label} could benefit from strategic improvements`];

    const recommendations = areaQuickWins.length > 0
      ? areaQuickWins.slice(0, 2).map(qw => qw.title)
      : areaInitiatives.length > 0
        ? areaInitiatives.slice(0, 1).map(si => si.title)
        : [`Review ${label.toLowerCase()} strategy and implement key improvements`];

    const impactEstimate = (score ?? 0) < 50
      ? 'High – addressing these issues will significantly improve performance.'
      : (score ?? 0) < 70
        ? 'Medium – improvements here will drive measurable growth.'
        : 'Low – optimizations will fine-tune an already strong foundation.';

    return {
      label,
      score: score ?? 0,
      grade,
      cardLevel: {
        verdict,
        summary,
      },
      deepDive: {
        strengths,
        issues,
        recommendations,
        impactEstimate,
      },
      verdict,
      summary,
      keyFindings: [],
      quickWins: areaQuickWins.slice(0, 3).map(qw => qw.title),
      deeperInitiatives: areaInitiatives.slice(0, 2).map(si => si.title),
      strengths,
      issues,
      recommendations,
      impactEstimate,
    };
  }

  const sectionAnalyses: {
    brand?: SectionAnalysis;
    content?: SectionAnalysis;
    seo?: SectionAnalysis;
    website?: SectionAnalysis;
  } = {
    brand: ensureArea('brand', 'Brand & Positioning', 'brandAndPositioning'),
    content: ensureArea('content', 'Content & Messaging', 'contentAndMessaging'),
    seo: ensureArea('seo', 'SEO & Visibility', 'seoAndVisibility'),
    website: ensureArea('website', 'Website & Conversion', 'websiteAndConversion'),
  };

  return {
    ...plan,
    sectionAnalyses,
  };
}

