// lib/os/artifacts/indexer.ts
// Artifact indexer for diagnostic runs
//
// Creates CompanyArtifactIndex entries for completed diagnostic runs.
// This enables the Documents UI to show lab reports and GAP reports.

import type { DiagnosticRun, DiagnosticToolId } from '../diagnostics/runs';
import type { Artifact } from '@/lib/types/artifact';
import { upsertArtifactIndexEntry } from '@/lib/airtable/artifactIndex';
import {
  ArtifactPhase,
  ArtifactType,
  ArtifactStorage,
  ArtifactStatus,
  ArtifactFileType,
  ArtifactVisibility,
  getArtifactTypeForDiagnostic,
  getSourceForDiagnostic,
  getPhaseForArtifactType,
  getFileTypeForArtifactType,
  getDefaultVisibility,
} from '@/lib/types/artifactTaxonomy';
import { generateArtifactUrl } from '@/lib/types/artifactIndex';
import { getPrimaryRunViewHref } from '../diagnostics/navigation';

// ============================================================================
// Types
// ============================================================================

export type IndexResult = {
  indexed: number;
  skipped: number;
  errors: string[];
  ok: boolean;
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Human-readable names for diagnostic tools
 */
const TOOL_DISPLAY_NAMES: Partial<Record<DiagnosticToolId, string>> = {
  websiteLab: 'Website Lab Report',
  brandLab: 'Brand Lab Report',
  seoLab: 'SEO Lab Report',
  contentLab: 'Content Lab Report',
  demandLab: 'Demand Lab Report',
  opsLab: 'Operations Lab Report',
  creativeLab: 'Creative Lab Report',
  competitorLab: 'Competitor Lab Report',
  competitionLab: 'Competition Lab Report',
  audienceLab: 'Audience Lab Report',
  mediaLab: 'Media Lab Report',
  gapSnapshot: 'GAP Assessment',
  gapPlan: 'GAP Plan',
  gapHeavy: 'GAP Deep Analysis',
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Index artifacts for a diagnostic run
 *
 * Creates a CompanyArtifactIndex entry for the run, making it
 * visible in the Documents UI.
 */
export async function indexArtifactsForRun(
  companyId: string,
  run: DiagnosticRun
): Promise<IndexResult> {
  const result: IndexResult = {
    indexed: 0,
    skipped: 0,
    errors: [],
    ok: true,
  };

  // Only index completed runs
  if (run.status !== 'complete') {
    console.log(`[ArtifactIndexer] Skipping run ${run.id} - status is ${run.status}`);
    result.skipped = 1;
    return result;
  }

  // Get artifact type for this tool
  const artifactType = getArtifactTypeForDiagnostic(run.toolId);
  if (!artifactType || artifactType === ArtifactType.Custom) {
    console.log(`[ArtifactIndexer] No artifact type configured for tool ${run.toolId}`);
    result.skipped = 1;
    return result;
  }

  // Build title
  const toolName = TOOL_DISPLAY_NAMES[run.toolId] || run.toolId;
  const date = new Date(run.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const title = `${toolName} - ${date}`;

  // Get canonical metadata
  const phase = getPhaseForArtifactType(artifactType);
  const source = getSourceForDiagnostic(run.toolId);
  const fileType = getFileTypeForArtifactType(artifactType);

  // Generate group key and URL (using canonical navigation helper)
  const groupKey = `${run.toolId}:${run.id}`;
  const url = getPrimaryRunViewHref({ companyId, toolId: run.toolId, runId: run.id });

  // Determine visibility (lab reports are documents_only)
  const visibility = getDefaultVisibility(artifactType);

  console.log(`[ArtifactIndexer] Indexing run ${run.id}:`, {
    title,
    artifactType,
    phase,
    source,
    url,
    visibility,
  });

  try {
    const entry = await upsertArtifactIndexEntry({
      companyId,
      title,
      artifactType,
      phase,
      source,
      storage: ArtifactStorage.Internal,
      groupKey,
      sourceRunId: run.id,
      url,
      status: ArtifactStatus.Final,
      primary: true,
      description: run.summary || `Diagnostic run from ${date}`,
      fileType,
    });

    if (entry) {
      // LOG: Artifact indexed with version info for Website Lab
      const version = run.toolId === 'websiteLab' ? 'v5' : null;
      console.log(`[ArtifactIndexer] Indexed artifact: ${artifactType}${version ? ` (${version})` : ''} runId=${run.id} companyId=${companyId}`);
      console.log(`[ArtifactIndexer] ✓ Indexed run ${run.id} as ${entry.id}`);
      result.indexed = 1;
    } else {
      result.errors.push(`Failed to upsert index entry for run ${run.id}`);
      result.ok = false;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ArtifactIndexer] Error indexing run ${run.id}:`, error);
    result.errors.push(errorMsg);
    result.ok = false;
  }

  return result;
}

/**
 * Index a single artifact from an Artifact record
 *
 * Creates a CompanyArtifactIndex entry for an existing Artifact,
 * making it visible in the Documents UI.
 */
export async function indexArtifactFromArtifact(
  artifact: Artifact
): Promise<IndexResult> {
  const result: IndexResult = {
    indexed: 0,
    skipped: 0,
    errors: [],
    ok: true,
  };

  // Skip archived artifacts
  if (artifact.status === 'archived') {
    console.log(`[ArtifactIndexer] Skipping archived artifact ${artifact.id}`);
    result.skipped = 1;
    return result;
  }

  // Determine phase from artifact type
  const phase = getPhaseForArtifactType(artifact.type as ArtifactType);
  const fileType = getFileTypeForArtifactType(artifact.type as ArtifactType);

  // Generate group key
  const groupKey = `artifact:${artifact.id}`;

  // Generate URL - prefer Google Drive URL if available
  const url = artifact.googleFileUrl || generateArtifactUrl(
    artifact.companyId,
    artifact.type,
    artifact.id,
    artifact.googleFileId
  );

  console.log(`[ArtifactIndexer] Indexing artifact ${artifact.id}:`, {
    title: artifact.title,
    type: artifact.type,
    phase,
  });

  try {
    const entry = await upsertArtifactIndexEntry({
      companyId: artifact.companyId,
      title: artifact.title,
      artifactType: artifact.type,
      phase,
      source: artifact.source,
      storage: artifact.googleFileId ? ArtifactStorage.GoogleDrive : ArtifactStorage.Internal,
      groupKey,
      sourceArtifactId: artifact.id,
      url,
      googleFileId: artifact.googleFileId,
      status: artifact.status === 'final' ? ArtifactStatus.Final : ArtifactStatus.Draft,
      primary: true,
      description: artifact.description || null,
      fileType,
    });

    if (entry) {
      console.log(`[ArtifactIndexer] ✓ Indexed artifact ${artifact.id} as ${entry.id}`);
      result.indexed = 1;
    } else {
      result.errors.push(`Failed to upsert index entry for artifact ${artifact.id}`);
      result.ok = false;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ArtifactIndexer] Error indexing artifact ${artifact.id}:`, error);
    result.errors.push(errorMsg);
    result.ok = false;
  }

  return result;
}

/**
 * Bulk index multiple runs
 */
export async function indexMultipleRuns(
  companyId: string,
  runs: DiagnosticRun[]
): Promise<IndexResult> {
  const result: IndexResult = {
    indexed: 0,
    skipped: 0,
    errors: [],
    ok: true,
  };

  for (const run of runs) {
    const runResult = await indexArtifactsForRun(companyId, run);
    result.indexed += runResult.indexed;
    result.skipped += runResult.skipped;
    result.errors.push(...runResult.errors);
    if (!runResult.ok) result.ok = false;
  }

  console.log(`[ArtifactIndexer] Bulk index complete:`, {
    total: runs.length,
    indexed: result.indexed,
    skipped: result.skipped,
    errors: result.errors.length,
  });

  return result;
}
