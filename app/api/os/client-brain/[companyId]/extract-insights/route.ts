// app/api/os/client-brain/[companyId]/extract-insights/route.ts
// Extract Strategic Insights from Diagnostic Tool Runs to Client Brain
//
// This API extracts CONDITION-BASED INSIGHTS (not tasks) from diagnostic runs.
// Insights describe what IS true about the client, not what should be done.
//
// IMPORTANT: This replaces the old "suggestedWorkItems" approach. Work items
// should be generated separately FROM insights, not directly from tool runs.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCompanyById } from '@/lib/airtable/companies';
import { getDiagnosticRun, getLatestRunForCompanyAndTool, isValidToolId } from '@/lib/os/diagnostics/runs';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { createClientInsights } from '@/lib/airtable/clientInsights';
import type {
  ClientInsight,
  CreateClientInsightPayload,
  InsightCategory,
  InsightSeverity,
  InsightSource,
} from '@/lib/types/clientBrain';
import { normalizeInsightCategory, normalizeInsightSeverity } from '@/lib/types/clientBrain';

const anthropic = new Anthropic();

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// System Prompt - Enforces Condition-Based Insights
// ============================================================================

const INSIGHT_EXTRACTION_SYSTEM_PROMPT = `
You are a senior marketing strategist for Hive Agency.

You will be given the result of a diagnostic tool run for a company
(e.g., GAP IA, GAP Plan, Website Lab, Brand Lab, SEO Lab, etc.).

Your job is to extract only DURABLE, STRATEGIC INSIGHTS about the client.

An insight is a FACTUAL CONDITION or OBSERVATION about the client's brand, website,
content, SEO, demand generation, analytics, operations, or competitive position that
is likely to remain true for at least the next 6–12 weeks.

=== CRITICAL RULES ===

1. DO NOT produce tasks, recommendations, or instructions.
2. DO NOT use imperative verbs like "Create", "Add", "Develop", "Implement", "Improve", "Build", "Establish".
3. DESCRIBE what IS true or IS missing, not what someone should do.
4. PHRASE everything as observations or conditions, not commands.

=== EXAMPLES ===

BAD (task): "Create a pricing page with clear tiers."
GOOD (insight): "The website does not have a pricing page, making pricing unclear to visitors."

BAD (task): "Develop a blog content plan."
GOOD (insight): "The site does not have a blog, so there is no ongoing SEO content engine."

BAD (task): "Improve homepage CTAs."
GOOD (insight): "Homepage CTAs are weak, inconsistent, or hard to see, so users lack a clear next step."

BAD (task): "Add social proof to the website."
GOOD (insight): "The website lacks customer testimonials, case studies, or other social proof."

BAD (task): "Implement analytics tracking."
GOOD (insight): "There is no visible analytics or conversion tracking setup on the site."

=== OUTPUT FORMAT ===

Each insight must be categorized into one of:
brand, content, seo, website, analytics, demand, ops, competitive, structural, product, other

Each insight must have a severity:
- critical: Major issue blocking growth or causing significant problems
- high: Important issue that should be addressed soon
- medium: Notable observation that merits attention
- low: Minor observation or opportunity

Return ONLY valid JSON matching this exact structure:

{
  "insights": [
    {
      "title": "Short condition summary (what IS true, not what to do)",
      "body": "2-4 sentences explaining the observation with supporting details from the data",
      "category": "brand|content|seo|website|analytics|demand|ops|competitive|structural|product|other",
      "severity": "critical|high|medium|low"
    }
  ]
}

Extract 5-10 insights, prioritizing the most significant observations.
Focus on facts that will help inform future strategic decisions.
`.trim();

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Parse request body
    const body = await request.json();
    const { toolId, runId } = body as { toolId?: string; runId?: string };

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Validate tool ID if provided
    if (toolId && !isValidToolId(toolId)) {
      return NextResponse.json({ error: `Invalid tool ID: ${toolId}` }, { status: 400 });
    }

    // Get the diagnostic run
    let run;
    if (runId) {
      run = await getDiagnosticRun(runId);
    } else if (toolId) {
      run = await getLatestRunForCompanyAndTool(companyId, toolId as DiagnosticToolId);
    } else {
      return NextResponse.json(
        { error: 'Either toolId or runId must be provided' },
        { status: 400 }
      );
    }

    if (!run) {
      return NextResponse.json({ error: 'Diagnostic run not found' }, { status: 404 });
    }

    if (run.status !== 'complete') {
      return NextResponse.json(
        { error: `Run is not complete (status: ${run.status})` },
        { status: 400 }
      );
    }

    // Get tool config for labeling
    const toolConfig = getToolConfig(run.toolId);
    const toolName = toolConfig?.label || run.toolId;

    console.log('[ExtractInsights] Extracting insights for:', {
      companyId,
      companyName: company.name,
      toolId: run.toolId,
      runId: run.id,
    });

    // Build user prompt with run data
    const userPrompt = buildUserPrompt(company.name, company.stage || 'Unknown', toolName, run);

    // Call Claude for insight extraction
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: INSIGHT_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
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

    const parsed = JSON.parse(jsonMatch[0]) as {
      insights: Array<{
        title: string;
        body: string;
        category: string;
        severity: string;
      }>;
    };

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      throw new Error('Invalid response format: missing insights array');
    }

    // Build insight source
    const source: InsightSource = {
      type: 'tool_run',
      toolId: run.toolId,
      toolName,
      runId: run.id,
    };

    // Create payloads for each insight
    const payloads: CreateClientInsightPayload[] = parsed.insights.map((raw) => ({
      companyId,
      title: raw.title,
      body: raw.body,
      category: normalizeInsightCategory(raw.category),
      severity: normalizeInsightSeverity(raw.severity),
      source,
      tags: [toolName, raw.category].filter(Boolean),
    }));

    // Create insights in Airtable
    const createdInsights = await createClientInsights(payloads);

    console.log('[ExtractInsights] ✅ Created', createdInsights.length, 'insights');

    return NextResponse.json({
      success: true,
      count: createdInsights.length,
      insights: createdInsights,
      source: {
        toolId: run.toolId,
        toolName,
        runId: run.id,
      },
    });
  } catch (error) {
    console.error('[ExtractInsights] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract insights' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildUserPrompt(
  companyName: string,
  companyStage: string,
  toolName: string,
  run: Awaited<ReturnType<typeof getDiagnosticRun>>
): string {
  if (!run) return 'No run data available.';

  const parts: string[] = [
    `Extract strategic insights from this diagnostic run.`,
    '',
    `COMPANY INFORMATION:`,
    `- Name: ${companyName}`,
    `- Stage: ${companyStage}`,
    '',
    `DIAGNOSTIC TOOL: ${toolName}`,
    '',
    `RUN DETAILS:`,
    `- Status: ${run.status}`,
    `- Score: ${run.score ?? 'N/A'}`,
    `- Created: ${run.createdAt}`,
  ];

  if (run.summary) {
    parts.push('', `SUMMARY:`, run.summary);
  }

  if (run.rawJson) {
    // Truncate large JSON to avoid token limits
    const jsonStr = JSON.stringify(run.rawJson, null, 2);
    const truncated = jsonStr.length > 15000 ? jsonStr.substring(0, 15000) + '\n... (truncated)' : jsonStr;
    parts.push('', `RAW DIAGNOSTIC DATA:`, truncated);
  }

  if (run.metadata) {
    parts.push('', `METADATA:`, JSON.stringify(run.metadata, null, 2));
  }

  parts.push(
    '',
    `Remember: Extract CONDITION-BASED INSIGHTS only. Describe what IS true, not what should be done.`,
    `Return valid JSON with the "insights" array.`
  );

  return parts.join('\n');
}
