// lib/analytics/funnels/trainrhub.ts
// ============================================================================
// TrainrHub-Specific Funnel Definitions
// ============================================================================
//
// These are business funnels specific to TrainrHub's marketplace model:
// - Trainer Acquisition: Getting trainers signed up and verified
// - Demand/Contacts: People looking for trainers taking contact actions

import type { FunnelStep } from '@/components/analytics/StandardFunnelPanel';

// ============================================================================
// Types
// ============================================================================

export type TrainrhubFunnelKey = 'trainer_acquisition' | 'demand_contacts';

export interface TrainrhubFunnelStepDefinition {
  id: string;
  label: string;
  /** GA4 event name(s) that represent this step */
  events: string[];
  /** Optional page path patterns to match (for page_view events) */
  pathPatterns?: string[];
  /** Mark as primary/goal step */
  isPrimary?: boolean;
}

export interface TrainrhubFunnelDefinition {
  key: TrainrhubFunnelKey;
  name: string;
  description: string;
  steps: TrainrhubFunnelStepDefinition[];
}

export interface TrainrhubFunnelMetrics {
  key: TrainrhubFunnelKey;
  name: string;
  description: string;
  steps: FunnelStep[];
  overallConversionRate: number | null;
  totalSessions: number | null;
  hasData: boolean;
}

// ============================================================================
// TrainrHub Funnel Definitions
// ============================================================================

/**
 * TrainrHub-specific funnels
 * These track the two key journeys on the platform:
 * 1. Trainer Acquisition - trainers signing up to be verified
 * 2. Demand/Contacts - people looking for trainers and taking action
 */
export const TRAINRHUB_FUNNELS: TrainrhubFunnelDefinition[] = [
  {
    key: 'trainer_acquisition',
    name: 'Trainer Acquisition Funnel',
    description: 'Getting trainers verified and active on TrainrHub.',
    steps: [
      {
        id: 'landing',
        label: 'Trainer landing views',
        events: ['page_view'],
        pathPatterns: ['/for-trainers', '/trainer', '/become-a-trainer', '/join'],
      },
      {
        id: 'get_started_click',
        label: 'Get Started clicks',
        events: ['trainer_get_started_click', 'cta_click', 'click'],
      },
      {
        id: 'signup_started',
        label: 'Signup started',
        events: ['trainer_signup_start', 'sign_up', 'begin_checkout'],
      },
      {
        id: 'signup_completed',
        label: 'Verified trainer signups',
        events: ['trainer_signup_complete', 'sign_up_complete', 'purchase'],
        isPrimary: true,
      },
    ],
  },
  {
    key: 'demand_contacts',
    name: 'Trainer Demand & Contact Funnel',
    description: 'People looking for a trainer taking contact actions.',
    steps: [
      {
        id: 'browse_trainers',
        label: 'Find a Trainer / directory views',
        events: ['page_view'],
        pathPatterns: ['/trainers', '/find-a-trainer', '/search', '/directory'],
      },
      {
        id: 'profile_views',
        label: 'Trainer profile views',
        events: ['page_view', 'trainer_profile_view'],
        pathPatterns: ['/trainer/', '/profile/'],
      },
      {
        id: 'book_consult',
        label: 'Book Free Consultation clicks',
        events: ['trainer_book_consult_click', 'book_consultation', 'schedule_demo'],
      },
      {
        id: 'call_click',
        label: 'Call button clicks',
        events: ['trainer_call_click', 'phone_call', 'click_to_call'],
      },
      {
        id: 'message_click',
        label: 'Message button clicks',
        events: ['trainer_message_click', 'contact_form_submit', 'message_sent'],
        isPrimary: true,
      },
    ],
  },
];

// ============================================================================
// Helper to check if a company should use TrainrHub funnels
// ============================================================================

/**
 * Check if the company should use TrainrHub-specific funnels
 * Matches by company name or domain
 */
export function isTrainrhubCompany(
  companyName?: string,
  domain?: string
): boolean {
  const name = companyName?.toLowerCase() || '';
  const site = domain?.toLowerCase() || '';

  return (
    name.includes('trainrhub') ||
    name.includes('trainerhub') ||
    name.includes('trainer hub') ||
    site.includes('trainrhub.com') ||
    site.includes('trainerhub.com')
  );
}

/**
 * Get funnel definitions for a company
 * Returns TrainrHub-specific funnels if applicable, otherwise null
 */
export function getTrainrhubFunnelDefinitions(
  companyName?: string,
  domain?: string
): TrainrhubFunnelDefinition[] | null {
  if (isTrainrhubCompany(companyName, domain)) {
    return TRAINRHUB_FUNNELS;
  }
  return null;
}
