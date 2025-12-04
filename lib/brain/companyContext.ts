// lib/brain/companyContext.ts
// Brain Integration: Single Source of Truth for Company Context
//
// Aggregates context from Client Brain, Company Brain, diagnostics labs,
// and other sources into a unified structure for media planning.

import { getCompanyById } from '@/lib/airtable/companies';

// ============================================================================
// Types
// ============================================================================

export interface BrainCompanyContext {
  // Summaries from Brain
  businessSummary?: string;
  brandSummary?: string;
  websiteSummary?: string;
  contentSummary?: string;
  seoSummary?: string;
  demandSummary?: string;
  opsSummary?: string;

  // Structured fields
  businessModel?: string;
  revenueModel?: string;
  valueProps?: string[];
  differentiators?: string[];
  marketMaturity?: string;
  geographicFootprint?: string;
  seasonalityNotes?: string;
  audienceSegments?: string[];
  productLines?: string[];
  mediaHistorySummary?: string;
  trackingStackSummary?: string;
  competitiveSummary?: string;
  creativeInventorySummary?: string;
  constraintsSummary?: string;
  brandPerception?: string;

  // Company metadata
  companyName?: string;
  industry?: string;
  website?: string;
  storeCount?: number;
  isMultiLocation?: boolean;
}

export interface BrainContextSource {
  field: string;
  source: 'brain' | 'diagnostics' | 'profile' | 'manual';
  confidence: 'high' | 'medium' | 'low';
}

export interface BrainContextWithSources {
  context: BrainCompanyContext;
  sources: Record<string, BrainContextSource>;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get unified company context from Brain and diagnostics
 */
export async function getBrainCompanyContext(
  companyId: string
): Promise<BrainCompanyContext> {
  try {
    // Get company record
    const company = await getCompanyById(companyId);
    if (!company) {
      return {};
    }

    // Build context from company fields
    const context: BrainCompanyContext = {
      companyName: company.name,
      industry: company.industry || undefined,
      website: company.website || undefined,
    };

    // Try to load Brain summaries if available
    const brainData = await loadBrainSummaries(companyId);
    if (brainData) {
      Object.assign(context, brainData);
    }

    // Try to load diagnostics summaries
    const diagnosticsData = await loadDiagnosticsSummaries(companyId);
    if (diagnosticsData) {
      // Merge, preferring Brain data where available
      for (const [key, value] of Object.entries(diagnosticsData)) {
        if (value && !context[key as keyof BrainCompanyContext]) {
          (context as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Derive additional fields
    // Note: storeCount comes from MediaProfile, not Company record
    // context.isMultiLocation and storeCount will be populated by profile data if available

    return context;
  } catch (error) {
    console.error('[Brain] Failed to get company context:', error);
    return {};
  }
}

/**
 * Get context with source tracking for UI display
 */
export async function getBrainCompanyContextWithSources(
  companyId: string
): Promise<BrainContextWithSources> {
  const context = await getBrainCompanyContext(companyId);
  const sources: Record<string, BrainContextSource> = {};

  // Track sources for each field
  for (const key of Object.keys(context)) {
    if (context[key as keyof BrainCompanyContext] !== undefined) {
      sources[key] = determineSource(key);
    }
  }

  return { context, sources };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Load Brain summaries from Company Brain / Client Brain storage
 */
async function loadBrainSummaries(
  companyId: string
): Promise<Partial<BrainCompanyContext> | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getCompanyBrain } = await import('@/lib/brain/companyBrain');
    const brain = await getCompanyBrain(companyId);

    if (!brain) {
      return null;
    }

    return {
      businessSummary: brain.businessSummary || undefined,
      brandSummary: brain.brandSummary || undefined,
      websiteSummary: brain.websiteSummary || undefined,
      contentSummary: brain.contentSummary || undefined,
      seoSummary: brain.seoSummary || undefined,
      demandSummary: brain.demandSummary || undefined,
      opsSummary: brain.opsSummary || undefined,
      valueProps: brain.valueProps || undefined,
      differentiators: brain.differentiators || undefined,
      audienceSegments: brain.audienceSegments || undefined,
      productLines: brain.productLines || undefined,
    };
  } catch {
    // Brain module may not exist yet
    return null;
  }
}

/**
 * Load summaries from diagnostics labs (GAP, Website Lab, Brand Lab, etc.)
 */
async function loadDiagnosticsSummaries(
  companyId: string
): Promise<Partial<BrainCompanyContext> | null> {
  try {
    // Try to load GAP analysis summary
    const gapSummary = await loadGapSummary(companyId);

    // Try to load Website Lab summary
    const websiteSummary = await loadWebsiteSummary(companyId);

    // Try to load Brand Lab summary
    const brandSummary = await loadBrandSummary(companyId);

    return {
      ...gapSummary,
      ...websiteSummary,
      ...brandSummary,
    };
  } catch {
    return null;
  }
}

async function loadGapSummary(
  companyId: string
): Promise<Partial<BrainCompanyContext>> {
  try {
    // Dynamic import
    const { getLatestRunForCompanyAndTool } = await import('@/lib/os/diagnostics/runs');
    const run = await getLatestRunForCompanyAndTool(companyId, 'gapHeavy');

    if (!run?.metadata) {
      return {};
    }

    const metadata = run.metadata as Record<string, unknown>;

    // Extract relevant summaries from GAP metadata
    return {
      seoSummary: (metadata.seoSummary as string) || undefined,
      trackingStackSummary: (metadata.trackingSummary as string) || undefined,
    };
  } catch {
    return {};
  }
}

async function loadWebsiteSummary(
  _companyId: string
): Promise<Partial<BrainCompanyContext>> {
  // TODO: Implement when websiteLab/analysis module is created
  // For now, return empty object - website summaries will come from Brain data
  return {};
}

async function loadBrandSummary(
  _companyId: string
): Promise<Partial<BrainCompanyContext>> {
  // TODO: Implement when brandLab/analysis module is created
  // For now, return empty object - brand summaries will come from Brain data
  return {};
}

/**
 * Determine the source of a field for UI display
 */
function determineSource(field: string): BrainContextSource {
  const brainFields = [
    'businessSummary',
    'brandSummary',
    'valueProps',
    'differentiators',
    'audienceSegments',
    'productLines',
  ];

  const diagnosticsFields = [
    'seoSummary',
    'trackingStackSummary',
    'websiteSummary',
    'contentSummary',
    'competitiveSummary',
  ];

  if (brainFields.includes(field)) {
    return { field, source: 'brain', confidence: 'high' };
  }

  if (diagnosticsFields.includes(field)) {
    return { field, source: 'diagnostics', confidence: 'medium' };
  }

  return { field, source: 'profile', confidence: 'medium' };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a human-readable label for a source
 */
export function getSourceLabel(source: BrainContextSource['source']): string {
  switch (source) {
    case 'brain':
      return 'From Brain';
    case 'diagnostics':
      return 'From Diagnostics';
    case 'profile':
      return 'From Profile';
    case 'manual':
      return 'Manual Entry';
    default:
      return 'Unknown';
  }
}

/**
 * Get badge color for a source
 */
export function getSourceBadgeColor(source: BrainContextSource['source']): {
  text: string;
  bg: string;
  border: string;
} {
  switch (source) {
    case 'brain':
      return {
        text: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
      };
    case 'diagnostics':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
      };
    case 'profile':
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
      };
    case 'manual':
      return {
        text: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
      };
    default:
      return {
        text: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
      };
  }
}
