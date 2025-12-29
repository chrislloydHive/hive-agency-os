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
