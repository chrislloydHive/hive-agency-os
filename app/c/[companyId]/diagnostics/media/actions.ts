'use server';

// app/c/[companyId]/diagnostics/media/actions.ts
// Server actions for Media Lab
//
// These actions handle promoting a Media Plan to an active Media Program.

import { promoteMediaPlanToProgram } from '@/lib/media/programs';

/**
 * Server action to promote a Media Plan to an active Media Program.
 *
 * This is called from Media Lab when the user clicks "Promote to Active Program".
 * It creates a new MediaProgram from the selected plan and redirects to review.
 */
export async function promotePlanToProgramAction(input: {
  companyId: string;
  mediaPlanId: string;
}): Promise<{ success: true; programId: string } | { success: false; error: string }> {
  try {
    const result = await promoteMediaPlanToProgram({
      companyId: input.companyId,
      mediaPlanId: input.mediaPlanId,
    });

    return {
      success: true,
      programId: result.programId,
    };
  } catch (error) {
    console.error('[MediaLab] Failed to promote plan to program:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to promote plan',
    };
  }
}
