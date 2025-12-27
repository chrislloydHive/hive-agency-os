// lib/os/artifacts/navigation.ts
// Canonical artifact navigation helpers
//
// Single source of truth for artifact URLs and navigation.
// Use these helpers in all artifact list UIs to ensure consistent behavior.

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Get the canonical URL for viewing an artifact.
 */
export function getArtifactViewerHref(companyId: string, artifactId: string): string {
  return `/c/${companyId}/artifacts/${artifactId}`;
}

/**
 * Get the canonical URL for the artifacts list page in Deliver.
 */
export function getArtifactsListHref(companyId: string): string {
  return `/c/${companyId}/deliver/artifacts`;
}

/**
 * Navigate to the artifact viewer.
 * Use this for programmatic navigation (e.g., after generation).
 */
export function navigateToArtifact(
  router: AppRouterInstance,
  companyId: string,
  artifactId: string
): void {
  router.push(getArtifactViewerHref(companyId, artifactId));
}

/**
 * Navigate to the artifacts list in Deliver.
 */
export function navigateToArtifactsList(
  router: AppRouterInstance,
  companyId: string
): void {
  router.push(getArtifactsListHref(companyId));
}
