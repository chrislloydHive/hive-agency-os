// lib/os/plans/convert/planToWorkItems.ts
// Main conversion orchestrator for Plan → Work Items
//
// Handles:
// - Plan type detection and routing to appropriate mapper
// - Duplicate detection via work keys (idempotency)
// - Batch creation with Airtable rate limiting
// - Conversion result tracking

import type { MediaPlan, ContentPlan, Plan, PlanType } from '@/lib/types/plan';
import type { WorkItem, WorkSourceHeavyPlan } from '@/lib/types/work';
import { isMediaPlan, isContentPlan } from '@/lib/types/plan';
import {
  convertMediaPlanToWorkItems,
  type MediaPlanConversionResult,
  type ConvertedWorkItem as MediaConvertedItem,
} from './mediaPlanMapper';
import {
  convertContentPlanToWorkItems,
  type ContentPlanConversionResult,
  type ConvertedWorkItem as ContentConvertedItem,
} from './contentPlanMapper';

// ============================================================================
// Types
// ============================================================================

export type ConvertedWorkItem = MediaConvertedItem | ContentConvertedItem;

export interface PlanConversionResult {
  planId: string;
  planType: PlanType;
  planVersion: number;
  companyId: string;
  /** Work items to create (not yet in DB) */
  workItemsToCreate: ConvertedWorkItem[];
  /** Work keys that already exist (skipped for idempotency) */
  skippedWorkKeys: string[];
  /** Summary stats */
  stats: {
    total: number;
    created: number;
    skipped: number;
  };
}

export interface ConversionOptions {
  /** Existing work keys to check for duplicates (from DB) */
  existingWorkKeys?: Set<string>;
  /** Dry run - return what would be created without creating */
  dryRun?: boolean;
}

// ============================================================================
// Core Conversion Logic
// ============================================================================

/**
 * Convert an approved plan to work items with idempotency checking
 */
export function convertPlanToWorkItems(
  plan: Plan,
  companyId: string,
  options: ConversionOptions = {}
): PlanConversionResult {
  const { existingWorkKeys = new Set() } = options;

  // Route to appropriate mapper based on plan type
  let allItems: ConvertedWorkItem[];
  let planType: PlanType;

  if (isMediaPlan(plan)) {
    const result = convertMediaPlanToWorkItems(plan, companyId);
    allItems = result.all;
    planType = 'media';
  } else if (isContentPlan(plan)) {
    const result = convertContentPlanToWorkItems(plan, companyId);
    allItems = result.all;
    planType = 'content';
  } else {
    throw new Error('Unknown plan type');
  }

  // Filter out duplicates based on work keys
  const workItemsToCreate: ConvertedWorkItem[] = [];
  const skippedWorkKeys: string[] = [];

  for (const item of allItems) {
    const workKey = item.source.workKey;
    if (existingWorkKeys.has(workKey)) {
      skippedWorkKeys.push(workKey);
    } else {
      workItemsToCreate.push(item);
    }
  }

  return {
    planId: plan.id,
    planType,
    planVersion: plan.version,
    companyId,
    workItemsToCreate,
    skippedWorkKeys,
    stats: {
      total: allItems.length,
      created: workItemsToCreate.length,
      skipped: skippedWorkKeys.length,
    },
  };
}

/**
 * Extract all work keys from a conversion result
 */
export function extractWorkKeys(result: PlanConversionResult): string[] {
  return result.workItemsToCreate.map((item) => item.source.workKey);
}

/**
 * Get detailed breakdown by section
 */
export function getConversionBreakdown(
  plan: Plan,
  companyId: string
): { sectionId: string; sectionName: string; count: number }[] {
  const items = isMediaPlan(plan)
    ? convertMediaPlanToWorkItems(plan, companyId).all
    : convertContentPlanToWorkItems(plan, companyId).all;

  // Group by section
  const sectionMap = new Map<string, { sectionName: string; count: number }>();

  for (const item of items) {
    const { sectionId, sectionName } = item.source;
    const existing = sectionMap.get(sectionId);
    if (existing) {
      existing.count++;
    } else {
      sectionMap.set(sectionId, { sectionName, count: 1 });
    }
  }

  return Array.from(sectionMap.entries()).map(([sectionId, data]) => ({
    sectionId,
    sectionName: data.sectionName,
    count: data.count,
  }));
}

// ============================================================================
// Work Item Factory
// ============================================================================

/**
 * Convert a ConvertedWorkItem to a partial WorkItem for database insertion
 */
export function toWorkItemInput(
  item: ConvertedWorkItem,
  companyId: string,
  companyName?: string
): Omit<WorkItem, 'id'> {
  return {
    title: item.title,
    status: 'Backlog',
    companyId,
    companyName,
    area: item.area,
    severity: item.severity,
    notes: item.notes,
    source: item.source,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Batch convert items to WorkItem inputs
 */
export function toWorkItemInputs(
  result: PlanConversionResult,
  companyName?: string
): Omit<WorkItem, 'id'>[] {
  return result.workItemsToCreate.map((item) =>
    toWorkItemInput(item, result.companyId, companyName)
  );
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a plan can be converted
 */
export function validatePlanForConversion(plan: Plan): { valid: boolean; error?: string } {
  if (plan.status !== 'approved') {
    return {
      valid: false,
      error: `Plan must be approved to convert to work items. Current status: ${plan.status}`,
    };
  }

  if (plan.version < 1) {
    return {
      valid: false,
      error: 'Plan version must be at least 1',
    };
  }

  return { valid: true };
}

/**
 * Get plan type from a Plan object
 */
export function getPlanType(plan: Plan): PlanType {
  if (isMediaPlan(plan)) return 'media';
  if (isContentPlan(plan)) return 'content';
  throw new Error('Unknown plan type');
}
