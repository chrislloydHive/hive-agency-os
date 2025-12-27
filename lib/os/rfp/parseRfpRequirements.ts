// lib/os/rfp/parseRfpRequirements.ts
// RFP Requirements Parser - Extracts structured requirements from raw RFP text
//
// Uses LLM parsing with strong grounding rules to prevent hallucination.
// Returns validated ParsedRfpRequirements with safe fallbacks on failure.

import { z } from 'zod';
import { openai } from '@/lib/openai';
import { safeAiCall, extractTextFromMessage, parseJsonFromAi } from '@/lib/ai/safeCall';
import {
  ParsedRfpRequirementsSchema,
  type ParsedRfpRequirements,
  type ParsedRequiredSection,
} from '@/lib/types/rfp';

// ============================================================================
// Types
// ============================================================================

export interface ParseRfpResult {
  success: boolean;
  requirements: ParsedRfpRequirements;
  error?: string;
  retryCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const EMPTY_REQUIREMENTS: ParsedRfpRequirements = {
  deadline: null,
  submissionInstructions: [],
  complianceChecklist: [],
  evaluationCriteria: [],
  requiredResponseSections: [],
  mustAnswerQuestions: [],
  wordLimit: null,
  pageLimit: null,
  parsedAt: undefined,
  parseConfidence: 'low',
};

const MAX_INPUT_LENGTH = 100000; // ~100k chars max

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an expert RFP analyst. Your task is to extract structured requirements from raw RFP (Request for Proposal) text.

CRITICAL RULES - YOU MUST FOLLOW:
1. ONLY extract information that is EXPLICITLY stated in the RFP text
2. Do NOT infer, assume, or make up any requirements not clearly stated
3. If a field cannot be determined from the text, leave it empty/null
4. Quote or closely paraphrase the original text - do not embellish
5. Be conservative - when in doubt, do NOT include an item

OUTPUT FORMAT:
Return a JSON object matching this exact structure:
{
  "deadline": "ISO date string or null if not found",
  "submissionInstructions": ["Array of explicit submission instructions"],
  "complianceChecklist": ["Array of compliance requirements that MUST be met"],
  "evaluationCriteria": ["Array of how proposals will be evaluated/scored"],
  "requiredResponseSections": [
    {
      "title": "Section title as stated in RFP",
      "description": "Optional description of what this section should contain",
      "pageLimit": number or null,
      "wordLimit": number or null
    }
  ],
  "mustAnswerQuestions": ["Specific questions that require direct answers"],
  "wordLimit": number or null (overall proposal limit),
  "pageLimit": number or null (overall proposal limit),
  "parseConfidence": "high" | "medium" | "low"
}

FIELD GUIDANCE:
- deadline: Look for submission dates, due dates, deadlines
- submissionInstructions: How/where to submit, format requirements, number of copies
- complianceChecklist: Must-have requirements, certifications, insurance minimums, legal requirements
- evaluationCriteria: Scoring criteria, weighted factors, selection process details
- requiredResponseSections: Explicit section requirements like "Section 1: Company Overview"
- mustAnswerQuestions: Direct questions requiring specific answers
- parseConfidence: "high" if clear and explicit, "medium" if somewhat ambiguous, "low" if mostly inferred

Return ONLY valid JSON. No markdown, no explanations.`;

// ============================================================================
// Main Parse Function
// ============================================================================

/**
 * Parse raw RFP text into structured requirements using LLM
 *
 * @param rfpText - The raw RFP document text
 * @returns ParseRfpResult with success status and parsed requirements
 */
export async function parseRfpRequirements(rfpText: string): Promise<ParseRfpResult> {
  // Validate input
  if (!rfpText || rfpText.trim().length === 0) {
    return {
      success: false,
      requirements: EMPTY_REQUIREMENTS,
      error: 'Empty RFP text provided',
    };
  }

  // Truncate if too long
  const truncatedText = rfpText.length > MAX_INPUT_LENGTH
    ? rfpText.substring(0, MAX_INPUT_LENGTH) + '\n\n[Text truncated for processing...]'
    : rfpText;

  // Call LLM with retry logic
  const result = await safeAiCall(
    async () => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Parse the following RFP text and extract structured requirements:\n\n---\n\n${truncatedText}`,
          },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      return response.choices[0]?.message?.content ?? '';
    },
    {
      retries: 2,
      retryDelay: 1000,
      context: 'parse-rfp-requirements',
    }
  );

  if (!result.ok || !result.value) {
    return {
      success: false,
      requirements: EMPTY_REQUIREMENTS,
      error: result.error ?? 'Failed to parse RFP',
      retryCount: result.retryCount,
    };
  }

  // Parse and validate JSON response
  const parseResult = parseJsonFromAi(result.value, EMPTY_REQUIREMENTS);
  if (!parseResult.ok) {
    return {
      success: false,
      requirements: EMPTY_REQUIREMENTS,
      error: parseResult.error ?? 'Failed to parse LLM response as JSON',
      retryCount: result.retryCount,
    };
  }

  // Validate against Zod schema with safe parsing
  const validated = validateAndSanitize(parseResult.value);

  return {
    success: true,
    requirements: {
      ...validated,
      parsedAt: new Date().toISOString(),
    },
    retryCount: result.retryCount,
  };
}

// ============================================================================
// Validation & Sanitization
// ============================================================================

/**
 * Validate and sanitize parsed requirements using Zod
 * Returns safe defaults for any invalid fields
 */
function validateAndSanitize(raw: unknown): ParsedRfpRequirements {
  // First, try to parse the whole thing
  const fullParse = ParsedRfpRequirementsSchema.safeParse(raw);
  if (fullParse.success) {
    return fullParse.data;
  }

  // If full parse fails, build up a valid object field by field
  const obj = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {};

  const deadline = typeof obj.deadline === 'string' ? obj.deadline : null;
  const submissionInstructions = Array.isArray(obj.submissionInstructions)
    ? obj.submissionInstructions.filter((s): s is string => typeof s === 'string')
    : [];
  const complianceChecklist = Array.isArray(obj.complianceChecklist)
    ? obj.complianceChecklist.filter((s): s is string => typeof s === 'string')
    : [];
  const evaluationCriteria = Array.isArray(obj.evaluationCriteria)
    ? obj.evaluationCriteria.filter((s): s is string => typeof s === 'string')
    : [];
  const mustAnswerQuestions = Array.isArray(obj.mustAnswerQuestions)
    ? obj.mustAnswerQuestions.filter((s): s is string => typeof s === 'string')
    : [];

  // Parse required sections with more care
  const requiredResponseSections: ParsedRequiredSection[] = [];
  if (Array.isArray(obj.requiredResponseSections)) {
    for (const section of obj.requiredResponseSections) {
      if (typeof section === 'object' && section !== null) {
        const s = section as Record<string, unknown>;
        if (typeof s.title === 'string' && s.title.trim()) {
          requiredResponseSections.push({
            title: s.title.trim(),
            description: typeof s.description === 'string' ? s.description : undefined,
            pageLimit: typeof s.pageLimit === 'number' ? s.pageLimit : undefined,
            wordLimit: typeof s.wordLimit === 'number' ? s.wordLimit : undefined,
          });
        }
      }
    }
  }

  const wordLimit = typeof obj.wordLimit === 'number' ? obj.wordLimit : null;
  const pageLimit = typeof obj.pageLimit === 'number' ? obj.pageLimit : null;

  // Determine parse confidence
  let parseConfidence: 'high' | 'medium' | 'low' = 'low';
  if (obj.parseConfidence === 'high' || obj.parseConfidence === 'medium') {
    parseConfidence = obj.parseConfidence;
  } else if (
    requiredResponseSections.length > 0 ||
    (evaluationCriteria.length > 0 && complianceChecklist.length > 0)
  ) {
    parseConfidence = 'medium';
  }

  return {
    deadline,
    submissionInstructions,
    complianceChecklist,
    evaluationCriteria,
    requiredResponseSections,
    mustAnswerQuestions,
    wordLimit,
    pageLimit,
    parseConfidence,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if requirements have meaningful content
 */
export function hasRequirements(req: ParsedRfpRequirements | null | undefined): boolean {
  if (!req) return false;

  return (
    !!req.deadline ||
    req.submissionInstructions.length > 0 ||
    req.complianceChecklist.length > 0 ||
    req.evaluationCriteria.length > 0 ||
    req.requiredResponseSections.length > 0 ||
    req.mustAnswerQuestions.length > 0
  );
}

/**
 * Get a summary of parsed requirements for display
 */
export function getRequirementsSummary(req: ParsedRfpRequirements): string {
  const parts: string[] = [];

  if (req.deadline) {
    parts.push(`Deadline: ${req.deadline}`);
  }
  if (req.requiredResponseSections.length > 0) {
    parts.push(`${req.requiredResponseSections.length} required sections`);
  }
  if (req.evaluationCriteria.length > 0) {
    parts.push(`${req.evaluationCriteria.length} evaluation criteria`);
  }
  if (req.mustAnswerQuestions.length > 0) {
    parts.push(`${req.mustAnswerQuestions.length} questions to answer`);
  }
  if (req.complianceChecklist.length > 0) {
    parts.push(`${req.complianceChecklist.length} compliance items`);
  }

  if (parts.length === 0) {
    return 'No requirements parsed';
  }

  return parts.join(' | ');
}

/**
 * Create empty requirements (for initialization)
 * Returns a deep copy to avoid shared array references
 */
export function createEmptyRequirements(): ParsedRfpRequirements {
  return {
    deadline: null,
    submissionInstructions: [],
    complianceChecklist: [],
    evaluationCriteria: [],
    requiredResponseSections: [],
    mustAnswerQuestions: [],
    wordLimit: null,
    pageLimit: null,
    parsedAt: undefined,
    parseConfidence: 'low',
  };
}
