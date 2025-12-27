// lib/os/plans/ai/generatePlanDraft.ts
// AI-powered plan section generation

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import type { PlanType, MediaPlanSections, ContentPlanSections } from '@/lib/types/plan';
import type { PlanGenerationInputs } from './buildPlanInputs';
import { formatInputsForPrompt } from './buildPlanInputs';

export interface GeneratePlanDraftResult {
  sections: MediaPlanSections | ContentPlanSections;
  rationale: string;
  warnings: string[];
  inputsUsed: string[];
}

const MEDIA_PLAN_SYSTEM_PROMPT = `You are a senior media strategist inside Hive OS, an AI-powered marketing operating system.

Your task is to generate a structured Media Plan based on the company's context and strategy.

You must output valid JSON matching the MediaPlanSections schema:
{
  "summary": {
    "goalStatement": "string - primary goal from strategy",
    "executiveSummary": "string - brief overview of media approach",
    "assumptions": ["array of key assumptions"]
  },
  "budget": {
    "totalMonthly": number,
    "totalQuarterly": number,
    "currency": "USD",
    "constraintsText": "string - any budget constraints"
  },
  "markets": {
    "geo": ["array of geographic targets"],
    "notes": "string - additional market notes"
  },
  "kpis": {
    "primary": [{"id": "string", "name": "string", "metric": "string", "target": "string", "timeframe": "string"}],
    "secondary": [{"id": "string", "name": "string", "metric": "string", "target": "string"}]
  },
  "measurement": {
    "trackingStack": "string - analytics setup",
    "attributionModel": "string - e.g., Last Click",
    "conversionEvents": ["array of events to track"],
    "reportingCadence": "string - e.g., Weekly"
  },
  "channelMix": [
    {
      "id": "string",
      "channel": "string - e.g., Google Ads",
      "objective": "string",
      "audience": "string",
      "monthlyBudget": number,
      "kpiTargets": {"metric": "target"},
      "rationale": "string - why this channel"
    }
  ],
  "campaigns": [
    {
      "id": "string",
      "name": "string",
      "channel": "string",
      "offer": "string",
      "targeting": "string",
      "creativeNeeds": "string",
      "flighting": {"startDate": "", "endDate": ""},
      "budget": number,
      "kpis": {"metric": "target"}
    }
  ],
  "cadence": {
    "weekly": ["array of weekly activities"],
    "monthly": ["array of monthly activities"]
  },
  "risks": [
    {
      "id": "string",
      "description": "string",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high",
      "mitigation": "string"
    }
  ],
  "approvals": {
    "notes": "",
    "checklist": []
  }
}

Also output:
- "rationale": Brief explanation of why you made these recommendations
- "warnings": Array of any concerns or gaps in the input data
- "inputsUsed": Array of which context/strategy fields influenced the plan

Generate realistic, actionable plans. Use placeholder dates like "TBD" for flighting. Generate unique IDs prefixed with the section type (e.g., "ch-1", "camp-1", "risk-1").`;

const CONTENT_PLAN_SYSTEM_PROMPT = `You are a senior content strategist inside Hive OS, an AI-powered marketing operating system.

Your task is to generate a structured Content Plan based on the company's context and strategy.

You must output valid JSON matching the ContentPlanSections schema:
{
  "summary": {
    "goalStatement": "string - primary goal from strategy",
    "editorialThesis": "string - central editorial angle",
    "voiceGuidance": "string - tone and voice guidelines",
    "constraintsText": "string - any constraints"
  },
  "audiences": {
    "segments": [
      {
        "id": "string",
        "segment": "string - segment name",
        "pains": ["array of pain points"],
        "intents": ["array of search/content intents"],
        "objections": ["array of common objections"]
      }
    ]
  },
  "pillars": [
    {
      "id": "string",
      "pillar": "string - pillar/theme name",
      "why": "string - strategic rationale",
      "targetIntents": ["array of intents this addresses"],
      "proofPoints": ["array of supporting evidence/topics"]
    }
  ],
  "calendar": [
    {
      "id": "string",
      "title": "string - content title",
      "channel": "string - e.g., Blog",
      "format": "string - e.g., Article",
      "pillar": "string - which pillar this belongs to",
      "objective": "string - what this achieves",
      "status": "planned"
    }
  ],
  "seo": {
    "keywordClusters": ["array of keyword themes"],
    "onPageStandards": ["array of standards"],
    "internalLinkingRules": ["array of rules"]
  },
  "distribution": {
    "channels": [
      {
        "id": "string",
        "channel": "string - distribution channel",
        "frequency": "string - e.g., Weekly",
        "audience": "string - who we reach",
        "goals": ["array of goals for this channel"]
      }
    ],
    "partnerships": ["array of potential partnerships"]
  },
  "production": {
    "workflow": "string - content workflow",
    "roles": ["array of roles involved"],
    "tools": ["array of tools used"],
    "cadenceNotes": "string"
  },
  "measurement": {
    "kpis": [{"id": "string", "name": "string", "metric": "string", "target": "string"}],
    "reportingCadence": "string"
  },
  "risks": [
    {
      "id": "string",
      "description": "string",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high",
      "mitigation": "string"
    }
  ],
  "approvals": {
    "notes": "",
    "checklist": []
  }
}

Also output:
- "rationale": Brief explanation of why you made these recommendations
- "warnings": Array of any concerns or gaps in the input data
- "inputsUsed": Array of which context/strategy fields influenced the plan

Generate realistic, actionable plans. Generate unique IDs prefixed with the section type (e.g., "pillar-1", "seg-1", "cal-1").`;

/**
 * Generate plan sections using AI
 */
export async function generatePlanDraft(
  companyId: string,
  inputs: PlanGenerationInputs
): Promise<GeneratePlanDraftResult> {
  const systemPrompt = inputs.planType === 'media'
    ? MEDIA_PLAN_SYSTEM_PROMPT
    : CONTENT_PLAN_SYSTEM_PROMPT;

  const taskPrompt = `Generate a ${inputs.planType === 'media' ? 'Media' : 'Content'} Plan for this company.

${formatInputsForPrompt(inputs)}

${inputs.mode === 'refresh' ? 'This is a REFRESH of an existing plan. Update based on changes while preserving valid sections.' : 'This is a NEW plan. Generate comprehensive sections based on the available context.'}

Output the complete plan as valid JSON with sections, rationale, warnings, and inputsUsed.`;

  const result = await aiForCompany(companyId, {
    type: 'Plan Generation',
    tags: ['Plan', inputs.planType === 'media' ? 'Media' : 'Content', inputs.mode],
    systemPrompt,
    taskPrompt,
    model: 'gpt-4o',
    temperature: 0.4,
    maxTokens: 6000,
    jsonMode: true,
    memoryOptions: {
      limit: 15,
      types: ['Strategy', 'GAP Full', 'GAP IA'],
    },
  });

  // Parse the response
  try {
    const parsed = JSON.parse(result.content);

    // Validate we have sections
    if (!parsed.sections && !parsed.summary) {
      // AI might have returned sections directly without wrapper
      return {
        sections: ensureValidSections(parsed, inputs.planType),
        rationale: parsed.rationale || 'AI-generated plan based on company context and strategy.',
        warnings: parsed.warnings || [],
        inputsUsed: parsed.inputsUsed || [],
      };
    }

    return {
      sections: ensureValidSections(parsed.sections || parsed, inputs.planType),
      rationale: parsed.rationale || 'AI-generated plan based on company context and strategy.',
      warnings: parsed.warnings || [],
      inputsUsed: parsed.inputsUsed || [],
    };
  } catch (parseError) {
    console.error('[generatePlanDraft] Failed to parse AI response:', parseError);
    throw new Error('Failed to parse AI-generated plan. Please try again.');
  }
}

/**
 * Ensure sections have all required fields with defaults
 */
function ensureValidSections(
  sections: unknown,
  planType: PlanType
): MediaPlanSections | ContentPlanSections {
  if (planType === 'media') {
    return ensureMediaPlanSections(sections as Partial<MediaPlanSections>);
  }
  return ensureContentPlanSections(sections as Partial<ContentPlanSections>);
}

function ensureMediaPlanSections(input: Partial<MediaPlanSections>): MediaPlanSections {
  return {
    summary: {
      goalStatement: input.summary?.goalStatement || '',
      executiveSummary: input.summary?.executiveSummary || '',
      assumptions: input.summary?.assumptions || [],
    },
    budget: {
      totalMonthly: input.budget?.totalMonthly || 0,
      totalQuarterly: input.budget?.totalQuarterly || 0,
      currency: input.budget?.currency || 'USD',
      constraintsText: input.budget?.constraintsText || '',
    },
    markets: {
      geo: input.markets?.geo || [],
      notes: input.markets?.notes || '',
    },
    kpis: {
      primary: input.kpis?.primary || [],
      secondary: input.kpis?.secondary || [],
    },
    measurement: {
      trackingStack: input.measurement?.trackingStack || '',
      attributionModel: input.measurement?.attributionModel || '',
      conversionEvents: input.measurement?.conversionEvents || [],
      reportingCadence: input.measurement?.reportingCadence || '',
    },
    channelMix: input.channelMix || [],
    campaigns: input.campaigns || [],
    cadence: {
      weekly: input.cadence?.weekly || [],
      monthly: input.cadence?.monthly || [],
    },
    risks: input.risks || [],
    approvals: {
      notes: input.approvals?.notes || '',
      checklist: input.approvals?.checklist || [],
    },
  };
}

function ensureContentPlanSections(input: Partial<ContentPlanSections>): ContentPlanSections {
  return {
    summary: {
      goalStatement: input.summary?.goalStatement || '',
      editorialThesis: input.summary?.editorialThesis || '',
      voiceGuidance: input.summary?.voiceGuidance || '',
      constraintsText: input.summary?.constraintsText || '',
    },
    audiences: {
      segments: input.audiences?.segments || [],
    },
    pillars: input.pillars || [],
    calendar: input.calendar || [],
    seo: {
      keywordClusters: input.seo?.keywordClusters || [],
      onPageStandards: input.seo?.onPageStandards || [],
      internalLinkingRules: input.seo?.internalLinkingRules || [],
    },
    distribution: {
      channels: input.distribution?.channels || [],
      partnerships: input.distribution?.partnerships || [],
    },
    production: {
      workflowSteps: input.production?.workflowSteps || [],
      roles: input.production?.roles || [],
      sla: input.production?.sla || undefined,
    },
    measurement: {
      kpis: input.measurement?.kpis || [],
      reportingCadence: input.measurement?.reportingCadence || '',
    },
    risks: input.risks || [],
    approvals: {
      notes: input.approvals?.notes || '',
      checklist: input.approvals?.checklist || [],
    },
  };
}
