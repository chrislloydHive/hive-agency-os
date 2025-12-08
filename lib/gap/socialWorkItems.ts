// lib/gap/socialWorkItems.ts
//
// Generate Work Items from Social & Local Presence Snapshot
//
// This module creates actionable Work Items based on:
// - Social profile detection results
// - GBP presence/absence
// - Confidence levels (to avoid hallucinating work for uncertain data)
//
// Key principle: Only recommend "setup" work for MISSING with HIGH confidence.
// For PRESENT/PROBABLE, recommend optimization instead.

import type {
  SocialFootprintSnapshot,
  SocialPresence,
  GbpPresence,
  SocialNetwork,
  PresenceStatus,
} from './socialDetection';
import type { CreateWorkItemInput } from '@/lib/work/workItems';

// ============================================================================
// Types
// ============================================================================

export interface SocialWorkItemSuggestion {
  /** Work item title */
  title: string;
  /** Detailed description/notes */
  description: string;
  /** Work area category */
  area: 'Brand' | 'Content' | 'Strategy';
  /** Priority level */
  priority: 'P1' | 'P2' | 'P3';
  /** What triggered this suggestion */
  triggerType: 'gbp_setup' | 'gbp_optimize' | 'social_start' | 'social_improve' | 'social_expand';
  /** Confidence in this recommendation */
  recommendationConfidence: 'high' | 'medium' | 'conditional';
  /** Optional: which network this is for */
  network?: SocialNetwork;
}

export interface CreateSocialWorkItemsResult {
  /** Suggested work items */
  suggestions: SocialWorkItemSuggestion[];
  /** Why certain recommendations were skipped */
  skipped: {
    reason: string;
    network?: SocialNetwork | 'gbp';
  }[];
  /** Overall data confidence from snapshot */
  dataConfidence: number;
}

// ============================================================================
// Constants
// ============================================================================

const NETWORK_LABELS: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
};

/**
 * Priority networks for local businesses (recommend first)
 */
const PRIORITY_NETWORKS: SocialNetwork[] = ['instagram', 'facebook', 'linkedin'];

/**
 * Minimum data confidence to recommend "setup" actions
 */
const MIN_CONFIDENCE_FOR_SETUP = 0.7;

/**
 * Minimum data confidence to recommend "optimize" actions
 */
const MIN_CONFIDENCE_FOR_OPTIMIZE = 0.5;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate Work Item suggestions from a Social Footprint Snapshot
 *
 * Rules:
 * 1. If GBP is MISSING + high confidence → recommend setup
 * 2. If GBP is PRESENT/PROBABLE → recommend optimization
 * 3. If social is MISSING + high confidence + priority network → recommend start
 * 4. If social is PRESENT but low engagement signals → recommend improvement
 * 5. If data confidence is low → add conditional language and skip setup recs
 *
 * @param snapshot - Social footprint detection results
 * @param options - Optional configuration
 * @returns Work item suggestions with skip reasons
 */
export function createSocialLocalWorkItemsFromSnapshot(
  snapshot: SocialFootprintSnapshot,
  options: {
    /** Include recommendations for all networks (not just priority) */
    includeAllNetworks?: boolean;
    /** Business type context for better recommendations */
    businessType?: string;
    /** Include lower-confidence recommendations */
    includeLowConfidence?: boolean;
  } = {}
): CreateSocialWorkItemsResult {
  const { includeAllNetworks = false, businessType, includeLowConfidence = false } = options;
  const { socials, gbp, dataConfidence } = snapshot;

  const suggestions: SocialWorkItemSuggestion[] = [];
  const skipped: CreateSocialWorkItemsResult['skipped'] = [];

  // =========================================================================
  // GBP Work Items
  // =========================================================================

  if (gbp) {
    const gbpItem = generateGbpWorkItem(gbp, dataConfidence, businessType);
    if (gbpItem) {
      suggestions.push(gbpItem);
    } else if (gbp.status === 'missing' && dataConfidence < MIN_CONFIDENCE_FOR_SETUP) {
      skipped.push({
        reason: `GBP setup skipped: data confidence (${Math.round(dataConfidence * 100)}%) below threshold for setup recommendations`,
        network: 'gbp',
      });
    } else if (gbp.status === 'inconclusive') {
      skipped.push({
        reason: 'GBP status inconclusive - manual verification recommended',
        network: 'gbp',
      });
    }
  }

  // =========================================================================
  // Social Network Work Items
  // =========================================================================

  const networksToCheck = includeAllNetworks
    ? socials
    : socials.filter(s => PRIORITY_NETWORKS.includes(s.network));

  for (const social of networksToCheck) {
    const item = generateSocialWorkItem(social, dataConfidence, businessType);
    if (item) {
      suggestions.push(item);
    } else if (social.status === 'missing' && dataConfidence < MIN_CONFIDENCE_FOR_SETUP) {
      skipped.push({
        reason: `${NETWORK_LABELS[social.network]} setup skipped: data confidence too low`,
        network: social.network,
      });
    } else if (social.status === 'inconclusive') {
      skipped.push({
        reason: `${NETWORK_LABELS[social.network]} status inconclusive`,
        network: social.network,
      });
    }
  }

  // =========================================================================
  // Social Expansion Work Item (if few socials active)
  // =========================================================================

  const activeSocials = socials.filter(
    s => s.status === 'present' || s.status === 'probable'
  );

  if (activeSocials.length > 0 && activeSocials.length < 3 && dataConfidence >= MIN_CONFIDENCE_FOR_OPTIMIZE) {
    const inactiveNetworks = socials
      .filter(s => s.status === 'missing' && PRIORITY_NETWORKS.includes(s.network))
      .map(s => NETWORK_LABELS[s.network]);

    if (inactiveNetworks.length > 0) {
      suggestions.push({
        title: `Expand social presence to ${inactiveNetworks.slice(0, 2).join(' and ')}`,
        description: generateExpansionDescription(activeSocials, inactiveNetworks),
        area: 'Brand',
        priority: 'P3',
        triggerType: 'social_expand',
        recommendationConfidence: dataConfidence >= MIN_CONFIDENCE_FOR_SETUP ? 'high' : 'medium',
      });
    }
  }

  // =========================================================================
  // Sort by priority
  // =========================================================================

  suggestions.sort((a, b) => {
    const priorityOrder = { P1: 1, P2: 2, P3: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return {
    suggestions,
    skipped,
    dataConfidence,
  };
}

// ============================================================================
// GBP Work Item Generator
// ============================================================================

function generateGbpWorkItem(
  gbp: GbpPresence,
  dataConfidence: number,
  businessType?: string
): SocialWorkItemSuggestion | null {
  const isLocalBusiness =
    businessType === 'local_business' ||
    businessType === 'brick_and_mortar' ||
    businessType === 'b2c_services';

  // PRESENT or PROBABLE → Optimize
  if (gbp.status === 'present' || gbp.status === 'probable') {
    return {
      title: 'Optimize Google Business Profile for local visibility',
      description: generateGbpOptimizeDescription(gbp, isLocalBusiness),
      area: 'Strategy',
      priority: isLocalBusiness ? 'P1' : 'P2',
      triggerType: 'gbp_optimize',
      recommendationConfidence: 'high',
    };
  }

  // MISSING with high confidence → Setup
  if (gbp.status === 'missing' && dataConfidence >= MIN_CONFIDENCE_FOR_SETUP) {
    return {
      title: 'Set up Google Business Profile for local search visibility',
      description: generateGbpSetupDescription(isLocalBusiness),
      area: 'Strategy',
      priority: isLocalBusiness ? 'P1' : 'P2',
      triggerType: 'gbp_setup',
      recommendationConfidence: 'high',
    };
  }

  // MISSING with medium confidence → Conditional recommendation
  if (gbp.status === 'missing' && dataConfidence >= 0.5) {
    return {
      title: 'Verify GBP status and set up if not already claimed',
      description:
        'Our analysis did not detect a linked Google Business Profile. Before creating one, verify that a profile does not already exist by searching Google Maps for the business name. If no profile exists, claiming and setting up GBP is recommended for local visibility.',
      area: 'Strategy',
      priority: 'P2',
      triggerType: 'gbp_setup',
      recommendationConfidence: 'conditional',
    };
  }

  return null;
}

function generateGbpOptimizeDescription(gbp: GbpPresence, isLocalBusiness: boolean): string {
  const parts = [
    'A Google Business Profile was detected for this business.',
  ];

  if (gbp.confidence >= 0.8) {
    parts.push('The profile appears to be actively linked from the website, which is a good sign.');
  }

  parts.push('\nRecommended optimization actions:');
  parts.push('- Ensure all business information (hours, phone, address) is accurate and up to date');
  parts.push('- Add high-quality photos of the business, products, or services');
  parts.push('- Respond to customer reviews promptly and professionally');
  parts.push('- Post regular updates (weekly) about news, offers, or events');

  if (isLocalBusiness) {
    parts.push('- Add products or services catalog if applicable');
    parts.push('- Enable messaging for direct customer communication');
  }

  return parts.join('\n');
}

function generateGbpSetupDescription(isLocalBusiness: boolean): string {
  const parts = [
    'No Google Business Profile was detected for this business. Setting up GBP provides significant local search visibility benefits.',
  ];

  parts.push('\nSetup steps:');
  parts.push('1. Go to google.com/business and sign in with a Google account');
  parts.push('2. Search for the business to verify it does not already exist');
  parts.push('3. If not found, click "Add your business" and follow the prompts');
  parts.push('4. Complete all required information: name, address, phone, category');
  parts.push('5. Verify ownership (typically via postcard, phone, or email)');
  parts.push('6. Add business hours, photos, and description');

  if (isLocalBusiness) {
    parts.push('\nGBP is especially important for local businesses as it:');
    parts.push('- Appears in Google Maps and local pack results');
    parts.push('- Enables customer reviews and ratings');
    parts.push('- Shows business hours and contact info prominently');
  }

  return parts.join('\n');
}

// ============================================================================
// Social Work Item Generator
// ============================================================================

function generateSocialWorkItem(
  social: SocialPresence,
  dataConfidence: number,
  businessType?: string
): SocialWorkItemSuggestion | null {
  const label = NETWORK_LABELS[social.network];
  const isPriorityNetwork = PRIORITY_NETWORKS.includes(social.network);

  // PRESENT or PROBABLE → Improvement work
  if (social.status === 'present' || social.status === 'probable') {
    // Only suggest improvement for priority networks or high-confidence detections
    if (isPriorityNetwork || social.confidence >= 0.8) {
      return {
        title: `Strengthen ${label} presence and engagement`,
        description: generateSocialImproveDescription(social, label),
        area: 'Content',
        priority: isPriorityNetwork ? 'P2' : 'P3',
        triggerType: 'social_improve',
        recommendationConfidence: 'high',
        network: social.network,
      };
    }
    return null;
  }

  // MISSING with high confidence + priority network → Start recommendation
  if (
    social.status === 'missing' &&
    dataConfidence >= MIN_CONFIDENCE_FOR_SETUP &&
    isPriorityNetwork
  ) {
    return {
      title: `Start ${label} presence for brand visibility`,
      description: generateSocialStartDescription(social.network, label),
      area: 'Brand',
      priority: 'P2',
      triggerType: 'social_start',
      recommendationConfidence: 'high',
      network: social.network,
    };
  }

  // MISSING with medium confidence → Conditional
  if (
    social.status === 'missing' &&
    dataConfidence >= 0.5 &&
    isPriorityNetwork
  ) {
    return {
      title: `Evaluate ${label} for brand presence (if not already active)`,
      description: `Our analysis did not detect a ${label} profile linked from the website. If the business is not yet on ${label}, consider creating a presence there. If a profile already exists but isn't linked, add the link to the website footer.`,
      area: 'Brand',
      priority: 'P3',
      triggerType: 'social_start',
      recommendationConfidence: 'conditional',
      network: social.network,
    };
  }

  return null;
}

function generateSocialImproveDescription(social: SocialPresence, label: string): string {
  const parts = [
    `A ${label} presence was detected for this business (${Math.round(social.confidence * 100)}% confidence).`,
  ];

  if (social.handle) {
    parts.push(`Handle: @${social.handle}`);
  }

  parts.push('\nRecommended improvements:');

  switch (social.network) {
    case 'instagram':
      parts.push('- Post consistently (3-5 times per week minimum)');
      parts.push('- Use relevant hashtags to increase discoverability');
      parts.push('- Engage with followers through Stories and Reels');
      parts.push('- Respond to comments and DMs promptly');
      break;
    case 'facebook':
      parts.push('- Post regularly with a mix of content types');
      parts.push('- Enable and monitor reviews');
      parts.push('- Consider Facebook Ads for local reach');
      parts.push('- Keep business info (hours, contact) updated');
      break;
    case 'linkedin':
      parts.push('- Share industry insights and company updates weekly');
      parts.push('- Engage with other businesses and thought leaders');
      parts.push('- Encourage employees to list the company as employer');
      parts.push('- Complete all company page sections');
      break;
    case 'youtube':
      parts.push('- Maintain consistent upload schedule');
      parts.push('- Optimize video titles and descriptions for search');
      parts.push('- Create playlists to organize content');
      parts.push('- Engage with comments');
      break;
    case 'tiktok':
      parts.push('- Post short-form video content regularly');
      parts.push('- Participate in relevant trends');
      parts.push('- Use trending sounds and hashtags');
      break;
    case 'x':
      parts.push('- Tweet regularly about industry topics');
      parts.push('- Engage with followers and industry conversations');
      parts.push('- Use relevant hashtags');
      break;
  }

  return parts.join('\n');
}

function generateSocialStartDescription(network: SocialNetwork, label: string): string {
  const parts = [
    `No ${label} profile was detected for this business. ${label} can be valuable for brand visibility and customer engagement.`,
    '\nSetup steps:',
  ];

  switch (network) {
    case 'instagram':
      parts.push('1. Create a business Instagram account');
      parts.push('2. Set up the profile with logo, bio, and contact info');
      parts.push('3. Link to the website in bio');
      parts.push('4. Post initial content (5-10 posts before promoting)');
      parts.push('5. Add the Instagram link to the website footer');
      break;
    case 'facebook':
      parts.push('1. Create a Facebook Business Page');
      parts.push('2. Complete all business information sections');
      parts.push('3. Add profile and cover photos');
      parts.push('4. Enable reviews and messaging');
      parts.push('5. Add the Facebook link to the website footer');
      break;
    case 'linkedin':
      parts.push('1. Create a LinkedIn Company Page');
      parts.push('2. Add company overview, logo, and cover image');
      parts.push('3. Invite employees to list as workplace');
      parts.push('4. Post initial company update');
      parts.push('5. Add the LinkedIn link to the website footer');
      break;
    default:
      parts.push(`1. Create a ${label} account for the business`);
      parts.push('2. Complete profile setup with branding');
      parts.push('3. Post initial content');
      parts.push('4. Add the link to the website footer');
  }

  return parts.join('\n');
}

function generateExpansionDescription(
  activeSocials: SocialPresence[],
  inactiveNetworks: string[]
): string {
  const activeNames = activeSocials.map(s => NETWORK_LABELS[s.network]).join(', ');

  return `The business has an active presence on ${activeNames}. Consider expanding to ${inactiveNetworks.join(' and ')} to reach a broader audience and strengthen the digital footprint. Prioritize platforms where the target audience is most active.`;
}

// ============================================================================
// Convert to CreateWorkItemInput
// ============================================================================

/**
 * Convert a suggestion to CreateWorkItemInput for Airtable
 */
export function suggestionToCreateInput(
  suggestion: SocialWorkItemSuggestion,
  companyId: string
): CreateWorkItemInput {
  return {
    companyId,
    title: suggestion.title,
    description: suggestion.description,
    area: suggestion.area,
    priority: suggestion.priority,
    status: 'Backlog',
    sourceType: 'gap_insight',
  };
}

/**
 * Create multiple work items from suggestions
 */
export function suggestionsToCreateInputs(
  suggestions: SocialWorkItemSuggestion[],
  companyId: string
): CreateWorkItemInput[] {
  return suggestions.map(s => suggestionToCreateInput(s, companyId));
}
