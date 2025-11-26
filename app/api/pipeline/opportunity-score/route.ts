// app/api/pipeline/opportunity-score/route.ts
// AI Opportunity Scoring API

import { NextRequest, NextResponse } from 'next/server';
import { getOpportunityById, updateOpportunityScore } from '@/lib/airtable/opportunities';
import { getCompanyById } from '@/lib/airtable/companies';
import { getOpenAI } from '@/lib/openai';

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a senior revenue strategist evaluating sales opportunities.

You will assign a 0-100 "Opportunity Score" based on:
- Deal value (higher = better)
- Stage progression (later stages = better)
- Probability (if present)
- ICP fit score (if available)
- Lead score (if available)
- Company size and type
- Industry fit
- Close date proximity (sooner = more urgent)

Higher scores indicate:
- Higher likelihood this deal will close
- Worth prioritizing in the next 90 days
- Good fit for the ICP

Lower scores indicate:
- Early stage or stalled deals
- Low value or poor fit
- Needs more qualification

Return ONLY valid JSON with these fields:
{
  "score": number,           // 0-100, integer
  "explanation": string      // 2-4 sentences explaining the score
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId } = body;

    if (!opportunityId) {
      return NextResponse.json(
        { error: 'Missing opportunityId' },
        { status: 400 }
      );
    }

    // Fetch opportunity
    const opp = await getOpportunityById(opportunityId);
    if (!opp) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Fetch associated company if available
    const company = opp.companyId ? await getCompanyById(opp.companyId) : null;

    // Build context for AI
    const opportunityContext = {
      name: opp.deliverableName || opp.companyName,
      companyName: opp.companyName,
      stage: opp.stage,
      value: opp.value,
      probability: opp.probability,
      closeDate: opp.closeDate,
      createdAt: opp.createdAt,
      owner: opp.owner,
      industry: opp.industry,
      companyType: opp.companyType,
      sizeBand: opp.sizeBand,
      icpFitScore: opp.icpFitScore,
      leadScore: opp.leadScore,
    };

    const companyContext = company
      ? {
          name: company.name,
          industry: company.industry,
          companyType: company.companyType,
          stage: company.stage,
          sizeBand: company.sizeBand,
          tier: company.tier,
        }
      : null;

    const userPrompt = `Score this opportunity:

Opportunity:
${JSON.stringify(opportunityContext, null, 2)}

${companyContext ? `Company:\n${JSON.stringify(companyContext, null, 2)}` : 'No linked company data available.'}

Provide a score from 0-100 and a brief explanation.`;

    // Call OpenAI
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse response
    let parsed: { score: number; explanation: string };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[OpportunityScore] Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate and clamp score
    const score = Math.max(0, Math.min(100, Math.round(parsed.score || 50)));
    const explanation = parsed.explanation || 'Unable to generate explanation.';

    // Update Airtable
    await updateOpportunityScore(opportunityId, score, explanation);

    console.log(`[OpportunityScore] Scored opportunity ${opportunityId}: ${score}`);

    return NextResponse.json({
      score,
      explanation,
      opportunityId,
    });
  } catch (error) {
    console.error('[OpportunityScore] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
