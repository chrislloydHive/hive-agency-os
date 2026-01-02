// lib/os/planning/bundleInstantiation.ts
// Bundle Instantiation Logic
//
// Instantiates Programs from commercial bundle contracts.
// - Accepts bundle scope (domains, intensity, start date)
// - Creates Programs per domain with template configuration
// - Builds deliverables from expected outputs
// - Enforces scope guardrails
//
// IMPORTANT: No pricing or margin data. OS receives SCOPE, not PRICE.

import type {
  BundleInstantiationRequest,
  BundleInstantiationResult,
  ProgramDomain,
  IntensityLevel,
  ExpectedOutput,
  CadenceType,
} from '@/lib/types/programTemplate';
import {
  generateBundleKey,
  generateBundleProgramKey,
} from '@/lib/types/programTemplate';
import type {
  PlanningProgram,
  PlanningProgramInput,
  PlanningDeliverable,
  PlanningMilestone,
  WorkstreamType,
} from '@/lib/types/program';
import {
  generatePlanningDeliverableId,
  generatePlanningMilestoneId,
} from '@/lib/types/program';
import {
  getDomainTemplate,
  getIntensityConfig,
  getMaxConcurrentWork,
  getAllowedWorkstreams,
} from './domainTemplates';
import {
  createPlanningProgram,
  findPlanningProgramByStableKey,
} from '@/lib/airtable/planningPrograms';

// ============================================================================
// Bundle Instantiation
// ============================================================================

/**
 * Instantiate Programs from a bundle contract
 *
 * Creates one Program per domain specified in the request.
 * Programs are created idempotently - if a program with the same
 * stable key exists, it will be skipped.
 */
export async function instantiateBundle(
  request: BundleInstantiationRequest
): Promise<BundleInstantiationResult> {
  const { bundleId, domains, intensity, startDate, companyId, strategyId, titlePrefix } = request;

  const results: BundleInstantiationResult['programs'] = [];
  const errors: string[] = [];

  console.log(`[BundleInstantiation] Starting bundle instantiation:`, {
    bundleId,
    domains: domains.length,
    intensity,
    companyId,
  });

  for (const domain of domains) {
    try {
      const result = await instantiateDomainProgram({
        bundleId,
        domain,
        intensity,
        startDate,
        companyId,
        strategyId,
        titlePrefix,
      });

      results.push(result);

      if (result.status === 'failed') {
        errors.push(result.error || `Failed to create ${domain} program`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${domain}: ${errorMessage}`);
      results.push({
        programId: '',
        domain,
        title: '',
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  const summary = {
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'already_exists').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };

  console.log(`[BundleInstantiation] Completed:`, summary);

  return {
    success: summary.failed === 0,
    bundleId,
    programs: results,
    errors: errors.length > 0 ? errors : undefined,
    summary,
  };
}

// ============================================================================
// Domain Program Instantiation
// ============================================================================

interface DomainProgramRequest {
  bundleId: string;
  domain: ProgramDomain;
  intensity: IntensityLevel;
  startDate: string;
  companyId: string;
  strategyId: string;
  titlePrefix?: string;
}

interface DomainProgramResult {
  programId: string;
  domain: ProgramDomain;
  title: string;
  status: 'created' | 'already_exists' | 'failed';
  error?: string;
}

/**
 * Instantiate a single Program for a domain
 */
async function instantiateDomainProgram(
  request: DomainProgramRequest
): Promise<DomainProgramResult> {
  const { bundleId, domain, intensity, startDate, companyId, strategyId, titlePrefix } = request;

  // Generate stable key for idempotent creation
  const stableKey = generateBundleProgramKey(bundleId, domain);

  // Check if program already exists
  const existing = await findPlanningProgramByStableKey(stableKey);
  if (existing) {
    return {
      programId: existing.id,
      domain,
      title: existing.title,
      status: 'already_exists',
    };
  }

  // Get template for this domain
  const template = getDomainTemplate(domain);
  const intensityConfig = getIntensityConfig(domain, intensity);
  const maxConcurrent = getMaxConcurrentWork(domain, intensity);
  const allowedWorkstreams = getAllowedWorkstreams(domain);

  // Build program title
  const prefix = titlePrefix || '';
  const title = prefix
    ? `${prefix} - ${template.name}`
    : template.name;

  // Build deliverables from expected outputs
  const deliverables = buildDeliverablesFromOutputs(
    template.expectedOutputs,
    intensityConfig.cadence,
    intensity,
    startDate
  );

  // Build milestones based on horizon
  const milestones = buildMilestones(domain, startDate);

  // Create the program input
  const programInput: PlanningProgramInput = {
    companyId,
    strategyId,
    title,
    status: 'draft',
    stableKey,
    origin: {
      strategyId,
      // No tactic link - this is a bundle-instantiated program
    },
    scope: {
      summary: template.description,
      deliverables,
      workstreams: allowedWorkstreams,
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: {
      kpis: template.successSignals.map((signal) => ({
        key: signal.id,
        label: signal.metric,
        target: signal.targetDirection === 'increase' ? 'Increase' :
               signal.targetDirection === 'decrease' ? 'Decrease' : 'Maintain',
        timeframe: signal.measurementFrequency,
      })),
    },
    planDetails: {
      horizonDays: 90, // Standard 90-day program
      milestones,
    },
    commitment: {
      workItemIds: [],
    },
    linkedArtifacts: [],
    workPlanVersion: 0,
    // Template fields
    templateId: template.id,
    domain,
    intensity,
    bundleId,
    scopeEnforced: true, // Bundle programs enforce scope
    maxConcurrentWork: maxConcurrent,
    allowedWorkTypes: allowedWorkstreams,
  };

  // Create the program
  const created = await createPlanningProgram(programInput);

  if (!created) {
    return {
      programId: '',
      domain,
      title,
      status: 'failed',
      error: 'Failed to create program in Airtable',
    };
  }

  return {
    programId: created.id,
    domain,
    title: created.title,
    status: 'created',
  };
}

// ============================================================================
// Deliverable Building
// ============================================================================

/**
 * Build deliverables from expected outputs based on intensity cadence
 */
function buildDeliverablesFromOutputs(
  outputs: ExpectedOutput[],
  activeCadences: CadenceType[],
  intensity: IntensityLevel,
  startDate: string
): PlanningDeliverable[] {
  const deliverables: PlanningDeliverable[] = [];

  for (const output of outputs) {
    // Skip outputs that aren't in the active cadences for this intensity
    if (!activeCadences.includes(output.cadence)) {
      continue;
    }

    // Calculate due date based on cadence
    const dueDate = calculateDueDate(output.cadence, startDate);

    const deliverable: PlanningDeliverable = {
      id: generatePlanningDeliverableId(),
      title: output.name,
      description: output.description || '',
      type: output.deliverableType || 'other',
      status: 'planned',
      workstreamType: output.workstreamType as WorkstreamType,
      dueDate,
    };

    deliverables.push(deliverable);

    // If output scales by cadence and we're on aggressive, add more instances
    if (output.scaledByCadence && intensity === 'Aggressive') {
      // Add one more instance for aggressive intensity
      deliverables.push({
        ...deliverable,
        id: generatePlanningDeliverableId(),
        title: `${output.name} (Additional)`,
        dueDate: calculateDueDate(output.cadence, startDate, 1), // Offset by 1 period
      });
    }
  }

  return deliverables;
}

/**
 * Calculate due date based on cadence and start date
 */
function calculateDueDate(
  cadence: CadenceType,
  startDate: string,
  periodOffset: number = 0
): string {
  const start = new Date(startDate);

  switch (cadence) {
    case 'weekly':
      start.setDate(start.getDate() + 7 * (1 + periodOffset));
      break;
    case 'monthly':
      start.setMonth(start.getMonth() + 1 + periodOffset);
      break;
    case 'quarterly':
      start.setMonth(start.getMonth() + 3 + periodOffset);
      break;
  }

  return start.toISOString().split('T')[0];
}

/**
 * Build standard milestones for a program
 */
function buildMilestones(domain: ProgramDomain, startDate: string): PlanningMilestone[] {
  const start = new Date(startDate);

  // Standard 30/60/90 day milestones
  const day30 = new Date(start);
  day30.setDate(day30.getDate() + 30);

  const day60 = new Date(start);
  day60.setDate(day60.getDate() + 60);

  const day90 = new Date(start);
  day90.setDate(day90.getDate() + 90);

  return [
    {
      id: generatePlanningMilestoneId(),
      title: 'Program Kickoff Complete',
      dueDate: startDate,
      status: 'pending',
    },
    {
      id: generatePlanningMilestoneId(),
      title: '30-Day Checkpoint',
      dueDate: day30.toISOString().split('T')[0],
      status: 'pending',
    },
    {
      id: generatePlanningMilestoneId(),
      title: '60-Day Checkpoint',
      dueDate: day60.toISOString().split('T')[0],
      status: 'pending',
    },
    {
      id: generatePlanningMilestoneId(),
      title: '90-Day Review',
      dueDate: day90.toISOString().split('T')[0],
      status: 'pending',
    },
  ];
}

// ============================================================================
// Bundle Validation
// ============================================================================

/**
 * Validate a bundle instantiation request
 */
export function validateBundleRequest(
  request: BundleInstantiationRequest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.bundleId || request.bundleId.trim() === '') {
    errors.push('Bundle ID is required');
  }

  if (!request.domains || request.domains.length === 0) {
    errors.push('At least one domain is required');
  }

  if (!request.intensity) {
    errors.push('Intensity level is required');
  }

  if (!request.startDate) {
    errors.push('Start date is required');
  } else {
    const date = new Date(request.startDate);
    if (isNaN(date.getTime())) {
      errors.push('Start date must be a valid ISO date string');
    }
  }

  if (!request.companyId) {
    errors.push('Company ID is required');
  }

  if (!request.strategyId) {
    errors.push('Strategy ID is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Bundle Helpers
// ============================================================================

/**
 * Get all programs for a bundle
 */
export async function getBundlePrograms(
  companyId: string,
  bundleId: string
): Promise<PlanningProgram[]> {
  // This would query programs by bundleId
  // For now, return empty - implement when needed
  console.log(`[BundleInstantiation] getBundlePrograms not yet implemented`, { companyId, bundleId });
  return [];
}

/**
 * Check if a bundle is fully instantiated
 */
export function isBundleComplete(
  expectedDomains: ProgramDomain[],
  createdPrograms: PlanningProgram[]
): boolean {
  const createdDomains = new Set(createdPrograms.map((p) => p.domain));
  return expectedDomains.every((domain) => createdDomains.has(domain));
}
