// lib/constants/conversionActions.ts
// Canonical Primary Conversion Actions for Hive OS
//
// This is the SINGLE SOURCE OF TRUTH for conversion action definitions.
// Used across Context gating, attribution, insights, and strategy logic.

// ============================================================================
// Types
// ============================================================================

/**
 * Business model categories for conversion actions
 */
export type ConversionActionCategory =
  | 'saas'
  | 'services'
  | 'ecommerce'
  | 'content'
  | 'marketplace'
  | 'other';

/**
 * Definition of a canonical conversion action
 */
export interface ConversionActionDefinition {
  /** Stable, machine-safe key (snake_case) */
  key: string;
  /** User-facing label */
  label: string;
  /** Business model category */
  category: ConversionActionCategory;
  /** Short explanation of what this action means */
  description: string;
  /** Optional examples of how this might appear */
  examples?: string[];
  /** Optional GA4-style tracking hints */
  recommendedTracking?: string[];
}

// ============================================================================
// Canonical Conversion Actions
// ============================================================================

/**
 * Canonical list of primary conversion actions, grouped by business model.
 *
 * Order: SaaS → Services → Ecommerce → Content → Marketplace → Other
 */
export const CANONICAL_CONVERSION_ACTIONS: ConversionActionDefinition[] = [
  // ============================================================================
  // SaaS
  // ============================================================================
  {
    key: 'book_demo',
    label: 'Book a demo',
    category: 'saas',
    description: 'User schedules time with sales to see the product',
    examples: ['Schedule a demo', 'Get a personalized demo'],
    recommendedTracking: ['generate_lead', 'schedule_demo'],
  },
  {
    key: 'start_free_trial',
    label: 'Start free trial',
    category: 'saas',
    description: 'User creates a trial account to evaluate the product',
    examples: ['Try for free', 'Start 14-day trial'],
    recommendedTracking: ['sign_up', 'start_trial'],
  },
  {
    key: 'sign_up',
    label: 'Sign up',
    category: 'saas',
    description: 'User creates an account (freemium or gated)',
    examples: ['Create account', 'Get started free'],
    recommendedTracking: ['sign_up'],
  },
  {
    key: 'add_payment_method',
    label: 'Add payment method',
    category: 'saas',
    description: 'User adds billing info to activate paid features',
    examples: ['Add card', 'Enter billing details'],
    recommendedTracking: ['add_payment_info'],
  },
  {
    key: 'upgrade_subscription',
    label: 'Upgrade subscription',
    category: 'saas',
    description: 'User moves from free/trial to a paid tier',
    examples: ['Upgrade to Pro', 'Go premium'],
    recommendedTracking: ['purchase', 'upgrade'],
  },

  // ============================================================================
  // Services / B2B
  // ============================================================================
  {
    key: 'request_quote',
    label: 'Request a quote',
    category: 'services',
    description: 'User requests pricing for a custom solution',
    examples: ['Get a quote', 'Request pricing'],
    recommendedTracking: ['generate_lead', 'request_quote'],
  },
  {
    key: 'book_consultation',
    label: 'Book a consultation',
    category: 'services',
    description: 'User schedules a discovery or strategy call',
    examples: ['Schedule a call', 'Book free consultation'],
    recommendedTracking: ['generate_lead', 'schedule_consultation'],
  },
  {
    key: 'submit_lead_form',
    label: 'Submit lead form',
    category: 'services',
    description: 'User submits contact information for follow-up',
    examples: ['Contact us', 'Get in touch'],
    recommendedTracking: ['generate_lead', 'form_submit'],
  },
  {
    key: 'call_sales',
    label: 'Call sales',
    category: 'services',
    description: 'User initiates a phone call to sales team',
    examples: ['Call now', 'Speak to an expert'],
    recommendedTracking: ['generate_lead', 'click_to_call'],
  },
  {
    key: 'schedule_assessment',
    label: 'Schedule assessment',
    category: 'services',
    description: 'User books a diagnostic or audit session',
    examples: ['Get your free assessment', 'Book an audit'],
    recommendedTracking: ['generate_lead', 'schedule_assessment'],
  },

  // ============================================================================
  // Ecommerce
  // ============================================================================
  {
    key: 'complete_purchase',
    label: 'Complete purchase',
    category: 'ecommerce',
    description: 'User completes a transaction',
    examples: ['Buy now', 'Complete order'],
    recommendedTracking: ['purchase'],
  },
  {
    key: 'checkout',
    label: 'Checkout',
    category: 'ecommerce',
    description: 'User proceeds through checkout flow',
    examples: ['Proceed to checkout', 'Pay now'],
    recommendedTracking: ['begin_checkout', 'purchase'],
  },
  {
    key: 'add_to_cart',
    label: 'Add to cart',
    category: 'ecommerce',
    description: 'User adds item to cart (not recommended as primary)',
    examples: ['Add to bag', 'Add to basket'],
    recommendedTracking: ['add_to_cart'],
  },
  {
    key: 'begin_checkout',
    label: 'Begin checkout',
    category: 'ecommerce',
    description: 'User starts the checkout process',
    examples: ['Start checkout', 'Continue to payment'],
    recommendedTracking: ['begin_checkout'],
  },

  // ============================================================================
  // Content / Lead Gen
  // ============================================================================
  {
    key: 'download_lead_magnet',
    label: 'Download resource',
    category: 'content',
    description: 'User downloads a gated content asset',
    examples: ['Download ebook', 'Get the guide', 'Download whitepaper'],
    recommendedTracking: ['generate_lead', 'file_download'],
  },
  {
    key: 'newsletter_signup',
    label: 'Newsletter signup',
    category: 'content',
    description: 'User subscribes to email updates',
    examples: ['Subscribe', 'Join our newsletter'],
    recommendedTracking: ['sign_up', 'newsletter_subscribe'],
  },
  {
    key: 'register_webinar',
    label: 'Register for webinar',
    category: 'content',
    description: 'User registers for a live or recorded webinar',
    examples: ['Register now', 'Save your spot'],
    recommendedTracking: ['generate_lead', 'webinar_register'],
  },

  // ============================================================================
  // Marketplace / Platform
  // ============================================================================
  {
    key: 'create_listing',
    label: 'Create listing',
    category: 'marketplace',
    description: 'User creates a listing on the platform',
    examples: ['List your property', 'Create a listing'],
    recommendedTracking: ['sign_up', 'create_listing'],
  },
  {
    key: 'request_match',
    label: 'Request match',
    category: 'marketplace',
    description: 'User requests to be matched with a provider',
    examples: ['Find a match', 'Get matched'],
    recommendedTracking: ['generate_lead', 'request_match'],
  },
  {
    key: 'book_provider',
    label: 'Book provider',
    category: 'marketplace',
    description: 'User books a service provider through the platform',
    examples: ['Book now', 'Reserve'],
    recommendedTracking: ['purchase', 'book_provider'],
  },
  {
    key: 'post_job',
    label: 'Post job',
    category: 'marketplace',
    description: 'User posts a job or project for providers',
    examples: ['Post a job', 'Hire a pro'],
    recommendedTracking: ['sign_up', 'post_job'],
  },

  // ============================================================================
  // Other / Fallback
  // ============================================================================
  {
    key: 'custom',
    label: 'Other (custom)',
    category: 'other',
    description: 'User-defined conversion action not in the standard list',
    examples: [],
  },
];

// ============================================================================
// Lookup Maps (pre-computed for performance)
// ============================================================================

/** Map of key to ConversionActionDefinition */
const ACTION_BY_KEY = new Map<string, ConversionActionDefinition>(
  CANONICAL_CONVERSION_ACTIONS.map(action => [action.key, action])
);

/** Map of category to ConversionActionDefinition[] */
const ACTIONS_BY_CATEGORY = CANONICAL_CONVERSION_ACTIONS.reduce(
  (acc, action) => {
    if (!acc.has(action.category)) {
      acc.set(action.category, []);
    }
    acc.get(action.category)!.push(action);
    return acc;
  },
  new Map<ConversionActionCategory, ConversionActionDefinition[]>()
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all conversion actions for a specific category
 */
export function getConversionActionsByCategory(
  category: ConversionActionCategory
): ConversionActionDefinition[] {
  return ACTIONS_BY_CATEGORY.get(category) || [];
}

/**
 * Get all conversion actions (full list)
 */
export function getAllConversionActions(): ConversionActionDefinition[] {
  return [...CANONICAL_CONVERSION_ACTIONS];
}

/**
 * Get the label for a conversion action key
 * Returns the key itself if not found (graceful fallback for custom values)
 */
export function getConversionActionLabel(key: string): string {
  const action = ACTION_BY_KEY.get(key);
  if (action) return action.label;

  // Graceful fallback: convert snake_case to Title Case
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the full definition for a conversion action key
 */
export function getConversionAction(
  key: string
): ConversionActionDefinition | undefined {
  return ACTION_BY_KEY.get(key);
}

/**
 * Check if a key is a known canonical conversion action
 */
export function isCanonicalConversionAction(key: string): boolean {
  return ACTION_BY_KEY.has(key);
}

/**
 * Get category display order (for UI grouping)
 */
export const CATEGORY_ORDER: ConversionActionCategory[] = [
  'saas',
  'services',
  'ecommerce',
  'content',
  'marketplace',
  'other',
];

/**
 * Category labels for UI display
 */
export const CATEGORY_LABELS: Record<ConversionActionCategory, string> = {
  saas: 'SaaS',
  services: 'Services / B2B',
  ecommerce: 'Ecommerce',
  content: 'Content / Lead Gen',
  marketplace: 'Marketplace / Platform',
  other: 'Other',
};
