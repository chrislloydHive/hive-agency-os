// lib/gap/gapRunStore.ts
// Data access layer for GapRun records stored in Airtable

import Airtable from 'airtable';
import { env } from '../env';
import type { GapRunState, GapRunStep } from '@/types/gap';

// Lazy initialization to avoid build-time errors
let _base: Airtable.Base | null = null;
function getBase(): Airtable.Base {
  if (!_base) {
    const apiKey = env.AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY || '';
    
    // Debug: Log all potential sources
    console.log(`[gapRunStore] Environment variable check:`);
    console.log(`[gapRunStore]   AIRTABLE_BASE_ID_OVERRIDE: ${process.env.AIRTABLE_BASE_ID_OVERRIDE || 'not set'}`);
    console.log(`[gapRunStore]   env.AIRTABLE_BASE_ID: ${env.AIRTABLE_BASE_ID || 'not set'}`);
    console.log(`[gapRunStore]   process.env.AIRTABLE_BASE_ID: ${process.env.AIRTABLE_BASE_ID || 'not set'}`);
    
    // Allow override via environment variable, fallback to env.ts, then process.env
    // Priority: OVERRIDE > env.ts > process.env
    // If base ID looks wrong (starts with 'tbl' instead of 'app'), force correct one
    let baseId = process.env.AIRTABLE_BASE_ID_OVERRIDE 
      || env.AIRTABLE_BASE_ID 
      || process.env.AIRTABLE_BASE_ID 
      || '';
    
    // Safety check: if base ID looks like a table ID (starts with 'tbl'), use correct base ID
    if (baseId.startsWith('tbl')) {
      console.error(`[gapRunStore] ❌ ERROR: Base ID "${baseId}" looks like a table ID, not a base ID!`);
      console.error(`[gapRunStore] ❌ Base IDs should start with "app", table IDs start with "tbl"`);
      console.error(`[gapRunStore] ❌ Using correct base ID: appVLDjqK2q4IJhGz`);
      baseId = 'appVLDjqK2q4IJhGz'; // Force correct base ID
    }
    
    if (!apiKey || !baseId) {
      throw new Error('Airtable credentials not configured. Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables.');
    }
    
    console.log(`[gapRunStore] Initializing Airtable base: ${baseId} (full ID for verification)`);
    if (baseId !== 'appVLDjqK2q4IJhGz') {
      console.warn(`[gapRunStore] ⚠️  Base ID mismatch! Expected: appVLDjqK2q4IJhGz, Got: ${baseId}`);
      console.warn(`[gapRunStore] ⚠️  Update AIRTABLE_BASE_ID in Vercel to: appVLDjqK2q4IJhGz`);
    }
    _base = new Airtable({ apiKey }).base(baseId);
  }
  return _base;
}

export type GapRunStatus = "queued" | "running" | "completed" | "failed";

export interface GapRun {
  id: string;                // e.g. "GAP-<timestamp>-<random>"
  websiteUrl: string;
  createdAt: Date;
  updatedAt: Date;
  status: GapRunStatus;
  progress: number;          // 0–100
  stage: string | null;      // e.g. "crawling", "scoring", "generating-plan"
  currentFinding: string | null;  // Live teaser text shown during analysis
  error: string | null;
  result: unknown | null;    // full GAP plan JSON once complete

  // Benchmarking fields (optional for backward compatibility)
  overallScore?: number | null;
  websiteScore?: number | null;
  brandScore?: number | null;
  contentScore?: number | null;
  seoScore?: number | null;
  authorityScore?: number | null;
  maturityStage?: string | null;
  category?: string | null;

  // Benchmark cohort fields
  benchmarkCohort?: string | null;
  companyType?: string | null;
  tier?: string | null;
}

// Support both table name and table ID for flexibility
// Table ID is more reliable if you have it: tblo3fJheLmGx06td
const GAP_RUNS_TABLE = process.env.AIRTABLE_GAP_RUNS_TABLE_ID || process.env.AIRTABLE_GAP_RUNS_TABLE || 'GAP-Plan Run';

// Log table identifier on module load for debugging
console.log(`[gapRunStore] Using Airtable table: "${GAP_RUNS_TABLE}" (${process.env.AIRTABLE_GAP_RUNS_TABLE_ID ? 'ID' : 'name'})`);

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `GAP-${timestamp}-${random}`;
}

/**
 * Create a new GapRun record in Airtable
 */
export async function createGapRun(websiteUrl: string, companyId?: string): Promise<GapRun> {
  try {
    const base = getBase();
    const runId = generateRunId();
    const now = new Date();

    // Log base ID for debugging
    const baseId = process.env.AIRTABLE_BASE_ID_OVERRIDE 
      || env.AIRTABLE_BASE_ID 
      || process.env.AIRTABLE_BASE_ID 
      || 'unknown';
    console.log(`[createGapRun] Base ID being used: ${baseId}`);
    console.log(`[createGapRun] Expected base ID: appVLDjqK2q4IJhGz`);
    console.log(`[createGapRun] Creating GapRun with ID: ${runId}`);
    console.log(`[createGapRun] Using table: ${GAP_RUNS_TABLE}`);
    console.log(`[createGapRun] Website URL: ${websiteUrl}`);

    // Set fields according to GAP-Plan Run table schema
    const fields: Record<string, unknown> = {
      'Company ID': runId, // Changed from 'Plan ID' to match GAP-Plan Run schema
      'URL': websiteUrl,
      'Status': 'queued',
      'Progress': 0,
      'Stage': 'queued',
      'Company Name': `Run ${runId}`, // Changed from 'Business Name' to match GAP-Plan Run schema
      'Created At': now.toISOString(),
      'Updated At': now.toISOString(),
    };

    // Link to Company record if companyId is provided
    if (companyId) {
      fields['Company'] = [companyId]; // Array for linked record field
      console.log(`[createGapRun] Linking to company: ${companyId}`);
    }

            console.log(`[createGapRun] Fields to create:`, Object.keys(fields));
            console.log(`[createGapRun] About to call Airtable create API...`);

            // Add timeout wrapper around Airtable create (10 seconds)
            const createStartTime = Date.now();
            const createPromise = base(GAP_RUNS_TABLE).create([
              { fields: fields as any }
            ]);
            
            const createTimeout = new Promise<never>((_, reject) => {
              setTimeout(() => {
                const elapsed = ((Date.now() - createStartTime) / 1000).toFixed(2);
                reject(new Error(`Airtable create operation timed out after ${elapsed} seconds`));
              }, 10000);
            });
            
            const records = await Promise.race([createPromise, createTimeout]);
            const createElapsed = ((Date.now() - createStartTime) / 1000).toFixed(2);
            console.log(`[createGapRun] ✅ Airtable create completed in ${createElapsed}s`);

            const record = records[0];
            console.log(`[createGapRun] ✅ Successfully created record: ${record.id}`);
    
    return {
      id: runId,
      websiteUrl,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      progress: 0,
      stage: null,
      currentFinding: null,
      error: null,
      result: null,
    };
  } catch (error: any) {
    console.error('[createGapRun] ❌ Error creating GapRun:', error);
    console.error('[createGapRun] Error type:', error?.constructor?.name);
    console.error('[createGapRun] Error message:', error?.message);
    console.error('[createGapRun] Error statusCode:', error?.statusCode);
    console.error('[createGapRun] Error error:', error?.error);
    
    // Log full error details for debugging
    if (error?.error) {
      console.error('[createGapRun] Full Airtable error:', JSON.stringify(error.error, null, 2));
    }
    if (error?.stack) {
      console.error('[createGapRun] Stack trace:', error.stack);
    }
    
    // Provide more helpful error messages
    if (error?.statusCode === 404) {
      const baseId = process.env.AIRTABLE_BASE_ID_OVERRIDE 
        || env.AIRTABLE_BASE_ID 
        || process.env.AIRTABLE_BASE_ID 
        || 'unknown';
      throw new Error(
        `Airtable table "${GAP_RUNS_TABLE}" not found in base "${baseId}". ` +
        `Expected base ID: "appVLDjqK2q4IJhGz". ` +
        `Please verify: 1) AIRTABLE_BASE_ID in Vercel matches appVLDjqK2q4IJhGz, ` +
        `2) Table "Gap Runs" exists in that base, ` +
        `3) API key has access to that base. ` +
        `Alternatively, set AIRTABLE_GAP_RUNS_TABLE_ID=tblo3fJheLmGx06td to use table ID directly.`
      );
    }
    
    if (error?.error === 'UNKNOWN_FIELD_NAME' || error?.message?.includes('UNKNOWN_FIELD_NAME')) {
      // Required fields (Current Finding is optional)
      const fieldNames = ['Run ID', 'Website URL', 'Status', 'Progress', 'Stage', 'Error', 'Result', 'Created At', 'Updated At'];
      const unknownField = error?.error?.message || error?.message || 'unknown';
      // If it's "Current Finding", provide helpful message
      if (unknownField.includes('Current Finding')) {
        throw new Error(
          `Airtable field "Current Finding" not found. This field is optional. ` +
          `Either add it to your table (Single line text) or ignore this error. ` +
          `Required fields: ${fieldNames.join(', ')}`
        );
      }
      throw new Error(
        `Airtable field name mismatch. Please verify field names match exactly: ${fieldNames.join(', ')}. Unknown field: ${unknownField}`
      );
    }
    
    // Check for specific Airtable error messages
    if (error?.error?.type === 'UNKNOWN_FIELD_NAME') {
      const unknownField = error?.error?.message || 'unknown';
      throw new Error(
        `Airtable field "${unknownField}" not found in table "${GAP_RUNS_TABLE}". Please check field names match exactly.`
      );
    }
    
    throw new Error(
      `Failed to create GapRun: ${error?.message || 'Unknown error'}. Status: ${error?.statusCode || 'N/A'}. Error: ${JSON.stringify(error?.error || {})}`
    );
  }
}

/**
 * Update a GapRun record in Airtable
 */
export async function updateGapRun(id: string, patch: Partial<GapRun>): Promise<void> {
  const base = getBase();
  const now = new Date();

  // Find the record by ID (GAP-Plan Run schema)
  let records = await base(GAP_RUNS_TABLE)
    .select({
      filterByFormula: `{Company ID} = "${id}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    throw new Error(`GapRun not found: ${id}`);
  }

  const record = records[0];
  const updateFields: Record<string, any> = {
    // Don't set Updated At - Airtable manages this automatically
  };

  if (patch.status !== undefined) {
    updateFields['Status'] = patch.status;
  }
  if (patch.progress !== undefined) {
    updateFields['Progress'] = patch.progress;
  }
  if (patch.stage !== undefined) {
    updateFields['Stage'] = patch.stage;
  }
  if (patch.currentFinding !== undefined) {
    updateFields['Current Finding'] = patch.currentFinding;
  }
  if (patch.error !== undefined) {
    updateFields['Error'] = patch.error;
  }
  if (patch.result !== undefined) {
    // Store result as JSON string in Airtable
    updateFields['Result'] = JSON.stringify(patch.result);
    
    // Extract scores and counts from result if it's a plan
    if (typeof patch.result === 'object' && patch.result !== null) {
      const plan = patch.result as any;
      if (plan.scorecard) {
        updateFields['Overall Score'] = plan.scorecard.overall ?? null;
        updateFields['Brand Score'] = plan.scorecard.brand ?? null;
        updateFields['Website Score'] = plan.scorecard.website ?? null;
        updateFields['Content Score'] = plan.scorecard.content ?? null;
        updateFields['SEO Score'] = plan.scorecard.seo ?? null;
      }
      if (plan.executiveSummary?.maturityStage) {
        updateFields['Maturity Stage'] = plan.executiveSummary.maturityStage;
      }
      if (plan.companyName) {
        updateFields['Company Name'] = plan.companyName;
      }
      if (Array.isArray(plan.quickWins)) {
        updateFields['Quick Wins Count'] = plan.quickWins.length;
      }
      if (Array.isArray(plan.strategicInitiatives)) {
        updateFields['Initiatives Count'] = plan.strategicInitiatives.length;
      }
    }
  }

  try {
    await base(GAP_RUNS_TABLE).update([
      {
        id: record.id,
        fields: updateFields,
      },
    ]);
  } catch (error: any) {
    console.error('[updateGapRun] Error updating GapRun:', error);
    
    // Check if error is due to missing optional fields - retry without them
    if (error?.error?.type === 'UNKNOWN_FIELD_NAME') {
      const unknownField = error?.error?.message || 'unknown';
      
      // Handle optional fields
      if (unknownField.includes('Current Finding') && updateFields['Current Finding'] !== undefined) {
        console.warn('[updateGapRun] Current Finding field not found - retrying without it');
        const { 'Current Finding': _, ...fieldsWithoutCurrentFinding } = updateFields;
        try {
          await base(GAP_RUNS_TABLE).update([
            {
              id: record.id,
              fields: fieldsWithoutCurrentFinding,
            },
          ]);
          return; // Success on retry
        } catch (retryError) {
          console.error('[updateGapRun] Retry without Current Finding also failed:', retryError);
          // Fall through to check for other field issues
        }
      }
      
      // Handle "Results" vs "Result" field name mismatch
      if (unknownField.includes('Results') && updateFields['Result'] !== undefined) {
        console.warn('[updateGapRun] Field name mismatch detected - checking if "Result" field exists');
        // The field should be "Result" (singular), which we're already using
        // This shouldn't happen, but if it does, log and continue
        console.warn('[updateGapRun] Unexpected field name error - continuing');
        return; // Don't throw - this might be a transient issue
      }
      
      // If it's a required field, throw error
      const optionalFields = ['Current Finding', 'Results'];
      const isOptional = optionalFields.some(field => unknownField.includes(field));
      
      if (!isOptional) {
        const fieldNames = ['Run ID', 'Website URL', 'Status', 'Progress', 'Stage', 'Error', 'Result', 'Created At', 'Updated At'];
        throw new Error(
          `Airtable field name mismatch. Please verify field names match exactly: ${fieldNames.join(', ')}. Unknown field: ${unknownField}`
        );
      }
      
      // If it's an optional field, just log and return
      console.warn(`[updateGapRun] Optional field "${unknownField}" not found - continuing without it`);
      return; // Don't throw - optional fields can be missing
    }
    
    // For other errors, throw
    throw new Error(
      `Failed to update GapRun: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a GapRun by ID
 */
export async function getGapRun(id: string): Promise<GapRun | null> {
  const base = getBase();

  try {
    // Try Company ID first (GAP-Plan Run schema)
    let records = await base(GAP_RUNS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    // Parse result JSON if present
    let result: unknown = null;
    if (fields['Result']) {
      try {
        result = typeof fields['Result'] === 'string'
          ? JSON.parse(fields['Result'])
          : fields['Result'];
      } catch (e) {
        console.warn('[getGapRun] Failed to parse Result JSON:', e);
      }
    }

    // Parse timestamps
    // If Created At/Updated At fields exist in the table, use them
    // Otherwise, use current time as fallback (Airtable's createdTime isn't easily accessible via SDK)
    const createdAt = fields['Created At']
      ? new Date(fields['Created At'] as string)
      : new Date(); // Fallback to current time if field doesn't exist
    const updatedAt = fields['Updated At']
      ? new Date(fields['Updated At'] as string)
      : createdAt; // If no Updated At field, use createdAt

    return {
      id: fields['Company ID'] as string, // Use Company ID field from GAP-Plan Run schema
      websiteUrl: fields['URL'] as string,
      createdAt,
      updatedAt,
      status: (fields['Status'] as string || 'queued') as GapRunStatus,
      progress: (fields['Progress'] as number) || 0,
      stage: (fields['Stage'] as string) || null,
      currentFinding: null, // Current Finding field may not exist in GAP-Plan Run
      error: null, // Error field may not exist in GAP-Plan Run
      result: null, // Result field may not exist in GAP-Plan Run (Data JSON is used instead)

      // Benchmarking fields
      overallScore: (fields['Overall Score'] as number) ?? null,
      websiteScore: (fields['Website Score'] as number) ?? null,
      brandScore: (fields['Brand Score'] as number) ?? null,
      contentScore: (fields['Content Score'] as number) ?? null,
      seoScore: (fields['SEO Score'] as number) ?? null,
      authorityScore: (fields['Authority Score'] as number) ?? null,
      maturityStage: (fields['Maturity Stage'] as string) ?? null,
      category: (fields['Category'] as string) ?? null,

      // Benchmark cohort fields
      benchmarkCohort: (fields['Benchmark Cohort'] as string) ?? null,
      companyType: (fields['Company Type'] as string) ?? null,
      tier: (fields['Tier'] as string) ?? null,
    };
  } catch (error) {
    console.error('[getGapRun] Error fetching GapRun:', error);
    throw new Error(
      `Failed to get GapRun: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Step-based GAP Run State (GapRunState) support
// ============================================================================

/**
 * Generate a unique plan ID
 */
function generatePlanId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `plan-${timestamp}-${random}`;
}

/**
 * Create a new GapRunState and persist it
 */
export async function createGapRunState(params: {
  websiteUrl: string;
  companyName?: string;
  competitors?: string[];
  runType?: string;
  companyId?: string;
  snapshotId?: string;
}): Promise<GapRunState> {
  const runId = generateRunId();
  const planId = generatePlanId();
  const now = new Date().toISOString();

  const state: GapRunState = {
    runId,
    planId,
    url: params.websiteUrl,
    status: 'pending',
    step: 'init',
    currentStep: null,
    completedSteps: [],
    companyName: params.companyName,
    competitors: params.competitors || [],
    createdAt: now,
    updatedAt: now,
  };

  // Save to Airtable using Gap Runs table schema
  // Note: Airtable Status field only supports: "queued", "running", "completed", "failed"
  // We use "queued" instead of "pending" for Airtable compatibility
  const base = getBase();
  const fields: Record<string, unknown> = {
    'Plan ID': planId,
    'URL': params.websiteUrl,
    'Status': 'queued', // Map "pending" to "queued" for Airtable compatibility
    'Progress': 0,
    'Stage': null,
    'Error': null,
    'Result': JSON.stringify({
      planId,
      stepData: {
        currentStep: null,
        completedSteps: [],
        websiteAssessmentId: undefined,
        contentAssessmentId: undefined,
        seoAssessmentId: undefined,
        brandAssessmentId: undefined,
      },
    }),
    'Current Finding': null,
    'Company Name': params.companyName || null,
    'Overall Score': null,
    'Brand Score': null,
    'Website Score': null,
    'Content Score': null,
    'SEO Score': null,
    'Maturity Stage': null,
    'Quick Wins Count': 0,
    'Initiatives Count': 0,
  };

  // Add Snapshot ID if provided
  if (params.snapshotId) {
    fields['Snapshot ID'] = params.snapshotId;
  }

  // Add Run Type if provided (for OS vs GAP differentiation)
  if (params.runType) {
    fields['Run Type'] = params.runType;
  }

  // Add Company if provided (for linking to Companies table)
  if (params.companyId) {
    fields['Company'] = [params.companyId]; // Array for linked record
  }
  
  try {
    await base(GAP_RUNS_TABLE).create([{ fields: fields as any }]);
  } catch (error: any) {
    console.error('[createGapRunState] Error creating run:', error);
    throw new Error(`Failed to create GapRunState: ${error?.message || 'Unknown error'}`);
  }
  
  return state;
}

/**
 * Get GapRunState by runId
 */
export async function getGapRunState(runId: string): Promise<GapRunState | null> {
  const run = await getGapRun(runId);
  if (!run) {
    return null;
  }
  
  // Parse step data from Result field
  let stepData: any = {};
  let planId = `plan-${run.id}`;
  let plan: any = null;
  
  if (run.result && typeof run.result === 'object') {
    planId = (run.result as any).planId || planId;
    stepData = (run.result as any).stepData || {};
    plan = (run.result as any).plan || null;
  } else if (run.result && typeof run.result === 'string') {
    try {
      const parsed = JSON.parse(run.result);
      planId = parsed.planId || planId;
      stepData = parsed.stepData || {};
      plan = parsed.plan || null;
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  const state: GapRunState & { plan?: any; result?: any } = {
    runId: run.id,
    planId,
    url: run.websiteUrl,
    websiteUrl: run.websiteUrl,
    competitors: stepData.competitors || [],
    status: run.status === 'queued' ? 'pending' : run.status,
    step: stepData.step || stepData.currentStep || 'init',
    currentStep: stepData.currentStep || null,
    completedSteps: stepData.completedSteps || [],
    crawlResultId: stepData.crawlResultId,
    websiteAssessmentId: stepData.websiteAssessmentId,
    contentAssessmentId: stepData.contentAssessmentId,
    seoAssessmentId: stepData.seoAssessmentId,
    brandAssessmentId: stepData.brandAssessmentId,
    error: run.error,
    currentFinding: run.currentFinding || undefined,
    companyName: undefined, // GapRun doesn't have companyName field
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
  
  // Attach plan if available
  if (plan) {
    state.plan = plan;
    state.result = plan;
  }
  
  return state;
}

/**
 * Save GapRunState to Airtable
 */
export async function saveGapRunState(state: GapRunState): Promise<void> {
  const base = getBase();
  
  // Find the record by Plan ID (preferred) or Run ID (backward compatibility)
  let records = await base(GAP_RUNS_TABLE)
    .select({
      filterByFormula: `{Plan ID} = "${state.planId}"`,
      maxRecords: 1,
    })
    .firstPage();
  
  // Fallback to Run ID if Plan ID not found
  if (records.length === 0) {
    records = await base(GAP_RUNS_TABLE)
      .select({
        filterByFormula: `{Run ID} = "${state.runId}"`,
        maxRecords: 1,
      })
      .firstPage();
  }
  
  if (records.length === 0) {
    throw new Error(`GapRunState not found: ${state.runId}`);
  }
  
  const record = records[0];
  
  // Calculate progress based on completed steps
  const totalSteps = 8; // init, crawl, signals, websiteAssessment, contentAssessment, seoAssessment, brandAssessment, assemblePlan
  const progress = Math.round((state.completedSteps.length / totalSteps) * 100);
  
  // Map status to Airtable-compatible values
  // Airtable Status field only supports: "queued", "running", "completed", "failed"
  // Map "pending" -> "queued" since they're equivalent
  let airtableStatus: 'queued' | 'running' | 'completed' | 'failed';
  if (state.status === 'pending') {
    airtableStatus = 'queued';
  } else if (state.status === 'running' || state.status === 'completed' || state.status === 'failed') {
    airtableStatus = state.status;
  } else {
    // Fallback to queued for any unknown status
    console.warn(`[saveGapRunState] Unknown status "${state.status}", mapping to "queued"`);
    airtableStatus = 'queued';
  }
  
  // Store step data in Result field as JSON
  const stepData = {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    crawlResultId: state.crawlResultId,
    websiteAssessmentId: state.websiteAssessmentId,
    contentAssessmentId: state.contentAssessmentId,
    seoAssessmentId: state.seoAssessmentId,
    brandAssessmentId: state.brandAssessmentId,
  };
  
  // If plan is completed, include the plan in the result
  const plan = (state as any).plan || (state as any).result;
  const resultData: any = {
    planId: state.planId,
    stepData,
  };
  
  if (state.status === 'completed' && plan) {
    resultData.plan = plan;
  }
  
  // Extract data from plan for individual fields
  const scorecard = state.scorecard || plan?.scorecard;
  const executiveSummary = state.executiveSummary || plan?.executiveSummary;
  const quickWins = state.quickWins || plan?.quickWins || [];
  const strategicInitiatives = state.strategicInitiatives || plan?.strategicInitiatives || [];
  const snapshotId = state.options?.snapshotId || plan?.assessmentSnapshotId;
  
  // Build update fields according to Airtable schema
  const updateFields: Record<string, any> = {
    'Plan ID': state.planId || state.gapId || null,
    'URL': state.url || state.websiteUrl || null,
    'Status': airtableStatus,
    'Progress': progress,
    'Stage': state.currentStep || state.step || null,
    'Error': state.error || null,
    'Result': JSON.stringify(resultData),
    'Current Finding': state.currentFinding || null,
    'Company Name': state.companyName || plan?.companyName || null,
  };
  
  // Add Snapshot ID if available
  if (snapshotId) {
    updateFields['Snapshot ID'] = snapshotId;
  }
  
  // Add scores from scorecard
  if (scorecard) {
    updateFields['Overall Score'] = scorecard.overall ?? null;
    updateFields['Brand Score'] = scorecard.brand ?? null;
    updateFields['Website Score'] = scorecard.website ?? null;
    updateFields['Content Score'] = scorecard.content ?? null;
    updateFields['SEO Score'] = scorecard.seo ?? null;
  }
  
  // Add maturity stage from executive summary
  if (executiveSummary?.maturityStage) {
    updateFields['Maturity Stage'] = executiveSummary.maturityStage;
  }
  
  // Add counts
  updateFields['Quick Wins Count'] = Array.isArray(quickWins) ? quickWins.length : 0;
  updateFields['Initiatives Count'] = Array.isArray(strategicInitiatives) ? strategicInitiatives.length : 0;
  
  // Full Reports - link to full report records if available
  // This would need to be populated separately if you have full report IDs
  // For now, leave it null or empty
  if (state.websiteAssessmentId || state.contentAssessmentId || state.seoAssessmentId || state.brandAssessmentId) {
    const fullReportIds: string[] = [];
    if (state.websiteAssessmentId) fullReportIds.push(state.websiteAssessmentId);
    if (state.contentAssessmentId) fullReportIds.push(state.contentAssessmentId);
    if (state.seoAssessmentId) fullReportIds.push(state.seoAssessmentId);
    if (state.brandAssessmentId) fullReportIds.push(state.brandAssessmentId);
    if (fullReportIds.length > 0) {
      updateFields['Full Reports'] = fullReportIds; // Array for linked records
    }
  }
  
  try {
    await base(GAP_RUNS_TABLE).update([
      {
        id: record.id,
        fields: updateFields,
      },
    ]);
  } catch (error: any) {
    console.error('[saveGapRunState] Error updating run:', error);
    throw new Error(`Failed to save GapRunState: ${error?.message || 'Unknown error'}`);
  }
}

