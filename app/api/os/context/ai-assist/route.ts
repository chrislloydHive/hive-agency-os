// app/api/os/context/ai-assist/route.ts
// AI-assisted context refinement API
//
// This endpoint generates accurate, grounded context for companies
// by using industry inference and strict prompting rules.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCompanyContext,
  updateCompanyContext,
  inferCompanyCategoryAndHints,
  getBaselineSignalsForCompany,
  hasEnoughContextSignal,
  getCompetitionSummaryForCompany,
  type BaselineSignals,
} from '@/lib/os/context';
import type { CompanyContext, ContextSuggestion, ContextAiInput, CompetitionSummary } from '@/lib/types/context';

// Error code for insufficient signal
const INSUFFICIENT_SIGNAL_ERROR = 'INSUFFICIENT_SIGNAL';

export const maxDuration = 60;

// ============================================================================
// System Prompt - Strict rules to prevent hallucinations
// ============================================================================

const SYSTEM_PROMPT = `
You are the Context Modeling Engine for Hive OS.

Your job is to refine and enhance a company's strategic context based on accurate signals ONLY.

STRICT RULES:
1. NEVER assume the company is a marketing agency unless the inputs explicitly say so.
2. ALWAYS anchor context to the company's name, domain, and detected industry hints provided.
3. Use ONLY information provided in the input. Do not add new facts or invent details.
4. If you are uncertain about a detail, leave it as null or write "Needs confirmation" instead of inventing details.
5. Context must be high-level, strategic, actionable, and precise.
6. For fitness/trainer companies (like TrainrHub), they are MARKETPLACES/PLATFORMS connecting trainers with clients, NOT marketing agencies.
7. Pay special attention to the "detectedIndustry", "detectedAudienceHints", and "detectedBusinessModelHints" fields - these are ground truth signals.
8. If "competitionSummary" is provided, use it to:
   - Refine businessModel by understanding what competitors do
   - Inform companyCategory based on competitor types
   - Shape objectives with awareness of competitive positioning
   - Build competitorsNotes from the provided competitor data
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
  "summary": string
}

NEVER include fields not shown above.
`.trim();

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, currentContext: providedContext } = body as {
      companyId: string;
      currentContext?: CompanyContext;
    };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Load company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check for baseline signals before running AI
    const signals = await getBaselineSignalsForCompany(companyId);
    console.log('[context/ai-assist] Baseline signals for', company.name, ':', signals);

    if (!hasEnoughContextSignal(signals)) {
      console.log('[context/ai-assist] Insufficient signal, refusing to generate context');
      return NextResponse.json({
        error: INSUFFICIENT_SIGNAL_ERROR,
        message: 'Not enough data to generate accurate context. Run a baseline diagnostic (Website Lab, GAP, or other labs) first.',
        signals: {
          hasLabRuns: signals.hasLabRuns,
          hasFullGap: signals.hasFullGap,
          hasWebsiteMetadata: signals.hasWebsiteMetadata,
          findingsCount: signals.findingsCount,
          fullGapReportId: signals.fullGapReportId,
        },
        suggestedActions: [
          { action: 'run_website_lab', label: 'Run Website Lab' },
          { action: 'run_full_gap', label: 'Run Full GAP Analysis' },
          ...(signals.fullGapReportId ? [{ action: 'import_from_gap', label: 'Import from Full GAP', reportId: signals.fullGapReportId }] : []),
        ],
      }, { status: 422 }); // 422 Unprocessable Entity - we understand the request but need more data
    }

    // Load existing context and competition summary in parallel
    const [existingContext, competitionSummary] = await Promise.all([
      providedContext ? Promise.resolve(providedContext) : getCompanyContext(companyId),
      getCompetitionSummaryForCompany(companyId),
    ]);

    // Infer company category and hints from name/domain
    // Also include website metadata from signals if available
    const inferred = inferCompanyCategoryAndHints({
      companyName: company.name ?? '',
      domain: company.domain ?? company.website ?? '',
      websiteTitle: signals.websiteTitle ?? '',
      websiteMetaDescription: signals.websiteMetaDescription ?? '',
    });

    console.log('[context/ai-assist] Inferred hints for', company.name, ':', inferred);
    console.log('[context/ai-assist] Competition summary:', competitionSummary ? {
      competitorCount: competitionSummary.primaryCompetitors.length,
      hasPositioning: !!competitionSummary.positioningNotes,
    } : 'none');

    // Build structured AI input
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
          content: `Here is the company context input as JSON. Refine it according to the rules.\n\n${JSON.stringify(aiInput, null, 2)}`,
        },
      ],
      temperature: 0.2, // Low temperature for more deterministic/factual output
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('[context/ai-assist] Failed to parse AI response:', raw);
      return NextResponse.json(
        { error: 'AI returned invalid JSON', raw },
        { status: 500 }
      );
    }

    // Build suggestions list for UI
    const suggestions: ContextSuggestion[] = [];

    if (parsed.businessModel && parsed.businessModel !== existingContext?.businessModel) {
      suggestions.push({
        field: 'businessModel',
        currentValue: existingContext?.businessModel,
        suggestedValue: parsed.businessModel as string,
        reasoning: 'Refined based on company signals',
        confidence: 0.85,
      });
    }

    if (parsed.primaryAudience && parsed.primaryAudience !== existingContext?.primaryAudience) {
      suggestions.push({
        field: 'primaryAudience',
        currentValue: existingContext?.primaryAudience,
        suggestedValue: parsed.primaryAudience as string,
        reasoning: 'Made more specific based on detected audience',
        confidence: 0.85,
      });
    }

    if (parsed.secondaryAudience && parsed.secondaryAudience !== existingContext?.secondaryAudience) {
      suggestions.push({
        field: 'secondaryAudience',
        currentValue: existingContext?.secondaryAudience,
        suggestedValue: parsed.secondaryAudience as string,
        reasoning: 'Identified secondary audience segment',
        confidence: 0.8,
      });
    }

    if (parsed.valueProposition && parsed.valueProposition !== existingContext?.valueProposition) {
      suggestions.push({
        field: 'valueProposition',
        currentValue: existingContext?.valueProposition,
        suggestedValue: parsed.valueProposition as string,
        reasoning: 'Made more compelling and specific',
        confidence: 0.85,
      });
    }

    if (parsed.objectives && Array.isArray(parsed.objectives) && parsed.objectives.length > 0) {
      suggestions.push({
        field: 'objectives',
        currentValue: existingContext?.objectives,
        suggestedValue: parsed.objectives as string[],
        reasoning: 'Made SMART and actionable',
        confidence: 0.8,
      });
    }

    if (parsed.companyCategory) {
      suggestions.push({
        field: 'companyCategory' as keyof CompanyContext,
        currentValue: existingContext?.companyCategory,
        suggestedValue: parsed.companyCategory as string,
        reasoning: 'Classified based on industry signals',
        confidence: 0.9,
      });
    }

    // Merge AI suggestions with existing context (only fill missing or improve)
    const updatedContext: Partial<CompanyContext> = {};

    // Only update fields that are empty or clearly improvable
    if (parsed.businessModel && (!existingContext?.businessModel || existingContext.businessModel.length < 10)) {
      updatedContext.businessModel = parsed.businessModel as string;
    }
    if (parsed.primaryAudience && (!existingContext?.primaryAudience || existingContext.primaryAudience.length < 10)) {
      updatedContext.primaryAudience = parsed.primaryAudience as string;
    }
    if (parsed.secondaryAudience && !existingContext?.secondaryAudience) {
      updatedContext.secondaryAudience = parsed.secondaryAudience as string;
    }
    if (parsed.valueProposition && (!existingContext?.valueProposition || existingContext.valueProposition.length < 10)) {
      updatedContext.valueProposition = parsed.valueProposition as string;
    }
    if (parsed.objectives && Array.isArray(parsed.objectives) && (!existingContext?.objectives || existingContext.objectives.length === 0)) {
      updatedContext.objectives = parsed.objectives as string[];
    }
    if (parsed.marketSignals && Array.isArray(parsed.marketSignals)) {
      updatedContext.marketSignals = parsed.marketSignals as string[];
    }
    // Always update category if detected
    if (parsed.companyCategory || inferred.companyCategory) {
      updatedContext.companyCategory = (parsed.companyCategory as string) ?? inferred.companyCategory;
    }
    updatedContext.isAiGenerated = true;

    // Save updated context if there are changes
    if (Object.keys(updatedContext).length > 1) { // More than just isAiGenerated
      await updateCompanyContext({
        companyId,
        updates: updatedContext,
        source: 'ai',
      });
    }

    return NextResponse.json({
      suggestions,
      updatedContext,
      summary: (parsed.summary as string) || 'AI context refinement complete',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] context/ai-assist error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI assist failed' },
      { status: 500 }
    );
  }
}
