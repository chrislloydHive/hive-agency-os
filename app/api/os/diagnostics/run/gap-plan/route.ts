// app/api/os/diagnostics/run/gap-plan/route.ts
// API endpoint for running Full GAP Plan generation
//
// Flow:
// 1. Run GAP-IA synchronously (quick ~30s)
// 2. Create GAP-IA run record in Airtable
// 3. Trigger Inngest for Full GAP background processing
// 4. Return immediately with "processing" status
//
// The Inngest function (generate-full-gap) will:
// - Generate the full growth plan
// - Update the diagnostic run with results
// - Save to Company AI Memory

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runGapSnapshotEngine } from '@/lib/os/diagnostics/engines';
import { aiForCompany } from '@/lib/ai-gateway';
import { findOrCreateCompanyForGap } from '@/lib/pipeline/createOrMatchCompany';
import { createGapIaRun, updateGapIaRun } from '@/lib/airtable/gapIaRuns';
import { inngest } from '@/lib/inngest/client';
import type { GapModelCaller } from '@/lib/gap/core';

export const maxDuration = 120; // 2 minutes for GAP-IA (Full GAP runs in background)

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
    let company;
    let isNewCompany = false;

    try {
      const result = await findOrCreateCompanyForGap({
        companyId,
        url,
        source: 'Full GAP',
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

    console.log('[API] Running GAP Plan for:', company.name, isNewCompany ? '(newly created)' : '(existing)');

    // Create diagnostic run record with "running" status
    const diagnosticRun = await createDiagnosticRun({
      companyId: company.id,
      toolId: 'gapPlan',
      status: 'running',
    });

    // =========================================================================
    // Step 1: Run GAP-IA synchronously (quick ~30s)
    // =========================================================================
    console.log('[API] Step 1: Running GAP-IA...');

    // Create a model caller that uses aiForCompany() for memory-aware AI calls
    const gapIaModelCaller: GapModelCaller = async (prompt: string) => {
      const { content } = await aiForCompany(company.id, {
        type: 'GAP IA',
        tags: ['GAP', 'Snapshot', 'Marketing'],
        relatedEntityId: diagnosticRun.id,
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

    // Run GAP-IA engine
    const iaResult = await runGapSnapshotEngine({
      companyId: company.id,
      company,
      websiteUrl,
      modelCaller: gapIaModelCaller,
    });

    if (!iaResult.success) {
      // Update diagnostic run as failed
      await updateDiagnosticRun(diagnosticRun.id, {
        status: 'failed',
        metadata: { error: iaResult.error || 'GAP-IA failed' },
      });

      return NextResponse.json(
        { error: iaResult.error || 'GAP-IA assessment failed' },
        { status: 500 }
      );
    }

    console.log('[API] GAP-IA complete, score:', iaResult.score);

    // =========================================================================
    // Step 2: Create GAP-IA Run record in Airtable
    // =========================================================================
    console.log('[API] Step 2: Creating GAP-IA run record...');

    // Extract domain from URL
    let domain = '';
    try {
      domain = new URL(websiteUrl).hostname.replace(/^www\./, '');
    } catch {
      domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }

    // Create GAP-IA run record
    const gapIaRun = await createGapIaRun({
      url: websiteUrl,
      domain,
      source: 'internal',
      companyId: company.id,
    });

    // Update with the IA results
    // Cast to any since the data structure varies by GAP version
    const resultData = iaResult.data as any;
    const iaData = resultData?.initialAssessment || resultData;
    await updateGapIaRun(gapIaRun.id, {
      status: 'completed',
      core: iaData?.core,
      insights: iaData?.insights,
      // V2 enhanced fields
      ...(iaData?.summary && { summary: iaData.summary }),
      ...(iaData?.dimensions && { dimensions: iaData.dimensions }),
      ...(iaData?.breakdown && { breakdown: iaData.breakdown }),
      ...(iaData?.quickWins && { quickWins: iaData.quickWins }),
      // Scores
      overallScore: iaResult.score,
      brandScore: iaData?.dimensions?.brand?.score || iaData?.core?.brand?.brandScore,
      contentScore: iaData?.dimensions?.content?.score || iaData?.core?.content?.contentScore,
      seoScore: iaData?.dimensions?.seo?.score || iaData?.core?.seo?.seoScore,
      websiteScore: iaData?.dimensions?.website?.score || iaData?.core?.website?.websiteScore,
      digitalFootprintScore: iaData?.dimensions?.digitalFootprint?.score,
      authorityScore: iaData?.dimensions?.authority?.score,
      maturityStage: iaData?.summary?.maturityStage || iaData?.maturityStage,
      // Context
      businessContext: resultData?.businessContext,
      digitalFootprint: resultData?.digitalFootprint || iaData?.digitalFootprint,
      dataConfidence: resultData?.dataConfidence,
    } as any);

    console.log('[API] GAP-IA run created:', gapIaRun.id);

    // =========================================================================
    // Step 3: Trigger Inngest for Full GAP background processing
    // =========================================================================
    console.log('[API] Step 3: Triggering Inngest for Full GAP...');
    console.log('[API] Inngest event data:', {
      gapIaRunId: gapIaRun.id,
      diagnosticRunId: diagnosticRun.id,
      companyId: company.id,
    });

    const sendResult = await inngest.send({
      name: 'gap/generate-full',
      data: {
        gapIaRunId: gapIaRun.id,
        diagnosticRunId: diagnosticRun.id,
        companyId: company.id,
      },
    });

    console.log('[API] Inngest event sent: gap/generate-full, result:', sendResult);

    // Update diagnostic run to indicate processing
    await updateDiagnosticRun(diagnosticRun.id, {
      status: 'running',
      summary: `GAP-IA complete (${iaResult.score}/100). Full GAP generating in background...`,
      metadata: {
        gapIaRunId: gapIaRun.id,
        gapIaScore: iaResult.score,
        stage: 'full-gap-processing',
      },
    });

    // =========================================================================
    // Return immediately with processing status
    // =========================================================================
    return NextResponse.json({
      run: {
        id: diagnosticRun.id,
        status: 'running',
        stage: 'full-gap-processing',
      },
      gapIaRun: {
        id: gapIaRun.id,
        score: iaResult.score,
      },
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        stage: company.stage,
        source: company.source,
        isNew: isNewCompany,
      },
      message: 'GAP-IA complete. Full GAP plan generating in background.',
    });
  } catch (error) {
    console.error('[API] GAP Plan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
