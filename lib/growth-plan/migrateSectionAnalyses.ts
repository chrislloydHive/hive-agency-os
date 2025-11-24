/**
 * Migration layer for sectionAnalyses
 * 
 * Converts old format (websiteAndConversion, seoAndVisibility, etc.)
 * to new format (brand, content, seo, website)
 */

import type { GrowthAccelerationPlan, SectionAnalysis } from './types';

/**
 * Map legacy keys to new keys
 */
const LEGACY_KEY_MAP: Record<string, 'brand' | 'content' | 'seo' | 'website'> = {
  brandAndPositioning: 'brand',
  contentAndMessaging: 'content',
  seoAndVisibility: 'seo',
  websiteAndConversion: 'website',
};

/**
 * Map new keys to labels
 */
const KEY_TO_LABEL: Record<'brand' | 'content' | 'seo' | 'website', string> = {
  brand: 'Brand & Positioning',
  content: 'Content & Messaging',
  seo: 'SEO & Visibility',
  website: 'Website & Conversion',
};

/**
 * Convert legacy SectionAnalysis to rich format
 */
function enrichSectionAnalysis(
  legacy: Partial<SectionAnalysis>,
  key: 'brand' | 'content' | 'seo' | 'website',
  scorecard?: { brand?: number; content?: number; seo?: number; website?: number }
): SectionAnalysis {
  const label = KEY_TO_LABEL[key];
  const score = scorecard?.[key] ?? legacy.score ?? 0;
  
  // Calculate grade from score
  const grade = score >= 85 ? 'A' : 
                score >= 70 ? 'B' : 
                score >= 50 ? 'C' : 
                score >= 30 ? 'D' : 'F';
  
  // Generate verdict from summary or key findings
  const verdict = legacy.verdict || 
                  (legacy.summary ? legacy.summary.split('.')[0] + '.' : 
                   `This area scores ${score}/100 and ${score >= 70 ? 'shows strengths' : 'needs improvement'}.`);
  
  // Use provided summary or generate one
  const summary = legacy.summary || 
                  `${label} currently scores ${score}/100. ${score >= 70 ? 
                    'This area shows some strengths but also clear opportunities for improvement.' : 
                    'This area needs significant work to reach best-in-class performance.'}`;
  
  // Map strengths from legacy fields
  const strengths = legacy.strengths || 
                    legacy.keyFindings?.filter(f => 
                      f.toLowerCase().includes('strong') || 
                      f.toLowerCase().includes('good') || 
                      f.toLowerCase().includes('effective')
                    ).slice(0, 3) || 
                    [`${label} has foundational elements in place`];
  
  // Map issues from legacy fields
  const issues = legacy.issues || 
                 legacy.keyFindings?.filter(f => 
                   !f.toLowerCase().includes('strong') && 
                   !f.toLowerCase().includes('good') && 
                   !f.toLowerCase().includes('effective')
                 ).slice(0, 5) || 
                 [`${label} could benefit from strategic improvements`];
  
  // Map recommendations from legacy fields
  const recommendations = legacy.recommendations || 
                          legacy.quickWins?.slice(0, 5) || 
                          legacy.deeperInitiatives?.slice(0, 3) || 
                          [`Review ${label.toLowerCase()} strategy and implement key improvements`];
  
  // Generate impact estimate
  const impactEstimate = legacy.impactEstimate || 
                         (score < 50 ? 'High – addressing these issues will significantly improve performance.' :
                          score < 70 ? 'Medium – improvements here will drive measurable growth.' :
                          'Low – optimizations will fine-tune an already strong foundation.');
  
  return {
    label,
    score,
    grade,
    cardLevel: {
      verdict,
      summary,
    },
    deepDive: {
      strengths: strengths.slice(0, 5),
      issues: issues.slice(0, 5),
      recommendations: recommendations.slice(0, 7),
      impactEstimate,
    },
    verdict,
    summary,
    strengths: strengths.slice(0, 5),
    issues: issues.slice(0, 5),
    recommendations: recommendations.slice(0, 7),
    impactEstimate,
    // Preserve legacy fields for backward compatibility
    keyFindings: legacy.keyFindings,
    quickWins: legacy.quickWins,
    deeperInitiatives: legacy.deeperInitiatives,
    maturityNotes: legacy.maturityNotes,
  };
}

/**
 * Migrate sectionAnalyses from legacy format to new format
 */
export function migrateSectionAnalyses(
  plan: GrowthAccelerationPlan
): GrowthAccelerationPlan {
  // If already in new format, return as-is
  if (plan.sectionAnalyses && 
      ('brand' in plan.sectionAnalyses || 
       'content' in plan.sectionAnalyses || 
       'seo' in plan.sectionAnalyses || 
       'website' in plan.sectionAnalyses)) {
    return plan;
  }
  
  // Check for legacy format
  const legacy = plan.sectionAnalysesLegacy || 
                (plan.sectionAnalyses as any) || 
                {};
  
  const newSectionAnalyses: {
    brand?: SectionAnalysis;
    content?: SectionAnalysis;
    seo?: SectionAnalysis;
    website?: SectionAnalysis;
  } = {};
  
  // Migrate each legacy section
  for (const [legacyKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
    const legacySection = (legacy as any)[legacyKey];
    if (legacySection) {
      newSectionAnalyses[newKey] = enrichSectionAnalysis(
        legacySection,
        newKey,
        plan.scorecard
      );
    }
  }
  
  // If we have any migrated sections, update the plan
  if (Object.keys(newSectionAnalyses).length > 0) {
    return {
      ...plan,
      sectionAnalyses: newSectionAnalyses,
      sectionAnalysesLegacy: legacy, // Preserve legacy for reference
    };
  }
  
  // If no sections found, generate minimal ones from scorecard
  if (plan.scorecard) {
    return {
      ...plan,
      sectionAnalyses: {
        brand: enrichSectionAnalysis({}, 'brand', plan.scorecard),
        content: enrichSectionAnalysis({}, 'content', plan.scorecard),
        seo: enrichSectionAnalysis({}, 'seo', plan.scorecard),
        website: enrichSectionAnalysis({}, 'website', plan.scorecard),
      },
    };
  }
  
  return plan;
}

