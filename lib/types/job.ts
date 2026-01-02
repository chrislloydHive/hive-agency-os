// lib/types/job.ts
// Type definitions for Jobs (project intake + job numbering)

import { z } from 'zod';

// ============================================================================
// Job Status
// ============================================================================

export const JOB_STATUSES = [
  'not_started',
  'provisioning',
  'ready',
  'error',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JobStatusLabels: Record<JobStatus, string> = {
  not_started: 'Not Started',
  provisioning: 'Provisioning...',
  ready: 'Ready',
  error: 'Error',
};

export const JobStatusColors: Record<JobStatus, { bg: string; text: string; border: string }> = {
  not_started: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  provisioning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  ready: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

// ============================================================================
// Project Types
// ============================================================================

export const PROJECT_TYPES = [
  'Website',
  'Brand',
  'Campaign',
  'Content',
  'Strategy',
  'Media',
  'Creative',
  'Other',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

// ============================================================================
// Job Record
// ============================================================================

export interface JobRecord {
  // Identity
  id: string; // Airtable record ID
  jobNumber: number; // Global sequence number (e.g., 117)
  jobCode: string; // e.g., "117CAR"
  projectName: string;

  // Relationships
  companyId: string; // Link to Companies table (Airtable record ID)
  companyName?: string; // Denormalized for display

  // Optional fields (v1)
  projectType?: ProjectType;
  startDate?: string; // ISO date
  dueDate?: string; // ISO date
  assignment?: string; // Long text
  owner?: string;

  // Status
  status: JobStatus;

  // Drive provisioning
  driveJobFolderId?: string;
  driveJobFolderUrl?: string;
  driveProvisionedAt?: string; // ISO datetime
  driveProvisioningError?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Zod Schemas for API validation
// ============================================================================

export const CreateJobInputSchema = z.object({
  companyId: z.string().min(1, 'Company is required'),
  projectName: z.string().min(1, 'Project name is required').max(200),
  projectType: z.enum(PROJECT_TYPES).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  assignment: z.string().max(5000).optional(),
  owner: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

export const UpdateJobInputSchema = z.object({
  projectName: z.string().min(1).max(200).optional(),
  projectType: z.enum(PROJECT_TYPES).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  assignment: z.string().max(5000).nullable().optional(),
  owner: z.string().nullable().optional(),
  status: z.enum(JOB_STATUSES).optional(),
});

export type UpdateJobInput = z.infer<typeof UpdateJobInputSchema>;

// ============================================================================
// Client Code Validation
// ============================================================================

/**
 * Validate client code format: exactly 3 uppercase letters
 */
export function isValidClientCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * Normalize client code to uppercase
 */
export function normalizeClientCode(code: string): string {
  return code.trim().toUpperCase();
}

// ============================================================================
// Job Code Generation
// ============================================================================

/**
 * Generate job code from job number and client code
 * Example: 117 + "CAR" = "117CAR"
 */
export function generateJobCode(jobNumber: number, clientCode: string): string {
  return `${jobNumber}${clientCode.toUpperCase()}`;
}

/**
 * Parse job code into components
 */
export function parseJobCode(jobCode: string): { jobNumber: number; clientCode: string } | null {
  const match = jobCode.match(/^(\d+)([A-Z]{3})$/);
  if (!match) return null;
  return {
    jobNumber: parseInt(match[1], 10),
    clientCode: match[2],
  };
}

// ============================================================================
// Job Folder Name
// ============================================================================

/**
 * Generate the canonical job folder name for Google Drive
 * Format: "{JobCode} {ProjectName}"
 * Example: "117CAR Blog Development & Implementation"
 */
export function generateJobFolderName(jobCode: string, projectName: string): string {
  return `${jobCode} ${projectName}`;
}

// ============================================================================
// Drive Subfolder Structure
// ============================================================================

/**
 * Canonical subfolder structure for job folders
 * Note: Names contain "/" characters - this is intentional
 */
export const JOB_SUBFOLDERS = [
  'Timeline/Schedule',
  'Estimate/Financials',
  'Creative',
  'Client Brief/Comms',
] as const;

/**
 * Subfolders inside the Creative folder
 */
export const CREATIVE_SUBFOLDERS = [
  'Working Files',
  'Final Files',
  'Assets',
] as const;

// ============================================================================
// API Response Types
// ============================================================================

export interface CreateJobResponse {
  ok: boolean;
  job?: JobRecord;
  error?: string;
}

export interface ProvisionDriveResponse {
  ok: boolean;
  job?: JobRecord;
  error?: string;
  folderId?: string;
  folderUrl?: string;
}

export interface JobListResponse {
  ok: boolean;
  jobs: JobRecord[];
  total: number;
}
