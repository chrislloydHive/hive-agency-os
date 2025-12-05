// app/api/setup/[companyId]/generate-summary/route.ts
// Generate AI summary of strategic setup data

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SetupFormData } from '@/app/c/[companyId]/brain/setup/types';

const anthropic = new Anthropic();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();
    const { formData } = body as { formData: Partial<SetupFormData> };

    // Build a comprehensive prompt from the form data
    const dataContext = buildDataContext(formData);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a strategic marketing consultant. Based on the following company setup data, generate a concise strategic summary.

${dataContext}

Generate a strategic summary with these sections:
1. **Strategy Summary** (2-3 sentences): High-level overview of the company's marketing strategy and positioning
2. **Key Recommendations** (3-5 bullet points): Most important strategic actions to take
3. **Next Steps** (3-5 bullet points): Immediate tactical actions to implement

Be specific and actionable. Focus on what matters most for this particular business.

Return the response as JSON:
{
  "strategySummary": "...",
  "keyRecommendations": ["...", "..."],
  "nextSteps": ["...", "..."]
}`,
        },
      ],
    });

    // Extract the text response
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse the JSON from the response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      summary: result,
    });
  } catch (error) {
    console.error('[GenerateSummary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

function buildDataContext(formData: Partial<SetupFormData>): string {
  const sections: string[] = [];

  // Business Identity
  if (formData.businessIdentity) {
    const bi = formData.businessIdentity;
    sections.push(`## Business Identity
- Name: ${bi.businessName || 'Not specified'}
- Industry: ${bi.industry || 'Not specified'}
- Business Model: ${bi.businessModel || 'Not specified'}
- Revenue Model: ${bi.revenueModel || 'Not specified'}
- Geographic Footprint: ${bi.geographicFootprint || 'Not specified'}
- Revenue Streams: ${bi.revenueStreams?.join(', ') || 'Not specified'}
- Primary Competitors: ${bi.primaryCompetitors?.join(', ') || 'Not specified'}`);
  }

  // Objectives
  if (formData.objectives) {
    const obj = formData.objectives;
    sections.push(`## Objectives
- Primary Objective: ${obj.primaryObjective || 'Not specified'}
- Secondary Objectives: ${obj.secondaryObjectives?.join(', ') || 'Not specified'}
- Primary Business Goal: ${obj.primaryBusinessGoal || 'Not specified'}
- Time Horizon: ${obj.timeHorizon || 'Not specified'}
- Target CPA: ${obj.targetCpa || 'Not specified'}
- Target ROAS: ${obj.targetRoas || 'Not specified'}`);
  }

  // Audience
  if (formData.audience) {
    const aud = formData.audience;
    sections.push(`## Target Audience
- Primary Audience: ${aud.primaryAudience || 'Not specified'}
- Core Segments: ${aud.coreSegments?.join(', ') || 'Not specified'}
- Demographics: ${aud.demographics || 'Not specified'}
- Geographic Focus: ${aud.geos || 'Not specified'}
- Pain Points: ${aud.painPoints?.join(', ') || 'Not specified'}
- Motivations: ${aud.motivations?.join(', ') || 'Not specified'}`);
  }

  // Website
  if (formData.website) {
    const web = formData.website;
    sections.push(`## Website
- Summary: ${web.websiteSummary || 'Not specified'}
- Critical Issues: ${web.criticalIssues?.join(', ') || 'None identified'}
- Quick Wins: ${web.quickWins?.join(', ') || 'None identified'}`);
  }

  // Media
  if (formData.mediaFoundations) {
    const media = formData.mediaFoundations;
    sections.push(`## Media Foundations
- Summary: ${media.mediaSummary || 'Not specified'}
- Active Channels: ${media.activeChannels?.join(', ') || 'Not specified'}
- Attribution Model: ${media.attributionModel || 'Not specified'}
- Issues: ${media.mediaIssues?.join(', ') || 'None identified'}
- Opportunities: ${media.mediaOpportunities?.join(', ') || 'None identified'}`);
  }

  // Budget
  if (formData.budgetScenarios) {
    const budget = formData.budgetScenarios;
    sections.push(`## Budget
- Total Marketing Budget: ${budget.totalMarketingBudget ? `$${budget.totalMarketingBudget.toLocaleString()}` : 'Not specified'}
- Media Spend Budget: ${budget.mediaSpendBudget ? `$${budget.mediaSpendBudget.toLocaleString()}` : 'Not specified'}
- Budget Period: ${budget.budgetPeriod || 'Not specified'}
- Avg Customer Value: ${budget.avgCustomerValue ? `$${budget.avgCustomerValue.toLocaleString()}` : 'Not specified'}
- Customer LTV: ${budget.customerLTV ? `$${budget.customerLTV.toLocaleString()}` : 'Not specified'}`);
  }

  // Creative
  if (formData.creativeStrategy) {
    const creative = formData.creativeStrategy;
    sections.push(`## Creative Strategy
- Core Messages: ${creative.coreMessages?.join(', ') || 'Not specified'}
- Proof Points: ${creative.proofPoints?.join(', ') || 'Not specified'}
- CTAs: ${creative.callToActions?.join(', ') || 'Not specified'}
- Available Formats: ${creative.availableFormats?.join(', ') || 'Not specified'}`);
  }

  // Measurement
  if (formData.measurement) {
    const meas = formData.measurement;
    sections.push(`## Measurement
- GA4 Property: ${meas.ga4PropertyId || 'Not configured'}
- Conversion Events: ${meas.ga4ConversionEvents?.join(', ') || 'Not specified'}
- Tracking Tools: ${meas.trackingTools?.join(', ') || 'Not specified'}
- Attribution Model: ${meas.attributionModel || 'Not specified'}`);
  }

  return sections.join('\n\n');
}
