// lib/os/briefs/resolveBriefType.ts
// Brief type resolver - determines the appropriate BriefType based on engagement/project context
//
// RULES (initial):
// - projectType includes "Print" or "Ad" => "creative"
// - "SEO" => "seo"
// - "Content" => "content"
// - "Website" => "website"
// - fallback => "campaign" (project) or "program" (company/engagement)

import type { BriefType } from '@/lib/types/brief';

export type EngagementType = 'retainer' | 'project';

export interface ResolveBriefTypeInput {
  engagementType?: EngagementType;
  projectType?: string;
  projectName?: string;
}

/**
 * Resolve the appropriate BriefType based on engagement and project context
 *
 * @param input - Context for resolution
 * @returns The resolved BriefType
 */
export function resolveBriefType(input: ResolveBriefTypeInput): BriefType {
  const { engagementType, projectType, projectName } = input;

  // Combine projectType and projectName for pattern matching
  const searchText = [projectType, projectName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Rule 1: Print/Ad patterns => creative
  if (
    searchText.includes('print') ||
    searchText.includes(' ad') ||
    searchText.includes('ad ') ||
    searchText.endsWith(' ad') ||
    searchText === 'ad' ||
    searchText.includes('advertisement') ||
    searchText.includes('creative')
  ) {
    return 'creative';
  }

  // Rule 2: SEO patterns => seo
  if (searchText.includes('seo') || searchText.includes('search engine')) {
    return 'seo';
  }

  // Rule 3: Content patterns => content
  if (
    searchText.includes('content') ||
    searchText.includes('blog') ||
    searchText.includes('article') ||
    searchText.includes('editorial')
  ) {
    return 'content';
  }

  // Rule 4: Website patterns => website
  if (
    searchText.includes('website') ||
    searchText.includes('web site') ||
    searchText.includes('landing page') ||
    searchText.includes('microsite')
  ) {
    return 'website';
  }

  // Rule 5: Campaign patterns => campaign
  if (
    searchText.includes('campaign') ||
    searchText.includes('launch') ||
    searchText.includes('promotion')
  ) {
    return 'campaign';
  }

  // Fallback based on engagement type
  if (engagementType === 'retainer') {
    // Retainer engagements use program briefs (ongoing work)
    return 'program';
  }

  // Project engagements default to campaign
  return 'campaign';
}

/**
 * Get a human-readable label for a BriefType
 */
export function getBriefTypeLabel(type: BriefType): string {
  const labels: Record<BriefType, string> = {
    creative: 'Creative Brief',
    campaign: 'Campaign Brief',
    seo: 'SEO Brief',
    content: 'Content Brief',
    website: 'Website Brief',
    program: 'Program Brief',
  };
  return labels[type] || 'Brief';
}

/**
 * Get a description for a BriefType
 */
export function getBriefTypeDescription(type: BriefType): string {
  const descriptions: Record<BriefType, string> = {
    creative:
      'For print ads, display ads, and creative assets with specific visual and copy requirements.',
    campaign:
      'For multi-channel marketing campaigns with coordinated messaging and tactics.',
    seo: 'For search engine optimization initiatives with keyword targeting and technical requirements.',
    content:
      'For content marketing programs with editorial calendars and distribution strategies.',
    website:
      'For website projects with user flows, IA requirements, and conversion goals.',
    program:
      'For ongoing marketing programs with continuous optimization and iteration.',
  };
  return descriptions[type] || 'Marketing brief for strategic alignment.';
}
