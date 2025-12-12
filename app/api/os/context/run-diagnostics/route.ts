// app/api/os/context/run-diagnostics/route.ts
// Combined Diagnostics + Context Draft API
//
// This endpoint:
// 1. Runs baseline diagnostics (Full GAP + Competition)
// 2. Generates an AI context draft from the results
// 3. Saves the draft for user review (does NOT auto-save to canonical context)
//
// Returns: { baselineSignals, contextDraft }
// Used by the "Run Diagnostics" button for first-time context setup.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFullGAPOrchestrator } from '@/lib/gap/orchestrator';
import { runCompetitionV3 } from '@/lib/competition-v3';
import { runCompetitionV4, shouldRunV4, type CompetitionV4Result } from '@/lib/competition-v4';
import { runInitialAssessment } from '@/lib/gap/core';
import {
  getBaselineSignalsForCompany,
  getCompanyContext,
  getCompetitionSummaryForCompany,
  inferCompanyCategoryAndHints,
  saveContextDraft,
} from '@/lib/os/context';
import type { CompanyContext, ContextDraft, ContextAiInput, InitialDiagnosticsResult, Competitor } from '@/lib/types/context';
import { parseCompetitors } from '@/lib/types/context';

export const maxDuration = 180; // 3 minutes for full pipeline

// ============================================================================
// System Prompt for Context Generation
// ============================================================================

const SYSTEM_PROMPT = `
You are the Context Modeling Engine for Hive OS.

Your job is to create accurate, grounded company context based on diagnostic signals.

STRICT RULES:
1. NEVER assume the company is a marketing agency unless the inputs explicitly say so.
2. ALWAYS anchor context to the company's name, domain, and detected industry hints provided.
3. Use ONLY information provided in the input. Do not add new facts or invent details.
4. If you are uncertain about a detail, leave it as null or write "Needs confirmation" instead of inventing details.
5. Context must be high-level, strategic, actionable, and precise.
6. Pay attention to the "detectedIndustry", "detectedAudienceHints", and "detectedBusinessModelHints" fields.
7. If "competitionSummary" is provided, use it to:
   - Refine businessModel by understanding what competitors do
   - Inform companyCategory based on competitor types
   - Shape objectives with awareness of competitive positioning
   - Build a STRUCTURED competitors array with rich data
   - Extract marketSignals from competitor landscape insights

OUTPUT FORMAT:
Return a JSON object with ONLY these keys (use null if you cannot determine a value with confidence):
{
  "businessModel": string | null,
  "primaryAudience": string | null,
  "secondaryAudience": string | null,
  "valueProposition": string | null,
  "objectives": string[] | null,
  "constraints": string | null,
  "competitorsNotes": string | null,
  "marketSignals": string[] | null,
  "companyCategory": string | null,
  "competitors": [
    {
      "domain": string (required, lowercase),
      "name": string | null,
      "offerOverlap": number (0-100, how much their offering overlaps),
      "jtbdMatch": boolean (do they solve the same jobs-to-be-done),
      "geoRelevance": number (0-100, geographic market overlap),
      "type": "direct" | "indirect" | "adjacent",
      "confidence": number (0-100, how confident you are in this assessment)
    }
  ],
  "summary": string
}

COMPETITOR TYPE DEFINITIONS:
- "direct": Same target audience, same core offering, head-to-head competition
- "indirect": Different approach to solving the same problem, or adjacent offering
- "adjacent": Related market/category but different core business model

Include up to 10 competitors if available. Prioritize direct competitors first.
NEVER include fields not shown above.
`.trim();

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { companyId } = body as { companyId: string };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log('[run-diagnostics] Starting for:', company.name);

    // ========================================================================
    // Step 1: Run baseline diagnostics (Full GAP + Competition in parallel)
    // ========================================================================

    const baselineResults = {
      fullGap: { ran: false, success: false, error: null as string | null },
      competition: { ran: false, success: false, competitorCount: 0, error: null as string | null },
      competitionV4: { ran: false, success: false, competitorCount: 0, error: null as string | null },
      gapIa: { ran: false, success: false, error: null as string | null },
    };

    // Track V4 result if enabled
    let competitionV4Result: CompetitionV4Result | null = null;

    const [fullGapResult, competitionResult] = await Promise.allSettled([
      // Full GAP Orchestrator
      (async () => {
        console.log('[run-diagnostics] Running Full GAP...');
        baselineResults.fullGap.ran = true;
        try {
          const output = await runFullGAPOrchestrator({
            companyId,
            gapIaRun: {},
          });
          baselineResults.fullGap.success = output.success;
          if (!output.success) {
            baselineResults.fullGap.error = output.error ?? 'Unknown error';
          }
          return output;
        } catch (error) {
          baselineResults.fullGap.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
      })(),

      // Competition V3
      (async () => {
        console.log('[run-diagnostics] Running Competition V3...');
        baselineResults.competition.ran = true;
        try {
          const output = await runCompetitionV3({ companyId });
          baselineResults.competition.success = output.run.status === 'completed';
          baselineResults.competition.competitorCount = output.competitors.length;
          if (output.run.error) {
            baselineResults.competition.error = output.run.error;
          }
          return output;
        } catch (error) {
          baselineResults.competition.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
      })(),
    ]);

    console.log('[run-diagnostics] Full GAP result:', fullGapResult.status);
    console.log('[run-diagnostics] Competition result:', competitionResult.status);

    // Fall back to GAP-IA if Full GAP failed
    if (fullGapResult.status === 'rejected' || !baselineResults.fullGap.success) {
      const websiteUrl = company.website || `https://${company.domain}`;
      console.log('[run-diagnostics] Full GAP failed, trying GAP-IA for:', websiteUrl);
      baselineResults.gapIa.ran = true;

      try {
        const gapIaOutput = await runInitialAssessment({ url: websiteUrl });
        baselineResults.gapIa.success = !!gapIaOutput.initialAssessment;
      } catch (error) {
        baselineResults.gapIa.error = error instanceof Error ? error.message : String(error);
        console.error('[run-diagnostics] GAP-IA also failed:', error);
      }
    }

    // ========================================================================
    // Step 1b: Run Competition V4 (if enabled via COMPETITION_ENGINE flag)
    // ========================================================================

    if (shouldRunV4()) {
      console.log('[run-diagnostics] Running Competition V4 (Classification Tree)...');
      baselineResults.competitionV4.ran = true;

      try {
        competitionV4Result = await runCompetitionV4({
          companyId,
          companyName: company.name ?? undefined,
          domain: company.domain ?? company.website ?? undefined,
        });
        baselineResults.competitionV4.success = competitionV4Result.execution.status === 'completed';
        baselineResults.competitionV4.competitorCount = competitionV4Result.competitors.validated.length;

        console.log(`[run-diagnostics] Competition V4 completed: ${competitionV4Result.competitors.validated.length} validated, ${competitionV4Result.competitors.removed.length} removed`);
      } catch (error) {
        baselineResults.competitionV4.error = error instanceof Error ? error.message : String(error);
        console.error('[run-diagnostics] Competition V4 failed:', error);
      }
    }

    // ========================================================================
    // Step 2: Get fresh baseline signals
    // ========================================================================

    const signals = await getBaselineSignalsForCompany(companyId);
    console.log('[run-diagnostics] Fresh signals:', signals);

    // ========================================================================
    // Step 3: Generate AI context draft
    // ========================================================================

    let contextDraft: ContextDraft | null = null;

    // Only generate draft if we have enough signal
    const hasSignal = signals.hasLabRuns || signals.hasFullGap || signals.hasCompetition || signals.hasWebsiteMetadata;

    if (hasSignal) {
      console.log('[run-diagnostics] Generating AI context draft...');

      // Load existing context and competition summary in parallel
      const [existingContext, competitionSummary] = await Promise.all([
        getCompanyContext(companyId),
        getCompetitionSummaryForCompany(companyId),
      ]);

      // Infer company category and hints
      const inferred = inferCompanyCategoryAndHints({
        companyName: company.name ?? '',
        domain: company.domain ?? company.website ?? '',
        websiteTitle: signals.websiteTitle ?? '',
        websiteMetaDescription: signals.websiteMetaDescription ?? '',
      });

      // Build AI input
      const aiInput: ContextAiInput = {
        companyName: company.name ?? '',
        domain: company.domain ?? company.website ?? '',
        currentContext: existingContext,
        diagnosticsSummary: {
          website: '',
          seo: '',
          content: '',
          brand: '',
        },
        detectedIndustry: inferred.detectedIndustry,
        detectedAudienceHints: inferred.detectedAudienceHints,
        detectedBusinessModelHints: inferred.detectedBusinessModelHints,
        competitionSummary,
      };

      // Call OpenAI
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Here is the company context input as JSON. Generate the context.\n\n${JSON.stringify(aiInput, null, 2)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content || '{}';
      let parsed: Record<string, unknown>;

      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error('[run-diagnostics] Failed to parse AI response:', raw);
        parsed = {};
      }

      // Parse competitors from AI output
      const aiCompetitors = parseCompetitors(parsed.competitors, 'ai');

      // Build context from AI output
      const generatedContext: CompanyContext = {
        companyId,
        businessModel: (parsed.businessModel as string) || undefined,
        primaryAudience: (parsed.primaryAudience as string) || undefined,
        secondaryAudience: (parsed.secondaryAudience as string) || undefined,
        valueProposition: (parsed.valueProposition as string) || undefined,
        objectives: Array.isArray(parsed.objectives) ? (parsed.objectives as string[]) : undefined,
        constraints: (parsed.constraints as string) || undefined,
        competitorsNotes: (parsed.competitorsNotes as string) || undefined,
        competitors: aiCompetitors.length > 0 ? aiCompetitors : undefined,
        marketSignals: Array.isArray(parsed.marketSignals) ? (parsed.marketSignals as string[]) : undefined,
        companyCategory: (parsed.companyCategory as string) || inferred.companyCategory || undefined,
        isAiGenerated: true,
      };

      // Create draft
      contextDraft = {
        companyId,
        context: generatedContext,
        source: 'ai/baseline-v1',
        createdAt: new Date().toISOString(),
        summary: (parsed.summary as string) || 'Context drafted from baseline diagnostics',
      };

      // Save draft to Airtable
      try {
        await saveContextDraft(contextDraft);
        console.log('[run-diagnostics] Saved context draft');
      } catch (draftError) {
        console.error('[run-diagnostics] Failed to save draft:', draftError);
        // Don't fail the whole request - we can still return the draft
      }
    }

    // ========================================================================
    // Step 4: Build response
    // ========================================================================

    const durationMs = Date.now() - startTime;

    const messageParts: string[] = [];
    if (baselineResults.fullGap.success) {
      messageParts.push('Full GAP completed');
    } else if (baselineResults.gapIa.success) {
      messageParts.push('GAP-IA completed (fallback)');
    } else {
      messageParts.push('GAP analysis failed');
    }

    if (baselineResults.competition.success) {
      messageParts.push(`V3: ${baselineResults.competition.competitorCount} competitors`);
    }

    if (baselineResults.competitionV4.ran) {
      if (baselineResults.competitionV4.success) {
        messageParts.push(`V4: ${baselineResults.competitionV4.competitorCount} validated`);
      } else {
        messageParts.push('V4 failed');
      }
    }

    if (contextDraft) {
      messageParts.push('Context draft created');
    }

    const result: InitialDiagnosticsResult = {
      success: hasSignal && contextDraft !== null,
      baselineSignals: {
        hasLabRuns: signals.hasLabRuns,
        hasFullGap: signals.hasFullGap,
        hasCompetition: signals.hasCompetition,
        hasWebsiteMetadata: signals.hasWebsiteMetadata,
        findingsCount: signals.findingsCount,
        competitorCount: signals.competitorCount,
        signalSources: signals.signalSources,
      },
      contextDraft,
      message: messageParts.join('; '),
      durationMs,
    };

    console.log('[run-diagnostics] Completed in', durationMs, 'ms:', result.message);

    // Include V4 result if available (non-breaking addition)
    const response: Record<string, unknown> = { ...result };
    if (competitionV4Result) {
      response.competitionV4 = competitionV4Result;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[run-diagnostics] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Initial diagnostics failed' },
      { status: 500 }
    );
  }
}
