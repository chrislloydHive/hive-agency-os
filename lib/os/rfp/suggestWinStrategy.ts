// lib/os/rfp/suggestWinStrategy.ts
// AI-powered RFP win strategy suggestion
// Analyzes parsed requirements and available resources to suggest optimal strategy

import { openai } from '@/lib/openai';
import { safeAiCall, parseJsonFromAi } from '@/lib/ai/safeCall';
import type { ParsedRfpRequirements } from '@/lib/types/rfp';
import type { CaseStudy, Reference } from '@/lib/types/firmBrain';
import {
  type RfpWinStrategy,
  type RfpWinTheme,
  type RfpEvaluationCriterion,
  type RfpProofItem,
  type RfpLandmine,
  createEmptyWinStrategy,
} from '@/lib/types/rfpWinStrategy';

// ============================================================================
// Types
// ============================================================================

export interface SuggestWinStrategyInput {
  /** Parsed RFP requirements (from parseRfpRequirements) */
  parsedRequirements: ParsedRfpRequirements | null;
  /** Available case studies from Firm Brain */
  caseStudies: CaseStudy[];
  /** Available references from Firm Brain */
  references: Reference[];
  /** Competitors mentioned in RFP or known */
  competitors?: string[];
  /** Raw RFP text (optional, for deeper analysis) */
  rfpText?: string;
  /** Scope summary if available */
  scopeSummary?: string;
}

export interface SuggestWinStrategyResult {
  success: boolean;
  strategy: RfpWinStrategy;
  error?: string;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an expert RFP strategist helping agencies win proposals. Your task is to create a win strategy that maximizes the chances of winning.

CRITICAL RULES:
1. ONLY use information explicitly available in the inputs
2. Be conservative with assumptions - flag uncertainties as landmines
3. Match proof items ONLY to case studies and references that exist in the provided lists
4. Provide actionable, specific guidance - not generic advice
5. Consider the evaluation criteria weights when prioritizing themes

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "evaluationCriteria": [
    {
      "label": "Criterion name from RFP",
      "weight": 0.0-1.0 if specified or estimated,
      "guidance": "Specific guidance on addressing this criterion",
      "primarySections": ["approach", "team", etc.],
      "alignmentScore": 1-5 (our estimated strength),
      "alignmentRationale": "Why we score this way"
    }
  ],
  "winThemes": [
    {
      "id": "theme_1",
      "label": "Short theme name (3-5 words)",
      "description": "How this theme differentiates us and addresses evaluator priorities",
      "applicableSections": ["approach", "work_samples", etc.]
    }
  ],
  "proofPlan": [
    {
      "type": "case_study" or "reference",
      "id": "The exact ID from the provided list",
      "usageGuidance": "Specific way to use this proof point",
      "targetSections": ["work_samples", "approach"],
      "priority": 1-5 (5 = must include)
    }
  ],
  "competitiveAssumptions": [
    "Assumption about competitor weakness or our advantage"
  ],
  "landmines": [
    {
      "id": "landmine_1",
      "description": "Risk or sensitive area",
      "severity": "low" | "medium" | "high" | "critical",
      "mitigation": "How to address this risk",
      "affectedSections": ["pricing", "team"]
    }
  ]
}

SECTION KEYS:
- agency_overview: Company background, capabilities
- approach: Methodology, how we'll do the work
- team: Proposed team members
- work_samples: Case studies, portfolio
- plan_timeline: Project plan, milestones
- pricing: Costs, investment
- references: Client testimonials

WIN THEME EXAMPLES:
- "Speed to Market" - We deliver faster than competitors
- "Deep Industry Expertise" - We know this industry inside out
- "Proven Results" - Track record of measurable outcomes
- "Dedicated Partnership" - We act as an extension of your team

Return ONLY valid JSON. No markdown, no explanations.`;

// ============================================================================
// Main Suggester
// ============================================================================

export async function suggestWinStrategy(
  input: SuggestWinStrategyInput
): Promise<SuggestWinStrategyResult> {
  // If no requirements and no RFP text, return empty strategy
  if (!input.parsedRequirements && !input.rfpText) {
    return {
      success: false,
      strategy: createEmptyWinStrategy(),
      error: 'No RFP requirements or text available for strategy suggestion',
    };
  }

  // Build context for the AI
  const contextParts: string[] = [];

  // Add parsed requirements
  if (input.parsedRequirements) {
    contextParts.push('## PARSED RFP REQUIREMENTS');
    if (input.parsedRequirements.deadline) {
      contextParts.push(`Deadline: ${input.parsedRequirements.deadline}`);
    }
    if (input.parsedRequirements.evaluationCriteria.length > 0) {
      contextParts.push('### Evaluation Criteria:');
      input.parsedRequirements.evaluationCriteria.forEach((c, i) => {
        contextParts.push(`${i + 1}. ${c}`);
      });
    }
    if (input.parsedRequirements.complianceChecklist.length > 0) {
      contextParts.push('### Compliance Requirements:');
      input.parsedRequirements.complianceChecklist.forEach((c, i) => {
        contextParts.push(`${i + 1}. ${c}`);
      });
    }
    if (input.parsedRequirements.mustAnswerQuestions.length > 0) {
      contextParts.push('### Questions to Address:');
      input.parsedRequirements.mustAnswerQuestions.forEach((q, i) => {
        contextParts.push(`${i + 1}. ${q}`);
      });
    }
    if (input.parsedRequirements.requiredResponseSections.length > 0) {
      contextParts.push('### Required Sections:');
      input.parsedRequirements.requiredResponseSections.forEach((s) => {
        contextParts.push(`- ${s.title}${s.description ? `: ${s.description}` : ''}`);
      });
    }
  }

  // Add scope if available
  if (input.scopeSummary) {
    contextParts.push('## PROJECT SCOPE');
    contextParts.push(input.scopeSummary);
  }

  // Add available case studies
  if (input.caseStudies.length > 0) {
    contextParts.push('## AVAILABLE CASE STUDIES');
    input.caseStudies.forEach((cs) => {
      contextParts.push(`- ID: ${cs.id}`);
      contextParts.push(`  Title: ${cs.title}`);
      contextParts.push(`  Client: ${cs.client || 'N/A'}`);
      contextParts.push(`  Industry: ${cs.industry || 'N/A'}`);
      contextParts.push(`  Outcome: ${cs.outcome || 'N/A'}`);
      if (cs.metrics) {
        contextParts.push(`  Metrics: ${cs.metrics}`);
      }
    });
  }

  // Add available references
  if (input.references.length > 0) {
    contextParts.push('## AVAILABLE REFERENCES');
    input.references.forEach((ref) => {
      contextParts.push(`- ID: ${ref.id}`);
      contextParts.push(`  Client: ${ref.client}`);
      contextParts.push(`  Contact: ${ref.contactName || 'N/A'}`);
      if (ref.notes) {
        contextParts.push(`  Notes: "${ref.notes.slice(0, 200)}${ref.notes.length > 200 ? '...' : ''}"`);
      }
    });
  }

  // Add competitors
  if (input.competitors && input.competitors.length > 0) {
    contextParts.push('## KNOWN COMPETITORS');
    input.competitors.forEach((c) => {
      contextParts.push(`- ${c}`);
    });
  }

  // Add raw RFP text if available and requirements are sparse
  if (input.rfpText && (!input.parsedRequirements || input.parsedRequirements.evaluationCriteria.length < 3)) {
    const truncatedText = input.rfpText.length > 5000
      ? input.rfpText.slice(0, 5000) + '\n[Text truncated...]'
      : input.rfpText;
    contextParts.push('## RAW RFP TEXT (for additional context)');
    contextParts.push(truncatedText);
  }

  const userPrompt = contextParts.join('\n\n');

  // Call AI
  const result = await safeAiCall(
    async () => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Slightly higher for creativity in themes
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      return response.choices[0]?.message?.content ?? '';
    },
    {
      retries: 2,
      retryDelay: 1000,
      context: 'suggest-win-strategy',
    }
  );

  if (!result.ok || !result.value) {
    return {
      success: false,
      strategy: createEmptyWinStrategy(),
      error: result.error ?? 'Failed to generate win strategy',
    };
  }

  // Parse response
  const parseResult = parseJsonFromAi(result.value, createEmptyWinStrategy());
  if (!parseResult.ok) {
    return {
      success: false,
      strategy: createEmptyWinStrategy(),
      error: parseResult.error ?? 'Failed to parse AI response',
    };
  }

  // Validate and sanitize the response
  const strategy = validateAndSanitizeStrategy(parseResult.value, input);

  return {
    success: true,
    strategy: {
      ...strategy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Validation & Sanitization
// ============================================================================

function validateAndSanitizeStrategy(
  raw: unknown,
  input: SuggestWinStrategyInput
): RfpWinStrategy {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  // Validate evaluation criteria
  const evaluationCriteria: RfpEvaluationCriterion[] = [];
  if (Array.isArray(obj.evaluationCriteria)) {
    for (const c of obj.evaluationCriteria) {
      if (typeof c === 'object' && c !== null) {
        const criterion = c as Record<string, unknown>;
        if (typeof criterion.label === 'string' && criterion.label.trim()) {
          evaluationCriteria.push({
            label: criterion.label.trim(),
            weight: typeof criterion.weight === 'number' && criterion.weight >= 0 && criterion.weight <= 1
              ? criterion.weight : undefined,
            guidance: typeof criterion.guidance === 'string' ? criterion.guidance : undefined,
            primarySections: Array.isArray(criterion.primarySections)
              ? criterion.primarySections.filter((s): s is string => typeof s === 'string')
              : undefined,
            alignmentScore: typeof criterion.alignmentScore === 'number' && criterion.alignmentScore >= 1 && criterion.alignmentScore <= 5
              ? criterion.alignmentScore : undefined,
            alignmentRationale: typeof criterion.alignmentRationale === 'string' ? criterion.alignmentRationale : undefined,
          });
        }
      }
    }
  }

  // Validate win themes
  const winThemes: RfpWinTheme[] = [];
  if (Array.isArray(obj.winThemes)) {
    for (const t of obj.winThemes) {
      if (typeof t === 'object' && t !== null) {
        const theme = t as Record<string, unknown>;
        if (typeof theme.label === 'string' && theme.label.trim()) {
          winThemes.push({
            id: typeof theme.id === 'string' ? theme.id : `theme_${winThemes.length + 1}`,
            label: theme.label.trim(),
            description: typeof theme.description === 'string' ? theme.description : '',
            applicableSections: Array.isArray(theme.applicableSections)
              ? theme.applicableSections.filter((s): s is string => typeof s === 'string')
              : undefined,
          });
        }
      }
    }
  }

  // Validate proof plan - only include items with valid IDs
  const validCaseStudyIds = new Set(input.caseStudies.map(cs => cs.id));
  const validReferenceIds = new Set(input.references.map(ref => ref.id));

  const proofPlan: RfpProofItem[] = [];
  if (Array.isArray(obj.proofPlan)) {
    for (const p of obj.proofPlan) {
      if (typeof p === 'object' && p !== null) {
        const proof = p as Record<string, unknown>;
        const type = proof.type;
        const id = proof.id;

        if (typeof type === 'string' && typeof id === 'string') {
          // Validate ID exists in our resources
          if (type === 'case_study' && validCaseStudyIds.has(id)) {
            proofPlan.push({
              type: 'case_study',
              id,
              usageGuidance: typeof proof.usageGuidance === 'string' ? proof.usageGuidance : undefined,
              targetSections: Array.isArray(proof.targetSections)
                ? proof.targetSections.filter((s): s is string => typeof s === 'string')
                : undefined,
              priority: typeof proof.priority === 'number' && proof.priority >= 1 && proof.priority <= 5
                ? proof.priority : 3,
            });
          } else if (type === 'reference' && validReferenceIds.has(id)) {
            proofPlan.push({
              type: 'reference',
              id,
              usageGuidance: typeof proof.usageGuidance === 'string' ? proof.usageGuidance : undefined,
              targetSections: Array.isArray(proof.targetSections)
                ? proof.targetSections.filter((s): s is string => typeof s === 'string')
                : undefined,
              priority: typeof proof.priority === 'number' && proof.priority >= 1 && proof.priority <= 5
                ? proof.priority : 3,
            });
          }
          // Skip invalid IDs silently
        }
      }
    }
  }

  // Validate competitive assumptions
  const competitiveAssumptions: string[] = [];
  if (Array.isArray(obj.competitiveAssumptions)) {
    for (const a of obj.competitiveAssumptions) {
      if (typeof a === 'string' && a.trim()) {
        competitiveAssumptions.push(a.trim());
      }
    }
  }

  // Validate landmines
  const landmines: RfpLandmine[] = [];
  if (Array.isArray(obj.landmines)) {
    for (const l of obj.landmines) {
      if (typeof l === 'object' && l !== null) {
        const landmine = l as Record<string, unknown>;
        if (typeof landmine.description === 'string' && landmine.description.trim()) {
          landmines.push({
            id: typeof landmine.id === 'string' ? landmine.id : `landmine_${landmines.length + 1}`,
            description: landmine.description.trim(),
            severity: ['low', 'medium', 'high', 'critical'].includes(landmine.severity as string)
              ? (landmine.severity as RfpLandmine['severity'])
              : 'medium',
            mitigation: typeof landmine.mitigation === 'string' ? landmine.mitigation : undefined,
            affectedSections: Array.isArray(landmine.affectedSections)
              ? landmine.affectedSections.filter((s): s is string => typeof s === 'string')
              : undefined,
          });
        }
      }
    }
  }

  return {
    evaluationCriteria,
    winThemes,
    proofPlan,
    competitiveAssumptions,
    landmines,
    locked: false,
  };
}

// ============================================================================
// Alignment Scoring
// ============================================================================

/**
 * Calculate how well content aligns with the win strategy
 */
export function calculateStrategyAlignment(
  content: string,
  sectionKey: string,
  strategy: RfpWinStrategy
): {
  score: number;
  themesAddressed: string[];
  themesMissing: string[];
  suggestions: string[];
} {
  if (!content || !strategy) {
    return {
      score: 0,
      themesAddressed: [],
      themesMissing: strategy?.winThemes.map(t => t.label) || [],
      suggestions: ['Add content to assess alignment'],
    };
  }

  const contentLower = content.toLowerCase();
  const themesAddressed: string[] = [];
  const themesMissing: string[] = [];
  const suggestions: string[] = [];

  // Check each win theme
  for (const theme of strategy.winThemes) {
    // Check if theme applies to this section
    const appliesHere = !theme.applicableSections || theme.applicableSections.includes(sectionKey);

    if (appliesHere) {
      // Simple keyword check (could be enhanced with semantic analysis)
      const themeKeywords = theme.label.toLowerCase().split(/\s+/);
      const descKeywords = theme.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const allKeywords = [...themeKeywords, ...descKeywords];

      const matchCount = allKeywords.filter(kw => contentLower.includes(kw)).length;
      const matchRatio = matchCount / allKeywords.length;

      if (matchRatio >= 0.3) {
        themesAddressed.push(theme.label);
      } else {
        themesMissing.push(theme.label);
        suggestions.push(`Consider emphasizing: "${theme.label}" - ${theme.description}`);
      }
    }
  }

  // Calculate score based on themes addressed
  const applicableThemes = strategy.winThemes.filter(
    t => !t.applicableSections || t.applicableSections.includes(sectionKey)
  );

  const score = applicableThemes.length > 0
    ? Math.round((themesAddressed.length / applicableThemes.length) * 100)
    : 100; // No applicable themes = full score

  return {
    score,
    themesAddressed,
    themesMissing,
    suggestions: suggestions.slice(0, 3), // Limit to top 3 suggestions
  };
}
