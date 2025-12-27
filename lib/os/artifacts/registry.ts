// lib/os/artifacts/registry.ts
// Artifact Type Registry - defines all generatable artifact types
//
// Each artifact type has:
// - metadata (id, label, description)
// - supported sources (strategy, plan:media, plan:content, work)
// - output format (structured, markdown, hybrid)
// - prompt template for AI generation
// - output schema for validation

import { z } from 'zod';

// ============================================================================
// Artifact Source Types
// ============================================================================

export type ArtifactSourceType = 'strategy' | 'plan:media' | 'plan:content' | 'work';

export type GeneratedArtifactOutputFormat = 'structured' | 'markdown' | 'hybrid';

// ============================================================================
// Artifact Type Definition
// ============================================================================

export interface ArtifactTypeDefinition {
  /** Unique identifier for this artifact type */
  id: string;
  /** Human-readable label */
  label: string;
  /** Short description of what this artifact is for */
  description: string;
  /** Which sources can generate this artifact type */
  supportedSources: ArtifactSourceType[];
  /** Output format */
  outputFormat: GeneratedArtifactOutputFormat;
  /** Icon name (for UI) */
  icon?: string;
  /** Category for grouping in UI */
  category: 'brief' | 'plan' | 'summary' | 'playbook' | 'report';
  /** Default sections if structured output */
  defaultSections?: string[];
  /** Tags for filtering/search */
  tags?: string[];
}

// ============================================================================
// Registry of Artifact Types
// ============================================================================

export const ARTIFACT_TYPES: Record<string, ArtifactTypeDefinition> = {
  // Briefs
  creative_brief: {
    id: 'creative_brief',
    label: 'Creative Brief',
    description: 'A comprehensive brief for creative campaigns including messaging, audience, and creative direction.',
    supportedSources: ['strategy'],
    outputFormat: 'structured',
    category: 'brief',
    icon: 'Paintbrush',
    defaultSections: ['overview', 'audience', 'messaging', 'tone', 'creative_direction', 'deliverables', 'constraints'],
    tags: ['creative', 'campaign', 'design'],
  },

  media_brief: {
    id: 'media_brief',
    label: 'Media Brief',
    description: 'A brief for media planning and buying with channel recommendations, budget allocation, and KPIs.',
    supportedSources: ['strategy', 'plan:media'],
    outputFormat: 'structured',
    category: 'brief',
    icon: 'Radio',
    defaultSections: ['objectives', 'target_audience', 'channels', 'budget', 'kpis', 'timeline', 'measurement'],
    tags: ['media', 'advertising', 'paid'],
  },

  content_brief: {
    id: 'content_brief',
    label: 'Content Brief',
    description: 'A brief for content creation with topics, formats, and editorial guidelines.',
    supportedSources: ['strategy', 'plan:content'],
    outputFormat: 'structured',
    category: 'brief',
    icon: 'FileText',
    defaultSections: ['overview', 'topics', 'formats', 'audience', 'seo_keywords', 'tone_voice', 'distribution'],
    tags: ['content', 'editorial', 'seo'],
  },

  campaign_brief: {
    id: 'campaign_brief',
    label: 'Campaign Brief',
    description: 'An integrated brief for multi-channel campaigns.',
    supportedSources: ['strategy', 'plan:media', 'plan:content'],
    outputFormat: 'structured',
    category: 'brief',
    icon: 'Target',
    defaultSections: ['campaign_overview', 'objectives', 'target_audience', 'messaging', 'channels', 'creative_needs', 'timeline', 'budget', 'success_metrics'],
    tags: ['campaign', 'integrated', 'multi-channel'],
  },

  seo_brief: {
    id: 'seo_brief',
    label: 'SEO Brief',
    description: 'An SEO-focused brief with keyword strategy, technical requirements, and content recommendations.',
    supportedSources: ['strategy', 'plan:content'],
    outputFormat: 'structured',
    category: 'brief',
    icon: 'Search',
    defaultSections: ['keyword_strategy', 'content_recommendations', 'technical_requirements', 'link_building', 'measurement'],
    tags: ['seo', 'organic', 'search'],
  },

  // Summaries
  strategy_summary: {
    id: 'strategy_summary',
    label: 'Strategy Summary',
    description: 'A concise executive summary of the marketing strategy.',
    supportedSources: ['strategy'],
    outputFormat: 'markdown',
    category: 'summary',
    icon: 'FileStack',
    tags: ['strategy', 'executive', 'overview'],
  },

  stakeholder_summary: {
    id: 'stakeholder_summary',
    label: 'Stakeholder Summary',
    description: 'A high-level summary for internal stakeholders covering strategy, progress, and next steps.',
    supportedSources: ['strategy'],
    outputFormat: 'markdown',
    category: 'summary',
    icon: 'Users',
    tags: ['stakeholder', 'internal', 'update'],
  },

  acquisition_plan_summary: {
    id: 'acquisition_plan_summary',
    label: 'Acquisition Plan Summary',
    description: 'A summary of the customer acquisition strategy with channels, tactics, and projections.',
    supportedSources: ['strategy', 'plan:media'],
    outputFormat: 'structured',
    category: 'summary',
    icon: 'TrendingUp',
    defaultSections: ['overview', 'target_segments', 'channels', 'tactics', 'budget', 'projections', 'risks'],
    tags: ['acquisition', 'growth', 'demand-gen'],
  },

  // Playbooks
  execution_playbook: {
    id: 'execution_playbook',
    label: 'Execution Playbook',
    description: 'A detailed playbook for executing the strategy with step-by-step actions.',
    supportedSources: ['strategy'],
    outputFormat: 'structured',
    category: 'playbook',
    icon: 'BookOpen',
    defaultSections: ['overview', 'phases', 'actions', 'owners', 'timeline', 'dependencies', 'checkpoints'],
    tags: ['execution', 'operations', 'implementation'],
  },

  experiment_roadmap: {
    id: 'experiment_roadmap',
    label: 'Experiment Roadmap',
    description: 'A roadmap of experiments to validate strategic hypotheses.',
    supportedSources: ['strategy'],
    outputFormat: 'structured',
    category: 'playbook',
    icon: 'Beaker',
    defaultSections: ['hypotheses', 'experiments', 'success_criteria', 'timeline', 'resources', 'learning_goals'],
    tags: ['experiments', 'testing', 'validation'],
  },

  // Reports
  channel_analysis: {
    id: 'channel_analysis',
    label: 'Channel Analysis Report',
    description: 'An analysis of recommended marketing channels based on strategy and audience.',
    supportedSources: ['strategy', 'plan:media'],
    outputFormat: 'structured',
    category: 'report',
    icon: 'BarChart',
    defaultSections: ['summary', 'channel_breakdown', 'recommendations', 'budget_allocation', 'expected_outcomes'],
    tags: ['channels', 'analysis', 'media'],
  },

  competitive_positioning: {
    id: 'competitive_positioning',
    label: 'Competitive Positioning',
    description: 'A positioning statement and competitive differentiation document.',
    supportedSources: ['strategy'],
    outputFormat: 'markdown',
    category: 'report',
    icon: 'Crosshair',
    tags: ['positioning', 'competitive', 'differentiation'],
  },
};

// ============================================================================
// Registry Helpers
// ============================================================================

/**
 * Get artifact type definition by ID
 */
export function getArtifactType(id: string): ArtifactTypeDefinition | null {
  return ARTIFACT_TYPES[id] ?? null;
}

/**
 * Get all artifact types
 */
export function getAllArtifactTypes(): ArtifactTypeDefinition[] {
  return Object.values(ARTIFACT_TYPES);
}

/**
 * Get artifact types that support a given source
 */
export function getArtifactTypesForSource(source: ArtifactSourceType): ArtifactTypeDefinition[] {
  return Object.values(ARTIFACT_TYPES).filter(type =>
    type.supportedSources.includes(source)
  );
}

/**
 * Get artifact types by category
 */
export function getArtifactTypesByCategory(category: ArtifactTypeDefinition['category']): ArtifactTypeDefinition[] {
  return Object.values(ARTIFACT_TYPES).filter(type => type.category === category);
}

/**
 * Check if an artifact type ID is valid
 */
export function isValidArtifactType(id: string): boolean {
  return id in ARTIFACT_TYPES;
}

/**
 * Get recommended artifact types based on strategy context
 */
export function getRecommendedArtifactTypes(context: {
  hasMediaTactics?: boolean;
  hasContentTactics?: boolean;
  hasSeoTactics?: boolean;
  hasExperiments?: boolean;
}): ArtifactTypeDefinition[] {
  const recommended: ArtifactTypeDefinition[] = [];

  // Always recommend strategy summary
  recommended.push(ARTIFACT_TYPES.strategy_summary);

  // Recommend based on tactics
  if (context.hasMediaTactics) {
    recommended.push(ARTIFACT_TYPES.media_brief);
    recommended.push(ARTIFACT_TYPES.campaign_brief);
  }

  if (context.hasContentTactics) {
    recommended.push(ARTIFACT_TYPES.content_brief);
  }

  if (context.hasSeoTactics) {
    recommended.push(ARTIFACT_TYPES.seo_brief);
  }

  if (context.hasExperiments) {
    recommended.push(ARTIFACT_TYPES.experiment_roadmap);
  }

  // Always good to have
  recommended.push(ARTIFACT_TYPES.creative_brief);

  return recommended;
}

// ============================================================================
// Output Schemas (Zod)
// ============================================================================

/**
 * Base schema for all generated artifacts
 */
export const GeneratedArtifactBaseSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  generatedAt: z.string(),
});

/**
 * Schema for structured artifact sections
 */
export const StructuredSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  items: z.array(z.string()).optional(),
  subsections: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })).optional(),
});

/**
 * Schema for structured artifact output
 */
export const StructuredArtifactOutputSchema = GeneratedArtifactBaseSchema.extend({
  format: z.literal('structured'),
  sections: z.array(StructuredSectionSchema),
});

/**
 * Schema for markdown artifact output
 */
export const MarkdownArtifactOutputSchema = GeneratedArtifactBaseSchema.extend({
  format: z.literal('markdown'),
  content: z.string(),
});

/**
 * Schema for hybrid artifact output
 */
export const HybridArtifactOutputSchema = GeneratedArtifactBaseSchema.extend({
  format: z.literal('hybrid'),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  sections: z.array(StructuredSectionSchema).optional(),
});

/**
 * Union schema for all artifact outputs
 */
export const GeneratedArtifactOutputSchema = z.union([
  StructuredArtifactOutputSchema,
  MarkdownArtifactOutputSchema,
  HybridArtifactOutputSchema,
]);

export type GeneratedArtifactOutput = z.infer<typeof GeneratedArtifactOutputSchema>;
export type StructuredArtifactOutput = z.infer<typeof StructuredArtifactOutputSchema>;
export type MarkdownArtifactOutput = z.infer<typeof MarkdownArtifactOutputSchema>;
