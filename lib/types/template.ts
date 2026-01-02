// lib/types/template.ts
// Type definitions for Templates and Job Documents

import { z } from 'zod';

// ============================================================================
// Document Types
// ============================================================================

export const DOCUMENT_TYPES = ['SOW', 'BRIEF', 'TIMELINE', 'MSA'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DocumentTypeLabels: Record<DocumentType, string> = {
  SOW: 'Statement of Work',
  BRIEF: 'Project Brief',
  TIMELINE: 'Timeline',
  MSA: 'Master Services Agreement',
};

// ============================================================================
// Template Scope
// ============================================================================

export const TEMPLATE_SCOPES = ['job', 'client'] as const;
export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

// ============================================================================
// Destination Folder Keys
// ============================================================================

export const DESTINATION_FOLDER_KEYS = [
  'estimate',      // Estimate/Financials folder
  'brief',         // Client Brief/Comms folder
  'timeline',      // Timeline/Schedule folder
  'client_root',   // Client root folder
  'client_msa_folder', // Client MSA subfolder
] as const;

export type DestinationFolderKey = (typeof DESTINATION_FOLDER_KEYS)[number];

/**
 * Map destination folder key to actual folder name in Drive
 */
export const DESTINATION_FOLDER_NAMES: Record<DestinationFolderKey, string | null> = {
  estimate: 'Estimate/Financials',
  brief: 'Client Brief/Comms',
  timeline: 'Timeline/Schedule',
  client_root: null, // Use client root directly
  client_msa_folder: 'MSA',
};

// ============================================================================
// Template Record
// ============================================================================

export interface TemplateRecord {
  id: string; // Airtable record ID
  name: string;
  scope: TemplateScope;
  documentType: DocumentType;
  driveTemplateFileId: string;
  destinationFolderKey: DestinationFolderKey;
  namingPattern: string;
  allowAIDrafting: boolean;
  createdAt?: string;
}

// ============================================================================
// Template Pack Record
// ============================================================================

export interface TemplatePackRecord {
  id: string;
  name: string;
  templateIds: string[]; // Linked template record IDs
  templates?: TemplateRecord[]; // Populated when needed
  isDefault: boolean;
  createdAt?: string;
}

// ============================================================================
// Job Document Status
// ============================================================================

export const JOB_DOCUMENT_STATUSES = ['draft', 'in_review', 'final'] as const;
export type JobDocumentStatus = (typeof JOB_DOCUMENT_STATUSES)[number];

export const JobDocumentStatusLabels: Record<JobDocumentStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  final: 'Final',
};

export const JobDocumentStatusColors: Record<JobDocumentStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  in_review: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  final: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
};

// ============================================================================
// Job Document Record
// ============================================================================

export interface JobDocumentRecord {
  id: string; // Airtable record ID
  jobId: string;
  documentType: DocumentType;
  status: JobDocumentStatus;
  driveFileId: string;
  driveUrl: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Document Naming Helpers
// ============================================================================

/**
 * Generate document name from template pattern
 */
export function generateDocumentName(
  documentType: DocumentType,
  jobCode: string,
  clientName: string
): string {
  switch (documentType) {
    case 'SOW':
      return `${jobCode} – Statement of Work`;
    case 'BRIEF':
      return `${jobCode} – Project Brief`;
    case 'TIMELINE':
      return `${jobCode} – Timeline`;
    case 'MSA':
      return `Hive x ${clientName} – Master Services Agreement`;
    default:
      return `${jobCode} – Document`;
  }
}

/**
 * Get the destination folder key for a document type
 */
export function getDestinationForDocType(documentType: DocumentType): DestinationFolderKey {
  switch (documentType) {
    case 'SOW':
      return 'estimate';
    case 'BRIEF':
      return 'brief';
    case 'TIMELINE':
      return 'timeline';
    case 'MSA':
      return 'client_msa_folder';
    default:
      return 'estimate';
  }
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ProvisionDocsInputSchema = z.object({
  templatePackId: z.string().optional(),
  templateIds: z.array(z.string()).optional(),
});

export type ProvisionDocsInput = z.infer<typeof ProvisionDocsInputSchema>;

export const UpdateJobDocumentStatusSchema = z.object({
  status: z.enum(JOB_DOCUMENT_STATUSES),
});

// ============================================================================
// API Response Types
// ============================================================================

export interface ProvisionDocsResponse {
  ok: boolean;
  documents?: JobDocumentRecord[];
  error?: string;
}

export interface ProvisionMsaResponse {
  ok: boolean;
  msaDocId?: string;
  msaDocUrl?: string;
  error?: string;
}
