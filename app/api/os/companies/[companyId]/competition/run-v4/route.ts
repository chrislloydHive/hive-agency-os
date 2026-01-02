// app/api/os/companies/[companyId]/competition/run-v4/route.ts
// Run Competition Lab V4 and persist to Airtable + Context Graph

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runCompetitionV4 } from '@/lib/competition-v4';
import { saveCompetitionRunV4 } from '@/lib/competition-v4/store';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyCompetitiveDomain, createDefaultCompetitorProfile } from '@/lib/contextGraph/domains/competitive';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log(`[competition/run-v4] Starting V4 for: ${company.name}`);

    // Create diagnostic run record (pending)
    const diagnosticRun = await createDiagnosticRun({
      companyId,
      toolId: 'competitionLab',
      status: 'running',
      summary: 'Running Competition Lab V4 analysis...',
    });
    console.log(`[competition/run-v4] Created diagnostic run: ${diagnosticRun.id}`);

    let result;
    try {
      result = await runCompetitionV4({
        companyId,
        companyName: company.name,
        domain: company.website || undefined,
      });
    } catch (runError) {
      // Update diagnostic run to failed
      await updateDiagnosticRun(diagnosticRun.id, {
        status: 'failed',
        summary: runError instanceof Error ? runError.message : 'Competition analysis failed',
      });
      throw runError;
    }

    // Save to Competition Runs table
    await saveCompetitionRunV4(result);

    // Update diagnostic run to complete
    await updateDiagnosticRun(diagnosticRun.id, {
      status: 'complete',
      summary: `Found ${result.competitors.validated.length} competitors in ${result.category.category_name || 'market'}`,
      score: result.competitors.validated.length > 0 ? 75 : 50, // Basic score based on finding competitors
      rawJson: result,
    });

    // Write V4 competitors directly to context graph for immediate UI display
    if (result.competitors.validated.length > 0) {
      try {
        const graph = (await loadContextGraph(companyId)) || {};

        // Convert V4 competitors to CompetitorProfile format
        const categoryMap: Record<string, 'direct' | 'indirect' | 'aspirational' | 'emerging'> = {
          Direct: 'direct',
          direct: 'direct',
          Indirect: 'indirect',
          indirect: 'indirect',
          Adjacent: 'indirect',
          adjacent: 'indirect',
        };

        const v4Competitors = result.competitors.validated.map((c) => {
          const category = categoryMap[c.type] || 'direct';

          return {
            ...createDefaultCompetitorProfile(c.name),
            domain: c.domain,
            website: c.domain,
            category,
            confidence: c.confidence / 100,
            autoSeeded: true,
            notes: c.reason || null,
            provenance: [
              {
                field: 'competitor',
                source: 'competition_v4',
                updatedAt: new Date().toISOString(),
                confidence: c.confidence / 100,
              },
            ],
          };
        });

        // Ensure competitive domain exists
        if (!graph.competitive) {
          graph.competitive = createEmptyCompetitiveDomain();
        }

        // Update competitors
        graph.competitive.competitors = {
          value: v4Competitors,
          provenance: [
            {
              updatedAt: new Date().toISOString(),
              source: 'competition_lab',
              confidence: 0.9,
              notes: `Competition V4: ${result.category.category_name}`,
            },
          ],
        };

        // Store V4 category
        if (result.category.category_name) {
          graph.competitive.marketPosition = {
            value: result.category.category_name,
            provenance: [
              {
                updatedAt: new Date().toISOString(),
                source: 'competition_lab',
                confidence: 0.85,
                notes: `Competition V4 category: ${result.category.category_name}`,
              },
            ],
          };
        }

        await saveContextGraph(graph, 'competition_v4_import');
        console.log(
          `[competition/run-v4] Imported ${v4Competitors.length} competitors to context graph`
        );
      } catch (importError) {
        console.error('[competition/run-v4] Failed to import to context graph:', importError);
      }
    }

    console.log(
      `[competition/run-v4] Completed: ${result.competitors.validated.length} competitors`
    );

    return NextResponse.json({
      success: result.execution.status === 'completed',
      runId: result.runId,
      status: result.execution.status,
      competitorCount: result.competitors.validated.length,
      category: result.category.category_name,
    });
  } catch (error) {
    console.error('[competition/run-v4] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run competition V4' },
      { status: 500 }
    );
  }
}
