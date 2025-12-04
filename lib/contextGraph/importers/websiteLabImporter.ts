// lib/contextGraph/importers/websiteLabImporter.ts
// Website Lab Importer - imports data from Website Lab V4 runs into Context Graph
//
// Uses the existing WebsiteLabWriter mappings to import historical Website Lab data.
// Fetches runs via GAP Heavy Run records that contain websiteLabV4 diagnostic details.

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { writeWebsiteLabToGraph } from '../websiteLabWriter';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';

/**
 * Website Lab Importer
 *
 * Imports historical Website Lab V4 data into the context graph.
 * Uses the most recent completed run with websiteLabV4 data.
 */
export const websiteLabImporter: DomainImporter = {
  id: 'websiteLab',
  label: 'Website Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      const runs = await getHeavyGapRunsByCompanyId(companyId, 5);

      // Check if any run has websiteLabV4 data
      const hasWebsiteLab = runs.some(run => {
        const status = run.status;
        const hasLab = run.evidencePack?.websiteLabV4;
        return (status === 'completed' || status === 'paused') && hasLab;
      });

      return hasWebsiteLab;
    } catch (error) {
      console.warn('[websiteLabImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      // Fetch the most recent heavy runs for this company
      const runs = await getHeavyGapRunsByCompanyId(companyId, 10);

      // Find the most recent run with websiteLabV4 data
      const runWithLab = runs.find(run => {
        const status = run.status;
        return (status === 'completed' || status === 'paused') &&
               run.evidencePack?.websiteLabV4;
      });

      if (!runWithLab || !runWithLab.evidencePack?.websiteLabV4) {
        result.errors.push('No completed Website Lab runs found with data');
        return result;
      }

      result.sourceRunIds.push(runWithLab.id);

      // Use the existing WebsiteLabWriter to map the data
      const websiteLabData = runWithLab.evidencePack.websiteLabV4 as WebsiteUXLabResultV4;
      const writerResult = writeWebsiteLabToGraph(graph, websiteLabData, runWithLab.id);

      result.fieldsUpdated = writerResult.fieldsUpdated;
      result.updatedPaths = writerResult.updatedPaths;
      result.errors.push(...writerResult.errors);

      result.success = writerResult.fieldsUpdated > 0;
      console.log(`[websiteLabImporter] Imported ${result.fieldsUpdated} fields from Website Lab run ${runWithLab.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[websiteLabImporter] Import error:', error);
    }

    return result;
  },
};

export default websiteLabImporter;
