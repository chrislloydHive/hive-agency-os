// lib/os/briefs/schemas.ts
// Zod schemas for Brief AI generation validation
//
// These schemas are used to validate AI-generated brief content
// before it is persisted. This ensures type safety and data integrity.

import { z } from 'zod';
import type { BriefType } from '@/lib/types/brief';

// ============================================================================
// Core Schema
// ============================================================================

/**
 * Zod schema for BriefCore
 */
export const BriefCoreSchema = z.object({
  objective: z.string().min(1, 'Objective is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  problemToSolve: z.string().min(1, 'Problem to solve is required'),
  singleMindedFocus: z.string().min(1, 'Single-minded focus is required'),
  constraints: z.array(z.string()).default([]),
  successDefinition: z.string().min(1, 'Success definition is required'),
  assumptions: z.array(z.string()).default([]),
});

export type ValidatedBriefCore = z.infer<typeof BriefCoreSchema>;

// ============================================================================
// Extension Schemas
// ============================================================================

/**
 * Zod schema for CreativeCampaignExtension
 */
export const CreativeCampaignExtensionSchema = z.object({
  keyMessage: z.string().default(''),
  supportingMessages: z.array(z.string()).default([]),
  visualDirection: z.string().default(''),
  tone: z.string().default(''),
  cta: z.string().default(''),
  mandatories: z.array(z.string()).default([]),
  formatSpecs: z.object({
    size: z.string().optional(),
    dimensions: z.string().optional(),
    colorMode: z.string().optional(),
    bleed: z.string().optional(),
    fileFormat: z.string().optional(),
    publication: z.string().optional(),
    channels: z.array(z.string()).optional(),
  }).default({}),
});

export type ValidatedCreativeCampaignExtension = z.infer<typeof CreativeCampaignExtensionSchema>;

/**
 * Zod schema for SeoExtension
 */
export const SeoExtensionSchema = z.object({
  searchIntent: z.string().default(''),
  priorityTopics: z.array(z.string()).default([]),
  keywordThemes: z.array(z.string()).default([]),
  technicalConstraints: z.array(z.string()).default([]),
  measurementWindow: z.string().default(''),
});

export type ValidatedSeoExtension = z.infer<typeof SeoExtensionSchema>;

/**
 * Zod schema for ContentExtension
 */
export const ContentExtensionSchema = z.object({
  contentPillars: z.array(z.string()).default([]),
  journeyStage: z.string().default(''),
  cadence: z.string().default(''),
  distributionChannels: z.array(z.string()).default([]),
});

export type ValidatedContentExtension = z.infer<typeof ContentExtensionSchema>;

/**
 * Zod schema for WebsiteExtension
 */
export const WebsiteExtensionSchema = z.object({
  primaryUserFlows: z.array(z.string()).default([]),
  conversionGoals: z.array(z.string()).default([]),
  informationArchitectureNotes: z.string().default(''),
  cmsConstraints: z.string().default(''),
});

export type ValidatedWebsiteExtension = z.infer<typeof WebsiteExtensionSchema>;

/**
 * Zod schema for ProgramExtension
 */
export const ProgramExtensionSchema = z.object({
  programType: z.string().optional(),
  programNotes: z.string().optional(),
});

export type ValidatedProgramExtension = z.infer<typeof ProgramExtensionSchema>;

// ============================================================================
// AI Response Schemas
// ============================================================================

/**
 * Get the extension schema for a brief type
 */
export function getExtensionSchemaForType(type: BriefType) {
  switch (type) {
    case 'creative':
    case 'campaign':
      return CreativeCampaignExtensionSchema;
    case 'seo':
      return SeoExtensionSchema;
    case 'content':
      return ContentExtensionSchema;
    case 'website':
      return WebsiteExtensionSchema;
    case 'program':
      return ProgramExtensionSchema;
    default:
      return z.object({});
  }
}

/**
 * Create a full AI response schema for a brief type
 */
export function createBriefGenerateResponseSchema(type: BriefType) {
  const extensionSchema = getExtensionSchemaForType(type);

  return z.object({
    core: BriefCoreSchema,
    extension: extensionSchema,
  });
}

/**
 * Validate AI-generated brief response
 * @returns Validated data or throws ZodError
 */
export function validateBriefGenerateResponse(
  type: BriefType,
  data: unknown
): { core: ValidatedBriefCore; extension: unknown } {
  const schema = createBriefGenerateResponseSchema(type);
  return schema.parse(data);
}

/**
 * Safe validate with error details
 */
export function safeParseBriefGenerateResponse(
  type: BriefType,
  data: unknown
): { success: true; data: { core: ValidatedBriefCore; extension: unknown } } | { success: false; error: string; issues: z.ZodIssue[] } {
  const schema = createBriefGenerateResponseSchema(type);
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
    issues: result.error.issues,
  };
}

// ============================================================================
// JSON Parsing Helpers
// ============================================================================

/**
 * Parse JSON string with detailed error reporting
 */
export function parseJsonSafe(jsonString: string): { success: true; data: unknown } | { success: false; error: string } {
  try {
    // Clean up common AI response issues
    let cleaned = jsonString.trim();

    // Remove markdown code blocks if present
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const data = JSON.parse(cleaned);
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Invalid JSON',
    };
  }
}

/**
 * Full validation pipeline: parse JSON then validate schema
 */
export function parseAndValidateBriefResponse(
  type: BriefType,
  jsonString: string
): {
  success: true;
  data: { core: ValidatedBriefCore; extension: unknown }
} | {
  success: false;
  error: string;
  stage: 'json_parse' | 'schema_validation';
  issues?: z.ZodIssue[];
} {
  // Step 1: Parse JSON
  const parseResult = parseJsonSafe(jsonString);
  if (!parseResult.success) {
    return {
      success: false,
      error: `JSON parse error: ${parseResult.error}`,
      stage: 'json_parse',
    };
  }

  // Step 2: Validate schema
  const validateResult = safeParseBriefGenerateResponse(type, parseResult.data);
  if (!validateResult.success) {
    return {
      success: false,
      error: `Schema validation error: ${validateResult.error}`,
      stage: 'schema_validation',
      issues: validateResult.issues,
    };
  }

  return { success: true, data: validateResult.data };
}
