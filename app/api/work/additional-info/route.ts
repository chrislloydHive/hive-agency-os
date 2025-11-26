// app/api/work/additional-info/route.ts
// AI Additional Info API - Generates step-by-step implementation guides for work items
//
// This API uses the AI Gateway (aiForCompany) which automatically:
// 1. Fetches historical context for the company before generating
// 2. Injects context into the AI prompt for smarter responses
// 3. Saves the generated content back to the company's AI memory

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkItemById,
  updateWorkItemAiAdditionalInfo,
} from '@/lib/airtable/workItems';
import { getCompanyById } from '@/lib/airtable/companies';
import { aiForCompany, suggestTagsFromContent, aiSimple } from '@/lib/ai-gateway';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a senior digital marketing implementation specialist.

I will give you a Work Item from Hive OS. Your job is to produce a practical, step-by-step explanation of **exactly how to complete the task in real life**, assuming a typical mid-size business website.

Please return clear, tactical guidance—not theory.

Focus on:
- What "done" looks like (Definition of Done)
- A numbered step-by-step implementation plan
- Any examples or tools that make execution easier
- Common pitfalls to avoid
- Specific steps for SEO, Website UX, Content, or Brand work depending on the item

Please output your response in GitHub-flavored Markdown using **these sections**:

# Summary
(2–3 sentences)

# Step-by-Step Implementation Plan
(Numbered list with enough detail that a junior marketer could execute)

# Definition of Done
(Clear checklist)

# Tools & Examples
(Anything that helps)

# Common Pitfalls to Avoid
(Short, actionable)

The tone should be helpful, clear, and direct—like a senior strategist writing playbooks for the team.`;

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: { workItemId: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { workItemId } = body;

    if (!workItemId) {
      return NextResponse.json(
        { ok: false, error: 'workItemId is required' },
        { status: 400 }
      );
    }

    console.log('[Work Additional Info] Generating for work item:', workItemId);

    // Fetch the work item from Airtable
    const workItem = await getWorkItemById(workItemId);

    if (!workItem) {
      return NextResponse.json(
        { ok: false, error: 'Work item not found' },
        { status: 404 }
      );
    }

    // Fetch company context if available
    let companyContext = 'No company context available';
    let company = null;
    if (workItem.companyId) {
      try {
        company = await getCompanyById(workItem.companyId);
        if (company) {
          companyContext = `Company: ${company.name}${company.industry ? ` (Industry: ${company.industry})` : ''}${company.website ? ` - Website: ${company.website}` : ''}`;
        }
      } catch (e) {
        console.log('[Work Additional Info] Could not fetch company context:', e);
      }
    }

    // Build the task prompt
    const taskPrompt = `Here is the work item:

Title: ${workItem.title}
Area: ${workItem.area || 'Not specified'}
Priority: ${workItem.severity || 'Not specified'}
Status: ${workItem.status || 'Not specified'}
Short Description: ${workItem.notes || 'No description provided'}
Company Context: ${companyContext}

Please produce a detailed, step-by-step implementation guide for completing this work item.`;

    // Suggest tags based on work item area
    const tags = suggestTagsFromContent(workItem.title + ' ' + (workItem.notes || ''), workItem.area);

    // Use AI Gateway if we have a companyId, otherwise fall back to simple AI
    let markdown: string;

    if (workItem.companyId) {
      // =========================================================================
      // Use AI Gateway (aiForCompany) - handles memory automatically
      // =========================================================================
      console.log('[Work Additional Info] Using AI Gateway for company:', workItem.companyId);

      const { content } = await aiForCompany(workItem.companyId, {
        type: 'Work Item',
        tags,
        relatedEntityId: workItemId,
        systemPrompt: SYSTEM_PROMPT,
        taskPrompt,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
        memoryOptions: {
          limit: 15,
        },
      });

      markdown = content;
    } else {
      // =========================================================================
      // No company - use simple AI call without memory
      // =========================================================================
      console.log('[Work Additional Info] No company ID, using simple AI call');

      markdown = await aiSimple({
        systemPrompt: SYSTEM_PROMPT,
        taskPrompt,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
      });
    }

    if (!markdown) {
      throw new Error('No response from AI');
    }

    console.log('[Work Additional Info] AI response received, saving to Airtable...');

    // Save the response to Airtable (Work Item)
    await updateWorkItemAiAdditionalInfo(workItemId, markdown);

    console.log('[Work Additional Info] Successfully saved AI Additional Info');

    return NextResponse.json({
      ok: true,
      markdown,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Work Additional Info] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Extract summary for memory storage
// ============================================================================

/**
 * Extract a concise summary from the AI response for memory storage
 * We don't want to store the full implementation guide, just key insights
 */
function extractMemorySummary(markdown: string, title: string): string {
  // Try to extract the Summary section
  const summaryMatch = markdown.match(/# Summary\s*\n([\s\S]*?)(?=\n#|$)/i);
  if (summaryMatch && summaryMatch[1]) {
    const summary = summaryMatch[1].trim();
    return `Work Item: "${title}"\n\nSummary: ${summary}`;
  }

  // Fallback: take first 400 characters
  const truncated = markdown.slice(0, 400).trim();
  return `Work Item: "${title}"\n\n${truncated}${markdown.length > 400 ? '...' : ''}`;
}
