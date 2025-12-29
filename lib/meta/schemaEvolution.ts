// lib/meta/schemaEvolution.ts
// Phase 6: Emergent Intelligence - Schema Evolution Engine
//
// The graph can evolve itself based on usage patterns:
// - Proposes new fields when repeatedly asked for missing data
// - Deprecates unused fields
// - Suggests renames for consistency
// - Creates migration plans

import type { CompanyContextGraph, DomainName } from '../contextGraph/companyContextGraph';
import type {
  SchemaEvolutionProposal,
  SchemaEvolutionEvidence,
  MigrationPlan,
  MigrationStep,
} from './types';
import { loadContextGraph } from '../contextGraph';
import { getAllCompanies } from '../airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface FieldUsageStats {
  domain: DomainName;
  fieldName: string;
  populatedCount: number;
  nullCount: number;
  lastAccessed: string | null;
  accessCount: number;
  valueTypes: Set<string>;
}

interface NamingPattern {
  pattern: string;
  examples: string[];
  frequency: number;
}

interface ProposalOptions {
  minSampleSize?: number;
  maxProposals?: number;
  includeDeprecations?: boolean;
  includeAdditions?: boolean;
  includeRenames?: boolean;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Analyze schema usage and propose evolution changes
 */
export async function analyzeSchemaUsage(): Promise<{
  fieldStats: FieldUsageStats[];
  unusedFields: string[];
  inconsistentNaming: Array<{ field: string; suggestedName: string; reason: string }>;
  missingFieldPatterns: Array<{ field: string; frequency: number; reasoning: string }>;
}> {
  const companies = await getAllCompanies();
  const fieldStats: Map<string, FieldUsageStats> = new Map();

  for (const company of companies) {
    try {
      const graph = await loadContextGraph(company.id);
      if (graph) {
        analyzeGraphFields(graph, fieldStats);
      }
    } catch (error) {
      continue;
    }
  }

  const stats = [...fieldStats.values()];
  const totalCompanies = companies.length;

  // Find unused fields (populated in < 5% of companies)
  const unusedFields = stats
    .filter(s => s.populatedCount / totalCompanies < 0.05)
    .map(s => `${s.domain}.${s.fieldName}`);

  // Find inconsistent naming
  const inconsistentNaming = findNamingInconsistencies(stats);

  // Find missing field patterns
  const missingFieldPatterns = findMissingFieldPatterns(stats, totalCompanies);

  return {
    fieldStats: stats,
    unusedFields,
    inconsistentNaming,
    missingFieldPatterns,
  };
}

/**
 * Generate schema evolution proposals
 */
export async function generateEvolutionProposals(
  options: ProposalOptions = {}
): Promise<SchemaEvolutionProposal[]> {
  const {
    minSampleSize = 5,
    maxProposals = 10,
    includeDeprecations = true,
    includeAdditions = true,
    includeRenames = true,
  } = options;

  const proposals: SchemaEvolutionProposal[] = [];
  const usage = await analyzeSchemaUsage();

  // Generate deprecation proposals
  if (includeDeprecations) {
    const deprecations = generateDeprecationProposals(usage.fieldStats, usage.unusedFields);
    proposals.push(...deprecations);
  }

  // Generate addition proposals
  if (includeAdditions) {
    const additions = generateAdditionProposals(usage.missingFieldPatterns);
    proposals.push(...additions);
  }

  // Generate rename proposals
  if (includeRenames) {
    const renames = generateRenameProposals(usage.inconsistentNaming);
    proposals.push(...renames);
  }

  // Sort by impact and limit
  return proposals
    .sort((a, b) => {
      const aScore = calculateProposalScore(a);
      const bScore = calculateProposalScore(b);
      return bScore - aScore;
    })
    .slice(0, maxProposals);
}

/**
 * Create a migration plan for a proposal
 */
export function createMigrationPlan(
  proposal: SchemaEvolutionProposal
): MigrationPlan {
  const steps: MigrationStep[] = [];

  switch (proposal.type) {
    case 'addition':
      steps.push({
        order: 1,
        description: 'Add field to schema type definitions',
        action: `Add ${proposal.fieldName} to ${proposal.domain} domain interface`,
        reversible: true,
      });
      steps.push({
        order: 2,
        description: 'Update Airtable schema (if applicable)',
        action: `Add column ${proposal.fieldName} to ${proposal.domain} table`,
        reversible: true,
      });
      steps.push({
        order: 3,
        description: 'Deploy and verify',
        action: 'Deploy changes and verify field is accessible',
        reversible: true,
      });
      break;

    case 'deprecation':
      steps.push({
        order: 1,
        description: 'Mark field as deprecated in types',
        action: `Add @deprecated JSDoc to ${proposal.domain}.${proposal.fieldName}`,
        reversible: true,
      });
      steps.push({
        order: 2,
        description: 'Add deprecation warning in code',
        action: 'Log warning when deprecated field is accessed',
        reversible: true,
      });
      steps.push({
        order: 3,
        description: 'Migrate existing usages',
        action: proposal.deprecationDetails?.replacementField
          ? `Update code to use ${proposal.deprecationDetails.replacementField} instead`
          : 'Remove usages of deprecated field',
        reversible: true,
      });
      steps.push({
        order: 4,
        description: 'Remove field (after grace period)',
        action: `Remove ${proposal.fieldName} from ${proposal.domain} schema`,
        reversible: false,
      });
      break;

    case 'rename':
      steps.push({
        order: 1,
        description: 'Add new field name as alias',
        action: `Add ${proposal.renameDetails?.newName} as alias for ${proposal.fieldName}`,
        reversible: true,
      });
      steps.push({
        order: 2,
        description: 'Update all code references',
        action: `Find and replace ${proposal.fieldName} -> ${proposal.renameDetails?.newName}`,
        reversible: true,
      });
      steps.push({
        order: 3,
        description: 'Migrate data in storage',
        action: 'Copy data from old field to new field for all records',
        reversible: true,
      });
      steps.push({
        order: 4,
        description: 'Remove old field name',
        action: `Remove ${proposal.fieldName} alias`,
        reversible: false,
      });
      break;

    case 'type_change':
      steps.push({
        order: 1,
        description: 'Add new field with new type',
        action: `Add ${proposal.fieldName}_v2 with new type`,
        reversible: true,
      });
      steps.push({
        order: 2,
        description: 'Write migration script',
        action: 'Create script to transform data from old to new format',
        reversible: true,
      });
      steps.push({
        order: 3,
        description: 'Run migration',
        action: 'Execute migration script on all records',
        reversible: true,
      });
      steps.push({
        order: 4,
        description: 'Switch to new field',
        action: `Rename ${proposal.fieldName}_v2 to ${proposal.fieldName}`,
        reversible: false,
      });
      break;
  }

  return {
    steps,
    rollbackPlan: generateRollbackPlan(proposal, steps),
    testingRequirements: generateTestingRequirements(proposal),
    estimatedDuration: estimateDuration(proposal, steps),
  };
}

/**
 * Apply a schema evolution proposal
 */
export async function applyProposal(
  proposal: SchemaEvolutionProposal
): Promise<{ success: boolean; error?: string }> {
  // This would actually apply the changes
  // For now, just validate and return success

  try {
    // Validate proposal
    if (!proposal.domain || !proposal.fieldName) {
      return { success: false, error: 'Invalid proposal: missing domain or fieldName' };
    }

    // Create migration plan
    const plan = createMigrationPlan(proposal);

    // In a real implementation, we would:
    // 1. Execute each step
    // 2. Track progress
    // 3. Handle rollback on failure

    console.log(`Would apply ${proposal.type} proposal for ${proposal.domain}.${proposal.fieldName}`);
    console.log('Migration steps:', plan.steps.length);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate a proposed schema change
 */
export function validateProposal(
  proposal: SchemaEvolutionProposal
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!proposal.domain) errors.push('Missing domain');
  if (!proposal.fieldName) errors.push('Missing fieldName');
  if (!proposal.type) errors.push('Missing type');

  // Type-specific validation
  switch (proposal.type) {
    case 'addition':
      if (!proposal.additionDetails?.fieldType) {
        errors.push('Addition requires fieldType');
      }
      if (!proposal.additionDetails?.description) {
        warnings.push('Addition should include description');
      }
      break;

    case 'deprecation':
      if (!proposal.deprecationDetails?.reason) {
        errors.push('Deprecation requires reason');
      }
      if (proposal.deprecationDetails?.usageCount && proposal.deprecationDetails.usageCount > 0) {
        warnings.push(`Field still has ${proposal.deprecationDetails.usageCount} usages`);
      }
      break;

    case 'rename':
      if (!proposal.renameDetails?.newName) {
        errors.push('Rename requires newName');
      }
      if (!proposal.renameDetails?.reason) {
        warnings.push('Rename should include reason');
      }
      break;
  }

  // Impact assessment validation
  if (proposal.impactAssessment?.breakingChange) {
    warnings.push('This is a breaking change - requires careful migration');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Helper Functions - Analysis
// ============================================================================

function analyzeGraphFields(
  graph: CompanyContextGraph,
  stats: Map<string, FieldUsageStats>
): void {
  const domains: Array<{ name: DomainName; data: unknown }> = [
    { name: 'identity', data: graph.identity },
    { name: 'brand', data: graph.brand },
    { name: 'objectives', data: graph.objectives },
    { name: 'audience', data: graph.audience },
    { name: 'performanceMedia', data: graph.performanceMedia },
    { name: 'budgetOps', data: graph.budgetOps },
    { name: 'creative', data: graph.creative },
    { name: 'website', data: graph.website },
    { name: 'content', data: graph.content },
    { name: 'seo', data: graph.seo },
    { name: 'ops', data: graph.ops },
    { name: 'productOffer', data: graph.productOffer },
    { name: 'digitalInfra', data: graph.digitalInfra },
    { name: 'historical', data: graph.historical },
    { name: 'competitive', data: graph.competitive },
    { name: 'storeRisk', data: graph.storeRisk },
    { name: 'operationalConstraints', data: graph.operationalConstraints },
  ];

  for (const { name, data } of domains) {
    if (typeof data === 'object' && data !== null) {
      for (const [field, value] of Object.entries(data)) {
        const key = `${name}.${field}`;

        if (!stats.has(key)) {
          stats.set(key, {
            domain: name,
            fieldName: field,
            populatedCount: 0,
            nullCount: 0,
            lastAccessed: null,
            accessCount: 0,
            valueTypes: new Set(),
          });
        }

        const stat = stats.get(key)!;

        // Check if field has a value
        const hasValue = value !== null && value !== undefined;
        const wrappedValue = (value as { value?: unknown })?.value;
        const actualValue = wrappedValue !== undefined ? wrappedValue : value;

        if (actualValue !== null && actualValue !== undefined) {
          stat.populatedCount++;
          stat.valueTypes.add(typeof actualValue);
        } else {
          stat.nullCount++;
        }
      }
    }
  }
}

function findNamingInconsistencies(
  stats: FieldUsageStats[]
): Array<{ field: string; suggestedName: string; reason: string }> {
  const inconsistencies: Array<{ field: string; suggestedName: string; reason: string }> = [];

  // Group fields by domain
  const byDomain: Record<string, string[]> = {};
  for (const stat of stats) {
    if (!byDomain[stat.domain]) {
      byDomain[stat.domain] = [];
    }
    byDomain[stat.domain].push(stat.fieldName);
  }

  // Check for common patterns
  for (const [domain, fields] of Object.entries(byDomain)) {
    for (const field of fields) {
      // Check for snake_case in camelCase codebase
      if (field.includes('_')) {
        const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        inconsistencies.push({
          field: `${domain}.${field}`,
          suggestedName: camelCase,
          reason: 'Use camelCase for consistency',
        });
      }

      // Check for abbreviations that should be expanded
      const abbreviations: Record<string, string> = {
        'ctr': 'clickThroughRate',
        'cpc': 'costPerClick',
        'cpm': 'costPerMille',
        'cpa': 'costPerAcquisition',
        'roi': 'returnOnInvestment',
        'roas': 'returnOnAdSpend',
        'ltv': 'lifetimeValue',
        'cac': 'customerAcquisitionCost',
      };

      const lowerField = field.toLowerCase();
      if (abbreviations[lowerField] && field === lowerField) {
        // Only suggest if it's all lowercase
        inconsistencies.push({
          field: `${domain}.${field}`,
          suggestedName: abbreviations[lowerField],
          reason: 'Consider using full name for clarity',
        });
      }

      // Check for similar field names that might be duplicates
      for (const otherField of fields) {
        if (field !== otherField) {
          const similarity = calculateStringSimilarity(field.toLowerCase(), otherField.toLowerCase());
          if (similarity > 0.8 && similarity < 1) {
            inconsistencies.push({
              field: `${domain}.${field}`,
              suggestedName: otherField,
              reason: `Similar to ${otherField} - consider consolidating`,
            });
          }
        }
      }
    }
  }

  return inconsistencies;
}

function findMissingFieldPatterns(
  stats: FieldUsageStats[],
  totalCompanies: number
): Array<{ field: string; frequency: number; reasoning: string }> {
  const patterns: Array<{ field: string; frequency: number; reasoning: string }> = [];

  // Analyze what fields are commonly populated vs missing
  const populationRates: Record<string, number> = {};
  for (const stat of stats) {
    populationRates[`${stat.domain}.${stat.fieldName}`] = stat.populatedCount / totalCompanies;
  }

  // Look for domains with low overall population
  const domainPopulation: Record<string, { total: number; populated: number }> = {};
  for (const stat of stats) {
    if (!domainPopulation[stat.domain]) {
      domainPopulation[stat.domain] = { total: 0, populated: 0 };
    }
    domainPopulation[stat.domain].total++;
    if (stat.populatedCount > 0) {
      domainPopulation[stat.domain].populated++;
    }
  }

  // Suggest common fields that might be missing from sparse domains
  const commonFieldPatterns = [
    { pattern: 'createdAt', domains: ['all'], reasoning: 'Track when record was created' },
    { pattern: 'updatedAt', domains: ['all'], reasoning: 'Track when record was last updated' },
    { pattern: 'notes', domains: ['all'], reasoning: 'Free-form notes field' },
    { pattern: 'status', domains: ['all'], reasoning: 'Track record status' },
    { pattern: 'tags', domains: ['all'], reasoning: 'Enable categorization' },
  ];

  for (const { pattern, domains, reasoning } of commonFieldPatterns) {
    for (const stat of stats) {
      if (stat.fieldName === pattern || stat.fieldName.includes(pattern)) {
        const populationRate = stat.populatedCount / totalCompanies;
        if (populationRate < 0.1) {
          patterns.push({
            field: `${stat.domain}.${stat.fieldName}`,
            frequency: populationRate,
            reasoning: `Low usage (${(populationRate * 100).toFixed(1)}%) - ${reasoning}`,
          });
        }
      }
    }
  }

  return patterns;
}

// ============================================================================
// Helper Functions - Proposal Generation
// ============================================================================

function generateDeprecationProposals(
  fieldStats: FieldUsageStats[],
  unusedFields: string[]
): SchemaEvolutionProposal[] {
  const proposals: SchemaEvolutionProposal[] = [];

  for (const fieldPath of unusedFields) {
    const [domain, fieldName] = fieldPath.split('.');
    const stat = fieldStats.find(s => s.domain === domain && s.fieldName === fieldName);

    if (stat) {
      proposals.push({
        id: `deprecation-${domain}-${fieldName}-${Date.now()}`,
        type: 'deprecation',
        domain: domain as DomainName,
        fieldName,
        deprecationDetails: {
          reason: `Field is populated in only ${stat.populatedCount} companies`,
          usageCount: stat.populatedCount,
        },
        evidence: [{
          type: 'unused_field',
          description: `Field ${fieldName} is rarely used`,
          sampleSize: stat.populatedCount + stat.nullCount,
          confidence: 0.8,
        }],
        affectedCompanies: stat.populatedCount,
        impactAssessment: {
          breakingChange: stat.populatedCount > 0,
          migrationComplexity: stat.populatedCount > 0 ? 'medium' : 'low',
          estimatedMigrationTime: stat.populatedCount > 0 ? '1-2 hours' : '< 30 minutes',
          riskLevel: stat.populatedCount > 0 ? 'medium' : 'low',
        },
        status: 'proposed',
        proposedAt: new Date().toISOString(),
      });
    }
  }

  return proposals;
}

function generateAdditionProposals(
  missingPatterns: Array<{ field: string; frequency: number; reasoning: string }>
): SchemaEvolutionProposal[] {
  const proposals: SchemaEvolutionProposal[] = [];

  // Only propose additions for patterns with clear need
  // This would typically come from AI analysis of user queries

  return proposals;
}

function generateRenameProposals(
  inconsistencies: Array<{ field: string; suggestedName: string; reason: string }>
): SchemaEvolutionProposal[] {
  const proposals: SchemaEvolutionProposal[] = [];

  for (const { field, suggestedName, reason } of inconsistencies) {
    const [domain, fieldName] = field.split('.');

    // Only propose renames for snake_case to camelCase
    if (reason.includes('camelCase')) {
      proposals.push({
        id: `rename-${domain}-${fieldName}-${Date.now()}`,
        type: 'rename',
        domain: domain as DomainName,
        fieldName,
        renameDetails: {
          newName: suggestedName,
          reason,
        },
        evidence: [{
          type: 'naming_inconsistency',
          description: reason,
          sampleSize: 1,
          confidence: 0.9,
        }],
        affectedCompanies: 0, // Would need to count
        impactAssessment: {
          breakingChange: true,
          migrationComplexity: 'medium',
          estimatedMigrationTime: '1-2 hours',
          riskLevel: 'medium',
        },
        status: 'proposed',
        proposedAt: new Date().toISOString(),
      });
    }
  }

  return proposals;
}

function calculateProposalScore(proposal: SchemaEvolutionProposal): number {
  let score = 0;

  // Impact-based scoring
  switch (proposal.type) {
    case 'deprecation':
      score += proposal.affectedCompanies === 0 ? 10 : 5;
      break;
    case 'rename':
      score += 7;
      break;
    case 'addition':
      score += 8;
      break;
    case 'type_change':
      score += 3; // Lower priority due to complexity
      break;
  }

  // Adjust for risk
  switch (proposal.impactAssessment?.riskLevel) {
    case 'low':
      score += 3;
      break;
    case 'medium':
      score += 1;
      break;
    case 'high':
      score -= 2;
      break;
  }

  // Adjust for evidence strength
  const avgConfidence = proposal.evidence.reduce((sum, e) => sum + e.confidence, 0) /
    Math.max(proposal.evidence.length, 1);
  score += avgConfidence * 5;

  return score;
}

// ============================================================================
// Helper Functions - Migration Planning
// ============================================================================

function generateRollbackPlan(
  proposal: SchemaEvolutionProposal,
  steps: MigrationStep[]
): string {
  const reversibleSteps = steps.filter(s => s.reversible);

  if (reversibleSteps.length === steps.length) {
    return 'Fully reversible: Execute steps in reverse order';
  }

  const irreversibleStep = steps.find(s => !s.reversible);
  return `Partially reversible: Steps 1-${(irreversibleStep?.order || 1) - 1} can be reversed. ` +
    'After that point, restore from backup required.';
}

function generateTestingRequirements(proposal: SchemaEvolutionProposal): string[] {
  const requirements: string[] = [];

  requirements.push('Unit tests for schema changes');
  requirements.push('Integration tests for affected APIs');

  if (proposal.type === 'rename' || proposal.type === 'type_change') {
    requirements.push('Data migration validation');
    requirements.push('Backwards compatibility testing');
  }

  if (proposal.impactAssessment?.breakingChange) {
    requirements.push('Consumer notification and update coordination');
    requirements.push('Staging environment full regression');
  }

  return requirements;
}

function estimateDuration(
  proposal: SchemaEvolutionProposal,
  steps: MigrationStep[]
): string {
  const complexity = proposal.impactAssessment?.migrationComplexity || 'medium';

  switch (complexity) {
    case 'low':
      return '< 30 minutes';
    case 'medium':
      return '1-2 hours';
    case 'high':
      return '4-8 hours';
    default:
      return '1-2 hours';
  }
}

function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Simple Jaccard similarity on character n-grams
  const ngramSize = 2;
  const aNgrams = new Set<string>();
  const bNgrams = new Set<string>();

  for (let i = 0; i <= a.length - ngramSize; i++) {
    aNgrams.add(a.slice(i, i + ngramSize));
  }
  for (let i = 0; i <= b.length - ngramSize; i++) {
    bNgrams.add(b.slice(i, i + ngramSize));
  }

  const intersection = [...aNgrams].filter(ng => bNgrams.has(ng)).length;
  const union = new Set([...aNgrams, ...bNgrams]).size;

  return union > 0 ? intersection / union : 0;
}

// ============================================================================
// Exports
// ============================================================================

export {
  type FieldUsageStats,
  type NamingPattern,
  type ProposalOptions,
};
