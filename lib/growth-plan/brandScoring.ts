/**
 * Brand & Positioning Scoring Module
 * 
 * Deterministic brand scoring based on weighted signals.
 * No LLM involvement - purely signal-based scoring.
 * 
 * Rubric (100 points total):
 * - A. Value Prop Clarity (25 pts)
 * - B. ICP & Audience Clarity (15 pts)
 * - C. Differentiation Signals (15 pts)
 * - D. Visual Identity Consistency (25 pts)
 * - E. Brand Story Reinforcement (10 pts)
 * - F. Proof & Credibility Embedded in Brand (10 pts)
 */

import type { SiteElementContext } from './html-context';
import type { PositioningAnalysis } from './types';
import type { AssessmentResult } from '@/lib/unified-assessment';
import type { ContentInventory } from './analyzeContentInventory';

export interface BrandScoringInputs {
  siteElementContext: SiteElementContext;
  positioningAnalysis: PositioningAnalysis;
  assessment: AssessmentResult;
  contentInventory: ContentInventory;
}

/**
 * Score Brand & Positioning from signals
 * 
 * Returns an integer 0-100 based on weighted rubric signals.
 * 
 * @param inputs - Brand scoring inputs (site context, positioning, assessment, content)
 * @returns Brand score (0-100)
 */
export function scoreBrandFromSignals(inputs: BrandScoringInputs): number {
  const { siteElementContext, positioningAnalysis, assessment, contentInventory } = inputs;
  const extraction = assessment.extraction;
  
  // A. Value Prop Clarity (25 pts)
  const valuePropScore = scoreValuePropClarity(extraction, siteElementContext);
  
  // B. ICP & Audience Clarity (15 pts)
  const icpScore = scoreICPClarity(positioningAnalysis);
  
  // C. Differentiation Signals (15 pts)
  const differentiationScore = scoreDifferentiationSignals(positioningAnalysis, extraction);
  
  // D. Visual Identity Consistency (25 pts)
  const visualIdentityScore = scoreVisualIdentityConsistency(siteElementContext);
  
  // E. Brand Story Reinforcement (10 pts)
  const brandStoryScore = scoreBrandStoryReinforcement(siteElementContext, positioningAnalysis);
  
  // F. Proof & Credibility Embedded in Brand (10 pts)
  const proofScore = scoreProofAndCredibility(assessment, contentInventory, siteElementContext);
  
  // Calculate weighted sum
  const totalScore = 
    (valuePropScore * 25) +
    (icpScore * 15) +
    (differentiationScore * 15) +
    (visualIdentityScore * 25) +
    (brandStoryScore * 10) +
    (proofScore * 10);
  
  // Round to nearest integer and clamp to 0-100
  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

/**
 * A. Value Prop Clarity (normalized 0-1, weighted 25 pts)
 * 
 * Detect presence of a clear main headline with a benefit-oriented value prop.
 * Partial credit if headline is feature-driven but still understandable.
 */
function scoreValuePropClarity(
  extraction: AssessmentResult['extraction'],
  siteElementContext: SiteElementContext
): number {
  const heroHeadline = extraction.hero_section?.headline_text || '';
  const heroSubheadline = extraction.hero_section?.subheadline_text || '';
  const valueProps = extraction.value_props || [];
  const homepage = siteElementContext.pages.find(p => p.type === 'home') || siteElementContext.pages[0];
  const homepageHeadings = homepage?.headings || [];
  
  // Check for benefit-oriented language (keywords that indicate value)
  const benefitKeywords = ['grow', 'increase', 'improve', 'save', 'transform', 'scale', 'accelerate', 
                          'better', 'faster', 'easier', 'smarter', 'powerful', 'simple', 'help'];
  const headlineLower = heroHeadline.toLowerCase();
  const subheadlineLower = heroSubheadline.toLowerCase();
  
  // Score based on headline quality
  let score = 0;
  
  // Strong value prop: benefit-oriented headline + subheadline
  if (heroHeadline.length > 0 && heroSubheadline.length > 0) {
    const hasBenefitLanguage = benefitKeywords.some(kw => 
      headlineLower.includes(kw) || subheadlineLower.includes(kw)
    );
    if (hasBenefitLanguage) {
      score = 1.0; // Perfect score for clear benefit-oriented messaging
    } else if (heroHeadline.length > 20 && heroSubheadline.length > 30) {
      score = 0.8; // Good headline/subheadline even if not explicitly benefit-oriented
    } else {
      score = 0.6; // Basic headline/subheadline present
    }
  } else if (heroHeadline.length > 0) {
    // Only headline, no subheadline
    const hasBenefitLanguage = benefitKeywords.some(kw => headlineLower.includes(kw));
    if (hasBenefitLanguage) {
      score = 0.7;
    } else if (heroHeadline.length > 20) {
      score = 0.5;
    } else {
      score = 0.3;
    }
  } else if (homepageHeadings.length > 0) {
    // Fallback: use first heading as headline
    const firstHeading = homepageHeadings[0] || '';
    if (firstHeading.length > 20) {
      score = 0.4;
    } else {
      score = 0.2;
    }
  }
  
  // Bonus for value props
  if (valueProps.length > 0) {
    score = Math.min(1.0, score + (valueProps.length * 0.1));
  }
  
  return Math.min(1.0, score);
}

/**
 * B. ICP & Audience Clarity (normalized 0-1, weighted 15 pts)
 * 
 * Detect explicit reference to target users.
 * Partial credit if ICP is implied through category or use cases.
 */
function scoreICPClarity(positioningAnalysis: PositioningAnalysis): number {
  const primaryAudience = positioningAnalysis.primaryAudience || '';
  const hasExplicitAudience = primaryAudience !== 'Not clearly defined' && primaryAudience.length > 0;
  
  if (hasExplicitAudience) {
    // Explicit audience defined
    if (primaryAudience.length > 30) {
      return 1.0; // Detailed audience description
    } else if (primaryAudience.length > 15) {
      return 0.8; // Clear audience description
    } else {
      return 0.6; // Basic audience mention
    }
  }
  
  // Check for implied audience through key themes or evidence
  const keyThemes = positioningAnalysis.keyThemes || [];
  const evidenceCount = positioningAnalysis.evidenceFromSite?.length || 0;
  
  if (keyThemes.length >= 3 && evidenceCount >= 3) {
    return 0.5; // Implied through themes/evidence
  } else if (keyThemes.length >= 1 || evidenceCount >= 1) {
    return 0.3; // Weakly implied
  }
  
  return 0.0; // No audience clarity
}

/**
 * C. Differentiation Signals (normalized 0-1, weighted 15 pts)
 * 
 * Look for "why us" messaging, comparisons, positioning statements, differentiators.
 * Partial credit if differentiation is implicit (e.g., unique UI or product category).
 */
function scoreDifferentiationSignals(
  positioningAnalysis: PositioningAnalysis,
  extraction: AssessmentResult['extraction']
): number {
  const differentiationSignals = positioningAnalysis.differentiationSignals || [];
  const corePositioning = positioningAnalysis.corePositioningStatement || '';
  const valueProps = extraction.value_props || [];
  
  // Explicit differentiation signals
  if (differentiationSignals.length >= 5) {
    return 1.0; // Strong differentiation
  } else if (differentiationSignals.length >= 3) {
    return 0.8; // Good differentiation
  } else if (differentiationSignals.length >= 1) {
    return 0.6; // Some differentiation
  }
  
  // Check positioning statement
  const hasPositioningStatement = corePositioning !== 'Positioning not clearly articulated' && 
                                  corePositioning.length > 20;
  if (hasPositioningStatement) {
    return 0.7; // Clear positioning implies differentiation
  }
  
  // Check value props for differentiation language
  const differentiationKeywords = ['only', 'first', 'unique', 'exclusive', 'best', 'leading', 
                                    'innovative', 'revolutionary', 'unlike', 'different'];
  const valuePropsText = valueProps.join(' ').toLowerCase();
  const hasDifferentiationLanguage = differentiationKeywords.some(kw => valuePropsText.includes(kw));
  
  if (hasDifferentiationLanguage && valueProps.length >= 2) {
    return 0.5; // Implied differentiation through value props
  } else if (valueProps.length >= 1) {
    return 0.3; // Weak differentiation signal
  }
  
  return 0.0; // No differentiation signals
}

/**
 * D. Visual Identity Consistency (normalized 0-1, weighted 25 pts)
 * 
 * Detect consistent brand palette, typography, logo presence, iconography, structured layouts.
 */
function scoreVisualIdentityConsistency(siteElementContext: SiteElementContext): number {
  const pages = siteElementContext.pages || [];
  if (pages.length === 0) {
    return 0.0;
  }
  
  let score = 0;
  let checks = 0;
  
  // Check for logo in header/footer (inferred from nav items or headings)
  const hasLogoMention = pages.some(p => 
    p.navItems?.some(item => item.toLowerCase().includes('logo')) ||
    p.headings?.some(h => h.toLowerCase().includes('logo'))
  );
  // Also check if nav structure suggests logo presence (structured nav usually has logo)
  const hasStructuredNav = pages.some(p => p.navItems && p.navItems.length >= 5);
  const hasLogo = hasLogoMention || hasStructuredNav;
  
  if (hasLogo) {
    score += 0.25;
  }
  checks++;
  
  // Check for consistent navigation structure (indicates visual consistency)
  const navLengths = pages.map(p => p.navItems?.length || 0).filter(len => len > 0);
  const avgNavLength = navLengths.length > 0 
    ? navLengths.reduce((a, b) => a + b, 0) / navLengths.length 
    : 0;
  const navConsistency = navLengths.length > 1 && avgNavLength >= 5;
  
  if (navConsistency) {
    score += 0.25;
  }
  checks++;
  
  // Check for structured page layouts (consistent section structure)
  const hasConsistentSections = pages.some(p => 
    p.sectionTitles && p.sectionTitles.length >= 3
  );
  const sectionCounts = pages.map(p => p.sectionTitles?.length || 0);
  const avgSections = sectionCounts.length > 0
    ? sectionCounts.reduce((a, b) => a + b, 0) / sectionCounts.length
    : 0;
  const hasStructuredLayouts = avgSections >= 3;
  
  if (hasConsistentSections || hasStructuredLayouts) {
    score += 0.25;
  }
  checks++;
  
  // Check for consistent headings structure (indicates typography consistency)
  const headingCounts = pages.map(p => p.headings?.length || 0);
  const avgHeadings = headingCounts.length > 0
    ? headingCounts.reduce((a, b) => a + b, 0) / headingCounts.length
    : 0;
  const hasConsistentHeadings = avgHeadings >= 5;
  
  if (hasConsistentHeadings) {
    score += 0.25;
  }
  checks++;
  
  // Normalize to 0-1 (we have 4 checks, each worth 0.25)
  return Math.min(1.0, score);
}

/**
 * E. Brand Story Reinforcement (normalized 0-1, weighted 10 pts)
 * 
 * Detect repeated messaging across nav sections and narrative consistency across pages.
 */
function scoreBrandStoryReinforcement(
  siteElementContext: SiteElementContext,
  positioningAnalysis: PositioningAnalysis
): number {
  const pages = siteElementContext.pages || [];
  const keyThemes = positioningAnalysis.keyThemes || [];
  
  if (pages.length === 0) {
    return 0.0;
  }
  
  // Check for consistent navigation items across pages (indicates brand story consistency)
  const allNavItems = pages.flatMap(p => p.navItems || []);
  const uniqueNavItems = new Set(allNavItems.map(item => item.toLowerCase()));
  const navConsistency = uniqueNavItems.size >= 3 && allNavItems.length >= uniqueNavItems.size * 2;
  
  // Check for repeated themes/headings (indicates narrative consistency)
  const allHeadings = pages.flatMap(p => p.headings || []);
  const headingWords = allHeadings.flatMap(h => h.toLowerCase().split(/\s+/));
  const wordFrequency: Record<string, number> = {};
  headingWords.forEach(word => {
    if (word.length > 4) { // Only count meaningful words
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });
  const repeatedWords = Object.values(wordFrequency).filter(count => count >= 2).length;
  const hasNarrativeConsistency = repeatedWords >= 3;
  
  // Check key themes alignment
  const hasThemeAlignment = keyThemes.length >= 3;
  
  let score = 0;
  if (navConsistency) score += 0.4;
  if (hasNarrativeConsistency) score += 0.4;
  if (hasThemeAlignment) score += 0.2;
  
  return Math.min(1.0, score);
}

/**
 * F. Proof & Credibility Embedded in Brand (normalized 0-1, weighted 10 pts)
 * 
 * If case studies, testimonials, or customer logos appear in primary sections, brand trust benefits.
 */
function scoreProofAndCredibility(
  assessment: AssessmentResult,
  contentInventory: ContentInventory,
  siteElementContext: SiteElementContext
): number {
  const trustSignals = assessment.extraction.trust_signals;
  const testimonialsCount = trustSignals?.testimonials_visible?.length || 0;
  const logosCount = trustSignals?.logos_visible?.length || 0;
  const caseStudyCount = contentInventory.caseStudiesFound || 0;
  
  // Check if proof appears in primary sections (homepage, hero)
  const homepage = siteElementContext.pages.find(p => p.type === 'home') || siteElementContext.pages[0];
  const homepageHeadings = homepage?.headings || [];
  const homepageSections = homepage?.sectionTitles || [];
  
  const hasProofInPrimarySections = 
    homepageHeadings.some(h => 
      h.toLowerCase().includes('testimonial') ||
      h.toLowerCase().includes('customer') ||
      h.toLowerCase().includes('case study') ||
      h.toLowerCase().includes('logo') ||
      h.toLowerCase().includes('trusted')
    ) ||
    homepageSections.some(s =>
      s.toLowerCase().includes('testimonial') ||
      s.toLowerCase().includes('customer') ||
      s.toLowerCase().includes('case study')
    );
  
  let score = 0;
  
  // Strong proof signals
  if (logosCount >= 10 || testimonialsCount >= 5 || caseStudyCount >= 5) {
    score = 1.0;
  } else if (logosCount >= 5 || testimonialsCount >= 3 || caseStudyCount >= 3) {
    score = 0.8;
  } else if (logosCount >= 1 || testimonialsCount >= 1 || caseStudyCount >= 1) {
    score = 0.6;
  }
  
  // Bonus if proof appears in primary sections
  if (hasProofInPrimarySections && score > 0) {
    score = Math.min(1.0, score + 0.2);
  }
  
  return Math.min(1.0, score);
}

/**
 * Apply brand score floors based on strong signals
 * 
 * Ensures recognizable brands don't score below thresholds.
 * 
 * @param rawBrandScore - Brand score from rubric (0-100)
 * @param inputs - Brand scoring inputs
 * @returns Adjusted brand score with floors applied
 */
export function applyBrandFloors(
  rawBrandScore: number,
  inputs: BrandScoringInputs
): number {
  const { assessment, contentInventory, siteElementContext } = inputs;
  const trustSignals = assessment.extraction.trust_signals;
  const logosCount = trustSignals?.logos_visible?.length || 0;
  const caseStudyCount = contentInventory.caseStudiesFound || 0;
  const blogPostCount = contentInventory.blogPostsFound || 0;
  
  let adjustedScore = rawBrandScore;
  
  // Floor 1: Recognizable brand signals (≥65)
  // 15+ logos OR 10+ case studies OR 50+ blog posts
  if (logosCount >= 15 || caseStudyCount >= 10 || blogPostCount >= 50) {
    adjustedScore = Math.max(adjustedScore, 65);
    console.log(`📊 Applied brand floor (recognizable): ${adjustedScore} (was ${rawBrandScore}, signals: ${logosCount} logos, ${caseStudyCount} case studies, ${blogPostCount} blogs)`);
  }
  
  // Floor 2: Strong visual identity (≥75)
  // Consistent logo + 2+ primary colors + structured nav
  const hasConsistentLogo = siteElementContext.pages.some(p => 
    p.navItems?.some(item => item.toLowerCase().includes('logo')) ||
    p.headings?.some(h => h.toLowerCase().includes('logo'))
  ) || siteElementContext.pages.some(p => p.navItems && p.navItems.length >= 5);
  
  const hasStructuredNav = siteElementContext.pages.some(p => 
    p.navItems && p.navItems.length >= 5
  );
  
  // Infer primary color count from consistent styling (if site has structure, assume branding)
  const hasPrimaryColor = siteElementContext.pages.length > 0; // Simplified: if site exists, assume some branding
  const primaryColorCount = hasPrimaryColor ? 2 : 0; // Assume 2+ colors if site has structure
  
  if (hasConsistentLogo && primaryColorCount >= 2 && hasStructuredNav) {
    adjustedScore = Math.max(adjustedScore, 75);
    console.log(`📊 Applied brand floor (strong visual identity): ${adjustedScore} (was ${rawBrandScore}, logo=${hasConsistentLogo}, colors=${primaryColorCount}, nav=${hasStructuredNav})`);
  }
  
  return Math.min(100, adjustedScore);
}

