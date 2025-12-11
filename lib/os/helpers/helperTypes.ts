// lib/os/helpers/helperTypes.ts
// Types for AI Execution Helpers
// Guided mini-wizards for common tasks

// ============================================================================
// Core Helper Types
// ============================================================================

export type HelperCategory =
  | 'seo'
  | 'content'
  | 'gbp'
  | 'brand'
  | 'technical'
  | 'social'
  | 'analytics';

export type HelperDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

// ============================================================================
// Helper Definition
// ============================================================================

export interface Helper {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Category */
  category: HelperCategory;
  /** Difficulty level */
  difficulty: HelperDifficulty;
  /** Estimated time to complete */
  estimatedMinutes: number;
  /** Icon name (lucide icon) */
  icon: string;
  /** Prerequisites */
  prerequisites: string[];
  /** Steps in the wizard */
  steps: HelperStep[];
  /** Expected outcomes */
  expectedOutcomes: string[];
  /** Related lab slug */
  relatedLab?: string;
  /** Tags for filtering */
  tags: string[];
}

export interface HelperStep {
  /** Step ID */
  id: string;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Step type */
  type: StepType;
  /** Configuration for the step */
  config: StepConfig;
  /** Is this step optional */
  optional?: boolean;
  /** Help text or tips */
  helpText?: string;
  /** Action to perform when complete */
  completionAction?: CompletionAction;
}

export type StepType =
  | 'info'              // Information display
  | 'checklist'         // Checklist of items
  | 'form'              // Form input
  | 'ai_generate'       // AI generates content
  | 'review'            // Review AI output
  | 'action'            // User takes action externally
  | 'diagnostic';       // Run a diagnostic

export interface StepConfig {
  // For info type
  content?: string;
  bullets?: string[];

  // For checklist type
  items?: ChecklistItem[];

  // For form type
  fields?: FormField[];

  // For ai_generate type
  prompt?: string;
  outputType?: 'text' | 'list' | 'suggestions';

  // For action type
  actionLabel?: string;
  actionLink?: string;

  // For diagnostic type
  labSlug?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'url' | 'number';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: string;
}

export interface CompletionAction {
  type: 'navigate' | 'api_call' | 'download' | 'copy';
  target?: string;
  payload?: Record<string, unknown>;
}

// ============================================================================
// Helper Session Types
// ============================================================================

export interface HelperSession {
  /** Session ID */
  id: string;
  /** Helper ID */
  helperId: string;
  /** Company ID */
  companyId: string;
  /** Started at */
  startedAt: string;
  /** Completed at */
  completedAt?: string;
  /** Current step index */
  currentStep: number;
  /** Step statuses */
  stepStatuses: Record<string, StepStatus>;
  /** Collected data */
  data: Record<string, unknown>;
  /** AI-generated outputs */
  outputs: Record<string, string>;
}

// ============================================================================
// Helper Library
// ============================================================================

export const HELPER_LIBRARY: Helper[] = [
  // SEO Helpers
  {
    id: 'fix-seo-basics',
    name: 'Fix My SEO Basics',
    description: 'Quickly improve your basic SEO setup with guided steps',
    category: 'seo',
    difficulty: 'beginner',
    estimatedMinutes: 15,
    icon: 'Search',
    prerequisites: [],
    steps: [
      {
        id: 'intro',
        title: 'SEO Basics Overview',
        description: 'What we\'ll fix in this session',
        type: 'info',
        config: {
          content: 'This helper will guide you through fixing the most common SEO issues that affect your search visibility.',
          bullets: [
            'Title tag optimization',
            'Meta description improvements',
            'Header structure fixes',
            'Basic technical SEO checks',
          ],
        },
      },
      {
        id: 'title-audit',
        title: 'Title Tag Audit',
        description: 'Check your page titles',
        type: 'checklist',
        config: {
          items: [
            { id: 'title-length', label: 'Titles are 50-60 characters', required: true },
            { id: 'title-keywords', label: 'Titles include target keywords', required: true },
            { id: 'title-unique', label: 'Each page has a unique title', required: true },
            { id: 'title-brand', label: 'Brand name is in the title', required: false },
          ],
        },
      },
      {
        id: 'meta-descriptions',
        title: 'Meta Description Review',
        description: 'Optimize your meta descriptions',
        type: 'form',
        config: {
          fields: [
            {
              id: 'homepage_meta',
              label: 'Homepage meta description',
              type: 'textarea',
              placeholder: 'Enter a compelling 150-160 character description...',
              required: true,
            },
            {
              id: 'focus_keyword',
              label: 'Primary keyword to target',
              type: 'text',
              placeholder: 'e.g., plumber in Austin',
              required: true,
            },
          ],
        },
      },
      {
        id: 'ai-suggestions',
        title: 'AI-Generated Improvements',
        description: 'Get AI suggestions for your SEO',
        type: 'ai_generate',
        config: {
          prompt: 'Generate 5 SEO improvement suggestions based on the provided keyword and description',
          outputType: 'suggestions',
        },
      },
      {
        id: 'implementation',
        title: 'Implement Changes',
        description: 'Apply the improvements to your site',
        type: 'action',
        config: {
          actionLabel: 'Go to Website Settings',
          actionLink: '/settings/website',
        },
        helpText: 'Copy the suggestions above and implement them in your website CMS',
      },
    ],
    expectedOutcomes: [
      'Optimized title tags',
      'Improved meta descriptions',
      'Better search visibility',
    ],
    relatedLab: 'rankings',
    tags: ['seo', 'basics', 'quick-win'],
  },

  // GBP Helpers
  {
    id: 'optimize-gbp',
    name: 'Optimize My Google Business Profile',
    description: 'Complete your GBP setup for maximum local visibility',
    category: 'gbp',
    difficulty: 'beginner',
    estimatedMinutes: 20,
    icon: 'MapPin',
    prerequisites: ['Google Business Profile access'],
    steps: [
      {
        id: 'intro',
        title: 'GBP Optimization Overview',
        description: 'What we\'ll optimize',
        type: 'info',
        config: {
          content: 'A complete Google Business Profile can get up to 7x more clicks. Let\'s make sure yours is optimized.',
          bullets: [
            'Business information completeness',
            'Category selection',
            'Photos and media',
            'Posts and updates',
            'Review management',
          ],
        },
      },
      {
        id: 'business-info',
        title: 'Business Information Check',
        description: 'Verify your business details',
        type: 'checklist',
        config: {
          items: [
            { id: 'name-accurate', label: 'Business name is accurate', required: true },
            { id: 'address-complete', label: 'Address is complete and correct', required: true },
            { id: 'phone-verified', label: 'Phone number is verified', required: true },
            { id: 'hours-set', label: 'Business hours are set', required: true },
            { id: 'website-linked', label: 'Website is linked', required: true },
            { id: 'description-filled', label: 'Business description is filled', required: true },
          ],
        },
      },
      {
        id: 'categories',
        title: 'Category Selection',
        description: 'Choose the right categories',
        type: 'form',
        config: {
          fields: [
            {
              id: 'primary_category',
              label: 'Primary category',
              type: 'text',
              placeholder: 'e.g., Plumber, Restaurant, Dentist',
              required: true,
            },
            {
              id: 'secondary_categories',
              label: 'Secondary categories (comma separated)',
              type: 'text',
              placeholder: 'e.g., Emergency Plumber, Water Heater Repair',
            },
          ],
        },
      },
      {
        id: 'photos-check',
        title: 'Photos & Media',
        description: 'Add photos to your profile',
        type: 'checklist',
        config: {
          items: [
            { id: 'logo', label: 'Logo uploaded', required: true },
            { id: 'cover', label: 'Cover photo added', required: true },
            { id: 'exterior', label: 'Exterior photos (3+)', required: true },
            { id: 'interior', label: 'Interior photos (3+)', required: false },
            { id: 'team', label: 'Team photos', required: false },
            { id: 'products', label: 'Product/service photos', required: false },
          ],
        },
      },
      {
        id: 'apply-changes',
        title: 'Apply Changes',
        description: 'Update your Google Business Profile',
        type: 'action',
        config: {
          actionLabel: 'Open Google Business Profile',
          actionLink: 'https://business.google.com',
        },
      },
    ],
    expectedOutcomes: [
      'Complete GBP profile',
      'Better local search rankings',
      'More customer trust',
    ],
    relatedLab: 'gbp',
    tags: ['gbp', 'local', 'basics'],
  },

  // Content Helper
  {
    id: 'improve-homepage',
    name: 'Improve My Homepage Content',
    description: 'Optimize your homepage for better engagement and conversions',
    category: 'content',
    difficulty: 'intermediate',
    estimatedMinutes: 30,
    icon: 'FileText',
    prerequisites: [],
    steps: [
      {
        id: 'intro',
        title: 'Homepage Content Overview',
        description: 'What makes a great homepage',
        type: 'info',
        config: {
          content: 'Your homepage is often the first impression. Let\'s make sure it clearly communicates your value and guides visitors to action.',
          bullets: [
            'Clear value proposition',
            'Compelling headlines',
            'Trust signals',
            'Clear calls to action',
          ],
        },
      },
      {
        id: 'current-analysis',
        title: 'Current Homepage Analysis',
        description: 'Assess your current homepage',
        type: 'form',
        config: {
          fields: [
            {
              id: 'homepage_url',
              label: 'Your homepage URL',
              type: 'url',
              placeholder: 'https://yourwebsite.com',
              required: true,
            },
            {
              id: 'main_service',
              label: 'Primary service/product',
              type: 'text',
              placeholder: 'e.g., Residential plumbing services',
              required: true,
            },
            {
              id: 'target_audience',
              label: 'Target audience',
              type: 'text',
              placeholder: 'e.g., Homeowners in Austin, TX',
              required: true,
            },
            {
              id: 'unique_selling_point',
              label: 'What makes you different?',
              type: 'textarea',
              placeholder: 'Your unique value proposition...',
              required: true,
            },
          ],
        },
      },
      {
        id: 'ai-headlines',
        title: 'AI-Generated Headlines',
        description: 'Get compelling headline suggestions',
        type: 'ai_generate',
        config: {
          prompt: 'Generate 5 compelling homepage headline options based on the service, audience, and unique selling point provided',
          outputType: 'suggestions',
        },
      },
      {
        id: 'content-checklist',
        title: 'Homepage Content Checklist',
        description: 'Verify essential elements',
        type: 'checklist',
        config: {
          items: [
            { id: 'headline', label: 'Clear headline above the fold', required: true },
            { id: 'subheadline', label: 'Supporting subheadline', required: true },
            { id: 'cta-visible', label: 'CTA button visible without scrolling', required: true },
            { id: 'services', label: 'Services/products clearly listed', required: true },
            { id: 'trust-signals', label: 'Trust signals (reviews, badges, etc.)', required: true },
            { id: 'contact-info', label: 'Contact information visible', required: true },
          ],
        },
      },
      {
        id: 'implement',
        title: 'Implement Improvements',
        description: 'Apply the changes to your homepage',
        type: 'action',
        config: {
          actionLabel: 'Copy suggestions and update your site',
        },
        helpText: 'Use the AI-generated headlines and checklist to improve your homepage content',
      },
    ],
    expectedOutcomes: [
      'Clearer value proposition',
      'Better engagement metrics',
      'Improved conversion rates',
    ],
    relatedLab: 'content',
    tags: ['content', 'homepage', 'conversions'],
  },

  // Brand Helper
  {
    id: 'brand-consistency-check',
    name: 'Brand Consistency Check',
    description: 'Ensure your brand is consistent across all channels',
    category: 'brand',
    difficulty: 'beginner',
    estimatedMinutes: 15,
    icon: 'Palette',
    prerequisites: [],
    steps: [
      {
        id: 'intro',
        title: 'Why Brand Consistency Matters',
        description: 'The importance of a unified brand',
        type: 'info',
        config: {
          content: 'Consistent branding increases revenue by up to 23%. Let\'s check if your brand is consistent across all touchpoints.',
          bullets: [
            'Logo usage consistency',
            'Color palette adherence',
            'Messaging alignment',
            'Contact information accuracy',
          ],
        },
      },
      {
        id: 'brand-basics',
        title: 'Brand Basics Check',
        description: 'Verify your core brand elements',
        type: 'checklist',
        config: {
          items: [
            { id: 'logo-same', label: 'Same logo on all platforms', required: true },
            { id: 'colors-match', label: 'Colors match across channels', required: true },
            { id: 'name-consistent', label: 'Business name spelled consistently', required: true },
            { id: 'tagline-same', label: 'Tagline is the same everywhere', required: false },
          ],
        },
      },
      {
        id: 'platform-check',
        title: 'Platform Consistency',
        description: 'Check each platform',
        type: 'checklist',
        config: {
          items: [
            { id: 'website', label: 'Website matches brand guidelines', required: true },
            { id: 'gbp', label: 'Google Business Profile is on-brand', required: true },
            { id: 'facebook', label: 'Facebook page is consistent', required: false },
            { id: 'instagram', label: 'Instagram profile matches', required: false },
            { id: 'linkedin', label: 'LinkedIn is up to date', required: false },
          ],
        },
      },
      {
        id: 'run-diagnostic',
        title: 'Run Brand Diagnostic',
        description: 'Get a detailed brand analysis',
        type: 'diagnostic',
        config: {
          labSlug: 'brand',
        },
        optional: true,
      },
    ],
    expectedOutcomes: [
      'Consistent brand presence',
      'Improved brand recognition',
      'Professional appearance',
    ],
    relatedLab: 'brand',
    tags: ['brand', 'consistency', 'quick-check'],
  },

  // Technical Helper
  {
    id: 'speed-optimization',
    name: 'Quick Speed Wins',
    description: 'Find and fix easy website speed improvements',
    category: 'technical',
    difficulty: 'intermediate',
    estimatedMinutes: 25,
    icon: 'Zap',
    prerequisites: ['Website access'],
    steps: [
      {
        id: 'intro',
        title: 'Speed Matters',
        description: 'Why site speed is critical',
        type: 'info',
        config: {
          content: 'A 1-second delay in page load time can result in 7% loss in conversions. Let\'s find quick wins to speed up your site.',
          bullets: [
            'Image optimization',
            'Caching configuration',
            'Script optimization',
            'Core Web Vitals',
          ],
        },
      },
      {
        id: 'current-speed',
        title: 'Current Speed Check',
        description: 'Enter your site for analysis',
        type: 'form',
        config: {
          fields: [
            {
              id: 'website_url',
              label: 'Your website URL',
              type: 'url',
              placeholder: 'https://yourwebsite.com',
              required: true,
            },
          ],
        },
      },
      {
        id: 'run-diagnostic',
        title: 'Run Speed Diagnostic',
        description: 'Analyze your site speed',
        type: 'diagnostic',
        config: {
          labSlug: 'website',
        },
      },
      {
        id: 'quick-fixes',
        title: 'Quick Fix Checklist',
        description: 'Common speed improvements',
        type: 'checklist',
        config: {
          items: [
            { id: 'images', label: 'Images are compressed and properly sized', required: true },
            { id: 'caching', label: 'Browser caching is enabled', required: true },
            { id: 'minify', label: 'CSS and JS are minified', required: false },
            { id: 'lazy-load', label: 'Images use lazy loading', required: false },
            { id: 'cdn', label: 'Using a CDN for static assets', required: false },
          ],
        },
      },
      {
        id: 'pagespeed',
        title: 'Check PageSpeed Insights',
        description: 'Get Google\'s speed recommendations',
        type: 'action',
        config: {
          actionLabel: 'Open PageSpeed Insights',
          actionLink: 'https://pagespeed.web.dev/',
        },
      },
    ],
    expectedOutcomes: [
      'Faster page load times',
      'Better Core Web Vitals',
      'Improved user experience',
    ],
    relatedLab: 'website',
    tags: ['technical', 'speed', 'performance'],
  },
];

// ============================================================================
// Helper Lookup Functions
// ============================================================================

export function getHelperById(id: string): Helper | undefined {
  return HELPER_LIBRARY.find(h => h.id === id);
}

export function getHelpersByCategory(category: HelperCategory): Helper[] {
  return HELPER_LIBRARY.filter(h => h.category === category);
}

export function getHelpersByTag(tag: string): Helper[] {
  return HELPER_LIBRARY.filter(h => h.tags.includes(tag));
}

export function getHelpersByDifficulty(difficulty: HelperDifficulty): Helper[] {
  return HELPER_LIBRARY.filter(h => h.difficulty === difficulty);
}

export function searchHelpers(query: string): Helper[] {
  const lowerQuery = query.toLowerCase();
  return HELPER_LIBRARY.filter(h =>
    h.name.toLowerCase().includes(lowerQuery) ||
    h.description.toLowerCase().includes(lowerQuery) ||
    h.tags.some(t => t.includes(lowerQuery))
  );
}
