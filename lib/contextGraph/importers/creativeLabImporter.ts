// lib/contextGraph/importers/creativeLabImporter.ts
// Creative Lab Importer - Imports Creative Lab output into Context Graph
//
// This importer reads previously saved Creative Lab runs and imports them
// into the Context Graph for companies that have existing creative strategy data.

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { writeCreativeLabToGraph, type CreativeLabOutput } from '../creativeLabWriter';
import {
  listDiagnosticRunsForCompany,
  type DiagnosticRun,
} from '@/lib/os/diagnostics/runs';

// ============================================================================
// Importer Implementation
// ============================================================================

/**
 * Creative Lab Domain Importer
 *
 * Imports Creative Lab runs (messaging, territories, concepts, guidelines)
 * from the Diagnostic Runs table into the Context Graph.
 */
export const creativeLabImporter: DomainImporter = {
  id: 'creativeLab',
  label: 'Creative Lab',

  /**
   * Check if Creative Lab data exists for this company
   */
  async supports(companyId: string, _domain: string): Promise<boolean> {
    try {
      const runs = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'creativeLab',
        limit: 1,
        status: 'complete',
      });

      const hasData = runs.length > 0;
      console.log('[creativeLabImporter] supports check:', { companyId, hasData });
      return hasData;
    } catch (error) {
      console.error('[creativeLabImporter] Error checking support:', error);
      return false;
    }
  },

  /**
   * Import Creative Lab data into the context graph
   */
  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    _domain: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      // Get the latest completed Creative Lab run
      const runs = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'creativeLab',
        limit: 1,
        status: 'complete',
      });

      if (runs.length === 0) {
        console.log('[creativeLabImporter] No Creative Lab runs found');
        result.success = true;
        return result;
      }

      const latestRun = runs[0];
      console.log('[creativeLabImporter] Found Creative Lab run:', latestRun.id);
      result.sourceRunIds.push(latestRun.id);

      // Extract the output from the run's rawJson
      const rawOutput = latestRun.rawJson as CreativeLabOutput | undefined;
      if (!rawOutput) {
        console.log('[creativeLabImporter] No rawJson in Creative Lab run');
        result.success = true;
        return result;
      }

      // Validate the output has required fields
      if (!rawOutput.messaging && !rawOutput.creativeTerritories && !rawOutput.campaignConcepts) {
        console.log('[creativeLabImporter] No creative data in rawJson');
        result.success = true;
        return result;
      }

      // Write to Context Graph
      const writerResult = writeCreativeLabToGraph(graph, rawOutput, latestRun.id);

      result.fieldsUpdated = writerResult.fieldsUpdated;
      result.updatedPaths = writerResult.updatedPaths;
      result.errors = writerResult.errors;
      result.success = writerResult.errors.length === 0;

      console.log('[creativeLabImporter] Import complete:', {
        fieldsUpdated: result.fieldsUpdated,
        errors: result.errors.length,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[creativeLabImporter] Import error:', error);
      result.errors.push(`Import failed: ${errorMsg}`);
    }

    return result;
  },
};
