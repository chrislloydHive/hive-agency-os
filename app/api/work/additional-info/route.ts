// app/api/work/additional-info/route.ts
// AI Additional Info API - Generates step-by-step implementation guides for work items

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import {
  getWorkItemById,
  updateWorkItemAiAdditionalInfo,
} from '@/lib/airtable/workItems';
import { getCompanyById } from '@/lib/airtable/companies';

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
    if (workItem.companyId) {
      try {
        const company = await getCompanyById(workItem.companyId);
        if (company) {
          companyContext = `Company: ${company.name}${company.industry ? ` (Industry: ${company.industry})` : ''}${company.website ? ` - Website: ${company.website}` : ''}`;
        }
      } catch (e) {
        console.log('[Work Additional Info] Could not fetch company context:', e);
      }
    }

    // Build the user prompt
    const userPrompt = `Here is the item:

Title: ${workItem.title}
Area: ${workItem.area || 'Not specified'}
Priority: ${workItem.severity || 'Not specified'}
Status: ${workItem.status || 'Not specified'}
Short Description: ${workItem.notes || 'No description provided'}
Company Context: ${companyContext}`;

    console.log('[Work Additional Info] Calling OpenAI...');

    // Get OpenAI client and call API
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const markdown = completion.choices[0]?.message?.content || '';

    if (!markdown) {
      throw new Error('No response from OpenAI');
    }

    console.log('[Work Additional Info] OpenAI response received, saving to Airtable...');

    // Save the response to Airtable
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
