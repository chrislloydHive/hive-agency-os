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
