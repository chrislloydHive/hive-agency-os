// lib/os/diagnostics/artifactCreation.ts
// Artifact creation from completed diagnostic runs
//
// Creates canonical lab_report_* artifacts for completed diagnostics.
// These artifacts are tracked in Airtable and can be attached to work items.
//
// IMPORTANT: Use canonical artifact types from artifactTaxonomy.ts

import type { DiagnosticRun, DiagnosticToolId } from './runs';
import { createArtifact } from '@/lib/airtable/artifacts';
import type { ArtifactType } from '@/lib/types/artifact';

// ============================================================================
// Configuration
// ============================================================================

// Note: The Artifacts table expects simple types (lab_report, gap_report).
// The more detailed artifact types (lab_report_website, etc.) are used in
// CompanyArtifactIndex for the Documents UI via artifactTaxonomy.ts.

/**
 * Map tool IDs to artifact types for the Artifacts table
 */
const TOOL_TO_ARTIFACT_TYPE: Partial<Record<DiagnosticToolId, ArtifactType>> = {
  websiteLab: 'lab_report' as ArtifactType,
  brandLab: 'lab_report' as ArtifactType,
  seoLab: 'lab_report' as ArtifactType,
  contentLab: 'lab_report' as ArtifactType,
  demandLab: 'lab_report' as ArtifactType,
  opsLab: 'lab_report' as ArtifactType,
  creativeLab: 'lab_report' as ArtifactType,
  competitorLab: 'lab_report' as ArtifactType,
  competitionLab: 'lab_report' as ArtifactType,
  audienceLab: 'lab_report' as ArtifactType,
  mediaLab: 'lab_report' as ArtifactType,
  gapSnapshot: 'gap_report' as ArtifactType,
  gapPlan: 'gap_report' as ArtifactType,
  gapHeavy: 'gap_report' as ArtifactType,
};

/**
 * Human-readable names for diagnostic tools
 */
const TOOL_DISPLAY_NAMES: Partial<Record<DiagnosticToolId, string>> = {
  websiteLab: 'Website Lab',
  brandLab: 'Brand Lab',
  seoLab: 'SEO Lab',
  contentLab: 'Content Lab',
  demandLab: 'Demand Lab',
  opsLab: 'Operations Lab',
  creativeLab: 'Creative Lab',
  competitorLab: 'Competitor Lab',
  competitionLab: 'Competition Lab',
  audienceLab: 'Audience Lab',
  mediaLab: 'Media Lab',
  gapSnapshot: 'GAP Assessment',
  gapPlan: 'GAP Plan',
  gapHeavy: 'GAP Deep Analysis',
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Create an artifact from a completed diagnostic run
 *
 * @param companyId - The company ID
 * @param run - The completed diagnostic run
 * @returns The artifact ID if created, null otherwise
 */
export async function createArtifactFromDiagnosticRun(
  companyId: string,
  run: DiagnosticRun
): Promise<string | null> {
  // Only create artifacts for completed runs
  if (run.status !== 'complete') {
    console.log(`[ArtifactCreation] Skipping run ${run.id} - status is ${run.status}`);
    return null;
  }

  // Get artifact type for this tool
  const artifactType = TOOL_TO_ARTIFACT_TYPE[run.toolId];
  if (!artifactType) {
    console.log(`[ArtifactCreation] No artifact type configured for tool ${run.toolId}`);
    return null;
  }

  // Build artifact title
  const toolName = TOOL_DISPLAY_NAMES[run.toolId] || run.toolId;
  const date = new Date(run.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const title = `${toolName} Report - ${date}`;

  // Build description from run summary
  const description = run.summary || `Diagnostic report from ${toolName} run on ${date}`;

  // Determine score-based tags
  const tags: string[] = [run.toolId, 'diagnostic'];
  if (run.score !== null) {
    if (run.score >= 80) tags.push('score:high');
    else if (run.score >= 60) tags.push('score:medium');
    else tags.push('score:low');
  }

  console.log(`[ArtifactCreation] Creating artifact for run ${run.id}:`, {
    title,
    type: artifactType,
    toolId: run.toolId,
    score: run.score,
  });

  try {
    const artifact = await createArtifact({
      companyId,
      title,
      type: artifactType,
      source: 'diagnostic_run',
      description,
      tags,
      // Link to the source diagnostic run
      sourceDiagnosticRunId: run.id,
      labSlug: run.toolId.replace('Lab', '').toLowerCase(),
    });

    if (artifact) {
      console.log(`[ArtifactCreation] ✓ Created artifact ${artifact.id} for run ${run.id}`);
      return artifact.id;
    } else {
      console.error(`[ArtifactCreation] Failed to create artifact for run ${run.id}`);
      return null;
    }
  } catch (error) {
    console.error(`[ArtifactCreation] Error creating artifact for run ${run.id}:`, error);
    return null;
  }
}

/**
 * Check if a diagnostic run should have an artifact
 */
export function shouldCreateArtifact(run: DiagnosticRun): boolean {
  return run.status === 'complete' && !!TOOL_TO_ARTIFACT_TYPE[run.toolId];
}
