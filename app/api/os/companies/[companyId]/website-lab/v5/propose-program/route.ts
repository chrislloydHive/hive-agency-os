// app/api/os/companies/[companyId]/website-lab/v5/propose-program/route.ts
// Propose Program from V5 Structural Changes
//
// POST: Creates a draft program from structural changes

import { NextRequest, NextResponse } from 'next/server';
import { createProgram } from '@/lib/airtable/programs';
import type { V5StructuralChange } from '@/lib/gap-heavy/modules/websiteLabV5';
import type { WebsiteProgramPlan, ProgramPriority, ProgramPhase, ProgramReadinessGate } from '@/lib/types/program';

interface ProposeProgramRequest {
  structuralChanges: V5StructuralChange[];
  runId?: string;
}

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;
    const body = (await request.json()) as ProposeProgramRequest;
    const { structuralChanges, runId } = body;

    if (!structuralChanges || structuralChanges.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: structuralChanges' },
        { status: 400 }
      );
    }

    console.log('[V5 Propose Program] Creating program from structural changes:', {
      companyId,
      changesCount: structuralChanges.length,
      runId,
    });

    // Build priorities from structural changes
    const priorities: ProgramPriority[] = structuralChanges.map((change, index) => ({
      label: change.title,
      rationale: change.rationale,
    }));

    // Build sequencing - group all changes into Phase 1 for now
    const sequencing: ProgramPhase[] = [
      {
        phase: 'Phase 1: Website Improvements',
        items: structuralChanges.map(c => c.title),
      },
    ];

    // Build readiness gates
    const readinessGates: ProgramReadinessGate[] = [
      {
        gate: 'Planning Complete',
        criteria: ['All pages affected identified', 'Design mockups approved'],
      },
      {
        gate: 'Implementation Ready',
        criteria: ['Development resources allocated', 'Content prepared'],
      },
    ];

    // Build summary from all changes
    const summaryParts = structuralChanges.map(c => c.title);
    const summary = `Website improvement program addressing: ${summaryParts.join(', ')}`;

    // Build inputs snapshot
    const allPages = new Set<string>();
    structuralChanges.forEach(c => c.pagesAffected.forEach(p => allPages.add(p)));

    const plan: WebsiteProgramPlan = {
      title: 'Website Improvement Program (V5 Diagnostic)',
      summary,
      priorities,
      sequencing,
      readinessGates,
      inputsSnapshot: {
        companyId,
        websiteLabRunId: runId,
        websiteLabSummary: `V5 diagnostic found ${structuralChanges.length} structural changes affecting ${allPages.size} pages`,
        capturedAt: new Date().toISOString(),
      },
      assumptions: [
        'Current website infrastructure supports proposed changes',
        'Content team available for copy updates',
      ],
      unknowns: [
        'Full scope of design work required',
        'Integration complexity with existing systems',
      ],
    };

    const program = await createProgram(companyId, 'website', plan);

    if (!program) {
      return NextResponse.json(
        { error: 'Failed to create program' },
        { status: 500 }
      );
    }

    console.log('[V5 Propose Program] Program created successfully:', {
      programId: program.id,
      title: plan.title,
      prioritiesCount: priorities.length,
    });

    return NextResponse.json({
      success: true,
      programId: program.id,
      title: plan.title,
      prioritiesCount: priorities.length,
    });
  } catch (error) {
    console.error('[V5 Propose Program] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
