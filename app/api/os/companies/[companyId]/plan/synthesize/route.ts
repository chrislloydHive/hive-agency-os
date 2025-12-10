// app/api/os/companies/[companyId]/plan/synthesize/route.ts
// Plan Synthesis API
//
// POST: Generate AI synthesis of findings into strategic plan
// Returns themes, prioritized actions, sequencing, and KPIs

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCompanyFindings, getCompanyFindingsSummary } from '@/lib/os/findings/companyFindings';
import { getCompanyById } from '@/lib/airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface PlanSynthesis {
  themes: string[];
  prioritizedActions: string[];
  sequencing: string;
  kpiConsiderations: string;
  implementationNotes: string;
  summary: string;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // Fetch company and findings
    const [company, findings, summary] = await Promise.all([
      getCompanyById(companyId),
      getCompanyFindings(companyId),
      getCompanyFindingsSummary(companyId),
    ]);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    if (findings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No findings to synthesize' },
        { status: 400 }
      );
    }

    // Prepare findings for AI
    const findingsSummary = findings.map(f => ({
      severity: f.severity,
      category: f.category,
      lab: f.labSlug,
      description: f.description,
      recommendation: f.recommendation,
    }));

    // Generate synthesis using Claude
    const anthropic = new Anthropic();

    const systemPrompt = `You are a strategic marketing consultant analyzing diagnostic findings for a company.
Your task is to synthesize the findings into a coherent strategic plan.
Respond ONLY with valid JSON matching the schema below. No markdown, no explanation, just JSON.

Schema:
{
  "themes": ["string array of 3-5 primary strategic themes"],
  "prioritizedActions": ["string array of 5-8 prioritized action items"],
  "sequencing": "string describing recommended order of execution",
  "kpiConsiderations": "string describing key metrics to track",
  "implementationNotes": "string with practical implementation advice",
  "summary": "string with 2-3 sentence executive summary"
}`;

    const userPrompt = `Company: ${company.name}
Website: ${company.website || 'Not provided'}

Findings Summary:
- Total: ${summary.total}
- Critical: ${summary.bySeverity['critical'] || 0}
- High: ${summary.bySeverity['high'] || 0}
- Medium: ${summary.bySeverity['medium'] || 0}
- Low: ${summary.bySeverity['low'] || 0}

Findings Detail:
${JSON.stringify(findingsSummary.slice(0, 30), null, 2)}

Generate a strategic synthesis of these findings.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      system: systemPrompt,
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let synthesis: PlanSynthesis;
    try {
      synthesis = JSON.parse(content.text);
    } catch (parseError) {
      console.error('[Plan Synthesis] Failed to parse AI response:', content.text);
      throw new Error('Failed to parse synthesis response');
    }

    // Validate structure
    if (!synthesis.themes || !synthesis.prioritizedActions || !synthesis.summary) {
      throw new Error('Incomplete synthesis response');
    }

    return NextResponse.json({
      success: true,
      synthesis,
      findingsCount: findings.length,
    });
  } catch (error) {
    console.error('[Plan Synthesis API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate synthesis',
      },
      { status: 500 }
    );
  }
}
