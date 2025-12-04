// lib/contextGraph/inference/aiSuggest.ts
// AI Suggestion Engine
//
// Generates intelligent suggestions for context graph field updates
// based on current values, related fields, and domain context.

import Anthropic from '@anthropic-ai/sdk';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import { flattenGraphToFields } from '../uiHelpers';
import type { NeedsRefreshFlag } from '../contextHealth';
import { getNeedsRefreshReport } from '../needsRefresh';
import { convertNeedsRefreshReport } from '../contextHealth';
import { checkLock } from '../governance/locks';

// ============================================================================
// Types
// ============================================================================

export interface AISuggestion {
  id: string;
  path: string;
  fieldLabel: string;
  domain: DomainName;
  oldValue: unknown;
  suggestedValue: unknown;
  confidence: number;           // 0-1
  reasoning: string;
  source: 'ai_inference' | 'ai_heal' | 'rule_based';
  relatedFields?: string[];     // Other fields that influenced this suggestion
  createdAt: string;
}

export interface SuggestOptions {
  targetPath?: string;          // Suggest for a specific field
  targetDomain?: DomainName;    // Suggest for a specific domain
  includeStale?: boolean;       // Include suggestions for stale fields
  includeMissing?: boolean;     // Include suggestions for missing fields
  maxSuggestions?: number;      // Max number of suggestions to generate
}

export interface SuggestResult {
  suggestions: AISuggestion[];
  analyzedFields: number;
  generatedAt: string;
  error?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getValueByPath(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value: unknown }).value;
  }

  return current;
}

// ============================================================================
// Main Suggestion Functions
// ============================================================================

/**
 * Generate AI suggestions for context graph improvements
 */
export async function generateSuggestions(
  companyId: string,
  graph: CompanyContextGraph,
  options: SuggestOptions = {}
): Promise<SuggestResult> {
  const {
    targetPath,
    targetDomain,
    includeStale = true,
    includeMissing = true,
    maxSuggestions = 10,
  } = options;

  try {
    // Get refresh report to find fields that need attention
    const refreshReport = getNeedsRefreshReport(graph);
    const needsRefreshFlags = convertNeedsRefreshReport(refreshReport);

    // Filter flags based on options
    let targetFlags = needsRefreshFlags;

    if (targetPath) {
      targetFlags = targetFlags.filter(f => `${f.domain}.${f.field}` === targetPath);
    } else if (targetDomain) {
      targetFlags = targetFlags.filter(f => f.domain === targetDomain);
    }

    if (!includeStale) {
      targetFlags = targetFlags.filter(f => f.reason !== 'stale' && f.reason !== 'expired');
    }

    if (!includeMissing) {
      targetFlags = targetFlags.filter(f => f.reason !== 'missing');
    }

    // Check locks - filter out hard-locked fields
    const unlockChecks = await Promise.all(
      targetFlags.map(async (flag) => {
        const path = `${flag.domain}.${flag.field}`;
        const lockCheck = await checkLock(companyId, path);
        return { flag, canSuggest: !lockCheck.isLocked || lockCheck.lock?.severity === 'soft' };
      })
    );

    const suggestableFlags = unlockChecks
      .filter(c => c.canSuggest)
      .map(c => c.flag)
      .slice(0, maxSuggestions);

    if (suggestableFlags.length === 0) {
      return {
        suggestions: [],
        analyzedFields: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    // Build context for AI
    const fields = flattenGraphToFields(graph);
    const populatedFields = fields.filter(f => f.value !== null && f.value !== '');

    // Generate suggestions using AI
    const suggestions = await generateAISuggestions(
      graph,
      suggestableFlags,
      populatedFields,
      maxSuggestions
    );

    return {
      suggestions,
      analyzedFields: suggestableFlags.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[aiSuggest] Error generating suggestions:', error);
    return {
      suggestions: [],
      analyzedFields: 0,
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a suggestion for a single field
 */
export async function suggestFieldValue(
  companyId: string,
  graph: CompanyContextGraph,
  fieldPath: string
): Promise<AISuggestion | null> {
  // Check if field is locked
  const lockCheck = await checkLock(companyId, fieldPath);
  if (lockCheck.isLocked && lockCheck.lock?.severity === 'hard') {
    return null;
  }

  const result = await generateSuggestions(companyId, graph, {
    targetPath: fieldPath,
    maxSuggestions: 1,
  });

  return result.suggestions[0] ?? null;
}

// ============================================================================
// AI Generation
// ============================================================================

async function generateAISuggestions(
  graph: CompanyContextGraph,
  flags: NeedsRefreshFlag[],
  populatedFields: Array<{ path: string; value: string | null; label: string }>,
  maxSuggestions: number
): Promise<AISuggestion[]> {
  const client = new Anthropic();

  // Build context summary
  const contextSummary = populatedFields
    .slice(0, 50)  // Limit context size
    .map(f => `${f.path}: ${f.value?.slice(0, 300) ?? 'null'}`)
    .join('\n');

  // Build list of fields needing suggestions
  const fieldsNeedingSuggestions = flags.slice(0, maxSuggestions).map(f => ({
    path: `${f.domain}.${f.field}`,
    reason: f.reason,
    currentValue: getValueByPath(graph, `${f.domain}.${f.field}`),
  }));

  const prompt = `You are an expert marketing strategist analyzing a company's marketing context graph.
Based on the existing context data, suggest values for fields that need updates.

## Existing Context:
${contextSummary}

## Fields Needing Suggestions:
${JSON.stringify(fieldsNeedingSuggestions, null, 2)}

For each field, provide a suggestion based on what can be inferred from the existing context.
Only suggest values that can be reasonably inferred - don't make up data that requires external knowledge.

Respond with a JSON array of suggestions:
[
  {
    "path": "domain.fieldName",
    "suggestedValue": "the suggested value (string, array, or object as appropriate)",
    "confidence": 0.8,
    "reasoning": "Brief explanation of why this value makes sense",
    "relatedFields": ["field1", "field2"]
  }
]

Guidelines:
- Confidence 0.9+: Very confident based on clear existing data
- Confidence 0.7-0.9: Reasonable inference from context
- Confidence 0.5-0.7: Educated guess, might need human review
- Don't suggest values you have no basis for (skip those fields)
- Keep reasoning concise (1-2 sentences)

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

    const parsed = JSON.parse(textContent.text.trim());

    if (!Array.isArray(parsed)) {
      return [];
    }

    const now = new Date().toISOString();

    return parsed.map((item: {
      path: string;
      suggestedValue: unknown;
      confidence: number;
      reasoning: string;
      relatedFields?: string[];
    }) => {
      const pathParts = item.path.split('.');
      const domain = pathParts[0] as DomainName;
      const fieldName = pathParts.slice(1).join('.');

      return {
        id: generateSuggestionId(),
        path: item.path,
        fieldLabel: fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        domain,
        oldValue: getValueByPath(graph, item.path),
        suggestedValue: item.suggestedValue,
        confidence: Math.max(0, Math.min(1, item.confidence ?? 0.7)),
        reasoning: item.reasoning ?? 'AI-generated suggestion',
        source: 'ai_inference' as const,
        relatedFields: item.relatedFields,
        createdAt: now,
      };
    }).filter((s: AISuggestion) => s.suggestedValue !== null && s.suggestedValue !== undefined);
  } catch (error) {
    console.error('[aiSuggest] AI generation error:', error);
    return [];
  }
}

/**
 * Get suggestions that are pending acceptance
 */
export async function getPendingSuggestions(companyId: string): Promise<AISuggestion[]> {
  // In a full implementation, this would query a storage layer
  // For now, suggestions are generated on-demand
  // This function is a placeholder for integration with the update log
  const { getPendingSuggestions: getLogSuggestions } = await import('../governance/updateLog');
  const pendingLogs = await getLogSuggestions(companyId);

  return pendingLogs.map(log => ({
    id: log.updateId,
    path: log.path,
    fieldLabel: log.path.split('.').pop() ?? log.path,
    domain: log.path.split('.')[0] as DomainName,
    oldValue: log.oldValue,
    suggestedValue: log.newValue,
    confidence: 0.7,
    reasoning: log.reasoning ?? 'AI suggestion',
    source: 'ai_inference' as const,
    createdAt: log.updatedAt,
  }));
}
