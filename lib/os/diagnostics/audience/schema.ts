// lib/os/diagnostics/audience/schema.ts
// Audience Lab V4 Schema and Score Resolution

import { z } from 'zod';

// ============================================================================
// Score Resolution
// ============================================================================

/**
 * Resolve audience lab score with deterministic fallback
 *
 * CRITICAL: Never defaults to 100 - that would be misleading
 *
 * Fallback logic:
 * - Base fallback: 75 (indicates "likely good but unverified")
 * - Reduces 3 points per issue (max 15 reduction)
 * - Minimum fallback: 60
 *
 * @param modelScore - Score from model (0-100 when valid)
 * @param issues - Array of issue strings that reduce fallback score
 */
export function resolveAudienceScore(
  modelScore: unknown,
  issues: string[]
): number {
  // Check if model score is a valid number in range
  if (typeof modelScore === 'number' && !isNaN(modelScore)) {
    // Clamp to 0-100
    return Math.max(0, Math.min(100, modelScore));
  }

  // Fallback: deterministic score based on issues
  const BASE_FALLBACK = 75;
  const REDUCTION_PER_ISSUE = 3;
  const MAX_REDUCTION = 15;

  const reduction = Math.min(issues.length * REDUCTION_PER_ISSUE, MAX_REDUCTION);
  return BASE_FALLBACK - reduction;
}

// ============================================================================
// Normalized Schema
// ============================================================================

/**
 * Schema for audience segment from lab output
 */
const audienceSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  size: z.string().optional(),
  priority: z.enum(['primary', 'secondary', 'tertiary']).optional(),
  characteristics: z.array(z.string()).optional(),
  needs: z.array(z.string()).optional(),
  painPoints: z.array(z.string()).optional(),
});

/**
 * Normalized schema for Audience Lab output
 * Ensures consistent structure for downstream consumers
 */
export const audienceLabNormalizedSchema = z.object({
  // Core audience data
  audience: z.object({
    primaryAudience: z.string().optional(),
    icpDescription: z.string().optional(),
    targetMarket: z.string().optional(),
  }),

  // Structured segments
  audienceSegments: z.array(audienceSegmentSchema).default([]),

  // Discovery signals
  signals: z.array(z.object({
    type: z.string(),
    content: z.string(),
    confidence: z.number().optional(),
    source: z.string().optional(),
  })).default([]),

  // Quality metrics
  score: z.number().min(0).max(100),
  issues: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),

  // Metadata
  runId: z.string().optional(),
  timestamp: z.string().optional(),
});

export type AudienceLabNormalized = z.infer<typeof audienceLabNormalizedSchema>;
export type AudienceSegment = z.infer<typeof audienceSegmentSchema>;
