// lib/assistant/types.ts
// Types for the Company Context Assistant

import { z } from 'zod';

// ============================================================================
// Page Context Types (UI-level awareness)
// ============================================================================

/**
 * Identifies which company page the user is currently viewing.
 * Used to customize AI Helper quick actions and hints.
 */
export type PageContextId =
  | 'overview'
  | 'blueprint'
  | 'brain_context'
  | 'brain_insights'
  | 'brain_library'
  | 'qbr'
  | 'setup'
  | 'lab_audience'
  | 'lab_brand'
  | 'lab_creative'
  | 'lab_competitor'
  | 'lab_website'
  | 'lab_media'
  | 'unknown';

/**
 * Human-readable labels for page contexts
 */
export const PAGE_CONTEXT_LABELS: Record<PageContextId, string> = {
  overview: 'Overview',
  blueprint: 'Blueprint',
  brain_context: 'Brain → Context',
  brain_insights: 'Brain → Insights',
  brain_library: 'Brain → Library',
  qbr: 'QBR',
  setup: 'Setup',
  lab_audience: 'Audience Lab',
  lab_brand: 'Brand Lab',
  lab_creative: 'Creative Lab',
  lab_competitor: 'Competitor Lab',
  lab_website: 'Website Lab',
  lab_media: 'Media Lab',
  unknown: 'Company',
};

/**
 * Derive PageContextId from a pathname
 */
export function derivePageContextFromPath(pathname: string): PageContextId {
  // Remove leading slash and split
  const segments = pathname.replace(/^\//, '').split('/');

  // Expected format: c/[companyId]/...
  if (segments[0] !== 'c' || segments.length < 2) {
    return 'unknown';
  }

  // Get the path after companyId
  const subPath = segments.slice(2).join('/');

  if (!subPath || subPath === '') return 'overview';

  // Blueprint
  if (subPath.startsWith('blueprint')) return 'blueprint';

  // Brain pages
  if (subPath === 'brain' || subPath === 'brain/context') return 'brain_context';
  if (subPath === 'brain/insights') return 'brain_insights';
  if (subPath === 'brain/library') return 'brain_library';

  // QBR
  if (subPath.startsWith('qbr')) return 'qbr';

  // Setup
  if (subPath.startsWith('setup') || subPath.startsWith('brain/setup')) return 'setup';

  // Labs - check diagnostics and labs paths
  if (subPath.startsWith('diagnostics/audience') || subPath.startsWith('labs/audience')) return 'lab_audience';
  if (subPath.startsWith('diagnostics/brand') || subPath.startsWith('labs/brand')) return 'lab_brand';
  if (subPath.startsWith('labs/creative')) return 'lab_creative';
  if (subPath.startsWith('labs/competitor')) return 'lab_competitor';
  if (subPath.startsWith('diagnostics/website') || subPath.startsWith('labs/website')) return 'lab_website';
  if (subPath.startsWith('diagnostics/media') || subPath.startsWith('labs/media')) return 'lab_media';

  return 'unknown';
}

// ============================================================================
// Request Types
// ============================================================================

export type AssistantMode = 'chat' | 'fill_gaps' | 'explain';

export interface AssistantRequest {
  message: string;
  mode?: AssistantMode;
  conversationHistory?: AssistantMessage[];
}

// ============================================================================
// Response Types
// ============================================================================

export interface AssistantMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ContextUpdate {
  path: string;
  newValue: unknown;
  oldValue?: unknown;
  confidence: number;
  reason?: string;
}

export interface ProposedWorkItem {
  title: string;
  description?: string;
  area?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface ProposedAction {
  type: 'run_lab' | 'run_gap' | 'run_fcb';
  labId?: 'audience' | 'brand' | 'creative';
  justification?: string;
}

export interface ProposedChanges {
  contextUpdates?: ContextUpdate[];
  workItems?: ProposedWorkItem[];
  actions?: ProposedAction[];
}

export interface AssistantResponse {
  messages: AssistantMessage[];
  proposedChanges?: ProposedChanges;
  changeToken?: string;
  contextHealth?: {
    score: number;
    status: string;
  };
}

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

export const ContextUpdateSchema = z.object({
  path: z.string(),
  newValue: z.unknown(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

export const ProposedWorkItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  area: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const ProposedActionSchema = z.object({
  type: z.enum(['run_lab', 'run_gap', 'run_fcb']),
  labId: z.enum(['audience', 'brand', 'creative']).optional(),
  justification: z.string().optional(),
});

export const ProposedChangesSchema = z.object({
  contextUpdates: z.array(ContextUpdateSchema).optional(),
  workItems: z.array(ProposedWorkItemSchema).optional(),
  actions: z.array(ProposedActionSchema).optional(),
});

export const AIResponseSchema = z.object({
  response: z.string(),
  proposedChanges: ProposedChangesSchema.optional(),
});

export type AIResponseParsed = z.infer<typeof AIResponseSchema>;

// ============================================================================
// Apply Endpoint Types
// ============================================================================

export interface ApplyRequest {
  changeToken: string;
  selectedUpdates?: string[]; // paths to include (if not provided, apply all)
  selectedWorkItems?: number[]; // indices to include
  selectedActions?: number[]; // indices to include
}

export interface ApplyResult {
  updatedFields: string[];
  skippedFields: { path: string; reason: string }[];
  createdWorkItems: { id: string; title: string }[];
  triggeredActions: { type: string; status: string }[];
}

// ============================================================================
// Context Loading Types
// ============================================================================

export interface AssistantContext {
  company: {
    id: string;
    name: string;
    industry?: string;
    marketMaturity?: string;
    tier?: string;
  };
  contextGraph: {
    domains: Record<string, DomainSummary>;
    completeness: number;
  };
  contextHealth: {
    score: number;
    status: string;
    missingCritical: string[];
    weakSections: string[];
  };
  gapSummary?: {
    overallScore?: number;
    keyFindings?: string[];
    lastRunAt?: string;
  };
  labsHistory?: {
    audience?: LabRunSummary;
    brand?: LabRunSummary;
    creative?: LabRunSummary;
  };
  insights?: InsightSummary[];
  workItems?: WorkItemSummary[];
}

export interface DomainSummary {
  name: string;
  completeness: number;
  populatedFields: number;
  totalFields: number;
  criticalMissing: string[];
  fields: Record<string, FieldSummary>;
}

export interface FieldSummary {
  value: unknown;
  hasValue: boolean;
  confidence: number;
  source?: string;
  isHumanOverride: boolean;
  provenance: Array<{
    source: string;
    confidence: number;
    updatedAt: string;
  }>;
}

export interface LabRunSummary {
  lastRunAt?: string;
  fieldsUpdated?: number;
  completenessAfter?: number;
}

export interface InsightSummary {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
}

export interface WorkItemSummary {
  id: string;
  title: string;
  area: string;
  status: string;
  priority: string;
}
