// lib/companies/media.ts
// Cross-cutting helper utilities for Media Program visibility
//
// This module provides a single source of truth for determining
// whether media features should be displayed for a company.

import type { CompanyRecord } from '@/lib/airtable/companies';

/**
 * Check if a company has an active media program
 *
 * Use this function everywhere media visibility is needed:
 * - Company Dashboard media card
 * - Blueprint "Media & Demand Engine" section
 * - Media tab page content
 *
 * @param company - CompanyRecord or null/undefined
 * @returns true if the company has an active media program
 */
export function companyHasMediaProgram(
  company: CompanyRecord | null | undefined
): boolean {
  return !!company && company.hasMediaProgram === true;
}

/**
 * Type guard to narrow company type based on media program status
 */
export function isMediaProgramCompany(
  company: CompanyRecord | null | undefined
): company is CompanyRecord & { hasMediaProgram: true } {
  return companyHasMediaProgram(company);
}
