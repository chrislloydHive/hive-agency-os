// app/api/os/companies/[companyId]/creative/save/route.ts
// API route to save creative strategy to Context Graph

import { NextRequest, NextResponse } from 'next/server';
import { writeCreativeLabAndSave } from '@/lib/contextGraph/creativeLabWriter';
import { createDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';
import type { CreativeLabOutput } from '@/lib/contextGraph/creativeLabWriter';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const { output, runId } = body as {
      output: CreativeLabOutput;
      runId?: string;
    };

    if (!output) {
      return NextResponse.json({ error: 'No output provided' }, { status: 400 });
    }

    console.log('[CreativeLab API] Save request for:', companyId, { runId });

    // Write to Context Graph
    const { graph, summary } = await writeCreativeLabAndSave(companyId, output, runId);

    // Create diagnostic run record for Brain Library
    try {
      const diagnosticRun = await createDiagnosticRun({
        companyId,
        toolId: 'creativeLab',
        status: 'complete',
        summary: `Creative strategy generated with ${output.creativeTerritories.length} territories and ${output.campaignConcepts.length} campaign concepts`,
        metadata: {
          type: 'creativeLab',
          runId,
          territoriesCount: output.creativeTerritories.length,
          conceptsCount: output.campaignConcepts.length,
          segmentMessagesCount: Object.keys(output.segmentMessages).length,
        },
        rawJson: output,
      });

      console.log('[CreativeLab API] Diagnostic run created:', diagnosticRun.id);

      // Process post-run hooks (Brain entry + Strategic Snapshot) in background
      processDiagnosticRunCompletionAsync(companyId, diagnosticRun);
    } catch (diagError) {
      // Don't fail the save if diagnostic run creation fails
      console.error('[CreativeLab API] Failed to create diagnostic run:', diagError);
    }

    return NextResponse.json({
      success: true,
      fieldsUpdated: summary.fieldsUpdated,
      updatedPaths: summary.updatedPaths,
    });
  } catch (error) {
    console.error('[CreativeLab API] Save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
