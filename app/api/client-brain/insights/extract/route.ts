// app/api/client-brain/insights/extract/route.ts
// Extract insights from a DiagnosticRun using AI

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { createInsightsBatch, getCompanyInsights } from '@/lib/airtable/clientBrain';
import type {
  CreateClientInsightInput,
  InsightCategory,
  InsightSeverity,
} from '@/lib/types/clientBrain';

interface ExtractedInsight {
  title: string;
  body: string;
  category: string;
  severity?: string;
}

interface ExtractRequest {
  runId: string;
  companyId: string;
  toolSlug: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExtractRequest;
    const { runId, companyId, toolSlug } = body;

    if (!runId || !companyId || !toolSlug) {
      return NextResponse.json(
        { error: 'Missing required fields: runId, companyId, toolSlug' },
        { status: 400 }
      );
    }

    console.log('[InsightExtract] Starting extraction:', { runId, companyId, toolSlug });

    // 1. Get the diagnostic run
    const run = await getDiagnosticRun(runId);
    if (!run) {
      return NextResponse.json(
        { error: 'Diagnostic run not found' },
        { status: 404 }
      );
    }

    if (!run.rawJson) {
      return NextResponse.json(
        { error: 'No raw data available to extract insights from' },
        { status: 400 }
      );
    }

    // 2. Check for existing insights from this run
    const existingInsights = await getCompanyInsights(companyId, { limit: 100 });
    const existingFromRun = existingInsights.filter((insight) => {
      if (insight.source.type === 'tool_run') {
        return insight.source.toolRunId === runId;
      }
      return false;
    });

    if (existingFromRun.length > 0) {
      return NextResponse.json({
        success: true,
        message: `Already extracted ${existingFromRun.length} insights from this run`,
        insights: existingFromRun,
        alreadyExtracted: true,
      });
    }

    // 3. Build the prompt for AI extraction
    const rawJsonStr = typeof run.rawJson === 'string'
      ? run.rawJson
      : JSON.stringify(run.rawJson, null, 2);

    // Truncate if too long
    const maxLength = 15000;
    const truncatedJson = rawJsonStr.length > maxLength
      ? rawJsonStr.slice(0, maxLength) + '\n...[truncated]'
      : rawJsonStr;

    const systemPrompt = `You are an expert marketing analyst extracting strategic insights from diagnostic tool results.

Your task is to identify the most important, actionable insights from the provided diagnostic data.

Categories for insights:
- brand: Brand identity, positioning, messaging, differentiation
- content: Content strategy, blog, resources, messaging
- seo: Search engine optimization, keywords, rankings, technical SEO
- website: Website UX, conversion, design, performance
- analytics: Tracking, measurement, data quality
- demand: Lead generation, funnel, demand gen
- ops: Marketing operations, process, tooling
- competitive: Competitive landscape, market position
- structural: Architecture, infrastructure, technical
- product: Product marketing, positioning
- other: Other insights that don't fit above

Severity levels:
- critical: Urgent issue that significantly impacts business results
- high: Important issue that should be addressed soon
- medium: Moderate issue worth addressing
- low: Minor observation or opportunity

Guidelines:
1. Extract 3-8 insights maximum - focus on quality over quantity
2. Each insight should be specific and actionable
3. The title should be concise (under 80 chars)
4. The body should explain the insight with specific evidence from the data
5. Assign appropriate category and severity
6. Avoid generic or obvious statements

Output your response as valid JSON with this structure:
{
  "insights": [
    {
      "title": "string",
      "body": "string (detailed explanation with evidence)",
      "category": "brand|content|seo|website|analytics|demand|ops|competitive|structural|product|other",
      "severity": "critical|high|medium|low"
    }
  ]
}`;

    const userPrompt = `Extract strategic insights from this ${toolSlug} diagnostic run data:

---
Summary: ${run.summary || 'No summary available'}
Score: ${run.score ?? 'N/A'}

Raw Data:
${truncatedJson}
---

Extract the most important actionable insights from this diagnostic data.`;

    // 4. Call OpenAI to extract insights
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';

    let parsed: { insights?: ExtractedInsight[] };
    try {
      parsed = JSON.parse(responseContent);
    } catch {
      console.error('[InsightExtract] Failed to parse AI response:', responseContent);
      return NextResponse.json(
        { error: 'Failed to parse AI extraction response' },
        { status: 500 }
      );
    }

    const extractedInsights = parsed.insights || [];
    console.log('[InsightExtract] Extracted insights:', extractedInsights.length);

    if (extractedInsights.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No significant insights found in this run',
        insights: [],
      });
    }

    // 5. Map to CreateClientInsightInput format
    const validCategories: InsightCategory[] = [
      'brand', 'content', 'seo', 'website', 'analytics',
      'demand', 'ops', 'competitive', 'structural', 'product', 'other'
    ];
    const validSeverities: InsightSeverity[] = ['low', 'medium', 'high', 'critical'];

    const insightInputs: CreateClientInsightInput[] = extractedInsights.map((insight) => ({
      title: insight.title.slice(0, 200),
      body: insight.body,
      category: validCategories.includes(insight.category as InsightCategory)
        ? (insight.category as InsightCategory)
        : 'other',
      severity: validSeverities.includes(insight.severity as InsightSeverity)
        ? (insight.severity as InsightSeverity)
        : 'medium',
      source: {
        type: 'tool_run' as const,
        toolSlug,
        toolRunId: runId,
      },
    }));

    // 6. Batch create insights
    const createdInsights = await createInsightsBatch(companyId, insightInputs);

    console.log('[InsightExtract] Created insights:', createdInsights.length);

    return NextResponse.json({
      success: true,
      message: `Extracted ${createdInsights.length} insights`,
      insights: createdInsights,
    });

  } catch (error) {
    console.error('[InsightExtract] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract insights' },
      { status: 500 }
    );
  }
}
