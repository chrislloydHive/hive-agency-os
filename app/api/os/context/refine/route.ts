// app/api/os/context/refine/route.ts
// AI-Assisted Context Refinement API
//
// DOCTRINE: User-First - AI improves user-entered context without overwriting intent.
//
// This endpoint:
// 1. Receives a user-entered value
// 2. Generates a refined version with improved clarity/structure
// 3. Returns both for side-by-side comparison
// 4. NEVER auto-applies - always returns as proposal

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getRegistryEntry } from '@/lib/contextGraph/unifiedRegistry';

export const maxDuration = 30;

// ============================================================================
// Types
// ============================================================================

interface RefineRequest {
  companyId: string;
  /** The node key being refined (e.g., 'identity.businessModel') */
  nodeKey: string;
  /** The original user-entered value */
  originalValue: unknown;
  /** Optional: zone context for better refinement */
  zoneId?: string;
}

interface RefineResponse {
  success: boolean;
  /** The original value (unchanged) */
  originalValue: unknown;
  /** The AI-refined value */
  refinedValue: unknown;
  /** Short rationale (1-2 lines) */
  rationale: string;
  /** Confidence 0-1 */
  confidence: number;
  /** Whether there's a meaningful difference */
  hasDifference: boolean;
  /** What changed (for highlighting) */
  changes?: {
    type: 'clarified' | 'structured' | 'expanded' | 'corrected' | 'formatted';
    description: string;
  };
}

// ============================================================================
// System Prompt
// ============================================================================

function buildSystemPrompt(fieldLabel: string, fieldDescription?: string): string {
  return `
You are a Context Refinement Assistant for Hive OS.

Your job is to REFINE user-entered context values, making them clearer and more actionable
while preserving the user's original intent and meaning.

RULES:
1. PRESERVE INTENT - Never change the fundamental meaning of what the user wrote
2. IMPROVE CLARITY - Make vague statements more specific and actionable
3. STRUCTURE WELL - Use proper formatting, capitalization, and grammar
4. BE CONCISE - Remove redundancy while keeping key information
5. NO INVENTION - Do not add facts or details the user didn't provide
6. RESPECT LENGTH - If input is brief, output should be brief too
7. MATCH STYLE - If input is casual, keep it accessible; if formal, stay formal

FIELD: ${fieldLabel}
${fieldDescription ? `CONTEXT: ${fieldDescription}` : ''}

OUTPUT FORMAT:
Return a JSON object with:
{
  "refinedValue": <the refined value - same type as input (string, array, etc.)>,
  "rationale": "<1-2 sentence explanation of what was improved>",
  "confidence": <0.0 to 1.0>,
  "changeType": "clarified" | "structured" | "expanded" | "corrected" | "formatted",
  "changeDescription": "<brief description of the key change>"
}

If the original value is already well-formed and clear, return it unchanged with:
{
  "refinedValue": <original value>,
  "rationale": "The original value is clear and well-structured.",
  "confidence": 1.0,
  "changeType": "formatted",
  "changeDescription": "No changes needed"
}
`.trim();
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RefineRequest;
    const { companyId, nodeKey, originalValue, zoneId } = body;

    // Validation
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }
    if (!nodeKey) {
      return NextResponse.json({ error: 'Missing nodeKey' }, { status: 400 });
    }
    if (originalValue === undefined || originalValue === null) {
      return NextResponse.json({ error: 'Missing originalValue' }, { status: 400 });
    }

    // Get field metadata from registry
    const fieldEntry = getRegistryEntry(nodeKey);
    if (!fieldEntry) {
      return NextResponse.json({ error: `Unknown field: ${nodeKey}` }, { status: 400 });
    }

    // Load company for context
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Load existing context graph for consistency checking
    const graph = await loadContextGraph(companyId);

    // Build context for AI
    const contextSnippet = graph ? buildContextSnippet(graph, nodeKey) : '';

    console.log(`[context/refine] Refining ${nodeKey} for ${companyName}`);
    console.log(`[context/refine] Original: ${JSON.stringify(originalValue).slice(0, 100)}`);

    // Call OpenAI
    let openai;
    try {
      openai = getOpenAI();
    } catch {
      return NextResponse.json({
        error: 'OpenAI not configured',
      }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(fieldEntry.label, fieldEntry.description);

    const userPrompt = `
Company: ${companyName}
Field: ${fieldEntry.label} (${nodeKey})
Zone: ${zoneId || fieldEntry.zoneId}

ORIGINAL VALUE (user-entered):
${formatValueForPrompt(originalValue)}

${contextSnippet ? `EXISTING CONTEXT (for consistency):
${contextSnippet}` : ''}

Please refine this value while preserving the user's intent.
`.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: {
      refinedValue?: unknown;
      rationale?: string;
      confidence?: number;
      changeType?: string;
      changeDescription?: string;
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[context/refine] Failed to parse AI response:', raw);
      return NextResponse.json({
        error: 'AI returned invalid JSON',
      }, { status: 500 });
    }

    // Check if there's a meaningful difference
    const hasDifference = !isEquivalent(originalValue, parsed.refinedValue);

    // Valid change types
    type ChangeType = 'clarified' | 'structured' | 'expanded' | 'corrected' | 'formatted';
    const validChangeTypes: ChangeType[] = ['clarified', 'structured', 'expanded', 'corrected', 'formatted'];
    const changeType: ChangeType = validChangeTypes.includes(parsed.changeType as ChangeType)
      ? (parsed.changeType as ChangeType)
      : 'clarified';

    const result: RefineResponse = {
      success: true,
      originalValue,
      refinedValue: parsed.refinedValue ?? originalValue,
      rationale: parsed.rationale || 'No changes made.',
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.8)),
      hasDifference,
      changes: hasDifference ? {
        type: changeType,
        description: parsed.changeDescription || 'Improved clarity',
      } : undefined,
    };

    console.log(`[context/refine] Result: hasDifference=${hasDifference}, confidence=${result.confidence}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[context/refine] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refinement failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a value for inclusion in the AI prompt
 */
function formatValueForPrompt(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join('\n- ') : '(empty list)';
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Build a snippet of related context for consistency
 */
function buildContextSnippet(graph: any, currentKey: string): string {
  const domain = currentKey.split('.')[0];
  const domainData = graph[domain];

  if (!domainData) return '';

  const snippets: string[] = [];
  for (const [key, field] of Object.entries(domainData)) {
    if (key === currentKey.split('.')[1]) continue; // Skip current field
    const value = (field as any)?.value;
    if (value !== null && value !== undefined) {
      const displayValue = typeof value === 'string'
        ? value.slice(0, 100)
        : JSON.stringify(value).slice(0, 100);
      snippets.push(`- ${key}: ${displayValue}`);
    }
  }

  return snippets.slice(0, 5).join('\n');
}

/**
 * Check if two values are equivalent (for detecting meaningful changes)
 */
function isEquivalent(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  // Normalize strings for comparison
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  // Compare arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => isEquivalent(val, b[i]));
  }

  // Deep compare objects
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}
