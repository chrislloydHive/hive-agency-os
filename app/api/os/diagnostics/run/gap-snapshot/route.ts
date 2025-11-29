// app/api/os/diagnostics/run/gap-snapshot/route.ts
// API endpoint for running GAP Snapshot diagnostic
//
// This API integrates with Company AI Memory (Client Brain) via aiForCompany():
// - All GAP model calls go through aiForCompany() which:
//   - Loads prior memory (previous GAP runs, analytics insights, work items)
//   - Injects context into prompts
//   - Logs full responses into Company AI Context
// - Additional summary entries are saved with type "Strategy" to avoid duplication

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runGapSnapshotEngine } from '@/lib/os/diagnostics/engines';
import { aiForCompany, addCompanyMemoryEntry } from '@/lib/ai-gateway';
import { findOrCreateCompanyForGap } from '@/lib/pipeline/createOrMatchCompany';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';
import type { GapModelCaller } from '@/lib/gap/core';

export const maxDuration = 120; // 2 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, url } = body;

    // Validate: either companyId or url must be provided
    if (!companyId && !url) {
      return NextResponse.json(
        { error: 'Either companyId or url must be provided' },
        { status: 400 }
      );
    }

    // Find or create company using unified helper
    // - If companyId provided: use existing company
    // - If url provided: find by domain or create new Prospect with Source="GAP IA"
    let company;
    let isNewCompany = false;

    try {
      const result = await findOrCreateCompanyForGap({
        companyId,
        url,
        source: 'GAP IA',
      });
      company = result.company;
      isNewCompany = result.isNew;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to find or create company';
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    // Verify company has a website URL (required for GAP)
    const websiteUrl = company.website || url;
    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Company has no website URL' },
        { status: 400 }
      );
    }

    console.log('[API] Running GAP Snapshot for:', company.name, isNewCompany ? '(newly created)' : '(existing)');

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId: company.id,
      toolId: 'gapSnapshot',
      status: 'running',
    });

    // Create a model caller that uses aiForCompany() for memory-aware AI calls
    // This ensures the GAP engine:
    // - Loads prior company memory (previous GAP runs, analytics insights, work items)
    // - Injects that context into prompts
    // - Logs full responses back to Company AI Context
    const gapIaModelCaller: GapModelCaller = async (prompt: string) => {
      const { content } = await aiForCompany(company.id, {
        type: 'GAP IA',
        tags: ['GAP', 'Snapshot', 'Marketing'],
        relatedEntityId: run.id,
        systemPrompt: `
You are the GAP IA (Initial Assessment) engine inside Hive OS.

You perform a fast, URL-based marketing assessment across:
- Brand clarity and positioning
- Website UX & conversion readiness
- Content strength and depth
- SEO fundamentals

You must always output valid JSON matching the GAP IA schema.
        `.trim(),
        taskPrompt: prompt,
        model: 'gpt-4o',
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
    const result = await runGapSnapshotEngine({
      companyId: company.id,
      company,
      websiteUrl: websiteUrl,
      modelCaller: gapIaModelCaller,
    });

    // Update run with results
    const updatedRun = await updateDiagnosticRun(run.id, {
      status: result.success ? 'complete' : 'failed',
      score: result.score ?? null,
      summary: result.summary ?? null,
      rawJson: result.data,
      metadata: result.error ? { error: result.error } : undefined,
    });

    console.log('[API] GAP Snapshot complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
    });

    // =========================================================================
    // Save Summary to Company AI Memory (Client Brain)
    // =========================================================================
    // Note: The full GAP response is already saved via aiForCompany() with type "GAP IA".
    // This additional entry saves a compact, human-readable summary with type "Strategy"
    // to avoid duplicate "GAP IA" entries.
    if (result.success && result.data) {
      try {
        console.log('[API] Saving GAP Snapshot summary to company AI memory...');

        // Extract key insights from the GAP IA result
        const memorySummary = extractGapIaMemorySummary(result.data, company.name, result.score);

        // Derive tags from the result
        const tags = deriveGapIaTags(result.data);

        await addCompanyMemoryEntry({
          companyId: company.id,
          type: 'Strategy', // Changed from 'GAP IA' to avoid duplication with aiForCompany() log
          content: memorySummary,
          source: 'AI',
          tags: [...tags, 'Summary', 'GAP IA Summary'],
          relatedEntityId: updatedRun.id,
        });

        console.log('[API] ✅ Saved GAP Snapshot summary to company AI memory');
      } catch (memoryError) {
        // Don't fail the request if memory save fails
        console.error('[API] Failed to save GAP Snapshot summary to company memory:', memoryError);
      }

      // Process post-run hooks (Brain entry + Strategic Snapshot) in background
      processDiagnosticRunCompletionAsync(company.id, updatedRun);
    }

    return NextResponse.json({
      run: updatedRun,
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        stage: company.stage,
        source: company.source,
        isNew: isNewCompany,
      },
      result: {
        success: result.success,
        score: result.score,
        summary: result.summary,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('[API] GAP Snapshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Extract memory summary from GAP IA result
// ============================================================================

/**
 * Extract a compact summary from GAP IA result for memory storage
 */
function extractGapIaMemorySummary(
  data: any,
  companyName: string,
  score?: number
): string {
  const ia = data?.initialAssessment || data;

  const parts: string[] = [];

  // Header
  parts.push(`GAP Initial Assessment for ${companyName}`);
  if (score !== undefined) {
    parts.push(`Overall Score: ${score}/100`);
  }

  // Maturity stage
  if (ia?.maturityStage) {
    parts.push(`Maturity Stage: ${ia.maturityStage}`);
  }

  // Executive summary
  if (ia?.executiveSummary) {
    parts.push(`\nExecutive Summary:\n${ia.executiveSummary}`);
  }

  // Key strengths
  if (ia?.strengths && Array.isArray(ia.strengths) && ia.strengths.length > 0) {
    const strengthsList = ia.strengths.slice(0, 3).map((s: any) =>
      typeof s === 'string' ? s : s?.title || s?.description || JSON.stringify(s)
    ).join('\n- ');
    parts.push(`\nKey Strengths:\n- ${strengthsList}`);
  }

  // Key gaps/weaknesses
  if (ia?.gaps && Array.isArray(ia.gaps) && ia.gaps.length > 0) {
    const gapsList = ia.gaps.slice(0, 3).map((g: any) =>
      typeof g === 'string' ? g : g?.title || g?.description || JSON.stringify(g)
    ).join('\n- ');
    parts.push(`\nKey Gaps:\n- ${gapsList}`);
  } else if (ia?.weaknesses && Array.isArray(ia.weaknesses) && ia.weaknesses.length > 0) {
    const weaknessesList = ia.weaknesses.slice(0, 3).map((w: any) =>
      typeof w === 'string' ? w : w?.title || w?.description || JSON.stringify(w)
    ).join('\n- ');
    parts.push(`\nKey Weaknesses:\n- ${weaknessesList}`);
  }

  return parts.join('\n');
}

/**
 * Derive tags from GAP IA result based on content areas covered
 */
function deriveGapIaTags(data: any): string[] {
  const tags: string[] = [];
  const ia = data?.initialAssessment || data;

  // Check for various sections to determine relevant tags
  const content = JSON.stringify(ia).toLowerCase();

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
  if (content.includes('conversion') || content.includes('funnel') || content.includes('lead')) {
    tags.push('Conversion');
  }

  // Limit to 4 tags
  return tags.slice(0, 4);
}
