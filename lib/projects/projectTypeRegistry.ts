// lib/projects/projectTypeRegistry.ts
// Project Type Registry - Central Configuration for Delivery Projects
//
// This registry defines all delivery project types in a config-driven manner.
// Adding a new project type requires only a registry entry - no code changes.
//
// Key principles:
// - Delivery ≠ Diagnosis (this is for execution projects, not audits/labs)
// - Config-driven (no per-project hardcoding)
// - Single source of truth for wizard behavior

import type { FlowType } from '@/lib/os/flow/readiness.shared';
import type { DomainKey } from '@/lib/os/context/domainAuthority';
import type { LabId } from '@/lib/contextGraph/labContext';
import type { RefinementLabId } from '@/lib/labs/refinementTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * Project category for grouping in the wizard UI
 */
export type ProjectCategory =
  | 'website'
  | 'brand'
  | 'seo'
  | 'content'
  | 'media'
  | 'analytics'
  | 'creative';

/**
 * Brief field types for the project brief wizard step
 */
export type BriefFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date';

/**
 * Configuration for a brief input field
 */
export interface BriefFieldConfig {
  /** Unique field key */
  key: string;
  /** Display label */
  label: string;
  /** Field type */
  type: BriefFieldType;
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below the field */
  helpText?: string;
  /** Whether this field is required */
  required: boolean;
  /** Options for select/multiselect fields */
  options?: Array<{ value: string; label: string }>;
  /** Default value */
  defaultValue?: unknown;
}

/**
 * Generator keys for project-specific AI generation
 */
export type ProjectGeneratorKey =
  | 'website_optimization'
  | 'website_new'
  | 'seo_fix'
  | 'content_strategy'
  | 'paid_search'
  | 'analytics_setup'
  | 'creative_system'
  | 'generic';

/**
 * Full configuration for a project type
 */
export interface ProjectTypeConfig {
  /** Unique key for this project type */
  key: string;
  /** Category for grouping in UI */
  category: ProjectCategory;
  /** Display label */
  label: string;
  /** Short description for selection cards */
  description: string;
  /** Icon name (lucide icon key) */
  icon: string;

  // Delivery semantics
  /** Flow type used by readiness checks */
  flowType: FlowType;
  /** Critical domains required for this flow */
  requiredDomains: DomainKey[];
  /** Labs recommended for refresh_context path (user-driven) */
  recommendedLabs: LabId[];
  /**
   * Context boosters: Labs that auto-run before brief generation.
   * These run without user interaction to ground briefs in fresh diagnostic data.
   * Rules:
   * - Only run when generating a brief
   * - Never require user interaction
   * - Respect humanConfirmed + authority rules (no overwrites)
   * - Only update lab-owned domains
   *
   * Valid labs: audience, brand, creative, competitor, website
   */
  contextBoosters?: RefinementLabId[];

  // Wizard behavior
  /** Brief fields to collect */
  briefFields: BriefFieldConfig[];
  /** Generator to use for AI output */
  generator: ProjectGeneratorKey;

  // UX
  /** Default start mode */
  defaultStartMode: 'use_existing' | 'refresh_context';
  /** Whether this project type is enabled */
  enabled: boolean;
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Central registry of all delivery project types
 *
 * To add a new project type:
 * 1. Add entry to this registry
 * 2. Add corresponding FlowType if needed
 * 3. Create generator route if needed
 *
 * NOTE: This registry is for DELIVERY projects only.
 * Diagnosis/discovery flows (Labs, GAP, Audits) are NOT included here.
 */
export const PROJECT_TYPE_REGISTRY: Record<string, ProjectTypeConfig> = {
  // ========================================================================
  // Website Category
  // ========================================================================
  website_optimization: {
    key: 'website_optimization',
    category: 'website',
    label: 'Website Optimization',
    description: 'Improve an existing website with targeted recommendations',
    icon: 'Zap',
    flowType: 'website_optimization',
    requiredDomains: ['identity', 'website'],
    recommendedLabs: ['website', 'seo', 'content'],
    contextBoosters: ['website'], // Auto-run before brief (website lab includes SEO/content analysis)
    briefFields: [
      {
        key: 'focus_areas',
        label: 'Focus Areas',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'conversion', label: 'Conversion Rate' },
          { value: 'seo', label: 'SEO / Organic Traffic' },
          { value: 'ux', label: 'User Experience' },
          { value: 'content', label: 'Content Quality' },
          { value: 'performance', label: 'Page Speed' },
        ],
        helpText: 'Optional: Select specific areas to prioritize',
      },
      {
        key: 'goals',
        label: 'Primary Goals',
        type: 'textarea',
        required: false,
        placeholder: 'What do you want to achieve with this optimization?',
      },
    ],
    generator: 'website_optimization',
    defaultStartMode: 'use_existing',
    enabled: true,
  },

  website_new: {
    key: 'website_new',
    category: 'website',
    label: 'New Website / Redesign',
    description: 'Build a new website or completely redesign an existing one',
    icon: 'LayoutGrid',
    flowType: 'gap_full', // New websites need comprehensive context
    requiredDomains: ['identity', 'brand', 'audience'],
    recommendedLabs: ['website', 'brand', 'audience', 'seo', 'content'],
    briefFields: [
      {
        key: 'project_scope',
        label: 'Project Scope',
        type: 'select',
        required: true,
        options: [
          { value: 'full_rebuild', label: 'Full Website Rebuild' },
          { value: 'major_redesign', label: 'Major Redesign' },
          { value: 'section_rebuild', label: 'Specific Section Rebuild' },
        ],
      },
      {
        key: 'timeline',
        label: 'Target Timeline',
        type: 'select',
        required: false,
        options: [
          { value: 'urgent', label: 'Urgent (< 4 weeks)' },
          { value: 'normal', label: 'Normal (1-3 months)' },
          { value: 'flexible', label: 'Flexible' },
        ],
      },
    ],
    generator: 'website_new',
    defaultStartMode: 'refresh_context', // New websites benefit from fresh context
    enabled: true,
  },

  // ========================================================================
  // SEO Category
  // ========================================================================
  seo_fix: {
    key: 'seo_fix',
    category: 'seo',
    label: 'SEO Fix / Improvement',
    description: 'Address specific SEO issues or improve organic visibility',
    icon: 'Search',
    flowType: 'website_optimization', // Uses same readiness as website opt
    requiredDomains: ['identity', 'website'],
    recommendedLabs: ['seo', 'website', 'content'],
    contextBoosters: ['website'], // Website lab includes SEO analysis
    briefFields: [
      {
        key: 'seo_focus',
        label: 'SEO Focus',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'technical', label: 'Technical SEO' },
          { value: 'content', label: 'Content SEO' },
          { value: 'local', label: 'Local SEO' },
          { value: 'backlinks', label: 'Backlink Building' },
        ],
      },
    ],
    generator: 'seo_fix',
    defaultStartMode: 'use_existing',
    enabled: true,
  },

  local_seo: {
    key: 'local_seo',
    category: 'seo',
    label: 'Local SEO',
    description: 'Improve local search visibility and map rankings',
    icon: 'MapPin',
    flowType: 'website_optimization',
    requiredDomains: ['identity'],
    recommendedLabs: ['seo', 'website'],
    contextBoosters: ['website'], // Website lab includes local SEO analysis
    briefFields: [
      {
        key: 'locations',
        label: 'Target Locations',
        type: 'textarea',
        required: true,
        placeholder: 'List the cities/regions you want to target',
      },
    ],
    generator: 'seo_fix',
    defaultStartMode: 'use_existing',
    enabled: true,
  },

  // ========================================================================
  // Content Category
  // ========================================================================
  content_strategy: {
    key: 'content_strategy',
    category: 'content',
    label: 'Content Strategy',
    description: 'Develop a content plan aligned with business goals',
    icon: 'FileText',
    flowType: 'programs', // Uses programs readiness
    requiredDomains: ['identity', 'brand', 'audience'],
    recommendedLabs: ['content', 'brand', 'seo'],
    contextBoosters: ['website', 'brand'], // Website (content analysis) + Brand for content strategy
    briefFields: [
      {
        key: 'content_goals',
        label: 'Content Goals',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'awareness', label: 'Brand Awareness' },
          { value: 'leads', label: 'Lead Generation' },
          { value: 'seo', label: 'SEO / Organic Traffic' },
          { value: 'authority', label: 'Thought Leadership' },
        ],
      },
    ],
    generator: 'content_strategy',
    defaultStartMode: 'use_existing',
    enabled: true,
  },

  // ========================================================================
  // Media Category
  // ========================================================================
  paid_search: {
    key: 'paid_search',
    category: 'media',
    label: 'Paid Search Optimization',
    description: 'Improve Google Ads / paid search performance',
    icon: 'DollarSign',
    flowType: 'programs',
    requiredDomains: ['identity', 'audience'],
    recommendedLabs: ['demand', 'audience'],
    contextBoosters: ['audience'], // Audience context for targeting
    briefFields: [
      {
        key: 'monthly_budget',
        label: 'Monthly Budget',
        type: 'number',
        required: false,
        placeholder: '5000',
        helpText: 'Approximate monthly ad spend in USD',
      },
      {
        key: 'campaign_goals',
        label: 'Campaign Goals',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'leads', label: 'Lead Generation' },
          { value: 'sales', label: 'Direct Sales' },
          { value: 'awareness', label: 'Brand Awareness' },
        ],
      },
    ],
    generator: 'paid_search',
    defaultStartMode: 'use_existing',
    enabled: true,
  },

  // ========================================================================
  // Analytics Category
  // ========================================================================
  analytics_setup: {
    key: 'analytics_setup',
    category: 'analytics',
    label: 'Analytics / Tracking Setup',
    description: 'Configure or improve analytics and conversion tracking',
    icon: 'BarChart3',
    flowType: 'website_optimization',
    requiredDomains: ['identity', 'website'],
    recommendedLabs: ['website'],
    briefFields: [
      {
        key: 'tracking_needs',
        label: 'Tracking Needs',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'ga4', label: 'Google Analytics 4' },
          { value: 'gtm', label: 'Google Tag Manager' },
          { value: 'conversions', label: 'Conversion Tracking' },
          { value: 'events', label: 'Event Tracking' },
        ],
      },
    ],
    generator: 'analytics_setup',
    defaultStartMode: 'use_existing',
    enabled: true,
  },

  // ========================================================================
  // Creative Category
  // ========================================================================
  creative_system: {
    key: 'creative_system',
    category: 'creative',
    label: 'Creative System',
    description: 'Develop creative guidelines and asset templates',
    icon: 'Palette',
    flowType: 'programs',
    requiredDomains: ['identity', 'brand'],
    recommendedLabs: ['brand', 'creative'],
    contextBoosters: ['brand', 'creative'], // Brand + Creative for creative system
    briefFields: [
      {
        key: 'creative_scope',
        label: 'Creative Scope',
        type: 'multiselect',
        required: false,
        options: [
          { value: 'brand_guidelines', label: 'Brand Guidelines' },
          { value: 'ad_templates', label: 'Ad Templates' },
          { value: 'social_assets', label: 'Social Media Assets' },
          { value: 'email_templates', label: 'Email Templates' },
        ],
      },
    ],
    generator: 'creative_system',
    defaultStartMode: 'use_existing',
    enabled: true,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all enabled project types
 */
export function getEnabledProjectTypes(): ProjectTypeConfig[] {
  return Object.values(PROJECT_TYPE_REGISTRY).filter((config) => config.enabled);
}

/**
 * Get project types by category
 */
export function getProjectTypesByCategory(category: ProjectCategory): ProjectTypeConfig[] {
  return getEnabledProjectTypes().filter((config) => config.category === category);
}

/**
 * Get a project type config by key
 */
export function getProjectTypeConfig(key: string): ProjectTypeConfig | undefined {
  return PROJECT_TYPE_REGISTRY[key];
}

/**
 * Get all categories that have at least one enabled project type
 */
export function getActiveCategories(): ProjectCategory[] {
  const categories = new Set<ProjectCategory>();
  for (const config of getEnabledProjectTypes()) {
    categories.add(config.category);
  }
  return Array.from(categories);
}

/**
 * Get category display info
 */
export const PROJECT_CATEGORY_INFO: Record<
  ProjectCategory,
  { label: string; description: string; icon: string }
> = {
  website: {
    label: 'Website',
    description: 'Website optimization and development projects',
    icon: 'Globe',
  },
  brand: {
    label: 'Brand',
    description: 'Brand strategy and identity projects',
    icon: 'Sparkles',
  },
  seo: {
    label: 'SEO',
    description: 'Search engine optimization projects',
    icon: 'Search',
  },
  content: {
    label: 'Content',
    description: 'Content strategy and creation projects',
    icon: 'FileText',
  },
  media: {
    label: 'Media',
    description: 'Paid media and advertising projects',
    icon: 'Megaphone',
  },
  analytics: {
    label: 'Analytics',
    description: 'Analytics and tracking projects',
    icon: 'BarChart3',
  },
  creative: {
    label: 'Creative',
    description: 'Creative development projects',
    icon: 'Palette',
  },
};
