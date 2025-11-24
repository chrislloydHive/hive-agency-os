/**
 * Explicit SiteFeatures → RubricScores Mapping
 * 
 * Provides a clear, easy-to-tune mapping from SiteFeatures to dimension scores.
 * Each dimension is computed using simple weighted formulas over SiteFeatures fields.
 * 
 * This scoring is deterministic and does not rely on LLM adjustments.
 */

import type { SiteFeatures } from './siteFeatures';

/**
 * RubricScores type
 * 
 * Simple record of dimension scores computed directly from SiteFeatures
 */
export interface RubricScores {
  website: number;
  content: number;
  seo: number;
  brand: number;
  authority: number;
}

/**
 * Compute rubric scores directly from SiteFeatures
 * 
 * This provides an explicit, easy-to-tune mapping from SiteFeatures to scores.
 * Each dimension is computed using simple weighted formulas over SiteFeatures fields.
 * 
 * @param features - SiteFeatures object containing all detected signals
 * @returns RubricScores with all dimension scores (0-100)
 */
export function computeRubricScores(features: SiteFeatures): RubricScores {
  const website = scoreWebsite(features);
  const content = scoreContent(features);
  const seo = scoreSEO(features);
  const brand = scoreBrand(features);
  const authority = scoreAuthority(features);

  // Debug logging (dev mode only) - shows raw feature values driving scores
  if (process.env.NODE_ENV !== 'production') {
    console.info('[computeRubricScores]', features.url, {
      website,
      content,
      seo,
      brand,
      authority,
      rawFeatures: {
        website: {
          primaryCtaCount: features.ux.primaryCtaCount,
          hasAboveTheFoldCTA: features.ux.hasAboveTheFoldCTA,
          hasSignupOrDemoCTA: features.conversions.hasSignupOrDemoCTA,
          navItemCount: features.navigation.navItemLabels.length,
          heroHeadlineLength: features.ux.heroHeadlineTextLength,
          formCount: features.conversions.formCount,
        },
        content: {
          hasBlog: features.content.hasBlog,
          blogPostCount: features.content.blogPostCount,
          hasCaseStudies: features.content.hasCaseStudiesSection,
          caseStudyCount: features.content.caseStudyCount,
          keyPagesCount: [
            features.content.hasPricingPage,
            features.content.hasAboutPage,
            features.content.hasFeatureOrProductPages,
            features.content.hasDocsOrGuides,
            features.content.hasResourcesHub,
            features.content.hasCareersPage,
          ].filter(Boolean).length,
        },
        seo: {
          hasMetaTitle: features.seo.hasMetaTitle,
          hasMetaDescription: features.seo.hasMetaDescription,
          h1Count: features.seo.h1Count,
          internalLinkCount: features.seo.internalLinkCount,
          hasCanonicalTag: features.seo.hasCanonicalTag,
          hasOpenGraphTags: features.seo.hasOpenGraphTags,
        },
        brand: {
          hasLogoInHeader: features.branding.hasLogoInHeader,
          hasLogoInFooter: features.branding.hasLogoInFooter,
          hasStructuredNav: features.branding.hasStructuredNav,
          navVarietyCount: [
            features.navigation.hasProductNav,
            features.navigation.hasSolutionsNav,
            features.navigation.hasResourcesNav,
            features.navigation.hasPricingNav,
            features.navigation.hasBlogNav,
            features.navigation.hasDocsNav,
          ].filter(Boolean).length,
        },
        authority: {
          testimonialCount: features.authority.testimonialCount,
          customerLogoCount: features.authority.customerLogoCount,
          caseStudyCount: features.content.caseStudyCount,
          hasCustomerLogoStrip: features.authority.hasCustomerLogoStrip,
          hasAwardsOrBadges: features.authority.hasAwardsOrBadges,
          hasG2OrReviewBadges: features.authority.hasG2OrReviewBadges,
        },
      },
    });
  }

  return { website, content, seo, brand, authority };
}

/**
 * Score Website & Conversion dimension from SiteFeatures
 * 
 * Evaluates UX signals, CTAs, navigation, and conversion elements.
 */
function scoreWebsite(features: SiteFeatures): number {
  const ux = features.ux;
  const nav = features.navigation;
  const conv = features.conversions;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Primary CTAs (normalize to 0-1, cap at 5+ CTAs = 1.0)
  const ctaScore = Math.min(ux.primaryCtaCount / 5, 1);
  add(ctaScore, 3);

  // Above-the-fold CTA
  add(ux.hasAboveTheFoldCTA ? 1 : 0, 2);

  // Clear contact/demo entry
  add(conv.hasSignupOrDemoCTA ? 1 : 0, 2);

  // Structured navigation (5+ nav items = good structure)
  const navStructureScore = Math.min(nav.navItemLabels.length / 5, 1);
  add(navStructureScore, 2);

  // Hero headline presence and quality
  const headlineScore = ux.heroHeadlineTextLength > 0 
    ? Math.min(ux.heroHeadlineTextLength / 50, 1) // 50+ chars = good
    : 0;
  add(headlineScore, 1.5);

  // Hero subheadline
  add(ux.heroHasSubheadline ? 1 : 0, 1);

  // Forms (lead capture)
  const formScore = Math.min(conv.formCount / 2, 1); // 2+ forms = good
  add(formScore, 1);

  // Free trial/get started presence
  add(conv.hasFreeTrialOrGetStarted ? 1 : 0, 0.5);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Score Content Depth & Velocity dimension from SiteFeatures
 * 
 * Rewards depth, breadth, and funnel coverage before critiquing narrative or BOFU gaps.
 * Designed to properly score content-rich sites like HubSpot, Intercom, etc.
 * 
 * Rubric:
 * - Content depth & volume (blogPostCount, resources) → 35 pts
 * - Case studies & proof content → 25 pts
 * - Funnel coverage (MOFU/BOFU) via case studies/resources/docs → 20 pts
 * - Content structure & discoverability (hasBlog, hasResourcesHub, nav presence) → 10 pts
 * - Messaging clarity in content (approximated) → 10 pts
 */
function scoreContent(features: SiteFeatures): number {
  const c = features.content;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // 1. Content depth & volume (35 pts)
  // Blog depth: normalize to 0-1, with 50+ posts treated as full (1.0)
  const blogDepth = Math.min(c.blogPostCount / 50, 1);
  // Resources depth: resources hub indicates substantial content ecosystem
  const resourcesDepth = c.hasResourcesHub ? 1 : 0;
  // Take the max of blog or resources depth (sites with either should score well)
  add(Math.max(blogDepth, resourcesDepth), 3.5); // 35 pts

  // 2. Case studies & proof content (25 pts)
  // Normalize: 15+ case studies = full score (1.0)
  const caseStudyDepth = Math.min(c.caseStudyCount / 15, 1);
  add(caseStudyDepth, 2.5); // 25 pts

  // 3. Funnel coverage (20 pts)
  // Case studies indicate BOFU (bottom of funnel) content
  // Resources/docs indicate MOFU (middle of funnel) content
  const funnelCoverage =
    (c.caseStudyCount > 0 ? 0.5 : 0) +  // BOFU coverage
    (c.hasResourcesHub ? 0.3 : 0) +      // MOFU coverage (resources)
    (c.hasDocsOrGuides ? 0.2 : 0);       // MOFU coverage (docs/guides)
  add(Math.min(funnelCoverage, 1), 2.0); // 20 pts

  // 4. Content structure & discoverability (10 pts)
  // Blog presence = 0.5, Resources hub = 0.3, Docs = 0.2
  const structure =
    (c.hasBlog ? 0.5 : 0) +
    (c.hasResourcesHub ? 0.3 : 0) +
    (c.hasDocsOrGuides ? 0.2 : 0);
  add(Math.min(structure, 1), 1.0); // 10 pts

  // 5. Messaging clarity in content (10 pts)
  // For now, use a placeholder that doesn't punish content-rich sites
  // Sites with substantial content likely have decent messaging
  // Default to 0.6 to avoid being overly punitive
  const messagingScore = (c.hasBlog || c.hasResourcesHub) ? 0.7 : 0.5;
  add(messagingScore, 1.0); // 10 pts

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  let contentScore = Math.round(Math.max(0, Math.min(100, normalized)));

  // Apply content floors for sites with strong signals
  // This ensures content-rich sites don't get unfairly low scores
  if (c.hasBlog && c.blogPostCount >= 40) {
    contentScore = Math.max(contentScore, 70);
  }
  
  if (c.caseStudyCount >= 15 || c.hasResourcesHub) {
    contentScore = Math.max(contentScore, 75);
  }

  // Extra boost for sites with both substantial blog AND resources hub
  if (c.hasBlog && c.blogPostCount >= 40 && c.hasResourcesHub) {
    contentScore = Math.max(contentScore, 80);
  }

  // Social-first content floor for consumer-facing brands
  // Gyms, salons, venues, influencers, etc. may not have blogs but have strong Instagram presence
  // This prevents them from scoring 0-20 content scores unfairly
  const social = features.social;
  if (!c.hasBlog && social.hasInstagram) {
    contentScore = Math.max(contentScore, 40);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[contentScoring:socialFirst]', features.url, {
        hasBlog: c.hasBlog,
        hasInstagram: social.hasInstagram,
        contentScoreAfterFloor: contentScore,
      });
    }
  }

  return contentScore;
}

/**
 * Score SEO & Visibility dimension from SiteFeatures
 * 
 * Evaluates technical SEO signals, meta tags, heading structure, and internal linking.
 */
function scoreSEO(features: SiteFeatures): number {
  const seo = features.seo;
  const technical = features.technical;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Meta tags (title + description)
  const metaScore = (seo.hasMetaTitle ? 0.5 : 0) + (seo.hasMetaDescription ? 0.5 : 0);
  add(metaScore, 2);

  // Heading structure (single H1 = good, multiple H1s = bad)
  const h1Score = seo.h1Count === 1 ? 1 : seo.h1Count > 1 ? 0.3 : 0;
  add(h1Score, 2);

  // Internal linking (normalize: 50+ links = 1.0)
  const internalLinkScore = Math.min(seo.internalLinkCount / 50, 1);
  add(internalLinkScore, 2);

  // Canonical tag
  add(seo.hasCanonicalTag ? 1 : 0, 1);

  // Lang attribute
  add(seo.hasLangAttribute ? 1 : 0, 1);

  // Open Graph tags
  add(seo.hasOpenGraphTags ? 1 : 0, 1);

  // Responsive viewport
  add(technical.hasResponsiveMetaViewport ? 1 : 0, 1);

  // HTTPS
  add(technical.usesHttps ? 1 : 0, 1);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Score Brand & Positioning dimension from SiteFeatures
 * 
 * Evaluates visual identity, logo consistency, navigation structure, and brand signals.
 */
function scoreBrand(features: SiteFeatures): number {
  const branding = features.branding;
  const nav = features.navigation;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Logo presence (header + footer)
  const logoScore = (branding.hasLogoInHeader ? 0.5 : 0) + 
                    (branding.hasLogoInFooter ? 0.5 : 0);
  add(logoScore, 2);

  // Structured navigation (5+ nav items = good structure)
  const navStructureScore = branding.hasStructuredNav ? 1 : 
    Math.min(nav.navItemLabels.length / 5, 1);
  add(navStructureScore, 2.5);

  // Navigation variety (product, solutions, resources, pricing, blog, docs)
  const navVarietyCount = [
    nav.hasProductNav,
    nav.hasSolutionsNav,
    nav.hasResourcesNav,
    nav.hasPricingNav,
    nav.hasBlogNav,
    nav.hasDocsNav,
  ].filter(Boolean).length;
  const navVarietyScore = navVarietyCount / 6;
  add(navVarietyScore, 2);

  // Visual identity consistency (logo + colors + typography)
  // Logo consistency: logo appears in header and/or footer
  const hasConsistentLogo = branding.hasLogoInHeader || branding.hasLogoInFooter;
  const visualIdentityScore = (hasConsistentLogo ? 0.33 : 0) +
                             (branding.hasConsistentBrandColors ? 0.33 : 0) +
                             (branding.hasConsistentTypography ? 0.34 : 0);
  add(visualIdentityScore, 2);

  // Hero illustration/visual
  add(branding.hasHeroIllustrationOrVisual ? 1 : 0, 1);

  // Distinct product illustrations
  add(branding.hasDistinctProductIllustrations ? 1 : 0, 0.5);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Score Authority & Trust dimension from SiteFeatures
 * 
 * Rewards social proof depth, credibility markers, scale signals, and integration.
 * Designed to properly score category leaders like HubSpot, Stripe, Notion, Intercom.
 * 
 * Rubric:
 * - Social proof depth (logos, testimonials, case studies) → 40 pts
 * - Credibility markers (awards, press, review badges) → 20 pts
 * - "Trusted by" framing & scale signals → 20 pts
 * - Integration of proof into core pages (hero, product pages, nav) → 20 pts
 */
function scoreAuthority(features: SiteFeatures): number {
  const a = features.authority;
  const c = features.content;

  let score = 0;
  let weight = 0;

  const add = (value: number, w: number) => {
    score += value * w;
    weight += w;
  };

  // 1) Social proof depth (40 pts)
  // Logos: normalize to 0-1, with 20+ logos treated as full (1.0)
  const logosDepth = Math.min(a.customerLogoCount / 20, 1);
  // Testimonials: normalize to 0-1, with 8+ testimonials treated as full (1.0)
  const testimonialsDepth = Math.min(a.testimonialCount / 8, 1);
  // Case studies: normalize to 0-1, with 15+ case studies treated as full (1.0)
  const caseStudyDepth = Math.min(c.caseStudyCount / 15, 1);

  // Take the max of logos OR average of testimonials + case studies
  // This rewards sites with strong logos OR strong testimonials/case studies
  const socialProofScore = Math.max(
    logosDepth,
    (testimonialsDepth + caseStudyDepth) / 2
  );

  add(socialProofScore, 4.0); // 40 pts

  // 2) Credibility markers (20 pts)
  let credibility = 0;
  if (a.hasAwardsOrBadges) credibility += 0.4;
  if (a.hasPressLogos) credibility += 0.3;
  if (a.hasG2OrReviewBadges) credibility += 0.3;
  credibility = Math.min(credibility, 1);
  add(credibility, 2.0); // 20 pts

  // 3) "Trusted by" framing & scale signals (20 pts)
  let scale = 0;
  if (a.hasTrustedBySection) scale += 0.4;
  if (a.customerLogoCount >= 20) scale += 0.3;
  if (a.customerLogoCount >= 50) scale += 0.3; // Extra boost for massive scale
  scale = Math.min(scale, 1);
  add(scale, 2.0); // 20 pts

  // 4) Social media presence (15 pts)
  // LinkedIn, Facebook, Instagram presence signals credibility and engagement
  // Weighted: LinkedIn (3), Facebook (2), Instagram (2) = max 7 points
  const social = features.social;
  const socialPresenceScore = (
    (social.hasLinkedIn ? 3 : 0) +
    (social.hasFacebook ? 2 : 0) +
    (social.hasInstagram ? 2 : 0)
  ) / 7; // Normalize to 0-1
  add(socialPresenceScore, 1.5); // 15 pts

  // 5) Integration into core UX (5 pts)
  // How well proof is integrated into the site experience
  // Reduced weight to make room for social presence
  let integration = 0;
  if (a.hasCustomerLogoStrip) integration += 0.4; // Logo strip on homepage
  if (a.hasNamedCustomerStories) integration += 0.3; // Named testimonials
  if (c.hasCaseStudiesSection) integration += 0.3; // Dedicated case studies section
  integration = Math.min(integration, 1);
  add(integration, 0.5); // 5 pts (reduced from 20 to make room for social)

  if (weight === 0) return 0;
  let authorityScore = (score / weight) * 100;
  authorityScore = Math.round(Math.max(0, Math.min(100, authorityScore)));

  // ---- Floors for clearly strong brands ----
  // These ensure category leaders don't get unfairly low scores
  const strongLogos = a.customerLogoCount >= 20 || a.hasCustomerLogoStrip;
  const strongCaseStudies = c.caseStudyCount >= 10 || c.hasCaseStudiesSection;
  const strongBadges = a.hasAwardsOrBadges || a.hasG2OrReviewBadges || a.hasPressLogos;
  const strongTestimonials = a.testimonialCount >= 5;

  // Floor 1: Sites with strong logos AND case studies should score at least 70
  if (strongLogos && strongCaseStudies) {
    authorityScore = Math.max(authorityScore, 70);
  }

  // Floor 2: Sites with strong logos, case studies, AND credibility badges should score at least 80
  if (strongLogos && strongCaseStudies && strongBadges) {
    authorityScore = Math.max(authorityScore, 80);
  }

  // Floor 3: Sites with strong logos, case studies, testimonials, AND badges should score at least 75-80
  if (strongLogos && strongCaseStudies && strongTestimonials && strongBadges) {
    authorityScore = Math.max(authorityScore, 75);
  }

  // Sanity check: If we have 20+ logos, 10+ case studies, 5+ testimonials, and any badges,
  // the score should be at least 75-80
  if (a.customerLogoCount >= 20 && c.caseStudyCount >= 10 && a.testimonialCount >= 5 && strongBadges) {
    authorityScore = Math.max(authorityScore, 75);
  }

  return authorityScore;
}

