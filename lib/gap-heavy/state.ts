// lib/gap-heavy/state.ts
// Heavy GAP Worker V3/V4 - State types and Zod schemas

import { z } from 'zod';
import type { DiagnosticModuleKey, EvidencePack } from './types';

// ============================================================================
// Step and Status Enums
// ============================================================================

export type HeavyGapStep =
  | 'init'
  | 'discoverPages'
  | 'analyzePages'
  | 'deepSeoAudit'
  | 'socialDeepDive'
  | 'competitorDeepDive'
  | 'generateArtifacts'
  | 'complete';

export type HeavyGapRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

export const HEAVY_GAP_STEPS: HeavyGapStep[] = [
  'init',
  'discoverPages',
  'analyzePages',
  'deepSeoAudit',
  'socialDeepDive',
  'competitorDeepDive',
  'generateArtifacts',
  'complete',
];

// ============================================================================
// State Interface
// ============================================================================

export interface HeavyGapRunState {
  id: string; // Airtable record ID
  gapPlanRunId: string; // FK to GAP-Plan Run
  companyId?: string; // FK to Companies
  gapFullReportId?: string; // FK to GAP-Full Report

  url: string; // canonical URL we're analyzing
  domain: string; // normalized domain (example.com)

  status: HeavyGapRunStatus;
  currentStep: HeavyGapStep;
  stepsCompleted: HeavyGapStep[];

  workerVersion: string; // e.g. "heavy-v3.0.0" or "heavy-v4.0.0"
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  lastTickAt?: string; // ISO string
  tickCount: number;
  errorMessage?: string;

  // ============================================================================
  // V4 Modular Architecture Fields (NEW)
  // ============================================================================

  /**
   * Which diagnostic modules were requested for this run
   * Defaults to all modules if not specified
   */
  modulesRequested?: DiagnosticModuleKey[];

  /**
   * Which diagnostic modules have completed (successfully or with errors)
   * Used to track progress in modular pipeline
   */
  modulesCompleted?: DiagnosticModuleKey[];

  /**
   * Shared evidence pack containing all collected data
   * Replaces/augments the step-specific data in V3
   */
  evidencePack?: EvidencePack;

  // ============================================================================
  // V3 Step-Based Data (LEGACY - preserved for backward compatibility)
  // ============================================================================

  data: {
    baseSnapshot?: {
      fromGapRun?: boolean;
      summary?: string;
      scores?: Record<string, number>;
    };

    discoverPages?: {
      sitemapUrl?: string;
      sitemapFound: boolean;
      seedUrls: string[];
      discoveredUrls: string[];
      limitedByCap: boolean;
    };

    analyzePages?: {
      pageCount: number;
      perPageStats: Array<{
        url: string;
        title?: string;
        status?: number;
        wordCount?: number;
        headings?: { h1: number; h2: number; h3: number };
        hasPrimaryCta?: boolean;
        templateKey?: string;
      }>;
      contentDepthSummary?: {
        avgWordsPerPage?: number;
        primaryTemplateCount?: number;
        totalWords?: number;
        depthBucket?: 'shallow' | 'medium' | 'deep';
        hasBlog?: boolean;
      };
    };

    deepSeoAudit?: {
      enabled: boolean;
      completed: boolean;
      issues?: Array<{
        id: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
      }>;
      summary?: string;
    };

    socialDeepDive?: {
      enabled: boolean;
      completed: boolean;
      platforms?: Array<{
        platform:
          | 'instagram'
          | 'facebook'
          | 'linkedin'
          | 'x'
          | 'tiktok'
          | 'youtube'
          | string;
        url: string;
        followerCount?: number;
        postingFrequency?: string;
        lastPostDate?: string;
      }>;
      summary?: string;
    };

    competitorDeepDive?: {
      enabled: boolean;
      completed: boolean;
      competitors?: Array<{
        url: string;
        name?: string;
        notes?: string;
      }>;
      summary?: string;
    };

    generateArtifacts?: {
      enabled: boolean;
      completed: boolean;
      pdfReportUrl?: string;
      shareableUrl?: string;
    };
  };
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const HeavyGapStepSchema = z.enum([
  'init',
  'discoverPages',
  'analyzePages',
  'deepSeoAudit',
  'socialDeepDive',
  'competitorDeepDive',
  'generateArtifacts',
  'complete',
]);

export const HeavyGapRunStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'error',
  'cancelled',
]);

// Detailed nested schemas for validation
const BaseSnapshotSchema = z
  .object({
    fromGapRun: z.boolean().optional(),
    summary: z.string().optional(),
    scores: z.record(z.string(), z.number()).optional(),
  })
  .optional();

const DiscoverPagesSchema = z
  .object({
    sitemapUrl: z.string().optional(),
    sitemapFound: z.boolean(),
    seedUrls: z.array(z.string()),
    discoveredUrls: z.array(z.string()),
    limitedByCap: z.boolean(),
  })
  .optional();

const AnalyzePagesSchema = z
  .object({
    pageCount: z.number(),
    perPageStats: z.array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        status: z.number().optional(),
        wordCount: z.number().optional(),
        headings: z
          .object({
            h1: z.number(),
            h2: z.number(),
            h3: z.number(),
          })
          .optional(),
        hasPrimaryCta: z.boolean().optional(),
        templateKey: z.string().optional(),
      })
    ),
    contentDepthSummary: z
      .object({
        avgWordsPerPage: z.number().optional(),
        primaryTemplateCount: z.number().optional(),
        totalWords: z.number().optional(),
        depthBucket: z.enum(['shallow', 'medium', 'deep']).optional(),
        hasBlog: z.boolean().optional(),
      })
      .optional(),
  })
  .optional();

const DeepSeoAuditSchema = z
  .object({
    enabled: z.boolean(),
    completed: z.boolean(),
    issues: z
      .array(
        z.object({
          id: z.string(),
          severity: z.enum(['low', 'medium', 'high']),
          description: z.string(),
        })
      )
      .optional(),
    summary: z.string().optional(),
  })
  .optional();

const SocialDeepDiveSchema = z
  .object({
    enabled: z.boolean(),
    completed: z.boolean(),
    platforms: z
      .array(
        z.object({
          platform: z.string(),
          url: z.string(),
          followerCount: z.number().optional(),
          postingFrequency: z.string().optional(),
          lastPostDate: z.string().optional(),
        })
      )
      .optional(),
    summary: z.string().optional(),
  })
  .optional();

const CompetitorDeepDiveSchema = z
  .object({
    enabled: z.boolean(),
    completed: z.boolean(),
    competitors: z
      .array(
        z.object({
          url: z.string(),
          name: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .optional(),
    summary: z.string().optional(),
  })
  .optional();

const GenerateArtifactsSchema = z
  .object({
    enabled: z.boolean(),
    completed: z.boolean(),
    pdfReportUrl: z.string().optional(),
    shareableUrl: z.string().optional(),
  })
  .optional();

// Zod schema for DiagnosticModuleKey
const DiagnosticModuleKeySchema = z.enum([
  'seo',
  'content',
  'website',
  'brand',
  'demand',
  'ops',
]);

export const HeavyGapRunStateSchema = z.object({
  id: z.string(),
  gapPlanRunId: z.string(),
  companyId: z.string().optional(),
  gapFullReportId: z.string().optional(),

  url: z.string(),
  domain: z.string(),

  status: HeavyGapRunStatusSchema,
  currentStep: HeavyGapStepSchema,
  stepsCompleted: z.array(HeavyGapStepSchema),

  workerVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTickAt: z.string().optional(),
  tickCount: z.number(),
  errorMessage: z.string().optional(),

  // V4 Modular Architecture Fields
  modulesRequested: z.array(DiagnosticModuleKeySchema).optional(),
  modulesCompleted: z.array(DiagnosticModuleKeySchema).optional(),
  evidencePack: z
    .object({
      presence: z.record(z.string(), z.unknown()).optional(),
      demand: z.record(z.string(), z.unknown()).optional(),
      performance: z.record(z.string(), z.unknown()).optional(),
      modules: z.array(
        z.object({
          module: DiagnosticModuleKeySchema,
          status: z.enum(['pending', 'running', 'completed', 'failed']),
          startedAt: z.string().optional(),
          completedAt: z.string().optional(),
          score: z.number().optional(),
          summary: z.string().optional(),
          issues: z.array(z.string()).optional(),
          recommendations: z.array(z.string()).optional(),
          rawEvidence: z.unknown().optional(),
        })
      ),
    })
    .optional(),

  // V3 Step-Based Data (legacy)
  data: z.object({
    baseSnapshot: BaseSnapshotSchema,
    discoverPages: DiscoverPagesSchema,
    analyzePages: AnalyzePagesSchema,
    deepSeoAudit: DeepSeoAuditSchema,
    socialDeepDive: SocialDeepDiveSchema,
    competitorDeepDive: CompetitorDeepDiveSchema,
    generateArtifacts: GenerateArtifactsSchema,
  }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a URL to its domain
 * @param url - Full URL
 * @returns Domain (e.g., "example.com")
 */
export function normalizeDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // Fallback: extract domain-like string
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();
  }
}

/**
 * Create initial HeavyGapRunState
 */
export function createInitialState(params: {
  id: string;
  gapPlanRunId: string;
  companyId?: string;
  gapFullReportId?: string;
  url: string;
}): HeavyGapRunState {
  const now = new Date().toISOString();
  const domain = normalizeDomain(params.url);

  return {
    id: params.id,
    gapPlanRunId: params.gapPlanRunId,
    companyId: params.companyId,
    gapFullReportId: params.gapFullReportId,
    url: params.url,
    domain,
    status: 'pending',
    currentStep: 'init',
    stepsCompleted: [],
    workerVersion: 'heavy-v3.0.0',
    createdAt: now,
    updatedAt: now,
    tickCount: 0,
    data: {},
  };
}
