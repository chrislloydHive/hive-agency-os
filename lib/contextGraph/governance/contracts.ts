// lib/contextGraph/governance/contracts.ts
// Domain Context Contracts
//
// Defines required and recommended fields for each domain.
// Used to validate graph completeness and trigger auto-healing.

import type { CompanyContextGraph } from '../companyContextGraph';
import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation rule for a single field value
 * Used to enforce quality standards on context values
 */
export interface FieldValidationRule {
  /** Type of validation check */
  type: 'minLength' | 'maxLength' | 'pattern' | 'mustInclude' | 'mustNotInclude' | 'custom';
  /** Value for the check (length, pattern, keywords, etc.) */
  value?: number | string | string[];
  /** Human-readable error message */
  message: string;
  /** Custom validation function for 'custom' type */
  validate?: (value: unknown) => boolean;
}

export interface DomainContract {
  required: string[];      // Fields that MUST be populated
  recommended: string[];   // Fields that SHOULD be populated
  conditional?: Array<{
    if: string;            // If this field exists
    then: string[];        // Then these fields are required
  }>;
  /** Validation rules per field path - enforced on confirmation */
  validationRules?: Record<string, FieldValidationRule[]>;
}

export interface ContractViolation {
  path: string;
  type: 'missing_required' | 'missing_recommended' | 'conditional_missing';
  message: string;
  domain: DomainName;
  severity: 'error' | 'warning';
  suggestedAction?: string;
}

export interface ContractStatus {
  domain: DomainName;
  isComplete: boolean;
  requiredMet: number;
  requiredTotal: number;
  recommendedMet: number;
  recommendedTotal: number;
  violations: ContractViolation[];
}

export interface GraphContractStatus {
  overallComplete: boolean;
  completenessScore: number;
  domainStatuses: ContractStatus[];
  totalViolations: number;
  criticalViolations: number;
}

// ============================================================================
// Contract Definitions
// ============================================================================

export const ContextContracts: Record<DomainName, DomainContract> = {
  identity: {
    required: [
      'identity.businessName',
      'identity.industry',
    ],
    recommended: [
      'identity.businessModel',
      'identity.marketMaturity',
      'identity.geographicFootprint',
    ],
  },

  brand: {
    required: [
      'brand.positioning',
      'brand.valueProps',
    ],
    recommended: [
      'brand.toneOfVoice',
      'brand.differentiators',
      'brand.brandPersonality',
      'brand.messagingPillars',
    ],
    validationRules: {
      'brand.positioning': [
        {
          type: 'minLength',
          value: 20,
          message: 'Positioning should be at least 1-2 sentences (20+ characters)',
        },
        {
          type: 'maxLength',
          value: 500,
          message: 'Positioning should be concise (under 500 characters)',
        },
        {
          type: 'mustNotInclude',
          value: ['score', 'rating', 'recommend', 'diagnostic'],
          message: 'Positioning should not include scores, ratings, or diagnostic language',
        },
      ],
    },
  },

  objectives: {
    required: [
      'objectives.primaryObjective',
    ],
    recommended: [
      'objectives.targetCpa',
      'objectives.targetRoas',
      'objectives.timeHorizon',
    ],
    conditional: [
      {
        if: 'objectives.primaryObjective',
        then: ['objectives.primaryBusinessGoal'],
      },
    ],
  },

  audience: {
    required: [
      'audience.coreSegments',
      'audience.icpDescription',
    ],
    recommended: [
      'audience.primaryAudience',
      'audience.demandStates',
      'audience.behavioralDrivers',
      'audience.mediaHabits',
      'audience.painPoints',
      'audience.motivations',
    ],
    validationRules: {
      'audience.icpDescription': [
        {
          type: 'minLength',
          value: 50,
          message: 'ICP description should be detailed (50+ characters)',
        },
        {
          type: 'mustNotInclude',
          value: ['we ', 'our ', 'us '],
          message: 'ICP description should describe the audience, not use "we/our/us" language',
        },
      ],
      'audience.primaryAudience': [
        {
          type: 'minLength',
          value: 10,
          message: 'Primary audience should be clearly defined',
        },
        {
          type: 'mustNotInclude',
          value: ['channel', 'tactic', 'campaign'],
          message: 'Primary audience should describe who, not how to reach them',
        },
      ],
      'audience.coreSegments': [
        {
          type: 'custom',
          message: 'Should have at least 1 segment defined',
          validate: (v) => Array.isArray(v) && v.length >= 1,
        },
      ],
    },
  },

  productOffer: {
    required: [
      'productOffer.valueProposition',
    ],
    recommended: [
      'productOffer.heroProducts',
      'productOffer.pricingNotes',
      'productOffer.conversionOffers',
      'productOffer.primaryProducts',
    ],
    validationRules: {
      'productOffer.valueProposition': [
        {
          type: 'minLength',
          value: 30,
          message: 'Value proposition should be compelling (30+ characters)',
        },
        {
          type: 'mustNotInclude',
          value: ['feature list', 'click here', 'buy now', 'sign up'],
          message: 'Value proposition should focus on outcomes, not CTAs or feature lists',
        },
      ],
    },
  },

  digitalInfra: {
    required: [],
    recommended: [
      'digitalInfra.trackingStackSummary',
      'digitalInfra.ga4Health',
      'digitalInfra.attributionModel',
    ],
  },

  website: {
    required: [],
    recommended: [],
  },

  content: {
    required: [],
    recommended: [],
  },

  seo: {
    required: [],
    recommended: [],
  },

  ops: {
    required: [],
    recommended: [],
  },

  performanceMedia: {
    required: [],
    recommended: [
      'performanceMedia.activeChannels',
      'performanceMedia.totalMonthlySpend',
      'performanceMedia.blendedCpa',
    ],
    conditional: [
      {
        if: 'performanceMedia.activeChannels',
        then: ['performanceMedia.topPerformingChannel'],
      },
    ],
  },

  historical: {
    required: [],
    recommended: [
      'historical.pastPerformanceSummary',
      'historical.keyLearnings',
    ],
  },

  creative: {
    required: [],
    recommended: [],
    conditional: [
      {
        if: 'audience.demandStates',
        then: [], // Creative formats could be conditionally required
      },
    ],
  },

  competitive: {
    required: [],
    recommended: [],
  },

  budgetOps: {
    required: [],
    recommended: [],
  },

  operationalConstraints: {
    required: [],
    recommended: [],
  },

  storeRisk: {
    required: [],
    recommended: [],
  },

  historyRefs: {
    required: [],
    recommended: [],
  },

  social: {
    required: [],
    recommended: [
      'social.instagramUrl',
      'social.gbpUrl',
    ],
  },

  capabilities: {
    required: [],
    recommended: [],
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get value from graph by dot-notation path
 */
function getValueByPath(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  // Handle WithMeta wrapper
  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value: unknown }).value;
  }

  return current;
}

/**
 * Check if a value is populated (not null, undefined, or empty)
 */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// ============================================================================
// Contract Validation
// ============================================================================

/**
 * Validate a single domain against its contract
 */
export function validateDomainContract(
  graph: CompanyContextGraph,
  domain: DomainName
): ContractStatus {
  const contract = ContextContracts[domain];
  const violations: ContractViolation[] = [];

  let requiredMet = 0;
  let recommendedMet = 0;

  // Check required fields
  for (const path of contract.required) {
    const value = getValueByPath(graph, path);
    if (isPopulated(value)) {
      requiredMet++;
    } else {
      violations.push({
        path,
        type: 'missing_required',
        message: `Required field "${path}" is missing or empty`,
        domain,
        severity: 'error',
        suggestedAction: `Run ${domain} diagnostics or manually populate this field`,
      });
    }
  }

  // Check recommended fields
  for (const path of contract.recommended) {
    const value = getValueByPath(graph, path);
    if (isPopulated(value)) {
      recommendedMet++;
    } else {
      violations.push({
        path,
        type: 'missing_recommended',
        message: `Recommended field "${path}" is not populated`,
        domain,
        severity: 'warning',
        suggestedAction: `Consider running ${domain} diagnostics to populate this field`,
      });
    }
  }

  // Check conditional requirements
  if (contract.conditional) {
    for (const condition of contract.conditional) {
      const conditionValue = getValueByPath(graph, condition.if);
      if (isPopulated(conditionValue)) {
        for (const requiredPath of condition.then) {
          const value = getValueByPath(graph, requiredPath);
          if (!isPopulated(value)) {
            violations.push({
              path: requiredPath,
              type: 'conditional_missing',
              message: `Field "${requiredPath}" is required when "${condition.if}" is set`,
              domain,
              severity: 'error',
              suggestedAction: `Populate "${requiredPath}" to complete the ${domain} context`,
            });
          }
        }
      }
    }
  }

  const requiredTotal = contract.required.length;
  const recommendedTotal = contract.recommended.length;

  return {
    domain,
    isComplete: requiredMet === requiredTotal,
    requiredMet,
    requiredTotal,
    recommendedMet,
    recommendedTotal,
    violations,
  };
}

/**
 * Validate entire graph against all contracts
 */
export function validateGraphContracts(
  graph: CompanyContextGraph
): GraphContractStatus {
  const domainStatuses: ContractStatus[] = [];
  let totalViolations = 0;
  let criticalViolations = 0;

  const domains = Object.keys(ContextContracts) as DomainName[];

  for (const domain of domains) {
    const status = validateDomainContract(graph, domain);
    domainStatuses.push(status);

    for (const violation of status.violations) {
      totalViolations++;
      if (violation.severity === 'error') {
        criticalViolations++;
      }
    }
  }

  const overallComplete = domainStatuses.every(s => s.isComplete);

  // Calculate completeness score
  let totalRequired = 0;
  let totalRequiredMet = 0;
  let totalRecommended = 0;
  let totalRecommendedMet = 0;

  for (const status of domainStatuses) {
    totalRequired += status.requiredTotal;
    totalRequiredMet += status.requiredMet;
    totalRecommended += status.recommendedTotal;
    totalRecommendedMet += status.recommendedMet;
  }

  // Weighted score: required fields count more
  const requiredScore = totalRequired > 0 ? (totalRequiredMet / totalRequired) * 70 : 70;
  const recommendedScore = totalRecommended > 0 ? (totalRecommendedMet / totalRecommended) * 30 : 30;
  const completenessScore = Math.round(requiredScore + recommendedScore);

  return {
    overallComplete,
    completenessScore,
    domainStatuses,
    totalViolations,
    criticalViolations,
  };
}

/**
 * Get missing required fields across all domains
 */
export function getMissingRequiredFields(
  graph: CompanyContextGraph
): ContractViolation[] {
  const status = validateGraphContracts(graph);
  return status.domainStatuses
    .flatMap(d => d.violations)
    .filter(v => v.type === 'missing_required' || v.type === 'conditional_missing');
}

/**
 * Get all violations for a specific domain
 */
export function getDomainViolations(
  graph: CompanyContextGraph,
  domain: DomainName
): ContractViolation[] {
  const status = validateDomainContract(graph, domain);
  return status.violations;
}

/**
 * Check if a specific field is required by any contract
 */
export function isFieldRequired(path: string): boolean {
  const domain = path.split('.')[0] as DomainName;
  const contract = ContextContracts[domain];

  if (!contract) return false;

  return contract.required.includes(path);
}

/**
 * Get suggested Lab for a missing field
 */
export function getSuggestedLabForField(path: string): string | null {
  const domain = path.split('.')[0];

  const labMap: Record<string, string> = {
    brand: 'Brand Lab',
    audience: 'Audience Lab',
    performanceMedia: 'Media Lab',
    creative: 'Creative Lab',
    seo: 'SEO Lab',
    content: 'Content Lab',
    website: 'Website Lab',
    objectives: 'Strategy Lab',
    digitalInfra: 'Analytics Lab',
  };

  return labMap[domain] ?? null;
}
