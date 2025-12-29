// lib/os/planning/programToWork.ts
// Bridge between Planning Programs and Work Items
//
// This module provides deterministic mapping from Program deliverables
// to Work items when a Program is committed.

import type {
  PlanningProgram,
  PlanningDeliverable,
  WorkstreamType,
} from '@/lib/types/program';
import type {
  CreateWorkItemInput,
  WorkItemArea,
} from '@/lib/airtable/workItems';
import type { WorkSource, StrategyLink } from '@/lib/types/work';
import { WORKSTREAM_LABELS } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

export interface WorkItemDraft {
  title: string;
  notes: string;
  area: WorkItemArea;
  source: WorkSource;
  strategyLink: StrategyLink;
  workstreamType: WorkstreamType;
  dueDate?: string;
}

export interface ProgramToWorkResult {
  workItemDrafts: WorkItemDraft[];
  summary: {
    totalItems: number;
    fromDeliverables: number;
    fromMilestones: number;
    setupItems: number;
  };
}

/**
 * Work plan item - a single work item in the plan
 */
export interface WorkPlanItem {
  /** Stable key within program (e.g., "del::0", "milestone::1", "setup") */
  workKey: string;
  title: string;
  notes: string;
  area: WorkItemArea;
  workstreamType: WorkstreamType;
  dueDate?: string;
}

/**
 * Work plan - the complete set of work items for a program
 */
export interface WorkPlan {
  items: WorkPlanItem[];
  generatedAt: string;
  /** Hash of inputs for change detection */
  inputHash: string;
}

/**
 * Default work items when program has no deliverables/milestones
 */
const DEFAULT_WORK_ITEMS: Omit<WorkPlanItem, 'workKey'>[] = [
  {
    title: 'Kickoff',
    notes: 'Initial kickoff meeting and planning session. Review scope, align on goals, identify dependencies.',
    area: 'Strategy',
    workstreamType: 'ops',
  },
  {
    title: 'Build',
    notes: 'Core implementation work. Execute on the program deliverables.',
    area: 'Other',
    workstreamType: 'other',
  },
  {
    title: 'QA & Launch',
    notes: 'Quality assurance, final review, and launch activities.',
    area: 'Other',
    workstreamType: 'other',
  },
];

// ============================================================================
// Workstream to Area Mapping
// ============================================================================

const WORKSTREAM_TO_AREA: Record<WorkstreamType, WorkItemArea> = {
  content: 'Content',
  website: 'Website UX',
  seo: 'SEO',
  email: 'Content',
  partnerships: 'Strategy',
  paid_media: 'Other',
  social: 'Content',
  brand: 'Brand',
  analytics: 'Analytics',
  conversion: 'Funnel',
  ops: 'Operations',
  other: 'Other',
};

/**
 * Get Work item area from workstream type
 */
function getAreaFromWorkstream(workstream?: WorkstreamType): WorkItemArea {
  if (!workstream) return 'Other';
  return WORKSTREAM_TO_AREA[workstream] || 'Other';
}

// ============================================================================
// Core Mapping Functions
// ============================================================================

/**
 * Build a WorkSource for a program-sourced work item
 */
function buildProgramWorkSource(
  program: PlanningProgram,
  deliverableIndex: number
): WorkSource {
  return {
    sourceType: 'strategy_handoff',
    strategyId: program.strategyId,
    strategyTitle: program.title,
    programId: program.id,
    programType: program.scope.workstreams[0] || 'other',
    initiativeTitle: program.title,
    workKey: `${program.id}::del::${deliverableIndex}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a StrategyLink from program origin
 */
function buildStrategyLink(program: PlanningProgram): StrategyLink {
  return {
    strategyId: program.origin.strategyId,
    objectiveId: program.origin.objectiveId,
    betId: program.origin.betId,
    tacticId: program.origin.tacticId,
    tacticTitle: program.origin.tacticTitle,
  };
}

/**
 * Convert a single deliverable to a Work item draft
 */
function deliverableToWorkDraft(
  program: PlanningProgram,
  deliverable: PlanningDeliverable,
  index: number
): WorkItemDraft {
  const workstreamType = deliverable.workstreamType || program.scope.workstreams[0] || 'other';
  const workstreamLabel = WORKSTREAM_LABELS[workstreamType] || 'Other';

  // Build notes with context
  const notesParts: string[] = [];
  if (deliverable.description) {
    notesParts.push(deliverable.description);
  }
  notesParts.push(`\n---\nProgram: ${program.title}`);
  notesParts.push(`Workstream: ${workstreamLabel}`);
  if (program.origin.tacticTitle) {
    notesParts.push(`From Tactic: ${program.origin.tacticTitle}`);
  }

  return {
    title: deliverable.title,
    notes: notesParts.join('\n'),
    area: getAreaFromWorkstream(workstreamType),
    source: buildProgramWorkSource(program, index),
    strategyLink: buildStrategyLink(program),
    workstreamType,
    dueDate: deliverable.dueDate,
  };
}

/**
 * Create a program setup/kickoff work item
 */
function createSetupWorkItem(program: PlanningProgram): WorkItemDraft {
  const workstreamType = program.scope.workstreams[0] || 'other';

  const notesParts: string[] = [
    `Program kickoff and setup for: ${program.title}`,
    '',
    '**Initial Tasks:**',
    '- Review program scope and deliverables',
    '- Confirm success criteria and KPIs',
    '- Identify dependencies and blockers',
    '- Set up tracking and reporting',
  ];

  if (program.scope.constraints.length > 0) {
    notesParts.push('', '**Constraints:**');
    program.scope.constraints.forEach(c => notesParts.push(`- ${c}`));
  }

  if (program.scope.dependencies.length > 0) {
    notesParts.push('', '**Dependencies:**');
    program.scope.dependencies.forEach(d => notesParts.push(`- ${d}`));
  }

  return {
    title: `[Setup] ${program.title}`,
    notes: notesParts.join('\n'),
    area: getAreaFromWorkstream(workstreamType),
    source: {
      sourceType: 'strategy_handoff',
      strategyId: program.strategyId,
      strategyTitle: program.title,
      programId: program.id,
      programType: workstreamType,
      initiativeTitle: program.title,
      workKey: `${program.id}::setup`,
      createdAt: new Date().toISOString(),
    },
    strategyLink: buildStrategyLink(program),
    workstreamType,
  };
}

/**
 * Create milestone tracking work items
 */
function createMilestoneWorkItems(program: PlanningProgram): WorkItemDraft[] {
  return program.planDetails.milestones
    .filter(m => m.status === 'pending' || m.status === 'in_progress')
    .map((milestone, index) => {
      const workstreamType = program.scope.workstreams[0] || 'other';

      return {
        title: `[Milestone] ${milestone.title}`,
        notes: `Milestone for program: ${program.title}\n\nEnsure this milestone is tracked and completed on schedule.`,
        area: getAreaFromWorkstream(workstreamType),
        source: {
          sourceType: 'strategy_handoff',
          strategyId: program.strategyId,
          strategyTitle: program.title,
          programId: program.id,
          programType: workstreamType,
          initiativeTitle: program.title,
          workKey: `${program.id}::milestone::${index}`,
          createdAt: new Date().toISOString(),
        },
        strategyLink: buildStrategyLink(program),
        workstreamType,
        dueDate: milestone.dueDate,
      };
    });
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build Work item drafts from a Planning Program
 *
 * This is deterministic - same program always produces same work items.
 * No LLM calls are made.
 */
export function buildWorkItemsFromProgram(program: PlanningProgram): ProgramToWorkResult {
  const workItemDrafts: WorkItemDraft[] = [];
  let fromDeliverables = 0;
  let fromMilestones = 0;
  let setupItems = 0;

  // 1. Add setup item if program has content
  if (program.scope.deliverables.length > 0 || program.planDetails.milestones.length > 0) {
    workItemDrafts.push(createSetupWorkItem(program));
    setupItems = 1;
  }

  // 2. Convert each deliverable to a work item
  program.scope.deliverables.forEach((deliverable, index) => {
    // Skip completed or cancelled deliverables
    if (deliverable.status === 'completed' || deliverable.status === 'cancelled') {
      return;
    }

    workItemDrafts.push(deliverableToWorkDraft(program, deliverable, index));
    fromDeliverables++;
  });

  // 3. Add milestone work items
  const milestoneItems = createMilestoneWorkItems(program);
  workItemDrafts.push(...milestoneItems);
  fromMilestones = milestoneItems.length;

  return {
    workItemDrafts,
    summary: {
      totalItems: workItemDrafts.length,
      fromDeliverables,
      fromMilestones,
      setupItems,
    },
  };
}

/**
 * Convert WorkItemDrafts to CreateWorkItemInputs
 */
export function draftsToCreateInputs(
  drafts: WorkItemDraft[],
  companyId: string
): CreateWorkItemInput[] {
  return drafts.map(draft => ({
    title: draft.title,
    companyId,
    notes: draft.notes,
    area: draft.area,
    source: draft.source,
    strategyLink: draft.strategyLink,
    workstreamType: draft.workstreamType,
    dueDate: draft.dueDate,
    status: 'Backlog',
  }));
}

/**
 * Get a unique key for a work item draft (for deduplication)
 */
export function getWorkDraftKey(draft: WorkItemDraft): string {
  if ('workKey' in draft.source && draft.source.workKey) {
    return draft.source.workKey;
  }
  // Fallback to title-based key
  return `${draft.strategyLink.strategyId}::${draft.title.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Check if work items already exist for a program
 * Returns the work keys that already exist
 */
export function findExistingWorkKeys(
  program: PlanningProgram
): string[] {
  // Work item IDs from commitment record
  return program.commitment.workItemIds || [];
}

/**
 * Filter out drafts that would be duplicates
 */
export function filterDuplicateDrafts(
  drafts: WorkItemDraft[],
  existingKeys: string[]
): WorkItemDraft[] {
  const existingSet = new Set(existingKeys);
  return drafts.filter(draft => !existingSet.has(getWorkDraftKey(draft)));
}

// ============================================================================
// Work Plan Building (for materialization)
// ============================================================================

/**
 * Generate a hash of program inputs for change detection
 * Uses a simple string hash algorithm for better distribution
 */
function generateInputHash(program: PlanningProgram): string {
  const inputs = {
    title: program.title,
    deliverables: program.scope.deliverables.map(d => ({
      title: d.title,
      status: d.status,
      dueDate: d.dueDate,
      description: d.description,
    })),
    milestones: program.planDetails.milestones.map(m => ({
      title: m.title,
      status: m.status,
      dueDate: m.dueDate,
    })),
    workstreams: program.scope.workstreams,
  };

  // Simple string hash function (djb2 algorithm)
  const str = JSON.stringify(inputs);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex string (positive number)
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Build notes for a setup work item
 */
function buildSetupNotes(program: PlanningProgram): string {
  const notesParts: string[] = [
    `Program kickoff and setup for: ${program.title}`,
    '',
    '**Initial Tasks:**',
    '- Review program scope and deliverables',
    '- Confirm success criteria and KPIs',
    '- Identify dependencies and blockers',
    '- Set up tracking and reporting',
  ];

  if (program.scope.constraints.length > 0) {
    notesParts.push('', '**Constraints:**');
    program.scope.constraints.forEach(c => notesParts.push(`- ${c}`));
  }

  if (program.scope.dependencies.length > 0) {
    notesParts.push('', '**Dependencies:**');
    program.scope.dependencies.forEach(d => notesParts.push(`- ${d}`));
  }

  return notesParts.join('\n');
}

/**
 * Build notes for a deliverable work item
 */
function buildDeliverableNotes(program: PlanningProgram, deliverable: PlanningDeliverable): string {
  const workstreamType = deliverable.workstreamType || program.scope.workstreams[0] || 'other';
  const workstreamLabel = WORKSTREAM_LABELS[workstreamType] || 'Other';

  const notesParts: string[] = [];
  if (deliverable.description) {
    notesParts.push(deliverable.description);
  }
  notesParts.push(`\n---\nProgram: ${program.title}`);
  notesParts.push(`Workstream: ${workstreamLabel}`);
  if (program.origin.tacticTitle) {
    notesParts.push(`From Tactic: ${program.origin.tacticTitle}`);
  }

  return notesParts.join('\n');
}

/**
 * Build a deterministic work plan from a program.
 * Same program inputs always produce the same work keys.
 *
 * If no deliverables/milestones exist, generates 3 default items.
 */
export function buildProgramWorkPlan(program: PlanningProgram): WorkPlan {
  const items: WorkPlanItem[] = [];

  const hasDeliverables = program.scope.deliverables.length > 0;
  const hasMilestones = program.planDetails.milestones.length > 0;

  if (!hasDeliverables && !hasMilestones) {
    // Generate default items when no structure exists
    DEFAULT_WORK_ITEMS.forEach((item, index) => {
      items.push({
        ...item,
        workKey: `default::${index}`,
      });
    });
  } else {
    // Setup item (only if there are deliverables or milestones)
    const workstreamType = program.scope.workstreams[0] || 'other';
    items.push({
      workKey: 'setup',
      title: `[Setup] ${program.title}`,
      notes: buildSetupNotes(program),
      area: getAreaFromWorkstream(workstreamType),
      workstreamType,
    });

    // Deliverables
    program.scope.deliverables.forEach((del, index) => {
      if (del.status === 'completed' || del.status === 'cancelled') return;

      const delWorkstreamType = del.workstreamType || program.scope.workstreams[0] || 'other';
      items.push({
        workKey: `del::${index}`,
        title: del.title,
        notes: buildDeliverableNotes(program, del),
        area: getAreaFromWorkstream(delWorkstreamType),
        workstreamType: delWorkstreamType,
        dueDate: del.dueDate,
      });
    });

    // Milestones
    program.planDetails.milestones
      .filter(m => m.status === 'pending' || m.status === 'in_progress')
      .forEach((milestone, index) => {
        const msWorkstreamType = program.scope.workstreams[0] || 'other';
        items.push({
          workKey: `milestone::${index}`,
          title: `[Milestone] ${milestone.title}`,
          notes: `Milestone for program: ${program.title}\n\nEnsure this milestone is tracked and completed on schedule.`,
          area: getAreaFromWorkstream(msWorkstreamType),
          workstreamType: msWorkstreamType,
          dueDate: milestone.dueDate,
        });
      });
  }

  return {
    items,
    generatedAt: new Date().toISOString(),
    inputHash: generateInputHash(program),
  };
}
