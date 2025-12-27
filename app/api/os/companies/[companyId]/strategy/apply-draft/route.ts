// app/api/os/companies/[companyId]/strategy/apply-draft/route.ts
// Apply a draft to the canonical strategy record
//
// WHY: Single chokepoint for AI → canonical writes.
// This ensures: (1) user must explicitly approve, (2) provenance is tracked,
// (3) stale drafts are rejected unless force-applied.
//
// This is the ONLY path for AI-generated content to become canonical.
// Writes include provenance tracking for audit and staleness detection.

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, updateStrategy } from '@/lib/os/strategy';
import {
  getDraft,
  deleteDraft,
  type DraftScopeType,
  type StrategyDraft,
} from '@/lib/os/strategy/drafts';
import { computeAllHashes, type StrategyHashes } from '@/lib/os/strategy/hashes';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { StrategyPillar, StrategyObjective, StrategyPlay } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface ApplyDraftRequest {
  strategyId: string;
  draftId?: string; // Apply by draft ID
  // OR apply by key
  scopeType?: DraftScopeType;
  fieldKey?: string;
  entityId?: string;
  // Optional: override draft value (for user edits before apply)
  overrideValue?: string;
  // If true, apply even if draft is stale (user explicitly acknowledged)
  forceApply?: boolean;
}

interface ProvenanceRecord {
  generatedByAI: boolean;
  appliedAt: string;
  sourcesUsed: string[];
  confidence: 'high' | 'medium' | 'low';
  basedOnHashes?: {
    contextHash?: string;
    objectivesHash?: string;
    strategyHash?: string;
    tacticsHash?: string;
  };
  originalDraftId: string;
}

// ============================================================================
// POST Handler - Apply Draft
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as ApplyDraftRequest;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    if (!body.strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    // Load strategy
    const strategy = await getStrategyById(body.strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Find the draft to apply
    let draft: StrategyDraft | null = null;

    if (body.draftId) {
      // Load draft by ID - not directly supported, need to search
      // For now, require key-based lookup
      return NextResponse.json(
        { error: 'Draft ID lookup not implemented. Use scopeType/fieldKey/entityId.' },
        { status: 400 }
      );
    }

    if (body.scopeType && body.fieldKey) {
      draft = await getDraft(
        companyId,
        body.strategyId,
        body.scopeType,
        body.fieldKey,
        body.entityId
      );
    }

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    // -------------------------------------------------------------------------
    // STALENESS CHECK: Prevent stale drafts from overwriting newer thinking
    // -------------------------------------------------------------------------
    // Why: AI drafts are generated based on a snapshot of context/objectives/strategy.
    // If those inputs changed since generation, the draft may no longer be appropriate.
    // User must explicitly acknowledge with forceApply=true.
    // -------------------------------------------------------------------------
    if (draft.basedOnHashes && !body.forceApply) {
      const context = await loadContextGraph(companyId);
      const currentHashes = computeAllHashes(
        context,
        strategy.objectives || [],
        {
          title: strategy.title,
          summary: strategy.summary,
          pillars: strategy.pillars,
          strategyFrame: strategy.strategyFrame,
          tradeoffs: strategy.tradeoffs,
        },
        strategy.plays || []
      );

      const staleScopes: string[] = [];

      // Check each hash the draft was based on
      if (draft.basedOnHashes.contextHash &&
          draft.basedOnHashes.contextHash !== currentHashes.contextHash) {
        staleScopes.push('context');
      }
      if (draft.basedOnHashes.objectivesHash &&
          draft.basedOnHashes.objectivesHash !== currentHashes.objectivesHash) {
        staleScopes.push('objectives');
      }
      if (draft.basedOnHashes.strategyHash &&
          draft.basedOnHashes.strategyHash !== currentHashes.strategyHash) {
        staleScopes.push('strategy');
      }
      if (draft.basedOnHashes.tacticsHash &&
          draft.basedOnHashes.tacticsHash !== currentHashes.tacticsHash) {
        staleScopes.push('tactics');
      }

      if (staleScopes.length > 0) {
        return NextResponse.json({
          status: 'stale',
          staleScopes,
          message: `Draft is stale: ${staleScopes.join(', ')} changed since generation. Pass forceApply=true to apply anyway.`,
          draft: {
            scopeType: draft.scopeType,
            fieldKey: draft.fieldKey,
            entityId: draft.entityId,
          },
        }, { status: 409 }); // 409 Conflict
      }
    }

    // Use override value if provided, otherwise use draft value
    const valueToApply = body.overrideValue ?? draft.draftValue;

    // Build provenance record
    const provenance: ProvenanceRecord = {
      generatedByAI: true,
      appliedAt: new Date().toISOString(),
      sourcesUsed: draft.sourcesUsed,
      confidence: draft.confidence,
      basedOnHashes: draft.basedOnHashes,
      originalDraftId: draft.id,
    };

    // Apply the draft based on scope type
    const result = await applyDraftToStrategy(
      strategy,
      draft,
      valueToApply,
      provenance
    );

    // Delete the draft after successful apply
    await deleteDraft(draft.id);

    // Compute new hashes after apply
    const newHashes = computeAllHashes(
      null, // Context not available here, would need to load
      result.strategy.objectives || [],
      {
        title: result.strategy.title,
        summary: result.strategy.summary,
        pillars: result.strategy.pillars,
        strategyFrame: result.strategy.strategyFrame,
        tradeoffs: result.strategy.tradeoffs,
      },
      result.strategy.plays || []
    );

    return NextResponse.json({
      success: true,
      strategy: result.strategy,
      applied: {
        scopeType: draft.scopeType,
        fieldKey: draft.fieldKey,
        entityId: draft.entityId,
        value: valueToApply,
      },
      provenance,
      newHashes,
    });
  } catch (error) {
    console.error('[POST /strategy/apply-draft] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply draft' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Apply Logic
// ============================================================================

async function applyDraftToStrategy(
  strategy: Awaited<ReturnType<typeof getStrategyById>>,
  draft: StrategyDraft,
  value: string,
  provenance: ProvenanceRecord
): Promise<{ strategy: NonNullable<Awaited<ReturnType<typeof getStrategyById>>> }> {
  if (!strategy) {
    throw new Error('Strategy is null');
  }

  const { scopeType, fieldKey, entityId } = draft;
  const now = new Date().toISOString();

  switch (scopeType) {
    case 'frame': {
      // Update strategy frame field
      const currentFrame = strategy.strategyFrame || {};
      const updatedFrame = {
        ...currentFrame,
        [fieldKey]: value,
        [`${fieldKey}_provenance`]: provenance,
      };

      const updated = await updateStrategy({
        strategyId: strategy.id,
        updates: {
          strategyFrame: updatedFrame,
          lastAiUpdatedAt: now,
        },
      });

      return { strategy: updated };
    }

    case 'objective': {
      // Parse the draft value (full objective object)
      let objectiveData: Partial<StrategyObjective>;
      try {
        objectiveData = JSON.parse(value);
      } catch {
        objectiveData = { text: value };
      }

      // If entityId is 'proposed_X', add as new objective
      if (entityId?.startsWith('proposed_')) {
        const newObjective: StrategyObjective = {
          id: `obj_${Date.now()}`,
          text: objectiveData.text || value,
          metric: objectiveData.metric,
          target: objectiveData.target,
          timeframe: objectiveData.timeframe,
          status: 'active',
          provenance,
        };

        const objectives = [...(strategy.objectives || []), newObjective] as StrategyObjective[];

        const updated = await updateStrategy({
          strategyId: strategy.id,
          updates: {
            objectives,
            lastAiUpdatedAt: now,
          },
        });

        return { strategy: updated };
      }

      // Update existing objective
      const objectives = (strategy.objectives || []).map(obj => {
        if (typeof obj === 'string') {
          return obj; // Legacy format
        }
        if (obj.id === entityId) {
          return {
            ...obj,
            [fieldKey]: value,
            provenance,
          };
        }
        return obj;
      }) as StrategyObjective[];

      const updated = await updateStrategy({
        strategyId: strategy.id,
        updates: {
          objectives,
          lastAiUpdatedAt: now,
        },
      });

      return { strategy: updated };
    }

    case 'priority': {
      // Parse the draft value (full priority object)
      let priorityData: Partial<StrategyPillar>;
      try {
        priorityData = JSON.parse(value);
      } catch {
        priorityData = { title: value };
      }

      // If entityId is 'proposed_X', add as new priority
      if (entityId?.startsWith('proposed_')) {
        const newPriority: StrategyPillar = {
          id: `pillar_${Date.now()}`,
          title: priorityData.title || 'New Priority',
          description: priorityData.description || '',
          rationale: priorityData.rationale,
          priority: priorityData.priority || 'medium',
          order: strategy.pillars.length,
          provenance,
        };

        const pillars = [...strategy.pillars, newPriority];

        const updated = await updateStrategy({
          strategyId: strategy.id,
          updates: {
            pillars,
            lastAiUpdatedAt: now,
          },
        });

        return { strategy: updated };
      }

      // Update existing priority
      const pillars = strategy.pillars.map(pillar => {
        if (pillar.id === entityId) {
          if (fieldKey === 'full') {
            // Replace entire pillar
            return {
              ...pillar,
              ...priorityData,
              provenance,
            };
          }
          // Update specific field
          return {
            ...pillar,
            [fieldKey]: value,
            provenance,
          };
        }
        return pillar;
      });

      const updated = await updateStrategy({
        strategyId: strategy.id,
        updates: {
          pillars,
          lastAiUpdatedAt: now,
        },
      });

      return { strategy: updated };
    }

    case 'tactic': {
      // Parse the draft value (full tactic/play object)
      let tacticData: Partial<StrategyPlay>;
      try {
        tacticData = JSON.parse(value);
      } catch {
        tacticData = { title: value };
      }

      // If entityId is 'proposed_X', add as new tactic
      if (entityId?.startsWith('proposed_')) {
        const newPlay: StrategyPlay = {
          id: `play_${Date.now()}`,
          title: tacticData.title || 'New Tactic',
          description: tacticData.description || '',
          status: 'proposed',
          provenance,
        };

        const plays = [...(strategy.plays || []), newPlay];

        const updated = await updateStrategy({
          strategyId: strategy.id,
          updates: {
            plays,
            lastAiUpdatedAt: now,
          },
        });

        return { strategy: updated };
      }

      // Update existing tactic
      const plays = (strategy.plays || []).map(play => {
        if (play.id === entityId) {
          if (fieldKey === 'full') {
            // Replace entire play
            return {
              ...play,
              ...tacticData,
              provenance,
            };
          }
          // Update specific field
          return {
            ...play,
            [fieldKey]: value,
            provenance,
          };
        }
        return play;
      });

      const updated = await updateStrategy({
        strategyId: strategy.id,
        updates: {
          plays,
          lastAiUpdatedAt: now,
        },
      });

      return { strategy: updated };
    }

    case 'strategy': {
      // Update strategy-level fields (title, summary, tradeoffs)
      const updates: Record<string, unknown> = {
        lastAiUpdatedAt: now,
      };

      if (fieldKey === 'title') {
        updates.title = value;
      } else if (fieldKey === 'summary') {
        updates.summary = value;
      } else if (fieldKey === 'tradeoffs') {
        try {
          updates.tradeoffs = JSON.parse(value);
        } catch {
          updates.tradeoffs = { explanation: value };
        }
      }

      const updated = await updateStrategy({
        strategyId: strategy.id,
        updates,
      });

      return { strategy: updated };
    }

    default:
      throw new Error(`Unknown scope type: ${scopeType}`);
  }
}

// ============================================================================
// DELETE Handler - Discard Draft
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);
    const strategyId = url.searchParams.get('strategyId');
    const scopeType = url.searchParams.get('scopeType') as DraftScopeType;
    const fieldKey = url.searchParams.get('fieldKey');
    const entityId = url.searchParams.get('entityId') || undefined;

    if (!companyId || !strategyId || !scopeType || !fieldKey) {
      return NextResponse.json(
        { error: 'companyId, strategyId, scopeType, and fieldKey are required' },
        { status: 400 }
      );
    }

    // Find and delete the draft
    const draft = await getDraft(companyId, strategyId, scopeType, fieldKey, entityId);

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    await deleteDraft(draft.id);

    return NextResponse.json({ success: true, deletedDraftId: draft.id });
  } catch (error) {
    console.error('[DELETE /strategy/apply-draft] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
