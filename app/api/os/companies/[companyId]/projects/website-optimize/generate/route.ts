// app/api/os/companies/[companyId]/projects/website-optimize/generate/route.ts
// Website Optimization Recommendations Generator
//
// Generates website optimization recommendations using existing context graph data.
// This flow skips Labs/GAP and uses whatever context is already available.
//
// Critical domains: identity, website
// Recommended domains: brand, seo, audience, content

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { checkFlowReadinessFromGraph, type FlowReadiness } from '@/lib/os/flow/readiness';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { logFlowProceededMissingDomains } from '@/lib/observability/flowEvents';

export const maxDuration = 120;

// ============================================================================
// Types
// ============================================================================

export interface WebsiteOptimizationRecommendation {
  category: 'quick_win' | 'conversion' | 'seo' | 'ux' | 'content' | 'technical';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface WebsiteOptimizationOutput {
  executiveSummary: string;
  currentStateAnalysis: string;
  recommendations: WebsiteOptimizationRecommendation[];
  priorityMatrix: {
    quickWins: string[];
    majorProjects: string[];
    fillIns: string[];
    thankless: string[];
  };
  nextSteps: string[];
  assumptions: string[];
  missingContext: string[];
}

export interface GenerateWebsiteOptimizationResponse {
  output: WebsiteOptimizationOutput;
  readiness: FlowReadiness;
  generatedAt: string;
  proceededWithMissingDomains: boolean;
  missingDomainsAtGeneration: string[];
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a senior digital strategist specializing in website optimization.

Your job is to analyze existing company context and provide actionable website optimization recommendations.

================================
YOUR OUTPUTS
================================

1. EXECUTIVE SUMMARY (2-3 sentences)
   - High-level assessment of the website's current state
   - Key opportunity or risk

2. CURRENT STATE ANALYSIS (3-5 sentences)
   - What's working well
   - What needs improvement
   - Key gaps between current state and business objectives

3. RECOMMENDATIONS (5-10 items)
   Each recommendation must include:
   - Category: quick_win, conversion, seo, ux, content, or technical
   - Title: Short, actionable title
   - Description: 2-3 sentences explaining the recommendation
   - Impact: high, medium, or low
   - Effort: high, medium, or low
   - Rationale: Why this matters for this specific business

4. PRIORITY MATRIX
   Organize recommendations by impact/effort:
   - Quick Wins: High impact, low effort
   - Major Projects: High impact, high effort
   - Fill-Ins: Low impact, low effort
   - Thankless: Low impact, high effort (avoid these)

5. NEXT STEPS (3-5 items)
   Immediate actions to take

6. ASSUMPTIONS
   What you're assuming based on available context

7. MISSING CONTEXT
   What information would improve these recommendations

================================
OUTPUT FORMAT
================================

Return a JSON object matching this structure exactly:

{
  "executiveSummary": "2-3 sentence summary",
  "currentStateAnalysis": "3-5 sentence analysis",
  "recommendations": [
    {
      "category": "quick_win",
      "title": "Recommendation title",
      "description": "2-3 sentence description",
      "impact": "high",
      "effort": "low",
      "rationale": "Why this matters"
    }
  ],
  "priorityMatrix": {
    "quickWins": ["Title 1", "Title 2"],
    "majorProjects": ["Title 3"],
    "fillIns": ["Title 4"],
    "thankless": []
  },
  "nextSteps": ["Step 1", "Step 2"],
  "assumptions": ["Assumption 1"],
  "missingContext": ["What's missing 1"]
}

================================
RULES
================================

1. Be SPECIFIC - reference actual company context
2. Be REALISTIC - consider constraints and current state
3. Focus on ACTIONABLE recommendations - not vague advice
4. Prioritize based on business objectives when available
5. Acknowledge missing information honestly
6. DO NOT recommend major website rebuilds unless absolutely necessary
7. Favor incremental improvements over big-bang changes`;

// ============================================================================
// API Handler
// ============================================================================

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const acknowledgedMissingDomains: boolean = body.acknowledgedMissingDomains ?? false;
    const proceedReason: string | undefined = body.proceedReason;

    // Load context graph
    const contextGraph = await loadContextGraph(companyId);

    if (!contextGraph) {
      return NextResponse.json(
        { error: 'No context graph found. Run diagnostics first.' },
        { status: 400 }
      );
    }

    // Check flow readiness
    const readiness = checkFlowReadinessFromGraph(contextGraph, 'website_optimization', companyId);

    // If not ready and not acknowledged, return the readiness info
    if (!readiness.isReady && !acknowledgedMissingDomains) {
      return NextResponse.json(
        {
          error: 'Missing critical context. Acknowledge to proceed.',
          readiness,
          requiresAcknowledgment: true,
        },
        { status: 422 }
      );
    }

    // Log if proceeding with missing domains
    const missingDomainsAtGeneration = readiness.missingCritical.map(r => r.domain);
    if (missingDomainsAtGeneration.length > 0) {
      logFlowProceededMissingDomains(
        companyId,
        'website_optimization',
        missingDomainsAtGeneration,
        proceedReason
      );
    }

    // Build prompt
    const prompt = buildPrompt(companyId, contextGraph, readiness);

    // Call Anthropic
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        { role: 'user', content: prompt },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON from response
    const parsed = parseAIResponse(textContent.text);

    // Build the output with validation
    const output: WebsiteOptimizationOutput = {
      executiveSummary: (parsed.executiveSummary as string) || 'Website optimization analysis complete.',
      currentStateAnalysis: (parsed.currentStateAnalysis as string) || '',
      recommendations: validateRecommendations(parsed.recommendations),
      priorityMatrix: validatePriorityMatrix(parsed.priorityMatrix),
      nextSteps: Array.isArray(parsed.nextSteps) ? (parsed.nextSteps as string[]) : [],
      assumptions: Array.isArray(parsed.assumptions) ? (parsed.assumptions as string[]) : [],
      missingContext: Array.isArray(parsed.missingContext) ? (parsed.missingContext as string[]) : [],
    };

    const result: GenerateWebsiteOptimizationResponse = {
      output,
      readiness,
      generatedAt: new Date().toISOString(),
      proceededWithMissingDomains: missingDomainsAtGeneration.length > 0,
      missingDomainsAtGeneration,
    };

    console.log('[website-optimize/generate] Generated recommendations for', companyId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[website-optimize/generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildPrompt(
  companyId: string,
  contextGraph: CompanyContextGraph,
  readiness: FlowReadiness
): string {
  const parts: string[] = [];

  // Company info
  parts.push(`
================================
COMPANY INFORMATION
================================
Company ID: ${companyId}
Company Name: ${contextGraph.companyName || 'Unknown'}
`);

  // Identity
  parts.push(`
================================
BUSINESS IDENTITY
================================
- Business Name: ${contextGraph.identity?.businessName?.value || 'Not specified'}
- Business Model: ${contextGraph.identity?.businessModel?.value || 'Not specified'}
- Industry: ${contextGraph.identity?.industry?.value || 'Not specified'}
- Value Proposition: ${contextGraph.productOffer?.valueProposition?.value || 'Not specified'}
`);

  // Website data
  if (contextGraph.website) {
    parts.push(`
================================
WEBSITE ASSESSMENT
================================
- Website Score: ${contextGraph.website.websiteScore?.value || 'Not assessed'}
- Executive Summary: ${contextGraph.website.executiveSummary?.value || 'No assessment available'}

Critical Issues:
${(contextGraph.website.criticalIssues?.value || []).map((i: string) => `- ${i}`).join('\n') || '- None identified'}

Quick Wins:
${(contextGraph.website.quickWins?.value || []).map((i: string) => `- ${i}`).join('\n') || '- None identified'}

Conversion Blocks:
${(contextGraph.website.conversionBlocks?.value || []).map((i: string) => `- ${i}`).join('\n') || '- None identified'}
`);
  } else {
    parts.push(`
================================
WEBSITE ASSESSMENT
================================
No website assessment data available. Provide general optimization recommendations.
`);
  }

  // Brand
  if (contextGraph.brand) {
    parts.push(`
================================
BRAND & POSITIONING
================================
- Positioning: ${contextGraph.brand.positioning?.value || 'Not specified'}
- Tone of Voice: ${contextGraph.brand.toneOfVoice?.value || 'Not specified'}
- Differentiators: ${(contextGraph.brand.differentiators?.value || []).join(', ') || 'Not specified'}
`);
  }

  // Audience
  if (contextGraph.audience) {
    parts.push(`
================================
TARGET AUDIENCE
================================
- Primary Audience: ${contextGraph.audience.primaryAudience?.value || 'Not specified'}
- ICP Description: ${contextGraph.audience.icpDescription?.value || 'Not specified'}
- Pain Points: ${(contextGraph.audience.painPoints?.value || []).join(', ') || 'Not specified'}
`);
  }

  // SEO
  if (contextGraph.seo) {
    const techIssues = contextGraph.seo.technicalIssues?.value || [];
    parts.push(`
================================
SEO DATA
================================
- Domain Authority: ${contextGraph.seo.domainAuthority?.value || 'Unknown'}
- Organic Traffic: ${contextGraph.seo.organicTraffic?.value || 'Unknown'}
- Top Keywords: ${(contextGraph.seo.topKeywords?.value || []).slice(0, 10).join(', ') || 'Not specified'}

SEO Issues:
${techIssues.length > 0 ? techIssues.map(i => `- ${i.title} (${i.severity})`).join('\n') : '- None identified'}
`);
  }

  // Objectives
  if (contextGraph.objectives) {
    parts.push(`
================================
BUSINESS OBJECTIVES
================================
- Primary Objective: ${contextGraph.objectives.primaryObjective?.value || 'Not specified'}
- Secondary Objectives: ${(contextGraph.objectives.secondaryObjectives?.value || []).join(', ') || 'Not specified'}
`);
  }

  // Constraints
  if (contextGraph.operationalConstraints) {
    parts.push(`
================================
CONSTRAINTS
================================
- Budget: ${formatBudget(contextGraph.operationalConstraints.minBudget?.value ?? undefined, contextGraph.operationalConstraints.maxBudget?.value ?? undefined)}
- Timeline: ${contextGraph.operationalConstraints.launchDeadlines?.value?.[0] || 'Not specified'}
`);
  }

  // Missing context warning
  if (readiness.missingCritical.length > 0 || readiness.missingRecommended.length > 0) {
    parts.push(`
================================
CONTEXT GAPS
================================
Missing Critical: ${readiness.missingCritical.map(r => r.label).join(', ') || 'None'}
Missing Recommended: ${readiness.missingRecommended.map(r => r.label).join(', ') || 'None'}

NOTE: Some context is missing. Acknowledge this in your assumptions and missing context sections.
`);
  }

  // Instructions
  parts.push(`
================================
INSTRUCTIONS
================================
Generate website optimization recommendations based on the above context.
Focus on actionable, specific recommendations that align with the business objectives.
Prioritize quick wins and high-impact improvements.

Return your response as a valid JSON object.
`);

  return parts.join('\n');
}

function formatBudget(min?: number, max?: number): string {
  if (!min && !max) return 'Not specified';
  if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  if (min) return `Min $${min.toLocaleString()}`;
  if (max) return `Max $${max.toLocaleString()}`;
  return 'Not specified';
}

function parseAIResponse(text: string): Record<string, unknown> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[website-optimize/generate] No JSON found in response:', text.slice(0, 500));
    throw new Error('AI response did not contain valid JSON');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[website-optimize/generate] Failed to parse JSON:', e);
    throw new Error('Failed to parse AI response as JSON');
  }
}

function validateRecommendations(recommendations: unknown): WebsiteOptimizationRecommendation[] {
  if (!Array.isArray(recommendations)) {
    return [
      {
        category: 'quick_win',
        title: 'Review and optimize page load speed',
        description: 'Fast pages improve user experience and SEO.',
        impact: 'high',
        effort: 'medium',
        rationale: 'Page speed affects both user experience and search rankings.',
      },
    ];
  }

  return recommendations.map((r: Record<string, unknown>) => ({
    category: (['quick_win', 'conversion', 'seo', 'ux', 'content', 'technical'].includes(r.category as string)
      ? r.category
      : 'quick_win') as WebsiteOptimizationRecommendation['category'],
    title: (r.title as string) || 'Recommendation',
    description: (r.description as string) || '',
    impact: (['high', 'medium', 'low'].includes(r.impact as string) ? r.impact : 'medium') as 'high' | 'medium' | 'low',
    effort: (['high', 'medium', 'low'].includes(r.effort as string) ? r.effort : 'medium') as 'high' | 'medium' | 'low',
    rationale: (r.rationale as string) || '',
  }));
}

function validatePriorityMatrix(matrix: unknown): WebsiteOptimizationOutput['priorityMatrix'] {
  const defaultMatrix = {
    quickWins: [],
    majorProjects: [],
    fillIns: [],
    thankless: [],
  };

  if (!matrix || typeof matrix !== 'object') {
    return defaultMatrix;
  }

  const m = matrix as Record<string, unknown>;
  return {
    quickWins: Array.isArray(m.quickWins) ? (m.quickWins as string[]) : [],
    majorProjects: Array.isArray(m.majorProjects) ? (m.majorProjects as string[]) : [],
    fillIns: Array.isArray(m.fillIns) ? (m.fillIns as string[]) : [],
    thankless: Array.isArray(m.thankless) ? (m.thankless as string[]) : [],
  };
}
