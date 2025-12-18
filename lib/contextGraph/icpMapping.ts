// lib/contextGraph/icpMapping.ts
// Shared ICP Field Mapping
//
// This file defines the canonical ICP fields and their mappings to:
// - Context Graph paths
// - Setup wizard fields
// - Strategic Plan fields
//
// All features that read/write ICP data should use these mappings
// to ensure consistency across the system.

import type { CompanyProfile } from './domains/audience';

// ============================================================================
// ICP Field Definitions
// ============================================================================

/**
 * The canonical ICP (Ideal Customer Profile) structure
 *
 * This is the authoritative representation of who the company serves.
 * Labs MUST respect this when generating segments/personas.
 */
export interface CanonicalICPFields {
  /** Full description of the ideal customer (audience.icpDescription) */
  icpDescription?: string;

  /** Primary audience description - who we serve (audience.primaryAudience) */
  primaryAudience?: string;

  /** Primary buyer roles - decision makers, influencers (audience.primaryBuyerRoles) */
  primaryBuyerRoles?: string[];

  /** Company profile for B2B targeting (audience.companyProfile) */
  companyProfile?: CompanyProfile;
}

/**
 * Context Graph paths for ICP fields
 */
export const ICP_CONTEXT_PATHS = {
  icpDescription: 'audience.icpDescription',
  primaryAudience: 'audience.primaryAudience',
  primaryBuyerRoles: 'audience.primaryBuyerRoles',
  companyProfile: 'audience.companyProfile',
} as const;

/**
 * All ICP field paths as an array (for iteration)
 */
export const ICP_FIELD_PATHS = Object.values(ICP_CONTEXT_PATHS);

// ============================================================================
// Setup Wizard Mappings
// ============================================================================

/**
 * Setup wizard field names that map to ICP fields
 */
export const SETUP_TO_ICP_MAPPING: Record<string, keyof typeof ICP_CONTEXT_PATHS> = {
  // Setup field name → ICP field key
  'targetAudience': 'primaryAudience',
  'idealCustomer': 'icpDescription',
  'buyerRoles': 'primaryBuyerRoles',
  'targetCompanySize': 'companyProfile',
  'targetIndustries': 'companyProfile',
};

/**
 * Convert Setup wizard form data to ICP fields
 */
export function setupFormToICP(formData: Record<string, unknown>): CanonicalICPFields {
  const icp: CanonicalICPFields = {};

  if (typeof formData.targetAudience === 'string' && formData.targetAudience.trim()) {
    icp.primaryAudience = formData.targetAudience.trim();
  }

  if (typeof formData.idealCustomer === 'string' && formData.idealCustomer.trim()) {
    icp.icpDescription = formData.idealCustomer.trim();
  }

  if (Array.isArray(formData.buyerRoles) && formData.buyerRoles.length > 0) {
    icp.primaryBuyerRoles = formData.buyerRoles.filter(
      (r): r is string => typeof r === 'string' && r.trim().length > 0
    );
  }

  // Build company profile from multiple fields
  const companyProfile: CompanyProfile = {
    sizeRange: null,
    stage: null,
    industries: null,
  };

  if (typeof formData.targetCompanySize === 'string' && formData.targetCompanySize.trim()) {
    companyProfile.sizeRange = formData.targetCompanySize.trim();
  }

  if (typeof formData.companyStage === 'string' && formData.companyStage.trim()) {
    companyProfile.stage = formData.companyStage.trim();
  }

  if (Array.isArray(formData.targetIndustries) && formData.targetIndustries.length > 0) {
    companyProfile.industries = formData.targetIndustries.filter(
      (i): i is string => typeof i === 'string' && i.trim().length > 0
    );
  }

  // Only include company profile if at least one field is set
  if (companyProfile.sizeRange || companyProfile.stage || companyProfile.industries?.length) {
    icp.companyProfile = companyProfile;
  }

  return icp;
}

// ============================================================================
// Strategic Plan Mappings
// ============================================================================

/**
 * Strategic Plan field names that map to ICP fields
 */
export const STRATEGY_TO_ICP_MAPPING: Record<string, keyof typeof ICP_CONTEXT_PATHS> = {
  'audience.targetAudience': 'primaryAudience',
  'audience.icpDescription': 'icpDescription',
  'audience.buyerRoles': 'primaryBuyerRoles',
  'audience.companyProfile': 'companyProfile',
};

// ============================================================================
// ICP Validation & Utilities
// ============================================================================

/**
 * Check if an ICP has any meaningful content
 */
export function hasICPContent(icp: CanonicalICPFields): boolean {
  return Boolean(
    icp.icpDescription?.trim() ||
    icp.primaryAudience?.trim() ||
    (icp.primaryBuyerRoles && icp.primaryBuyerRoles.length > 0) ||
    (icp.companyProfile && (
      icp.companyProfile.sizeRange ||
      icp.companyProfile.stage ||
      (icp.companyProfile.industries && icp.companyProfile.industries.length > 0)
    ))
  );
}

/**
 * Build a human-readable ICP summary from the fields
 */
export function buildICPSummary(icp: CanonicalICPFields): string {
  const parts: string[] = [];

  if (icp.icpDescription?.trim()) {
    parts.push(icp.icpDescription.trim());
  } else if (icp.primaryAudience?.trim()) {
    parts.push(`Target Audience: ${icp.primaryAudience.trim()}`);
  }

  if (icp.primaryBuyerRoles && icp.primaryBuyerRoles.length > 0) {
    parts.push(`Buyer Roles: ${icp.primaryBuyerRoles.join(', ')}`);
  }

  if (icp.companyProfile) {
    const profileParts: string[] = [];
    if (icp.companyProfile.sizeRange) {
      profileParts.push(`Size: ${icp.companyProfile.sizeRange}`);
    }
    if (icp.companyProfile.stage) {
      profileParts.push(`Stage: ${icp.companyProfile.stage}`);
    }
    if (icp.companyProfile.industries?.length) {
      profileParts.push(`Industries: ${icp.companyProfile.industries.join(', ')}`);
    }
    if (profileParts.length > 0) {
      parts.push(`Company Profile: ${profileParts.join('; ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Merge two ICP objects, preferring the newer values
 */
export function mergeICP(
  existing: CanonicalICPFields,
  incoming: CanonicalICPFields,
  preferIncoming: boolean = true
): CanonicalICPFields {
  const result: CanonicalICPFields = { ...existing };

  if (preferIncoming) {
    if (incoming.icpDescription?.trim()) {
      result.icpDescription = incoming.icpDescription;
    }
    if (incoming.primaryAudience?.trim()) {
      result.primaryAudience = incoming.primaryAudience;
    }
    if (incoming.primaryBuyerRoles?.length) {
      result.primaryBuyerRoles = incoming.primaryBuyerRoles;
    }
    if (incoming.companyProfile) {
      result.companyProfile = {
        ...existing.companyProfile,
        ...incoming.companyProfile,
      };
    }
  } else {
    // Prefer existing - only fill gaps
    if (!existing.icpDescription?.trim() && incoming.icpDescription?.trim()) {
      result.icpDescription = incoming.icpDescription;
    }
    if (!existing.primaryAudience?.trim() && incoming.primaryAudience?.trim()) {
      result.primaryAudience = incoming.primaryAudience;
    }
    if (!existing.primaryBuyerRoles?.length && incoming.primaryBuyerRoles?.length) {
      result.primaryBuyerRoles = incoming.primaryBuyerRoles;
    }
    if (!existing.companyProfile && incoming.companyProfile) {
      result.companyProfile = incoming.companyProfile;
    }
  }

  return result;
}
