// lib/os/strategy/prompts/contextQualityPrompt.ts
// Context Quality Prompts for LLM Strategy Generation
//
// V11+: Labs are optional enrichment. Manual context is equally valid.
// AI guardrails respect provenance/confidence, not whether labs were run.
//
// Generates context quality preambles and instructions for LLMs
// to ensure strategy generation respects canonical context values.

import type { StrategyInputsMeta } from '../strategyInputsHelpers';

// ============================================================================
// Provenance Types
// ============================================================================

/**
 * Source of context value
 * - user: Manually entered by user (authoritative but unverified by evidence)
 * - lab: Extracted by AI from labs (verified by evidence)
 * - ai_proposal: AI-suggested, not yet confirmed
 * - confirmed: User-confirmed value (from any source)
 */
export type ContextProvenance = 'user' | 'lab' | 'ai_proposal' | 'confirmed';

export interface ProvenanceStats {
  user: number;      // Manual entries
  lab: number;       // Lab-extracted
  aiProposal: number; // Pending proposals
  confirmed: number;  // User-confirmed
  total: number;
}

// ============================================================================
// Types
// ============================================================================

export interface MissingField {
  label: string;
  importance: 'critical' | 'recommended' | 'optional';
  path?: string;
}

// ============================================================================
// Context Quality Preamble
// ============================================================================

/**
 * Generate context quality preamble for LLM prompts
 *
 * Informs the LLM about the quality and completeness of the context,
 * and sets expectations for how to use canonical values.
 */
export function generateContextQualityPreamble(meta: StrategyInputsMeta): string {
  const lines: string[] = [];

  lines.push('## Context Quality Information');
  lines.push('');

  if (meta.confirmedOnlyMode) {
    lines.push('**Mode: Canonical Only**');
    lines.push('All context values below have been human-verified and confirmed.');
    lines.push('Treat these values as authoritative facts about the business.');
    lines.push('Do NOT invent, rephrase, or embellish positioning, ICP, or value propositions.');
  } else {
    lines.push('**Mode: All Context**');
    lines.push('Some values may be AI-proposed and awaiting human verification.');
    lines.push('Treat proposed values as working assumptions that may require confirmation.');
  }

  lines.push('');

  if (meta.contextRevisionId) {
    lines.push(`**Snapshot ID:** \`${meta.contextRevisionId}\``);
    lines.push('This ensures strategy is based on a stable, point-in-time context.');
    lines.push('');
  }

  if (meta.completenessScore !== null) {
    const scoreLabel =
      meta.completenessScore >= 80
        ? 'High'
        : meta.completenessScore >= 50
          ? 'Medium'
          : 'Low';
    lines.push(`**Context Completeness:** ${meta.completenessScore}% (${scoreLabel})`);

    if (meta.completenessScore < 50) {
      lines.push('');
      lines.push('> **Note:** Context completeness is low.');
      lines.push('> Recommendations may be more generic due to missing information.');
      lines.push('> Consider flagging areas where more business context would improve strategy.');
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Missing Context Notice
// ============================================================================

/**
 * Generate missing context notice for LLM
 *
 * Lists critical missing fields so the LLM can account for gaps
 * and suggest what information would improve the strategy.
 */
export function generateMissingContextNotice(
  missingFields: MissingField[]
): string {
  if (missingFields.length === 0) return '';

  const lines: string[] = [];
  lines.push('## Missing Critical Context');
  lines.push('');
  lines.push('The following fields are missing and may limit strategy quality:');
  lines.push('');

  // Group by importance
  const critical = missingFields.filter((f) => f.importance === 'critical');
  const recommended = missingFields.filter((f) => f.importance === 'recommended');

  if (critical.length > 0) {
    lines.push('**Critical (required for strategy):**');
    for (const field of critical) {
      lines.push(`- ${field.label}`);
    }
    lines.push('');
  }

  if (recommended.length > 0) {
    lines.push('**Recommended (would improve strategy):**');
    for (const field of recommended) {
      lines.push(`- ${field.label}`);
    }
    lines.push('');
  }

  lines.push('Please note these gaps in your recommendations and suggest what information would help.');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Canonical Value Instructions
// ============================================================================

/**
 * Generate instructions for respecting canonical context values
 *
 * These instructions ensure the LLM doesn't rephrase or modify
 * key business facts that have been canonically confirmed.
 */
export function generateCanonicalValueInstructions(): string {
  return `## Instructions for Using Canonical Context

When generating strategy, adhere to these rules for canonical context:

1. **Positioning Statement**: Use exactly as provided. Do not rephrase, summarize, or "improve" the positioning. It has been carefully crafted.

2. **ICP / Target Audience**: Reference the confirmed ICP description directly. Do not expand or modify the audience definition.

3. **Value Proposition**: Quote or paraphrase minimally. The value proposition is canonical - do not invent new differentiators.

4. **Business Model**: Use the exact business model description. Do not infer additional business model characteristics.

5. **Constraints**: Respect all stated constraints (budget, compliance, channel restrictions) without suggesting workarounds.

6. **Competitors**: Only reference competitors mentioned in the context. Do not add competitors from general knowledge.

**Why this matters:** The canonical context represents verified business facts. Modifying them undermines the human review process and creates inconsistency between strategy and confirmed context.

If you need to make inferences beyond the canonical context, explicitly flag them as assumptions:
> "Based on the provided positioning, I'm assuming [X]. Please confirm."
`;
}

// ============================================================================
// Combined Prompt Helper
// ============================================================================

/**
 * Generate complete context quality block for strategy prompts
 */
export function generateStrategyContextBlock(
  meta: StrategyInputsMeta,
  missingFields: MissingField[] = []
): string {
  const sections: string[] = [];

  // Add preamble
  sections.push(generateContextQualityPreamble(meta));

  // Add missing context notice if applicable
  if (missingFields.length > 0) {
    sections.push(generateMissingContextNotice(missingFields));
  }

  // Add canonical value instructions for confirmed-only mode
  if (meta.confirmedOnlyMode) {
    sections.push(generateCanonicalValueInstructions());
  }

  return sections.join('\n');
}

// ============================================================================
// Snapshot Reference for UI
// ============================================================================

/**
 * Generate a human-readable snapshot reference for UI display
 */
export function formatSnapshotReference(snapshotId: string | null): string {
  if (!snapshotId) {
    return 'Generated from current context (no snapshot)';
  }

  // Format: snap_xxxx -> Snapshot xxxx
  const shortId = snapshotId.replace(/^snap_/, '').slice(0, 8);
  return `Generated from Canonical Context Snapshot ${shortId}`;
}

// ============================================================================
// Provenance-Aware Guardrails (V11+)
// ============================================================================

/**
 * Generate provenance-aware AI guardrails
 *
 * V11+: Labs are optional. Manual context is authoritative but unverified.
 * These guardrails ensure AI respects the difference between sources.
 */
export function generateProvenanceGuardrails(stats?: ProvenanceStats): string {
  const lines: string[] = [];

  lines.push('## Context Provenance Guardrails');
  lines.push('');
  lines.push('Follow these rules when using context:');
  lines.push('');
  lines.push('1. **User-confirmed values are authoritative**: Treat confirmed context as ground truth.');
  lines.push('   Do not contradict, modify, or "improve" confirmed positioning, ICP, or value propositions.');
  lines.push('');
  lines.push('2. **Manual entries are authoritative but unverified**: User-entered context represents');
  lines.push('   what they know about their business. Treat as fact, even without lab evidence.');
  lines.push('');
  lines.push('3. **AI proposals require caution**: Unconfirmed AI proposals are working assumptions.');
  lines.push('   Flag when recommendations rely heavily on unconfirmed context.');
  lines.push('');
  lines.push('4. **Never invent missing context**: If key information is missing, ask for it or');
  lines.push('   proceed with explicit assumptions labeled as such. Example:');
  lines.push("   > \"I'm assuming your target market is [X]. Please confirm.\"");
  lines.push('');
  lines.push('5. **Do not overwrite user decisions**: If a user has manually entered or confirmed');
  lines.push('   a value, do not suggest changing it unless they explicitly ask.');
  lines.push('');
  lines.push('6. **Prefer confirmed over proposed**: When context has both confirmed and proposed');
  lines.push('   values for the same field, use the confirmed value.');
  lines.push('');

  if (stats) {
    lines.push('**Context Source Breakdown:**');
    lines.push(`- User-entered: ${stats.user} fields`);
    lines.push(`- Lab-extracted: ${stats.lab} fields`);
    lines.push(`- Confirmed: ${stats.confirmed} fields`);
    if (stats.aiProposal > 0) {
      lines.push(`- Pending review: ${stats.aiProposal} proposals`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate minimal context instruction when context is sparse
 *
 * V11+: Even with no labs, users can proceed. This guides AI when context is limited.
 */
export function generateSparseContextInstructions(): string {
  return `## Working with Limited Context

You have limited confirmed context to work with. Follow these guidelines:

1. **Be explicit about assumptions**: When you must make assumptions, clearly label them:
   > "Assumption: Based on your industry, I'm assuming [X]."

2. **Focus on what you know**: Base recommendations on the context you have, not general knowledge.

3. **Suggest what would help**: If critical context is missing, note what information would improve recommendations:
   > "To refine this recommendation, it would help to know your target audience demographics."

4. **Avoid generic advice**: Don't fall back to industry-generic recommendations just to fill gaps.
   It's better to say "more context needed" than to provide unhelpful generalities.

5. **Quality over quantity**: A focused strategy based on limited but confirmed context is better
   than a comprehensive strategy built on guesses.
`;
}

/**
 * Generate strategy generation preamble that respects provenance
 *
 * This is the main function to call when generating strategy prompts.
 * It combines context quality, provenance, and any missing field notices.
 */
export function generateStrategyPromptPreamble(
  meta: StrategyInputsMeta,
  options?: {
    missingFields?: MissingField[];
    provenanceStats?: ProvenanceStats;
    isSparseContext?: boolean;
  }
): string {
  const { missingFields = [], provenanceStats, isSparseContext = false } = options || {};
  const sections: string[] = [];

  // Add context quality preamble
  sections.push(generateContextQualityPreamble(meta));

  // Add provenance guardrails
  sections.push(generateProvenanceGuardrails(provenanceStats));

  // Add sparse context instructions if applicable
  if (isSparseContext) {
    sections.push(generateSparseContextInstructions());
  }

  // Add missing context notice if applicable
  if (missingFields.length > 0) {
    sections.push(generateMissingContextNotice(missingFields));
  }

  // Add canonical value instructions for confirmed-only mode
  if (meta.confirmedOnlyMode) {
    sections.push(generateCanonicalValueInstructions());
  }

  return sections.join('\n');
}
