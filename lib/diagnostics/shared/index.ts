// lib/diagnostics/shared/index.ts
// Shared utilities for all diagnostic Labs
//
// This module provides:
// - Canonical contract enforcement (ensureCanonical)
// - Canonical field registry per lab type
// - Validation utilities

export {
  ensureCanonical,
  validateCanonical,
  wouldBeStripped,
  type EnsureCanonicalInput,
  type EnsureCanonicalResult,
} from './ensureCanonical';

export {
  CANONICAL_REGISTRY,
  BRAND_LAB_SPEC,
  WEBSITE_LAB_SPEC,
  SEO_LAB_SPEC,
  CONTENT_LAB_SPEC,
  COMPETITION_LAB_SPEC,
  AUDIENCE_LAB_SPEC,
  getCanonicalSpec,
  getRequiredPaths,
  isRegisteredLabType,
  type LabType,
  type LabCanonicalSpec,
  type CanonicalFieldSpec,
  type CanonicalFieldType,
} from './canonicalRegistry';
