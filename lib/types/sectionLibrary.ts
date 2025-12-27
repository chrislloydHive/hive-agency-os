// lib/types/sectionLibrary.ts
// Types for the Reusable Section Library (V3)
// Supports company-scoped (default) and global (curated) sections

import { z } from 'zod';

// ============================================================================
// Section Library Scope
// ============================================================================

export type SectionLibraryScope = 'company' | 'global';

// ============================================================================
// Reusable Section Schema
// ============================================================================

export const ReusableSectionSchema = z.object({
  id: z.string(),
  scope: z.enum(['company', 'global']).default('company'),
  companyId: z.string().nullable(), // Required for company scope, null for global
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  source: z.enum(['rfp', 'proposal']),
  sourceId: z.string().nullable(), // Original RFP/Proposal ID
  sourceSectionKey: z.string().nullable(), // Original section key
  outcome: z.enum(['won', 'lost']).nullable(), // From RFP outcome (for learning)
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type ReusableSection = z.infer<typeof ReusableSectionSchema>;

export const ReusableSectionInputSchema = ReusableSectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReusableSectionInput = z.infer<typeof ReusableSectionInputSchema>;

// ============================================================================
// Create Section Input (for API)
// ============================================================================

export const CreateSectionInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).default([]),
  source: z.enum(['rfp', 'proposal']),
  sourceId: z.string().optional(),
  sourceSectionKey: z.string().optional(),
});

export type CreateSectionInput = z.infer<typeof CreateSectionInputSchema>;

// ============================================================================
// Update Section Input
// ============================================================================

export const UpdateSectionInputSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateSectionInput = z.infer<typeof UpdateSectionInputSchema>;

// ============================================================================
// Promote to Global Input
// ============================================================================

export const PromoteToGlobalInputSchema = z.object({
  confirmNoClientSpecificContent: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm the content has no client-specific details' }),
  }),
});

export type PromoteToGlobalInput = z.infer<typeof PromoteToGlobalInputSchema>;

// ============================================================================
// List Sections Query
// ============================================================================

export interface ListSectionsQuery {
  scope?: SectionLibraryScope | 'all'; // Filter by scope
  q?: string; // Search query (title/content)
  tag?: string; // Filter by tag
}

// ============================================================================
// Section Library Response Types
// ============================================================================

export interface SectionLibraryListResponse {
  sections: ReusableSection[];
  companySections: ReusableSection[];
  globalSections: ReusableSection[];
  total: number;
}

export interface PromoteResponse {
  success: boolean;
  originalSection: ReusableSection;
  globalSection: ReusableSection;
}

// ============================================================================
// Client Leakage Check Result
// ============================================================================

export interface LeakageCheckResult {
  hasWarnings: boolean;
  warnings: string[];
  detectedPatterns: string[];
}

// ============================================================================
// Constants
// ============================================================================

export const COMMON_SECTION_TAGS = [
  'approach',
  'methodology',
  'team',
  'qualifications',
  'pricing',
  'timeline',
  'case-study',
  'proof',
  'references',
  'scope',
  'deliverables',
  'assumptions',
];
