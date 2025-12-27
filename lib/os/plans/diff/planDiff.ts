// lib/os/plans/diff/planDiff.ts
// Plan Diff Utility
//
// Compares two plans of the same type and generates a structured diff
// that can drive the UI. Whitelists known sections for MediaPlan and ContentPlan.

import type {
  Plan,
  MediaPlan,
  ContentPlan,
  MediaPlanSections,
  ContentPlanSections,
  PlanType,
} from '@/lib/types/plan';
import { isMediaPlan, isContentPlan } from '@/lib/types/plan';

// ============================================================================
// Types
// ============================================================================

export type ChangeType = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * A single field-level change
 */
export interface FieldChange {
  field: string;
  fieldLabel: string;
  type: ChangeType;
  oldValue?: unknown;
  newValue?: unknown;
  /** Truncated preview for long text */
  oldPreview?: string;
  newPreview?: string;
}

/**
 * A list item change (for arrays)
 */
export interface ListItemChange {
  type: 'added' | 'removed' | 'changed';
  /** Human-readable identifier for the item */
  itemLabel: string;
  /** The item data */
  oldItem?: unknown;
  newItem?: unknown;
}

/**
 * Changes within a section
 */
export interface SectionChange {
  sectionKey: string;
  sectionLabel: string;
  /** Whether the entire section is new/removed/changed */
  sectionType: ChangeType;
  /** Individual field changes */
  fieldChanges: FieldChange[];
  /** List item changes (for array sections) */
  listChanges: ListItemChange[];
}

/**
 * The complete diff result
 */
export interface PlanDiff {
  planType: PlanType;
  /** Whether there are any changes */
  hasChanges: boolean;
  /** Is this a new plan (no approved plan to compare) */
  isNewPlan: boolean;
  /** Changes organized by section */
  sections: SectionChange[];
  /** Summary statistics */
  stats: {
    sectionsChanged: number;
    fieldsChanged: number;
    itemsAdded: number;
    itemsRemoved: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const MAX_PREVIEW_LENGTH = 240;

const MEDIA_PLAN_SECTION_LABELS: Record<keyof MediaPlanSections, string> = {
  summary: 'Summary',
  budget: 'Budget',
  markets: 'Markets & Geography',
  kpis: 'KPIs',
  measurement: 'Measurement',
  channelMix: 'Channel Mix',
  campaigns: 'Campaigns',
  cadence: 'Operational Cadence',
  risks: 'Risks',
  approvals: 'Approvals',
};

const CONTENT_PLAN_SECTION_LABELS: Record<keyof ContentPlanSections, string> = {
  summary: 'Summary',
  audiences: 'Target Audiences',
  pillars: 'Content Pillars',
  calendar: 'Content Calendar',
  seo: 'SEO Strategy',
  distribution: 'Distribution',
  production: 'Production',
  measurement: 'Measurement',
  risks: 'Risks',
  approvals: 'Approvals',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a truncated preview of a string value
 */
function truncatePreview(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= MAX_PREVIEW_LENGTH) return str;
  return str.slice(0, MAX_PREVIEW_LENGTH) + '...';
}

/**
 * Check if two values are deeply equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }

  return false;
}

/**
 * Get a label for a list item (for display in diff)
 */
function getItemLabel(item: unknown, type: string): string {
  if (!item || typeof item !== 'object') return 'Unknown';
  const obj = item as Record<string, unknown>;

  // Try common fields
  if (obj.name) return String(obj.name);
  if (obj.title) return String(obj.title);
  if (obj.channel) return String(obj.channel);
  if (obj.pillar) return String(obj.pillar);
  if (obj.segment) return String(obj.segment);
  if (obj.description) return truncatePreview(obj.description);
  if (obj.id) return `${type} ${obj.id}`;

  return type;
}

/**
 * Compare two arrays and find added/removed items
 */
function diffArrays(
  oldArr: unknown[] | undefined,
  newArr: unknown[] | undefined,
  itemType: string
): ListItemChange[] {
  const changes: ListItemChange[] = [];
  const old = oldArr || [];
  const next = newArr || [];

  // Create maps by ID or serialized value for comparison
  const getKey = (item: unknown): string => {
    if (item && typeof item === 'object' && 'id' in item) {
      return String((item as Record<string, unknown>).id);
    }
    return JSON.stringify(item);
  };

  const oldMap = new Map(old.map((item) => [getKey(item), item]));
  const newMap = new Map(next.map((item) => [getKey(item), item]));

  // Find removed items
  for (const [key, oldItem] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'removed',
        itemLabel: getItemLabel(oldItem, itemType),
        oldItem,
      });
    } else {
      // Check if changed
      const newItem = newMap.get(key);
      if (!deepEqual(oldItem, newItem)) {
        changes.push({
          type: 'changed',
          itemLabel: getItemLabel(newItem, itemType),
          oldItem,
          newItem,
        });
      }
    }
  }

  // Find added items
  for (const [key, newItem] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        type: 'added',
        itemLabel: getItemLabel(newItem, itemType),
        newItem,
      });
    }
  }

  return changes;
}

/**
 * Compare two objects and find field changes
 */
function diffFields(
  oldObj: Record<string, unknown> | undefined,
  newObj: Record<string, unknown> | undefined,
  fieldLabels: Record<string, string> = {}
): FieldChange[] {
  const changes: FieldChange[] = [];
  const old = oldObj || {};
  const next = newObj || {};

  // Get all keys
  const allKeys = new Set([...Object.keys(old), ...Object.keys(next)]);

  for (const key of allKeys) {
    // Skip arrays (handled separately as list changes)
    if (Array.isArray(old[key]) || Array.isArray(next[key])) continue;
    // Skip nested objects (except for simple value objects)
    if (
      (old[key] && typeof old[key] === 'object' && !isSimpleValue(old[key])) ||
      (next[key] && typeof next[key] === 'object' && !isSimpleValue(next[key]))
    ) {
      continue;
    }

    const oldVal = old[key];
    const newVal = next[key];
    const label = fieldLabels[key] || formatFieldLabel(key);

    if (oldVal === undefined && newVal !== undefined) {
      changes.push({
        field: key,
        fieldLabel: label,
        type: 'added',
        newValue: newVal,
        newPreview: truncatePreview(newVal),
      });
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.push({
        field: key,
        fieldLabel: label,
        type: 'removed',
        oldValue: oldVal,
        oldPreview: truncatePreview(oldVal),
      });
    } else if (!deepEqual(oldVal, newVal)) {
      changes.push({
        field: key,
        fieldLabel: label,
        type: 'changed',
        oldValue: oldVal,
        newValue: newVal,
        oldPreview: truncatePreview(oldVal),
        newPreview: truncatePreview(newVal),
      });
    }
  }

  return changes;
}

/**
 * Check if a value is a simple (serializable) value
 */
function isSimpleValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  const type = typeof val;
  return type === 'string' || type === 'number' || type === 'boolean';
}

/**
 * Format a camelCase field key as a label
 */
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ============================================================================
// Section Diff Functions
// ============================================================================

/**
 * Diff a simple object section
 */
function diffObjectSection(
  sectionKey: string,
  sectionLabel: string,
  oldSection: Record<string, unknown> | undefined,
  newSection: Record<string, unknown> | undefined
): SectionChange {
  const fieldChanges = diffFields(oldSection, newSection);

  let sectionType: ChangeType = 'unchanged';
  if (!oldSection && newSection) {
    sectionType = 'added';
  } else if (oldSection && !newSection) {
    sectionType = 'removed';
  } else if (fieldChanges.length > 0) {
    sectionType = 'changed';
  }

  return {
    sectionKey,
    sectionLabel,
    sectionType,
    fieldChanges,
    listChanges: [],
  };
}

/**
 * Diff an array section
 */
function diffArraySection(
  sectionKey: string,
  sectionLabel: string,
  oldArray: unknown[] | undefined,
  newArray: unknown[] | undefined,
  itemType: string
): SectionChange {
  const listChanges = diffArrays(oldArray, newArray, itemType);

  let sectionType: ChangeType = 'unchanged';
  if ((!oldArray || oldArray.length === 0) && newArray && newArray.length > 0) {
    sectionType = 'added';
  } else if (oldArray && oldArray.length > 0 && (!newArray || newArray.length === 0)) {
    sectionType = 'removed';
  } else if (listChanges.length > 0) {
    sectionType = 'changed';
  }

  return {
    sectionKey,
    sectionLabel,
    sectionType,
    fieldChanges: [],
    listChanges,
  };
}

// ============================================================================
// Main Diff Functions
// ============================================================================

/**
 * Diff two Media Plans
 */
function diffMediaPlans(
  approved: MediaPlan | null,
  proposed: MediaPlan
): SectionChange[] {
  const oldSections = approved?.sections;
  const newSections = proposed.sections;
  const sections: SectionChange[] = [];

  // Summary (object)
  sections.push(
    diffObjectSection(
      'summary',
      MEDIA_PLAN_SECTION_LABELS.summary,
      oldSections?.summary as Record<string, unknown> | undefined,
      newSections.summary as unknown as Record<string, unknown>
    )
  );

  // Budget (object)
  sections.push(
    diffObjectSection(
      'budget',
      MEDIA_PLAN_SECTION_LABELS.budget,
      oldSections?.budget as Record<string, unknown> | undefined,
      newSections.budget as unknown as Record<string, unknown>
    )
  );

  // Markets (object with nested array)
  sections.push(
    diffObjectSection(
      'markets',
      MEDIA_PLAN_SECTION_LABELS.markets,
      oldSections?.markets as Record<string, unknown> | undefined,
      newSections.markets as unknown as Record<string, unknown>
    )
  );

  // Measurement (object)
  sections.push(
    diffObjectSection(
      'measurement',
      MEDIA_PLAN_SECTION_LABELS.measurement,
      oldSections?.measurement as Record<string, unknown> | undefined,
      newSections.measurement as unknown as Record<string, unknown>
    )
  );

  // Channel Mix (array)
  sections.push(
    diffArraySection(
      'channelMix',
      MEDIA_PLAN_SECTION_LABELS.channelMix,
      oldSections?.channelMix,
      newSections.channelMix,
      'Channel'
    )
  );

  // Campaigns (array)
  sections.push(
    diffArraySection(
      'campaigns',
      MEDIA_PLAN_SECTION_LABELS.campaigns,
      oldSections?.campaigns,
      newSections.campaigns,
      'Campaign'
    )
  );

  // Cadence (object with arrays)
  sections.push(
    diffObjectSection(
      'cadence',
      MEDIA_PLAN_SECTION_LABELS.cadence,
      oldSections?.cadence as Record<string, unknown> | undefined,
      newSections.cadence as unknown as Record<string, unknown>
    )
  );

  // Risks (array)
  sections.push(
    diffArraySection(
      'risks',
      MEDIA_PLAN_SECTION_LABELS.risks,
      oldSections?.risks,
      newSections.risks,
      'Risk'
    )
  );

  return sections;
}

/**
 * Diff two Content Plans
 */
function diffContentPlans(
  approved: ContentPlan | null,
  proposed: ContentPlan
): SectionChange[] {
  const oldSections = approved?.sections;
  const newSections = proposed.sections;
  const sections: SectionChange[] = [];

  // Summary (object)
  sections.push(
    diffObjectSection(
      'summary',
      CONTENT_PLAN_SECTION_LABELS.summary,
      oldSections?.summary as Record<string, unknown> | undefined,
      newSections.summary as unknown as Record<string, unknown>
    )
  );

  // Audiences (nested object with segments array)
  const oldSegments = oldSections?.audiences?.segments;
  const newSegments = newSections.audiences?.segments;
  sections.push(
    diffArraySection(
      'audiences',
      CONTENT_PLAN_SECTION_LABELS.audiences,
      oldSegments,
      newSegments,
      'Audience Segment'
    )
  );

  // Pillars (array)
  sections.push(
    diffArraySection(
      'pillars',
      CONTENT_PLAN_SECTION_LABELS.pillars,
      oldSections?.pillars,
      newSections.pillars,
      'Pillar'
    )
  );

  // Calendar (array)
  sections.push(
    diffArraySection(
      'calendar',
      CONTENT_PLAN_SECTION_LABELS.calendar,
      oldSections?.calendar,
      newSections.calendar,
      'Calendar Item'
    )
  );

  // SEO (object)
  sections.push(
    diffObjectSection(
      'seo',
      CONTENT_PLAN_SECTION_LABELS.seo,
      oldSections?.seo as Record<string, unknown> | undefined,
      newSections.seo as unknown as Record<string, unknown>
    )
  );

  // Distribution (object with nested channels array)
  const oldChannels = oldSections?.distribution?.channels;
  const newChannels = newSections.distribution?.channels;
  sections.push(
    diffArraySection(
      'distribution',
      CONTENT_PLAN_SECTION_LABELS.distribution,
      oldChannels,
      newChannels,
      'Distribution Channel'
    )
  );

  // Production (object)
  sections.push(
    diffObjectSection(
      'production',
      CONTENT_PLAN_SECTION_LABELS.production,
      oldSections?.production as Record<string, unknown> | undefined,
      newSections.production as unknown as Record<string, unknown>
    )
  );

  // Measurement (object)
  sections.push(
    diffObjectSection(
      'measurement',
      CONTENT_PLAN_SECTION_LABELS.measurement,
      oldSections?.measurement as Record<string, unknown> | undefined,
      newSections.measurement as unknown as Record<string, unknown>
    )
  );

  // Risks (array)
  sections.push(
    diffArraySection(
      'risks',
      CONTENT_PLAN_SECTION_LABELS.risks,
      oldSections?.risks,
      newSections.risks,
      'Risk'
    )
  );

  return sections;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Compare an approved plan with a proposed plan and generate a structured diff.
 *
 * @param approvedPlan - The currently approved plan (null if this is the first version)
 * @param proposedPlan - The proposed plan
 * @returns A structured diff that can drive the UI
 */
export function computePlanDiff(
  approvedPlan: Plan | null,
  proposedPlan: Plan
): PlanDiff {
  const isNewPlan = approvedPlan === null;
  const planType: PlanType = isMediaPlan(proposedPlan) ? 'media' : 'content';

  // Validate types match
  if (approvedPlan && isMediaPlan(approvedPlan) !== isMediaPlan(proposedPlan)) {
    throw new Error('Cannot diff plans of different types');
  }

  // Compute section diffs based on plan type
  let sections: SectionChange[];
  if (isMediaPlan(proposedPlan)) {
    sections = diffMediaPlans(
      approvedPlan as MediaPlan | null,
      proposedPlan
    );
  } else if (isContentPlan(proposedPlan)) {
    sections = diffContentPlans(
      approvedPlan as ContentPlan | null,
      proposedPlan
    );
  } else {
    throw new Error('Unknown plan type');
  }

  // Filter to only changed sections for cleaner UI
  const changedSections = sections.filter((s) => s.sectionType !== 'unchanged');

  // Compute stats
  const stats = {
    sectionsChanged: changedSections.length,
    fieldsChanged: changedSections.reduce(
      (sum, s) => sum + s.fieldChanges.filter((f) => f.type !== 'unchanged').length,
      0
    ),
    itemsAdded: changedSections.reduce(
      (sum, s) => sum + s.listChanges.filter((c) => c.type === 'added').length,
      0
    ),
    itemsRemoved: changedSections.reduce(
      (sum, s) => sum + s.listChanges.filter((c) => c.type === 'removed').length,
      0
    ),
  };

  return {
    planType,
    hasChanges: changedSections.length > 0 || isNewPlan,
    isNewPlan,
    sections: changedSections,
    stats,
  };
}

/**
 * Get a human-readable summary of the diff
 */
export function getDiffSummary(diff: PlanDiff): string {
  if (diff.isNewPlan) {
    return 'This is a new plan. Accepting will create v1.';
  }

  if (!diff.hasChanges) {
    return 'No changes detected between approved and proposed plans.';
  }

  const parts: string[] = [];

  if (diff.stats.sectionsChanged > 0) {
    parts.push(
      `${diff.stats.sectionsChanged} section${diff.stats.sectionsChanged === 1 ? '' : 's'} changed`
    );
  }

  if (diff.stats.itemsAdded > 0) {
    parts.push(
      `${diff.stats.itemsAdded} item${diff.stats.itemsAdded === 1 ? '' : 's'} added`
    );
  }

  if (diff.stats.itemsRemoved > 0) {
    parts.push(
      `${diff.stats.itemsRemoved} item${diff.stats.itemsRemoved === 1 ? '' : 's'} removed`
    );
  }

  return parts.join(', ') || 'Changes detected.';
}
