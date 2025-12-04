// lib/contextGraph/setupLoader.ts
// Setup Loader - Reads Context Graph data for Setup Wizard
//
// This module loads Context Graph data and transforms it into
// the format expected by Setup form components.

import { loadContextGraph } from './storage';
import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import type { SetupFormData, SetupStepId } from '@/app/c/[companyId]/setup/types';
import {
  ALL_SETUP_BINDINGS,
  BINDINGS_BY_STEP,
  type SetupFieldBinding,
  type ContextNodeInfo,
  getSourceDisplayName,
  isHumanSource,
} from './setupSchema';
import type { ProvenanceTag, WithMetaType, WithMetaArrayType } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of loading Setup data from Context Graph
 */
export interface SetupLoaderResult {
  /** Form data populated from Context Graph */
  formData: Partial<SetupFormData>;
  /** Provenance info for each field (contextPath → info) */
  provenanceMap: Map<string, ContextNodeInfo>;
  /** Fields that are missing/empty in Context Graph */
  missingFields: string[];
  /** Whether the graph was found */
  hasGraph: boolean;
  /** Company name from graph */
  companyName: string | null;
}

/**
 * Field value with provenance for display
 */
export interface FieldWithProvenance {
  value: unknown;
  provenance: ContextNodeInfo | null;
  binding: SetupFieldBinding;
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load Setup form data from Context Graph
 *
 * This is the main entry point for populating Setup forms.
 * It reads all relevant fields from the Context Graph and
 * transforms them into SetupFormData format.
 */
export async function loadSetupFromContextGraph(
  companyId: string
): Promise<SetupLoaderResult> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return {
      formData: {},
      provenanceMap: new Map(),
      missingFields: ALL_SETUP_BINDINGS.map(b => b.contextPath),
      hasGraph: false,
      companyName: null,
    };
  }

  return extractSetupData(graph);
}

/**
 * Extract Setup data from a loaded Context Graph
 */
export function extractSetupData(graph: CompanyContextGraph): SetupLoaderResult {
  const formData: Partial<SetupFormData> = {};
  const provenanceMap = new Map<string, ContextNodeInfo>();
  const missingFields: string[] = [];

  // Initialize all step objects
  formData.businessIdentity = {
    businessName: '',
    industry: '',
    businessModel: '',
    revenueModel: '',
    geographicFootprint: '',
    serviceArea: '',
    seasonalityNotes: '',
    peakSeasons: [],
    revenueStreams: [],
    primaryCompetitors: [],
  };

  formData.objectives = {
    primaryObjective: '',
    secondaryObjectives: [],
    primaryBusinessGoal: '',
    timeHorizon: '',
    targetCpa: null,
    targetRoas: null,
    revenueGoal: null,
    leadGoal: null,
    kpiLabels: [],
  };

  formData.audience = {
    coreSegments: [],
    demographics: '',
    geos: '',
    primaryMarkets: [],
    behavioralDrivers: [],
    demandStates: [],
    painPoints: [],
    motivations: [],
  };

  formData.personas = {
    personaSetId: null,
    personaCount: 0,
  };

  formData.website = {
    websiteSummary: '',
    conversionBlocks: [],
    conversionOpportunities: [],
    criticalIssues: [],
    quickWins: [],
  };

  formData.mediaFoundations = {
    mediaSummary: '',
    activeChannels: [],
    attributionModel: '',
    mediaIssues: [],
    mediaOpportunities: [],
  };

  formData.budgetScenarios = {
    totalMarketingBudget: null,
    mediaSpendBudget: null,
    budgetPeriod: '',
    avgCustomerValue: null,
    customerLTV: null,
    selectedScenarioId: null,
  };

  formData.creativeStrategy = {
    coreMessages: [],
    proofPoints: [],
    callToActions: [],
    availableFormats: [],
    brandGuidelines: '',
  };

  formData.measurement = {
    ga4PropertyId: '',
    ga4ConversionEvents: [],
    callTracking: '',
    trackingTools: [],
    attributionModel: '',
    attributionWindow: '',
  };

  formData.summary = {
    strategySummary: '',
    keyRecommendations: [],
    nextSteps: [],
  };

  // Extract values for each binding
  for (const binding of ALL_SETUP_BINDINGS) {
    const { value, provenance } = getFieldValue(graph, binding);

    // Track provenance
    if (provenance) {
      provenanceMap.set(binding.contextPath, provenance);
    }

    // Check if missing
    if (isEmpty(value, binding.type)) {
      missingFields.push(binding.contextPath);
    }

    // Set value in form data
    setFormValue(formData, binding, value);
  }

  // Handle persona count specially
  const personaNames = graph.audience.personaNames.value || [];
  if (formData.personas) {
    formData.personas.personaCount = personaNames.length;
  }

  return {
    formData,
    provenanceMap,
    missingFields,
    hasGraph: true,
    companyName: graph.companyName,
  };
}

// ============================================================================
// Field Value Extraction
// ============================================================================

/**
 * Get a field value and its provenance from the graph
 */
function getFieldValue(
  graph: CompanyContextGraph,
  binding: SetupFieldBinding
): { value: unknown; provenance: ContextNodeInfo | null } {
  const domainData = graph[binding.domain as DomainName];
  if (!domainData) {
    return { value: null, provenance: null };
  }

  const fieldData = (domainData as Record<string, unknown>)[binding.field];
  if (!fieldData || typeof fieldData !== 'object') {
    return { value: null, provenance: null };
  }

  const typed = fieldData as WithMetaType<unknown> | WithMetaArrayType<unknown>;
  const value = typed.value;
  const latestProvenance = typed.provenance?.[0] as ProvenanceTag | undefined;

  const provenance: ContextNodeInfo | null = latestProvenance
    ? {
        value,
        source: latestProvenance.source,
        sourceName: getSourceDisplayName(latestProvenance.source),
        confidence: latestProvenance.confidence,
        updatedAt: latestProvenance.updatedAt,
        isHumanOverride: isHumanSource(latestProvenance.source),
      }
    : null;

  return { value, provenance };
}

/**
 * Check if a value is empty based on its type
 */
function isEmpty(value: unknown, type: string): boolean {
  if (value === null || value === undefined) return true;
  if (type === 'string' && value === '') return true;
  if (type === 'string[]' && Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Set a value in the form data object
 */
function setFormValue(
  formData: Partial<SetupFormData>,
  binding: SetupFieldBinding,
  value: unknown
): void {
  const stepKey = getStepFormKey(binding.setupStepId);
  if (!stepKey || !formData[stepKey]) return;

  const stepData = formData[stepKey] as Record<string, unknown>;

  // Convert value based on type
  switch (binding.type) {
    case 'string':
      stepData[binding.setupFieldId] = value ?? '';
      break;
    case 'string[]':
      stepData[binding.setupFieldId] = Array.isArray(value) ? value : [];
      break;
    case 'number':
      stepData[binding.setupFieldId] = typeof value === 'number' ? value : null;
      break;
    case 'boolean':
      stepData[binding.setupFieldId] = typeof value === 'boolean' ? value : false;
      break;
  }
}

/**
 * Map step ID to form data key
 */
function getStepFormKey(stepId: SetupStepId): keyof SetupFormData | null {
  const mapping: Record<SetupStepId, keyof SetupFormData> = {
    'business-identity': 'businessIdentity',
    'objectives': 'objectives',
    'audience': 'audience',
    'personas': 'personas',
    'website': 'website',
    'media-foundations': 'mediaFoundations',
    'budget-scenarios': 'budgetScenarios',
    'creative-strategy': 'creativeStrategy',
    'measurement': 'measurement',
    'summary': 'summary',
  };
  return mapping[stepId] || null;
}

// ============================================================================
// Step-specific Loaders
// ============================================================================

/**
 * Load fields for a specific step with provenance
 */
export function loadStepFields(
  graph: CompanyContextGraph,
  stepId: SetupStepId
): FieldWithProvenance[] {
  const bindings = BINDINGS_BY_STEP[stepId] || [];
  const fields: FieldWithProvenance[] = [];

  for (const binding of bindings) {
    const { value, provenance } = getFieldValue(graph, binding);
    fields.push({
      value,
      provenance,
      binding,
    });
  }

  return fields;
}

/**
 * Get a single field with provenance
 */
export function loadFieldWithProvenance(
  graph: CompanyContextGraph,
  contextPath: string
): FieldWithProvenance | null {
  const binding = ALL_SETUP_BINDINGS.find(b => b.contextPath === contextPath);
  if (!binding) return null;

  const { value, provenance } = getFieldValue(graph, binding);
  return { value, provenance, binding };
}

// ============================================================================
// Provenance Helpers
// ============================================================================

/**
 * Get provenance info for a specific field
 */
export function getFieldProvenance(
  graph: CompanyContextGraph,
  contextPath: string
): ContextNodeInfo | null {
  const [domain, field] = contextPath.split('.');
  if (!domain || !field) return null;

  const domainData = graph[domain as DomainName];
  if (!domainData) return null;

  const fieldData = (domainData as Record<string, unknown>)[field];
  if (!fieldData || typeof fieldData !== 'object') return null;

  const typed = fieldData as WithMetaType<unknown>;
  const latestProvenance = typed.provenance?.[0];

  if (!latestProvenance) return null;

  return {
    value: typed.value,
    source: latestProvenance.source,
    sourceName: getSourceDisplayName(latestProvenance.source),
    confidence: latestProvenance.confidence,
    updatedAt: latestProvenance.updatedAt,
    isHumanOverride: isHumanSource(latestProvenance.source),
  };
}

/**
 * Check if a field has been human-edited
 */
export function isFieldHumanEdited(
  graph: CompanyContextGraph,
  contextPath: string
): boolean {
  const provenance = getFieldProvenance(graph, contextPath);
  return provenance?.isHumanOverride ?? false;
}

/**
 * Get formatted provenance display text
 */
export function getProvenanceDisplayText(info: ContextNodeInfo): string {
  if (!info.sourceName) return '';

  const parts = [info.sourceName];

  if (info.updatedAt) {
    const date = new Date(info.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      parts.push('today');
    } else if (diffDays === 1) {
      parts.push('yesterday');
    } else if (diffDays < 7) {
      parts.push(`${diffDays} days ago`);
    } else {
      parts.push(date.toLocaleDateString());
    }
  }

  return parts.join(' · ');
}
