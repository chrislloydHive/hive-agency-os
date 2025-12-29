// lib/media/creativeLab.ts
// Creative Lab - AI Creative & Messaging Engine
//
// Generates channel-specific creative concepts, messaging, and ad assets based on:
// - MediaProfile (seasonality, benchmarks, regions)
// - Company metadata
// - Promotion calendar context
// - Existing plan/strategy
// - Historic performance

import { getMediaProfile, type MediaProfile } from './mediaProfile';
import type { MediaChannel } from './types';
import type { PromoEvent } from './promoCalendar';

// ============================================================================
// Types
// ============================================================================

export type CreativeObjective =
  | 'awareness'
  | 'consideration'
  | 'conversion'
  | 'retention'
  | 'seasonal_push';

export type CreativeFormat =
  | 'search_ad'
  | 'display_banner'
  | 'social_post'
  | 'video_script'
  | 'radio_script'
  | 'landing_page'
  | 'email';

export interface CreativeLabInput {
  companyId: string;
  mediaPlanId?: string;
  mediaProgramId?: string;
  objective: CreativeObjective;
  channels: MediaChannel[];
  targetAudience?: string;
  promotionContext?: string;
  promoEvents?: PromoEvent[];
  brandVoice?: string;
  competitorDifferentiators?: string[];
}

export interface AdCopySet {
  headlines: string[];
  descriptions: string[];
  callsToAction: string[];
}

export interface ChannelCreative {
  channel: MediaChannel;
  format: CreativeFormat;
  concepts: string[];
  messaging: {
    valueProps: string[];
    hooks: string[];
    urgencyTriggers: string[];
  };
  adCopy: AdCopySet;
  scripts?: string[];
  imagePrompts?: string[];
  landingPageSuggestions?: string[];
}

export interface CreativePackage {
  id: string;
  companyId: string;
  createdAt: string;
  objective: CreativeObjective;
  targetAudience: string;
  promotionContext?: string;
  channelCreatives: ChannelCreative[];
  overallTheme: string;
  keyMessages: string[];
  toneGuidelines: string[];
}

export interface CreativeBrief {
  id: string;
  companyId: string;
  mediaProgramId?: string;
  mediaPlanId?: string;
  objective: CreativeObjective;
  targetAudience: string;
  promotionContext?: string;
  channels: MediaChannel[];
  package: CreativePackage;
  status: 'draft' | 'approved' | 'in_production' | 'live';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Channel Format Mapping
// ============================================================================

const CHANNEL_FORMATS: Record<MediaChannel, CreativeFormat[]> = {
  search: ['search_ad', 'landing_page'],
  maps: ['landing_page'],
  lsa: ['search_ad'],
  social: ['social_post', 'video_script', 'landing_page'],
  display: ['display_banner', 'landing_page'],
  youtube: ['video_script', 'display_banner'],
  radio: ['radio_script'],
  email: ['email', 'landing_page'],
  affiliate: ['display_banner', 'landing_page'],
  microsoft_search: ['search_ad', 'landing_page'],
  tiktok: ['video_script', 'social_post'],
  tv: ['video_script'],
  streaming_audio: ['radio_script'],
  out_of_home: ['display_banner'],
  print: ['display_banner'],
  direct_mail: ['email'],
};

// ============================================================================
// Objective-Based Templates
// ============================================================================

const OBJECTIVE_TEMPLATES: Record<CreativeObjective, {
  toneGuidelines: string[];
  ctaTypes: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
}> = {
  awareness: {
    toneGuidelines: ['Educational', 'Aspirational', 'Brand-forward'],
    ctaTypes: ['Learn More', 'Discover', 'See How'],
    urgencyLevel: 'low',
  },
  consideration: {
    toneGuidelines: ['Informative', 'Comparative', 'Trust-building'],
    ctaTypes: ['Compare Options', 'Get Details', 'See Examples'],
    urgencyLevel: 'medium',
  },
  conversion: {
    toneGuidelines: ['Action-oriented', 'Value-focused', 'Clear benefits'],
    ctaTypes: ['Get Started', 'Book Now', 'Claim Offer', 'Call Today'],
    urgencyLevel: 'high',
  },
  retention: {
    toneGuidelines: ['Appreciative', 'Exclusive', 'Loyalty-focused'],
    ctaTypes: ['Exclusive Access', 'Member Benefits', 'Stay Connected'],
    urgencyLevel: 'low',
  },
  seasonal_push: {
    toneGuidelines: ['Timely', 'Urgent', 'Event-driven'],
    ctaTypes: ['Limited Time', 'Act Now', 'Seasonal Special'],
    urgencyLevel: 'high',
  },
};

// ============================================================================
// Creative Generation
// ============================================================================

/**
 * Generate a complete creative package for all specified channels
 */
export async function generateCreativePackage(
  input: CreativeLabInput
): Promise<CreativePackage> {
  const {
    companyId,
    objective,
    channels,
    targetAudience,
    promotionContext,
    promoEvents,
    brandVoice,
    competitorDifferentiators,
  } = input;

  // Load media profile for context
  const profile = await getMediaProfile(companyId);

  // Get objective template
  const template = OBJECTIVE_TEMPLATES[objective];

  // Generate channel creatives
  const channelCreatives: ChannelCreative[] = [];

  for (const channel of channels) {
    const formats = CHANNEL_FORMATS[channel] || ['display_banner'];
    const primaryFormat = formats[0];

    const creative = generateChannelCreative({
      channel,
      format: primaryFormat,
      objective,
      template,
      profile,
      targetAudience,
      promotionContext,
      promoEvents,
      brandVoice,
      competitorDifferentiators,
    });

    channelCreatives.push(creative);
  }

  // Generate overall theme and key messages
  const overallTheme = generateOverallTheme(objective, promotionContext, promoEvents);
  const keyMessages = generateKeyMessages(objective, profile, competitorDifferentiators);

  return {
    id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    createdAt: new Date().toISOString(),
    objective,
    targetAudience: targetAudience || 'General audience',
    promotionContext,
    channelCreatives,
    overallTheme,
    keyMessages,
    toneGuidelines: template.toneGuidelines,
  };
}

/**
 * Generate creative for a specific channel
 */
function generateChannelCreative(params: {
  channel: MediaChannel;
  format: CreativeFormat;
  objective: CreativeObjective;
  template: typeof OBJECTIVE_TEMPLATES[CreativeObjective];
  profile: MediaProfile;
  targetAudience?: string;
  promotionContext?: string;
  promoEvents?: PromoEvent[];
  brandVoice?: string;
  competitorDifferentiators?: string[];
}): ChannelCreative {
  const {
    channel,
    format,
    objective,
    template,
    promotionContext,
    competitorDifferentiators,
  } = params;

  // Generate concepts based on objective and channel
  const concepts = generateConcepts(channel, objective, promotionContext);

  // Generate messaging
  const messaging = generateMessaging(
    objective,
    template,
    competitorDifferentiators
  );

  // Generate ad copy
  const adCopy = generateAdCopy(channel, format, objective, template, promotionContext);

  // Generate scripts for audio/video channels
  const scripts = ['radio', 'youtube', 'tv', 'streaming_audio', 'tiktok'].includes(channel)
    ? generateScripts(channel, objective, promotionContext)
    : undefined;

  // Generate image prompts for visual channels
  const imagePrompts = ['display', 'social', 'youtube', 'tiktok'].includes(channel)
    ? generateImagePrompts(channel, objective, promotionContext)
    : undefined;

  // Generate landing page suggestions
  const landingPageSuggestions = generateLandingPageSuggestions(
    objective,
    template
  );

  return {
    channel,
    format,
    concepts,
    messaging,
    adCopy,
    scripts,
    imagePrompts,
    landingPageSuggestions,
  };
}

// ============================================================================
// Content Generators
// ============================================================================

function generateConcepts(
  channel: MediaChannel,
  objective: CreativeObjective,
  promotionContext?: string
): string[] {
  const baseConceptsMap: Record<CreativeObjective, string[]> = {
    awareness: [
      'Brand story introduction',
      'Problem awareness',
      'Category education',
      'Social proof showcase',
    ],
    consideration: [
      'Feature comparison',
      'Customer success stories',
      'Expert credibility',
      'Process transparency',
    ],
    conversion: [
      'Limited-time offer',
      'Risk reversal (guarantee)',
      'Urgency + scarcity',
      'Direct value proposition',
    ],
    retention: [
      'Loyalty appreciation',
      'Exclusive member benefits',
      'Referral program',
      'Anniversary celebration',
    ],
    seasonal_push: [
      'Holiday theme tie-in',
      'Seasonal urgency',
      'Weather-based relevance',
      'Event countdown',
    ],
  };

  const baseConcepts = baseConceptsMap[objective] || baseConceptsMap.conversion;

  // Add promotion-specific concept if context provided
  if (promotionContext) {
    return [...baseConcepts, `Promotion: ${promotionContext}`];
  }

  return baseConcepts;
}

function generateMessaging(
  objective: CreativeObjective,
  template: typeof OBJECTIVE_TEMPLATES[CreativeObjective],
  _competitorDifferentiators?: string[]
): ChannelCreative['messaging'] {
  const valuePropsMap: Record<CreativeObjective, string[]> = {
    awareness: [
      'Trusted by thousands',
      'Industry-leading expertise',
      'Your local solution',
      'Quality you can count on',
    ],
    consideration: [
      'Compare and save',
      'See why customers choose us',
      'Expert guidance included',
      'Transparent pricing',
    ],
    conversion: [
      'Get started today',
      'Limited availability',
      'Best value guaranteed',
      'Fast, professional service',
    ],
    retention: [
      'Thank you for your loyalty',
      'Exclusive member pricing',
      'Priority service access',
      'Refer a friend bonus',
    ],
    seasonal_push: [
      'Seasonal special',
      'Holiday savings',
      'Limited-time event',
      'Act before it\'s gone',
    ],
  };

  const hooksMap: Record<CreativeObjective, string[]> = {
    awareness: [
      'Discover the difference',
      'What if you could...',
      'Meet your new favorite...',
    ],
    consideration: [
      'Still comparing options?',
      'Here\'s what you need to know',
      'The smart choice is clear',
    ],
    conversion: [
      'Ready to get started?',
      'Don\'t miss out',
      'Your solution is here',
    ],
    retention: [
      'Welcome back',
      'We appreciate you',
      'Just for you',
    ],
    seasonal_push: [
      'This season only',
      'The wait is over',
      'Now\'s the time',
    ],
  };

  const urgencyTriggers: string[] = template.urgencyLevel === 'high'
    ? ['Limited time', 'Ending soon', 'While supplies last', 'Act now']
    : template.urgencyLevel === 'medium'
    ? ['Don\'t wait', 'Schedule today', 'Spots filling up']
    : ['Learn more', 'Explore options', 'Discover'];

  return {
    valueProps: valuePropsMap[objective] || valuePropsMap.conversion,
    hooks: hooksMap[objective] || hooksMap.conversion,
    urgencyTriggers,
  };
}

function generateAdCopy(
  _channel: MediaChannel,
  format: CreativeFormat,
  _objective: CreativeObjective,
  template: typeof OBJECTIVE_TEMPLATES[CreativeObjective],
  _promotionContext?: string
): AdCopySet {
  // Headlines by format
  const headlinesMap: Record<CreativeFormat, string[]> = {
    search_ad: [
      'Professional Service Near You',
      'Trusted Local Experts',
      'Quality Results Guaranteed',
      'Book Your Appointment Today',
    ],
    display_banner: [
      'Discover Quality Service',
      'Your Solution Awaits',
      'Experience the Difference',
    ],
    social_post: [
      'See what\'s possible',
      'Your next upgrade starts here',
      'Join thousands of happy customers',
    ],
    video_script: [
      'Transform your experience',
      'The smart choice for...',
    ],
    radio_script: [
      'Looking for quality?',
      'This season, choose...',
    ],
    landing_page: [
      'Welcome to better service',
      'Get started in minutes',
    ],
    email: [
      'Special offer inside',
      'Don\'t miss this opportunity',
    ],
  };

  const descriptionsMap: Record<CreativeFormat, string[]> = {
    search_ad: [
      'Expert service with guaranteed results. Free estimates available.',
      'Local professionals ready to help. Call or book online today.',
      'Quality work at competitive prices. See why customers trust us.',
    ],
    display_banner: [
      'Click to learn more about our services',
      'Discover quality solutions for your needs',
    ],
    social_post: [
      'Check out our latest work and customer reviews',
      'We\'re here to help with all your needs',
    ],
    video_script: [
      'Watch how we deliver results',
    ],
    radio_script: [
      'Call now for a free consultation',
    ],
    landing_page: [
      'Fill out the form to get started',
    ],
    email: [
      'Open to see your exclusive offer',
    ],
  };

  return {
    headlines: headlinesMap[format] || headlinesMap.search_ad,
    descriptions: descriptionsMap[format] || descriptionsMap.search_ad,
    callsToAction: template.ctaTypes,
  };
}

function generateScripts(
  channel: MediaChannel,
  objective: CreativeObjective,
  promotionContext?: string
): string[] {
  const duration = channel === 'radio' || channel === 'streaming_audio' ? '30s' : '15-30s';
  const promo = promotionContext ? ` featuring ${promotionContext}` : '';

  return [
    `[${duration} ${channel} script${promo}]\n\nOpening: Hook with problem/desire\nMiddle: Present solution and benefits\nClose: Clear CTA with contact info`,
    `[${duration} testimonial format]\n\nCustomer voice: Share experience\nBrand voice: Reinforce key message\nClose: Invitation to act`,
  ];
}

function generateImagePrompts(
  channel: MediaChannel,
  _objective: CreativeObjective,
  _promotionContext?: string
): string[] {
  const styleMap: Record<MediaChannel, string> = {
    display: 'clean, professional, brand colors prominent',
    social: 'engaging, lifestyle-focused, authentic feel',
    youtube: 'high-quality thumbnail, clear text overlay, human faces',
    tiktok: 'trendy, dynamic, mobile-first composition',
    search: '',
    maps: '',
    lsa: '',
    radio: '',
    email: 'clean, mobile-optimized, single focus',
    affiliate: 'promotional, value-focused',
    microsoft_search: '',
    tv: 'cinematic, high production value',
    streaming_audio: '',
    out_of_home: 'bold, readable from distance, minimal text',
    print: 'high-resolution, detailed, professional',
    direct_mail: 'attention-grabbing, clear offer',
  };

  const style = styleMap[channel] || 'professional and engaging';

  return [
    `Hero image: ${style}, showing service in action or satisfied customer`,
    `Product/service focus: ${style}, highlighting key feature or benefit`,
    `Social proof: ${style}, featuring customer testimonial or review`,
  ];
}

function generateLandingPageSuggestions(
  objective: CreativeObjective,
  template: typeof OBJECTIVE_TEMPLATES[CreativeObjective]
): string[] {
  return [
    `Hero section with clear headline and primary CTA (${template.ctaTypes[0]})`,
    'Trust signals: Reviews, certifications, guarantees',
    'Benefits breakdown with icons or short descriptions',
    'Social proof: Customer testimonials or case studies',
    'FAQ section addressing common objections',
    `Footer CTA reinforcing ${template.ctaTypes[0]}`,
  ];
}

function generateOverallTheme(
  objective: CreativeObjective,
  promotionContext?: string,
  promoEvents?: PromoEvent[]
): string {
  const objectiveThemes: Record<CreativeObjective, string> = {
    awareness: 'Introducing excellence and expertise',
    consideration: 'Building confidence through transparency',
    conversion: 'Taking action with confidence',
    retention: 'Celebrating our valued customers',
    seasonal_push: 'Timely opportunity meets quality service',
  };

  let theme = objectiveThemes[objective];

  if (promotionContext) {
    theme += ` — ${promotionContext}`;
  }

  if (promoEvents && promoEvents.length > 0) {
    const topEvent = promoEvents[0];
    theme += ` (${topEvent.label})`;
  }

  return theme;
}

function generateKeyMessages(
  objective: CreativeObjective,
  profile: MediaProfile,
  competitorDifferentiators?: string[]
): string[] {
  const messages: string[] = [];

  // Add objective-based message
  const objectiveMessages: Record<CreativeObjective, string> = {
    awareness: 'Discover why we\'re the trusted choice',
    consideration: 'Compare our quality and value',
    conversion: 'Get started today with confidence',
    retention: 'Thank you for being part of our family',
    seasonal_push: 'Take advantage of this limited-time opportunity',
  };
  messages.push(objectiveMessages[objective]);

  // Add region-based message if multi-location
  if (profile.regions && profile.regions.length > 1) {
    messages.push(`Serving ${profile.regions.length} regions with local expertise`);
  }

  // Add differentiators
  if (competitorDifferentiators && competitorDifferentiators.length > 0) {
    messages.push(...competitorDifferentiators.slice(0, 2));
  }

  // Add value message
  if (profile.avgTicketValue) {
    messages.push('Quality service at competitive prices');
  }

  return messages;
}

// ============================================================================
// Creative Brief Management
// ============================================================================

/**
 * Create a creative brief from a package
 */
export function createCreativeBrief(params: {
  companyId: string;
  package: CreativePackage;
  mediaPlanId?: string;
  mediaProgramId?: string;
}): CreativeBrief {
  const { companyId, package: pkg, mediaPlanId, mediaProgramId } = params;

  return {
    id: `brief_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    mediaProgramId,
    mediaPlanId,
    objective: pkg.objective,
    targetAudience: pkg.targetAudience,
    promotionContext: pkg.promotionContext,
    channels: pkg.channelCreatives.map(c => c.channel),
    package: pkg,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get creative recommendations based on performance data
 */
export function getCreativeRecommendations(params: {
  channelPerformance: Array<{ channel: MediaChannel; cpa: number; ctr: number }>;
  benchmarks: MediaProfile['baselineCpa'];
}): Array<{ channel: MediaChannel; recommendation: string; priority: 'high' | 'medium' | 'low' }> {
  const { channelPerformance, benchmarks } = params;
  const recommendations: Array<{ channel: MediaChannel; recommendation: string; priority: 'high' | 'medium' | 'low' }> = [];

  for (const perf of channelPerformance) {
    const benchmarkCpa = benchmarks[perf.channel] || 100;
    const cpaRatio = perf.cpa / benchmarkCpa;

    if (cpaRatio > 1.3) {
      recommendations.push({
        channel: perf.channel,
        recommendation: 'Consider creative refresh - CPA significantly above benchmark',
        priority: 'high',
      });
    } else if (perf.ctr < 0.01) {
      recommendations.push({
        channel: perf.channel,
        recommendation: 'Low CTR suggests ad fatigue or poor targeting - test new creative',
        priority: 'medium',
      });
    } else if (cpaRatio < 0.7) {
      recommendations.push({
        channel: perf.channel,
        recommendation: 'Strong performance - consider scaling this creative approach',
        priority: 'low',
      });
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============================================================================
// Export Format Helpers
// ============================================================================

/**
 * Format creative package as markdown for export
 */
export function formatCreativePackageAsMarkdown(pkg: CreativePackage): string {
  const lines: string[] = [];

  lines.push('# Creative Package');
  lines.push('');
  lines.push(`**Objective:** ${pkg.objective}`);
  lines.push(`**Target Audience:** ${pkg.targetAudience}`);
  if (pkg.promotionContext) {
    lines.push(`**Promotion:** ${pkg.promotionContext}`);
  }
  lines.push(`**Created:** ${new Date(pkg.createdAt).toLocaleDateString()}`);
  lines.push('');

  lines.push('## Overall Theme');
  lines.push(pkg.overallTheme);
  lines.push('');

  lines.push('## Key Messages');
  for (const msg of pkg.keyMessages) {
    lines.push(`- ${msg}`);
  }
  lines.push('');

  lines.push('## Tone Guidelines');
  for (const tone of pkg.toneGuidelines) {
    lines.push(`- ${tone}`);
  }
  lines.push('');

  for (const creative of pkg.channelCreatives) {
    lines.push(`## ${creative.channel.toUpperCase()} Creative`);
    lines.push('');

    lines.push('### Concepts');
    for (const concept of creative.concepts) {
      lines.push(`- ${concept}`);
    }
    lines.push('');

    lines.push('### Headlines');
    for (const headline of creative.adCopy.headlines) {
      lines.push(`- ${headline}`);
    }
    lines.push('');

    lines.push('### Descriptions');
    for (const desc of creative.adCopy.descriptions) {
      lines.push(`- ${desc}`);
    }
    lines.push('');

    lines.push('### CTAs');
    for (const cta of creative.adCopy.callsToAction) {
      lines.push(`- ${cta}`);
    }
    lines.push('');

    if (creative.scripts && creative.scripts.length > 0) {
      lines.push('### Scripts');
      for (const script of creative.scripts) {
        lines.push('```');
        lines.push(script);
        lines.push('```');
      }
      lines.push('');
    }

    if (creative.imagePrompts && creative.imagePrompts.length > 0) {
      lines.push('### Image Prompts');
      for (const prompt of creative.imagePrompts) {
        lines.push(`- ${prompt}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
