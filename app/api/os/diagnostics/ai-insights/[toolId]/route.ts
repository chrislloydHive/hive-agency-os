// app/api/os/diagnostics/ai-insights/[toolId]/route.ts
// Generic AI Insights API for any diagnostic tool
//
// This endpoint generates AI insights for a specific diagnostic tool run.
// It uses the tool-specific system prompt and analyzes the run data.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDiagnosticRun, getLatestRunForCompanyAndTool, isValidToolId } from '@/lib/os/diagnostics/runs';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import { getToolSystemPrompt } from '@/lib/os/diagnostics/aiInsights';
import type {
  DiagnosticInsights,
  DiagnosticInsightsResponse,
  DiagnosticInsightsError,
} from '@/lib/os/diagnostics/aiInsights';

const anthropic = new Anthropic();

interface RouteContext {
  params: Promise<{ toolId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { toolId } = await context.params;

    // Validate tool ID
    if (!isValidToolId(toolId)) {
      const error: DiagnosticInsightsError = {
        error: `Invalid tool ID: ${toolId}`,
        toolId: toolId as DiagnosticToolId,
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { companyId, runId } = body as { companyId: string; runId?: string };

    if (!companyId) {
      const error: DiagnosticInsightsError = {
        error: 'Missing companyId',
        toolId,
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Get the run (either specific run or latest)
    let run;
    if (runId) {
      run = await getDiagnosticRun(runId);
    } else {
      run = await getLatestRunForCompanyAndTool(companyId, toolId);
    }

    if (!run) {
      const error: DiagnosticInsightsError = {
        error: `No ${toolId} run found for company`,
        toolId,
        companyId,
      };
      return NextResponse.json(error, { status: 404 });
    }

    if (run.status !== 'complete') {
      const error: DiagnosticInsightsError = {
        error: `Run is not complete (status: ${run.status})`,
        toolId,
        companyId,
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Get tool-specific system prompt
    const systemPrompt = getToolSystemPrompt(toolId);

    // Build the user prompt with run data
    const userPrompt = buildUserPrompt(run);

    // Call Claude for insights
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const insights: DiagnosticInsights = JSON.parse(jsonMatch[0]);

    const result: DiagnosticInsightsResponse = {
      toolId,
      companyId,
      runId: run.id,
      insights,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[AI Insights API] Error:', error);
    const errorResponse: DiagnosticInsightsError = {
      error: error instanceof Error ? error.message : 'Failed to generate insights',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildUserPrompt(run: Awaited<ReturnType<typeof getDiagnosticRun>>): string {
  if (!run) return 'No run data available.';

  const parts: string[] = [
    `Analyze this diagnostic run and provide actionable insights.`,
    '',
    `DIAGNOSTIC RUN DETAILS:`,
    `- Tool: ${run.toolId}`,
    `- Status: ${run.status}`,
    `- Score: ${run.score ?? 'N/A'}`,
    `- Created: ${run.createdAt}`,
  ];

  if (run.summary) {
    parts.push('', `SUMMARY:`, run.summary);
  }

  if (run.rawJson) {
    parts.push('', `RAW DATA:`, JSON.stringify(run.rawJson, null, 2));
  }

  if (run.metadata) {
    parts.push('', `METADATA:`, JSON.stringify(run.metadata, null, 2));
  }

  parts.push(
    '',
    `Respond with a JSON object matching this exact structure:`,
    `{`,
    `  "summary": "2-3 sentence executive summary of this diagnostic",`,
    `  "strengths": ["strength 1", "strength 2", "strength 3"],`,
    `  "issues": ["issue 1", "issue 2", "issue 3"],`,
    `  "quickWins": ["actionable quick win 1", "actionable quick win 2"],`,
    `  "experiments": [`,
    `    {`,
    `      "name": "Experiment name",`,
    `      "hypothesis": "If we do X, we expect Y because Z",`,
    `      "steps": ["step 1", "step 2"],`,
    `      "successMetric": "What to measure"`,
    `    }`,
    `  ],`,
    `  "suggestedWorkItems": [`,
    `    {`,
    `      "title": "Work item title",`,
    `      "area": "strategy|website|brand|content|seo|demand|ops",`,
    `      "description": "Description of what needs to be done",`,
    `      "priority": "high|medium|low"`,
    `    }`,
    `  ]`,
    `}`,
    '',
    `Provide:`,
    `- 2-4 strengths`,
    `- 2-4 issues`,
    `- 2-3 quick wins`,
    `- 1-2 experiments`,
    `- 2-4 suggested work items`,
    '',
    `Be specific with recommendations based on the data provided.`
  );

  return parts.join('\n');
}
