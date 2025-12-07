// lib/competition/store.ts
// Competition Lab v2 - Airtable Storage Layer
//
// Stores and retrieves competition runs from Airtable.
// Uses JSON blob storage with proper merging to avoid data loss.

import {
  createRecord,
  updateRecord,
  findRecordByField,
  getRecord,
  getAirtableConfig,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  CompetitionRun,
  CompetitionRunStatus,
  ScoredCompetitor,
  CompetitorFeedbackAction,
  CompetitionRunStats,
} from './types';
import {
  generateRunId,
  generateCompetitorId,
  createInitialSteps,
  normalizeDomain,
  computeRunStats,
} from './types';

const TABLE = AIRTABLE_TABLES.COMPETITION_RUNS;

// ============================================================================
// Create
// ============================================================================

/**
 * Create a new competition run record
 */
export async function createCompetitionRun(data: {
  companyId: string;
  contextSnapshotId?: string;
}): Promise<CompetitionRun> {
  const now = new Date().toISOString();

  const run: CompetitionRun = {
    id: generateRunId(),
    companyId: data.companyId,
    status: 'pending',
    startedAt: now,
    completedAt: null,
    updatedAt: now,
    steps: createInitialSteps(),
    contextSnapshotId: data.contextSnapshotId || null,
    querySet: {
      brandQueries: [],
      categoryQueries: [],
      geoQueries: [],
      marketplaceQueries: [],
    },
    querySummary: {
      queriesGenerated: [],
      sourcesUsed: [],
    },
    modelVersion: 'v2',
    competitors: [],
    discoveredCandidates: [],
    stats: {
      candidatesDiscovered: 0,
      candidatesEnriched: 0,
      candidatesScored: 0,
      coreCount: 0,
      secondaryCount: 0,
      alternativeCount: 0,
    },
    candidatesDiscovered: 0,
    candidatesEnriched: 0,
    candidatesScored: 0,
    dataConfidenceScore: 0,
    errors: [],
    errorMessage: null,
  };

  try {
    console.log(`[competition/store] Creating run for company: ${data.companyId}`);
    const record = await createRecord(TABLE, {
      'Run ID': run.id,
      'Company ID': data.companyId,
      'Status': run.status,
      'Run Data': JSON.stringify(run),
      // Note: 'Created At' is auto-computed by Airtable, don't write to it
    });

    // Return with Airtable record ID as the primary ID
    const savedRun = { ...run, id: record.id };
    console.log(`[competition/store] Created run: ${savedRun.id}`);
    return savedRun;
  } catch (error) {
    console.error('[competition/store] Failed to create run:', error);
    throw error;
  }
}

// ============================================================================
// Update
// ============================================================================

/**
 * Update a competition run (merges with existing data)
 */
export async function updateCompetitionRun(
  recordId: string,
  updates: Partial<CompetitionRun>
): Promise<CompetitionRun> {
  try {
    // Fetch current run data
    const current = await getRecord(TABLE, recordId);
    if (!current) {
      throw new Error(`Run not found: ${recordId}`);
    }

    const currentRun: CompetitionRun = JSON.parse(current.fields['Run Data'] || '{}');

    // Deep merge updates (preserve nested objects)
    const updatedRun: CompetitionRun = {
      ...currentRun,
      ...updates,
      updatedAt: new Date().toISOString(),
      // Merge nested objects explicitly
      querySet: updates.querySet
        ? { ...currentRun.querySet, ...updates.querySet }
        : currentRun.querySet,
      querySummary: updates.querySummary
        ? { ...currentRun.querySummary, ...updates.querySummary }
        : currentRun.querySummary,
      stats: updates.stats
        ? { ...currentRun.stats, ...updates.stats }
        : currentRun.stats,
    };

    // Update in Airtable
    // Note: 'Updated At' is auto-computed by Airtable, don't write to it
    await updateRecord(TABLE, recordId, {
      'Status': updatedRun.status,
      'Run Data': JSON.stringify(updatedRun),
    });

    return { ...updatedRun, id: recordId };
  } catch (error) {
    console.error('[competition/store] Failed to update run:', error);
    throw error;
  }
}

/**
 * Update run status with optional completion timestamp
 */
export async function updateRunStatus(
  recordId: string,
  status: CompetitionRunStatus,
  errorMessage?: string
): Promise<CompetitionRun> {
  const updates: Partial<CompetitionRun> = {
    status,
    ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    ...(status === 'failed' && errorMessage ? { errorMessage } : {}),
  };
  return updateCompetitionRun(recordId, updates);
}

// ============================================================================
// Read
// ============================================================================

/**
 * Get a competition run by Airtable record ID
 */
export async function getCompetitionRun(recordId: string): Promise<CompetitionRun | null> {
  try {
    const record = await getRecord(TABLE, recordId);
    if (!record) return null;

    const runData: CompetitionRun = JSON.parse(record.fields['Run Data'] || '{}');
    return { ...runData, id: record.id };
  } catch (error) {
    console.error('[competition/store] Failed to get run:', error);
    return null;
  }
}

/**
 * Get the latest competition run for a company
 */
export async function getLatestCompetitionRun(companyId: string): Promise<CompetitionRun | null> {
  try {
    const config = getAirtableConfig();
    const filterFormula = `{Company ID} = '${companyId.replace(/'/g, "\\'")}'`;
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1&sort%5B0%5D%5Bfield%5D=Created%20At&sort%5B0%5D%5Bdirection%5D=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    const records = result.records || [];

    if (records.length === 0) return null;

    const record = records[0];
    const runData: CompetitionRun = JSON.parse(record.fields['Run Data'] || '{}');
    return { ...runData, id: record.id };
  } catch (error) {
    console.error('[competition/store] Failed to get latest run:', error);
    return null;
  }
}

/**
 * List all competition runs for a company
 */
export async function listCompetitionRuns(
  companyId: string,
  options?: { limit?: number }
): Promise<CompetitionRun[]> {
  const limit = options?.limit ?? 10;

  try {
    const config = getAirtableConfig();
    const filterFormula = `{Company ID} = '${companyId.replace(/'/g, "\\'")}'`;
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=${limit}&sort%5B0%5D%5Bfield%5D=Created%20At&sort%5B0%5D%5Bdirection%5D=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    const records = result.records || [];

    return records.map((record: { id: string; fields: Record<string, unknown> }) => {
      const runData: CompetitionRun = JSON.parse((record.fields['Run Data'] as string) || '{}');
      return { ...runData, id: record.id };
    });
  } catch (error) {
    console.error('[competition/store] Failed to list runs:', error);
    return [];
  }
}

// ============================================================================
// Competitor Management
// ============================================================================

/**
 * Add competitors to a run
 */
export async function addCompetitorsToRun(
  recordId: string,
  competitors: ScoredCompetitor[]
): Promise<CompetitionRun> {
  const run = await getCompetitionRun(recordId);
  if (!run) throw new Error('Run not found');

  const updatedCompetitors = [...run.competitors, ...competitors];
  const stats = computeRunStats(
    updatedCompetitors,
    run.stats?.candidatesDiscovered ?? run.candidatesDiscovered,
    run.stats?.candidatesEnriched ?? run.candidatesEnriched
  );

  return updateCompetitionRun(recordId, {
    competitors: updatedCompetitors,
    stats,
    candidatesScored: updatedCompetitors.length,
  });
}

/**
 * Apply user feedback to a competition run
 */
export async function applyCompetitorFeedback(
  recordId: string,
  action: CompetitorFeedbackAction
): Promise<CompetitionRun> {
  const run = await getCompetitionRun(recordId);
  if (!run) throw new Error('Run not found');

  let updatedCompetitors = [...run.competitors];

  switch (action.type) {
    case 'remove': {
      updatedCompetitors = updatedCompetitors.map((c) =>
        c.id === action.competitorId
          ? {
              ...c,
              removedByUser: true,
              provenance: {
                ...c.provenance,
                removed: true,
                removedAt: new Date().toISOString(),
                removedReason: action.reason || null,
              },
            }
          : c
      );
      break;
    }

    case 'promote': {
      updatedCompetitors = updatedCompetitors.map((c) =>
        c.id === action.competitorId
          ? {
              ...c,
              role: action.toRole,
              promotedByUser: true,
              provenance: {
                ...c.provenance,
                humanOverride: true,
                humanOverrideAt: new Date().toISOString(),
                promoted: true,
                promotedAt: new Date().toISOString(),
              },
            }
          : c
      );
      break;
    }

    case 'add': {
      const domain = normalizeDomain(action.domain);
      const newCompetitor: ScoredCompetitor = {
        id: generateCompetitorId(),
        competitorName: action.name || action.domain,
        competitorDomain: domain,
        homepageUrl: action.domain.includes('://') ? action.domain : `https://${action.domain}`,
        shortSummary: null,
        geo: null,
        priceTier: null,
        role: 'core', // Human-added is always core initially
        overallScore: 100,
        offerSimilarity: 100,
        audienceSimilarity: 100,
        geoOverlap: 100,
        priceTierOverlap: 100,
        compositeScore: 100,
        brandScale: null,
        source: 'manual',
        sourceNote: 'Added manually by user',
        removedByUser: false,
        promotedByUser: true,
        enrichedData: {
          companyType: null,
          category: null,
          summary: null,
          tagline: null,
          targetAudience: null,
          icpDescription: null,
          companySizeTarget: null,
          geographicFocus: null,
          headquartersLocation: null,
          serviceAreas: [],
          primaryOffers: [],
          uniqueFeatures: [],
          pricingTier: null,
          pricingModel: null,
          estimatedPriceRange: null,
          brandScale: null,
          estimatedEmployees: null,
          foundedYear: null,
          positioning: null,
          valueProposition: null,
          differentiators: [],
          weaknesses: [],
          primaryChannels: [],
          socialProof: [],
        },
        provenance: {
          discoveredFrom: ['human_provided'],
          humanOverride: true,
          humanOverrideAt: new Date().toISOString(),
          removed: false,
          removedAt: null,
          removedReason: null,
          promoted: false,
          promotedAt: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: null,
        xPosition: 50, // Center position for manual adds
        yPosition: 50,
        whyThisCompetitorMatters: null,
        howTheyDiffer: null,
        threatLevel: null,
        threatDrivers: [],
      };
      updatedCompetitors.push(newCompetitor);
      break;
    }
  }

  // Recompute stats
  const stats = computeRunStats(
    updatedCompetitors,
    run.stats?.candidatesDiscovered ?? run.candidatesDiscovered,
    run.stats?.candidatesEnriched ?? run.candidatesEnriched
  );

  return updateCompetitionRun(recordId, {
    competitors: updatedCompetitors,
    stats,
  });
}

// ============================================================================
// Confidence Scoring
// ============================================================================

/**
 * Calculate data confidence score for a run
 */
export function calculateDataConfidence(run: CompetitionRun): number {
  const activeCompetitors = run.competitors.filter((c) => !c.removedByUser && !c.provenance?.removed);

  if (activeCompetitors.length === 0) return 0;

  // Factor 1: Number of competitors found (more = better, up to a point)
  const countScore = Math.min(activeCompetitors.length * 10, 30);

  // Factor 2: Human override count (more human validation = higher confidence)
  const humanOverrideCount = activeCompetitors.filter(
    (c) => c.promotedByUser || c.provenance?.humanOverride
  ).length;
  const humanScore = Math.min(humanOverrideCount * 15, 30);

  // Factor 3: Average enrichment completeness
  const enrichmentScores = activeCompetitors.map((c) => {
    const data = c.enrichedData;
    if (!data) return 0;
    let filled = 0;
    if (data.summary) filled++;
    if (data.targetAudience) filled++;
    if (data.pricingTier) filled++;
    if (data.geographicFocus) filled++;
    if (data.primaryOffers?.length > 0) filled++;
    return (filled / 5) * 100;
  });
  const avgEnrichment = enrichmentScores.length > 0
    ? enrichmentScores.reduce((a, b) => a + b, 0) / enrichmentScores.length
    : 0;
  const enrichmentScore = avgEnrichment * 0.2;

  // Factor 4: Role distribution (having all 3 types = balanced landscape)
  const coreCount = activeCompetitors.filter((c) => c.role === 'core').length;
  const secondaryCount = activeCompetitors.filter((c) => c.role === 'secondary').length;
  const alternativeCount = activeCompetitors.filter((c) => c.role === 'alternative').length;
  const distributionScore = (coreCount > 0 ? 5 : 0) + (secondaryCount > 0 ? 5 : 0) + (alternativeCount > 0 ? 5 : 0);

  return Math.min(Math.round(countScore + humanScore + enrichmentScore + distributionScore), 100);
}

/**
 * Update data confidence score for a run
 */
export async function updateDataConfidence(recordId: string): Promise<CompetitionRun> {
  const run = await getCompetitionRun(recordId);
  if (!run) throw new Error('Run not found');

  const confidence = calculateDataConfidence(run);
  return updateCompetitionRun(recordId, {
    dataConfidenceScore: confidence,
  });
}
