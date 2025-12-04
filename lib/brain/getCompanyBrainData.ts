// lib/brain/getCompanyBrainData.ts
// ============================================================================
// Company Brain Data Aggregator
// ============================================================================
//
// Aggregates all relevant company data into a single payload for the
// AI-powered Company Brain narrative generation.

import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCompanyInsights,
  getCompanyDocuments,
  getInsightsSummary,
} from '@/lib/airtable/clientBrain';
import {
  listDiagnosticRunsForCompany,
  getLatestRunForCompanyAndTool,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { getGapPlanRunsForCompanyOrDomain } from '@/lib/airtable/gapPlanRuns';
import { getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import type { GapPlanRun, GapIaRun } from '@/lib/gap/types';
import type { ClientInsight, ClientDocument } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary of a lab diagnostic run
 */
export interface LabRunSummary {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  summary: string | null;
  score: number | null;
  createdAt: string;
  rawJson?: unknown;
}

/**
 * Company profile data
 */
export interface CompanyProfile {
  id: string;
  name: string;
  domain?: string;
  type?: string;
  stage?: string;
  industry?: string;
  sizeBand?: string;
  icp?: string;
  markets?: string[];
  description?: string;
  createdAt?: string;
  // Analytics connections
  ga4PropertyId?: string;
  ga4Connected: boolean;
  searchConsoleSiteUrl?: string;
  gscConnected: boolean;
}

/**
 * Insights summary for the company
 */
export interface InsightsSummaryData {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recentCount: number;
}

/**
 * Complete aggregated data for the Company Brain
 */
export interface CompanyBrainData {
  // Core company profile
  company: CompanyProfile;

  // Diagnostic lab results (latest for each tool)
  brandLab?: LabRunSummary | null;
  websiteLab?: LabRunSummary | null;
  seoLab?: LabRunSummary | null;
  contentLab?: LabRunSummary | null;
  opsLab?: LabRunSummary | null;
  demandLab?: LabRunSummary | null;

  // GAP runs
  gapSnapshot?: LabRunSummary | null;
  gapPlan?: LabRunSummary | null;
  gapHeavy?: LabRunSummary | null;

  // All diagnostic runs for context
  allDiagnosticRuns: DiagnosticRun[];

  // GAP runs from separate tables (GAP-Plan Run and GAP-IA Run)
  gapPlanRuns: GapPlanRun[];
  gapIaRuns: GapIaRun[];

  // Client Brain insights
  insights: ClientInsight[];
  insightsSummary: InsightsSummaryData | null;

  // Client documents
  documents: ClientDocument[];

  // Metadata
  dataFetchedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a DiagnosticRun to a LabRunSummary
 */
function mapToLabRunSummary(run: DiagnosticRun | null): LabRunSummary | null {
  if (!run) return null;

  return {
    id: run.id,
    status: run.status,
    summary: run.summary,
    score: run.score,
    createdAt: run.createdAt,
    rawJson: run.rawJson,
  };
}

/**
 * Map company record to profile
 */
function mapToCompanyProfile(company: any): CompanyProfile {
  return {
    id: company.id,
    name: company.name || 'Unknown Company',
    domain: company.domain || company.url,
    type: company.type,
    stage: company.stage,
    industry: company.industry,
    sizeBand: company.sizeBand,
    icp: company.icp,
    markets: company.markets,
    description: company.description,
    createdAt: company.createdAt,
    // Analytics connections
    ga4PropertyId: company.ga4PropertyId,
    ga4Connected: !!company.ga4PropertyId,
    searchConsoleSiteUrl: company.searchConsoleSiteUrl,
    gscConnected: !!company.searchConsoleSiteUrl,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetch all relevant data for a company's Brain view
 *
 * This aggregates:
 * - Company profile
 * - All diagnostic lab runs (latest for each tool)
 * - GAP runs
 * - Client Brain insights
 * - Client documents
 */
export async function getCompanyBrainData(
  companyId: string
): Promise<CompanyBrainData> {
  console.log('[CompanyBrain] Fetching brain data for company:', companyId);

  // First fetch the company to get the domain for GAP lookups
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  const companyDomain = company.domain || company.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '';
  console.log('[CompanyBrain] Company domain for GAP lookup:', companyDomain);

  // Fetch all data in parallel
  const [
    allRuns,
    insights,
    insightsSummary,
    documents,
    brandLabRun,
    websiteLabRun,
    seoLabRun,
    contentLabRun,
    opsLabRun,
    demandLabRun,
    gapSnapshotRun,
    gapPlanRun,
    gapHeavyRun,
    // GAP runs from separate Airtable tables
    gapPlanRuns,
    gapIaRuns,
  ] = await Promise.all([
    // All diagnostic runs
    listDiagnosticRunsForCompany(companyId, { limit: 100 }),

    // Insights
    getCompanyInsights(companyId, { limit: 100 }),
    getInsightsSummary(companyId).catch(() => null),

    // Documents
    getCompanyDocuments(companyId, { limit: 50 }),

    // Latest run for each lab tool
    getLatestRunForCompanyAndTool(companyId, 'brandLab'),
    getLatestRunForCompanyAndTool(companyId, 'websiteLab'),
    getLatestRunForCompanyAndTool(companyId, 'seoLab'),
    getLatestRunForCompanyAndTool(companyId, 'contentLab'),
    getLatestRunForCompanyAndTool(companyId, 'opsLab'),
    getLatestRunForCompanyAndTool(companyId, 'demandLab'),
    getLatestRunForCompanyAndTool(companyId, 'gapSnapshot'),
    getLatestRunForCompanyAndTool(companyId, 'gapPlan'),
    getLatestRunForCompanyAndTool(companyId, 'gapHeavy'),
    // GAP runs from separate Airtable tables (GAP-Plan Run, GAP-IA Run)
    // Pass both companyId and domain for matching
    getGapPlanRunsForCompanyOrDomain(companyId, companyDomain, 10).catch(() => []),
    getGapIaRunsForCompanyOrDomain(companyId, companyDomain, 10).catch(() => []),
  ]);

  console.log('[CompanyBrain] Fetched data:', {
    companyName: company.name,
    companyDomain,
    allRunsCount: allRuns.length,
    insightsCount: insights.length,
    documentsCount: documents.length,
    gapPlanRunsCount: gapPlanRuns.length,
    gapIaRunsCount: gapIaRuns.length,
    hasLabs: {
      brand: !!brandLabRun,
      website: !!websiteLabRun,
      seo: !!seoLabRun,
      content: !!contentLabRun,
      ops: !!opsLabRun,
      demand: !!demandLabRun,
    },
  });

  return {
    company: mapToCompanyProfile(company),
    brandLab: mapToLabRunSummary(brandLabRun),
    websiteLab: mapToLabRunSummary(websiteLabRun),
    seoLab: mapToLabRunSummary(seoLabRun),
    contentLab: mapToLabRunSummary(contentLabRun),
    opsLab: mapToLabRunSummary(opsLabRun),
    demandLab: mapToLabRunSummary(demandLabRun),
    gapSnapshot: mapToLabRunSummary(gapSnapshotRun),
    gapPlan: mapToLabRunSummary(gapPlanRun),
    gapHeavy: mapToLabRunSummary(gapHeavyRun),
    allDiagnosticRuns: allRuns,
    gapPlanRuns,
    gapIaRuns,
    insights,
    insightsSummary,
    documents,
    dataFetchedAt: new Date().toISOString(),
  };
}

/**
 * Get a summary of what data is available for a company
 * Useful for showing data completeness in the UI
 */
export function getDataAvailabilitySummary(data: CompanyBrainData): {
  availableCount: number;
  totalPossible: number;
  percentage: number;
  missing: string[];
  available: string[];
} {
  const labFields = [
    { key: 'brandLab', label: 'Brand Lab' },
    { key: 'websiteLab', label: 'Website Lab' },
    { key: 'seoLab', label: 'SEO Lab' },
    { key: 'contentLab', label: 'Content Lab' },
    { key: 'opsLab', label: 'Ops Lab' },
    { key: 'demandLab', label: 'Demand Lab' },
    { key: 'gapSnapshot', label: 'GAP Snapshot' },
    { key: 'gapPlan', label: 'GAP Plan' },
    { key: 'gapHeavy', label: 'GAP Heavy' },
    { key: 'insights', label: 'Client Insights' },
    { key: 'documents', label: 'Client Documents' },
  ];

  const available: string[] = [];
  const missing: string[] = [];

  for (const field of labFields) {
    const value = (data as any)[field.key];

    // Check if the field has meaningful data
    const hasData =
      value !== null &&
      value !== undefined &&
      (Array.isArray(value) ? value.length > 0 : true) &&
      (typeof value === 'object' && 'status' in value
        ? value.status === 'complete'
        : true);

    if (hasData) {
      available.push(field.label);
    } else {
      missing.push(field.label);
    }
  }

  const availableCount = available.length;
  const totalPossible = labFields.length;
  const percentage = Math.round((availableCount / totalPossible) * 100);

  return {
    availableCount,
    totalPossible,
    percentage,
    missing,
    available,
  };
}
