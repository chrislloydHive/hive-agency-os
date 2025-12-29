// app/api/os/companies/[companyId]/context/inspector/route.ts
// Context Inspector API - Truth-First debugging endpoint
//
// Returns a comprehensive view of all raw data sources and their relationship
// to the canonical context graph. Uses the SAME loaders as production.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { calculateCompleteness } from '@/lib/contextGraph/companyContextGraph';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import { getDiagnosticDetailsByRunId, getDiagnosticFindingsForCompany } from '@/lib/airtable/diagnosticDetails';
import { checkAvailableImporters, getEnabledImporters } from '@/lib/contextGraph/importers/registry';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Types
// ============================================================================

interface DiagnosticRunSummary {
  id: string;
  status: string;
  createdAt: string;
  modulesCompleted: string[];
  dataTypes: string[];
  hasWebsiteLab: boolean;
  hasBrandLab: boolean;
  hasModules: boolean;
}

interface GapRunSummary {
  type: 'ia' | 'plan' | 'heavy';
  id: string;
  status: string;
  createdAt: string;
  hasCore: boolean;
  hasInsights: boolean;
  hasDimensions: boolean;
  domain: string;
}

interface ImporterAvailability {
  id: string;
  label: string;
  hasData: boolean;
  priority: number;
}

interface InspectorResponse {
  companyId: string;
  companyName: string;
  domain: string;

  // Raw data sources
  diagnosticRuns: DiagnosticRunSummary[];
  gapRuns: GapRunSummary[];
  findingsCount: number;

  // Context graph state
  contextGraph: {
    exists: boolean;
    completeness: number;
    nodeCount: number;
    lastUpdated: string | null;
    populatedDomains: string[];
  };

  // Importer availability
  importers: ImporterAvailability[];

  // Diff: fields that exist in raw data but not in context
  potentialPromotions: {
    source: string;
    fields: string[];
  }[];

  // Health indicators
  health: {
    hasRawData: boolean;
    hasContextGraph: boolean;
    isStale: boolean;
    staleDays: number | null;
    promotionOpportunity: boolean;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function countContextNodes(graph: Record<string, unknown>): number {
  let count = 0;

  function walk(obj: unknown, depth = 0): void {
    if (depth > 10 || !obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => walk(item, depth + 1));
      return;
    }

    const record = obj as Record<string, unknown>;
    if ('value' in record && 'provenance' in record) {
      if (record.value !== null && record.value !== undefined) {
        if (!(Array.isArray(record.value) && record.value.length === 0)) {
          count++;
        }
      }
    } else {
      Object.values(record).forEach(v => walk(v, depth + 1));
    }
  }

  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
  ];

  for (const domain of domains) {
    if (graph[domain]) {
      walk(graph[domain]);
    }
  }

  return count;
}

function getPopulatedDomains(graph: Record<string, unknown>): string[] {
  const populated: string[] = [];
  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
  ];

  for (const domain of domains) {
    if (graph[domain]) {
      let hasContent = false;
      const walk = (obj: unknown): void => {
        if (!obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;
        if ('value' in record && record.value !== null && record.value !== undefined) {
          if (!(Array.isArray(record.value) && record.value.length === 0)) {
            hasContent = true;
          }
        } else if (!Array.isArray(obj)) {
          Object.values(record).forEach(walk);
        }
      };
      walk(graph[domain]);
      if (hasContent) populated.push(domain);
    }
  }

  return populated;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    // 1. Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const domain = company.domain || company.website || '';

    // 2. Load GAP-Heavy runs (diagnostic runs)
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 10);
    const diagnosticRuns: DiagnosticRunSummary[] = [];

    for (const run of heavyRuns) {
      // Load diagnostic details for this run
      let dataTypes: string[] = [];
      try {
        const details = await getDiagnosticDetailsByRunId(run.id);
        dataTypes = details.map(d => d.dataType);
      } catch (e) {
        console.error(`[inspector] Failed to load details for run ${run.id}:`, e);
      }

      diagnosticRuns.push({
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        modulesCompleted: run.modulesCompleted || [],
        dataTypes,
        hasWebsiteLab: dataTypes.includes('websiteLabV4'),
        hasBrandLab: dataTypes.includes('brandLab'),
        hasModules: dataTypes.includes('modules'),
      });
    }

    // 3. Load GAP-IA runs
    const iaRuns = await getGapIaRunsForCompanyOrDomain(companyId, domain, 10);
    const gapRuns: GapRunSummary[] = iaRuns.map(run => ({
      type: 'ia' as const,
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      hasCore: !!run.core,
      hasInsights: !!run.insights,
      hasDimensions: !!('dimensions' in run && run.dimensions),
      domain: run.domain,
    }));

    // 4. Load findings count
    let findingsCount = 0;
    try {
      const findings = await getDiagnosticFindingsForCompany(companyId);
      findingsCount = findings.length;
    } catch (e) {
      console.error('[inspector] Failed to load findings:', e);
    }

    // 5. Load context graph
    const graph = await loadContextGraph(companyId);
    const contextGraphSummary = {
      exists: !!graph,
      completeness: graph ? calculateCompleteness(graph) : 0,
      nodeCount: graph ? countContextNodes(graph) : 0,
      lastUpdated: graph?.meta?.updatedAt || null,
      populatedDomains: graph ? getPopulatedDomains(graph) : [],
    };

    // 6. Check importer availability
    const enabledImporters = getEnabledImporters();
    const importerChecks = await checkAvailableImporters(companyId, domain);
    const importers: ImporterAvailability[] = importerChecks.map(check => {
      const importer = enabledImporters.find(i => i.id === check.id);
      return {
        id: check.id,
        label: check.label,
        hasData: check.hasData,
        priority: importer ? enabledImporters.indexOf(importer) * 10 : 99,
      };
    });

    // 7. Calculate potential promotions
    const potentialPromotions: { source: string; fields: string[] }[] = [];

    // Check if we have raw data that could be promoted
    const importersWithData = importers.filter(i => i.hasData);
    for (const importer of importersWithData) {
      // This is a simplified check - actual fields would require deeper inspection
      potentialPromotions.push({
        source: importer.label,
        fields: [`Data available from ${importer.id}`],
      });
    }

    // 8. Calculate health indicators
    const hasRawData = diagnosticRuns.length > 0 || gapRuns.length > 0;
    const hasContextGraph = contextGraphSummary.exists;

    let isStale = false;
    let staleDays: number | null = null;

    if (contextGraphSummary.lastUpdated) {
      const lastUpdate = new Date(contextGraphSummary.lastUpdated);
      const now = new Date();
      staleDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      isStale = staleDays > 7;
    }

    // Promotion opportunity: has raw data but context is sparse
    const promotionOpportunity = hasRawData && (!hasContextGraph || contextGraphSummary.completeness < 30);

    const response: InspectorResponse = {
      companyId,
      companyName: company.name,
      domain,
      diagnosticRuns,
      gapRuns,
      findingsCount,
      contextGraph: contextGraphSummary,
      importers,
      potentialPromotions,
      health: {
        hasRawData,
        hasContextGraph,
        isStale,
        staleDays,
        promotionOpportunity,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ContextInspector] Error:', error);
    return NextResponse.json(
      { error: 'Failed to inspect context' },
      { status: 500 }
    );
  }
}
