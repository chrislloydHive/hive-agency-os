export interface RubricSubpillar {
  id: string;
  label: string;
  description: string;
  scoringNotes?: string;
}

export interface RubricPillar {
  id: string;
  label: string;
  description: string;
  absoluteWeight: number;
  normalizedWeight?: number;
  subpillars: RubricSubpillar[];
}

export interface RubricDefinition {
  pillars: RubricPillar[];
}

export interface SubpillarScore {
  id: string;
  score: number;      // 0–100
  notes?: string;     // optional: evidence-based explanation
}

export interface PillarScore {
  id: string;
  score: number;           // 0–100 aggregated from subpillars
  weightedScore: number;   // normalized to pillar weight
  subpillarScores: SubpillarScore[];
  notes?: string;
}

export interface Scorecard {
  overallScore: number;       // final weighted score (0–100)
  maturityStage: MaturityStage;
  pillars: PillarScore[];
}

export type MaturityStage = 
  | "Basic"
  | "Developing"
  | "Good"
  | "Advanced"
  | "World-Class";

export interface ExtractionData {
  url: string;
  company_name?: string; // Extracted company name from website

  meta: {
    title: string;
    description: string;
  };

  hero_section: {
    headline_text: string;
    subheadline_text: string;
    cta_buttons: string[];
    hero_image_description: string;
  };

  navigation: {
    primary_nav_items: string[];
    secondary_nav_items: string[];
  };

  sections: {
    type: string;
    heading: string;
    subheading: string;
    body_text: string;
    cta_buttons: string[];
    trust_indicators: string[];
    visual_description: string;
  }[];

  all_headings: string[];
  all_ctas: string[];

  trust_signals: {
    logos_visible: string[];
    testimonials_visible: string[];
    review_counts_visible: string;
    awards_visible: string[];
  };

  value_props: string[];

  content_depth_indicators: {
    feature_lists: string[];
    benefit_lists: string[];
    case_study_snippets: string[];
    faq_present: boolean;
    blog_content?: {
      blog_section_detected: boolean;
      blog_link_in_nav: boolean;
      blog_urls_found: string[];
      blog_post_count_estimate: number;
      blog_categories: string[];
      recent_blog_topics: string[];
      blog_content_quality: string;
      blog_posts?: Array<{
        url: string;
        title: string;
        publish_date?: string;
        category?: string;
        tags?: string[];
      }>;
      posting_frequency?: string;
      recency?: string;
      internal_linking_patterns?: string[];
    };
  };

  seo_elements: {
    h1: string;
    h2_list: string[];
    h3_list: string[];
    schema_detected: string[];
    internal_links_detected: string[];
  };

  design_and_layout: {
    visual_hierarchy_notes: string;
    cta_visibility_notes: string;
    readability_notes: string;
  };

  external_profiles: {
    linkedin_raw: string;
    gbp_raw: string;
  };

  screenshots?: {
    above_fold_description: string;
    mid_page_description: string;
  };

  // Extra fields can be added for tech stack detection
  tech_stack?: {
    cms?: string;
    analytics?: string[];
    crm?: string[];
    ad_pixels?: string[];
    heatmaps?: string[];
    chatbots?: string[];
  };

  analytics_analysis?: {
    ga4_detected?: boolean;
    gtm_detected?: boolean;
    meta_pixel_detected?: boolean;
    hubspot_detected?: boolean;
    mixpanel_detected?: boolean;
    hotjar_detected?: boolean;
    amplitude_detected?: boolean;
    analytics_tools_found: string[];
    analytics_correctness?: string;
    analytics_completeness?: string;
  };

  social?: {
    platform_presence?: string[];
    posting_frequency?: string;
    recent_activity?: string;
    engagement?: string;
    linkedin_analysis?: {
      company_page_found: boolean;
      follower_count?: number;
      posting_frequency?: string;
      latest_post_date?: string;
      latest_post_text?: string;
      activity_level?: string;
    };
    gbp_analysis?: {
      listing_found: boolean;
      review_count?: number;
      rating?: number;
      review_recency?: string;
      latest_review_date?: string;
    };
  };

  review_footprint?: {
    review_count?: number;
    sentiment?: string;
    recency?: string;
  };

  // New top-level analysis objects
  blogAnalysis?: {
    postCount: number;
    latestPostDate?: string;
    postingFrequency?: 'no_recent_posts' | 'low' | 'medium' | 'high' | string;
    topics?: string[];
    hasInternalLinksToCorePages?: boolean;
    notes?: string;
  } | null;

  analyticsAnalysis?: {
    ga4Detected: boolean;
    gtmDetected: boolean;
    metaPixelDetected: boolean;
    hotjarDetected: boolean;
    mixpanelOrAmplitudeDetected: boolean;
    summary?: string;
  } | null;

  brandAuthority?: {
    linkedin?: {
      url: string | null;
      followers?: number | null;
      postingFrequency?: string | null;
      latestPostDate?: string | null;
      summary?: string;
    };
    gbp?: {
      url: string | null;
      reviewCount?: number | null;
      rating?: number | null;
      latestReviewDate?: string | null;
      summary?: string;
    };
  } | null;
}

export function normalizeRubricWeights(rubric: RubricDefinition): RubricDefinition {
  const total = rubric.pillars.reduce((sum, p) => sum + p.absoluteWeight, 0);

  return {
    pillars: rubric.pillars.map(p => ({
      ...p,
      normalizedWeight: Number((p.absoluteWeight / total).toFixed(6))
    }))
  };
}

export function getMaturityStage(score: number): MaturityStage {
  if (score < 40) return "Basic";
  if (score < 60) return "Developing";
  if (score < 80) return "Good";
  if (score < 95) return "Advanced";
  return "World-Class";
}

export function getMaturityDescription(stage: MaturityStage): string {
  switch (stage) {
    case "Basic":
      return "Early-stage marketing foundation with major gaps across brand clarity, content depth, technical setup, and conversion systems. Performance is inconsistent, trust signals are limited, and analytics visibility is low. Growth is possible but requires building core marketing infrastructure before campaigns or scale.";
    case "Developing":
      return "Foundational pieces are in place, but execution is uneven. Messaging, content, and conversion paths show potential but lack cohesion, depth, and strategic alignment. Marketing systems are partially implemented but not yet reliable or optimized.";
    case "Good":
      return "A strong baseline marketing engine with clear messaging, structured content, functional UX, and technically sound performance. Opportunities for growth remain, but the organization benefits from a stable, consistent marketing system that supports lead generation and brand credibility.";
    case "Advanced":
      return "High-performing marketing system with clear strategic differentiation, sophisticated content operations, optimized conversion flows, and strong authority signals. Technical health and analytics maturity support rapid iteration and scale.";
    case "World-Class":
      return "A fully integrated marketing ecosystem operating at the level of top-performing brands. Messaging is distinctive, content drives category authority, experiences are frictionless, and optimization is continuous. Marketing is a strategic growth engine that compounds over time.";
    default:
      return "";
  }
}

export const DEFAULT_RUBRIC: RubricDefinition = {
  pillars: [
    {
      id: "brand_clarity",
      label: "Brand Clarity",
      description: "How clearly the brand communicates what it does, for whom, and why it matters.",
      absoluteWeight: 14,
      subpillars: [
        { id: "hero_clarity", label: "Hero Clarity", description: "Is the core offering instantly clear in the hero section?" },
        { id: "subheadline_clarity", label: "Subheadline Clarity", description: "Does the subheadline meaningfully extend the headline?" },
        { id: "audience_specificity", label: "Audience Specificity", description: "Does the page clearly identify the target audience(s)?" },
        { id: "offer_specificity", label: "Offer Specificity", description: "Is the offer clearly stated and specific, not vague?" },
        { id: "differentiation", label: "Differentiation", description: "Is a unique differentiator visible above or near the fold?" },
        { id: "nav_clarity", label: "Navigation Clarity", description: "Is it clear what the company does from the navigation items?" },
        { id: "consistency", label: "Messaging Consistency", description: "Is messaging consistent across all visible sections?" }
      ]
    },
    {
      id: "messaging_value",
      label: "Messaging & Value Proposition",
      description: "Strength and clarity of the value proposition and messaging depth.",
      absoluteWeight: 10,
      subpillars: [
        { id: "outcome_orientation", label: "Outcome Orientation", description: "Are outcomes emphasized over features?" },
        { id: "benefits_focus", label: "Benefits Focus", description: "Does content highlight benefits clearly and repeatedly?" },
        { id: "unique_mechanism", label: "Unique Mechanism", description: "Does the brand explain its unique process or mechanism?" },
        { id: "value_density", label: "Value Density", description: "Is each section packed with clear, relevant value?" },
        { id: "emotional_resonance", label: "Emotional Resonance", description: "Does messaging create emotional connection?" },
        { id: "segment_alignment", label: "Segment Alignment", description: "Is messaging aligned to the specific segment's pain points?" }
      ]
    },
    {
      id: "content_depth",
      label: "Content Depth & Effectiveness",
      description: "Does the site provide meaningful, deep, and authoritative content?",
      absoluteWeight: 10,
      subpillars: [
        { id: "content_breadth", label: "Content Breadth", description: "Does the site cover the necessary breadth of topics for its category?" },
        { id: "content_depth", label: "Content Depth", description: "Does the site go deep on its topics with substance?" },
        { id: "case_studies", label: "Case Studies", description: "Are there real client stories or examples?" },
        { id: "proof_elements", label: "Proof Elements", description: "Does the site include data, stats, or proof elements?" },
        { id: "blog_presence", label: "Blog Presence", description: "Is there a blog or resource center?" },
        { id: "blog_volume", label: "Blog Volume", description: "How many blog posts exist?" },
        { id: "blog_recency", label: "Blog Recency", description: "How recently was content updated?" },
        { id: "blog_frequency", label: "Blog Frequency", description: "How often are new posts published?" },
        { id: "blog_seo", label: "Blog SEO", description: "Are blog posts optimized for search?" },
        { id: "blog_internal_linking", label: "Blog Internal Linking", description: "Do blog posts link internally to other content?" },
        { id: "topic_authority", label: "Topic Authority", description: "Does the content demonstrate expertise?" }
      ]
    },
    {
      id: "seo",
      label: "SEO Fundamentals",
      description: "Core SEO best practices visible from the page.",
      absoluteWeight: 10,
      subpillars: [
        { id: "h1_quality", label: "H1 Quality", description: "Is there a strong, relevant H1?" },
        { id: "metadata", label: "Metadata Quality", description: "Is the meta title + description optimized?" },
        { id: "internal_linking", label: "Internal Linking", description: "Does the page internal link effectively?" },
        { id: "keyword_alignment", label: "Keyword Alignment", description: "Are keywords aligned with what they do?" },
        { id: "alt_tags", label: "Image Alt Tags", description: "Are alt tags present and descriptive?" },
        { id: "crawlability", label: "Crawlability", description: "Does the structure suggest good crawlability?" },
        { id: "sitemap_schema", label: "Sitemap/Schema Signals", description: "Are sitemap/schema hints detectable?" }
      ]
    },
    {
      id: "conversion",
      label: "Conversion Readiness & UX",
      description: "Does the site make it easy and compelling for users to take action?",
      absoluteWeight: 12,
      subpillars: [
        { id: "primary_cta", label: "Primary CTA", description: "Is there a clear primary CTA?" },
        { id: "cta_clarity", label: "CTA Clarity", description: "Is the CTA benefit-driven?" },
        { id: "cta_prominence", label: "CTA Prominence", description: "Is the CTA visible above the fold?" },
        { id: "trust_indicators", label: "Trust Indicators", description: "Does the page include trust logos, testimonials, certifications?" },
        { id: "visual_hierarchy", label: "Visual Hierarchy", description: "Is the layout visually prioritized and clear?" },
        { id: "readability", label: "Readability", description: "Is the text easy to read?" },
        { id: "scannability", label: "Scannability", description: "Is the content easy to scan?" },
        { id: "mobile_signals", label: "Mobile Signals", description: "Are there visible cues of mobile-friendliness?" }
      ]
    },
    {
      id: "technical_health",
      label: "Technical Health & Performance",
      description: "Does the site follow basic technical best practices?",
      absoluteWeight: 8,
      subpillars: [
        { id: "speed", label: "Page Speed Signals", description: "Are there performance-killing elements (huge images, scripts)?" },
        { id: "frontend_modernity", label: "Modern Frontend", description: "Are modern semantic elements used?" },
        { id: "broken_elements", label: "Broken Elements", description: "Are there broken links or missing images?" },
        { id: "accessibility_signals", label: "Accessibility Signals", description: "Is there visible accessibility effort?" },
        { id: "analytics_presence", label: "Analytics Presence", description: "Are analytics tools detected (GA4, GTM, etc.)?" },
        { id: "analytics_correctness", label: "Analytics Correctness", description: "Are analytics properly configured?" },
        { id: "analytics_completeness", label: "Analytics Completeness", description: "Are multiple analytics tools present?" },
        { id: "heatmap_presence", label: "Heatmap Presence", description: "Are heatmap tools detected (Hotjar, Clarity, etc.)?" }
      ]
    },
    {
      id: "tech_stack",
      label: "Tech Stack Maturity",
      description: "Does the company use modern growth, analytics, and marketing tools?",
      absoluteWeight: 8,
      subpillars: [
        { id: "cms", label: "CMS Detection", description: "What platform is this built on?" },
        { id: "analytics", label: "Analytics Presence", description: "GA4, GTM, Segment, Adobe?" },
        { id: "crm", label: "CRM/Automation Tools", description: "HubSpot, ActiveCampaign, Salesforce?" },
        { id: "ad_pixels", label: "Ad Pixels", description: "Meta, TikTok, Google Ads?" },
        { id: "heatmaps", label: "Heatmaps", description: "Hotjar, Clarity, FullStory?" },
        { id: "chatbots", label: "Chatbots", description: "Intercom, Drift?" }
      ]
    },
    {
      id: "social",
      label: "Social Footprint",
      description: "Does the company show signs of active social presence?",
      absoluteWeight: 6,
      subpillars: [
        { id: "platform_presence", label: "Platform Presence", description: "Which social profiles exist?" },
        { id: "posting_frequency", label: "Posting Frequency", description: "How often do they post?" },
        { id: "recent_activity", label: "Recent Activity", description: "When was last post?" },
        { id: "engagement", label: "Engagement Indicators", description: "Do posts show engagement?" },
        { id: "linkedin_presence", label: "LinkedIn Presence", description: "Does the company have a LinkedIn Company Page?" },
        { id: "linkedin_activity", label: "LinkedIn Activity", description: "Is the LinkedIn page active with recent posts?" },
        { id: "gbp_review_count", label: "GBP Review Count", description: "How many Google Business Profile reviews exist?" },
        { id: "gbp_rating", label: "GBP Rating", description: "What is the average Google Business Profile rating?" },
        { id: "gbp_recency", label: "GBP Review Recency", description: "How recent are the Google Business Profile reviews?" }
      ]
    },
    {
      id: "reviews",
      label: "Review Footprint & Trust Signals",
      description: "Does the brand have credible review presence?",
      absoluteWeight: 6,
      subpillars: [
        { id: "review_count", label: "Review Count", description: "How many reviews exist?" },
        { id: "sentiment", label: "Review Sentiment", description: "Overall sentiment of reviews" },
        { id: "recency", label: "Review Recency", description: "How recent are the reviews?" },
        { id: "on_page_testimonials", label: "On-Page Testimonials", description: "Are testimonials visible?" }
      ]
    },
    {
      id: "competitor_positioning",
      label: "Market Positioning vs Competitors",
      description: "How well the site compares to named competitors.",
      absoluteWeight: 10,
      subpillars: [
        { id: "value_prop_comparison", label: "Value Prop Comparison", description: "How strong is the value prop vs category leaders?" },
        { id: "social_proof_comparison", label: "Social Proof Comparison", description: "Relative social proof strength." },
        { id: "content_depth_comparison", label: "Content Depth Comparison", description: "How deep is content vs competition?" },
        { id: "ux_comparison", label: "UX Comparison", description: "How does UX compare to competitors?" },
        { id: "offer_comparison", label: "Offer Comparison", description: "How differentiated is their offer?" }
      ]
    }
  ]
};

