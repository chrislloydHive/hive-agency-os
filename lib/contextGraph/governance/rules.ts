// lib/contextGraph/governance/rules.ts
// Validation Rules Engine
//
// Detects contradictions, cross-domain inconsistencies, and logical issues
// in the context graph. Returns actionable issues with suggested fixes.

import type { CompanyContextGraph, DomainName } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

export interface ValidationIssue {
  id: string;
  path: string;               // Primary field involved
  relatedPaths?: string[];    // Other fields involved
  issue: string;              // Human-readable description
  severity: 'error' | 'warning' | 'info';
  category: 'contradiction' | 'missing_dependency' | 'stale_data' | 'logical_issue';
  suggestedFix?: string;
  autoFixable?: boolean;      // Can AI auto-fix this?
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

type ValidationRule = (graph: CompanyContextGraph) => ValidationIssue[];

// ============================================================================
// Utility Functions
// ============================================================================

function getValueByPath(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value: unknown }).value;
  }

  return current;
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function generateRuleId(category: string, index: number): string {
  return `${category}-${index}-${Date.now()}`;
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Rule: Audience targeting should align with brand positioning
 */
const audienceBrandAlignmentRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const coreSegments = getValueByPath(graph, 'audience.coreSegments');
  const positioning = getValueByPath(graph, 'brand.positioning');
  const toneOfVoice = getValueByPath(graph, 'brand.toneOfVoice');

  if (isPopulated(coreSegments) && isPopulated(toneOfVoice)) {
    const segmentsStr = String(coreSegments).toLowerCase();
    const toneStr = String(toneOfVoice).toLowerCase();

    // Check for Gen Z / youth audience with formal B2B tone
    if (
      (segmentsStr.includes('gen z') || segmentsStr.includes('youth') || segmentsStr.includes('18-24')) &&
      (toneStr.includes('formal') || toneStr.includes('enterprise') || toneStr.includes('b2b'))
    ) {
      issues.push({
        id: generateRuleId('contradiction', 1),
        path: 'brand.toneOfVoice',
        relatedPaths: ['audience.coreSegments'],
        issue: 'Brand tone is formal/enterprise but audience includes Gen Z or youth segments',
        severity: 'warning',
        category: 'contradiction',
        suggestedFix: 'Consider adjusting tone of voice to be more casual and relatable for younger audiences',
        autoFixable: true,
      });
    }

    // Check for luxury positioning with budget-conscious audience
    if (positioning && typeof positioning === 'string') {
      const posStr = positioning.toLowerCase();
      if (
        (posStr.includes('luxury') || posStr.includes('premium') || posStr.includes('high-end')) &&
        (segmentsStr.includes('budget') || segmentsStr.includes('price-sensitive') || segmentsStr.includes('value'))
      ) {
        issues.push({
          id: generateRuleId('contradiction', 2),
          path: 'brand.positioning',
          relatedPaths: ['audience.coreSegments'],
          issue: 'Luxury brand positioning conflicts with budget-conscious audience segments',
          severity: 'error',
          category: 'contradiction',
          suggestedFix: 'Align brand positioning with target audience purchasing behavior',
          autoFixable: false,
        });
      }
    }
  }

  return issues;
};

/**
 * Rule: Store traffic objective requires store data
 */
const storeTrafficDataRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const primaryObjective = getValueByPath(graph, 'objectives.primaryObjective');

  if (isPopulated(primaryObjective)) {
    const objStr = String(primaryObjective).toLowerCase();

    if (objStr.includes('store') || objStr.includes('foot traffic') || objStr.includes('in-store')) {
      // Check for store data
      const storeData = getValueByPath(graph, 'storeRisk');
      const storeCount = getValueByPath(graph, 'identity.storeCount');

      if (!isPopulated(storeData) && !isPopulated(storeCount)) {
        issues.push({
          id: generateRuleId('missing_dependency', 1),
          path: 'objectives.primaryObjective',
          relatedPaths: ['storeRisk', 'identity.storeCount'],
          issue: 'Store traffic objective set but no store data exists in the graph',
          severity: 'error',
          category: 'missing_dependency',
          suggestedFix: 'Add store location data or update the primary objective',
          autoFixable: false,
        });
      }
    }
  }

  return issues;
};

/**
 * Rule: Demand states should have corresponding creative formats
 */
const demandStatesCreativeRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const demandStates = getValueByPath(graph, 'audience.demandStates');
  const creativeFormats = getValueByPath(graph, 'creative.recommendedFormats');

  if (isPopulated(demandStates) && !isPopulated(creativeFormats)) {
    issues.push({
      id: generateRuleId('missing_dependency', 2),
      path: 'creative.recommendedFormats',
      relatedPaths: ['audience.demandStates'],
      issue: 'Demand states are defined but no creative formats have been recommended',
      severity: 'warning',
      category: 'missing_dependency',
      suggestedFix: 'Run Creative Lab to generate format recommendations based on demand states',
      autoFixable: true,
    });
  }

  return issues;
};

/**
 * Rule: Active channels should have performance data
 */
const channelPerformanceRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const activeChannels = getValueByPath(graph, 'performanceMedia.activeChannels');
  const blendedCpa = getValueByPath(graph, 'performanceMedia.blendedCpa');
  const blendedRoas = getValueByPath(graph, 'performanceMedia.blendedRoas');

  if (isPopulated(activeChannels)) {
    if (!isPopulated(blendedCpa) && !isPopulated(blendedRoas)) {
      issues.push({
        id: generateRuleId('missing_dependency', 3),
        path: 'performanceMedia.blendedCpa',
        relatedPaths: ['performanceMedia.activeChannels', 'performanceMedia.blendedRoas'],
        issue: 'Active channels are defined but no performance metrics (CPA/ROAS) exist',
        severity: 'warning',
        category: 'missing_dependency',
        suggestedFix: 'Connect analytics to pull performance data or enter manually',
        autoFixable: false,
      });
    }
  }

  return issues;
};

/**
 * Rule: Target metrics should be realistic compared to historical
 */
const targetVsHistoricalRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const targetCpa = getValueByPath(graph, 'objectives.targetCpa');
  const historicalCpa = getValueByPath(graph, 'historical.historicalCpa');

  if (isPopulated(targetCpa) && isPopulated(historicalCpa)) {
    const target = parseFloat(String(targetCpa).replace(/[^0-9.]/g, ''));
    const historical = parseFloat(String(historicalCpa).replace(/[^0-9.]/g, ''));

    if (!isNaN(target) && !isNaN(historical)) {
      // Target more than 50% lower than historical
      if (target < historical * 0.5) {
        issues.push({
          id: generateRuleId('logical_issue', 1),
          path: 'objectives.targetCpa',
          relatedPaths: ['historical.historicalCpa'],
          issue: `Target CPA ($${target}) is more than 50% lower than historical ($${historical})`,
          severity: 'warning',
          category: 'logical_issue',
          suggestedFix: 'Review target CPA against historical performance and adjust expectations',
          autoFixable: false,
        });
      }
    }
  }

  return issues;
};

/**
 * Rule: Value propositions should exist if positioning is defined
 */
const positioningValuePropsRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const positioning = getValueByPath(graph, 'brand.positioning');
  const valueProps = getValueByPath(graph, 'brand.valueProps');

  if (isPopulated(positioning) && !isPopulated(valueProps)) {
    issues.push({
      id: generateRuleId('missing_dependency', 4),
      path: 'brand.valueProps',
      relatedPaths: ['brand.positioning'],
      issue: 'Brand positioning is defined but value propositions are missing',
      severity: 'warning',
      category: 'missing_dependency',
      suggestedFix: 'Define value propositions that support the brand positioning',
      autoFixable: true,
    });
  }

  return issues;
};

/**
 * Rule: Geographic footprint should align with targeting
 */
const geographicAlignmentRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const footprint = getValueByPath(graph, 'identity.geographicFootprint');
  const primaryMarkets = getValueByPath(graph, 'audience.primaryMarkets');

  if (isPopulated(footprint) && isPopulated(primaryMarkets)) {
    const footprintStr = String(footprint).toLowerCase();
    const marketsStr = String(primaryMarkets).toLowerCase();

    // Check for local business targeting national
    if (
      (footprintStr.includes('local') || footprintStr.includes('single') || footprintStr.includes('1 location')) &&
      (marketsStr.includes('national') || marketsStr.includes('nationwide') || marketsStr.includes('all states'))
    ) {
      issues.push({
        id: generateRuleId('contradiction', 3),
        path: 'audience.primaryMarkets',
        relatedPaths: ['identity.geographicFootprint'],
        issue: 'Primary markets are national but business has local geographic footprint',
        severity: 'warning',
        category: 'contradiction',
        suggestedFix: 'Align primary markets with actual geographic service area',
        autoFixable: true,
      });
    }
  }

  return issues;
};

/**
 * Rule: Budget should exist if media channels are active
 */
const budgetMediaRule: ValidationRule = (graph) => {
  const issues: ValidationIssue[] = [];

  const activeChannels = getValueByPath(graph, 'performanceMedia.activeChannels');
  const totalSpend = getValueByPath(graph, 'performanceMedia.totalMonthlySpend');

  if (isPopulated(activeChannels) && !isPopulated(totalSpend)) {
    issues.push({
      id: generateRuleId('missing_dependency', 5),
      path: 'performanceMedia.totalMonthlySpend',
      relatedPaths: ['performanceMedia.activeChannels'],
      issue: 'Active media channels exist but no budget/spend information is available',
      severity: 'warning',
      category: 'missing_dependency',
      suggestedFix: 'Add monthly spend data to enable proper media optimization',
      autoFixable: false,
    });
  }

  return issues;
};

// ============================================================================
// Rule Registry
// ============================================================================

const VALIDATION_RULES: ValidationRule[] = [
  audienceBrandAlignmentRule,
  storeTrafficDataRule,
  demandStatesCreativeRule,
  channelPerformanceRule,
  targetVsHistoricalRule,
  positioningValuePropsRule,
  geographicAlignmentRule,
  budgetMediaRule,
];

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Run all validation rules against a graph
 */
export function validateGraph(graph: CompanyContextGraph): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  for (const rule of VALIDATION_RULES) {
    try {
      const issues = rule(graph);
      allIssues.push(...issues);
    } catch (error) {
      console.error('[ValidationRules] Rule error:', error);
    }
  }

  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    issues: allIssues,
    errorCount,
    warningCount,
  };
}

/**
 * Run validation for a specific domain only
 */
export function validateDomain(
  graph: CompanyContextGraph,
  domain: DomainName
): ValidationIssue[] {
  const result = validateGraph(graph);
  return result.issues.filter(
    issue => issue.path.startsWith(domain + '.') || issue.relatedPaths?.some(p => p.startsWith(domain + '.'))
  );
}

/**
 * Get only auto-fixable issues
 */
export function getAutoFixableIssues(graph: CompanyContextGraph): ValidationIssue[] {
  const result = validateGraph(graph);
  return result.issues.filter(issue => issue.autoFixable);
}

/**
 * Check if a specific update would cause new validation issues
 */
export function wouldCauseIssues(
  graph: CompanyContextGraph,
  path: string,
  newValue: unknown
): ValidationIssue[] {
  // Create a temporary copy with the update applied
  const tempGraph = JSON.parse(JSON.stringify(graph));

  // Apply the update to temp graph
  const parts = path.split('.');
  let current: Record<string, unknown> = tempGraph;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (current[lastPart] && typeof current[lastPart] === 'object' && 'value' in (current[lastPart] as object)) {
    (current[lastPart] as { value: unknown }).value = newValue;
  } else {
    current[lastPart] = newValue;
  }

  // Validate the temp graph
  const newResult = validateGraph(tempGraph);
  const oldResult = validateGraph(graph);

  // Return only NEW issues that weren't there before
  const oldIds = new Set(oldResult.issues.map(i => i.id));
  return newResult.issues.filter(i => !oldIds.has(i.id));
}
