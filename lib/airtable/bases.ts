/**
 * Explicit Airtable base IDs — do not use a single generic env for all contexts.
 * Legacy: when AIRTABLE_OS_BASE_ID is unset, OS base falls back to AIRTABLE_BASE_ID.
 */

export const BASES = {
  OS: process.env.AIRTABLE_OS_BASE_ID ?? '',
  PROJECTS: process.env.AIRTABLE_PROJECTS_BASE_ID ?? '',
  INBOUND: process.env.AIRTABLE_INBOUND_BASE_ID ?? '',
  /** Optional: Command Center / lib/airtable/tasks when Tasks live outside OS base */
  TASKS: process.env.AIRTABLE_TASKS_BASE_ID ?? '',
  /** Optional: Activity Log base — see {@link resolveActivityLogBaseId}. */
  ACTIVITY_LOG: process.env.AIRTABLE_ACTIVITY_LOG_BASE_ID ?? '',
  /**
   * Optional: GAP-IA Run / GAP-Plan Run tables.
   * When unset, {@link resolveGapRunsBaseId} uses Hive DB then OS (see that function).
   */
  GAP_RUNS: process.env.AIRTABLE_GAP_RUNS_BASE_ID ?? '',
} as const;

/** OS / primary Hive base */
export function resolveOsBaseId(): string {
  const os = BASES.OS.trim();
  if (os) return os;
  return process.env.AIRTABLE_BASE_ID?.trim() ?? '';
}

/** Projects table (e.g. review portal tokens): dedicated base, else same as OS */
export function resolveProjectsBaseId(): string {
  const alias = process.env.REVIEW_PROJECTS_BASE_ID?.trim() ?? '';
  const p = BASES.PROJECTS.trim() || alias;
  if (p) return p;
  return resolveOsBaseId();
}

/** Inbox / inbound tables: dedicated base, else same as OS */
export function resolveInboundBaseId(): string {
  const i = BASES.INBOUND.trim();
  if (i) return i;
  return resolveOsBaseId();
}

/** Team Tasks table (Command Center): dedicated base, else same as OS */
export function resolveTasksBaseId(): string {
  const t = BASES.TASKS.trim();
  if (t) return t;
  return resolveOsBaseId();
}

/**
 * Base containing the Activity Log table.
 *
 * Order: `AIRTABLE_ACTIVITY_LOG_BASE_ID` → `AIRTABLE_DB_BASE_ID` → OS base.
 * Hive setups usually put Activity Log in the DB base with Tasks; the PM OS base
 * often has no table or no token access → 403 if we only used OS.
 * If your log lives only in OS but `AIRTABLE_DB_BASE_ID` is set for other data,
 * set `AIRTABLE_ACTIVITY_LOG_BASE_ID` to the OS base id explicitly.
 */
export function resolveActivityLogBaseId(): string {
  const explicit = BASES.ACTIVITY_LOG.trim();
  if (explicit) return explicit;
  const db = process.env.AIRTABLE_DB_BASE_ID?.trim();
  if (db) return db;
  return resolveOsBaseId();
}

/**
 * Base that contains `GAP-IA Run` and `GAP-Plan Run`.
 *
 * Order: `AIRTABLE_GAP_RUNS_BASE_ID` → `AIRTABLE_DB_BASE_ID` → OS base.
 * Hive deployments often store GAP runs in the DB base while PM/OS uses a different base;
 * listing against OS only yields 403 if those tables are not in the OS base.
 */
export function resolveGapRunsBaseId(): string {
  const explicit = BASES.GAP_RUNS.trim();
  if (explicit) return explicit;
  const db = process.env.AIRTABLE_DB_BASE_ID?.trim();
  if (db) return db;
  return resolveOsBaseId();
}
