// app/api/os/companies/[companyId]/strategy/[strategyId]/handoff/apply/route.ts
// Apply Strategy Handoff - Create Programs and Work Items
//
// WHY: Single endpoint to apply an AI-generated handoff proposal.
// Upserts Programs and Work Items with deduplication by stable keys.
// All created records link back to Strategy/Objectives/Priorities/Tactics.
//
// FLOW: StrategyProgramProposal → Apply → Programs + Work Items (with linkage)

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/lib/os/strategy';
import {
  getProgramsForCompany,
  createProgram,
  updateProgramPlan,
} from '@/lib/airtable/programs';
import {
  createWorkItem,
  getWorkItemsForCompany,
} from '@/lib/airtable/workItems';
import { deleteDraftByKey } from '@/lib/os/strategy/drafts';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeAllHashes } from '@/lib/os/strategy/hashes';
import type {
  StrategyProgramProposal,
  ProposedProgram,
  ProposedInitiative,
  ProposedWorkItem,
  HandoffApplyResult,
  WorkSourceStrategyHandoff,
  ExtendedProgramType,
} from '@/lib/os/strategy/strategyToPrograms';
import type { ProgramType, WebsiteProgramPlan } from '@/lib/types/program';
import type { WorkItemArea, WorkItemSeverity } from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

interface ApplyHandoffRequest {
  /** The proposal to apply */
  proposal: StrategyProgramProposal;
  /** Optional: Exclude these program types */
  excludeProgramTypes?: ExtendedProgramType[];
  /** Optional: Exclude these initiative keys */
  excludeInitiativeKeys?: string[];
  /** Optional: Force apply even if duplicates exist */
  forceApply?: boolean;
}

// ============================================================================
// POST Handler - Apply Handoff
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;
    const body = (await request.json()) as ApplyHandoffRequest;
    const { proposal, excludeProgramTypes = [], excludeInitiativeKeys = [] } = body;

    console.log('[handoff/apply] Starting apply:', {
      companyId,
      strategyId,
      proposalId: proposal.id,
      programCount: proposal.programs.length,
    });

    // Validate proposal matches this strategy
    if (proposal.source.strategyId !== strategyId) {
      return NextResponse.json(
        { error: 'Proposal does not match this strategy' },
        { status: 400 }
      );
    }

    // Load strategy for validation and linkage data
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // -------------------------------------------------------------------------
    // STALENESS CHECK: Prevent stale proposals from creating outdated work
    // -------------------------------------------------------------------------
    // WHY: Proposals are generated based on a snapshot of context/objectives/strategy.
    // If those inputs changed since generation, the proposal may no longer be appropriate.
    // User must explicitly acknowledge with forceApply=true.
    // -------------------------------------------------------------------------
    if (proposal.source.basedOnHashes && !body.forceApply) {
      const context = await loadContextGraph(companyId);
      const currentHashes = computeAllHashes(
        context,
        strategy.objectives || [],
        {
          title: strategy.title,
          summary: strategy.summary,
          pillars: strategy.pillars,
          strategyFrame: strategy.strategyFrame,
          tradeoffs: strategy.tradeoffs,
        },
        strategy.plays || []
      );

      const staleScopes: string[] = [];

      if (proposal.source.basedOnHashes.contextHash &&
          proposal.source.basedOnHashes.contextHash !== currentHashes.contextHash) {
        staleScopes.push('context');
      }
      if (proposal.source.basedOnHashes.objectivesHash &&
          proposal.source.basedOnHashes.objectivesHash !== currentHashes.objectivesHash) {
        staleScopes.push('objectives');
      }
      if (proposal.source.basedOnHashes.strategyHash &&
          proposal.source.basedOnHashes.strategyHash !== currentHashes.strategyHash) {
        staleScopes.push('strategy');
      }
      if (proposal.source.basedOnHashes.tacticsHash &&
          proposal.source.basedOnHashes.tacticsHash !== currentHashes.tacticsHash) {
        staleScopes.push('tactics');
      }

      if (staleScopes.length > 0) {
        return NextResponse.json({
          status: 'stale',
          staleScopes,
          message: `Proposal is stale: ${staleScopes.join(', ')} changed since generation. Pass forceApply=true to apply anyway.`,
          proposal: {
            id: proposal.id,
            programCount: proposal.programs.length,
          },
        }, { status: 409 }); // 409 Conflict
      }
    }

    // Initialize result tracking
    const result: HandoffApplyResult = {
      success: true,
      programs: { created: [], updated: [], skipped: [] },
      initiatives: { created: 0, updated: 0, skipped: 0 },
      workItems: { created: [], skipped: [] },
      errors: [],
    };

    // Load existing programs and work items for deduplication
    const existingPrograms = await getProgramsForCompany(companyId);
    const existingWorkItems = await getWorkItemsForCompany(companyId);

    // Build lookup maps by source keys
    const existingWorkByKey = new Map<string, string>();
    for (const work of existingWorkItems) {
      if (work.source?.sourceType === 'strategy_handoff') {
        const source = work.source as unknown as WorkSourceStrategyHandoff;
        if (source.initiativeKey) {
          // Key: initiativeKey + normalized title
          const key = `${source.initiativeKey}::${normalizeForKey(work.title)}`;
          existingWorkByKey.set(key, work.id);
        }
      }
    }

    // Process each program
    for (const proposedProgram of proposal.programs) {
      // Skip excluded program types
      if (excludeProgramTypes.includes(proposedProgram.programType)) {
        result.programs.skipped.push(proposedProgram.programKey);
        continue;
      }

      try {
        // Check if this is a supported program type for Airtable
        const isSupportedType = ['website', 'content'].includes(proposedProgram.programType);

        if (isSupportedType) {
          // Upsert program
          const programResult = await upsertProgram(
            companyId,
            strategyId,
            proposedProgram,
            existingPrograms,
            proposal.source
          );

          if (programResult.created) {
            result.programs.created.push(programResult.programId);
          } else if (programResult.updated) {
            result.programs.updated.push(programResult.programId);
          } else {
            result.programs.skipped.push(proposedProgram.programKey);
          }
        }

        // Process initiatives and work items
        for (const initiative of proposedProgram.initiatives) {
          // Skip excluded initiatives
          if (excludeInitiativeKeys.includes(initiative.initiativeKey)) {
            result.initiatives.skipped++;
            continue;
          }

          // Create work items for this initiative
          for (const workItem of initiative.workItems) {
            try {
              const workResult = await upsertWorkItem(
                companyId,
                strategyId,
                proposedProgram,
                initiative,
                workItem,
                existingWorkByKey,
                proposal.source,
                strategy.title
              );

              if (workResult.created) {
                result.workItems.created.push(workResult.workItemId);
              } else {
                result.workItems.skipped.push(workItem.workKey);
              }
            } catch (workError) {
              result.errors.push(
                `Failed to create work item "${workItem.title}": ${workError instanceof Error ? workError.message : 'Unknown error'}`
              );
            }
          }

          result.initiatives.created++;
        }
      } catch (programError) {
        result.errors.push(
          `Failed to process program "${proposedProgram.title}": ${programError instanceof Error ? programError.message : 'Unknown error'}`
        );
      }
    }

    // Delete the draft after successful apply
    try {
      await deleteDraftByKey(companyId, strategyId, 'strategy', 'handoff_proposal', proposal.id);
    } catch (draftError) {
      console.warn('[handoff/apply] Failed to delete draft:', draftError);
    }

    // Update proposal status
    proposal.status = 'applied';

    console.log('[handoff/apply] Apply complete:', {
      programsCreated: result.programs.created.length,
      programsUpdated: result.programs.updated.length,
      workItemsCreated: result.workItems.created.length,
      errors: result.errors.length,
    });

    // Set success to false if there were errors
    if (result.errors.length > 0) {
      result.success = false;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[handoff/apply] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply handoff',
        programs: { created: [], updated: [], skipped: [] },
        initiatives: { created: 0, updated: 0, skipped: 0 },
        workItems: { created: [], skipped: [] },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Upsert Functions
// ============================================================================

interface UpsertProgramResult {
  programId: string;
  created: boolean;
  updated: boolean;
}

async function upsertProgram(
  companyId: string,
  strategyId: string,
  proposedProgram: ProposedProgram,
  existingPrograms: Awaited<ReturnType<typeof getProgramsForCompany>>,
  source: StrategyProgramProposal['source']
): Promise<UpsertProgramResult> {
  // Check for existing program of same type linked to same strategy
  const existing = existingPrograms.find(p => {
    if (p.type !== proposedProgram.programType) return false;
    // Check if linked to same strategy via inputsSnapshot
    return p.plan.inputsSnapshot?.strategyId === strategyId;
  });

  const plan: WebsiteProgramPlan = {
    title: proposedProgram.title,
    summary: proposedProgram.summary,
    objectiveFraming: proposedProgram.objectiveFraming,
    currentStateSummary: proposedProgram.currentState,
    priorities: proposedProgram.priorities,
    sequencing: proposedProgram.sequencing,
    readinessGates: proposedProgram.readinessGates,
    inputsSnapshot: {
      companyId,
      strategyId,
      capturedAt: new Date().toISOString(),
    },
    assumptions: [],
    unknowns: [],
    dependencies: proposedProgram.initiatives.flatMap(i => i.dependencies),
  };

  if (existing) {
    // Update existing program
    const updated = await updateProgramPlan(existing.id, plan);
    return {
      programId: updated?.id || existing.id,
      created: false,
      updated: true,
    };
  } else {
    // Create new program
    const created = await createProgram(
      companyId,
      proposedProgram.programType as ProgramType,
      plan
    );
    return {
      programId: created?.id || '',
      created: true,
      updated: false,
    };
  }
}

interface UpsertWorkItemResult {
  workItemId: string;
  created: boolean;
}

async function upsertWorkItem(
  companyId: string,
  strategyId: string,
  program: ProposedProgram,
  initiative: ProposedInitiative,
  workItem: ProposedWorkItem,
  existingWorkByKey: Map<string, string>,
  source: StrategyProgramProposal['source'],
  strategyTitle: string
): Promise<UpsertWorkItemResult> {
  // Check for existing work item by key
  if (existingWorkByKey.has(workItem.workKey)) {
    return {
      workItemId: existingWorkByKey.get(workItem.workKey)!,
      created: false,
    };
  }

  // Build work source with full linkage
  const workSource: WorkSourceStrategyHandoff = {
    sourceType: 'strategy_handoff',
    strategyId,
    strategyTitle,
    programType: program.programType,
    initiativeTitle: initiative.title,
    initiativeKey: initiative.initiativeKey,
    linkedObjectiveIds: initiative.objectiveIds,
    linkedPriorityIds: initiative.priorityIds,
    linkedTacticIds: initiative.tacticIds,
    handoffAt: new Date().toISOString(),
  };

  // Map effort to severity for priority
  const severity = effortToSeverity(initiative.sequence, workItem.impact);

  // Map category to area
  const area = categoryToArea(workItem.category);

  // Build notes with "Why" and implementation guide
  const notes = buildWorkItemNotes(workItem, initiative, program, strategyTitle);

  // Create work item
  // NOTE: effort and impact are included in notes since CreateWorkItemInput
  // doesn't support them directly. The info is in buildWorkItemNotes().
  const created = await createWorkItem({
    title: workItem.title,
    companyId,
    area,
    severity,
    status: 'Backlog',
    source: workSource as unknown as Parameters<typeof createWorkItem>[0]['source'],
    notes,
  });

  // Track in map to prevent duplicates in same run
  if (created) {
    existingWorkByKey.set(workItem.workKey, created.id);
  }

  return {
    workItemId: created?.id || '',
    created: true,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeForKey(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function effortToSeverity(
  sequence: 'now' | 'next' | 'later',
  impact: 'high' | 'medium' | 'low'
): WorkItemSeverity {
  // Now + high impact = Critical
  // Now + medium/low = High
  // Next + high = High
  // Next + medium/low = Medium
  // Later = Low
  if (sequence === 'now') {
    return impact === 'high' ? 'Critical' : 'High';
  }
  if (sequence === 'next') {
    return impact === 'high' ? 'High' : 'Medium';
  }
  return 'Low';
}

function categoryToArea(category: string): WorkItemArea {
  const mapping: Record<string, WorkItemArea> = {
    website: 'Website UX',
    content: 'Content',
    seo: 'SEO',
    brand: 'Brand',
    analytics: 'Analytics',
    demand: 'Funnel',
    ops: 'Operations',
    other: 'Other',
  };
  return mapping[category] || 'Other';
}

function buildWorkItemNotes(
  workItem: ProposedWorkItem,
  initiative: ProposedInitiative,
  program: ProposedProgram,
  strategyTitle: string
): string {
  const parts: string[] = [];

  // Source linkage
  parts.push(`**Strategy:** ${strategyTitle}`);
  parts.push(`**Program:** ${program.title} (${program.programType})`);
  parts.push(`**Initiative:** ${initiative.title}`);
  parts.push(`**Sequence:** ${initiative.sequence.toUpperCase()}`);
  parts.push(`**Effort:** ${workItem.effort} | **Impact:** ${workItem.impact}`);

  // Why it matters
  if (workItem.whyItMatters) {
    parts.push(`\n**Why This Matters:**\n${workItem.whyItMatters}`);
  }

  // Description
  parts.push(`\n**Description:**\n${workItem.description}`);

  // How to implement
  if (workItem.howToImplement) {
    parts.push(`\n**How to Implement:**\n${workItem.howToImplement}`);
  }

  // Acceptance criteria
  if (workItem.acceptanceCriteria.length > 0) {
    parts.push(`\n**Acceptance Criteria:**\n${workItem.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}`);
  }

  // KPIs from initiative
  if (initiative.kpis.length > 0) {
    parts.push(`\n**Success Metrics:**\n${initiative.kpis.map(k => `- ${k}`).join('\n')}`);
  }

  // Dependencies
  if (initiative.dependencies.length > 0) {
    parts.push(`\n**Dependencies:**\n${initiative.dependencies.map(d => `- ${d}`).join('\n')}`);
  }

  return parts.join('\n');
}
