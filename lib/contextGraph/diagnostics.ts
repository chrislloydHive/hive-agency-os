// lib/contextGraph/diagnostics.ts
// Context Graph Sanity Diagnostics
//
// This module provides diagnostic tools to verify:
// - All fields in the schema have at least one writer
// - All fields have at least one consumer
// - Writers are properly registered in the schema's primarySources
// - No orphan writers (writing to undeclared fields)
// - No orphan fields (declared but never written)
//
// Run collectGraphSanityReport() to get a full health report.

import {
  CONTEXT_FIELDS,
  getFieldDef,
  getAutoFillMode,
  type ContextFieldDef,
  type ContextSectionId,
  type WriterModuleId,
  type ConsumerModuleId,
  type AutoFillMode,
} from './schema';
import {
  FIELD_WRITERS,
  FIELD_CONSUMERS,
  getWritersForField,
  getConsumersForField,
} from './wiring';

// ============================================================================
// Types
// ============================================================================

/**
 * Issue severity level
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * Issue type
 */
export type IssueType =
  | 'no_writers'
  | 'no_consumers'
  | 'writer_not_in_primary_sources'
  | 'primary_source_not_in_writers'
  | 'orphan_writer'
  | 'orphan_field_def'
  | 'deprecated_field_used';

/**
 * A single diagnostic issue
 */
export interface DiagnosticIssue {
  type: IssueType;
  severity: IssueSeverity;
  path: string;
  message: string;
  /** The module involved (if applicable) */
  module?: string;
  /** Suggestion for fixing the issue */
  suggestion?: string;
}

/**
 * Report for a single field
 */
export interface FieldSanityReport {
  path: string;
  section: ContextSectionId;
  label: string;
  type: string;
  /** Primary sources declared in schema */
  primarySources: WriterModuleId[];
  /** Actual writers from wiring */
  writers: WriterModuleId[];
  /** Actual consumers from wiring */
  consumers: ConsumerModuleId[];
  /** Is this a critical field? */
  critical: boolean;
  /** Is this field deprecated? */
  deprecated: boolean;
  /** Issues found */
  issues: DiagnosticIssue[];
}

/**
 * Summary statistics
 */
export interface SanitySummary {
  totalFields: number;
  fieldsWithIssues: number;
  criticalFieldsWithIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Fields with no writers */
  orphanedFields: string[];
  /** Fields with no consumers */
  unconsumedFields: string[];
  /** Writers in wiring but not in schema primarySources */
  miswiredWriters: Array<{ path: string; writer: string }>;
  /** Primary sources in schema but not in wiring */
  missingWriters: Array<{ path: string; source: string }>;
}

/**
 * Complete sanity report
 */
export interface GraphSanityReport {
  /** When the report was generated */
  generatedAt: string;
  /** Summary statistics */
  summary: SanitySummary;
  /** Per-field reports grouped by section */
  fieldsBySection: Record<ContextSectionId, FieldSanityReport[]>;
  /** All issues sorted by severity */
  allIssues: DiagnosticIssue[];
}

// ============================================================================
// Main Diagnostic Function
// ============================================================================

/**
 * Collect a full sanity report for the Context Graph schema and wiring
 */
export function collectGraphSanityReport(): GraphSanityReport {
  const fieldReports: FieldSanityReport[] = [];
  const allIssues: DiagnosticIssue[] = [];

  // Check each field in the schema
  for (const fieldDef of CONTEXT_FIELDS) {
    const report = analyzeField(fieldDef);
    fieldReports.push(report);
    allIssues.push(...report.issues);
  }

  // Check for orphan writers (paths in wiring not in schema)
  const orphanWriterIssues = checkOrphanWriters();
  allIssues.push(...orphanWriterIssues);

  // Group by section
  const fieldsBySection = groupBySection(fieldReports);

  // Calculate summary
  const summary = calculateSummary(fieldReports, allIssues);

  // Sort issues by severity
  allIssues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    generatedAt: new Date().toISOString(),
    summary,
    fieldsBySection,
    allIssues,
  };
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze a single field for issues
 */
function analyzeField(fieldDef: ContextFieldDef): FieldSanityReport {
  const issues: DiagnosticIssue[] = [];
  const writers = getWritersForField(fieldDef.path);
  const consumers = getConsumersForField(fieldDef.path);

  // Check for no writers
  if (writers.length === 0) {
    issues.push({
      type: 'no_writers',
      severity: fieldDef.critical ? 'error' : 'warning',
      path: fieldDef.path,
      message: `Field has no registered writers`,
      suggestion: `Add writers to FIELD_WRITERS['${fieldDef.path}'] in wiring.ts`,
    });
  }

  // Check for no consumers
  if (consumers.length === 0 && !fieldDef.deprecated) {
    issues.push({
      type: 'no_consumers',
      severity: 'warning',
      path: fieldDef.path,
      message: `Field has no registered consumers`,
      suggestion: `Add consumers to FIELD_CONSUMERS['${fieldDef.path}'] in wiring.ts, or mark as deprecated`,
    });
  }

  // Check for writers not in primarySources
  for (const writer of writers) {
    if (!fieldDef.primarySources.includes(writer)) {
      issues.push({
        type: 'writer_not_in_primary_sources',
        severity: 'warning',
        path: fieldDef.path,
        message: `Writer '${writer}' is in wiring but not in schema primarySources`,
        module: writer,
        suggestion: `Add '${writer}' to primarySources in schema.ts, or remove from FIELD_WRITERS in wiring.ts`,
      });
    }
  }

  // Check for primarySources not in writers
  for (const source of fieldDef.primarySources) {
    if (!writers.includes(source)) {
      issues.push({
        type: 'primary_source_not_in_writers',
        severity: 'info',
        path: fieldDef.path,
        message: `Primary source '${source}' declared in schema but not in wiring`,
        module: source,
        suggestion: `Add '${source}' to FIELD_WRITERS['${fieldDef.path}'] in wiring.ts, or remove from schema primarySources`,
      });
    }
  }

  // Note deprecated fields being used
  if (fieldDef.deprecated && writers.length > 0) {
    issues.push({
      type: 'deprecated_field_used',
      severity: 'info',
      path: fieldDef.path,
      message: `Deprecated field is still being written to by: ${writers.join(', ')}`,
      suggestion: `Migrate writers to use the replacement field`,
    });
  }

  return {
    path: fieldDef.path,
    section: fieldDef.section,
    label: fieldDef.label,
    type: fieldDef.type,
    primarySources: fieldDef.primarySources,
    writers,
    consumers,
    critical: fieldDef.critical || false,
    deprecated: fieldDef.deprecated || false,
    issues,
  };
}

/**
 * Check for orphan writers (paths in wiring but not in schema)
 */
function checkOrphanWriters(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const validPaths = new Set(CONTEXT_FIELDS.map(f => f.path));

  for (const path of Object.keys(FIELD_WRITERS)) {
    if (!validPaths.has(path)) {
      issues.push({
        type: 'orphan_writer',
        severity: 'error',
        path,
        message: `Path '${path}' has writers but is not in schema`,
        suggestion: `Add field definition to CONTEXT_FIELDS in schema.ts, or remove from FIELD_WRITERS in wiring.ts`,
      });
    }
  }

  for (const path of Object.keys(FIELD_CONSUMERS)) {
    if (!validPaths.has(path)) {
      issues.push({
        type: 'orphan_writer',
        severity: 'error',
        path,
        message: `Path '${path}' has consumers but is not in schema`,
        suggestion: `Add field definition to CONTEXT_FIELDS in schema.ts, or remove from FIELD_CONSUMERS in wiring.ts`,
      });
    }
  }

  return issues;
}

/**
 * Group field reports by section
 */
function groupBySection(
  reports: FieldSanityReport[]
): Record<ContextSectionId, FieldSanityReport[]> {
  const grouped: Record<string, FieldSanityReport[]> = {};

  for (const report of reports) {
    if (!grouped[report.section]) {
      grouped[report.section] = [];
    }
    grouped[report.section].push(report);
  }

  return grouped as Record<ContextSectionId, FieldSanityReport[]>;
}

/**
 * Calculate summary statistics
 */
function calculateSummary(
  reports: FieldSanityReport[],
  issues: DiagnosticIssue[]
): SanitySummary {
  const fieldsWithIssues = reports.filter(r => r.issues.length > 0);
  const criticalFieldsWithIssues = fieldsWithIssues.filter(r => r.critical);

  const orphanedFields = reports
    .filter(r => r.writers.length === 0)
    .map(r => r.path);

  const unconsumedFields = reports
    .filter(r => r.consumers.length === 0 && !r.deprecated)
    .map(r => r.path);

  const miswiredWriters: Array<{ path: string; writer: string }> = [];
  const missingWriters: Array<{ path: string; source: string }> = [];

  for (const report of reports) {
    for (const issue of report.issues) {
      if (issue.type === 'writer_not_in_primary_sources' && issue.module) {
        miswiredWriters.push({ path: report.path, writer: issue.module });
      }
      if (issue.type === 'primary_source_not_in_writers' && issue.module) {
        missingWriters.push({ path: report.path, source: issue.module });
      }
    }
  }

  return {
    totalFields: reports.length,
    fieldsWithIssues: fieldsWithIssues.length,
    criticalFieldsWithIssues: criticalFieldsWithIssues.length,
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    infoCount: issues.filter(i => i.severity === 'info').length,
    orphanedFields,
    unconsumedFields,
    miswiredWriters,
    missingWriters,
  };
}

// ============================================================================
// Quick Validation Functions
// ============================================================================

/**
 * Quick check if a path is valid (for runtime validation)
 */
export function isValidPath(path: string): boolean {
  return CONTEXT_FIELDS.some(f => f.path === path);
}

/**
 * Log a warning if an unknown path is written to (for dev mode)
 */
export function warnIfUnknownPath(path: string, source: string): void {
  if (!isValidPath(path)) {
    console.warn(
      `[Context Graph] Unknown path written: '${path}' by '${source}'. ` +
      `Add this field to CONTEXT_FIELDS in schema.ts if it's intentional.`
    );
  }
}

/**
 * Log a warning if a writer is not registered for a path (for dev mode)
 */
export function warnIfUnregisteredWriter(
  path: string,
  writer: WriterModuleId
): void {
  const writers = getWritersForField(path);
  if (!writers.includes(writer)) {
    console.warn(
      `[Context Graph] Writer '${writer}' is not registered for path '${path}'. ` +
      `Add it to FIELD_WRITERS in wiring.ts.`
    );
  }
}

// ============================================================================
// Reporting Utilities
// ============================================================================

/**
 * Format the sanity report for console output
 */
export function formatReportForConsole(report: GraphSanityReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('CONTEXT GRAPH SANITY REPORT');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('='.repeat(60));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(`Total fields: ${report.summary.totalFields}`);
  lines.push(`Fields with issues: ${report.summary.fieldsWithIssues}`);
  lines.push(`Critical fields with issues: ${report.summary.criticalFieldsWithIssues}`);
  lines.push(`Errors: ${report.summary.errorCount}`);
  lines.push(`Warnings: ${report.summary.warningCount}`);
  lines.push(`Info: ${report.summary.infoCount}`);
  lines.push('');

  if (report.summary.orphanedFields.length > 0) {
    lines.push('ORPHANED FIELDS (no writers):');
    report.summary.orphanedFields.forEach(p => lines.push(`  - ${p}`));
    lines.push('');
  }

  if (report.summary.unconsumedFields.length > 0) {
    lines.push('UNCONSUMED FIELDS (no consumers):');
    report.summary.unconsumedFields.forEach(p => lines.push(`  - ${p}`));
    lines.push('');
  }

  // Issues by severity
  if (report.summary.errorCount > 0) {
    lines.push('ERRORS');
    lines.push('-'.repeat(40));
    report.allIssues
      .filter(i => i.severity === 'error')
      .forEach(i => {
        lines.push(`[${i.path}] ${i.message}`);
        if (i.suggestion) lines.push(`  → ${i.suggestion}`);
      });
    lines.push('');
  }

  if (report.summary.warningCount > 0) {
    lines.push('WARNINGS');
    lines.push('-'.repeat(40));
    report.allIssues
      .filter(i => i.severity === 'warning')
      .forEach(i => {
        lines.push(`[${i.path}] ${i.message}`);
        if (i.suggestion) lines.push(`  → ${i.suggestion}`);
      });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get a simple health status
 */
export function getHealthStatus(report: GraphSanityReport): 'healthy' | 'degraded' | 'unhealthy' {
  if (report.summary.errorCount > 0 || report.summary.criticalFieldsWithIssues > 0) {
    return 'unhealthy';
  }
  if (report.summary.warningCount > 5) {
    return 'degraded';
  }
  return 'healthy';
}

// ============================================================================
// Wiring Fix Suggestions (Dev Helper)
// ============================================================================

/**
 * Wiring fix suggestion
 */
export interface WiringFixSuggestion {
  type: IssueType;
  action: 'add_to_wiring' | 'add_to_schema' | 'remove_from_wiring' | 'remove_from_schema' | 'migrate';
  file: 'schema.ts' | 'wiring.ts';
  path: string;
  module?: string;
  code: string;
  description: string;
}

/**
 * Generate copy-pasteable wiring fix suggestions
 * Run this in dev to quickly identify and fix schema/wiring mismatches
 */
export function autoSuggestWiringFixes(): {
  report: GraphSanityReport;
  suggestions: WiringFixSuggestion[];
  summary: string;
} {
  const report = collectGraphSanityReport();
  const suggestions: WiringFixSuggestion[] = [];

  for (const issue of report.allIssues) {
    switch (issue.type) {
      case 'primary_source_not_in_writers':
        // Primary source declared in schema but not in wiring
        suggestions.push({
          type: issue.type,
          action: 'add_to_wiring',
          file: 'wiring.ts',
          path: issue.path,
          module: issue.module,
          code: `// In FIELD_WRITERS, add '${issue.module}' to '${issue.path}':\n'${issue.path}': [...existing, '${issue.module}'],`,
          description: `Add writer '${issue.module}' for field '${issue.path}' to FIELD_WRITERS.`,
        });
        break;

      case 'writer_not_in_primary_sources':
        // Writer in wiring but not in schema primarySources
        suggestions.push({
          type: issue.type,
          action: 'add_to_schema',
          file: 'schema.ts',
          path: issue.path,
          module: issue.module,
          code: `// In CONTEXT_FIELDS, add '${issue.module}' to primarySources for '${issue.path}':\nprimarySources: [...existing, '${issue.module}'],`,
          description: `Either add '${issue.module}' to primarySources for '${issue.path}' in schema.ts, or remove from FIELD_WRITERS in wiring.ts.`,
        });
        break;

      case 'orphan_writer':
        // Path in wiring but not in schema
        suggestions.push({
          type: issue.type,
          action: 'add_to_schema',
          file: 'schema.ts',
          path: issue.path,
          code: `// Add field definition to CONTEXT_FIELDS:\n{\n  path: '${issue.path}',\n  domain: '${issue.path.split('.')[0]}',\n  field: '${issue.path.split('.')[1]}',\n  section: '${issue.path.split('.')[0]}',\n  label: '${issue.path.split('.')[1]}',\n  type: 'string',\n  primarySources: [],\n},`,
          description: `Either add field '${issue.path}' to CONTEXT_FIELDS in schema.ts, or remove this writer mapping from wiring.ts.`,
        });
        break;

      case 'deprecated_field_used':
        // Deprecated field still being written to
        suggestions.push({
          type: issue.type,
          action: 'migrate',
          file: 'wiring.ts',
          path: issue.path,
          code: `// Remove deprecated field from FIELD_WRITERS:\n// delete FIELD_WRITERS['${issue.path}'];`,
          description: `Remove writer(s) for deprecated field '${issue.path}'. Migrate to replacement field.`,
        });
        break;

      case 'no_writers':
        // Field has no writers
        if (report.allIssues.find(i => i.path === issue.path)?.severity === 'error') {
          suggestions.push({
            type: issue.type,
            action: 'add_to_wiring',
            file: 'wiring.ts',
            path: issue.path,
            code: `// Add writers for critical field:\n'${issue.path}': ['Setup'], // Add appropriate writers`,
            description: `CRITICAL: Field '${issue.path}' has no writers. Add to FIELD_WRITERS.`,
          });
        }
        break;
    }
  }

  // Generate summary
  const summary = [
    '='.repeat(60),
    'WIRING FIX SUGGESTIONS',
    '='.repeat(60),
    '',
    `Total suggestions: ${suggestions.length}`,
    `  - Add to wiring.ts: ${suggestions.filter(s => s.file === 'wiring.ts').length}`,
    `  - Add to schema.ts: ${suggestions.filter(s => s.file === 'schema.ts').length}`,
    '',
    ...suggestions.map((s, i) => [
      `${i + 1}. [${s.file}] ${s.description}`,
      `   ${s.code.split('\n')[0]}`,
      '',
    ]).flat(),
  ].join('\n');

  return { report, suggestions, summary };
}

// ============================================================================
// Critical Fields Per Flow
// ============================================================================

/**
 * Flow identifiers for critical field gating
 */
export type FlowId =
  | 'AudienceLab'
  | 'MediaLab'
  | 'CreativeLab'
  | 'BrandLab'
  | 'WebsiteLab'
  | 'StrategicPlan'
  | 'QBR'
  | 'Setup';

/**
 * Critical fields required for each flow
 * These are the minimum fields needed for quality output
 */
export const CRITICAL_FIELDS_BY_FLOW: Record<FlowId, string[]> = {
  AudienceLab: [
    'audience.icpDescription',
    'identity.industry',
    'audience.primaryAudience',
  ],
  MediaLab: [
    'objectives.primaryObjective',
    'audience.primaryAudience',
    'audience.coreSegments',
    'identity.industry',
  ],
  CreativeLab: [
    'brand.positioning',
    'brand.valueProps',
    'audience.primaryAudience',
    'audience.icpDescription',
    'audience.coreSegments',
  ],
  BrandLab: [
    'identity.businessName',
    'identity.industry',
  ],
  WebsiteLab: [
    'identity.businessName',
  ],
  StrategicPlan: [
    'identity.businessName',
    'identity.industry',
    'audience.icpDescription',
    'objectives.primaryObjective',
    'audience.primaryAudience',
    'audience.coreSegments',
    'brand.positioning',
    'brand.valueProps',
  ],
  QBR: [
    'identity.businessName',
    'objectives.primaryObjective',
    'objectives.kpiLabels',
  ],
  Setup: [
    'identity.businessName',
    'identity.industry',
  ],
};

/**
 * Get critical field definitions for a flow
 */
export function getCriticalFieldsForFlow(flowId: FlowId): ContextFieldDef[] {
  const paths = CRITICAL_FIELDS_BY_FLOW[flowId] || [];
  return paths.map(p => getFieldDef(p)).filter((f): f is ContextFieldDef => f !== undefined);
}

/**
 * Check which critical fields are missing for a company and flow
 * Returns field definitions for fields that are null/empty in the graph
 */
export async function getMissingCriticalFieldsForFlow(
  companyId: string,
  flowId: FlowId
): Promise<ContextFieldDef[]> {
  // Lazy import to avoid circular dependency
  const { loadContextGraph } = await import('./storage');

  const graph = await loadContextGraph(companyId);
  if (!graph) {
    // No graph = all fields missing
    return getCriticalFieldsForFlow(flowId);
  }

  const criticalFields = getCriticalFieldsForFlow(flowId);
  const missingFields: ContextFieldDef[] = [];

  for (const fieldDef of criticalFields) {
    const domainObj = graph[fieldDef.domain as keyof typeof graph];
    if (!domainObj || typeof domainObj !== 'object') {
      missingFields.push(fieldDef);
      continue;
    }

    const fieldData = (domainObj as Record<string, { value: unknown }>)[fieldDef.field];
    if (!fieldData || fieldData.value === null || fieldData.value === undefined) {
      missingFields.push(fieldDef);
      continue;
    }

    // Check for empty arrays
    if (Array.isArray(fieldData.value) && fieldData.value.length === 0) {
      missingFields.push(fieldDef);
      continue;
    }

    // Check for empty strings
    if (typeof fieldData.value === 'string' && fieldData.value.trim() === '') {
      missingFields.push(fieldDef);
    }
  }

  return missingFields;
}

/**
 * Result of critical fields check
 */
export interface CriticalFieldsCheckResult {
  flowId: FlowId;
  requiredFields: ContextFieldDef[];
  missingFields: ContextFieldDef[];
  populatedFields: ContextFieldDef[];
  isComplete: boolean;
  completionPercent: number;
  gatingLevel: 'none' | 'soft' | 'hard';
  warningMessage?: string;
}

/**
 * Check critical fields and determine gating level
 */
export async function checkCriticalFieldsForFlow(
  companyId: string,
  flowId: FlowId
): Promise<CriticalFieldsCheckResult> {
  const requiredFields = getCriticalFieldsForFlow(flowId);
  const missingFields = await getMissingCriticalFieldsForFlow(companyId, flowId);
  const populatedFields = requiredFields.filter(f => !missingFields.includes(f));

  const completionPercent = requiredFields.length > 0
    ? Math.round((populatedFields.length / requiredFields.length) * 100)
    : 100;

  // Determine gating level based on what's missing
  let gatingLevel: 'none' | 'soft' | 'hard' = 'none';
  let warningMessage: string | undefined;

  if (missingFields.length > 0) {
    // Hard gate if more than 50% missing or specific critical fields missing
    const hardGateThreshold = 0.5;
    const hardGateFields = ['audience.icpDescription', 'identity.businessName'];

    const hasHardGateField = missingFields.some(f => hardGateFields.includes(f.path));
    const missingRatio = missingFields.length / requiredFields.length;

    if (hasHardGateField && flowId !== 'Setup' && flowId !== 'WebsiteLab' && flowId !== 'BrandLab') {
      gatingLevel = 'hard';
      warningMessage = `Cannot run ${flowId}: Missing required fields (${missingFields.map(f => f.label).join(', ')}). Complete Setup first.`;
    } else if (missingRatio >= hardGateThreshold) {
      gatingLevel = 'hard';
      warningMessage = `Cannot run ${flowId}: Too many required fields missing (${missingFields.length}/${requiredFields.length}). Complete Setup first.`;
    } else {
      gatingLevel = 'soft';
      warningMessage = `${flowId} is running without: ${missingFields.map(f => f.label).join(', ')}. Results may be lower quality.`;
    }
  }

  return {
    flowId,
    requiredFields,
    missingFields,
    populatedFields,
    isComplete: missingFields.length === 0,
    completionPercent,
    gatingLevel,
    warningMessage,
  };
}

// ============================================================================
// Per-Company Context Health
// ============================================================================

/**
 * Section health stats
 */
export interface SectionHealthStats {
  section: ContextSectionId;
  label: string;
  totalFields: number;
  populatedFields: number;
  criticalFields: number;
  criticalPopulated: number;
  completionPercent: number;
  criticalCompletionPercent: number;
}

/**
 * Overall context health for a company
 */
export interface CompanyContextHealth {
  companyId: string;
  generatedAt: string;
  overallStatus: 'healthy' | 'degraded' | 'needs_attention';
  overallCompletionPercent: number;
  criticalCompletionPercent: number;
  totalFields: number;
  populatedFields: number;
  criticalFields: number;
  criticalPopulated: number;
  sectionHealth: SectionHealthStats[];
  missingCriticalFields: ContextFieldDef[];
  recommendedNextActions: Array<{
    action: string;
    path: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Calculate context health for a company
 */
export async function getCompanyContextHealth(
  companyId: string
): Promise<CompanyContextHealth> {
  // Lazy import to avoid circular dependency
  const { loadContextGraph } = await import('./storage');

  const graph = await loadContextGraph(companyId);

  // Group fields by section
  const sectionGroups = new Map<ContextSectionId, ContextFieldDef[]>();
  for (const field of CONTEXT_FIELDS) {
    if (field.deprecated) continue;
    const existing = sectionGroups.get(field.section) || [];
    existing.push(field);
    sectionGroups.set(field.section, existing);
  }

  const sectionHealth: SectionHealthStats[] = [];
  let totalFields = 0;
  let populatedFields = 0;
  let criticalFields = 0;
  let criticalPopulated = 0;
  const missingCriticalFields: ContextFieldDef[] = [];

  const sectionLabels: Record<ContextSectionId, string> = {
    identity: 'Identity',
    audience: 'Audience',
    brand: 'Brand',
    website: 'Website',
    media: 'Media',
    creative: 'Creative',
    objectives: 'Objectives',
    constraints: 'Budget & Constraints',
    productOffer: 'Product/Offer',
    content: 'Content',
    seo: 'SEO',
    ops: 'Operations',
    competitive: 'Competitive',
    historical: 'Historical',
    storeRisk: 'Store Risk',
  };

  for (const [section, fields] of sectionGroups) {
    let sectionPopulated = 0;
    let sectionCritical = 0;
    let sectionCriticalPopulated = 0;

    for (const fieldDef of fields) {
      totalFields++;
      if (fieldDef.critical) {
        criticalFields++;
        sectionCritical++;
      }

      const isPopulated = graph ? checkFieldPopulated(graph, fieldDef) : false;

      if (isPopulated) {
        populatedFields++;
        sectionPopulated++;
        if (fieldDef.critical) {
          criticalPopulated++;
          sectionCriticalPopulated++;
        }
      } else if (fieldDef.critical) {
        missingCriticalFields.push(fieldDef);
      }
    }

    sectionHealth.push({
      section,
      label: sectionLabels[section] || section,
      totalFields: fields.length,
      populatedFields: sectionPopulated,
      criticalFields: sectionCritical,
      criticalPopulated: sectionCriticalPopulated,
      completionPercent: fields.length > 0 ? Math.round((sectionPopulated / fields.length) * 100) : 100,
      criticalCompletionPercent: sectionCritical > 0 ? Math.round((sectionCriticalPopulated / sectionCritical) * 100) : 100,
    });
  }

  // Sort sections by critical completion (ascending) so incomplete sections are first
  sectionHealth.sort((a, b) => a.criticalCompletionPercent - b.criticalCompletionPercent);

  // Calculate overall stats
  const overallCompletionPercent = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
  const overallCriticalPercent = criticalFields > 0 ? Math.round((criticalPopulated / criticalFields) * 100) : 100;

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'needs_attention' = 'healthy';
  if (overallCriticalPercent < 50) {
    overallStatus = 'needs_attention';
  } else if (overallCriticalPercent < 80) {
    overallStatus = 'degraded';
  }

  // Generate recommended next actions
  const recommendedNextActions: CompanyContextHealth['recommendedNextActions'] = [];

  // Prioritize missing critical fields
  for (const field of missingCriticalFields.slice(0, 5)) {
    recommendedNextActions.push({
      action: `Fill "${field.label}"`,
      path: field.primarySources.includes('Setup') ? '/brain/setup' : '/brain/context',
      priority: 'high',
    });
  }

  // Add section-level recommendations
  for (const section of sectionHealth.slice(0, 3)) {
    if (section.criticalCompletionPercent < 100 && recommendedNextActions.length < 8) {
      recommendedNextActions.push({
        action: `Complete ${section.label} section`,
        path: '/brain/setup',
        priority: section.criticalCompletionPercent < 50 ? 'high' : 'medium',
      });
    }
  }

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    overallStatus,
    overallCompletionPercent,
    criticalCompletionPercent: overallCriticalPercent,
    totalFields,
    populatedFields,
    criticalFields,
    criticalPopulated,
    sectionHealth,
    missingCriticalFields,
    recommendedNextActions,
  };
}

/**
 * Check if a field is populated in the graph
 */
function checkFieldPopulated(
  graph: Record<string, unknown>,
  fieldDef: ContextFieldDef
): boolean {
  const domainObj = graph[fieldDef.domain];
  if (!domainObj || typeof domainObj !== 'object') return false;

  const fieldData = (domainObj as Record<string, { value: unknown }>)[fieldDef.field];
  if (!fieldData || fieldData.value === null || fieldData.value === undefined) return false;

  // Check for empty arrays
  if (Array.isArray(fieldData.value) && fieldData.value.length === 0) return false;

  // Check for empty strings
  if (typeof fieldData.value === 'string' && fieldData.value.trim() === '') return false;

  return true;
}

// ============================================================================
// Auto-Fill Mode Diagnostics
// ============================================================================

/**
 * Result from auto-fill coverage analysis
 */
export interface AutoFillCoverageReport {
  generatedAt: string;
  /** Fields that can be auto-filled and have writers */
  autoFieldsWithWriters: ContextFieldDef[];
  /** Fields that can be auto-filled but have NO writers - needs fixing */
  autoFieldsNeedingWriters: ContextFieldDef[];
  /** Fields where AI assists (not auto-fills) */
  assistFields: ContextFieldDef[];
  /** Fields requiring manual input */
  manualFields: ContextFieldDef[];
  /** Summary stats */
  summary: {
    totalFields: number;
    autoFields: number;
    autoWithWriters: number;
    autoNeedingWriters: number;
    assistFields: number;
    manualFields: number;
    autoCoveragePercent: number;
  };
  /** Grouped by domain for easier fixing */
  autoNeedingWritersByDomain: Record<string, ContextFieldDef[]>;
}

/**
 * Get all auto-fillable fields that currently have no writers.
 * These are fields that SHOULD be auto-filled but have no registered writer.
 * Use this to identify gaps in FCB/Lab coverage.
 */
export function getAutoFieldsNeedingWriters(): ContextFieldDef[] {
  const report = collectGraphSanityReport();

  return CONTEXT_FIELDS.filter(field => {
    // Skip deprecated
    if (field.deprecated) return false;

    // Only care about auto-fillable fields
    if (getAutoFillMode(field) !== 'auto') return false;

    // Check if this field has no writers or primary source not in writers
    const fieldReport = Object.values(report.fieldsBySection)
      .flat()
      .find(r => r.path === field.path);

    if (!fieldReport) return false;

    // Field needs writers if it has none, or if primary sources aren't wired
    return fieldReport.writers.length === 0 ||
      fieldReport.issues.some(i =>
        i.type === 'no_writers' ||
        i.type === 'primary_source_not_in_writers'
      );
  });
}

/**
 * Collect comprehensive auto-fill coverage report
 * Shows which auto fields have writers vs need writers
 */
export function collectAutoFillCoverageReport(): AutoFillCoverageReport {
  const sanityReport = collectGraphSanityReport();

  const autoFieldsWithWriters: ContextFieldDef[] = [];
  const autoFieldsNeedingWriters: ContextFieldDef[] = [];
  const assistFields: ContextFieldDef[] = [];
  const manualFields: ContextFieldDef[] = [];

  for (const field of CONTEXT_FIELDS) {
    if (field.deprecated) continue;

    const mode = getAutoFillMode(field);
    const writers = getWritersForField(field.path);

    if (mode === 'manual') {
      manualFields.push(field);
    } else if (mode === 'assist') {
      assistFields.push(field);
    } else {
      // Auto mode
      if (writers.length > 0) {
        autoFieldsWithWriters.push(field);
      } else {
        autoFieldsNeedingWriters.push(field);
      }
    }
  }

  // Group needing-writers by domain
  const autoNeedingWritersByDomain: Record<string, ContextFieldDef[]> = {};
  for (const field of autoFieldsNeedingWriters) {
    if (!autoNeedingWritersByDomain[field.domain]) {
      autoNeedingWritersByDomain[field.domain] = [];
    }
    autoNeedingWritersByDomain[field.domain].push(field);
  }

  const totalAuto = autoFieldsWithWriters.length + autoFieldsNeedingWriters.length;
  const autoCoveragePercent = totalAuto > 0
    ? Math.round((autoFieldsWithWriters.length / totalAuto) * 100)
    : 100;

  return {
    generatedAt: new Date().toISOString(),
    autoFieldsWithWriters,
    autoFieldsNeedingWriters,
    assistFields,
    manualFields,
    summary: {
      totalFields: CONTEXT_FIELDS.filter(f => !f.deprecated).length,
      autoFields: totalAuto,
      autoWithWriters: autoFieldsWithWriters.length,
      autoNeedingWriters: autoFieldsNeedingWriters.length,
      assistFields: assistFields.length,
      manualFields: manualFields.length,
      autoCoveragePercent,
    },
    autoNeedingWritersByDomain,
  };
}

/**
 * Format auto-fill coverage report for console
 */
export function formatAutoFillCoverageForConsole(report: AutoFillCoverageReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('AUTO-FILL COVERAGE REPORT');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('='.repeat(60));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(`Total fields: ${report.summary.totalFields}`);
  lines.push(`  - Auto-fillable: ${report.summary.autoFields} (${report.summary.autoCoveragePercent}% have writers)`);
  lines.push(`    - With writers: ${report.summary.autoWithWriters}`);
  lines.push(`    - NEEDING writers: ${report.summary.autoNeedingWriters}`);
  lines.push(`  - Assist mode: ${report.summary.assistFields}`);
  lines.push(`  - Manual only: ${report.summary.manualFields}`);
  lines.push('');

  // Auto fields needing writers (grouped by domain)
  if (report.summary.autoNeedingWriters > 0) {
    lines.push('AUTO FIELDS NEEDING WRITERS (by domain):');
    lines.push('-'.repeat(40));

    for (const [domain, fields] of Object.entries(report.autoNeedingWritersByDomain)) {
      lines.push(`\n${domain.toUpperCase()} (${fields.length} fields):`);
      for (const field of fields) {
        const sources = field.primarySources.join(', ') || 'none declared';
        lines.push(`  - ${field.path}`);
        lines.push(`    Label: ${field.label}`);
        lines.push(`    Expected sources: ${sources}`);
      }
    }
    lines.push('');
  }

  // Manual fields (for reference)
  if (report.manualFields.length > 0) {
    lines.push('MANUAL-ONLY FIELDS (require human input):');
    lines.push('-'.repeat(40));
    for (const field of report.manualFields) {
      lines.push(`  - ${field.path}: ${field.label}`);
    }
    lines.push('');
  }

  // Assist fields (for reference)
  if (report.assistFields.length > 0) {
    lines.push('ASSIST FIELDS (AI helps, doesn\'t invent):');
    lines.push('-'.repeat(40));
    for (const field of report.assistFields) {
      lines.push(`  - ${field.path}: ${field.label}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
