// lib/os/strategy/prompts/contextQualityPrompt.ts
// Context Quality Prompts for LLM Strategy Generation
//
// Generates context quality preambles and instructions for LLMs
// to ensure strategy generation respects canonical context values.

import type { StrategyInputsMeta } from '../strategyInputsHelpers';

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
