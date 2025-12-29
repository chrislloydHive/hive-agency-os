// app/api/os/companies/[companyId]/context-explain/route.ts
// AI Field Explanation API
//
// Uses AI to explain what a context field means and why it matters

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { ContextDomainId } from '@/lib/contextGraph/uiHelpers';

// ============================================================================
// Types
// ============================================================================

interface ExplanationRequest {
  fieldPath: string;
  fieldLabel: string;
  fieldValue: string | null;
  domainId: string;
}

// ============================================================================
// POST - Generate field explanation
// ============================================================================

export async function POST(
  request: NextRequest,
  { params: _params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const body: ExplanationRequest = await request.json();

    const { fieldPath, fieldLabel, fieldValue, domainId } = body;

    if (!fieldPath || !fieldLabel || !domainId) {
      return NextResponse.json(
        { error: 'Missing required fields: fieldPath, fieldLabel, domainId' },
        { status: 400 }
      );
    }

    const domainMeta = CONTEXT_DOMAIN_META[domainId as ContextDomainId];
    const domainDescription = domainMeta?.description ?? 'Marketing context';

    // Build prompt
    const prompt = `You are an expert marketing strategist explaining context graph fields to marketing analysts.

Explain the following context field in a clear, practical way:

**Field:** ${fieldLabel}
**Path:** ${fieldPath}
**Domain:** ${domainId} (${domainDescription})
**Current Value:** ${fieldValue ?? 'Not set'}

Provide a JSON response with exactly this structure:
{
  "explanation": "A 2-3 sentence explanation of what this field represents and captures. Be specific to marketing/advertising context.",
  "importance": "A 2-3 sentence explanation of why this field matters for marketing strategy, media planning, or campaign execution.",
  "relatedFields": ["field1", "field2", "field3"],
  "sourceSuggestions": ["How to populate this field - suggestion 1", "Suggestion 2", "Suggestion 3"]
}

Guidelines:
- explanation: Focus on what data this field stores and its practical meaning
- importance: Connect to marketing outcomes (ROAS, CPA, audience reach, brand perception)
- relatedFields: List 3-5 related fields that work together with this one (use short names like "targetCpa", "activeChannels")
- sourceSuggestions: Provide 2-4 actionable ways to populate or update this field

Respond ONLY with the JSON object, no markdown formatting.`;

    // Call Claude API
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON from response
    const jsonText = textContent.text.trim();
    const explanation = JSON.parse(jsonText);

    // Validate structure
    const result = {
      explanation: explanation.explanation ?? 'Unable to generate explanation.',
      importance: explanation.importance ?? 'This field provides important context for marketing decisions.',
      relatedFields: Array.isArray(explanation.relatedFields) ? explanation.relatedFields.slice(0, 5) : [],
      sourceSuggestions: Array.isArray(explanation.sourceSuggestions) ? explanation.sourceSuggestions.slice(0, 4) : [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[context-explain] Error:', error);

    // Return a fallback explanation on error
    return NextResponse.json({
      explanation: 'This field stores important marketing context used for strategy and planning decisions.',
      importance: 'Having accurate data in this field helps AI assistants provide better recommendations.',
      relatedFields: [],
      sourceSuggestions: [
        'Run relevant diagnostics to auto-populate',
        'Manually enter based on client briefing',
        'Import from connected data sources',
      ],
    });
  }
}
