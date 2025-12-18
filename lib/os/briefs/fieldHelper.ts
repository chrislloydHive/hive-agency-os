// lib/os/briefs/fieldHelper.ts
// Field-level AI helper for briefs
//
// AI Helper Rules:
// - Never overwrite; UI must apply explicitly
// - Constrain to the requested field only
// - Support actions: suggest, refine, shorten, expand, variants

import Anthropic from '@anthropic-ai/sdk';
import { getBriefById } from '@/lib/airtable/briefs';
import type {
  Brief,
  BriefFieldAction,
  BriefFieldHelperInput,
  BriefFieldHelperOutput,
} from '@/lib/types/brief';

// ============================================================================
// Types
// ============================================================================

export interface FieldHelperResult {
  success: boolean;
  output?: BriefFieldHelperOutput;
  error?: string;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get AI suggestions for a specific brief field
 *
 * IMPORTANT: This never overwrites the field. The UI must explicitly apply the suggestion.
 */
export async function getBriefFieldSuggestion(
  input: BriefFieldHelperInput
): Promise<FieldHelperResult> {
  const { briefId, fieldPath, action, currentValue, guidance } = input;

  // 1. Load the brief for context
  const brief = await getBriefById(briefId);
  if (!brief) {
    return {
      success: false,
      error: 'Brief not found',
    };
  }

  // 2. Parse field path
  const [section, fieldName] = fieldPath.split('.') as ['core' | 'extension', string];
  if (!section || !fieldName) {
    return {
      success: false,
      error: 'Invalid field path. Use format: core.fieldName or extension.fieldName',
    };
  }

  // 3. Get field label for context
  const fieldLabel = getFieldLabel(fieldPath);

  // 4. Generate suggestion using AI
  try {
    const output = await generateFieldSuggestion(
      brief,
      section,
      fieldName,
      fieldLabel,
      action,
      currentValue,
      guidance
    );

    return {
      success: true,
      output,
    };
  } catch (error) {
    console.error('[FieldHelper] AI generation failed:', error);
    return {
      success: false,
      error: 'Failed to generate suggestion. Please try again.',
    };
  }
}

// ============================================================================
// AI Generation
// ============================================================================

/**
 * Generate field suggestion using AI
 */
async function generateFieldSuggestion(
  brief: Brief,
  section: 'core' | 'extension',
  fieldName: string,
  fieldLabel: string,
  action: BriefFieldAction,
  currentValue: string,
  guidance?: string
): Promise<BriefFieldHelperOutput> {
  const anthropic = new Anthropic();

  // Build prompt based on action
  const prompt = buildFieldPrompt(
    brief,
    section,
    fieldName,
    fieldLabel,
    action,
    currentValue,
    guidance
  );

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are a marketing brief writing assistant. Your task is to help improve a specific field in a brief.

RULES:
1. Only output content for the requested field - nothing else
2. Keep suggestions concise and actionable
3. Maintain consistency with the brief's overall tone and direction
4. For 'variants' action, provide 3 distinct alternatives

Output format:
- For 'suggest', 'refine', 'shorten', 'expand': Output just the improved text
- For 'variants': Output a JSON array of 3 strings: ["variant1", "variant2", "variant3"]`,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  // Parse response based on action
  if (action === 'variants') {
    try {
      const variants = JSON.parse(responseText) as string[];
      return { variants };
    } catch {
      // If JSON parsing fails, try to extract variants from the text
      const lines = responseText.split('\n').filter((l) => l.trim());
      return { variants: lines.slice(0, 3) };
    }
  }

  return { value: responseText };
}

/**
 * Build prompt for field suggestion
 */
function buildFieldPrompt(
  brief: Brief,
  section: 'core' | 'extension',
  fieldName: string,
  fieldLabel: string,
  action: BriefFieldAction,
  currentValue: string,
  guidance?: string
): string {
  const actionInstructions: Record<BriefFieldAction, string> = {
    suggest: 'Suggest a better version of this field. Make it more specific and actionable.',
    refine: 'Refine this field to be clearer and more impactful while keeping the same meaning.',
    shorten: 'Make this field more concise while preserving the key message.',
    expand: 'Expand this field with more detail and specificity.',
    variants: 'Provide 3 distinct alternative versions of this field.',
  };

  const sections: string[] = [
    `=== BRIEF CONTEXT ===`,
    `Type: ${brief.type}`,
    `Objective: ${brief.core.objective}`,
    `Target Audience: ${brief.core.targetAudience}`,
    `Single-Minded Focus: ${brief.core.singleMindedFocus}`,
    ``,
    `=== FIELD TO ${action.toUpperCase()} ===`,
    `Field: ${fieldLabel} (${section}.${fieldName})`,
    `Current Value: ${currentValue || '(empty)'}`,
    ``,
    `=== INSTRUCTION ===`,
    actionInstructions[action],
  ];

  if (guidance) {
    sections.push(``, `User Guidance: ${guidance}`);
  }

  if (action === 'variants') {
    sections.push(``, `Output as a JSON array: ["variant1", "variant2", "variant3"]`);
  } else {
    sections.push(``, `Output ONLY the improved text for this field.`);
  }

  return sections.join('\n');
}

/**
 * Get human-readable label for a field path
 */
function getFieldLabel(fieldPath: string): string {
  const labels: Record<string, string> = {
    // Core fields
    'core.objective': 'Objective',
    'core.targetAudience': 'Target Audience',
    'core.problemToSolve': 'Problem to Solve',
    'core.singleMindedFocus': 'Single-Minded Focus',
    'core.constraints': 'Constraints',
    'core.successDefinition': 'Success Definition',
    'core.assumptions': 'Assumptions',

    // Creative/Campaign extension
    'extension.keyMessage': 'Key Message',
    'extension.supportingMessages': 'Supporting Messages',
    'extension.visualDirection': 'Visual Direction',
    'extension.tone': 'Tone',
    'extension.cta': 'Call to Action',
    'extension.mandatories': 'Mandatories',
    'extension.formatSpecs': 'Format Specifications',

    // SEO extension
    'extension.searchIntent': 'Search Intent',
    'extension.priorityTopics': 'Priority Topics',
    'extension.keywordThemes': 'Keyword Themes',
    'extension.technicalConstraints': 'Technical Constraints',
    'extension.measurementWindow': 'Measurement Window',

    // Content extension
    'extension.contentPillars': 'Content Pillars',
    'extension.journeyStage': 'Journey Stage',
    'extension.cadence': 'Cadence',
    'extension.distributionChannels': 'Distribution Channels',

    // Website extension
    'extension.primaryUserFlows': 'Primary User Flows',
    'extension.conversionGoals': 'Conversion Goals',
    'extension.informationArchitectureNotes': 'IA Notes',
    'extension.cmsConstraints': 'CMS Constraints',
  };

  return labels[fieldPath] || fieldPath.split('.').pop() || fieldPath;
}

// ============================================================================
// Batch Suggestions
// ============================================================================

/**
 * Get suggestions for multiple fields at once
 */
export async function getBriefFieldSuggestions(
  briefId: string,
  fieldPaths: string[]
): Promise<Record<string, FieldHelperResult>> {
  const results: Record<string, FieldHelperResult> = {};

  // Load brief once
  const brief = await getBriefById(briefId);
  if (!brief) {
    for (const path of fieldPaths) {
      results[path] = { success: false, error: 'Brief not found' };
    }
    return results;
  }

  // Generate suggestions in parallel
  const promises = fieldPaths.map(async (fieldPath) => {
    const [section, fieldName] = fieldPath.split('.') as ['core' | 'extension', string];
    const currentValue = section === 'core'
      ? String((brief.core as unknown as Record<string, unknown>)[fieldName] || '')
      : String((brief.extension as unknown as Record<string, unknown>)[fieldName] || '');

    const result = await getBriefFieldSuggestion({
      briefId,
      fieldPath,
      action: 'suggest',
      currentValue,
    });

    return { fieldPath, result };
  });

  const settled = await Promise.all(promises);

  for (const { fieldPath, result } of settled) {
    results[fieldPath] = result;
  }

  return results;
}
