// lib/gap-heavy/brandStrategistView.ts
// Generate Brand Strategist View - Narrative Analysis Grounded in Evidence

import { openai } from '@/lib/openai';
import type { BrandEvidence, DiagnosticModuleResult } from './types';

/**
 * Generate Brand Strategist View
 *
 * Creates a narrative, subjective interpretation of the brand strictly grounded
 * in the provided evidence and raw snippets. This is a senior brand strategist's
 * perspective based only on observable data.
 *
 * @param brandEvidence - Brand evidence from the diagnostic
 * @param brandModuleResult - Diagnostic module result
 * @returns Brand strategist narrative (2-3 paragraphs) or null if generation fails
 */
export async function generateBrandStrategistView(
  brandEvidence: BrandEvidence,
  brandModuleResult: DiagnosticModuleResult
): Promise<string | null> {
  try {
    console.log('[Brand Strategist View] Generating narrative analysis...');

    // Extract raw snippets
    const rawSnippets = brandEvidence.rawSnippets || {};

    // Build evidence summary for the prompt
    const evidenceSummary = buildEvidenceSummary(brandEvidence, brandModuleResult);

    // Build snippets section
    const snippetsText = buildSnippetsText(rawSnippets);

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3, // Lower temperature for more grounded, consistent analysis
      max_tokens: 600, // ~2-3 paragraphs
      messages: [
        {
          role: 'system',
          content: BRAND_STRATEGIST_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildUserPrompt(evidenceSummary, snippetsText),
        },
      ],
    });

    const narrative = response.choices[0]?.message?.content?.trim();

    if (!narrative) {
      console.warn('[Brand Strategist View] No narrative generated');
      return null;
    }

    console.log('[Brand Strategist View] Narrative generated successfully');
    return narrative;
  } catch (error) {
    console.error('[Brand Strategist View] Failed to generate narrative:', error);
    return null;
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const BRAND_STRATEGIST_SYSTEM_PROMPT = `You are a senior brand strategist analyzing a company's brand positioning based ONLY on concrete evidence from their website.

Your role:
- Provide a narrative interpretation of their brand positioning and messaging
- Base ALL judgments on the evidence provided - do not guess or assume
- Highlight brand clarity (what they do / for whom), positioning strength, emotional tone, and credibility
- Explicitly reference the raw copy snippets where relevant
- Be specific and direct - avoid generic platitudes like "could benefit from improvements"

Guidelines:
- Write 2-3 tight, analytical paragraphs
- Use specific language: "The hero copy states..." not "They seem to..."
- Call out both strengths and weaknesses with evidence
- Reference actual copy when making claims (e.g., "The tagline 'X' suggests...")
- Assess credibility based on visible trust signals only
- Do not make recommendations - focus on analysis

Style:
- Professional, direct tone
- Third person ("The brand...", "Their positioning...")
- Concrete observations over abstract assessments`;

// ============================================================================
// Prompt Builders
// ============================================================================

function buildEvidenceSummary(
  evidence: BrandEvidence,
  moduleResult: DiagnosticModuleResult
): string {
  const parts: string[] = [];

  // Core Positioning
  parts.push('## Core Positioning');
  if (evidence.primaryTagline) {
    parts.push(`- Primary Tagline: "${evidence.primaryTagline}"`);
  }
  if (evidence.supportingSubheadline) {
    parts.push(`- Supporting Subheadline: "${evidence.supportingSubheadline}"`);
  }
  if (evidence.valuePropositionSummary) {
    parts.push(`- Value Proposition: ${evidence.valuePropositionSummary}`);
  }

  // Clarity Indicators
  parts.push('');
  parts.push('## Clarity Indicators');
  parts.push(`- Audience Clarity: ${evidence.audienceClarityLevel.replace('_', ' ')}`);
  parts.push(`- Differentiation: ${evidence.differentiationLevel}`);

  // Trust & Proof
  parts.push('');
  parts.push('## Trust Signals');
  parts.push(`- Social Proof Density: ${evidence.socialProofDensity || 'none'}`);
  parts.push(`- Trust Signals Present: ${evidence.trustSignalsPresent ? 'Yes' : 'No'}`);
  if (evidence.trustSignalsExamples && evidence.trustSignalsExamples.length > 0) {
    parts.push(`- Examples: ${evidence.trustSignalsExamples.slice(0, 3).join(', ')}`);
  }

  // Tone
  if (evidence.toneDescriptors && evidence.toneDescriptors.length > 0) {
    parts.push('');
    parts.push('## Tone & Voice');
    parts.push(`- Detected Tones: ${evidence.toneDescriptors.join(', ')}`);
  }

  // Diagnostics Score
  parts.push('');
  parts.push('## Diagnostic Score');
  parts.push(`- Overall Brand Score: ${moduleResult.score || 'N/A'}/100`);

  return parts.join('\n');
}

function buildSnippetsText(rawSnippets: {
  heroText?: string;
  aboutSnippet?: string;
  solutionsSnippet?: string;
}): string {
  const parts: string[] = [];

  parts.push('## Raw Copy Snippets');
  parts.push('');

  if (rawSnippets.heroText) {
    parts.push('### Hero Section');
    parts.push(`"${rawSnippets.heroText}"`);
    parts.push('');
  }

  if (rawSnippets.aboutSnippet) {
    parts.push('### About Section');
    parts.push(`"${rawSnippets.aboutSnippet}"`);
    parts.push('');
  }

  if (rawSnippets.solutionsSnippet) {
    parts.push('### Solutions/Services Section');
    parts.push(`"${rawSnippets.solutionsSnippet}"`);
    parts.push('');
  }

  if (!rawSnippets.heroText && !rawSnippets.aboutSnippet && !rawSnippets.solutionsSnippet) {
    parts.push('(No raw snippets available)');
  }

  return parts.join('\n');
}

function buildUserPrompt(evidenceSummary: string, snippetsText: string): string {
  return `Analyze this brand's positioning and messaging based on the evidence below.

Provide a 2-3 paragraph narrative interpretation that:
1. Assesses brand clarity: what they do and for whom (reference actual copy)
2. Evaluates positioning strength vs generic category noise
3. Describes the emotional tone and personality conveyed
4. Judges credibility based on visible trust signals

Be specific. Reference the actual copy snippets. Call out both strengths and gaps directly.

---

${evidenceSummary}

---

${snippetsText}

---

Write your analysis now (2-3 paragraphs):`;
}
