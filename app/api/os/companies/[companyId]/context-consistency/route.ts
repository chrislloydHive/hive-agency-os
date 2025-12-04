// app/api/os/companies/[companyId]/context-consistency/route.ts
// AI Consistency Check API
//
// Analyzes context graph for contradictions, gaps, and inconsistencies

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { flattenGraphToFields } from '@/lib/contextGraph/uiHelpers';

// ============================================================================
// Types
// ============================================================================

interface ConsistencyIssue {
  type: 'contradiction' | 'incomplete' | 'inconsistent' | 'suggestion';
  severity: 'high' | 'medium' | 'low';
  fields: string[];
  description: string;
  suggestion?: string;
}

interface ConsistencyResult {
  overallScore: number;
  status: 'consistent' | 'minor_issues' | 'needs_review' | 'critical';
  issues: ConsistencyIssue[];
  summary: string;
}

// ============================================================================
// POST - Run consistency check
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    // Load context graph
    const graph = await loadContextGraph(companyId);

    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // Flatten graph to fields for analysis
    const fields = flattenGraphToFields(graph);

    // Build a summary of populated fields for AI analysis
    const fieldSummary = fields
      .filter(f => f.value !== null && f.value !== '')
      .map(f => `- ${f.path}: ${f.value?.slice(0, 200)}${f.value && f.value.length > 200 ? '...' : ''}`)
      .join('\n');

    if (!fieldSummary) {
      return NextResponse.json({
        overallScore: 50,
        status: 'needs_review',
        issues: [{
          type: 'incomplete',
          severity: 'high',
          fields: [],
          description: 'Context graph has very few populated fields.',
          suggestion: 'Run diagnostics to populate the context graph with company data.',
        }],
        summary: 'Not enough data to analyze. Run diagnostics to build context.',
      } satisfies ConsistencyResult);
    }

    // Build prompt
    const prompt = `You are an expert marketing data analyst checking a company's marketing context graph for consistency issues.

Analyze the following context graph data for contradictions, inconsistencies, and gaps:

${fieldSummary}

Look for:
1. **Contradictions**: Values that directly conflict (e.g., "target CPA: $20" but "historical CPA: $100" without explanation)
2. **Incomplete sets**: Related fields where some are populated but key ones are missing
3. **Inconsistent data**: Values that seem misaligned (e.g., "luxury brand positioning" with "low price point")
4. **Data quality issues**: Values that seem suspicious or potentially outdated

Provide a JSON response with exactly this structure:
{
  "overallScore": 85,
  "status": "consistent|minor_issues|needs_review|critical",
  "issues": [
    {
      "type": "contradiction|incomplete|inconsistent|suggestion",
      "severity": "high|medium|low",
      "fields": ["field.path.one", "field.path.two"],
      "description": "Clear description of the issue",
      "suggestion": "Actionable suggestion to fix"
    }
  ],
  "summary": "One sentence overall summary"
}

Guidelines:
- overallScore: 0-100, where 100 is perfectly consistent
- status: consistent (90+), minor_issues (70-89), needs_review (50-69), critical (<50)
- issues: List 0-5 most important issues, prioritized by severity
- Be specific about which fields are involved
- Only flag real issues, don't invent problems

Respond ONLY with the JSON object, no markdown formatting.`;

    // Call Claude API
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
    const result = JSON.parse(jsonText);

    // Validate and normalize
    const normalizedResult: ConsistencyResult = {
      overallScore: typeof result.overallScore === 'number'
        ? Math.max(0, Math.min(100, result.overallScore))
        : 70,
      status: ['consistent', 'minor_issues', 'needs_review', 'critical'].includes(result.status)
        ? result.status
        : 'minor_issues',
      issues: Array.isArray(result.issues)
        ? result.issues.slice(0, 5).map((issue: ConsistencyIssue) => ({
            type: ['contradiction', 'incomplete', 'inconsistent', 'suggestion'].includes(issue.type)
              ? issue.type
              : 'suggestion',
            severity: ['high', 'medium', 'low'].includes(issue.severity)
              ? issue.severity
              : 'medium',
            fields: Array.isArray(issue.fields) ? issue.fields : [],
            description: issue.description ?? 'Issue detected',
            suggestion: issue.suggestion,
          }))
        : [],
      summary: result.summary ?? 'Analysis complete.',
    };

    return NextResponse.json(normalizedResult);
  } catch (error) {
    console.error('[context-consistency] Error:', error);

    // Return a fallback result on error
    return NextResponse.json({
      overallScore: 70,
      status: 'minor_issues',
      issues: [{
        type: 'suggestion',
        severity: 'low',
        fields: [],
        description: 'Unable to complete full consistency check.',
        suggestion: 'Try running the check again or ensure the context graph has sufficient data.',
      }],
      summary: 'Partial analysis completed. Some checks could not be performed.',
    } satisfies ConsistencyResult);
  }
}
