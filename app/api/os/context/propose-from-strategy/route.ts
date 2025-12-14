// app/api/os/context/propose-from-strategy/route.ts
// Hard-Gate API: Strategy → Context Proposals
//
// DOCTRINE: Strategy can NEVER create or store context directly.
// All context from Strategy MUST go through this endpoint as proposals.
//
// Two modes:
// 1. Direct proposals: Strategy provides values directly (mode: 'direct')
// 2. AI-generated: Strategy requests AI to propose values (mode: 'ai' or default)
//
// Server-Side Enforcement:
// 1. Reject keys not in registry
// 2. Always write as status='proposed'
// 3. Dedupe: Skip identical confirmed values
// 4. Track provenance for audit trail

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import {
  saveProposalBatch,
  createProposalBatch,
} from '@/lib/contextGraph/nodes/proposalStorage';
import {
  proposeContextFromStrategy,
  isValidRegistryKey,
  type StrategyContextProposal,
  type StrategyProposalProvenance,
} from '@/lib/contextGraph/nodes';
import {
  getRegistryEntry,
  resolveContextValue,
  type ContextStrategyField,
} from '@/lib/os/registry';

export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

/**
 * Mode 'ai': Request AI to generate proposals for specific keys
 */
interface AIProposalRequest {
  companyId: string;
  mode?: 'ai';
  /** Which fields to propose values for (registry keys) */
  keys: string[];
  /** Optional strategy artifact ID for provenance */
  strategyArtifactId?: string;
  /** Optional additional context from strategy */
  strategyContext?: {
    objectives?: string[];
    constraints?: string[];
    insights?: string[];
  };
}

/**
 * Mode 'direct': Strategy provides values directly (still creates proposals, not confirmed)
 */
interface DirectProposalRequest {
  companyId: string;
  mode: 'direct';
  /** Direct proposals with values */
  proposals: StrategyContextProposal[];
  /** Provenance tracking */
  provenance: StrategyProposalProvenance;
}

type ProposeFromStrategyRequest = AIProposalRequest | DirectProposalRequest;

interface FieldProposal {
  key: string;
  label: string;
  proposedValue: unknown;
  currentValue: unknown | null;
  reasoning: string;
  confidence: number;
}

// ============================================================================
// System Prompt
// ============================================================================

function buildSystemPrompt(fields: ContextStrategyField[]): string {
  const fieldDescriptions = fields.map(f => {
    let desc = `- ${f.key}: ${f.label}`;
    if (f.aiPromptHint) {
      desc += ` (${f.aiPromptHint})`;
    }
    if (f.valueType === 'string[]') {
      desc += ' [array of strings]';
    }
    return desc;
  }).join('\n');

  return `
You are the Context Proposal Engine for Hive OS.

Your job is to propose values for MISSING context fields based on available company information.

STRICT RULES:
1. ONLY propose values for fields you have reasonable evidence for.
2. Use ONLY information provided in the input. Do not invent details.
3. If you cannot determine a value confidently, set it to null.
4. Include clear reasoning for each proposal.
5. Confidence should reflect how certain you are (0.0-1.0).

FIELDS TO PROPOSE:
${fieldDescriptions}

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "proposals": [
    {
      "key": "<field key>",
      "proposedValue": <the proposed value (string, array, or object)>,
      "reasoning": "<why you propose this value>",
      "confidence": <0.0 to 1.0>
    }
  ]
}

Only include fields you can propose with confidence > 0.5.
`.trim();
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ProposeFromStrategyRequest;

    // =========================================================================
    // MODE: DIRECT - Strategy provides values directly
    // =========================================================================
    if (body.mode === 'direct') {
      const { companyId, proposals, provenance } = body;

      if (!companyId) {
        return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
      }
      if (!proposals || proposals.length === 0) {
        return NextResponse.json({ error: 'Missing proposals array' }, { status: 400 });
      }
      if (!provenance) {
        return NextResponse.json({ error: 'Missing provenance' }, { status: 400 });
      }

      console.log(`[propose-from-strategy] ========================================`);
      console.log(`[propose-from-strategy] DIRECT MODE: Strategy → Context Proposals`);
      console.log(`[propose-from-strategy] companyId: ${companyId}`);
      console.log(`[propose-from-strategy] proposals: ${proposals.length}`);
      console.log(`[propose-from-strategy] createdBy: ${provenance.createdBy}`);
      console.log(`[propose-from-strategy] ========================================`);

      // Validate all keys exist in registry
      for (const p of proposals) {
        if (!isValidRegistryKey(p.key)) {
          return NextResponse.json({
            error: `Invalid registry key: ${p.key}`,
            message: 'All proposal keys must exist in the context registry',
          }, { status: 400 });
        }
      }

      // Use the hard-gate function
      const result = await proposeContextFromStrategy(companyId, proposals, provenance);

      return NextResponse.json({
        success: true,
        mode: 'direct',
        proposalBatchId: result.proposalBatchId,
        pendingCount: result.pendingCount,
        proposals: result.createdProposals,
        requiresUserApproval: true,
        message: result.pendingCount > 0
          ? `Created ${result.pendingCount} context proposals. Review in Context Map.`
          : 'No new proposals created (values already confirmed or identical).',
      });
    }

    // =========================================================================
    // MODE: AI - Request AI to generate proposals
    // =========================================================================
    const { companyId, keys, strategyArtifactId, strategyContext } = body as AIProposalRequest;

    // Validation
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }
    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'Missing keys array' }, { status: 400 });
    }

    // Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Load context graph for current values
    const graph = await loadContextGraph(companyId);

    // Validate keys and resolve current values
    const validFields: ContextStrategyField[] = [];
    const currentValues: Record<string, unknown> = {};

    for (const key of keys) {
      const field = getRegistryEntry(key);
      if (!field) {
        console.warn(`[propose-from-strategy] Unknown field key: ${key}`);
        continue;
      }
      if (!field.aiProposable) {
        console.warn(`[propose-from-strategy] Field ${key} is not AI-proposable`);
        continue;
      }
      validFields.push(field);

      // Get current value
      const resolved = await resolveContextValue(companyId, key, graph);
      currentValues[key] = resolved.value;
    }

    if (validFields.length === 0) {
      return NextResponse.json({
        error: 'No valid proposable fields',
        message: 'All requested keys are either unknown or not AI-proposable',
      }, { status: 400 });
    }

    // Build AI input context
    const aiInput = {
      companyName: company.name ?? '',
      domain: company.domain ?? company.website ?? '',
      currentContext: currentValues,
      strategyContext: strategyContext || {},
      requestedFields: validFields.map(f => ({
        key: f.key,
        label: f.label,
        currentValue: currentValues[f.key] ?? null,
      })),
    };

    // Call OpenAI
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(validFields) },
        {
          role: 'user',
          content: `Propose values for the missing context fields.\n\nCompany: ${aiInput.companyName}\nDomain: ${aiInput.domain}\n\nCurrent Context:\n${JSON.stringify(aiInput.currentContext, null, 2)}\n\nStrategy Context:\n${JSON.stringify(aiInput.strategyContext, null, 2)}\n\nFields to propose:\n${JSON.stringify(aiInput.requestedFields, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: { proposals?: Array<{ key: string; proposedValue: unknown; reasoning: string; confidence: number }> };

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('[propose-from-strategy] Failed to parse AI response:', raw);
      return NextResponse.json(
        { error: 'AI returned invalid JSON', raw },
        { status: 500 }
      );
    }

    if (!parsed.proposals || parsed.proposals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'AI could not propose values with sufficient confidence',
        proposals: [],
        batchId: null,
      });
    }

    // Build proposal batch
    const fieldProposals: FieldProposal[] = [];
    for (const aiProposal of parsed.proposals) {
      const field = validFields.find(f => f.key === aiProposal.key);
      if (!field) continue;

      // Skip low confidence
      if (aiProposal.confidence < 0.5) continue;

      // Skip if value is null
      if (aiProposal.proposedValue === null || aiProposal.proposedValue === undefined) continue;

      fieldProposals.push({
        key: field.key,
        label: field.label,
        proposedValue: aiProposal.proposedValue,
        currentValue: currentValues[field.key] ?? null,
        reasoning: aiProposal.reasoning,
        confidence: aiProposal.confidence,
      });
    }

    if (fieldProposals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No proposals met confidence threshold',
        proposals: [],
        batchId: null,
      });
    }

    // Create proposal batch using the proposal storage
    const batch = createProposalBatch(
      companyId,
      fieldProposals.map(p => ({
        fieldPath: p.key,
        fieldLabel: p.label,
        proposedValue: p.proposedValue,
        currentValue: p.currentValue,
        reasoning: p.reasoning,
        confidence: p.confidence,
      })),
      'strategy_gap',
      `Strategy requested proposals for ${fieldProposals.length} fields`,
      strategyArtifactId
    );

    // Save to Airtable
    const saved = await saveProposalBatch(batch);

    if (!saved) {
      console.error('[propose-from-strategy] Failed to save proposal batch');
      // Still return the proposals - they can be reviewed locally
    }

    console.log(`[propose-from-strategy] Created batch ${batch.id} with ${fieldProposals.length} proposals`);

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      proposals: batch.proposals.map(p => ({
        id: p.id,
        key: p.fieldPath,
        label: p.fieldLabel,
        proposedValue: p.proposedValue,
        currentValue: p.currentValue,
        reasoning: p.reasoning,
        confidence: p.confidence,
        status: p.status,
      })),
      proposalCount: batch.proposals.length,
      savedToAirtable: !!saved,
    });
  } catch (error) {
    console.error('[API] propose-from-strategy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proposal generation failed' },
      { status: 500 }
    );
  }
}
