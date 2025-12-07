// app/api/tools/[toolSlug]/[runId]/generate-work/route.ts
// API endpoint for generating work items from a diagnostic run
//
// Uses AI to analyze the raw JSON from a diagnostic run and extract
// actionable work items, then creates them in the Work Items table.

import { NextRequest, NextResponse } from 'next/server';
import { getDiagnosticRun, isValidToolId, type DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { getCompanyById } from '@/lib/airtable/companies';
import { createWorkItemsFromToolRun, type ToolRunWorkItemInput } from '@/lib/airtable/workItems';
import { aiForCompany } from '@/lib/ai-gateway';
import type { WorkCategory, WorkPriority, WorkSourceToolRun } from '@/lib/types/work';

export const maxDuration = 60;

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
  'seo-heavy': 'seoLab', // Redirect old slug to seoLab
  'demand-lab': 'demandLab',
  'demandLab': 'demandLab',
  'ops-lab': 'opsLab',
  'opsLab': 'opsLab',
};

// Tool name display mapping
const toolNames: Record<DiagnosticToolId, string> = {
  gapSnapshot: 'GAP IA',
  gapIa: 'GAP IA',
  gapPlan: 'GAP Plan',
  gapHeavy: 'GAP Heavy',
  websiteLab: 'Website Lab',
  brandLab: 'Brand Lab',
  audienceLab: 'Audience Lab',
  mediaLab: 'Media Lab',
  contentLab: 'Content Lab',
  seoLab: 'SEO Lab',
  demandLab: 'Demand Lab',
  opsLab: 'Ops Lab',
  creativeLab: 'Creative Lab',
  competitorLab: 'Competitor Lab',
  competitionLab: 'Competition Lab',
};

interface RouteContext {
  params: Promise<{ toolSlug: string; runId: string }>;
}

interface GeneratedWorkItem {
  title: string;
  description: string;
  category: WorkCategory;
  priority: WorkPriority;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { toolSlug, runId } = await context.params;

    // Resolve slug to tool ID
    const toolId = slugToToolId[toolSlug];
    if (!toolId || !isValidToolId(toolId)) {
      return NextResponse.json(
        { error: `Invalid tool: ${toolSlug}` },
        { status: 400 }
      );
    }

    const tool = getToolConfig(toolId);
    const toolName = tool?.label || toolNames[toolId] || toolId;

    // Fetch the diagnostic run
    const run = await getDiagnosticRun(runId);
    if (!run) {
      return NextResponse.json(
        { error: 'Diagnostic run not found' },
        { status: 404 }
      );
    }

    const companyId = run.companyId;

    // Fetch company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    if (run.status !== 'complete') {
      return NextResponse.json(
        { error: 'Cannot generate work items from incomplete run' },
        { status: 400 }
      );
    }

    if (!run.rawJson) {
      return NextResponse.json(
        { error: 'Run has no raw data' },
        { status: 400 }
      );
    }

    console.log(`[API] Generating work items from ${toolName} run:`, runId);

    // Use AI to extract work items from the raw JSON
    const generatedItems = await extractWorkItemsWithAI({
      companyId,
      companyName: company.name,
      companyStage: company.stage,
      companyWebsite: company.website,
      toolId,
      toolName,
      rawJson: run.rawJson,
      score: run.score,
      summary: run.summary,
    });

    console.log(`[API] AI generated ${generatedItems.length} work items`);

    if (generatedItems.length === 0) {
      return NextResponse.json({
        ok: true,
        workItemsCreated: 0,
        workItems: [],
        message: 'No actionable work items could be extracted from this diagnostic.',
      });
    }

    // Build the source for all items
    const source: WorkSourceToolRun = {
      sourceType: 'tool_run',
      toolSlug,
      toolRunId: runId,
      companyId,
    };

    // Map generated items to ToolRunWorkItemInput
    const itemsToCreate: ToolRunWorkItemInput[] = generatedItems.map((item) => ({
      title: item.title,
      description: item.description,
      category: item.category,
      priority: item.priority,
      source,
    }));

    // Create work items in batch
    const createdItems = await createWorkItemsFromToolRun({
      companyId,
      items: itemsToCreate,
    });

    console.log(`[API] Created ${createdItems.length} work items from ${toolName}`);

    return NextResponse.json({
      ok: true,
      workItemsCreated: createdItems.length,
      workItems: createdItems.map((item) => ({
        id: item.id,
        title: item.title,
        area: item.area,
        severity: item.severity,
      })),
      source: {
        toolSlug,
        toolRunId: runId,
        toolName,
      },
    });

  } catch (error) {
    console.error('[API] Generate work error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// AI Work Item Extraction
// ============================================================================

interface ExtractWorkItemsParams {
  companyId: string;
  companyName: string;
  companyStage?: string;
  companyWebsite?: string;
  toolId: DiagnosticToolId;
  toolName: string;
  rawJson: unknown;
  score?: number | null;
  summary?: string | null;
}

async function extractWorkItemsWithAI(params: ExtractWorkItemsParams): Promise<GeneratedWorkItem[]> {
  const {
    companyId,
    companyName,
    companyStage,
    companyWebsite,
    toolId,
    toolName,
    rawJson,
    score,
    summary,
  } = params;

  const systemPrompt = `You are a senior marketing strategist at a growth consulting firm.
Given a tool diagnostic (GAP IA, GAP Plan, Website Lab, Brand Lab, SEO Lab, etc.), extract concrete work items that a marketing team should execute.

Each work item should be:
- Specific and implementable (not vague recommendations)
- Scoped to 1-2 weeks of focused work
- Action-oriented with a clear deliverable

Classify each work item by:
- category: One of: brand, content, seo, website, analytics, ops, demand, other
- priority: One of: P0 (critical/urgent), P1 (high impact), P2 (medium), P3 (nice-to-have)

Return ONLY valid JSON in this exact shape:
{
  "items": [
    {
      "title": "Action-oriented title (6-10 words)",
      "description": "2-3 sentences explaining what to do and expected outcome",
      "category": "brand|content|seo|website|analytics|ops|demand|other",
      "priority": "P0|P1|P2|P3"
    }
  ]
}

Generate 5-10 work items, prioritizing high-impact opportunities and critical issues.`;

  // Prepare the raw JSON for the prompt (truncate if huge)
  const rawJsonStr = JSON.stringify(rawJson, null, 2);
  const truncatedJson = rawJsonStr.length > 8000
    ? rawJsonStr.slice(0, 8000) + '\n\n[... truncated for length ...]'
    : rawJsonStr;

  const taskPrompt = `Analyze this ${toolName} diagnostic and extract actionable work items.

## Company Context
- Name: ${companyName}
- Stage: ${companyStage || 'Unknown'}
- Website: ${companyWebsite || 'Unknown'}

## Diagnostic Results
- Tool: ${toolName}
- Score: ${score !== null && score !== undefined ? `${score}/100` : 'N/A'}
${summary ? `- Summary: ${summary}` : ''}

## Raw Diagnostic Data
\`\`\`json
${truncatedJson}
\`\`\`

Based on this diagnostic, generate specific, actionable work items that will improve the company's marketing effectiveness.`;

  try {
    const { content } = await aiForCompany(companyId, {
      type: 'Work Item',
      tags: ['Work Generation', toolName, toolId],
      relatedEntityId: toolId,
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 3000,
      jsonMode: true,
    });

    // Parse the response
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];

    // Validate and normalize items
    return items
      .filter((item: unknown): item is Record<string, unknown> => {
        if (!item || typeof item !== 'object') return false;
        const obj = item as Record<string, unknown>;
        return (
          typeof obj.title === 'string' &&
          obj.title.length > 0 &&
          typeof obj.description === 'string'
        );
      })
      .map((item: Record<string, unknown>) => ({
        title: String(item.title),
        description: String(item.description || ''),
        category: normalizeCategory(String(item.category || 'other')),
        priority: normalizePriority(String(item.priority || 'P2')),
      }))
      .slice(0, 10); // Cap at 10 items

  } catch (error) {
    console.error('[API] AI extraction failed:', error);

    // Fallback: try to extract from common patterns in raw data
    return extractWorkItemsFallback(toolId, rawJson, toolName);
  }
}

// ============================================================================
// Normalization Helpers
// ============================================================================

function normalizeCategory(category: string): WorkCategory {
  const normalized = category.toLowerCase().trim();
  const mapping: Record<string, WorkCategory> = {
    brand: 'brand',
    content: 'content',
    seo: 'seo',
    website: 'website',
    'website ux': 'website',
    websiteux: 'website',
    analytics: 'analytics',
    tracking: 'analytics',
    ops: 'ops',
    operations: 'ops',
    demand: 'demand',
    funnel: 'demand',
    other: 'other',
  };
  return mapping[normalized] || 'other';
}

function normalizePriority(priority: string): WorkPriority {
  const normalized = priority.toUpperCase().trim();
  if (['P0', 'P1', 'P2', 'P3'].includes(normalized)) {
    return normalized as WorkPriority;
  }
  // Map legacy priority values
  const mapping: Record<string, WorkPriority> = {
    CRITICAL: 'P0',
    HIGH: 'P1',
    MEDIUM: 'P2',
    LOW: 'P3',
  };
  return mapping[normalized] || 'P2';
}

// ============================================================================
// Fallback Extraction (when AI fails)
// ============================================================================

function extractWorkItemsFallback(
  toolId: DiagnosticToolId,
  rawJson: unknown,
  toolName: string
): GeneratedWorkItem[] {
  const items: GeneratedWorkItem[] = [];

  try {
    const data = (rawJson || {}) as Record<string, unknown>;

    // GAP-style quick wins
    const quickWins = (data.quickWins || (data.initialAssessment as Record<string, unknown>)?.quickWins || []) as unknown[];
    for (const win of quickWins.slice(0, 3)) {
      if (typeof win === 'string' && win.length > 0) {
        items.push({
          title: win.length > 60 ? win.slice(0, 57) + '...' : win,
          description: `Quick win from ${toolName}: ${win}`,
          category: 'other',
          priority: 'P1',
        });
      } else if (win && typeof win === 'object') {
        const winObj = win as Record<string, unknown>;
        if (winObj.title) {
          items.push({
            title: String(winObj.title),
            description: String(winObj.description || winObj.summary || `Quick win from ${toolName}`),
            category: normalizeCategory(String(winObj.area || 'other')),
            priority: 'P1',
          });
        }
      }
    }

    // GAP-style gaps/weaknesses
    const gaps = (data.gaps || data.weaknesses || (data.initialAssessment as Record<string, unknown>)?.gaps || []) as unknown[];
    for (const gap of gaps.slice(0, 3)) {
      if (typeof gap === 'string' && gap.length > 0) {
        items.push({
          title: `Address: ${gap.length > 50 ? gap.slice(0, 47) + '...' : gap}`,
          description: `Gap identified from ${toolName}: ${gap}`,
          category: 'other',
          priority: 'P2',
        });
      } else if (gap && typeof gap === 'object') {
        const gapObj = gap as Record<string, unknown>;
        if (gapObj.title) {
          items.push({
            title: `Fix: ${String(gapObj.title)}`,
            description: String(gapObj.description || gapObj.summary || `Gap from ${toolName}`),
            category: normalizeCategory(String(gapObj.area || 'other')),
            priority: 'P2',
          });
        }
      }
    }

    // Recommendations
    const recommendations = (data.recommendations || data.actionItems || []) as unknown[];
    for (const rec of recommendations.slice(0, 3)) {
      if (typeof rec === 'string' && rec.length > 0) {
        items.push({
          title: rec.length > 60 ? rec.slice(0, 57) + '...' : rec,
          description: `Recommendation from ${toolName}: ${rec}`,
          category: 'other',
          priority: 'P2',
        });
      } else if (rec && typeof rec === 'object') {
        const recObj = rec as Record<string, unknown>;
        if (recObj.title) {
          items.push({
            title: String(recObj.title),
            description: String(recObj.description || recObj.summary || `Recommendation from ${toolName}`),
            category: normalizeCategory(String(recObj.area || 'other')),
            priority: normalizePriority(String(recObj.priority || 'P2')),
          });
        }
      }
    }

  } catch (error) {
    console.warn('[API] Fallback extraction failed:', error);
  }

  return items.slice(0, 8);
}
