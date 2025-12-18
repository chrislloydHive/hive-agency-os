// lib/airtable/gapHeavyRuns.ts
// Airtable storage for GAP-Heavy Run (Worker V3)

import { HeavyGapRunState, createInitialState } from '@/lib/gap-heavy/state';
import {
  createRecord,
  updateRecord,
  findRecordByField,
} from '@/lib/airtable/client';
import { saveDiagnosticDetail } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Rate Limit Handling
// ============================================================================

/**
 * Fetch with automatic retry on rate limit (429)
 */
async function fetchWithRateLimitRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : (attempt + 1) * 1000;
      console.warn(`[gapHeavyRuns] Rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      lastError = new Error('Rate limit exceeded');
      continue;
    }

    return response;
  }

  throw lastError || new Error('Max retries exceeded');
}

const HEAVY_TABLE =
  process.env.AIRTABLE_HEAVY_GAP_RUNS_TABLE || 'GAP-Heavy Run';

// ============================================================================
// Airtable Field Mapping
// ============================================================================

/**
 * Airtable fields for GAP-Heavy Run table:
 *
 * V3 Fields (existing):
 * - Name (formula or text) - e.g., "{Domain} – Heavy Run"
 * - Company (link to Companies) - array of record IDs
 * - GAP Plan Run (link to GAP-Plan Run) - array of record IDs
 * - GAP Full Report (link to GAP-Full Report) - array of record IDs
 * - Status (single select) - pending, running, paused, completed, error, cancelled
 * - Current Step (single select) - init, discoverPages, analyzePages, etc.
 * - Steps Completed (long text) - JSON string array
 * - URL (text)
 * - Domain (text)
 * - Worker Version (text)
 * - Tick Count (number)
 * - Last Tick At (date/time)
 * - Error Message (long text)
 * - Data JSON (long text) - stringified state.data (V3 step-based data)
 * - Created At (date/time)
 * - Updated At (date/time)
 *
 * V4 Fields (new - for modular architecture):
 * - Modules Requested (long text) - JSON array of DiagnosticModuleKey
 * - Modules Completed (long text) - JSON array of DiagnosticModuleKey
 * - Evidence JSON (long text) - stringified EvidencePack
 */

async function stateToAirtableFields(
  state: HeavyGapRunState
): Promise<Record<string, unknown>> {
  console.log('[stateToAirtableFields] Starting conversion, has evidencePack:', !!state.evidencePack);

  const fields: Record<string, unknown> = {
    // Text fields
    URL: state.url,
    Domain: state.domain,
    'Worker Version': state.workerVersion,

    // Single select fields - removed (can't create new options)
    // Status: state.status,
    // 'Current Step': state.currentStep,

    // JSON/Long text fields
    'Steps Completed': JSON.stringify(state.stepsCompleted),
    // Store status and currentStep in Data JSON to persist them
    'Data JSON': JSON.stringify({
      ...state.data,
      _status: state.status,
      _currentStep: state.currentStep,
    }),

    // Number fields
    'Tick Count': state.tickCount,

    // Date fields
    'Created At': state.createdAt,
    'Updated At': state.updatedAt,
  };

  // Optional link fields (only include if they have values)
  if (state.gapPlanRunId) {
    fields['GAP Plan Run'] = [state.gapPlanRunId];
  }
  if (state.companyId) {
    fields['Company'] = [state.companyId];
  }
  if (state.gapFullReportId) {
    fields['GAP Full Report'] = [state.gapFullReportId];
  }

  // Optional fields
  if (state.lastTickAt) {
    fields['Last Tick At'] = state.lastTickAt;
  }
  if (state.errorMessage) {
    fields['Error Message'] = state.errorMessage;
  }

  // ============================================================================
  // V4 Modular Architecture Fields (NEW)
  // ============================================================================

  // Modules Requested - JSON array
  if (state.modulesRequested && state.modulesRequested.length > 0) {
    fields['Modules Requested'] = JSON.stringify(state.modulesRequested);
  }

  // Modules Completed - JSON array
  if (state.modulesCompleted && state.modulesCompleted.length > 0) {
    fields['Modules Completed'] = JSON.stringify(state.modulesCompleted);
  }

  // Evidence Pack - NEW APPROACH: Store full data in separate table
  // Only keep metadata/summary in Evidence JSON to bypass 100KB limit
  if (state.evidencePack && state.id) {
    // IMPORTANT: Delete any existing diagnostic details for this run first
    // This prevents duplicate records from being created on updates
    try {
      const { deleteDiagnosticDetailsByRunId } = await import('@/lib/airtable/diagnosticDetails');
      await deleteDiagnosticDetailsByRunId(state.id);
      console.log('[gapHeavyRuns] Cleared old diagnostic details for run:', state.id);
    } catch (error) {
      console.error('[gapHeavyRuns] Failed to clear old diagnostic details:', error);
      // Continue - this is not critical
    }

    // Save full data to separate Diagnostic Details table
    // This allows us to store unlimited data without hitting Airtable's 100KB field limit

    // Save modules (if present)
    if (state.evidencePack.modules && Array.isArray(state.evidencePack.modules)) {
      console.log('[gapHeavyRuns] About to save modules. Current modules array:', {
        count: state.evidencePack.modules.length,
        statuses: state.evidencePack.modules.map(m => m.status),
        firstModule: state.evidencePack.modules[0],
      });

      try {
        const modulesJson = JSON.stringify(state.evidencePack.modules);
        console.log('[gapHeavyRuns] Modules JSON length:', modulesJson.length);

        await saveDiagnosticDetail({
          runId: state.id,
          dataType: 'modules',
          jsonData: modulesJson,
          sizeKB: 0, // Will be calculated in saveDiagnosticDetail
        });
        console.log('[gapHeavyRuns] Saved full modules data to Diagnostic Details table');
      } catch (error) {
        console.error('[gapHeavyRuns] Failed to save modules to Diagnostic Details:', error);
        // Continue even if this fails - we'll still save metadata
      }
    }

    // Save websiteLabV4 (if present)
    if (state.evidencePack.websiteLabV4) {
      try {
        await saveDiagnosticDetail({
          runId: state.id,
          dataType: 'websiteLabV4',
          jsonData: JSON.stringify(state.evidencePack.websiteLabV4),
          sizeKB: 0, // Will be calculated in saveDiagnosticDetail
        });
        console.log('[gapHeavyRuns] Saved full websiteLabV4 data to Diagnostic Details table');
      } catch (error) {
        console.error('[gapHeavyRuns] Failed to save websiteLabV4 to Diagnostic Details:', error);
        // Continue even if this fails
      }
    }

    // Save websiteActionPlan (if present)
    if (state.evidencePack.websiteActionPlan) {
      try {
        await saveDiagnosticDetail({
          runId: state.id,
          dataType: 'websiteActionPlan',
          jsonData: JSON.stringify(state.evidencePack.websiteActionPlan),
          sizeKB: 0, // Will be calculated in saveDiagnosticDetail
        });
        console.log('[gapHeavyRuns] Saved full websiteActionPlan data to Diagnostic Details table');
      } catch (error) {
        console.error('[gapHeavyRuns] Failed to save websiteActionPlan to Diagnostic Details:', error);
        // Continue even if this fails
      }
    }

    // Save brandLab (if present)
    if (state.evidencePack.brandLab) {
      try {
        await saveDiagnosticDetail({
          runId: state.id,
          dataType: 'brandLab',
          jsonData: JSON.stringify(state.evidencePack.brandLab),
          sizeKB: 0, // Will be calculated in saveDiagnosticDetail
        });
        console.log('[gapHeavyRuns] Saved full brandLab data to Diagnostic Details table');
      } catch (error) {
        console.error('[gapHeavyRuns] Failed to save brandLab to Diagnostic Details:', error);
        // Continue even if this fails
      }
    }

    // Now create minimal metadata for Evidence JSON field
    const metadata: any = {
      _hasFullData: true,
      _storedInSeparateTable: true,
      _timestamp: new Date().toISOString(),
    };

    // Add summary counts for quick reference
    if (state.evidencePack.modules) {
      metadata.modulesCount = state.evidencePack.modules.length;
    }
    if (state.evidencePack.websiteLabV4) {
      const labV4 = state.evidencePack.websiteLabV4 as any;
      metadata.websiteLabV4Summary = {
        score: labV4.siteAssessment?.score,
        pagesAnalyzed: labV4.siteGraph?.pages?.length || 0,
        hasIntelligenceEngines: !!(labV4.ctaIntelligence || labV4.contentIntelligence),
      };
    }
    if (state.evidencePack.websiteActionPlan) {
      const actionPlan = state.evidencePack.websiteActionPlan as any;
      metadata.actionPlanSummary = {
        totalActions: actionPlan.actions?.length || 0,
        priority: actionPlan.priority,
      };
    }

    // Strip websiteNarrative - it's too large (3,000-6,000+ words) for Airtable storage
    // The narrative can be regenerated on-demand via the narrative engine API
    if (state.evidencePack.websiteNarrative && typeof state.evidencePack.websiteNarrative === 'object') {
      const narrative = state.evidencePack.websiteNarrative as any;
      metadata.narrativeSummary = {
        _canGenerate: true,
        _overallScore: narrative.overallScore,
        _benchmarkLabel: narrative.benchmarkLabel,
        _sectionsCount: narrative.sections?.length || 0,
      };
    }

    // Also keep website evidence metadata (if present)
    if (state.evidencePack.website) {
      const { rawHtml, ...websiteMetadata } = state.evidencePack.website as any;
      metadata.website = websiteMetadata;
    }

    const jsonString = JSON.stringify(metadata);
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);

    console.log('[gapHeavyRuns] Evidence JSON metadata size:', {
      sizeInKB: `${sizeInKB} KB`,
      sizeInBytes,
      approach: 'Full data stored in Diagnostic Details table',
    });

    fields['Evidence JSON'] = jsonString;
  } else if (state.evidencePack && !state.id) {
    // This is a new record being created - we don't have an ID yet
    // Store a placeholder that will be updated after creation
    fields['Evidence JSON'] = JSON.stringify({
      _pendingFullStorage: true,
      _timestamp: new Date().toISOString(),
    });
    console.log('[gapHeavyRuns] New record - will store full data on next update');
  }

  return fields;
}

async function airtableRecordToState(
  record: any,
  options: { loadFullDetails?: boolean } = {}
): Promise<HeavyGapRunState> {
  const fields = record.fields || {};

  // Helper to safely parse JSON with fallback
  const parseJson = <T>(value: string | undefined, fallback: T): T => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('[gapHeavyRuns] Failed to parse JSON field:', error);
      return fallback;
    }
  };

  // Helper to extract first ID from link field (array)
  const getFirstLinkId = (field: any): string | undefined => {
    if (Array.isArray(field) && field.length > 0) {
      return field[0];
    }
    return undefined;
  };

  // Parse Data JSON and extract embedded status/currentStep
  const dataJson = parseJson(fields['Data JSON'], {}) as any;
  const embeddedStatus = dataJson._status;
  const embeddedCurrentStep = dataJson._currentStep;

  // Remove the embedded fields from data object to keep it clean
  const { _status, _currentStep, ...cleanData } = dataJson;

  // Parse V4 fields
  const modulesRequested = parseJson<string[]>(fields['Modules Requested'], []);
  const modulesCompleted = parseJson<string[]>(fields['Modules Completed'], []);
  let evidencePack = parseJson(fields['Evidence JSON'], undefined) as any;

  // If requested, load full details from separate table
  if (options.loadFullDetails && record.id && evidencePack && evidencePack._hasFullData) {
    try {
      console.log('[gapHeavyRuns] Loading full diagnostic details from separate table...');
      const { getDiagnosticDetailsByRunId, parseDiagnosticData } = await import('@/lib/airtable/diagnosticDetails');

      const details = await getDiagnosticDetailsByRunId(record.id);

      if (details.length > 0) {
        // Reconstruct full evidencePack with complete data
        const fullPack: any = { ...evidencePack };

        // Load modules
        const modulesDetail = details.find((d) => d.dataType === 'modules');
        if (modulesDetail) {
          fullPack.modules = parseDiagnosticData(modulesDetail);
          console.log(`[gapHeavyRuns] Loaded ${fullPack.modules?.length || 0} modules`);
        }

        // Load websiteLabV4
        const labDetail = details.find((d) => d.dataType === 'websiteLabV4');
        if (labDetail) {
          fullPack.websiteLabV4 = parseDiagnosticData(labDetail);
          console.log('[gapHeavyRuns] Loaded websiteLabV4');
        }

        // Load websiteActionPlan
        const actionPlanDetail = details.find((d) => d.dataType === 'websiteActionPlan');
        if (actionPlanDetail) {
          fullPack.websiteActionPlan = parseDiagnosticData(actionPlanDetail);
          console.log('[gapHeavyRuns] Loaded websiteActionPlan');
        }

        // Load brandLab
        const brandLabDetail = details.find((d) => d.dataType === 'brandLab');
        if (brandLabDetail) {
          fullPack.brandLab = parseDiagnosticData(brandLabDetail);
          console.log('[gapHeavyRuns] Loaded brandLab');
        }

        evidencePack = fullPack;
        console.log('[gapHeavyRuns] Successfully loaded full diagnostic details');
      }
    } catch (error) {
      console.error('[gapHeavyRuns] Failed to load full details:', error);
      // Continue with metadata-only evidencePack
    }
  }

  return {
    id: record.id,
    gapPlanRunId: getFirstLinkId(fields['GAP Plan Run']) || '',
    companyId: getFirstLinkId(fields['Company']),
    gapFullReportId: getFirstLinkId(fields['GAP Full Report']),

    url: (fields['URL'] as string) || '',
    domain: (fields['Domain'] as string) || '',

    // Prefer embedded status/currentStep from Data JSON (more reliable)
    status: (embeddedStatus as HeavyGapRunState['status']) ||
            (fields['Status'] as HeavyGapRunState['status']) ||
            'pending',
    currentStep: (embeddedCurrentStep as HeavyGapRunState['currentStep']) ||
                 (fields['Current Step'] as HeavyGapRunState['currentStep']) ||
                 'init',
    stepsCompleted: parseJson(fields['Steps Completed'], []),

    workerVersion: (fields['Worker Version'] as string) || 'heavy-v3.0.0',
    createdAt: (fields['Created At'] as string) || new Date().toISOString(),
    updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
    lastTickAt: fields['Last Tick At'] as string | undefined,
    tickCount: (fields['Tick Count'] as number) || 0,
    errorMessage: fields['Error Message'] as string | undefined,

    // ============================================================================
    // V4 Modular Architecture Fields (NEW)
    // ============================================================================

    modulesRequested: modulesRequested.length > 0 ? (modulesRequested as any) : undefined,
    modulesCompleted: modulesCompleted.length > 0 ? (modulesCompleted as any) : undefined,
    evidencePack: evidencePack as any,

    // ============================================================================
    // V3 Step-Based Data (LEGACY)
    // ============================================================================

    data: cleanData,
  };
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Create a new Heavy GAP Run in Airtable
 *
 * @param params - Initial parameters
 * @returns Created HeavyGapRunState (with Airtable record ID)
 */
export async function createHeavyGapRun(params: {
  gapPlanRunId: string;
  companyId?: string;
  companyName?: string;
  gapFullReportId?: string;
  url: string;
  domain: string;
}): Promise<HeavyGapRunState> {
  try {
    console.log('[gapHeavyRuns] Creating Heavy GAP Run:', {
      gapPlanRunId: params.gapPlanRunId,
      url: params.url,
      domain: params.domain,
    });

    // Create initial state (with temporary ID)
    const initialState = createInitialState({
      id: '', // Will be replaced with Airtable record ID
      ...params,
    });

    // Map to Airtable fields
    const fields = await stateToAirtableFields(initialState);

    // Add Company Name field (primary field)
    const namePrefix = params.companyName || params.domain || 'Unknown';
    fields['Company Name'] = `${namePrefix} - Heavy Run`;

    // Debug: Log what we're sending to Airtable
    console.log('[gapHeavyRuns] Creating Heavy Run with fields:', {
      'Company Name': fields['Company Name'],
      'Company': fields['Company'],
      'companyId from state': initialState.companyId,
    });

    // Create record
    const result = await createRecord(HEAVY_TABLE, fields);
    const recordId = result?.id;

    if (!recordId) {
      throw new Error('Failed to create Heavy GAP Run: no record ID returned');
    }

    // Return state with actual Airtable record ID
    const createdState: HeavyGapRunState = {
      ...initialState,
      id: recordId,
    };

    console.log('[gapHeavyRuns] Created Heavy GAP Run:', {
      id: recordId,
      gapPlanRunId: params.gapPlanRunId,
    });

    return createdState;
  } catch (error) {
    console.error('[gapHeavyRuns] Failed to create Heavy GAP Run:', error);
    throw error;
  }
}

/**
 * Get a Heavy GAP Run by its Airtable record ID
 *
 * @param id - Airtable record ID
 * @returns HeavyGapRunState or null if not found
 */
export async function getHeavyGapRunById(
  id: string
): Promise<HeavyGapRunState | null> {
  try {
    console.log('[gapHeavyRuns] Fetching Heavy GAP Run:', id);

    // Use findRecordByField with a formula that matches the record ID
    // Since Airtable record IDs are unique, we can query by RECORD_ID()
    const config = {
      apiKey: process.env.AIRTABLE_API_KEY!,
      baseId: process.env.AIRTABLE_BASE_ID!,
    };

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      HEAVY_TABLE
    )}/${id}`;

    const response = await fetchWithRateLimitRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[gapHeavyRuns] Heavy GAP Run not found:', id);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const record = await response.json();
    const state = await airtableRecordToState(record, { loadFullDetails: true });

    console.log('[gapHeavyRuns] Retrieved Heavy GAP Run:', {
      id: state.id,
      status: state.status,
      currentStep: state.currentStep,
    });

    return state;
  } catch (error) {
    console.error('[gapHeavyRuns] Failed to get Heavy GAP Run:', error);
    throw error;
  }
}

/**
 * Update a Heavy GAP Run state in Airtable
 *
 * @param state - Current state to save
 * @returns Updated HeavyGapRunState
 */
export async function updateHeavyGapRunState(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  try {
    console.log('[gapHeavyRuns] Updating Heavy GAP Run:', {
      id: state.id,
      status: state.status,
      currentStep: state.currentStep,
      tickCount: state.tickCount,
    });

    // Update the updatedAt timestamp
    const updatedState: HeavyGapRunState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };

    // Map to Airtable fields
    const fields = await stateToAirtableFields(updatedState);

    // Update record
    await updateRecord(HEAVY_TABLE, state.id, fields);

    console.log('[gapHeavyRuns] Updated Heavy GAP Run:', state.id);

    return updatedState;
  } catch (error) {
    console.error('[gapHeavyRuns] Failed to update Heavy GAP Run:', error);
    throw error;
  }
}

/**
 * Get Heavy GAP Run by GAP Plan Run ID
 *
 * Useful for finding heavy runs associated with a specific GAP Plan Run.
 *
 * @param gapPlanRunId - GAP Plan Run record ID
 * @returns HeavyGapRunState or null if not found
 */
export async function getHeavyGapRunByGapPlanRunId(
  gapPlanRunId: string
): Promise<HeavyGapRunState | null> {
  try {
    console.log('[gapHeavyRuns] Finding Heavy GAP Run by GAP Plan Run ID:', gapPlanRunId);

    const config = {
      apiKey: process.env.AIRTABLE_API_KEY!,
      baseId: process.env.AIRTABLE_BASE_ID!,
    };

    // Use filterByFormula to find record with matching GAP Plan Run link
    const filterFormula = `FIND('${gapPlanRunId}', ARRAYJOIN({GAP Plan Run})) > 0`;
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      HEAVY_TABLE
    )}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const response = await fetchWithRateLimitRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const records = result.records || [];

    if (records.length === 0) {
      console.log(
        '[gapHeavyRuns] No Heavy GAP Run found for GAP Plan Run ID:',
        gapPlanRunId
      );
      return null;
    }

    const state = await airtableRecordToState(records[0], { loadFullDetails: true });

    console.log('[gapHeavyRuns] Found Heavy GAP Run:', {
      id: state.id,
      gapPlanRunId: state.gapPlanRunId,
    });

    return state;
  } catch (error) {
    console.error(
      '[gapHeavyRuns] Failed to find Heavy GAP Run by GAP Plan Run ID:',
      error
    );
    throw error;
  }
}

/**
 * List recent GAP-Heavy Runs for Hive OS dashboard
 * Returns most recent runs sorted by creation time
 */
export async function listRecentGapHeavyRuns(limit: number = 20): Promise<HeavyGapRunState[]> {
  try {
    console.log('[gapHeavyRuns] Listing recent Heavy GAP Runs, limit:', limit);

    const config = {
      apiKey: process.env.AIRTABLE_API_KEY!,
      baseId: process.env.AIRTABLE_BASE_ID!,
    };

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      HEAVY_TABLE
    )}?maxRecords=${limit}&sort[0][field]=Created%20At&sort[0][direction]=desc&filterByFormula=${encodeURIComponent('NOT({Archived})')}`;

    const response = await fetchWithRateLimitRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const records = result.records || [];

    console.log(`[gapHeavyRuns] Retrieved ${records.length} Heavy GAP Runs`);

    // Map records to state, with option to load full details
    const states = await Promise.all(
      records.map((record: any) => airtableRecordToState(record, { loadFullDetails: true }))
    );

    return states;
  } catch (error) {
    console.error('[gapHeavyRuns] Failed to list recent Heavy GAP Runs:', error);
    return [];
  }
}

// Backward compatibility alias
export const getHeavyGapRunByGapRunId = getHeavyGapRunByGapPlanRunId;

/**
 * Get Heavy GAP Runs by Company ID
 *
 * Returns all heavy runs for a specific company, sorted by creation time (newest first).
 *
 * @param companyId - Company record ID
 * @param limit - Maximum number of runs to return (default: 10)
 * @returns Array of HeavyGapRunState
 */
export async function getHeavyGapRunsByCompanyId(
  companyId: string,
  limit: number = 10
): Promise<HeavyGapRunState[]> {
  try {
    console.log('[gapHeavyRuns] Finding Heavy GAP Runs by Company ID:', companyId);

    const config = {
      apiKey: process.env.AIRTABLE_API_KEY!,
      baseId: process.env.AIRTABLE_BASE_ID!,
    };

    // Airtable formulas can't easily query linked record IDs (only display values)
    // So we fetch recent records and filter in JavaScript instead
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      HEAVY_TABLE
    )}?maxRecords=100&sort[0][field]=Created%20At&sort[0][direction]=desc`;

    console.log('[gapHeavyRuns] Fetching recent Heavy Runs and filtering by Company in JavaScript');

    const response = await fetchWithRateLimitRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const allRecords = result.records || [];

    // Filter records by Company field in JavaScript
    const records = allRecords.filter((record: any) => {
      const companyField = record.fields?.Company;
      // Company field is an array of linked record IDs: ['recWofrWdHQOwDIBP']
      return Array.isArray(companyField) && companyField.includes(companyId);
    }).slice(0, limit);

    console.log(
      `[gapHeavyRuns] Found ${records.length} Heavy GAP Runs for company ${companyId} (filtered from ${allRecords.length} total)`
    );

    // Map records to state, with option to load full details
    const states = await Promise.all(
      records.map((record: any) => airtableRecordToState(record, { loadFullDetails: true }))
    );

    return states;
  } catch (error) {
    console.error(
      '[gapHeavyRuns] Failed to find Heavy GAP Runs by Company ID:',
      error
    );
    return [];
  }
}

/**
 * Update Heavy GAP Run metrics in Airtable
 *
 * This function updates specific Airtable fields with key metrics from the analysis.
 * It's called after the analyzePages step completes to surface metrics in Airtable.
 *
 * Best-effort: Does not throw errors, only logs warnings.
 *
 * @param id - Heavy GAP Run record ID
 * @param metrics - Metrics to update
 */
export async function updateHeavyRunMetrics(
  id: string,
  metrics: {
    pagesAnalyzed?: number;
    totalWords?: number;
    avgWordsPerPage?: number;
    contentDepthBucket?: 'shallow' | 'medium' | 'deep';
    hasBlog?: boolean;
  }
): Promise<void> {
  try {
    console.log('[gapHeavyRuns] Updating Heavy GAP Run metrics:', {
      id,
      metrics,
    });

    const fields: Record<string, unknown> = {};

    // Number fields
    if (metrics.pagesAnalyzed !== undefined) {
      fields['Pages Analyzed'] = metrics.pagesAnalyzed;
    }
    if (metrics.totalWords !== undefined) {
      fields['Total Words'] = metrics.totalWords;
    }
    if (metrics.avgWordsPerPage !== undefined) {
      fields['Avg Words per Page'] = metrics.avgWordsPerPage;
    }

    // Single select field
    if (metrics.contentDepthBucket) {
      fields['Content Depth Bucket'] = metrics.contentDepthBucket;
    }

    // Checkbox field
    if (metrics.hasBlog !== undefined) {
      fields['Has Blog / Resource Hub'] = metrics.hasBlog;
    }

    // Only update if there are fields to update
    if (Object.keys(fields).length === 0) {
      console.log('[gapHeavyRuns] No metrics to update, skipping');
      return;
    }

    // Update record
    await updateRecord(HEAVY_TABLE, id, fields);

    console.log('[gapHeavyRuns] Updated Heavy GAP Run metrics:', id);
  } catch (error) {
    // Best-effort: log warning but don't throw
    console.warn('[gapHeavyRuns] Failed to update Heavy GAP Run metrics:', error);
  }
}
