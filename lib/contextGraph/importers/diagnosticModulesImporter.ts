// lib/contextGraph/importers/diagnosticModulesImporter.ts
// Diagnostic Modules Importer - imports data from Heavy Worker diagnostic modules
//
// Maps module results (seo, content, website, brand, demand, ops) to context graph fields:
// - SEO: seoScore, seoSummary, seoRecommendations
// - Content: contentScore, contentSummary
// - Website: websiteScore, websiteSummary
// - Brand: brandPerception
// - Demand: traffic and conversion insights

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { setField, setDomainFields, createProvenance } from '../mutate';
import type { DiagnosticModuleResult } from '@/lib/gap-heavy/types';

/**
 * Diagnostic Modules Importer
 *
 * Imports data from Heavy Worker diagnostic modules (SEO, Content, Website, Brand, Demand, Ops)
 * into the context graph.
 */
export const diagnosticModulesImporter: DomainImporter = {
  id: 'diagnosticModules',
  label: 'Diagnostic Modules',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      const runs = await getHeavyGapRunsByCompanyId(companyId, 5);

      // Check if any run has module results
      const hasModules = runs.some(run => {
        const status = run.status;
        const modules = run.evidencePack?.modules;
        const hasCompletedModules = modules?.some(m => m.status === 'completed');
        return (status === 'completed' || status === 'paused') && hasCompletedModules;
      });

      return hasModules;
    } catch (error) {
      console.warn('[diagnosticModulesImporter] Error checking support:', error);
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

      // Find the most recent run with module data
      const runWithModules = runs.find(run => {
        const status = run.status;
        const modules = run.evidencePack?.modules;
        return (status === 'completed' || status === 'paused') &&
               modules?.some(m => m.status === 'completed');
      });

      if (!runWithModules || !runWithModules.evidencePack?.modules) {
        result.errors.push('No completed runs found with diagnostic modules');
        return result;
      }

      result.sourceRunIds.push(runWithModules.id);

      // Create provenance for gap heavy source
      const provenance = createProvenance('gap_heavy', {
        confidence: 0.9,
        runId: runWithModules.id,
        validForDays: 30,
      });

      // Process each completed module
      for (const mod of runWithModules.evidencePack.modules) {
        if (mod.status !== 'completed') continue;

        const moduleImport = importFromModule(graph, mod, provenance);
        result.fieldsUpdated += moduleImport.count;
        result.updatedPaths.push(...moduleImport.paths);
      }

      result.success = result.fieldsUpdated > 0;
      console.log(`[diagnosticModulesImporter] Imported ${result.fieldsUpdated} fields from diagnostic modules`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[diagnosticModulesImporter] Import error:', error);
    }

    return result;
  },
};

/**
 * Import data from a single diagnostic module
 */
function importFromModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  switch (module.module) {
    case 'seo':
      return importSeoModule(graph, module, provenance);
    case 'content':
      return importContentModule(graph, module, provenance);
    case 'website':
      return importWebsiteModule(graph, module, provenance);
    case 'brand':
      return importBrandModule(graph, module, provenance);
    case 'demand':
      return importDemandModule(graph, module, provenance);
    case 'ops':
      return importOpsModule(graph, module, provenance);
    default:
      return { count: 0, paths: [] };
  }
}

/**
 * Import SEO module data
 */
function importSeoModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // SEO score
  if (module.score !== undefined && !graph.seo?.seoScore?.value) {
    setField(graph, 'seo', 'seoScore', module.score, provenance);
    paths.push('seo.seoScore');
    count++;
  }

  // SEO summary
  if (module.summary && !graph.seo?.seoSummary?.value) {
    setField(graph, 'seo', 'seoSummary', module.summary, provenance);
    paths.push('seo.seoSummary');
    count++;
  }

  // SEO recommendations
  if (module.recommendations && module.recommendations.length > 0) {
    setDomainFields(graph, 'seo', {
      seoRecommendations: module.recommendations,
    }, provenance);
    paths.push('seo.seoRecommendations');
    count++;
  }

  // SEO quick wins from issues (high priority ones)
  if (module.issues && module.issues.length > 0) {
    setDomainFields(graph, 'seo', {
      seoQuickWins: module.issues.slice(0, 5), // Top 5 issues as quick wins
    }, provenance);
    paths.push('seo.seoQuickWins');
    count++;
  }

  return { count, paths };
}

/**
 * Import Content module data
 */
function importContentModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Content score
  if (module.score !== undefined && !graph.content?.contentScore?.value) {
    setField(graph, 'content', 'contentScore', module.score, provenance);
    paths.push('content.contentScore');
    count++;
  }

  // Content summary
  if (module.summary && !graph.content?.contentSummary?.value) {
    setField(graph, 'content', 'contentSummary', module.summary, provenance);
    paths.push('content.contentSummary');
    count++;
  }

  // Content issues as key topics to address
  if (module.issues && module.issues.length > 0) {
    setDomainFields(graph, 'content', {
      keyTopics: module.issues,
    }, provenance);
    paths.push('content.keyTopics');
    count++;
  }

  return { count, paths };
}

/**
 * Import Website module data
 */
function importWebsiteModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Website score
  if (module.score !== undefined && !graph.website?.websiteScore?.value) {
    setField(graph, 'website', 'websiteScore', module.score, provenance);
    paths.push('website.websiteScore');
    count++;
  }

  // Website summary
  if (module.summary && !graph.website?.websiteSummary?.value) {
    setField(graph, 'website', 'websiteSummary', module.summary, provenance);
    paths.push('website.websiteSummary');
    count++;
  }

  // Website issues as critical issues
  if (module.issues && module.issues.length > 0) {
    setDomainFields(graph, 'website', {
      criticalIssues: module.issues,
    }, provenance);
    paths.push('website.criticalIssues');
    count++;
  }

  // Website recommendations
  if (module.recommendations && module.recommendations.length > 0) {
    setDomainFields(graph, 'website', {
      recommendations: module.recommendations,
    }, provenance);
    paths.push('website.recommendations');
    count++;
  }

  return { count, paths };
}

/**
 * Import Brand module data
 */
function importBrandModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Brand summary as brand perception
  if (module.summary && !graph.brand?.brandPerception?.value) {
    setField(graph, 'brand', 'brandPerception', module.summary, provenance);
    paths.push('brand.brandPerception');
    count++;
  }

  // Brand issues as weaknesses
  if (module.issues && module.issues.length > 0) {
    setDomainFields(graph, 'brand', {
      brandWeaknesses: module.issues,
    }, provenance);
    paths.push('brand.brandWeaknesses');
    count++;
  }

  return { count, paths };
}

/**
 * Import Demand module data
 */
function importDemandModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Demand summary goes to audience media habits
  if (module.summary && !graph.audience?.mediaHabits?.value) {
    setField(graph, 'audience', 'mediaHabits', module.summary, provenance);
    paths.push('audience.mediaHabits');
    count++;
  }

  // Demand insights go to audience behavioral drivers
  if (module.recommendations && module.recommendations.length > 0) {
    setDomainFields(graph, 'audience', {
      behavioralDrivers: module.recommendations,
    }, provenance);
    paths.push('audience.behavioralDrivers');
    count++;
  }

  return { count, paths };
}

/**
 * Import Ops module data
 */
function importOpsModule(
  graph: CompanyContextGraph,
  module: DiagnosticModuleResult,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  const count = 0;

  // Ops summary can inform operational constraints
  if (module.summary) {
    // This would go to an operational constraints field if we had one
    // For now, we skip ops data as it doesn't map well to current domains
  }

  return { count, paths };
}

export default diagnosticModulesImporter;
