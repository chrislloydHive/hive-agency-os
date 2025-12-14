// app/api/os/global-context/hive-brain/ai-copilot/route.ts
// Hive Brain AI Copilot API
//
// CRITICAL TRUST RULES:
// - AI must NEVER write directly to Hive Brain
// - AI must ONLY return Proposal objects
// - All changes require explicit human approval
// - Provenance marks all suggestions as source: 'ai_copilot'
// - Confirmed/locked fields must be respected
//
// Scope: Hive Brain ONLY. Cannot modify Company Context or Strategy.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getHiveGlobalContextGraph } from '@/lib/contextGraph/globalGraph';
import {
  computeProposalForAI,
  buildLockMeta,
  formatProposalForResponse,
} from '@/lib/os/writeContract';
import { buildHiveBrainCopilotPrompt } from '@/lib/os/hiveBrainCopilot/prompt';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

export const maxDuration = 120;

// ============================================================================
// Types
// ============================================================================

interface CopilotRequest {
  /** User's prompt/question */
  prompt?: string;
  /** Suggested action ID */
  action?: 'fill_service_taxonomy' | 'refine_capabilities' | 'improve_positioning' | 'audit_gaps';
}

interface CopilotResponse {
  /** The proposal (if changes were suggested) */
  proposal: ReturnType<typeof formatProposalForResponse> | null;
  /** Summary of what the copilot did */
  summary: string;
  /** Whether user approval is required */
  requiresUserApproval: boolean;
  /** Error message if something went wrong */
  error?: string;
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<CopilotResponse>> {
  try {
    const body = await request.json() as CopilotRequest;
    const { prompt, action } = body;

    if (!prompt && !action) {
      return NextResponse.json({
        proposal: null,
        summary: 'Please provide a prompt or select an action.',
        requiresUserApproval: false,
        error: 'No prompt or action provided',
      }, { status: 400 });
    }

    // 1. Load current Hive Brain state
    const currentGraph = await getHiveGlobalContextGraph();

    // 2. Build the copilot prompt
    const systemPrompt = buildHiveBrainCopilotPrompt(currentGraph, action);
    const userMessage = prompt || getActionPrompt(action);

    // 3. Call Anthropic API
    const anthropic = new Anthropic();
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384, // Increased to allow complete JSON output for all capabilities
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    });

    // 4. Parse AI response
    const aiResponse = completion.content[0];
    if (aiResponse.type !== 'text') {
      return NextResponse.json({
        proposal: null,
        summary: 'AI response was not text',
        requiresUserApproval: false,
        error: 'Unexpected AI response type',
      }, { status: 500 });
    }

    // Check if response was truncated
    if (completion.stop_reason === 'max_tokens') {
      console.warn('[HiveBrainCopilot] Response was truncated due to max_tokens limit');
    }

    console.log('[HiveBrainCopilot] AI response length:', aiResponse.text.length);
    console.log('[HiveBrainCopilot] Stop reason:', completion.stop_reason);
    console.log('[HiveBrainCopilot] AI response preview:', aiResponse.text.slice(0, 500));

    const parsed = parseAIResponse(aiResponse.text);

    console.log('[HiveBrainCopilot] Parsed result:', {
      hasCandidateGraph: !!parsed.candidateGraph,
      summaryLength: parsed.summary?.length || 0,
    });

    if (!parsed.candidateGraph) {
      // AI provided commentary but no changes
      console.log('[HiveBrainCopilot] No candidate graph - returning no changes');
      return NextResponse.json({
        proposal: null,
        summary: parsed.summary || 'No changes suggested.',
        requiresUserApproval: false,
      });
    }

    // 5. Merge AI's partial candidate with base to get full candidate
    // This ensures fields the AI didn't mention are preserved, not removed
    const fullCandidate = deepMerge(
      currentGraph as unknown as Record<string, unknown>,
      parsed.candidateGraph as Record<string, unknown>
    );

    console.log('[HiveBrainCopilot] Merge result:', {
      candidateKeys: Object.keys(parsed.candidateGraph),
      fullCandidateKeys: Object.keys(fullCandidate),
    });

    // 6. Compute proposal using write contract system
    const lockMeta = buildLockMeta('context', currentGraph as unknown as Record<string, unknown>);
    const { proposal, hasConflicts, applicableCount, conflictCount } = computeProposalForAI({
      base: currentGraph,
      candidate: fullCandidate,
      meta: lockMeta,
      baseRevisionId: currentGraph.meta.lastSnapshotId || 'initial',
      createdBy: 'ai:hive-brain-copilot',
      companyId: 'HIVE_GLOBAL',
      entityId: 'HIVE_GLOBAL',
    });

    console.log('[HiveBrainCopilot] Proposal computed:', {
      patchCount: proposal.patch.length,
      conflictCount: proposal.conflicts.length,
      patchPaths: proposal.patch.slice(0, 5).map(p => p.path),
    });

    // 7. Build summary
    let summary = parsed.summary || `AI suggested ${applicableCount} change(s).`;
    if (hasConflicts) {
      summary += ` ${conflictCount} change(s) conflict with locked fields.`;
    }

    return NextResponse.json({
      proposal: formatProposalForResponse(proposal),
      summary,
      requiresUserApproval: applicableCount > 0,
    });

  } catch (error) {
    console.error('[HiveBrainCopilot] Error:', error);
    return NextResponse.json({
      proposal: null,
      summary: 'An error occurred while processing your request.',
      requiresUserApproval: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getActionPrompt(action?: CopilotRequest['action']): string {
  switch (action) {
    case 'fill_service_taxonomy':
      return 'Please help fill out Hive\'s service taxonomy. Review current capabilities and suggest missing services or deliverables based on what a full-service digital marketing agency typically offers.';
    case 'refine_capabilities':
      return 'Please review and refine Hive\'s delivery capabilities. Suggest improvements to deliverables and constraints for each enabled capability.';
    case 'improve_positioning':
      return 'Please improve Hive\'s brand positioning and differentiation. Suggest clearer language that emphasizes specific, measurable value.';
    case 'audit_gaps':
      return 'Please audit the Hive Brain for gaps or weak fields. Identify areas that need attention and suggest improvements.';
    default:
      return 'Please review the Hive Brain and suggest any improvements.';
  }
}

interface ParsedAIResponse {
  summary?: string;
  candidateGraph?: CompanyContextGraph;
}

function parseAIResponse(text: string): ParsedAIResponse {
  // Debug: Check what markers exist in the text
  const hasJsonMarker = text.includes('```json');
  const hasPlainMarker = text.includes('```');
  const markerCount = (text.match(/```/g) || []).length;
  console.log('[parseAIResponse] Markers:', { hasJsonMarker, hasPlainMarker, markerCount });

  // Look for JSON block in the response - try multiple patterns
  let jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  console.log('[parseAIResponse] Pattern 1 (```json...\\n```):', !!jsonMatch);

  if (!jsonMatch) {
    // Try ```json without newline before closing
    jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    console.log('[parseAIResponse] Pattern 2 (```json...```):', !!jsonMatch);
  }

  if (!jsonMatch) {
    // Try plain ``` (no json tag) containing a JSON object
    jsonMatch = text.match(/```\s*\n(\s*\{[\s\S]*?\})\s*\n```/);
    console.log('[parseAIResponse] Pattern 3 (```...{...}...```):', !!jsonMatch);
  }

  if (!jsonMatch) {
    // Try plain ``` without strict newlines
    jsonMatch = text.match(/```\s*(\{[\s\S]*?\})\s*```/);
    console.log('[parseAIResponse] Pattern 4 (```{...}```):', !!jsonMatch);
  }

  if (!jsonMatch) {
    // Last resort: manually find matching braces after any ```
    const jsonStart = text.indexOf('```json');
    const markerStart = jsonStart !== -1 ? jsonStart : text.indexOf('```');
    console.log('[parseAIResponse] Manual search, marker at:', markerStart);

    if (markerStart !== -1) {
      const skipLen = jsonStart !== -1 ? 7 : 3; // skip ```json or just ```
      const afterMarker = text.slice(markerStart + skipLen);
      const braceStart = afterMarker.indexOf('{');
      console.log('[parseAIResponse] Brace found at offset:', braceStart);

      if (braceStart !== -1) {
        // Find matching closing brace
        let depth = 0;
        let jsonEnd = -1;
        for (let i = braceStart; i < afterMarker.length; i++) {
          if (afterMarker[i] === '{') depth++;
          else if (afterMarker[i] === '}') {
            depth--;
            if (depth === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        console.log('[parseAIResponse] JSON end at:', jsonEnd, 'depth final:', depth);
        if (jsonEnd !== -1) {
          jsonMatch = [null, afterMarker.slice(braceStart, jsonEnd)] as unknown as RegExpMatchArray;
        }
      }
    }
  }

  if (!jsonMatch) {
    console.log('[parseAIResponse] No JSON block found after all attempts');
    return { summary: text.slice(0, 500) };
  }

  try {
    const jsonStr = jsonMatch[1].trim();
    console.log('[parseAIResponse] JSON string length:', jsonStr.length);
    const parsed = JSON.parse(jsonStr);

    // Extract summary from text before JSON
    const beforeJson = text.split('```json')[0].trim();
    const summary = beforeJson || 'Changes suggested.';

    return {
      summary: summary.slice(0, 500),
      candidateGraph: parsed,
    };
  } catch (err) {
    console.log('[parseAIResponse] JSON parse error:', err instanceof Error ? err.message : err);
    return { summary: text.slice(0, 500) };
  }
}

/**
 * Deep merge two objects, with source values overriding target values
 * Arrays are replaced, not merged
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Both are objects - recurse
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      // Replace value (including arrays)
      result[key] = sourceValue;
    }
  }

  return result;
}
