// lib/contextGraph/fcb/writer.ts
// FCB Writer - Writes extracted fields to Context Graph
//
// Respects source priority rules:
// - Human overrides can NEVER be stomped
// - Higher priority sources (labs, GAP) take precedence over FCB
// - FCB is positioned below labs but above inferred

import type { CompanyContextGraph } from '../companyContextGraph';
import type { ProvenanceTag } from '../types';
import { setFieldUntypedWithResult, createProvenance } from '../mutate';
import type { ExtractedField, ExtractorSummary } from './types';

// ============================================================================
// Types
// ============================================================================

export interface WriteResult {
  /** Number of fields written */
  fieldsWritten: number;
  /** Number of fields skipped (blocked by priority) */
  fieldsSkipped: number;
  /** Paths that were written */
  writtenPaths: string[];
  /** Paths that were skipped with reasons */
  skippedPaths: Array<{ path: string; reason: string }>;
}

// ============================================================================
// Writer Functions
// ============================================================================

/**
 * Write extracted fields to the context graph
 * Respects source priority - will not overwrite human edits or higher-priority sources
 */
export function writeExtractedFields(
  graph: CompanyContextGraph,
  fields: ExtractedField[],
  runId: string
): { graph: CompanyContextGraph; result: WriteResult } {
  const result: WriteResult = {
    fieldsWritten: 0,
    fieldsSkipped: 0,
    writtenPaths: [],
    skippedPaths: [],
  };

  let updatedGraph = graph;

  for (const field of fields) {
    // Parse the field path (e.g., "identity.businessName")
    const parts = field.path.split('.');
    if (parts.length !== 2) {
      console.warn(`[FCB Writer] Invalid field path: ${field.path}`);
      result.fieldsSkipped++;
      result.skippedPaths.push({ path: field.path, reason: 'Invalid path format' });
      continue;
    }

    const [domain, fieldName] = parts;

    // Create provenance tag
    const provenance: ProvenanceTag = createProvenance('fcb', {
      confidence: field.confidence,
      sourceRunId: runId,
      notes: field.reasoning,
      validForDays: 90, // FCB data valid for 3 months
    });

    // Attempt to write the field
    const { graph: newGraph, result: setResult } = setFieldUntypedWithResult(
      updatedGraph,
      domain,
      fieldName,
      field.value,
      provenance
    );

    if (setResult.updated) {
      updatedGraph = newGraph;
      result.fieldsWritten++;
      result.writtenPaths.push(field.path);
    } else {
      result.fieldsSkipped++;
      result.skippedPaths.push({
        path: field.path,
        reason: setResult.reason || 'Unknown',
      });
    }
  }

  return { graph: updatedGraph, result };
}

/**
 * Build extractor summary from write result
 */
export function buildExtractorSummary(
  fields: ExtractedField[],
  writeResult: WriteResult
): ExtractorSummary {
  const totalConfidence = fields.reduce((sum, f) => sum + f.confidence, 0);

  return {
    fieldsExtracted: fields.length,
    fieldsWritten: writeResult.fieldsWritten,
    fieldsSkipped: writeResult.fieldsSkipped,
    avgConfidence: fields.length > 0 ? totalConfidence / fields.length : 0,
    writtenPaths: writeResult.writtenPaths,
    skippedPaths: writeResult.skippedPaths,
  };
}
