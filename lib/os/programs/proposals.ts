// lib/os/programs/proposals.ts
// AI Co-planner Proposal Management
//
// Proposals are AI-generated drafts that require explicit user approval.
// They are stored in memory during a session and discarded after apply/reject.
// This keeps proposals transient and avoids database schema changes.

import type {
  ProgramDraftProposal,
  ProposalType,
  ProposalStatus,
  ProposalPayload,
  ApplyProposalOptions,
  PlanningProgram,
  PlanningProgramPatch,
  ProposedDeliverable,
  ProposedMilestone,
  ProposedKPI,
  FullProgramDraftPayload,
} from '@/lib/types/program';
import {
  generateProposalId,
  validateProposalPayload,
  dedupeDeliverables,
  dedupeMilestones,
  proposedToDeliverable,
  proposedToMilestone,
  proposedToKPI,
} from '@/lib/types/program';

// ============================================================================
// In-Memory Storage
// ============================================================================

// Map of programId -> proposals[]
const proposalStore = new Map<string, ProgramDraftProposal[]>();

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new proposal for a program
 */
export function createProposal(
  programId: string,
  type: ProposalType,
  payload: ProposalPayload,
  instructions?: string
): ProgramDraftProposal {
  const proposal: ProgramDraftProposal = {
    id: generateProposalId(),
    programId,
    type,
    payload,
    instructions,
    createdAt: new Date().toISOString(),
    status: 'proposed',
  };

  const existing = proposalStore.get(programId) || [];
  proposalStore.set(programId, [...existing, proposal]);

  return proposal;
}

/**
 * Get all proposals for a program
 */
export function getProposals(programId: string): ProgramDraftProposal[] {
  return proposalStore.get(programId) || [];
}

/**
 * Get pending (proposed) proposals for a program
 */
export function getPendingProposals(programId: string): ProgramDraftProposal[] {
  const proposals = proposalStore.get(programId) || [];
  return proposals.filter(p => p.status === 'proposed');
}

/**
 * Get a single proposal by ID
 */
export function getProposal(
  programId: string,
  proposalId: string
): ProgramDraftProposal | null {
  const proposals = proposalStore.get(programId) || [];
  return proposals.find(p => p.id === proposalId) || null;
}

/**
 * Update proposal status
 */
function updateProposalStatus(
  programId: string,
  proposalId: string,
  status: ProposalStatus
): ProgramDraftProposal | null {
  const proposals = proposalStore.get(programId) || [];
  const index = proposals.findIndex(p => p.id === proposalId);

  if (index === -1) return null;

  const updated = { ...proposals[index], status };
  if (status === 'applied') {
    updated.appliedAt = new Date().toISOString();
  } else if (status === 'rejected') {
    updated.rejectedAt = new Date().toISOString();
  }

  proposals[index] = updated;
  proposalStore.set(programId, proposals);

  return updated;
}

/**
 * Reject a proposal
 */
export function rejectProposal(
  programId: string,
  proposalId: string
): ProgramDraftProposal | null {
  return updateProposalStatus(programId, proposalId, 'rejected');
}

/**
 * Clear all proposals for a program
 */
export function clearProposals(programId: string): void {
  proposalStore.delete(programId);
}

// ============================================================================
// Apply Logic
// ============================================================================

export interface ApplyResult {
  success: boolean;
  patch: PlanningProgramPatch;
  stats: {
    deliverables: { added: number; skipped: number };
    milestones: { added: number; skipped: number };
    kpis: { added: number; skipped: number };
    summaryUpdated: boolean;
    assumptionsAdded: number;
    constraintsAdded: number;
    dependenciesAdded: number;
    risksAdded: number;
  };
  warnings: string[];
}

/**
 * Build a patch from a proposal that can be applied to a program
 * This does NOT persist anything - caller must use updatePlanningProgram
 */
export function buildPatchFromProposal(
  program: PlanningProgram,
  proposal: ProgramDraftProposal,
  options: ApplyProposalOptions = {}
): ApplyResult {
  const { mergeMode = 'merge' } = options;

  const warnings: string[] = [];
  const stats: ApplyResult['stats'] = {
    deliverables: { added: 0, skipped: 0 },
    milestones: { added: 0, skipped: 0 },
    kpis: { added: 0, skipped: 0 },
    summaryUpdated: false,
    assumptionsAdded: 0,
    constraintsAdded: 0,
    dependenciesAdded: 0,
    risksAdded: 0,
  };

  // Validate payload
  const validation = validateProposalPayload(proposal.type, proposal.payload);
  if (!validation.success) {
    return {
      success: false,
      patch: {},
      stats,
      warnings: [`Invalid payload: ${validation.error}`],
    };
  }

  const patch: PlanningProgramPatch = {};

  switch (proposal.type) {
    case 'deliverables': {
      const proposed = validation.data as ProposedDeliverable[];
      const { added, skipped } = dedupeDeliverables(program.scope.deliverables, proposed);

      stats.deliverables.added = added.length;
      stats.deliverables.skipped = skipped.length;

      if (skipped.length > 0) {
        warnings.push(`Skipped ${skipped.length} duplicate deliverables: ${skipped.join(', ')}`);
      }

      if (added.length > 0) {
        const newDeliverables = added.map(proposedToDeliverable);
        patch.scope = {
          ...program.scope,
          deliverables: mergeMode === 'overwrite'
            ? newDeliverables
            : [...program.scope.deliverables, ...newDeliverables],
        };
      }
      break;
    }

    case 'milestones': {
      const proposed = validation.data as ProposedMilestone[];
      const { added, skipped } = dedupeMilestones(program.planDetails.milestones, proposed);

      stats.milestones.added = added.length;
      stats.milestones.skipped = skipped.length;

      if (skipped.length > 0) {
        warnings.push(`Skipped ${skipped.length} duplicate milestones: ${skipped.join(', ')}`);
      }

      if (added.length > 0) {
        const newMilestones = added.map(proposedToMilestone);
        patch.planDetails = {
          ...program.planDetails,
          milestones: mergeMode === 'overwrite'
            ? newMilestones
            : [...program.planDetails.milestones, ...newMilestones],
        };
      }
      break;
    }

    case 'kpis': {
      const proposed = validation.data as ProposedKPI[];
      const existingKeys = new Set(program.success.kpis.map(k => k.key.toLowerCase()));
      const newKpis = proposed.filter(
        k => !existingKeys.has(k.name.toLowerCase().replace(/\s+/g, '_'))
      );

      stats.kpis.added = newKpis.length;
      stats.kpis.skipped = proposed.length - newKpis.length;

      if (newKpis.length > 0) {
        patch.success = {
          ...program.success,
          kpis: mergeMode === 'overwrite'
            ? newKpis.map(proposedToKPI)
            : [...program.success.kpis, ...newKpis.map(proposedToKPI)],
        };
      }
      break;
    }

    case 'summary': {
      const proposed = validation.data as { oneLiner: string; outcomes: string[]; scopeIn: string[]; scopeOut: string[] };

      // Check if program already has content
      if (program.scope.summary && program.scope.summary.trim().length > 0) {
        warnings.push('Existing summary will be replaced');
      }

      stats.summaryUpdated = true;
      patch.scope = {
        ...program.scope,
        summary: proposed.oneLiner,
        // Store scopeIn/scopeOut in assumptions/constraints for now
        assumptions: mergeMode === 'overwrite'
          ? proposed.scopeIn
          : [...program.scope.assumptions, ...proposed.scopeIn],
        constraints: mergeMode === 'overwrite'
          ? proposed.scopeOut
          : [...program.scope.constraints, ...proposed.scopeOut],
      };
      break;
    }

    case 'risks': {
      // Risks stored as formatted strings in unknowns for now
      const proposed = validation.data as Array<{ risk: string; impact: string; mitigation: string }>;
      const riskStrings = proposed.map(r => `[${r.impact.toUpperCase()}] ${r.risk} — Mitigation: ${r.mitigation}`);

      stats.risksAdded = proposed.length;
      patch.scope = {
        ...program.scope,
        unknowns: mergeMode === 'overwrite'
          ? riskStrings
          : [...program.scope.unknowns, ...riskStrings],
      };
      break;
    }

    case 'dependencies': {
      const proposed = validation.data as Array<{ dependency: string; whyNeeded: string; owner?: string }>;
      const depStrings = proposed.map(d => d.owner
        ? `${d.dependency} (${d.whyNeeded}) — Owner: ${d.owner}`
        : `${d.dependency} (${d.whyNeeded})`
      );

      stats.dependenciesAdded = proposed.length;
      patch.scope = {
        ...program.scope,
        dependencies: mergeMode === 'overwrite'
          ? depStrings
          : [...program.scope.dependencies, ...depStrings],
      };
      break;
    }

    case 'full_program': {
      const full = validation.data as FullProgramDraftPayload;
      const sectionsToApply = options.sections || [
        'summary', 'deliverables', 'milestones', 'kpis', 'risks', 'dependencies'
      ];

      // Start with current values
      const scope = { ...program.scope };
      const planDetails = { ...program.planDetails };
      const success = { ...program.success };

      // Apply summary
      if (sectionsToApply.includes('summary')) {
        if (scope.summary && scope.summary.trim().length > 0) {
          warnings.push('Existing summary will be replaced');
        }
        scope.summary = full.summary.oneLiner;
        stats.summaryUpdated = true;
      }

      // Apply deliverables
      if (sectionsToApply.includes('deliverables')) {
        const { added, skipped } = dedupeDeliverables(scope.deliverables, full.deliverables);
        stats.deliverables.added = added.length;
        stats.deliverables.skipped = skipped.length;
        if (skipped.length > 0) {
          warnings.push(`Skipped ${skipped.length} duplicate deliverables`);
        }
        if (added.length > 0) {
          scope.deliverables = [...scope.deliverables, ...added.map(proposedToDeliverable)];
        }
      }

      // Apply milestones
      if (sectionsToApply.includes('milestones')) {
        const { added, skipped } = dedupeMilestones(planDetails.milestones, full.milestones);
        stats.milestones.added = added.length;
        stats.milestones.skipped = skipped.length;
        if (skipped.length > 0) {
          warnings.push(`Skipped ${skipped.length} duplicate milestones`);
        }
        if (added.length > 0) {
          planDetails.milestones = [...planDetails.milestones, ...added.map(proposedToMilestone)];
        }
      }

      // Apply KPIs
      if (sectionsToApply.includes('kpis')) {
        const existingKeys = new Set(success.kpis.map(k => k.key.toLowerCase()));
        const newKpis = full.kpis.filter(
          k => !existingKeys.has(k.name.toLowerCase().replace(/\s+/g, '_'))
        );
        stats.kpis.added = newKpis.length;
        stats.kpis.skipped = full.kpis.length - newKpis.length;
        success.kpis = [...success.kpis, ...newKpis.map(proposedToKPI)];
      }

      // Apply assumptions/constraints
      stats.assumptionsAdded = full.assumptions.length;
      stats.constraintsAdded = full.constraints.length;
      scope.assumptions = [...scope.assumptions, ...full.assumptions];
      scope.constraints = [...scope.constraints, ...full.constraints];

      // Apply risks
      if (sectionsToApply.includes('risks')) {
        const riskStrings = full.risks.map(r => `[${r.impact.toUpperCase()}] ${r.risk} — ${r.mitigation}`);
        stats.risksAdded = full.risks.length;
        scope.unknowns = [...scope.unknowns, ...riskStrings];
      }

      // Apply dependencies
      if (sectionsToApply.includes('dependencies')) {
        const depStrings = full.dependencies.map(d => d.owner
          ? `${d.dependency} (${d.whyNeeded}) — Owner: ${d.owner}`
          : `${d.dependency} (${d.whyNeeded})`
        );
        stats.dependenciesAdded = full.dependencies.length;
        scope.dependencies = [...scope.dependencies, ...depStrings];
      }

      // Apply scope in/out from summary
      scope.assumptions = [...scope.assumptions, ...full.summary.scopeIn.map(s => `In scope: ${s}`)];
      scope.constraints = [...scope.constraints, ...full.summary.scopeOut.map(s => `Out of scope: ${s}`)];

      patch.scope = scope;
      patch.planDetails = planDetails;
      patch.success = success;
      break;
    }
  }

  return {
    success: true,
    patch,
    stats,
    warnings,
  };
}

/**
 * Apply a proposal and mark it as applied
 * Returns the patch and marks proposal status, but does NOT persist to Airtable
 */
export function applyProposal(
  program: PlanningProgram,
  proposalId: string,
  options: ApplyProposalOptions = {}
): ApplyResult & { proposal: ProgramDraftProposal | null } {
  const proposal = getProposal(program.id, proposalId);

  if (!proposal) {
    return {
      success: false,
      patch: {},
      stats: {
        deliverables: { added: 0, skipped: 0 },
        milestones: { added: 0, skipped: 0 },
        kpis: { added: 0, skipped: 0 },
        summaryUpdated: false,
        assumptionsAdded: 0,
        constraintsAdded: 0,
        dependenciesAdded: 0,
        risksAdded: 0,
      },
      warnings: ['Proposal not found'],
      proposal: null,
    };
  }

  if (proposal.status !== 'proposed') {
    return {
      success: false,
      patch: {},
      stats: {
        deliverables: { added: 0, skipped: 0 },
        milestones: { added: 0, skipped: 0 },
        kpis: { added: 0, skipped: 0 },
        summaryUpdated: false,
        assumptionsAdded: 0,
        constraintsAdded: 0,
        dependenciesAdded: 0,
        risksAdded: 0,
      },
      warnings: [`Proposal already ${proposal.status}`],
      proposal,
    };
  }

  const result = buildPatchFromProposal(program, proposal, options);

  if (result.success) {
    // Mark proposal as applied
    updateProposalStatus(program.id, proposalId, 'applied');
  }

  return {
    ...result,
    proposal: getProposal(program.id, proposalId),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if program has pending proposals
 */
export function hasPendingProposals(programId: string): boolean {
  return getPendingProposals(programId).length > 0;
}

/**
 * Get count of pending proposals by type
 */
export function getPendingProposalCounts(programId: string): Record<ProposalType, number> {
  const proposals = getPendingProposals(programId);
  const counts: Record<ProposalType, number> = {
    deliverables: 0,
    milestones: 0,
    kpis: 0,
    risks: 0,
    dependencies: 0,
    summary: 0,
    full_program: 0,
  };

  for (const p of proposals) {
    counts[p.type]++;
  }

  return counts;
}
