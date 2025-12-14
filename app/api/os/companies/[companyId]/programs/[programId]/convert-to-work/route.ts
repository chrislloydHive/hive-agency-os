// app/api/os/companies/[companyId]/programs/[programId]/convert-to-work/route.ts
// Convert Program → Work
//
// Converts an approved Website Program into executable work items:
// - Creates Work Items from program phases (each phase item → work item)
// - Preserves sequencing via phase prefix and notes
// - Stores readiness gates in work item notes
// - Links created work items to the Program via source metadata
//
// Constraints:
// - Only available after program is saved (has ID)
// - No AI generation - deterministic conversion
// - No changes to Program content

import { NextRequest, NextResponse } from 'next/server';
import { getProgramById } from '@/lib/airtable/programs';
import { createWorkItem, getWorkItemsForCompany } from '@/lib/airtable/workItems';
import type { WorkSourceProgram } from '@/lib/types/work';
import type { ProgramPhase, ProgramReadinessGate } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

interface ConvertToWorkResponse {
  success: boolean;
  workItemsCreated: number;
  workItemIds: string[];
  error?: string;
}

// ============================================================================
// API Handler
// ============================================================================

type RouteParams = {
  params: Promise<{ companyId: string; programId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, programId } = await params;

    console.log('[convert-to-work] Starting conversion:', { companyId, programId });

    // 1. Fetch the program
    const program = await getProgramById(programId);

    if (!program) {
      return NextResponse.json(
        { success: false, error: 'Program not found' },
        { status: 404 }
      );
    }

    // Verify program belongs to this company
    if (program.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Program does not belong to this company' },
        { status: 403 }
      );
    }

    // 2. Check if work items already exist for this program
    const existingWorkItems = await getWorkItemsForCompany(companyId);
    const existingProgramWorkItems = existingWorkItems.filter(item => {
      if (!item.source || item.source.sourceType !== 'program') return false;
      return (item.source as WorkSourceProgram).programId === programId;
    });

    if (existingProgramWorkItems.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Work items already exist for this program (${existingProgramWorkItems.length} items). Delete existing work items first if you want to regenerate.`,
          workItemsCreated: 0,
          workItemIds: existingProgramWorkItems.map(w => w.id),
        },
        { status: 409 }
      );
    }

    // 3. Extract program plan
    const { plan } = program;
    const { sequencing, readinessGates } = plan;

    if (!sequencing || sequencing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Program has no phases to convert' },
        { status: 400 }
      );
    }

    // 4. Build readiness gates reference for notes
    const gatesReference = buildGatesReference(readinessGates || []);

    // 5. Create work items from phases
    const createdWorkItemIds: string[] = [];

    for (let phaseIndex = 0; phaseIndex < sequencing.length; phaseIndex++) {
      const phase = sequencing[phaseIndex];
      const phaseNumber = phaseIndex + 1;

      for (let itemIndex = 0; itemIndex < phase.items.length; itemIndex++) {
        const item = phase.items[itemIndex];

        // Build source metadata
        const source: WorkSourceProgram = {
          sourceType: 'program',
          programId: program.id,
          programType: program.type,
          phaseIndex,
          phaseName: phase.phase,
          itemIndex,
        };

        // Build notes with context
        const notes = buildWorkItemNotes({
          programTitle: plan.title,
          phase,
          phaseNumber,
          itemIndex,
          totalItems: phase.items.length,
          gatesReference,
          dependencies: plan.dependencies,
        });

        // Determine priority based on phase (earlier phases = higher priority)
        const severity = phaseToSeverity(phaseIndex);

        // Create the work item
        const workItem = await createWorkItem({
          title: `[Phase ${phaseNumber}] ${item}`,
          companyId,
          area: 'Website UX', // Website Program → Website UX area
          severity,
          status: 'Backlog',
          source,
          notes,
        });

        if (workItem) {
          createdWorkItemIds.push(workItem.id);
          console.log('[convert-to-work] Created work item:', {
            id: workItem.id,
            title: workItem.title,
            phase: phase.phase,
          });
        }
      }
    }

    console.log('[convert-to-work] Conversion complete:', {
      programId,
      workItemsCreated: createdWorkItemIds.length,
    });

    const response: ConvertToWorkResponse = {
      success: true,
      workItemsCreated: createdWorkItemIds.length,
      workItemIds: createdWorkItemIds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[convert-to-work] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert program to work',
        workItemsCreated: 0,
        workItemIds: [],
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map phase index to work item severity
 * Phase 1 = High priority, Phase 2 = Medium, Phase 3+ = Low
 */
function phaseToSeverity(phaseIndex: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (phaseIndex === 0) return 'High';
  if (phaseIndex === 1) return 'Medium';
  return 'Low';
}

/**
 * Build a reference string for readiness gates
 */
function buildGatesReference(gates: ProgramReadinessGate[]): string {
  if (gates.length === 0) return '';

  const gateLines = gates.map(g => {
    const criteria = g.criteria.map(c => `  - ${c}`).join('\n');
    return `**${g.gate}**\n${criteria}`;
  });

  return `\n\n---\n**Readiness Gates:**\n${gateLines.join('\n\n')}`;
}

/**
 * Build notes for a work item with full context
 */
function buildWorkItemNotes(args: {
  programTitle: string;
  phase: ProgramPhase;
  phaseNumber: number;
  itemIndex: number;
  totalItems: number;
  gatesReference: string;
  dependencies?: string[];
}): string {
  const { programTitle, phase, phaseNumber, itemIndex, totalItems, gatesReference, dependencies } = args;

  const parts: string[] = [];

  // Source reference
  parts.push(`**Source:** ${programTitle}`);
  parts.push(`**Phase:** ${phase.phase}`);
  parts.push(`**Sequence:** Item ${itemIndex + 1} of ${totalItems} in this phase`);

  // Dependencies if any
  if (dependencies && dependencies.length > 0) {
    parts.push(`\n**Program Dependencies:**\n${dependencies.map(d => `- ${d}`).join('\n')}`);
  }

  // Phase context - what else is in this phase
  if (totalItems > 1) {
    const otherItems = phase.items
      .filter((_, i) => i !== itemIndex)
      .map(item => `- ${item}`)
      .join('\n');
    parts.push(`\n**Other items in ${phase.phase}:**\n${otherItems}`);
  }

  // Readiness gates reference (only for Phase 1 items)
  if (phaseNumber === 1 && gatesReference) {
    parts.push(gatesReference);
  }

  return parts.join('\n');
}
