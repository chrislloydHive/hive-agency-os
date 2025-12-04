// lib/contextGraph/migrate.ts
// Schema Evolution & Migration (Phase 2)
//
// Handles versioned context graphs with automatic migrations.
// Ensures backward compatibility as the schema evolves.

import type { CompanyContextGraph } from './companyContextGraph';
import { normalizeProvenance, normalizeProvenanceArray } from './types';

// ============================================================================
// Version Constants
// ============================================================================

/**
 * Current schema version
 * Increment when making breaking changes to the schema
 */
export const CURRENT_SCHEMA_VERSION = '2.0.0';

/**
 * Minimum supported version for migration
 */
export const MIN_SUPPORTED_VERSION = '1.0.0';

/**
 * Version history for documentation
 */
export const VERSION_HISTORY = [
  {
    version: '1.0.0',
    date: '2024-11-01',
    description: 'Initial Context Graph schema (Phase 1)',
    changes: ['Initial domain schemas', 'Provenance tracking with timestamp field'],
  },
  {
    version: '2.0.0',
    date: '2024-12-01',
    description: 'Phase 2 temporal and conflict resolution',
    changes: [
      'Renamed timestamp to updatedAt in ProvenanceTag',
      'Added validForDays for freshness decay',
      'Added sourceRunId field',
      'Added ContextSource enum with new sources',
    ],
  },
];

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Migration function signature
 */
type MigrationFn = (graph: unknown) => unknown;

/**
 * Migration step definition
 */
interface MigrationStep {
  from: string;
  to: string;
  migrate: MigrationFn;
  description: string;
}

/**
 * Result of a migration
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationsApplied: string[];
  warnings: string[];
  error?: string;
}

// ============================================================================
// Migration Registry
// ============================================================================

/**
 * All available migrations
 */
const MIGRATIONS: MigrationStep[] = [
  {
    from: '1.0.0',
    to: '2.0.0',
    description: 'Migrate provenance timestamp to updatedAt',
    migrate: migrateV1ToV2,
  },
];

/**
 * Migration from v1.0.0 to v2.0.0
 * - Converts timestamp to updatedAt in all provenance tags
 * - Adds default validForDays based on source
 */
function migrateV1ToV2(graph: unknown): unknown {
  if (!graph || typeof graph !== 'object') return graph;

  const g = graph as Record<string, unknown>;

  // Deep clone to avoid mutations
  const migrated = JSON.parse(JSON.stringify(g));

  // Helper to migrate provenance arrays
  function migrateProvenance(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(migrateProvenance);
    }

    const record = obj as Record<string, unknown>;

    // Check if this is a WithMeta object
    if ('value' in record && 'provenance' in record) {
      const provenance = record.provenance;
      if (Array.isArray(provenance)) {
        record.provenance = normalizeProvenanceArray(provenance);
      }
      return record;
    }

    // Recurse into nested objects
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'meta' && typeof value === 'object' && value !== null) {
        record[key] = migrateProvenance(value);
      }
    }

    return record;
  }

  // Migrate all domains
  const domains = [
    'identity',
    'brand',
    'objectives',
    'audience',
    'productOffer',
    'digitalInfra',
    'website',
    'content',
    'seo',
    'ops',
    'performanceMedia',
    'budgetOps',
    'storeRisk',
  ];

  for (const domain of domains) {
    if (migrated[domain]) {
      migrated[domain] = migrateProvenance(migrated[domain]);
    }
  }

  // Update meta
  if (migrated.meta && typeof migrated.meta === 'object') {
    (migrated.meta as Record<string, unknown>).version = '2.0.0';
    (migrated.meta as Record<string, unknown>).updatedAt = new Date().toISOString();
  }

  return migrated;
}

// ============================================================================
// Migration Engine
// ============================================================================

/**
 * Get the version of a context graph
 */
export function getGraphVersion(graph: unknown): string {
  if (!graph || typeof graph !== 'object') return '1.0.0';

  const g = graph as Record<string, unknown>;
  const meta = g.meta as Record<string, unknown> | undefined;

  if (meta && typeof meta.version === 'string') {
    return meta.version;
  }

  // Default to 1.0.0 for graphs without version
  return '1.0.0';
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const va = partsA[i] || 0;
    const vb = partsB[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }

  return 0;
}

/**
 * Check if a graph needs migration
 */
export function needsMigration(graph: unknown): boolean {
  const version = getGraphVersion(graph);
  return compareVersions(version, CURRENT_SCHEMA_VERSION) < 0;
}

/**
 * Check if a version is supported for migration
 */
export function isVersionSupported(version: string): boolean {
  return compareVersions(version, MIN_SUPPORTED_VERSION) >= 0;
}

/**
 * Get migration path from one version to another
 */
function getMigrationPath(
  fromVersion: string,
  toVersion: string
): MigrationStep[] {
  const path: MigrationStep[] = [];
  let currentVersion = fromVersion;

  while (compareVersions(currentVersion, toVersion) < 0) {
    const nextMigration = MIGRATIONS.find((m) => m.from === currentVersion);
    if (!nextMigration) {
      break; // No more migrations available
    }
    path.push(nextMigration);
    currentVersion = nextMigration.to;
  }

  return path;
}

/**
 * Migrate a context graph to the latest version
 *
 * @param graph - The context graph to migrate
 * @param targetVersion - Target version (defaults to latest)
 * @returns Migrated graph and migration result
 */
export function migrateGraph(
  graph: unknown,
  targetVersion: string = CURRENT_SCHEMA_VERSION
): { graph: CompanyContextGraph; result: MigrationResult } {
  const fromVersion = getGraphVersion(graph);
  const warnings: string[] = [];
  const migrationsApplied: string[] = [];

  // Check if already at target version
  if (compareVersions(fromVersion, targetVersion) >= 0) {
    return {
      graph: graph as CompanyContextGraph,
      result: {
        success: true,
        fromVersion,
        toVersion: fromVersion,
        migrationsApplied: [],
        warnings: [],
      },
    };
  }

  // Check if version is supported
  if (!isVersionSupported(fromVersion)) {
    return {
      graph: graph as CompanyContextGraph,
      result: {
        success: false,
        fromVersion,
        toVersion: targetVersion,
        migrationsApplied: [],
        warnings: [],
        error: `Version ${fromVersion} is below minimum supported version ${MIN_SUPPORTED_VERSION}`,
      },
    };
  }

  // Get migration path
  const migrationPath = getMigrationPath(fromVersion, targetVersion);

  if (migrationPath.length === 0) {
    warnings.push(`No migration path from ${fromVersion} to ${targetVersion}`);
    return {
      graph: graph as CompanyContextGraph,
      result: {
        success: false,
        fromVersion,
        toVersion: targetVersion,
        migrationsApplied: [],
        warnings,
        error: `No migration path available`,
      },
    };
  }

  // Apply migrations
  let currentGraph = graph;
  let currentVersion = fromVersion;

  try {
    for (const migration of migrationPath) {
      currentGraph = migration.migrate(currentGraph);
      migrationsApplied.push(`${migration.from} → ${migration.to}: ${migration.description}`);
      currentVersion = migration.to;
    }

    return {
      graph: currentGraph as CompanyContextGraph,
      result: {
        success: true,
        fromVersion,
        toVersion: currentVersion,
        migrationsApplied,
        warnings,
      },
    };
  } catch (error) {
    return {
      graph: graph as CompanyContextGraph,
      result: {
        success: false,
        fromVersion,
        toVersion: targetVersion,
        migrationsApplied,
        warnings,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Ensure a graph is at the current version
 * Automatically migrates if needed
 */
export function ensureCurrentVersion(
  graph: unknown
): CompanyContextGraph {
  const { graph: migrated, result } = migrateGraph(graph);

  if (!result.success) {
    console.warn(
      `[ContextGraph Migration] Migration failed: ${result.error}`,
      result
    );
  } else if (result.migrationsApplied.length > 0) {
    console.log(
      `[ContextGraph Migration] Migrated from ${result.fromVersion} to ${result.toVersion}`,
      result.migrationsApplied
    );
  }

  return migrated;
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validation result for schema checking
 */
export interface ValidationResult {
  isValid: boolean;
  version: string;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a context graph structure
 */
export function validateGraph(graph: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!graph || typeof graph !== 'object') {
    return {
      isValid: false,
      version: 'unknown',
      errors: ['Graph is not an object'],
      warnings: [],
    };
  }

  const g = graph as Record<string, unknown>;

  // Check required fields
  if (!g.companyId) errors.push('Missing companyId');
  if (!g.companyName) errors.push('Missing companyName');
  if (!g.meta) errors.push('Missing meta');

  // Check domains exist
  const expectedDomains = [
    'identity',
    'brand',
    'objectives',
    'audience',
    'productOffer',
    'digitalInfra',
    'website',
    'content',
    'seo',
    'ops',
    'performanceMedia',
    'budgetOps',
    'storeRisk',
  ];

  for (const domain of expectedDomains) {
    if (!g[domain]) {
      warnings.push(`Missing domain: ${domain}`);
    }
  }

  const version = getGraphVersion(graph);

  // Version-specific validation
  if (version === '2.0.0') {
    // Check for updatedAt in provenance (sample check)
    const sampleField = (g.identity as Record<string, unknown>)?.businessName as
      | Record<string, unknown>
      | undefined;
    if (sampleField?.provenance) {
      const prov = (sampleField.provenance as unknown[])[0] as
        | Record<string, unknown>
        | undefined;
      if (prov && !prov.updatedAt && prov.timestamp) {
        warnings.push('Found provenance with old timestamp field - migration may be needed');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    version,
    errors,
    warnings,
  };
}
