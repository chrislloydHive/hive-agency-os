import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

export type CompanyRef =
  | { type: 'text'; fieldName: string }
  | { type: 'linked'; fieldName: string };

export interface ResetTableConfig {
  tableKey: keyof typeof AIRTABLE_TABLES;
  category: 'traces_logs' | 'lab_runs' | 'lab_outputs' | 'proposals_candidates' | 'context_review' | 'context_graph' | 'generated_artifacts';
  companyRef: CompanyRef;
  /** Ordered list of reference fields to try. First successful match wins. */
  candidateRefs?: CompanyRef[];
  softFields?: {
    isArchivedField?: string;
    resetBatchIdField?: string;
    resetAtField?: string;
    resetKindField?: string;
  };
  allowHardDelete?: boolean;
}

export const RESET_DELETE_ORDER: ResetTableConfig['category'][] = [
  'traces_logs',
  'lab_outputs',
  'lab_runs',
  'proposals_candidates',
  'context_review',
  'context_graph',
  'generated_artifacts',
];

// ============================================================================
// Reset Table Configurations
// ============================================================================

export const RESET_TABLES: ResetTableConfig[] = [
  // -------------------------------------------------------------------------
  // Lab Runs - Diagnostic executions
  // -------------------------------------------------------------------------
  {
    tableKey: 'DIAGNOSTIC_RUNS',
    category: 'lab_runs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'linked', fieldName: 'Company copy' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'linked', fieldName: 'Company (from Run URL)' },
      { type: 'text', fieldName: 'Company ID' },
    ],
    softFields: {
      isArchivedField: 'isArchived',
      resetBatchIdField: 'resetBatchId',
      resetAtField: 'resetAt',
      resetKindField: 'resetKind',
    },
  },
  {
    tableKey: 'GAP_IA_RUN',
    category: 'lab_runs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
  {
    tableKey: 'GAP_PLAN_RUN',
    category: 'lab_runs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
  {
    tableKey: 'GAP_HEAVY_RUN',
    category: 'lab_runs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },

  // -------------------------------------------------------------------------
  // Lab Outputs - Results from lab runs
  // -------------------------------------------------------------------------
  {
    tableKey: 'GAP_FULL_REPORT',
    category: 'lab_outputs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
  {
    tableKey: 'COMPETITION_RUNS',
    category: 'lab_outputs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
  {
    tableKey: 'AUDIENCE_MODELS',
    category: 'lab_outputs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
  {
    tableKey: 'AUDIENCE_PERSONAS',
    category: 'lab_outputs',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },

  // -------------------------------------------------------------------------
  // Proposals & Candidates - AI-generated proposals awaiting review
  // -------------------------------------------------------------------------
  {
    tableKey: 'CONTEXT_PROPOSALS',
    category: 'proposals_candidates',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
    softFields: {
      isArchivedField: 'isArchived',
      resetBatchIdField: 'resetBatchId',
      resetAtField: 'resetAt',
      resetKindField: 'resetKind',
    },
  },

  // -------------------------------------------------------------------------
  // Context Graph - Company context data
  // -------------------------------------------------------------------------
  {
    tableKey: 'CONTEXT_FIELDS_V4',
    category: 'context_graph',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
    softFields: {
      isArchivedField: 'isDeleted',
      resetBatchIdField: 'resetBatchId',
      resetAtField: 'resetAt',
      resetKindField: 'resetKind',
    },
  },
  {
    tableKey: 'CONTEXT_GRAPHS',
    category: 'context_graph',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
  {
    tableKey: 'CONTEXT_GRAPH_VERSIONS',
    category: 'context_graph',
    companyRef: { type: 'linked', fieldName: 'Company' },
    candidateRefs: [
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'companyId' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },

  // -------------------------------------------------------------------------
  // Generated Artifacts - Documents, reports, etc.
  // -------------------------------------------------------------------------
  {
    tableKey: 'ARTIFACTS',
    category: 'generated_artifacts',
    companyRef: { type: 'linked', fieldName: 'companyId' },
    candidateRefs: [
      { type: 'linked', fieldName: 'companyId' }, // Now a linked record field
      { type: 'text', fieldName: 'companyId' },
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'Company ID' },
    ],
    softFields: {
      isArchivedField: 'isArchived',
      resetBatchIdField: 'resetBatchId',
      resetAtField: 'resetAt',
      resetKindField: 'resetKind',
    },
  },
  {
    tableKey: 'ARTIFACT_INDEX',
    category: 'generated_artifacts',
    companyRef: { type: 'text', fieldName: 'companyId' },
    candidateRefs: [
      { type: 'text', fieldName: 'companyId' },
      { type: 'linked', fieldName: 'Company' },
      { type: 'text', fieldName: 'Company ID' },
    ],
  },
];

// Safety guard: companies table must never appear here
export const RESET_DENYLIST = new Set<string>(['COMPANIES']);
