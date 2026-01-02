// lib/os/diagnostics/labRunStatus.ts
// Determine lab run status from artifacts (source of truth)
//
// This module provides the canonical way to check if a lab has been run
// for a company. It checks for artifacts rather than transient run state.

import type { Artifact } from '@/lib/types/artifact';
import type { LabSlug } from './runs';

// ============================================================================
// Types
// ============================================================================

/**
 * Status of a single lab based on artifacts
 */
export interface LabRunStatus {
  /** Lab slug (website, brand, gap, etc.) */
  labSlug: LabSlug;

  /** Whether this lab has been run (artifact exists) */
  hasRun: boolean;

  /** ID of the most recent artifact for this lab */
  latestArtifactId: string | null;

  /** Date of the most recent run */
  latestRunDate: string | null;

  /** Score from the most recent run (if available) */
  latestScore: number | null;

  /** Title of the latest artifact */
  latestTitle: string | null;
}

/**
 * All known lab slugs
 */
const ALL_LAB_SLUGS: LabSlug[] = [
  'gap',
  'website',
  'brand',
  'seo',
  'content',
  'demand',
  'ops',
  'creative',
  'competitor',
  'audience',
  'media',
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Extract score from artifact rawData
 *
 * Different lab types store scores in different locations within the rawData.
 * This function tries common paths.
 */
function extractScoreFromRawData(rawData: unknown): number | null {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const data = rawData as Record<string, unknown>;

  // Direct score field
  if (typeof data.score === 'number') {
    return data.score;
  }

  // Overall score field
  if (typeof data.overallScore === 'number') {
    return data.overallScore;
  }

  // Nested in siteAssessment (Website Lab)
  const siteAssessment = data.siteAssessment as Record<string, unknown> | undefined;
  if (siteAssessment) {
    if (typeof siteAssessment.score === 'number') {
      return siteAssessment.score;
    }
    if (typeof siteAssessment.overallScore === 'number') {
      return siteAssessment.overallScore;
    }
  }

  // Nested in summary (GAP-IA)
  const summary = data.summary as Record<string, unknown> | undefined;
  if (summary && typeof summary.overallScore === 'number') {
    return summary.overallScore;
  }

  // Nested in initialAssessment.summary (GAP-IA alternate format)
  const initialAssessment = data.initialAssessment as Record<string, unknown> | undefined;
  if (initialAssessment) {
    const iaSummary = initialAssessment.summary as Record<string, unknown> | undefined;
    if (iaSummary && typeof iaSummary.overallScore === 'number') {
      return iaSummary.overallScore;
    }
  }

  // Nested in rawEvidence.labResultV4 (newer format)
  const rawEvidence = data.rawEvidence as Record<string, unknown> | undefined;
  if (rawEvidence?.labResultV4) {
    const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
    if (typeof labResult.score === 'number') {
      return labResult.score;
    }
    const labSiteAssessment = labResult.siteAssessment as Record<string, unknown> | undefined;
    if (labSiteAssessment && typeof labSiteAssessment.score === 'number') {
      return labSiteAssessment.score;
    }
  }

  return null;
}

/**
 * Get lab run statuses from artifacts
 *
 * Returns a map of labSlug -> LabRunStatus for all known lab types.
 * Labs without artifacts will have hasRun: false.
 */
export function getLabRunStatusesFromArtifacts(
  artifacts: Artifact[]
): Map<LabSlug, LabRunStatus> {
  const statusMap = new Map<LabSlug, LabRunStatus>();

  // Initialize all lab slugs as not run
  for (const slug of ALL_LAB_SLUGS) {
    statusMap.set(slug, {
      labSlug: slug,
      hasRun: false,
      latestArtifactId: null,
      latestRunDate: null,
      latestScore: null,
      latestTitle: null,
    });
  }

  // Filter to diagnostic artifacts only
  const diagnosticArtifacts = artifacts.filter(
    (a) =>
      (a.type === 'lab_report' || a.type === 'gap_report') &&
      a.labSlug
  );

  // Group by labSlug, find latest for each
  for (const artifact of diagnosticArtifacts) {
    const labSlug = artifact.labSlug as LabSlug;
    const existing = statusMap.get(labSlug);

    if (!existing) {
      // Unknown lab slug, skip
      continue;
    }

    // Check if this artifact is newer than what we have
    const isNewer =
      !existing.latestRunDate ||
      new Date(artifact.createdAt) > new Date(existing.latestRunDate);

    if (isNewer) {
      // Extract score from rawData
      const score = extractScoreFromRawData(artifact.rawData);

      statusMap.set(labSlug, {
        labSlug,
        hasRun: true,
        latestArtifactId: artifact.id,
        latestRunDate: artifact.createdAt,
        latestScore: score,
        latestTitle: artifact.title,
      });
    }
  }

  return statusMap;
}

/**
 * Check if any lab has been run based on artifacts
 */
export function hasAnyLabRun(artifacts: Artifact[]): boolean {
  const diagnosticArtifacts = artifacts.filter(
    (a) =>
      (a.type === 'lab_report' || a.type === 'gap_report') &&
      a.labSlug
  );
  return diagnosticArtifacts.length > 0;
}

/**
 * Get count of labs that have been run
 */
export function getLabsRunCount(artifacts: Artifact[]): number {
  const statuses = getLabRunStatusesFromArtifacts(artifacts);
  let count = 0;
  for (const status of statuses.values()) {
    if (status.hasRun) {
      count++;
    }
  }
  return count;
}

/**
 * Get the most recent lab run across all lab types
 */
export function getMostRecentLabRun(
  artifacts: Artifact[]
): LabRunStatus | null {
  const statuses = getLabRunStatusesFromArtifacts(artifacts);

  let mostRecent: LabRunStatus | null = null;

  for (const status of statuses.values()) {
    if (!status.hasRun || !status.latestRunDate) {
      continue;
    }

    if (
      !mostRecent ||
      !mostRecent.latestRunDate ||
      new Date(status.latestRunDate) > new Date(mostRecent.latestRunDate)
    ) {
      mostRecent = status;
    }
  }

  return mostRecent;
}

/**
 * Format lab run date for display
 */
export function formatLabRunDate(dateStr: string | null): string {
  if (!dateStr) {
    return 'Never';
  }

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}
