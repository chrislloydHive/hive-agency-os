// lib/os/caseStudies/seed.ts
// Seed data for case studies - idempotent import
// Run via API: POST /api/os/case-studies/seed

import type { CaseStudyInput } from '@/lib/types/firmBrain';

/**
 * Seed case studies for MOE, FCTG, and Microsoft
 * Each client has an internal (full detail) and public (sales-safe) version
 */
export const SEED_CASE_STUDIES: CaseStudyInput[] = [
  // ============================================================================
  // MOE Brand
  // ============================================================================
  {
    title: 'Building a Distinct, Flexible Brand System for MOE',
    client: 'MOE Brand',
    industry: 'Consumer / Lifestyle',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Brand Strategy', 'Visual Identity', 'Brand Guidelines'],
    tags: ['branding', 'brand-identity', 'consumer-brand', 'positioning'],
    summary:
      "MOE needed a cohesive brand identity that could scale across products, platforms, and future growth. Hive developed a flexible brand system that clarified MOE's positioning, elevated its visual presence, and created consistency across all customer touchpoints.",
    problem:
      'MOE lacked a unified brand system that clearly communicated who they were and what made them different. Existing visuals and messaging were fragmented, creating confusion and limiting brand recognition as the company grew.',
    approach:
      'Hive partnered with MOE to define a clear brand foundation and translate it into a modern, adaptable identity system. This included clarifying brand positioning and personality, designing a cohesive visual language, and creating comprehensive brand guidelines to ensure consistency across digital, product, and marketing channels.',
    outcome:
      'MOE launched with a stronger, more confident brand presence that felt cohesive and intentional across all touchpoints. The new identity improved brand clarity, strengthened recognition, and provided a scalable framework to support future growth.',
    metrics: {
      brandClarity: 'Improved',
      internalAlignment: 'Improved',
      launchFeedback: 'Positive',
      conversionImpact: null,
      engagementLift: null,
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=MOE',
      alt: 'MOE Brand logo',
      visibility: 'internal',
      source: 'auto',
    },
  },
  {
    title: 'Creating a Scalable Brand Identity for MOE',
    client: 'MOE',
    industry: 'Consumer / Lifestyle',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Branding', 'Visual Identity'],
    tags: ['branding', 'consumer', 'identity-design'],
    summary:
      'Hive partnered with MOE to create a flexible, modern brand identity designed to scale as the business grows.',
    problem:
      'MOE needed a clearer, more consistent brand presence to stand out and build trust.',
    approach:
      'We developed a cohesive visual identity and brand system that aligned positioning, messaging, and design across channels.',
    outcome:
      'The refreshed brand launched with improved clarity, consistency, and confidence, giving MOE a strong foundation for growth.',
    metrics: {
      brandLaunch: 'Successful',
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=MOE',
      alt: 'MOE logo',
      visibility: 'public',
      source: 'auto',
    },
  },

  // ============================================================================
  // FCTG
  // ============================================================================
  {
    title: 'Clarifying Brand Positioning and Trust for FCTG',
    client: 'FCTG',
    industry: 'Training / Professional Services',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Brand Strategy', 'Brand Identity', 'Messaging'],
    tags: ['branding', 'positioning', 'professional-services', 'trust-building'],
    summary:
      "FCTG needed a clearer brand presence that reflected its expertise and built trust with prospective clients. Hive helped refine the brand's positioning, messaging, and visual identity to better communicate credibility and professionalism.",
    problem:
      "FCTG's brand did not clearly communicate its value or differentiate it within a competitive training and services landscape. Messaging lacked clarity and the visual identity did not fully reflect the company's expertise.",
    approach:
      'Hive worked with FCTG to clarify brand positioning and translate it into a more cohesive identity system. This included refining core messaging, aligning visual elements, and creating a brand foundation that reinforced trust, authority, and consistency across channels.',
    outcome:
      'FCTG emerged with a more confident, professional brand that clearly communicated its value and expertise. The updated identity improved brand clarity, strengthened credibility, and provided a solid foundation for marketing and growth.',
    metrics: {
      brandClarity: 'Improved',
      credibility: 'Improved',
      internalAlignment: 'Improved',
      conversionImpact: null,
      engagementLift: null,
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=FCTG',
      alt: 'FCTG logo',
      visibility: 'internal',
      source: 'auto',
    },
  },
  {
    title: 'Strengthening Brand Clarity and Credibility for FCTG',
    client: 'FCTG',
    industry: 'Training / Professional Services',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Branding', 'Messaging'],
    tags: ['branding', 'professional-services', 'positioning'],
    summary:
      'Hive partnered with FCTG to refine its brand positioning and identity, helping the company communicate expertise and build trust.',
    problem:
      'FCTG needed clearer messaging and a stronger brand presence to stand out and connect with prospective clients.',
    approach:
      'We clarified brand positioning and aligned messaging and visual identity to create a more cohesive and professional brand.',
    outcome:
      'The refreshed brand improved clarity, credibility, and consistency, giving FCTG a stronger foundation for growth.',
    metrics: {
      brandRefresh: 'Completed',
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=FCTG',
      alt: 'FCTG logo',
      visibility: 'public',
      source: 'auto',
    },
  },

  // ============================================================================
  // Microsoft
  // ============================================================================
  {
    title: 'Supporting Enterprise Brand and Content Initiatives for Microsoft',
    client: 'Microsoft',
    industry: 'Technology / Enterprise Software',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Brand Support', 'Content Development', 'Creative Production'],
    tags: ['enterprise', 'technology', 'content', 'brand-support'],
    summary:
      "Microsoft partnered with Hive to support brand and content initiatives that required high-quality creative execution aligned with enterprise standards. Hive delivered strategic and creative support designed to integrate seamlessly within Microsoft's broader brand ecosystem.",
    problem:
      'Microsoft required external creative support that could operate at enterprise scale while maintaining strict brand consistency, quality standards, and alignment with internal teams and initiatives.',
    approach:
      "Hive worked closely with Microsoft stakeholders to understand brand requirements, objectives, and constraints. The team provided creative and content support that aligned with Microsoft's established brand systems, processes, and timelines, ensuring consistency and executional excellence.",
    outcome:
      "The engagement delivered polished, on-brand creative and content assets that met Microsoft's enterprise standards. Hive functioned as a trusted extension of the internal team, enabling efficient execution without sacrificing quality or brand integrity.",
    metrics: {
      brandAlignment: 'Maintained',
      stakeholderSatisfaction: 'Positive',
      deliveryTimeliness: 'On Schedule',
      conversionImpact: null,
      engagementLift: null,
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=Microsoft',
      alt: 'Microsoft logo',
      visibility: 'internal',
      source: 'auto',
    },
  },
  {
    title: 'Enterprise Brand and Content Support for Microsoft',
    client: 'Microsoft',
    industry: 'Technology',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Brand Support', 'Content'],
    tags: ['enterprise', 'technology', 'brand'],
    summary:
      'Hive supported Microsoft with high-quality brand and content execution designed to align with enterprise standards and internal teams.',
    problem:
      'Microsoft needed flexible external support to help execute brand and content initiatives at scale.',
    approach:
      "Hive collaborated with internal stakeholders to deliver creative and content assets that aligned with Microsoft's brand systems and processes.",
    outcome:
      "The partnership delivered consistent, on-brand work that supported Microsoft's initiatives while maintaining quality and efficiency.",
    metrics: {
      enterpriseEngagement: 'Completed',
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=Microsoft',
      alt: 'Microsoft logo',
      visibility: 'public',
      source: 'auto',
    },
  },

  // ============================================================================
  // Optum
  // ============================================================================
  {
    title: 'Driving Awareness and Emotional Connection for Optum in Southern California',
    client: 'Optum',
    industry: 'Healthcare',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Campaign Strategy', 'Content Development', 'Video Production', 'Out-of-Home Creative', 'Social Content'],
    tags: ['healthcare', 'awareness', 'campaign', 'video', 'out-of-home', 'social'],
    summary:
      'Optum wanted increased awareness in their largest market of Southern California. Hive created strategic content designed to make an emotional connection with prospective patients through the multi-year "Strong for…" campaign.',
    problem:
      'Optum needed to grow awareness and differentiate care in a major market while communicating empathy and community connection to prospective patients.',
    approach:
      'Hive developed the "Strong for…" campaign concept and produced a mix of awareness-driving assets. Deliverables included a selection of campaign videos, targeted traditional out-of-home creative, and ongoing social content designed to keep Optum top of mind.',
    outcome:
      'The "Strong for…" campaign ran over multiple years as a consistent awareness platform, reinforcing Optum\'s message of empathetic, community-connected care through coordinated video, out-of-home, and social execution.',
    metrics: {
      campaignLongevity: 'Multi-year',
      marketFocus: 'Southern California',
      awarenessImpact: null,
      engagementLift: null,
      conversionImpact: null,
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=Optum',
      alt: 'Optum logo',
      visibility: 'internal',
      source: 'auto',
    },
  },
  {
    title: 'A Multi-Year Awareness Campaign for Optum',
    client: 'Optum',
    industry: 'Healthcare',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Campaign', 'Content', 'Video', 'Out-of-Home', 'Social'],
    tags: ['healthcare', 'awareness-campaign', 'content'],
    summary:
      'Hive supported Optum\'s awareness efforts in Southern California with strategic, emotionally resonant content through the "Strong for…" campaign.',
    problem:
      'Optum wanted to build awareness and connect with prospective patients in a key market.',
    approach:
      'We created a campaign platform and delivered a mix of video, out-of-home creative, and social content to keep Optum top of mind.',
    outcome:
      'The work established a cohesive, multi-channel awareness presence anchored by a consistent campaign theme.',
    metrics: {
      campaign: 'Strong for…',
    },
    assets: [],
    visuals: [],
    clientLogo: {
      assetUrl: 'https://via.placeholder.com/200x60?text=Optum',
      alt: 'Optum logo',
      visibility: 'public',
      source: 'auto',
    },
  },
];

/**
 * Get case study by logical ID (client-permission pattern)
 */
export function getSeedCaseStudyById(
  id: string
): CaseStudyInput | undefined {
  const idMap: Record<string, number> = {
    'moe-brand-internal': 0,
    'moe-brand-public': 1,
    'fctg-brand-internal': 2,
    'fctg-brand-public': 3,
    'microsoft-brand-internal': 4,
    'microsoft-brand-public': 5,
    'optum-content-internal': 6,
    'optum-content-public': 7,
  };

  const index = idMap[id];
  return index !== undefined ? SEED_CASE_STUDIES[index] : undefined;
}
