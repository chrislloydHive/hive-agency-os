// app/api/os/companies/[companyId]/creative/validate/route.ts
// API endpoint for validating Creative Lab output against Brand Lab + Strategic Plan
//
// Compares creative messaging, territories, and concepts against:
// - Brand positioning, pillars, and tone of voice
// - Strategic objectives and focus areas
// - Audience segments and ICPs

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { aiForCompany } from '@/lib/ai-gateway';
import type {
  MessagingArchitecture,
  CreativeTerritory,
  CampaignConcept,
  CreativeGuidelines,
} from '@/lib/contextGraph/domains/creative';

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Types
// ============================================================================

interface ValidateCreativeRequest {
  messaging?: MessagingArchitecture;
  creativeTerritories?: CreativeTerritory[];
  campaignConcepts?: CampaignConcept[];
  guidelines?: CreativeGuidelines;
}

interface ValidationWarning {
  type: 'messaging' | 'territory' | 'concept' | 'guidelines' | 'general';
  severity: 'high' | 'medium' | 'low';
  itemName?: string;
  issue: string;
  suggestion: string;
  conflictsWith?: string;
}

interface ValidationResult {
  isAligned: boolean;
  alignmentScore: number; // 0-100
  warnings: ValidationWarning[];
  summary: string;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const body: ValidateCreativeRequest = await request.json();

    console.log('[CreativeValidate] Validating creative output for company:', companyId);

    // Load context graph to get Brand Lab + Strategy data
    const contextGraph = await loadContextGraph(companyId);

    if (!contextGraph) {
      return NextResponse.json({
        ok: true,
        result: {
          isAligned: true,
          alignmentScore: 50,
          warnings: [{
            type: 'general',
            severity: 'medium',
            issue: 'No Context Graph found for comparison',
            suggestion: 'Run Brand Lab and complete Strategic Setup to enable validation',
          }],
          summary: 'Unable to validate: no brand or strategy context available.',
        } as ValidationResult,
      });
    }

    // Extract brand context
    const brandContext = {
      positioning: contextGraph.brand?.positioning?.value,
      valueProps: contextGraph.brand?.valueProps?.value,
      differentiators: contextGraph.brand?.differentiators?.value,
      toneOfVoice: contextGraph.brand?.toneOfVoice?.value,
      brandPersonality: contextGraph.brand?.brandPersonality?.value,
      messagingPillars: contextGraph.brand?.messagingPillars?.value,
      tagline: contextGraph.brand?.tagline?.value,
    };

    // Extract strategy context
    const strategyContext = {
      primaryObjective: contextGraph.objectives?.primaryObjective?.value,
      kpis: contextGraph.objectives?.kpiLabels?.value,
      icpDescription: contextGraph.identity?.icpDescription?.value,
      coreSegments: contextGraph.audience?.coreSegments?.value,
    };

    // Use AI to validate alignment
    const result = await validateWithAI(
      companyId,
      body,
      brandContext,
      strategyContext
    );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error('[CreativeValidate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// AI Validation
// ============================================================================

interface BrandContext {
  positioning?: string | null;
  valueProps?: string[] | null;
  differentiators?: string[] | null;
  toneOfVoice?: string | null;
  brandPersonality?: string | null;
  messagingPillars?: string[] | null;
  tagline?: string | null;
}

interface StrategyContext {
  primaryObjective?: string | null;
  kpis?: string[] | null;
  icpDescription?: string | null;
  coreSegments?: string[] | null;
}

async function validateWithAI(
  companyId: string,
  creative: ValidateCreativeRequest,
  brand: BrandContext,
  strategy: StrategyContext
): Promise<ValidationResult> {
  const systemPrompt = `You are a brand strategist validating creative output against brand guidelines and strategy.

Your task is to identify any misalignments between creative messaging/concepts and the established brand position and strategy.

Return ONLY valid JSON matching this exact structure:
{
  "isAligned": true/false (overall alignment),
  "alignmentScore": 0-100 (100 = perfect alignment),
  "warnings": [
    {
      "type": "messaging" | "territory" | "concept" | "guidelines" | "general",
      "severity": "high" | "medium" | "low",
      "itemName": "name of specific item if applicable",
      "issue": "Description of the misalignment",
      "suggestion": "How to fix it",
      "conflictsWith": "specific brand element it conflicts with"
    }
  ],
  "summary": "2-3 sentence summary of alignment status"
}

Severity levels:
- high: Direct contradiction of brand positioning or tone
- medium: Partial misalignment or inconsistency
- low: Minor deviation or suggestion for improvement

Be constructive, not overly critical. Only flag genuine issues.`;

  const taskPrompt = `Validate this Creative Lab output against the established brand and strategy.

## Brand Guidelines
${brand.positioning ? `**Positioning:** ${brand.positioning}` : 'No positioning defined'}
${brand.valueProps?.length ? `**Value Props:** ${brand.valueProps.join('; ')}` : ''}
${brand.differentiators?.length ? `**Differentiators:** ${brand.differentiators.join('; ')}` : ''}
${brand.toneOfVoice ? `**Tone of Voice:** ${brand.toneOfVoice}` : ''}
${brand.brandPersonality ? `**Brand Personality:** ${brand.brandPersonality}` : ''}
${brand.messagingPillars?.length ? `**Messaging Pillars:** ${brand.messagingPillars.join('; ')}` : ''}
${brand.tagline ? `**Tagline:** ${brand.tagline}` : ''}

## Strategic Context
${strategy.primaryObjective ? `**Primary Objective:** ${strategy.primaryObjective}` : ''}
${strategy.kpis?.length ? `**KPIs:** ${strategy.kpis.join(', ')}` : ''}
${strategy.icpDescription ? `**ICP:** ${strategy.icpDescription}` : ''}
${strategy.coreSegments?.length ? `**Core Segments:** ${strategy.coreSegments.join(', ')}` : ''}

## Creative Output to Validate

### Messaging Architecture
${creative.messaging ? `
- Core Value Prop: ${creative.messaging.coreValueProp}
- Supporting Points: ${creative.messaging.supportingPoints.join('; ')}
- Proof Points: ${creative.messaging.proofPoints.join('; ')}
- Differentiators: ${creative.messaging.differentiators.join('; ')}
` : 'No messaging provided'}

### Creative Territories
${creative.creativeTerritories?.map(t => `
- **${t.name}**: ${t.theme}
  - Tone: ${t.tone}
  - Headlines: ${t.exampleHeadlines.slice(0, 2).join('; ')}
`).join('\n') || 'No territories provided'}

### Campaign Concepts
${creative.campaignConcepts?.map(c => `
- **${c.name}**: ${c.concept}
  - Insight: ${c.insight}
  - Channels: ${c.channels.join(', ')}
`).join('\n') || 'No concepts provided'}

### Guidelines
${creative.guidelines ? `
- Voice: ${creative.guidelines.voice}
- Tone: ${creative.guidelines.tone}
- Visual: ${creative.guidelines.visual}
` : 'No guidelines provided'}

Validate alignment and return any warnings.`;

  try {
    const { content } = await aiForCompany(companyId, {
      type: 'Strategy',
      tags: ['Creative', 'Validation', 'Brand'],
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true,
    });

    const parsed = JSON.parse(content);

    // Ensure all required fields exist
    return {
      isAligned: parsed.isAligned ?? true,
      alignmentScore: parsed.alignmentScore ?? 75,
      warnings: (parsed.warnings || []).map((w: ValidationWarning) => ({
        type: w.type || 'general',
        severity: w.severity || 'low',
        itemName: w.itemName,
        issue: w.issue || 'Unknown issue',
        suggestion: w.suggestion || 'Review and adjust as needed',
        conflictsWith: w.conflictsWith,
      })),
      summary: parsed.summary || 'Validation complete.',
    };
  } catch (error) {
    console.error('[CreativeValidate] AI validation failed:', error);

    // Return a fallback result
    return {
      isAligned: true,
      alignmentScore: 50,
      warnings: [{
        type: 'general',
        severity: 'low',
        issue: 'Automated validation failed',
        suggestion: 'Please review creative output manually against brand guidelines',
      }],
      summary: 'Automated validation encountered an error. Manual review recommended.',
    };
  }
}
