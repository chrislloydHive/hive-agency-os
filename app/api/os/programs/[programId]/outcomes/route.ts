// app/api/os/programs/[programId]/outcomes/route.ts
// Get outcome signals for a program's work items
//
// GET - List outcome signals from work items associated with this program

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import { listOutcomeSignals } from '@/lib/airtable/outcomeSignals';
import type { OutcomeSignalRecord } from '@/lib/airtable/outcomeSignals';

type Params = { params: Promise<{ programId: string }> };

// ============================================================================
// Response Types
// ============================================================================

interface GetProgramOutcomesResponse {
  success: boolean;
  signals: OutcomeSignalRecord[];
  total: number;
  error?: string;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/os/programs/[programId]/outcomes
 * Get outcome signals from work items associated with this program
 */
export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse<GetProgramOutcomesResponse>> {
  try {
    const { programId } = await params;

    // Get program to find its company and strategy
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, signals: [], total: 0, error: 'Program not found' },
        { status: 404 }
      );
    }

    // Get signals for this company/strategy
    // In the future, we could filter by work item IDs linked to this program
    const signals = await listOutcomeSignals({
      companyId: program.companyId,
      strategyId: program.origin.strategyId,
      limit: 50,
    });

    // Filter to signals that are from work or artifacts (not just strategy-level)
    const workSignals = signals.filter(s =>
      s.source === 'work' || s.source === 'artifact'
    );

    return NextResponse.json({
      success: true,
      signals: workSignals,
      total: workSignals.length,
    });
  } catch (error) {
    console.error('[Program Outcomes API] Failed to get outcomes:', error);
    return NextResponse.json(
      { success: false, signals: [], total: 0, error: 'Failed to get outcomes' },
      { status: 500 }
    );
  }
}
