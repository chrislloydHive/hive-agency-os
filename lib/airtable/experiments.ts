// lib/airtable/experiments.ts
// Airtable integration for Experiments table
//
// Experiments track A/B tests, hypotheses, and growth experiments
// with their lifecycle from idea → running → concluded

import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

const EXPERIMENTS_TABLE = 'Experiments';

/**
 * Experiments table field names (must match Airtable schema exactly)
 */
const EXPERIMENTS_FIELDS = {
  NAME: 'Name',
  COMPANY: 'Company',
  HYPOTHESIS: 'Hypothesis',
  SUCCESS_METRIC: 'Success Metric',
  EXPECTED_LIFT: 'Expected Lift',
  STATUS: 'Status',
  RESULTS: 'Results',
  LEARNINGS: 'Learnings',
  OUTCOME: 'Outcome',
  AREA: 'Area',
  SOURCE: 'Source',
  SOURCE_JSON: 'Source JSON',
  START_DATE: 'Start Date',
  END_DATE: 'End Date',
  CREATED_AT: 'Created At',
  NOTES: 'Notes',
} as const;

/**
 * Experiment status values
 */
export type ExperimentStatus = 'Idea' | 'Planned' | 'Running' | 'Concluded' | 'Archived';

/**
 * Experiment outcome values
 */
export type ExperimentOutcome = 'Win' | 'Loss' | 'Inconclusive' | 'Not Run';

/**
 * Experiment area values
 */
export type ExperimentArea = 'Funnel' | 'SEO' | 'Content' | 'Brand' | 'Demand' | 'Website' | 'Other';

/**
 * Experiment source values
 */
export type ExperimentSource = 'DMA Funnel' | 'GAP Analysis' | 'Analytics Insight' | 'Manual' | 'AI Suggestion';

/**
 * Experiment record from Airtable
 */
export interface ExperimentRecord {
  id: string;
  name: string;
  companyId?: string;
  companyName?: string;
  hypothesis: string;
  successMetric: string;
  expectedLift?: number;
  status: ExperimentStatus;
  results?: string;
  learnings?: string;
  outcome?: ExperimentOutcome;
  area: ExperimentArea;
  source: ExperimentSource;
  sourceJson?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  notes?: string;
}

/**
 * Input for creating a new experiment
 */
export interface CreateExperimentInput {
  name: string;
  companyId?: string;
  hypothesis: string;
  successMetric: string;
  expectedLift?: number;
  status?: ExperimentStatus;
  area?: ExperimentArea;
  source?: ExperimentSource;
  sourceJson?: Record<string, unknown>;
  notes?: string;
}

/**
 * Input for updating an experiment
 */
export interface UpdateExperimentInput {
  name?: string;
  hypothesis?: string;
  successMetric?: string;
  expectedLift?: number;
  status?: ExperimentStatus;
  results?: string;
  learnings?: string;
  outcome?: ExperimentOutcome;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

/**
 * Map Airtable record to ExperimentRecord
 */
function mapExperimentRecord(record: Airtable.Record<Airtable.FieldSet>): ExperimentRecord {
  const fields = record.fields;

  // Handle company link field (array of record IDs)
  const companyIds = fields[EXPERIMENTS_FIELDS.COMPANY] as string[] | undefined;
  const companyId = companyIds?.[0];

  return {
    id: record.id,
    name: (fields[EXPERIMENTS_FIELDS.NAME] as string) || 'Untitled Experiment',
    companyId,
    hypothesis: (fields[EXPERIMENTS_FIELDS.HYPOTHESIS] as string) || '',
    successMetric: (fields[EXPERIMENTS_FIELDS.SUCCESS_METRIC] as string) || '',
    expectedLift: fields[EXPERIMENTS_FIELDS.EXPECTED_LIFT] as number | undefined,
    status: (fields[EXPERIMENTS_FIELDS.STATUS] as ExperimentStatus) || 'Idea',
    results: fields[EXPERIMENTS_FIELDS.RESULTS] as string | undefined,
    learnings: fields[EXPERIMENTS_FIELDS.LEARNINGS] as string | undefined,
    outcome: fields[EXPERIMENTS_FIELDS.OUTCOME] as ExperimentOutcome | undefined,
    area: (fields[EXPERIMENTS_FIELDS.AREA] as ExperimentArea) || 'Other',
    source: (fields[EXPERIMENTS_FIELDS.SOURCE] as ExperimentSource) || 'Manual',
    sourceJson: fields[EXPERIMENTS_FIELDS.SOURCE_JSON] as string | undefined,
    startDate: fields[EXPERIMENTS_FIELDS.START_DATE] as string | undefined,
    endDate: fields[EXPERIMENTS_FIELDS.END_DATE] as string | undefined,
    createdAt: fields[EXPERIMENTS_FIELDS.CREATED_AT] as string | undefined,
    notes: fields[EXPERIMENTS_FIELDS.NOTES] as string | undefined,
  };
}

/**
 * Get all experiments, optionally filtered by company
 */
export async function getExperiments(options?: {
  companyId?: string;
  status?: ExperimentStatus | ExperimentStatus[];
  limit?: number;
}): Promise<ExperimentRecord[]> {
  const { companyId, status, limit = 100 } = options || {};

  console.log('[Experiments] Fetching experiments:', { companyId, status, limit });

  try {
    const filterFormulas: string[] = [];

    if (companyId) {
      filterFormulas.push(`FIND("${companyId}", ARRAYJOIN({Company}))`);
    }

    if (status) {
      if (Array.isArray(status)) {
        const statusFilters = status.map(s => `{Status} = "${s}"`);
        filterFormulas.push(`OR(${statusFilters.join(', ')})`);
      } else {
        filterFormulas.push(`{Status} = "${status}"`);
      }
    }

    const filterByFormula = filterFormulas.length > 0
      ? `AND(${filterFormulas.join(', ')})`
      : '';

    const records = await base(EXPERIMENTS_TABLE)
      .select({
        maxRecords: limit,
        sort: [{ field: EXPERIMENTS_FIELDS.CREATED_AT, direction: 'desc' }],
        ...(filterByFormula ? { filterByFormula } : {}),
      })
      .all();

    console.log('[Experiments] Retrieved', records.length, 'experiments');

    return records.map(mapExperimentRecord);
  } catch (error) {
    console.error('[Experiments] Error fetching experiments:', error);
    return [];
  }
}

/**
 * Get a single experiment by ID
 */
export async function getExperiment(experimentId: string): Promise<ExperimentRecord | null> {
  console.log('[Experiments] Fetching experiment:', experimentId);

  try {
    const record = await base(EXPERIMENTS_TABLE).find(experimentId);
    return mapExperimentRecord(record);
  } catch (error) {
    console.error('[Experiments] Error fetching experiment:', error);
    return null;
  }
}

/**
 * Create a new experiment
 */
export async function createExperiment(input: CreateExperimentInput): Promise<ExperimentRecord | null> {
  const {
    name,
    companyId,
    hypothesis,
    successMetric,
    expectedLift,
    status = 'Idea',
    area = 'Other',
    source = 'Manual',
    sourceJson,
    notes,
  } = input;

  console.log('[Experiments] Creating experiment:', { name, companyId, status, area, source });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {
    [EXPERIMENTS_FIELDS.NAME]: name,
    [EXPERIMENTS_FIELDS.HYPOTHESIS]: hypothesis,
    [EXPERIMENTS_FIELDS.SUCCESS_METRIC]: successMetric,
    [EXPERIMENTS_FIELDS.STATUS]: status,
    [EXPERIMENTS_FIELDS.AREA]: area,
    [EXPERIMENTS_FIELDS.SOURCE]: source,
  };

  if (companyId) {
    fields[EXPERIMENTS_FIELDS.COMPANY] = [companyId];
  }

  if (expectedLift !== undefined) {
    fields[EXPERIMENTS_FIELDS.EXPECTED_LIFT] = expectedLift;
  }

  if (sourceJson) {
    fields[EXPERIMENTS_FIELDS.SOURCE_JSON] = JSON.stringify(sourceJson);
  }

  if (notes) {
    fields[EXPERIMENTS_FIELDS.NOTES] = notes;
  }

  try {
    const records = await base(EXPERIMENTS_TABLE).create([{ fields }]);

    if (!records || records.length === 0) {
      console.error('[Experiments] No record returned from Airtable create');
      return null;
    }

    const record = records[0];
    console.log('[Experiments] Experiment created:', record.id);

    return mapExperimentRecord(record);
  } catch (error) {
    console.error('[Experiments] Error creating experiment:', error);
    throw error;
  }
}

/**
 * Update an existing experiment
 */
export async function updateExperiment(
  experimentId: string,
  input: UpdateExperimentInput
): Promise<ExperimentRecord | null> {
  console.log('[Experiments] Updating experiment:', experimentId, input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {};

  if (input.name !== undefined) {
    fields[EXPERIMENTS_FIELDS.NAME] = input.name;
  }
  if (input.hypothesis !== undefined) {
    fields[EXPERIMENTS_FIELDS.HYPOTHESIS] = input.hypothesis;
  }
  if (input.successMetric !== undefined) {
    fields[EXPERIMENTS_FIELDS.SUCCESS_METRIC] = input.successMetric;
  }
  if (input.expectedLift !== undefined) {
    fields[EXPERIMENTS_FIELDS.EXPECTED_LIFT] = input.expectedLift;
  }
  if (input.status !== undefined) {
    fields[EXPERIMENTS_FIELDS.STATUS] = input.status;
  }
  if (input.results !== undefined) {
    fields[EXPERIMENTS_FIELDS.RESULTS] = input.results;
  }
  if (input.learnings !== undefined) {
    fields[EXPERIMENTS_FIELDS.LEARNINGS] = input.learnings;
  }
  if (input.outcome !== undefined) {
    fields[EXPERIMENTS_FIELDS.OUTCOME] = input.outcome;
  }
  if (input.startDate !== undefined) {
    fields[EXPERIMENTS_FIELDS.START_DATE] = input.startDate;
  }
  if (input.endDate !== undefined) {
    fields[EXPERIMENTS_FIELDS.END_DATE] = input.endDate;
  }
  if (input.notes !== undefined) {
    fields[EXPERIMENTS_FIELDS.NOTES] = input.notes;
  }

  if (Object.keys(fields).length === 0) {
    console.warn('[Experiments] No fields to update');
    return getExperiment(experimentId);
  }

  try {
    const records = await base(EXPERIMENTS_TABLE).update([
      { id: experimentId, fields },
    ]);

    if (!records || records.length === 0) {
      console.error('[Experiments] No record returned from Airtable update');
      return null;
    }

    console.log('[Experiments] Experiment updated:', experimentId);
    return mapExperimentRecord(records[0]);
  } catch (error) {
    console.error('[Experiments] Error updating experiment:', error);
    throw error;
  }
}

/**
 * Delete an experiment
 */
export async function deleteExperiment(experimentId: string): Promise<boolean> {
  console.log('[Experiments] Deleting experiment:', experimentId);

  try {
    await base(EXPERIMENTS_TABLE).destroy([experimentId]);
    console.log('[Experiments] Experiment deleted:', experimentId);
    return true;
  } catch (error) {
    console.error('[Experiments] Error deleting experiment:', error);
    return false;
  }
}

/**
 * Get experiment statistics
 */
export async function getExperimentStats(companyId?: string): Promise<{
  total: number;
  byStatus: Record<ExperimentStatus, number>;
  byOutcome: Record<ExperimentOutcome, number>;
  winRate: number;
}> {
  const experiments = await getExperiments({ companyId, limit: 500 });

  const byStatus: Record<ExperimentStatus, number> = {
    Idea: 0,
    Planned: 0,
    Running: 0,
    Concluded: 0,
    Archived: 0,
  };

  const byOutcome: Record<ExperimentOutcome, number> = {
    Win: 0,
    Loss: 0,
    Inconclusive: 0,
    'Not Run': 0,
  };

  for (const exp of experiments) {
    byStatus[exp.status] = (byStatus[exp.status] || 0) + 1;
    if (exp.outcome) {
      byOutcome[exp.outcome] = (byOutcome[exp.outcome] || 0) + 1;
    }
  }

  const concluded = byOutcome.Win + byOutcome.Loss + byOutcome.Inconclusive;
  const winRate = concluded > 0 ? (byOutcome.Win / concluded) * 100 : 0;

  return {
    total: experiments.length,
    byStatus,
    byOutcome,
    winRate,
  };
}
