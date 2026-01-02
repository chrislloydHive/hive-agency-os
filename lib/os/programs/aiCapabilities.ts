// lib/os/programs/aiCapabilities.ts
// AI Capabilities and Boundaries for Program Operations
//
// Defines what AI can and cannot do within the Program system.
// This ensures human oversight for critical operations while
// allowing AI to assist with routine tasks.
//
// Capability Levels:
// - ALLOWED: AI can perform autonomously
// - REQUIRES_APPROVAL: AI can propose, human must approve
// - NEVER_ALLOWED: AI cannot perform under any circumstances

import type { AICapability } from '@/lib/types/programTemplate';
import type { PlanningProgram, PlanningProgramStatus } from '@/lib/types/program';

// ============================================================================
// Capability Definitions
// ============================================================================

export type CapabilityLevel = 'allowed' | 'requires_approval' | 'never_allowed';

export interface CapabilityDefinition {
  id: string;
  name: string;
  level: CapabilityLevel;
  description: string;
  scope: 'program' | 'work' | 'artifact' | 'global';
}

/**
 * All AI capabilities with their permission levels
 */
export const AI_CAPABILITIES: CapabilityDefinition[] = [
  // ============================================================================
  // ALLOWED - AI can perform autonomously
  // ============================================================================
  {
    id: 'draft_deliverables',
    name: 'Draft Deliverables',
    level: 'allowed',
    description: 'Generate draft content for program deliverables',
    scope: 'program',
  },
  {
    id: 'propose_optimizations',
    name: 'Propose Optimizations',
    level: 'allowed',
    description: 'Suggest improvements to program structure, deliverables, or approach',
    scope: 'program',
  },
  {
    id: 'summarize_learnings',
    name: 'Summarize Learnings',
    level: 'allowed',
    description: 'Generate summaries of program outcomes and learnings',
    scope: 'program',
  },
  {
    id: 'prepare_qbr_narrative',
    name: 'Prepare QBR Narrative',
    level: 'allowed',
    description: 'Generate quarterly business review narratives and reports',
    scope: 'program',
  },
  {
    id: 'analyze_performance',
    name: 'Analyze Performance',
    level: 'allowed',
    description: 'Analyze program metrics and generate insights',
    scope: 'program',
  },
  {
    id: 'suggest_kpis',
    name: 'Suggest KPIs',
    level: 'allowed',
    description: 'Recommend KPIs based on program goals and domain',
    scope: 'program',
  },
  {
    id: 'draft_work_items',
    name: 'Draft Work Items',
    level: 'allowed',
    description: 'Generate draft work item descriptions and acceptance criteria',
    scope: 'work',
  },
  {
    id: 'generate_brief',
    name: 'Generate Brief',
    level: 'allowed',
    description: 'Create creative or strategic briefs for artifacts',
    scope: 'artifact',
  },

  // ============================================================================
  // REQUIRES_APPROVAL - AI can propose, human must approve
  // ============================================================================
  {
    id: 'create_work_item',
    name: 'Create Work Item',
    level: 'requires_approval',
    description: 'Create new work items within a program',
    scope: 'work',
  },
  {
    id: 'modify_scope',
    name: 'Modify Scope',
    level: 'requires_approval',
    description: 'Change program scope, deliverables, or workstreams',
    scope: 'program',
  },
  {
    id: 'update_status',
    name: 'Update Status',
    level: 'requires_approval',
    description: 'Change program or work item status',
    scope: 'program',
  },
  {
    id: 'commit_program',
    name: 'Commit Program',
    level: 'requires_approval',
    description: 'Transition program from draft/ready to committed',
    scope: 'program',
  },
  {
    id: 'archive_program',
    name: 'Archive Program',
    level: 'requires_approval',
    description: 'Archive a program (soft delete)',
    scope: 'program',
  },
  {
    id: 'link_artifact',
    name: 'Link Artifact',
    level: 'requires_approval',
    description: 'Link artifacts to programs or work items',
    scope: 'artifact',
  },
  {
    id: 'publish_artifact',
    name: 'Publish Artifact',
    level: 'requires_approval',
    description: 'Publish or finalize artifacts',
    scope: 'artifact',
  },

  // ============================================================================
  // NEVER_ALLOWED - AI cannot perform under any circumstances
  // ============================================================================
  {
    id: 'add_program',
    name: 'Add Program',
    level: 'never_allowed',
    description: 'Create new programs outside of bundle instantiation',
    scope: 'global',
  },
  {
    id: 'change_pricing',
    name: 'Change Pricing',
    level: 'never_allowed',
    description: 'Modify any pricing or margin information',
    scope: 'global',
  },
  {
    id: 'bypass_scope',
    name: 'Bypass Scope',
    level: 'never_allowed',
    description: 'Create work outside of scope-enforced programs',
    scope: 'program',
  },
  {
    id: 'delete_program',
    name: 'Delete Program',
    level: 'never_allowed',
    description: 'Permanently delete a program',
    scope: 'program',
  },
  {
    id: 'modify_template',
    name: 'Modify Template',
    level: 'never_allowed',
    description: 'Change program template definitions',
    scope: 'global',
  },
  {
    id: 'change_bundle',
    name: 'Change Bundle',
    level: 'never_allowed',
    description: 'Modify bundle assignments or intensity',
    scope: 'global',
  },
  {
    id: 'access_financials',
    name: 'Access Financials',
    level: 'never_allowed',
    description: 'Access or display financial/pricing information',
    scope: 'global',
  },
];

// ============================================================================
// Capability Lookups
// ============================================================================

const CAPABILITY_MAP = new Map(AI_CAPABILITIES.map((c) => [c.id, c]));

/**
 * Get a capability definition by ID
 */
export function getCapability(id: string): CapabilityDefinition | undefined {
  return CAPABILITY_MAP.get(id);
}

/**
 * Check if AI is allowed to perform an action
 */
export function isActionAllowed(capabilityId: string): boolean {
  const capability = CAPABILITY_MAP.get(capabilityId);
  return capability?.level === 'allowed';
}

/**
 * Check if an action requires approval
 */
export function requiresApproval(capabilityId: string): boolean {
  const capability = CAPABILITY_MAP.get(capabilityId);
  return capability?.level === 'requires_approval';
}

/**
 * Check if an action is never allowed
 */
export function isNeverAllowed(capabilityId: string): boolean {
  const capability = CAPABILITY_MAP.get(capabilityId);
  return capability?.level === 'never_allowed';
}

/**
 * Get all capabilities at a specific level
 */
export function getCapabilitiesByLevel(level: CapabilityLevel): CapabilityDefinition[] {
  return AI_CAPABILITIES.filter((c) => c.level === level);
}

/**
 * Get all capabilities for a scope
 */
export function getCapabilitiesByScope(scope: CapabilityDefinition['scope']): CapabilityDefinition[] {
  return AI_CAPABILITIES.filter((c) => c.scope === scope);
}

// ============================================================================
// Action Validation
// ============================================================================

export interface ActionValidation {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  capability?: CapabilityDefinition;
}

/**
 * Validate if an AI action is permitted
 */
export function validateAction(capabilityId: string): ActionValidation {
  const capability = CAPABILITY_MAP.get(capabilityId);

  if (!capability) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Unknown capability: ${capabilityId}`,
    };
  }

  switch (capability.level) {
    case 'allowed':
      return {
        allowed: true,
        requiresApproval: false,
        capability,
      };
    case 'requires_approval':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Action "${capability.name}" requires human approval`,
        capability,
      };
    case 'never_allowed':
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Action "${capability.name}" is not permitted for AI`,
        capability,
      };
  }
}

// ============================================================================
// Program-Specific Capability Checks
// ============================================================================

/**
 * Check if AI can perform an action on a specific program
 */
export function canPerformActionOnProgram(
  capabilityId: string,
  program: PlanningProgram
): ActionValidation {
  const baseValidation = validateAction(capabilityId);

  if (!baseValidation.allowed) {
    return baseValidation;
  }

  // Additional checks based on program state
  if (program.status === 'archived') {
    return {
      allowed: false,
      requiresApproval: false,
      reason: 'Cannot perform actions on archived programs',
      capability: baseValidation.capability,
    };
  }

  // Committed programs have stricter rules
  if (program.status === 'committed') {
    const restrictedForCommitted = ['modify_scope', 'update_status'];
    if (restrictedForCommitted.includes(capabilityId)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Cannot modify committed programs without rollback',
        capability: baseValidation.capability,
      };
    }
  }

  return baseValidation;
}

// ============================================================================
// Capability Summary for UI
// ============================================================================

export interface CapabilitySummary {
  allowed: string[];
  requiresApproval: string[];
  neverAllowed: string[];
}

/**
 * Get a summary of AI capabilities for display
 */
export function getCapabilitySummary(): CapabilitySummary {
  return {
    allowed: getCapabilitiesByLevel('allowed').map((c) => c.name),
    requiresApproval: getCapabilitiesByLevel('requires_approval').map((c) => c.name),
    neverAllowed: getCapabilitiesByLevel('never_allowed').map((c) => c.name),
  };
}

/**
 * Convert to AICapability format for API responses
 */
export function toAICapabilityList(): AICapability[] {
  return AI_CAPABILITIES.map((c) => ({
    id: c.id,
    name: c.name,
    allowed: c.level !== 'never_allowed',
    requiresApproval: c.level === 'requires_approval',
    description: c.description,
  }));
}

// ============================================================================
// Prompt Helpers for AI
// ============================================================================

/**
 * Generate capability instructions for AI prompts
 */
export function generateCapabilityInstructions(): string {
  const allowed = getCapabilitiesByLevel('allowed');
  const requiresApproval = getCapabilitiesByLevel('requires_approval');
  const neverAllowed = getCapabilitiesByLevel('never_allowed');

  const lines: string[] = [];

  lines.push('## AI Capability Boundaries');
  lines.push('');
  lines.push('You must operate within these boundaries when assisting with Programs:');
  lines.push('');
  lines.push('### Actions You Can Perform Autonomously');
  for (const cap of allowed) {
    lines.push(`- **${cap.name}**: ${cap.description}`);
  }
  lines.push('');
  lines.push('### Actions Requiring Human Approval');
  lines.push('You may propose these actions, but the user must approve before execution:');
  for (const cap of requiresApproval) {
    lines.push(`- **${cap.name}**: ${cap.description}`);
  }
  lines.push('');
  lines.push('### Actions You Must Never Perform');
  lines.push('Do not attempt these actions under any circumstances:');
  for (const cap of neverAllowed) {
    lines.push(`- **${cap.name}**: ${cap.description}`);
  }
  lines.push('');

  return lines.join('\n');
}
