// app/api/os/diagnostics/run/gap-plan/route.ts
// API endpoint for running Full GAP Plan generation
//
// This API integrates with Company AI Memory (Client Brain) via aiForCompany():
// - All GAP model calls go through aiForCompany() which:
//   - Loads prior memory (previous GAP runs, analytics insights, work items)
//   - Injects context into prompts
//   - Logs full responses into Company AI Context
// - Additional summary entries are saved with type "Strategy" to avoid duplication

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runGapPlanEngine } from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';
import { aiForCompany, addCompanyMemoryEntry } from '@/lib/ai-gateway';
import type { GapModelCaller } from '@/lib/gap/core';

export const maxDuration = 300; // 5 minutes timeout for full plan generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

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

    if (!company.website) {
      return NextResponse.json(
        { error: 'Company has no website URL' },
        { status: 400 }
      );
    }

    console.log('[API] Running GAP Plan for:', company.name);

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId,
      toolId: 'gapPlan',
      status: 'running',
    });

    // Create a model caller that uses aiForCompany() for memory-aware AI calls
    // This ensures the GAP engine:
    // - Loads prior company memory (previous GAP runs, analytics insights, work items)
    // - Injects that context into prompts
    // - Logs full responses back to Company AI Context
    //
    // Note: Full GAP runs both GAP-IA and Full GAP sequentially. The model caller
    // will be used for both steps, with appropriate type tags for each.
    let currentGapStage: 'GAP IA' | 'GAP Full' = 'GAP IA';
    const fullGapModelCaller: GapModelCaller = async (prompt: string) => {
      // Detect which stage we're in based on prompt content
      if (prompt.includes('FULL_GAP') || prompt.includes('Full Growth Acceleration Plan')) {
        currentGapStage = 'GAP Full';
      }

      const { content } = await aiForCompany(companyId, {
        type: currentGapStage,
        tags: currentGapStage === 'GAP IA'
          ? ['GAP', 'Snapshot', 'Marketing']
          : ['GAP', 'Growth Plan', 'Strategy'],
        relatedEntityId: run.id,
        systemPrompt: currentGapStage === 'GAP IA'
          ? `
You are the GAP IA (Initial Assessment) engine inside Hive OS.

You perform a fast, URL-based marketing assessment across:
- Brand clarity and positioning
- Website UX & conversion readiness
- Content strength and depth
- SEO fundamentals

You must always output valid JSON matching the GAP IA schema.
          `.trim()
          : `
You are the Full Growth Acceleration Plan (GAP) engine inside Hive OS.

You generate a detailed, consultant-grade marketing plan across:
- Brand strategy and positioning
- Website optimization and conversion
- Content strategy and execution
- SEO and organic visibility
- Analytics and optimization tracking

You must always output valid JSON matching the Full GAP schema.
          `.trim(),
        taskPrompt: prompt,
        model: currentGapStage === 'GAP IA' ? 'gpt-4o' : 'gpt-4o-mini',
        temperature: 0.7,
        memoryOptions: {
          limit: 20,
          types: ['GAP IA', 'GAP Full', 'Analytics Insight', 'Work Item', 'Strategy'],
        },
        jsonMode: true,
      });

      return content;
    };

    // Run the engine with the memory-aware model caller
    const result = await runGapPlanEngine({
      companyId,
      company,
      websiteUrl: company.website,
      modelCaller: fullGapModelCaller,
    });

    // Update run with results
    const updatedRun = await updateDiagnosticRun(run.id, {
      status: result.success ? 'complete' : 'failed',
      score: result.score ?? null,
      summary: result.summary ?? null,
      rawJson: result.data,
      metadata: result.error ? { error: result.error } : undefined,
    });

    console.log('[API] GAP Plan complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
    });

    // =========================================================================
    // Save Summary to Company AI Memory (Client Brain)
    // =========================================================================
    // Note: The full GAP responses are already saved via aiForCompany() with types
    // "GAP IA" and "GAP Full". This additional entry saves a compact, human-readable
    // summary with type "Strategy" to avoid duplicate entries.
    if (result.success && result.data) {
      try {
        console.log('[API] Saving GAP Full summary to company AI memory...');

        // Extract key insights from the GAP Full result
        const memorySummary = extractGapFullMemorySummary(result.data, company.name, result.score);

        // Derive tags from the result
        const tags = deriveGapFullTags(result.data);

        await addCompanyMemoryEntry({
          companyId,
          type: 'Strategy', // Changed from 'GAP Full' to avoid duplication with aiForCompany() log
          content: memorySummary,
          source: 'AI',
          tags: [...tags, 'Summary', 'GAP Full Summary'],
          relatedEntityId: updatedRun.id,
        });

        console.log('[API] ✅ Saved GAP Full summary to company AI memory');
      } catch (memoryError) {
        // Don't fail the request if memory save fails
        console.error('[API] Failed to save GAP Full summary to company memory:', memoryError);
      }
    }

    return NextResponse.json({
      run: updatedRun,
      result: {
        success: result.success,
        score: result.score,
        summary: result.summary,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('[API] GAP Plan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Extract memory summary from GAP Full result
// ============================================================================

/**
 * Extract executive summary + top 5 strategic priorities for memory storage
 */
function extractGapFullMemorySummary(
  data: any,
  companyName: string,
  score?: number
): string {
  const plan = data?.growthPlan || data;

  const parts: string[] = [];

  // Header
  parts.push(`GAP Full Growth Plan for ${companyName}`);
  if (score !== undefined) {
    parts.push(`Overall Score: ${score}/100`);
  }

  // Executive summary
  if (plan?.executiveSummary) {
    parts.push(`\nExecutive Summary:\n${plan.executiveSummary}`);
  }

  // Strategic priorities (top 5)
  if (plan?.strategicPriorities && Array.isArray(plan.strategicPriorities)) {
    const priorities = plan.strategicPriorities.slice(0, 5).map((p: any, i: number) => {
      if (typeof p === 'string') return `${i + 1}. ${p}`;
      return `${i + 1}. ${p?.title || p?.name || p?.description || JSON.stringify(p)}`;
    }).join('\n');
    parts.push(`\nTop Strategic Priorities:\n${priorities}`);
  } else if (plan?.priorities && Array.isArray(plan.priorities)) {
    const priorities = plan.priorities.slice(0, 5).map((p: any, i: number) => {
      if (typeof p === 'string') return `${i + 1}. ${p}`;
      return `${i + 1}. ${p?.title || p?.name || p?.description || JSON.stringify(p)}`;
    }).join('\n');
    parts.push(`\nTop Strategic Priorities:\n${priorities}`);
  }

  // Key recommendations (if available and different from priorities)
  if (plan?.recommendations && Array.isArray(plan.recommendations) && plan.recommendations.length > 0) {
    const recs = plan.recommendations.slice(0, 3).map((r: any) =>
      typeof r === 'string' ? r : r?.title || r?.description || JSON.stringify(r)
    ).join('\n- ');
    parts.push(`\nKey Recommendations:\n- ${recs}`);
  }

  return parts.join('\n');
}

/**
 * Derive tags from GAP Full result based on content areas covered
 */
function deriveGapFullTags(data: any): string[] {
  const tags: string[] = [];
  const plan = data?.growthPlan || data;

  // Check for various sections to determine relevant tags
  const content = JSON.stringify(plan).toLowerCase();

  if (content.includes('seo') || content.includes('search engine') || content.includes('organic')) {
    tags.push('SEO');
  }
  if (content.includes('website') || content.includes('ux') || content.includes('user experience') || content.includes('conversion')) {
    tags.push('Website');
  }
  if (content.includes('content') || content.includes('blog') || content.includes('article') || content.includes('thought leadership')) {
    tags.push('Content');
  }
  if (content.includes('brand') || content.includes('positioning') || content.includes('messaging') || content.includes('differentiation')) {
    tags.push('Brand');
  }
  if (content.includes('analytics') || content.includes('tracking') || content.includes('metrics') || content.includes('measurement')) {
    tags.push('Analytics');
  }
  if (content.includes('paid') || content.includes('advertising') || content.includes('ppc') || content.includes('ads')) {
    tags.push('Paid Media');
  }

  // Limit to 4 tags
  return tags.slice(0, 4);
}
