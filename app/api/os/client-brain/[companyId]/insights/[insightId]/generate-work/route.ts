// app/api/os/client-brain/[companyId]/insights/[insightId]/generate-work/route.ts
// Generate Work Items from a Client Brain Insight
//
// This API generates concrete, actionable WORK ITEMS (tasks) from a strategic insight.
// Work items ARE tasks and should use imperative language like "Create", "Implement", etc.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCompanyById } from '@/lib/airtable/companies';
import { getClientInsight, incrementInsightWorkItemCount } from '@/lib/airtable/clientInsights';
import { createWorkItem } from '@/lib/airtable/workItems';
import type { WorkItem, WorkSourceClientBrainInsight, WorkCategory, WorkPriority } from '@/lib/types/work';

const anthropic = new Anthropic();

interface RouteContext {
  params: Promise<{ companyId: string; insightId: string }>;
}

// ============================================================================
// System Prompt - Generates Actionable Work Items
// ============================================================================

const WORK_GENERATION_SYSTEM_PROMPT = `
You are a senior marketing strategist for Hive Agency.

You will receive a single strategic INSIGHT about a client (a condition-based observation, not a task).

Your job is to propose 1-3 concrete WORK ITEMS that would address or leverage this insight.

=== WHAT ARE WORK ITEMS? ===

Work items ARE tasks. They should be:
- Clearly scoped and actionable
- Sized for 1-2 weeks of focused effort
- Written in IMPERATIVE language (do X, create Y, implement Z)

=== EXAMPLES ===

Insight: "The website does not have a pricing page, making pricing unclear to visitors."
Work Items:
1. "Create a dedicated pricing page with clear tier comparison"
2. "Add pricing summary to the homepage hero section"

Insight: "Homepage CTAs are weak, inconsistent, or hard to see."
Work Items:
1. "Redesign homepage CTA buttons with contrasting colors and clear action text"
2. "Implement A/B test for primary CTA placement above the fold"

Insight: "The site does not have a blog, so there is no ongoing SEO content engine."
Work Items:
1. "Set up blog infrastructure with category structure and author profiles"
2. "Create editorial calendar with 4 pillar content topics"
3. "Write and publish first 3 foundational blog posts"

=== OUTPUT FORMAT ===

For each work item, provide:
- title: Clear, imperative task title (6-12 words)
- description: 2-3 sentences explaining what needs to be done and why
- category: brand|content|seo|website|analytics|demand|ops|other
- priority: P0 (critical) | P1 (high) | P2 (medium) | P3 (low)

Return ONLY valid JSON:

{
  "items": [
    {
      "title": "Imperative task title",
      "description": "What to do and why it matters",
      "category": "website",
      "priority": "P1"
    }
  ]
}

Generate 1-3 work items. Focus on the most impactful actions.
`.trim();

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId, insightId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get the insight
    const insight = await getClientInsight(insightId);
    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    // Validate insight belongs to company
    if (insight.companyId !== companyId) {
      return NextResponse.json({ error: 'Insight does not belong to this company' }, { status: 403 });
    }

    console.log('[GenerateWork] Generating work items from insight:', {
      companyId,
      companyName: company.name,
      insightId,
      insightTitle: insight.title,
    });

    // Build user prompt
    const userPrompt = buildUserPrompt(company.name, company.stage || 'Unknown', insight);

    // Call Claude for work item generation
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: WORK_GENERATION_SYSTEM_PROMPT,
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
      items: Array<{
        title: string;
        description: string;
        category: string;
        priority: string;
      }>;
    };

    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error('Invalid response format: missing items array');
    }

    // Build work source
    const source: WorkSourceClientBrainInsight = {
      sourceType: 'client_brain_insight',
      insightId: insight.id,
      insightTitle: insight.title,
    };

    // Create work items
    const createdItems: WorkItem[] = [];

    for (const raw of parsed.items) {
      const category = normalizeWorkCategory(raw.category);
      const priority = normalizeWorkPriority(raw.priority);

      const workItem = await createWorkItem({
        title: raw.title,
        notes: raw.description,
        companyId,
        area: categoryToArea(category),
        severity: priorityToSeverity(priority),
        status: 'Backlog',
        source,
      });

      if (workItem) {
        createdItems.push(workItem);
      }
    }

    // Update insight work item count
    if (createdItems.length > 0) {
      await incrementInsightWorkItemCount(insightId, createdItems.length);
    }

    console.log('[GenerateWork] ✅ Created', createdItems.length, 'work items');

    return NextResponse.json({
      success: true,
      count: createdItems.length,
      items: createdItems,
      insight: {
        id: insight.id,
        title: insight.title,
      },
    });
  } catch (error) {
    console.error('[GenerateWork] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate work items' },
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
  insight: Awaited<ReturnType<typeof getClientInsight>>
): string {
  if (!insight) return 'No insight data available.';

  const parts: string[] = [
    `Generate work items to address this strategic insight.`,
    '',
    `COMPANY:`,
    `- Name: ${companyName}`,
    `- Stage: ${companyStage}`,
    '',
    `INSIGHT:`,
    `- Title: ${insight.title}`,
    `- Category: ${insight.category}`,
    `- Severity: ${insight.severity}`,
    '',
    `DETAILS:`,
    insight.body,
    '',
    `Generate 1-3 actionable work items that would address this insight.`,
    `Use imperative language (Create X, Implement Y, etc).`,
    `Return valid JSON with the "items" array.`,
  ];

  return parts.join('\n');
}

function normalizeWorkCategory(raw: string): WorkCategory {
  const v = (raw ?? '').toLowerCase().trim();
  if (['brand', 'branding'].includes(v)) return 'brand';
  if (['content', 'blog'].includes(v)) return 'content';
  if (['seo', 'search'].includes(v)) return 'seo';
  if (['website', 'web', 'ux'].includes(v)) return 'website';
  if (['analytics', 'data'].includes(v)) return 'analytics';
  if (['demand', 'paid', 'funnel'].includes(v)) return 'ops'; // Map demand to ops
  if (['ops', 'operations'].includes(v)) return 'ops';
  return 'other';
}

function normalizeWorkPriority(raw: string): WorkPriority {
  const v = (raw ?? '').toUpperCase().trim();
  if (v === 'P0' || v === 'CRITICAL') return 'P0';
  if (v === 'P1' || v === 'HIGH') return 'P1';
  if (v === 'P2' || v === 'MEDIUM') return 'P2';
  return 'P3';
}

// Map WorkCategory to legacy WorkItemArea
function categoryToArea(category: WorkCategory): 'Brand' | 'Content' | 'SEO' | 'Website UX' | 'Analytics' | 'Operations' | 'Other' {
  const mapping: Record<WorkCategory, 'Brand' | 'Content' | 'SEO' | 'Website UX' | 'Analytics' | 'Operations' | 'Other'> = {
    brand: 'Brand',
    content: 'Content',
    seo: 'SEO',
    website: 'Website UX',
    analytics: 'Analytics',
    ops: 'Operations',
    other: 'Other',
  };
  return mapping[category] || 'Other';
}

// Map WorkPriority to legacy severity
function priorityToSeverity(priority: WorkPriority): 'Critical' | 'High' | 'Medium' | 'Low' {
  const mapping: Record<WorkPriority, 'Critical' | 'High' | 'Medium' | 'Low'> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low',
  };
  return mapping[priority] || 'Medium';
}
