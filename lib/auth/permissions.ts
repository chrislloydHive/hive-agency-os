// lib/auth/permissions.ts
// Role-based permissions system for Hive OS

/**
 * User roles in Hive OS
 *
 * - admin: Full access to everything
 * - strategist: Can edit strategy, run diagnostics, manage work items
 * - analyst: Can view everything, run diagnostics, but cannot edit strategy
 * - readonly: View-only access
 */
export type HiveRole = 'admin' | 'strategist' | 'analyst' | 'readonly';

/**
 * Permission check result
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * User context for permission checks
 */
export interface UserContext {
  userId: string;
  email?: string;
  role: HiveRole;
  companyAccess?: string[]; // Company IDs user has access to
}

// ============================================================================
// Role Lookups
// ============================================================================

/**
 * Get user role for a specific company
 *
 * TODO: Implement actual lookup via DB/Airtable
 * For now, returns a default role for development
 *
 * @param userId - The user's ID
 * @param companyId - The company ID to check access for
 * @returns The user's role for that company
 */
export async function getUserRoleForCompany(
  userId: string,
  companyId: string
): Promise<HiveRole> {
  // TODO: Implement actual database lookup
  // For now, default to strategist for development
  console.log(`[Auth] Getting role for user ${userId} on company ${companyId}`);

  // Placeholder: In production, this would query a user_company_roles table
  // or similar to determine the user's actual role

  return 'strategist';
}

/**
 * Check if user has access to a company
 *
 * @param userId - The user's ID
 * @param companyId - The company ID to check
 * @returns true if user has any access to the company
 */
export async function hasCompanyAccess(
  userId: string,
  companyId: string
): Promise<boolean> {
  // TODO: Implement actual access check
  // For now, allow access for development
  const role = await getUserRoleForCompany(userId, companyId);
  return role !== null;
}

// ============================================================================
// Permission Checks
// ============================================================================

/**
 * Check if role can edit strategy (SSM, objectives, personas)
 */
export function canEditStrategy(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist';
}

/**
 * Check if role can view QBR
 */
export function canViewQbr(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist' || role === 'analyst';
}

/**
 * Check if role can edit QBR (finalize, export)
 */
export function canEditQbr(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist';
}

/**
 * Check if role can edit setup (SSM)
 */
export function canEditSetup(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist';
}

/**
 * Check if role can view setup
 */
export function canViewSetup(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist' || role === 'analyst';
}

/**
 * Check if role can edit work items
 */
export function canEditWork(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist';
}

/**
 * Check if role can create work items
 */
export function canCreateWork(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist' || role === 'analyst';
}

/**
 * Check if role can run diagnostics
 */
export function canRunDiagnostics(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist' || role === 'analyst';
}

/**
 * Check if role can edit company settings
 */
export function canEditCompanySettings(role: HiveRole): boolean {
  return role === 'admin';
}

/**
 * Check if role can view media data
 */
export function canViewMedia(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist' || role === 'analyst';
}

/**
 * Check if role can edit media plans
 */
export function canEditMediaPlans(role: HiveRole): boolean {
  return role === 'admin' || role === 'strategist';
}

/**
 * Check if role has admin access
 */
export function isAdmin(role: HiveRole): boolean {
  return role === 'admin';
}

// ============================================================================
// Role Display Helpers
// ============================================================================

/**
 * Get display label for role
 */
export function getRoleLabel(role: HiveRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'strategist':
      return 'Strategist';
    case 'analyst':
      return 'Analyst';
    case 'readonly':
      return 'Viewer';
  }
}

/**
 * Get role description
 */
export function getRoleDescription(role: HiveRole): string {
  switch (role) {
    case 'admin':
      return 'Full access to all features and settings';
    case 'strategist':
      return 'Can edit strategy, run diagnostics, and manage work';
    case 'analyst':
      return 'Can view all data and run diagnostics';
    case 'readonly':
      return 'View-only access to company data';
  }
}

/**
 * Get role color classes for UI
 */
export function getRoleColors(role: HiveRole): {
  bg: string;
  text: string;
  border: string;
} {
  switch (role) {
    case 'admin':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
      };
    case 'strategist':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'analyst':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'readonly':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
  }
}

// ============================================================================
// Permission Check with Reason
// ============================================================================

/**
 * Check a specific permission with reason for denial
 */
export function checkPermission(
  role: HiveRole,
  permission:
    | 'edit_strategy'
    | 'view_qbr'
    | 'edit_qbr'
    | 'edit_setup'
    | 'view_setup'
    | 'edit_work'
    | 'create_work'
    | 'run_diagnostics'
    | 'edit_company_settings'
    | 'view_media'
    | 'edit_media_plans'
): PermissionCheck {
  const checks: Record<typeof permission, () => boolean> = {
    edit_strategy: () => canEditStrategy(role),
    view_qbr: () => canViewQbr(role),
    edit_qbr: () => canEditQbr(role),
    edit_setup: () => canEditSetup(role),
    view_setup: () => canViewSetup(role),
    edit_work: () => canEditWork(role),
    create_work: () => canCreateWork(role),
    run_diagnostics: () => canRunDiagnostics(role),
    edit_company_settings: () => canEditCompanySettings(role),
    view_media: () => canViewMedia(role),
    edit_media_plans: () => canEditMediaPlans(role),
  };

  const allowed = checks[permission]();

  if (allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Your role (${getRoleLabel(role)}) does not have permission to ${permission.replace(/_/g, ' ')}.`,
  };
}
