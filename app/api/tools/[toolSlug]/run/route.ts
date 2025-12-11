// app/api/tools/[toolSlug]/run/route.ts
// Unified API endpoint for running any diagnostic tool
//
// This provides a single entry point for all tool runs, routing to the
// appropriate engine based on the toolSlug parameter.

import { NextRequest, NextResponse } from 'next/server';
import {
  createDiagnosticRun,
  updateDiagnosticRun,
  isValidToolId,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import {
  runGapSnapshotEngine,
  runGapPlanEngine,
  runWebsiteLabEngine,
  runBrandLabEngine,
  runContentLabEngine,
  runSeoLabEngine,
  runDemandLabEngine,
  runOpsLabEngine,
  type EngineResult,
  type EngineInput,
  type GapEngineInput,
} from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { aiForCompany, addCompanyMemoryEntry } from '@/lib/ai-gateway';
import type { GapModelCaller } from '@/lib/gap/core';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';

export const maxDuration = 300; // 5 minutes timeout (longest for GAP Plan)

// Map URL slugs to tool IDs
const slugToToolId: Record<string, DiagnosticToolId> = {
  'gap-snapshot': 'gapSnapshot',
  'gapSnapshot': 'gapSnapshot',
  'gap-plan': 'gapPlan',
  'gapPlan': 'gapPlan',
  'gap-heavy': 'gapHeavy',
  'gapHeavy': 'gapHeavy',
  'website-lab': 'websiteLab',
  'websiteLab': 'websiteLab',
  'brand-lab': 'brandLab',
  'brandLab': 'brandLab',
  'content-lab': 'contentLab',
  'contentLab': 'contentLab',
  'seo-lab': 'seoLab',
  'seoLab': 'seoLab',
  'demand-lab': 'demandLab',
  'demandLab': 'demandLab',
  'ops-lab': 'opsLab',
  'opsLab': 'opsLab',
};

interface RouteContext {
  params: Promise<{ toolSlug: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { toolSlug } = await context.params;

    // Resolve slug to tool ID
    const toolId = slugToToolId[toolSlug];
    if (!toolId || !isValidToolId(toolId)) {
      return NextResponse.json(
        { error: `Invalid tool: ${toolSlug}` },
        { status: 400 }
      );
    }

    // Get tool config
    const toolConfig = getToolConfig(toolId);
    if (!toolConfig) {
      return NextResponse.json(
        { error: `Tool not found: ${toolId}` },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { companyId, url, domain } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Determine the URL to use (from request, or company default)
    const targetUrl = url || company.website;
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Company has no website URL and no URL provided' },
        { status: 400 }
      );
    }

    console.log(`[API] Running ${toolConfig.label} for: ${company.name}`);

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId,
      toolId,
      status: 'running',
      metadata: {
        url: targetUrl,
        domain: domain || new URL(targetUrl).hostname,
      },
    });

    // Build base input for engines
    const engineInput: EngineInput = {
      companyId,
      company,
      websiteUrl: targetUrl,
    };

    // Run the appropriate engine
    let result: EngineResult;

    switch (toolId) {
      case 'gapSnapshot': {
        // Create memory-aware model caller for GAP
        const modelCaller = createGapModelCaller(companyId, run.id, 'GAP IA');
        result = await runGapSnapshotEngine({
          ...engineInput,
          modelCaller,
        } as GapEngineInput);
        break;
      }

      case 'gapPlan': {
        // Create memory-aware model caller for GAP
        let currentStage: 'GAP IA' | 'GAP Full' = 'GAP IA';
        const modelCaller: GapModelCaller = async (prompt: string) => {
          // Detect stage transition
          if (prompt.includes('FULL_GAP') || prompt.includes('Full Growth Acceleration Plan')) {
            currentStage = 'GAP Full';
          }
          const caller = createGapModelCaller(companyId, run.id, currentStage);
          return caller(prompt);
        };
        result = await runGapPlanEngine({
          ...engineInput,
          modelCaller,
        } as GapEngineInput);
        break;
      }

      case 'gapHeavy': {
        // GAP Heavy uses the full Heavy Worker pipeline
        const { runGapHeavyEngine } = await import('@/lib/os/diagnostics/engines');
        result = await runGapHeavyEngine(engineInput);
        break;
      }

      case 'websiteLab':
        result = await runWebsiteLabEngine(engineInput);
        break;

      case 'brandLab':
        result = await runBrandLabEngine(engineInput);
        break;

      case 'contentLab':
        result = await runContentLabEngine(engineInput);
        break;

      case 'seoLab':
        result = await runSeoLabEngine(engineInput);
        break;

      case 'demandLab':
        result = await runDemandLabEngine(engineInput);
        break;

      case 'opsLab':
        result = await runOpsLabEngine(engineInput);
        break;

      default:
        return NextResponse.json(
          { error: `Engine not implemented for tool: ${toolId}` },
          { status: 501 }
        );
    }

    // Update run with results
    console.log(`[API] Updating run status to:`, result.success ? 'complete' : 'failed');
    let updatedRun;
    try {
      updatedRun = await updateDiagnosticRun(run.id, {
        status: result.success ? 'complete' : 'failed',
        score: result.score ?? null,
        summary: result.summary ?? null,
        rawJson: result.data,
        metadata: {
          url: targetUrl,
          domain: domain || new URL(targetUrl).hostname,
          ...(result.error ? { error: result.error } : {}),
        },
      });
      console.log(`[API] Run status updated successfully:`, {
        runId: updatedRun.id,
        status: updatedRun.status,
      });
    } catch (updateError) {
      console.error(`[API] FAILED to update run status:`, updateError);
      // Still return success since the diagnostic ran, just status update failed
      updatedRun = { ...run, status: (result.success ? 'complete' : 'failed') as 'complete' | 'failed', score: result.score ?? null };
    }

    console.log(`[API] ${toolConfig.label} complete:`, {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
    });

    // Process post-run hooks (Brain entry, Context Graph, Findings extraction) in background
    if (result.success) {
      processDiagnosticRunCompletionAsync(companyId, updatedRun);
    }

    // Save summary to AI memory for strategic tools
    if (result.success && result.data && (toolId === 'gapSnapshot' || toolId === 'gapPlan')) {
      try {
        const memorySummary = extractToolMemorySummary(toolId, result, company.name);
        const tags = deriveToolTags(toolId, result);

        await addCompanyMemoryEntry({
          companyId,
          type: 'Strategy',
          content: memorySummary,
          source: 'AI',
          tags: [...tags, 'Summary', `${toolConfig.label} Summary`],
          relatedEntityId: updatedRun.id,
        });

        console.log(`[API] Saved ${toolConfig.label} summary to company AI memory`);
      } catch (memoryError) {
        console.error(`[API] Failed to save memory entry:`, memoryError);
      }
    }

    return NextResponse.json({
      ok: true,
      run: updatedRun,
      result: {
        success: result.success,
        score: result.score,
        summary: result.summary,
        error: result.error,
      },
    });

  } catch (error) {
    console.error('[API] Tool run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Create memory-aware model caller for GAP engines
// ============================================================================

function createGapModelCaller(
  companyId: string,
  runId: string,
  gapType: 'GAP IA' | 'GAP Full'
): GapModelCaller {
  return async (prompt: string): Promise<string> => {
    const { content } = await aiForCompany(companyId, {
      type: gapType,
      tags: gapType === 'GAP IA'
        ? ['GAP', 'Snapshot', 'Marketing']
        : ['GAP', 'Growth Plan', 'Strategy'],
      relatedEntityId: runId,
      systemPrompt: gapType === 'GAP IA'
        ? `You are the GAP IA (Initial Assessment) engine inside Hive OS.
You perform a fast, URL-based marketing assessment across:
- Brand clarity and positioning
- Website UX & conversion readiness
- Content strength and depth
- SEO fundamentals
You must always output valid JSON matching the GAP IA schema.`
        : `You are the Full Growth Acceleration Plan (GAP) engine inside Hive OS.
You generate a detailed, consultant-grade marketing plan across:
- Brand strategy and positioning
- Website optimization and conversion
- Content strategy and execution
- SEO and organic visibility
- Analytics and optimization tracking
You must always output valid JSON matching the Full GAP schema.`,
      taskPrompt: prompt,
      model: gapType === 'GAP IA' ? 'gpt-4o' : 'gpt-4o-mini',
      temperature: 0.7,
      memoryOptions: {
        limit: 20,
        types: ['GAP IA', 'GAP Full', 'Analytics Insight', 'Work Item', 'Strategy'],
      },
      jsonMode: true,
    });

    return content;
  };
}

// ============================================================================
// Helper: Extract memory summary from tool result
// ============================================================================

function extractToolMemorySummary(
  toolId: DiagnosticToolId,
  result: EngineResult,
  companyName: string
): string {
  const parts: string[] = [];
  const data = result.data as any;

  if (toolId === 'gapSnapshot') {
    const ia = data?.initialAssessment || data;
    parts.push(`GAP Initial Assessment for ${companyName}`);
    if (result.score != null) parts.push(`Overall Score: ${result.score}/100`);
    if (ia?.maturityStage) parts.push(`Maturity Stage: ${ia.maturityStage}`);
    if (ia?.executiveSummary) parts.push(`\nExecutive Summary:\n${ia.executiveSummary}`);
  } else if (toolId === 'gapPlan') {
    const plan = data?.growthPlan || data;
    parts.push(`GAP Full Growth Plan for ${companyName}`);
    if (result.score != null) parts.push(`Overall Score: ${result.score}/100`);
    if (plan?.executiveSummary) parts.push(`\nExecutive Summary:\n${plan.executiveSummary}`);
  } else {
    parts.push(`${toolId} diagnostic for ${companyName}`);
    if (result.score != null) parts.push(`Score: ${result.score}/100`);
    if (result.summary) parts.push(`\nSummary:\n${result.summary}`);
  }

  return parts.join('\n');
}

// ============================================================================
// Helper: Derive tags from tool result
// ============================================================================

function deriveToolTags(toolId: DiagnosticToolId, result: EngineResult): string[] {
  const tags: string[] = [];
  const content = JSON.stringify(result.data || {}).toLowerCase();

  if (content.includes('seo') || content.includes('search engine')) {
    tags.push('SEO');
  }
  if (content.includes('website') || content.includes('ux') || content.includes('user experience')) {
    tags.push('Website');
  }
  if (content.includes('content') || content.includes('blog') || content.includes('article')) {
    tags.push('Content');
  }
  if (content.includes('brand') || content.includes('positioning') || content.includes('messaging')) {
    tags.push('Brand');
  }
  if (content.includes('analytics') || content.includes('tracking') || content.includes('metrics')) {
    tags.push('Analytics');
  }

  return tags.slice(0, 4);
}
