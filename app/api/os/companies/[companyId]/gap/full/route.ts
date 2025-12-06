// app/api/os/companies/[companyId]/gap/full/route.ts
// Full GAP OS Orchestrator API
//
// POST - Run the OS orchestrator for a company
// GET  - Fetch the latest (or specified) orchestrator run
//
// IMPORTANT: This route ONLY exposes os_orchestrator mode.
// It does NOT call or expose the lead magnet mode.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFullGAPOrchestrator } from '@/lib/gap/orchestrator';
import type { OrchestratorOutput } from '@/lib/gap/orchestrator';
import { createClientInsight } from '@/lib/airtable/clientBrain';
import type { CreateClientInsightInput, InsightCategory } from '@/lib/types/clientBrain';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// In-Memory Run Storage (for MVP - replace with Airtable later)
// ============================================================================

interface GAPOrchestratorRun {
  id: string;
  companyId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  summary?: string;
  error?: string;
  output?: OrchestratorOutput;
}

// Simple in-memory store for runs (replace with Airtable persistence)
const runStore = new Map<string, GAPOrchestratorRun>();
const companyLatestRun = new Map<string, string>();

function generateRunId(): string {
  return `gap-os-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// POST - Run Full GAP Orchestrator
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log('[GAP Full API] Starting orchestrator for:', companyId);

    // Create run record
    const runId = generateRunId();
    const startedAt = new Date().toISOString();

    const run: GAPOrchestratorRun = {
      id: runId,
      companyId,
      status: 'running',
      startedAt,
    };

    runStore.set(runId, run);
    companyLatestRun.set(companyId, runId);

    // Run the orchestrator (this may take a while)
    // In production, this should be async/queued
    try {
      const output = await runFullGAPOrchestrator({
        companyId,
        gapIaRun: {}, // Empty for now - orchestrator will run fresh
      });

      // Persist insights to company_insights
      if (output.success && output.insights.length > 0) {
        console.log(`[GAP Full API] Persisting ${output.insights.length} insights...`);
        await persistOrchestratorInsights(companyId, output, runId);
      }

      // Update run record
      run.status = output.success ? 'completed' : 'failed';
      run.completedAt = new Date().toISOString();
      run.output = output;
      run.summary = buildRunSummary(output);
      if (!output.success) {
        run.error = output.error;
      }

      console.log('[GAP Full API] Orchestrator complete:', {
        runId,
        success: output.success,
        labsRun: output.labsRun.length,
        insights: output.insights.length,
      });

      return NextResponse.json({
        gapRunId: runId,
        startedAt,
        completedAt: run.completedAt,
        status: run.status,
        summary: run.summary,
      });
    } catch (error) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      run.error = error instanceof Error ? error.message : String(error);

      console.error('[GAP Full API] Orchestrator failed:', error);

      return NextResponse.json({
        gapRunId: runId,
        startedAt,
        completedAt: run.completedAt,
        status: 'failed',
        error: run.error,
      });
    }
  } catch (error) {
    console.error('[GAP Full API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run orchestrator' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Fetch Orchestrator Run
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get specific run or latest
    let targetRunId = runId;
    if (!targetRunId) {
      targetRunId = companyLatestRun.get(companyId) || null;
    }

    if (!targetRunId) {
      return NextResponse.json({
        hasRun: false,
        message: 'No orchestrator runs found for this company',
      });
    }

    const run = runStore.get(targetRunId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Return full structured output
    if (run.output) {
      return NextResponse.json({
        hasRun: true,
        runId: run.id,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        summary: run.summary,
        error: run.error,
        // Structured orchestrator output
        contextBefore: run.output.contextBefore,
        contextAfter: run.output.contextAfter,
        healthBefore: run.output.healthBefore,
        healthAfter: run.output.healthAfter,
        labsRun: run.output.labsRun,
        labOutputs: run.output.labOutputs.map((lo) => ({
          labId: lo.labId,
          labName: lo.labName,
          success: lo.success,
          error: lo.error,
          refinedFieldCount: lo.refinedContext.length,
          diagnostics: lo.diagnostics,
          insightCount: lo.insights.length,
          durationMs: lo.durationMs,
        })),
        gapStructured: run.output.gapStructured,
        insights: run.output.insights,
        snapshotId: run.output.snapshotId,
        durationMs: run.output.durationMs,
      });
    }

    // Run still in progress or failed without output
    return NextResponse.json({
      hasRun: true,
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      summary: run.summary,
      error: run.error,
    });
  } catch (error) {
    console.error('[GAP Full API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch run' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildRunSummary(output: OrchestratorOutput): string {
  if (!output.success) {
    return `Failed: ${output.error}`;
  }

  const parts: string[] = [];
  parts.push(`${output.labsRun.length} labs run`);

  const healthDelta = output.healthAfter.completeness - output.healthBefore.completeness;
  if (healthDelta > 0) {
    parts.push(`+${healthDelta}% context`);
  }

  parts.push(`${output.insights.length} insights`);
  parts.push(`Score: ${output.gapStructured.scores.overall}/100`);

  return parts.join(' | ');
}

/**
 * Persist orchestrator insights to company_insights storage
 */
async function persistOrchestratorInsights(
  companyId: string,
  output: OrchestratorOutput,
  runId: string
): Promise<void> {
  for (const insight of output.insights) {
    try {
      // Map the insight to CreateClientInsightInput format
      const input: CreateClientInsightInput = {
        title: insight.title,
        body: insight.body,
        category: insight.category as InsightCategory,
        severity: insight.severity,
        status: 'open',
        source: {
          type: 'tool_run',
          toolSlug: 'gap_orchestrator',
          toolRunId: runId,
        },
        recommendation: insight.recommendation,
        rationale: insight.rationale,
      };

      await createClientInsight(companyId, input);
    } catch (error) {
      console.error('[GAP Full API] Failed to persist insight:', insight.title, error);
    }
  }

  console.log(`[GAP Full API] Persisted ${output.insights.length} insights for ${companyId}`);
}
