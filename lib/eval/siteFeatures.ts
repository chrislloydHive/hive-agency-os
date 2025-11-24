/**
 * SiteFeatures Schema
 * 
 * Structured blueprint representing all detectable signals from a website.
 * This schema serves as the canonical data structure for feeding into the scoring engine.
 * 
 * All signals are deterministic and extracted from actual site data (HTML, structure, content).
 * No LLM inference - purely signal-based detection.
 */

/**
 * Branding Signals
 * Visual identity and brand consistency indicators
 */
export interface BrandingSignals {
  /** Logo appears in header/navigation */
  hasLogoInHeader: boolean;
  
  /** Logo appears in footer */
  hasLogoInFooter: boolean;
  
  /** Number of distinct brand colors detected (primary palette) */
  primaryColorCount: number;
  
  /** Brand colors are used consistently across pages */
  hasConsistentBrandColors: boolean;
  
  /** Typography is consistent across pages */
  hasConsistentTypography: boolean;
  
  /** Hero section includes illustration or visual element */
  hasHeroIllustrationOrVisual: boolean;
  
  /** Product/service has distinct illustration style */
  hasDistinctProductIllustrations: boolean;
  
  /** Navigation follows structured pattern (product/solutions/resources/pricing) */
  hasStructuredNav: boolean;
}

/**
 * Content Signals
 * Content depth, variety, and funnel coverage indicators
 */
export interface ContentSignals {
  /** Blog section exists */
  hasBlog: boolean;
  
  /** Total number of blog posts detected */
  blogPostCount: number;
  
  /** Resources hub or library exists */
  hasResourcesHub: boolean;
  
  /** Case studies section exists */
  hasCaseStudiesSection: boolean;
  
  /** Total number of case studies detected */
  caseStudyCount: number;
  
  /** Documentation or guides section exists */
  hasDocsOrGuides: boolean;
  
  /** Pricing page exists */
  hasPricingPage: boolean;
  
  /** About page exists */
  hasAboutPage: boolean;
  
  /** Careers page exists */
  hasCareersPage: boolean;
  
  /** Feature or product detail pages exist */
  hasFeatureOrProductPages: boolean;
}

/**
 * Authority Signals
 * Trust, credibility, and social proof indicators
 */
export interface AuthoritySignals {
  /** Number of testimonials visible on site */
  testimonialCount: number;
  
  /** Number of customer logos displayed */
  customerLogoCount: number;
  
  /** Customer logo strip/section exists */
  hasCustomerLogoStrip: boolean;
  
  /** Awards or badges displayed */
  hasAwardsOrBadges: boolean;
  
  /** Press/media logos displayed */
  hasPressLogos: boolean;
  
  /** G2, Capterra, or review badges displayed */
  hasG2OrReviewBadges: boolean;
  
  /** Named customer success stories exist */
  hasNamedCustomerStories: boolean;
  
  /** "Trusted by" or similar section exists */
  hasTrustedBySection: boolean;
}

/**
 * Website UX Signals
 * User experience and conversion flow indicators
 */
export interface WebsiteUXSignals {
  /** Number of primary CTAs (buttons/links with strong action verbs) */
  primaryCtaCount: number;
  
  /** CTA appears above the fold */
  hasAboveTheFoldCTA: boolean;
  
  /** Navigation is sticky/fixed on scroll */
  hasStickyNav: boolean;
  
  /** Clear contact or demo entry point exists */
  hasClearContactOrDemoEntry: boolean;
  
  /** Hero headline text length (characters) */
  heroHeadlineTextLength: number;
  
  /** Hero section includes subheadline */
  heroHasSubheadline: boolean;
  
  /** CTA present in hero section */
  heroCtaPresent: boolean;
  
  /** Sample CTA labels found in hero section (up to 3 unique) */
  heroCtaLabels: string[];
  
  /** CTA present in primary navigation */
  navCtaPresent: boolean;
  
  /** Sticky/floating CTA detected */
  stickyCtaPresent: boolean;
}

/**
 * SEO Signals
 * Search engine optimization and visibility indicators
 */
export interface SeoSignals {
  /** Meta title tag exists */
  hasMetaTitle: boolean;
  
  /** Meta description tag exists */
  hasMetaDescription: boolean;
  
  /** Number of H1 tags on page */
  h1Count: number;
  
  /** Multiple H1 tags detected (SEO issue) */
  hasMultipleH1s: boolean;
  
  /** Number of internal links detected */
  internalLinkCount: number;
  
  /** Canonical tag exists */
  hasCanonicalTag: boolean;
  
  /** Lang attribute specified */
  hasLangAttribute: boolean;
  
  /** Open Graph tags exist */
  hasOpenGraphTags: boolean;
}

/**
 * Technical Signals
 * Performance and technical quality indicators
 */
export interface TechnicalSignals {
  /** Lighthouse performance score (0-100) */
  lighthousePerformanceScore?: number;
  
  /** Page speed category based on performance score */
  pageSpeedScoreCategory?: "slow" | "average" | "fast";
  
  /** Responsive meta viewport tag exists */
  hasResponsiveMetaViewport: boolean;
  
  /** Site uses HTTPS */
  usesHttps: boolean;
}

/**
 * Navigation Signals
 * Site structure and navigation patterns
 */
export interface NavigationSignals {
  /** Top-level navigation item labels */
  navItemLabels: string[];
  
  /** Product navigation item exists */
  hasProductNav: boolean;
  
  /** Solutions navigation item exists */
  hasSolutionsNav: boolean;
  
  /** Resources navigation item exists */
  hasResourcesNav: boolean;
  
  /** Pricing navigation item exists */
  hasPricingNav: boolean;
  
  /** Blog navigation item exists */
  hasBlogNav: boolean;
  
  /** Documentation navigation item exists */
  hasDocsNav: boolean;
}

/**
 * Conversion Signals
 * Conversion optimization and lead generation indicators
 */
export interface ConversionSignals {
  /** Total number of CTA buttons */
  ctaButtonCount: number;
  
  /** Total number of forms */
  formCount: number;
  
  /** Signup or demo CTA exists */
  hasSignupOrDemoCTA: boolean;
  
  /** Free trial or "Get Started" CTA exists */
  hasFreeTrialOrGetStarted: boolean;
  
  /** Newsletter or lead magnet exists */
  hasNewsletterOrLeadMagnet: boolean;
}

/**
 * Localization Signals
 * Internationalization and multi-language indicators
 */
export interface LocalizationSignals {
  /** Language switcher exists */
  hasLanguageSwitcher: boolean;
  
  /** Detected locales/languages */
  detectedLocales: string[];
  
  /** Region or country selector exists */
  hasRegionOrCountrySelector: boolean;
}

/**
 * Social Media Signals
 * Social media presence and links
 */
export interface SocialSignals {
  /** LinkedIn profile/page detected */
  hasLinkedIn: boolean;
  
  /** Facebook page/profile detected */
  hasFacebook: boolean;
  
  /** Instagram profile detected */
  hasInstagram: boolean;
  
  /** LinkedIn URLs found */
  linkedinUrls: string[];
  
  /** Facebook URLs found */
  facebookUrls: string[];
  
  /** Instagram URLs found */
  instagramUrls: string[];
}

/**
 * SiteFeatures
 * 
 * Complete blueprint of all detectable signals from a website.
 * This is the canonical data structure that feeds into the scoring engine.
 * 
 * All signals are extracted deterministically from actual site data.
 */
export interface SiteFeatures {
  /** Website URL */
  url: string;
  
  /** Branding and visual identity signals */
  branding: BrandingSignals;
  
  /** Content depth and variety signals */
  content: ContentSignals;
  
  /** Authority and trust signals */
  authority: AuthoritySignals;
  
  /** User experience signals */
  ux: WebsiteUXSignals;
  
  /** SEO and visibility signals */
  seo: SeoSignals;
  
  /** Technical performance signals */
  technical: TechnicalSignals;
  
  /** Navigation structure signals */
  navigation: NavigationSignals;
  
  /** Conversion optimization signals */
  conversions: ConversionSignals;
  
  /** Localization and internationalization signals */
  localization: LocalizationSignals;
  
  /** Social media presence signals */
  social: SocialSignals;
}

/**
 * Create empty/default SiteFeatures object
 * Useful for initialization and testing
 * 
 * @param url - Website URL
 * @returns SiteFeatures object with sensible defaults
 */
export function createEmptySiteFeatures(url: string): SiteFeatures {
  return {
    url,
    branding: {
      hasLogoInHeader: false,
      hasLogoInFooter: false,
      primaryColorCount: 0,
      hasConsistentBrandColors: false,
      hasConsistentTypography: false,
      hasHeroIllustrationOrVisual: false,
      hasDistinctProductIllustrations: false,
      hasStructuredNav: false,
    } as BrandingSignals,
    content: {
      hasBlog: false,
      blogPostCount: 0,
      hasResourcesHub: false,
      hasCaseStudiesSection: false,
      caseStudyCount: 0,
      hasDocsOrGuides: false,
      hasPricingPage: false,
      hasAboutPage: false,
      hasCareersPage: false,
      hasFeatureOrProductPages: false,
    } as ContentSignals,
    authority: {
      testimonialCount: 0,
      customerLogoCount: 0,
      hasCustomerLogoStrip: false,
      hasAwardsOrBadges: false,
      hasPressLogos: false,
      hasG2OrReviewBadges: false,
      hasNamedCustomerStories: false,
      hasTrustedBySection: false,
    } as AuthoritySignals,
    ux: {
      primaryCtaCount: 0,
      hasAboveTheFoldCTA: false,
      hasStickyNav: false,
      hasClearContactOrDemoEntry: false,
      heroHeadlineTextLength: 0,
      heroHasSubheadline: false,
      heroCtaPresent: false,
      heroCtaLabels: [],
      navCtaPresent: false,
      stickyCtaPresent: false,
    } as WebsiteUXSignals,
    seo: {
      hasMetaTitle: false,
      hasMetaDescription: false,
      h1Count: 0,
      hasMultipleH1s: false,
      internalLinkCount: 0,
      hasCanonicalTag: false,
      hasLangAttribute: false,
      hasOpenGraphTags: false,
    } as SeoSignals,
    technical: {
      lighthousePerformanceScore: undefined,
      pageSpeedScoreCategory: undefined,
      hasResponsiveMetaViewport: false,
      usesHttps: false,
    } as TechnicalSignals,
    navigation: {
      navItemLabels: [],
      hasProductNav: false,
      hasSolutionsNav: false,
      hasResourcesNav: false,
      hasPricingNav: false,
      hasBlogNav: false,
      hasDocsNav: false,
    } as NavigationSignals,
    conversions: {
      ctaButtonCount: 0,
      formCount: 0,
      hasSignupOrDemoCTA: false,
      hasFreeTrialOrGetStarted: false,
      hasNewsletterOrLeadMagnet: false,
    } as ConversionSignals,
    localization: {
      hasLanguageSwitcher: false,
      detectedLocales: [],
      hasRegionOrCountrySelector: false,
    } as LocalizationSignals,
    social: {
      hasLinkedIn: false,
      hasFacebook: false,
      hasInstagram: false,
      linkedinUrls: [],
      facebookUrls: [],
      instagramUrls: [],
    } as SocialSignals,
  };
}

