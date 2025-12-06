// lib/competition/store.ts
// Competition Lab v2 - Airtable Storage Layer
//
// Stores and retrieves competition runs from Airtable.

import {
  createRecord,
  updateRecord,
  findRecordByField,
  getRecord,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  CompetitionRun,
  CompetitionRunStatus,
  ScoredCompetitor,
  CompetitorFeedbackAction,
} from './types';
import { generateRunId, generateCompetitorId } from './types';

const TABLE = AIRTABLE_TABLES.COMPETITION_RUNS;

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Create a new competition run record
 */
export async function createCompetitionRun(
  companyId: string,
  contextSnapshotId?: string
): Promise<CompetitionRun> {
  const run: CompetitionRun = {
    id: generateRunId(),
    companyId,
    status: 'pending',
    startedAt: new Date().toISOString(),
    completedAt: null,
    contextSnapshotId: contextSnapshotId || null,
    querySet: {
      brandQueries: [],
      categoryQueries: [],
      geoQueries: [],
      marketplaceQueries: [],
    },
    modelVersion: 'v2',
    competitors: [],
    candidatesDiscovered: 0,
    candidatesEnriched: 0,
    candidatesScored: 0,
    dataConfidenceScore: 0,
    errors: [],
  };

  try {
    const record = await createRecord(TABLE, {
      'Run ID': run.id,
      'Company ID': companyId,
      'Status': run.status,
      'Run Data': JSON.stringify(run),
      'Created At': run.startedAt,
    });

    // Store the Airtable record ID in the run
    return { ...run, id: record.id };
  } catch (error) {
    console.error('[competition/store] Failed to create run:', error);
    throw error;
  }
}

/**
 * Update a competition run
 */
export async function updateCompetitionRun(
  recordId: string,
  updates: Partial<CompetitionRun>
): Promise<void> {
  try {
    // First get the current run data
    const current = await getRecord(TABLE, recordId);
    const currentRun: CompetitionRun = JSON.parse(current.fields['Run Data'] || '{}');

    // Merge updates
    const updatedRun: CompetitionRun = {
      ...currentRun,
      ...updates,
    };

    await updateRecord(TABLE, recordId, {
      'Status': updatedRun.status,
      'Run Data': JSON.stringify(updatedRun),
      'Updated At': new Date().toISOString(),
    });
  } catch (error) {
    console.error('[competition/store] Failed to update run:', error);
    throw error;
  }
}

/**
 * Get a competition run by ID
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
    // Find the most recent run for this company
    const record = await findRecordByField(TABLE, 'Company ID', companyId);
    if (!record) return null;

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
  limit: number = 10
): Promise<CompetitionRun[]> {
  try {
    const { getAirtableConfig } = await import('@/lib/airtable/client');
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

    return records.map((record: any) => {
      const runData: CompetitionRun = JSON.parse(record.fields['Run Data'] || '{}');
      return { ...runData, id: record.id };
    });
  } catch (error) {
    console.error('[competition/store] Failed to list runs:', error);
    return [];
  }
}

/**
 * Update run status
 */
export async function updateRunStatus(
  recordId: string,
  status: CompetitionRunStatus
): Promise<void> {
  await updateCompetitionRun(recordId, {
    status,
    ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
  });
}

/**
 * Add competitors to a run
 */
export async function addCompetitorsToRun(
  recordId: string,
  competitors: ScoredCompetitor[]
): Promise<void> {
  const run = await getCompetitionRun(recordId);
  if (!run) throw new Error('Run not found');

  await updateCompetitionRun(recordId, {
    competitors: [...run.competitors, ...competitors],
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
      // Add a new manually-added competitor (will need enrichment)
      const newCompetitor: ScoredCompetitor = {
        id: generateCompetitorId(),
        competitorName: action.name || action.domain,
        competitorDomain: action.domain,
        role: 'core', // Human-added is always core initially
        overallScore: 100, // Assume high relevance for human-added
        offerSimilarity: 100,
        audienceSimilarity: 100,
        geoOverlap: 100,
        priceTierOverlap: 100,
        brandScale: null,
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
        xPosition: null,
        yPosition: null,
        whyThisCompetitorMatters: null,
        howTheyDiffer: null,
        threatLevel: null,
        threatDrivers: [],
      };
      updatedCompetitors.push(newCompetitor);
      break;
    }
  }

  await updateCompetitionRun(recordId, {
    competitors: updatedCompetitors,
  });

  return {
    ...run,
    competitors: updatedCompetitors,
  };
}

/**
 * Calculate and update data confidence score
 */
export function calculateDataConfidence(run: CompetitionRun): number {
  const activeCompetitors = run.competitors.filter((c) => !c.provenance.removed);

  if (activeCompetitors.length === 0) return 0;

  // Factors affecting confidence:
  // 1. Number of competitors found (more = better, up to a point)
  const countScore = Math.min(activeCompetitors.length * 10, 30);

  // 2. Human override count (more human validation = higher confidence)
  const humanOverrideCount = activeCompetitors.filter((c) => c.provenance.humanOverride).length;
  const humanScore = Math.min(humanOverrideCount * 15, 30);

  // 3. Average enrichment completeness
  const enrichmentScores = activeCompetitors.map((c) => {
    const data = c.enrichedData;
    let filled = 0;
    if (data.summary) filled++;
    if (data.targetAudience) filled++;
    if (data.pricingTier) filled++;
    if (data.geographicFocus) filled++;
    if (data.primaryOffers.length > 0) filled++;
    return (filled / 5) * 100;
  });
  const avgEnrichment = enrichmentScores.reduce((a, b) => a + b, 0) / enrichmentScores.length;
  const enrichmentScore = avgEnrichment * 0.2;

  // 4. Role distribution (having core, secondary, and alternative = balanced)
  const coreCount = activeCompetitors.filter((c) => c.role === 'core').length;
  const secondaryCount = activeCompetitors.filter((c) => c.role === 'secondary').length;
  const alternativeCount = activeCompetitors.filter((c) => c.role === 'alternative').length;
  const distributionScore = (coreCount > 0 ? 5 : 0) + (secondaryCount > 0 ? 5 : 0) + (alternativeCount > 0 ? 5 : 0);

  return Math.min(Math.round(countScore + humanScore + enrichmentScore + distributionScore), 100);
}
