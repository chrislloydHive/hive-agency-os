// lib/types/documents.ts
// MVP Document types for Briefs and generated documents
//
// These types define the structure of briefs (Creative, Media, Content/SEO)
// that can be generated from a company's strategy.

// ============================================================================
// Core Document Types
// ============================================================================

/**
 * Brief type categories
 */
export type BriefType = 'creative' | 'media' | 'content' | 'seo';

/**
 * Document status
 */
export type DocumentStatus = 'draft' | 'review' | 'approved' | 'archived';

/**
 * Brief document - a strategic brief for execution
 */
export interface Brief {
  id: string;
  companyId: string;

  // Brief identity
  type: BriefType;
  title: string;

  // Content
  summary: string;
  body: string; // Markdown or rich text

  // Related entities
  relatedStrategyId?: string;
  relatedPillarIds?: string[];

  // Status & lifecycle
  status: DocumentStatus;
  version?: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// ============================================================================
// Brief Generation
// ============================================================================

/**
 * Request to generate a brief from strategy
 */
export interface GenerateBriefRequest {
  companyId: string;
  type: BriefType;
  strategyId?: string; // If not provided, uses active strategy
  pillarIds?: string[]; // Optional: specific pillars to focus on
}

/**
 * Response from brief generation
 */
export interface GenerateBriefResponse {
  brief: Omit<Brief, 'id' | 'createdAt' | 'updatedAt'>;
  confidence: number;
  generatedAt: string;
}

// ============================================================================
// Brief Templates
// ============================================================================

/**
 * Creative brief structure
 */
export interface CreativeBriefContent {
  objective: string;
  targetAudience: string;
  keyMessage: string;
  supportingMessages: string[];
  tone: string;
  deliverables: string[];
  timeline?: string;
  budget?: string;
  successMetrics: string[];
}

/**
 * Media brief structure
 */
export interface MediaBriefContent {
  objective: string;
  targetAudience: string;
  channels: string[];
  budget: string;
  flighting: string;
  keyMessages: string[];
  kpis: string[];
  constraints?: string;
}

/**
 * Content/SEO brief structure
 */
export interface ContentBriefContent {
  objective: string;
  targetKeywords: string[];
  contentType: string;
  wordCount?: number;
  outline: string[];
  cta: string;
  internalLinks?: string[];
  competitorUrls?: string[];
}

// ============================================================================
// Document List & Summary
// ============================================================================

/**
 * Brief summary for list display
 */
export interface BriefSummary {
  id: string;
  type: BriefType;
  title: string;
  status: DocumentStatus;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create brief summary from full brief
 */
export function createBriefSummary(brief: Brief): BriefSummary {
  return {
    id: brief.id,
    type: brief.type,
    title: brief.title,
    status: brief.status,
    summary: brief.summary.length > 150
      ? brief.summary.substring(0, 150) + '...'
      : brief.summary,
    createdAt: brief.createdAt,
    updatedAt: brief.updatedAt,
  };
}

// ============================================================================
// Helper Functions & Constants
// ============================================================================

/**
 * Brief type display labels
 */
export const BRIEF_TYPE_LABELS: Record<BriefType, string> = {
  creative: 'Creative Brief',
  media: 'Media Activation Brief',
  content: 'Content Brief',
  seo: 'SEO Brief',
};

/**
 * Brief type descriptions
 */
export const BRIEF_TYPE_DESCRIPTIONS: Record<BriefType, string> = {
  creative: 'Strategic brief for creative development including messaging, tone, and deliverables',
  media: 'Media activation brief with channel mix, budget allocation, and flighting',
  content: 'Content strategy brief with topics, keywords, and editorial guidelines',
  seo: 'SEO-focused brief with keyword targets, technical requirements, and link strategy',
};

/**
 * Brief type icons (Lucide icon names)
 */
export const BRIEF_TYPE_ICONS: Record<BriefType, string> = {
  creative: 'Palette',
  media: 'Megaphone',
  content: 'FileText',
  seo: 'Search',
};

/**
 * Document status labels
 */
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  archived: 'Archived',
};

/**
 * Document status colors (Tailwind classes)
 */
export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  review: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  archived: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

/**
 * Generate unique document ID
 */
export function generateDocumentId(type: BriefType): string {
  return `brief_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
