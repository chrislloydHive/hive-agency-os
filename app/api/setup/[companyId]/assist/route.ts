// app/api/setup/[companyId]/assist/route.ts
// AI Assist API for Setup Mode
//
// POST /api/setup/[companyId]/assist
// Generates AI suggestions for setup form fields based on:
// - Current form data
// - Existing Context Graph data
// - Company website (if available)

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import type { SetupStepId, SetupFormData } from '@/app/c/[companyId]/brain/setup/types';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Types
// ============================================================================

interface AssistRequest {
  currentStep: SetupStepId;
  formData: Partial<SetupFormData>;
  targetFields?: string[];  // Specific fields to suggest, or all if empty
}

interface FieldSuggestion {
  field: string;
  value: unknown;
  confidence: number;
  reasoning: string;
}

interface AssistResponse {
  ok: boolean;
  suggestions: FieldSuggestion[];
  stepLabel: string;
  generatedAt: string;
  error?: string;
}

// ============================================================================
// Field type definitions - helps AI return correct data types
// ============================================================================

const FIELD_TYPES: Record<string, { type: string; hint?: string }> = {
  // Business Identity
  industry: { type: 'string', hint: 'industry category' },
  businessModel: { type: 'string', hint: 'e.g., B2B, B2C, SaaS, Agency' },
  revenueModel: { type: 'string', hint: 'e.g., subscription, project-based' },
  geographicFootprint: { type: 'string', hint: 'e.g., Regional, National, Global' },
  serviceArea: { type: 'string' },
  seasonalityNotes: { type: 'string' },
  peakSeasons: { type: 'string[]' },
  revenueStreams: { type: 'string[]' },
  primaryCompetitors: { type: 'string[]' },

  // Objectives
  primaryObjective: { type: 'string' },
  secondaryObjectives: { type: 'string[]' },
  primaryBusinessGoal: { type: 'string' },
  timeHorizon: { type: 'string', hint: 'e.g., 6 months, 12 months' },
  targetCpa: { type: 'number', hint: 'target cost per acquisition in dollars' },
  targetRoas: { type: 'number', hint: 'target return on ad spend multiplier' },
  revenueGoal: { type: 'number' },
  leadGoal: { type: 'number' },
  kpiLabels: { type: 'string[]' },

  // Audience - IMPORTANT: geos is a STRING, not an array
  coreSegments: { type: 'string[]', hint: 'target customer segments' },
  demographics: { type: 'string', hint: 'demographic description' },
  geos: { type: 'string', hint: 'comma-separated list like "United States, Canada"' },
  primaryMarkets: { type: 'string[]', hint: 'specific cities or regions' },
  behavioralDrivers: { type: 'string[]' },
  demandStates: { type: 'string[]' },
  painPoints: { type: 'string[]' },
  motivations: { type: 'string[]' },

  // Website
  websiteSummary: { type: 'string' },
  conversionBlocks: { type: 'string[]' },
  conversionOpportunities: { type: 'string[]' },
  criticalIssues: { type: 'string[]' },
  quickWins: { type: 'string[]' },

  // Media
  mediaSummary: { type: 'string' },
  activeChannels: { type: 'string[]' },
  attributionModel: { type: 'string' },
  mediaIssues: { type: 'string[]' },
  mediaOpportunities: { type: 'string[]' },

  // Budget
  totalMarketingBudget: { type: 'number' },
  mediaSpendBudget: { type: 'number' },
  budgetPeriod: { type: 'string', hint: 'e.g., monthly, quarterly, annual' },
  avgCustomerValue: { type: 'number' },
  customerLTV: { type: 'number' },

  // Creative
  coreMessages: { type: 'string[]' },
  proofPoints: { type: 'string[]' },
  callToActions: { type: 'string[]' },
  availableFormats: { type: 'string[]' },
  brandGuidelines: { type: 'string' },

  // Measurement
  ga4PropertyId: { type: 'string' },
  ga4ConversionEvents: { type: 'string[]' },
  callTracking: { type: 'string' },
  trackingTools: { type: 'string[]' },
  attributionWindow: { type: 'string' },

  // Summary
  strategySummary: { type: 'string' },
  keyRecommendations: { type: 'string[]' },
  nextSteps: { type: 'string[]' },
};

// ============================================================================
// Step-specific prompts
// ============================================================================

const STEP_PROMPTS: Record<SetupStepId, string> = {
  'business-identity': `Analyze this company and suggest values for their business identity fields.
Focus on:
- Industry classification (be specific, e.g., "B2B SaaS" not just "Technology")
- Business model (e.g., "Subscription-based enterprise software")
- Revenue model (e.g., "Monthly recurring revenue with annual contracts")
- Geographic footprint (where they operate)
- Seasonality patterns
- Revenue streams
- Key competitors (if identifiable)`,

  'objectives': `Based on the business context, suggest marketing objectives.
Consider:
- What's likely the primary marketing objective for this type of business?
- What secondary objectives support growth?
- Reasonable KPI targets based on industry benchmarks
- Appropriate time horizons for planning`,

  'audience': `Suggest audience targeting information based on the business type.
Include:
- Core customer segments
- Demographics that match their offering
- Geographic focus areas
- Behavioral drivers (what motivates their customers)
- Common pain points and motivations`,

  'personas': `Based on the audience data, describe likely buyer personas.
This step is usually handled separately via persona generation.`,

  'website': `Analyze website conversion potential.
Consider:
- Overall website purpose and effectiveness
- Common conversion blockers for this type of site
- Quick wins that could improve conversion
- Critical issues that need addressing`,

  'media-foundations': `Suggest media channel strategy based on the business type.
Include:
- Which channels are typically effective for this industry
- Attribution model recommendations
- Common media challenges and opportunities`,

  'budget-scenarios': `Suggest budget parameters based on business context.
Consider industry-standard marketing spend ratios and typical customer values.`,

  'creative-strategy': `Suggest messaging and creative strategy.
Include:
- Core messages that would resonate with the target audience
- Proof points to build credibility
- Call-to-action recommendations
- Creative format opportunities`,

  'measurement': `Suggest measurement and tracking setup.
Include:
- Key conversion events to track
- Attribution model recommendations
- Tracking tools that would be valuable`,

  'summary': `Generate a strategic summary.
This step synthesizes all previous information.`,
};

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AssistResponse>> {
  try {
    const { companyId } = await params;
    const body: AssistRequest = await request.json();
    const { currentStep, formData, targetFields } = body;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, suggestions: [], stepLabel: '', generatedAt: new Date().toISOString(), error: 'Company ID is required' },
        { status: 400 }
      );
    }

    if (!currentStep) {
      return NextResponse.json(
        { ok: false, suggestions: [], stepLabel: '', generatedAt: new Date().toISOString(), error: 'Current step is required' },
        { status: 400 }
      );
    }

    console.log(`[Setup Assist] Generating suggestions for ${companyId}, step: ${currentStep}`);

    // Load context for better suggestions
    const [graph, company] = await Promise.all([
      loadContextGraph(companyId),
      getCompanyById(companyId),
    ]);

    // Build context for AI
    const contextParts: string[] = [];

    if (company) {
      contextParts.push(`Company Name: ${company.name}`);
      if (company.website) contextParts.push(`Website: ${company.website}`);
    }

    // Add existing form data as context
    if (formData.businessIdentity?.businessName) {
      contextParts.push(`Business: ${formData.businessIdentity.businessName}`);
    }
    if (formData.businessIdentity?.industry) {
      contextParts.push(`Industry: ${formData.businessIdentity.industry}`);
    }
    if (formData.businessIdentity?.businessModel) {
      contextParts.push(`Business Model: ${formData.businessIdentity.businessModel}`);
    }
    if (formData.objectives?.primaryObjective) {
      contextParts.push(`Primary Objective: ${formData.objectives.primaryObjective}`);
    }
    if (formData.audience?.coreSegments?.length) {
      contextParts.push(`Target Segments: ${formData.audience.coreSegments.join(', ')}`);
    }

    // Add context graph data if available
    if (graph) {
      if (graph.identity.industry?.value) {
        contextParts.push(`Industry: ${graph.identity.industry.value}`);
      }
      if (graph.identity.competitiveLandscape?.value) {
        contextParts.push(`Competitive Landscape: ${graph.identity.competitiveLandscape.value}`);
      }
      if (graph.identity.marketPosition?.value) {
        contextParts.push(`Market Position: ${graph.identity.marketPosition.value}`);
      }
    }

    // Get fields for current step
    const stepFields = getStepFields(currentStep, targetFields);

    // Generate suggestions
    const suggestions = await generateSetupSuggestions(
      currentStep,
      stepFields,
      contextParts.join('\n'),
      formData
    );

    console.log(`[Setup Assist] Generated ${suggestions.length} suggestions for ${currentStep}`);

    return NextResponse.json({
      ok: true,
      suggestions,
      stepLabel: currentStep,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Setup Assist] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        suggestions: [],
        stepLabel: '',
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStepFields(step: SetupStepId, targetFields?: string[]): string[] {
  const allFields: Record<SetupStepId, string[]> = {
    'business-identity': [
      'industry',
      'businessModel',
      'revenueModel',
      'geographicFootprint',
      'serviceArea',
      'seasonalityNotes',
      'peakSeasons',
      'revenueStreams',
      'primaryCompetitors',
    ],
    'objectives': [
      'primaryObjective',
      'secondaryObjectives',
      'primaryBusinessGoal',
      'timeHorizon',
      'targetCpa',
      'targetRoas',
      'revenueGoal',
      'leadGoal',
      'kpiLabels',
    ],
    'audience': [
      'coreSegments',
      'demographics',
      'geos',
      'primaryMarkets',
      'behavioralDrivers',
      'demandStates',
      'painPoints',
      'motivations',
    ],
    'personas': ['personaCount'],
    'website': [
      'websiteSummary',
      'conversionBlocks',
      'conversionOpportunities',
      'criticalIssues',
      'quickWins',
    ],
    'media-foundations': [
      'mediaSummary',
      'activeChannels',
      'attributionModel',
      'mediaIssues',
      'mediaOpportunities',
    ],
    'budget-scenarios': [
      'totalMarketingBudget',
      'mediaSpendBudget',
      'budgetPeriod',
      'avgCustomerValue',
      'customerLTV',
    ],
    'creative-strategy': [
      'coreMessages',
      'proofPoints',
      'callToActions',
      'availableFormats',
      'brandGuidelines',
    ],
    'measurement': [
      'ga4ConversionEvents',
      'callTracking',
      'trackingTools',
      'attributionModel',
      'attributionWindow',
    ],
    'summary': [
      'strategySummary',
      'keyRecommendations',
      'nextSteps',
    ],
  };

  const fields = allFields[step] || [];

  if (targetFields && targetFields.length > 0) {
    return fields.filter(f => targetFields.includes(f));
  }

  return fields;
}

async function generateSetupSuggestions(
  step: SetupStepId,
  fields: string[],
  context: string,
  currentData: Partial<SetupFormData>
): Promise<FieldSuggestion[]> {
  if (fields.length === 0) {
    return [];
  }

  const client = new Anthropic();
  const stepPrompt = STEP_PROMPTS[step];

  // Define field types to guide AI suggestions
  const fieldTypesWithAnnotations = fields.map(f => {
    const fieldInfo = FIELD_TYPES[f];
    if (fieldInfo) {
      return `- ${f} (${fieldInfo.type})${fieldInfo.hint ? `: ${fieldInfo.hint}` : ''}`;
    }
    return `- ${f}`;
  }).join('\n');

  const prompt = `You are an expert marketing strategist helping set up a company's marketing strategy.

## Company Context:
${context || 'No additional context available.'}

## Current Step: ${step}
${stepPrompt}

## Fields to Suggest Values For:
${fieldTypesWithAnnotations}

Based on the context provided, generate suggestions for each field.
Be practical and realistic - only suggest values you can reasonably infer.

IMPORTANT TYPE RULES:
- For fields marked (string): Return a single string value, NOT an array
- For fields marked (string[]): Return an array of 2-5 string items
- For fields marked (number): Return a number, use industry benchmarks if available

Respond with a JSON array:
[
  {
    "field": "fieldName",
    "value": "suggested value or array",
    "confidence": 0.8,
    "reasoning": "Brief explanation"
  }
]

Guidelines:
- Confidence 0.9+: Clear from context
- Confidence 0.7-0.9: Reasonable inference
- Confidence 0.5-0.7: Educated guess
- Skip fields you can't reasonably infer

Respond ONLY with the JSON array, no markdown formatting.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    // Parse JSON response
    let parsed: FieldSuggestion[];
    try {
      parsed = JSON.parse(textContent.text.trim());
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = textContent.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        console.error('[Setup Assist] Failed to parse AI response:', textContent.text.slice(0, 200));
        return [];
      }
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    // Validate and clean suggestions
    return parsed
      .filter(s => s.field && s.value !== null && s.value !== undefined)
      .map(s => ({
        field: s.field,
        value: s.value,
        confidence: Math.max(0, Math.min(1, s.confidence ?? 0.7)),
        reasoning: s.reasoning ?? 'AI-generated suggestion',
      }));
  } catch (error) {
    console.error('[Setup Assist] AI generation error:', error);
    return [];
  }
}
