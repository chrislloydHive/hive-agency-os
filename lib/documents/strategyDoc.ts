// lib/documents/strategyDoc.ts
// Strategy Document System - Google Drive Integration
//
// Creates and manages Strategy Documents from Context V4 confirmed fields.
// Documents are created once and updated incrementally - never regenerated.
//
// Key Design Principles:
// - Hive OS is the workspace and brain
// - Google Docs is storage and final artifact
// - Documents created from Context V4 snapshots
// - Incremental updates only - never overwrite existing content

import { getBase } from '@/lib/airtable';
import { getConfirmedFieldsV4, loadContextFieldsV4WithError } from '@/lib/contextGraph/fieldStoreV4';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import type { DocumentContent, DocumentSection } from '@/lib/integrations/googleDrive';
import type { ContextFieldV4 } from '@/lib/types/contextField';
import { getCompanyById } from '@/lib/airtable/companies';

// ============================================================================
// Types
// ============================================================================

export interface StrategyDocFields {
  /** Google Doc file ID */
  strategyDocId: string | null;
  /** Direct URL to the Google Doc */
  strategyDocUrl: string | null;
  /** Context V4 snapshot ID used to create/last update the doc */
  strategyDocSnapshotId: string | null;
  /** Last time the doc was synced with Context V4 */
  strategyDocLastSyncedAt: string | null;
  /** Count of context changes since last sync */
  strategyDocStalenessCount: number;
  /** Google Drive folder ID for company artifacts */
  driveFolderId: string | null;
}

export interface ContextSnapshot {
  id: string;
  createdAt: string;
  fields: Record<string, ContextFieldV4>;
  confirmedCount: number;
}

export interface CreateStrategyDocResult {
  success: boolean;
  docId?: string;
  docUrl?: string;
  snapshotId?: string;
  error?: string;
}

export interface UpdateStrategyDocResult {
  success: boolean;
  updatesApplied: number;
  newSnapshotId?: string;
  error?: string;
}

export interface StrategyDocState {
  exists: boolean;
  isStale: boolean;
  stalenessCount: number;
  docUrl: string | null;
  lastSyncedAt: string | null;
}

// ============================================================================
// Airtable Field Mapping
// ============================================================================

const COMPANIES_TABLE = process.env.AIRTABLE_COMPANIES_TABLE || 'Companies';

/**
 * Get Strategy Doc fields for a company
 */
export async function getStrategyDocFields(companyId: string): Promise<StrategyDocFields | null> {
  try {
    const base = getBase();
    const record = await base(COMPANIES_TABLE).find(companyId);

    if (!record) return null;

    const fields = record.fields;
    return {
      strategyDocId: (fields['Strategy Doc ID'] as string) || null,
      strategyDocUrl: (fields['Strategy Doc URL'] as string) || null,
      strategyDocSnapshotId: (fields['Strategy Doc Snapshot ID'] as string) || null,
      strategyDocLastSyncedAt: (fields['Strategy Doc Last Synced At'] as string) || null,
      strategyDocStalenessCount: (fields['Strategy Doc Staleness Count'] as number) || 0,
      driveFolderId: (fields['Drive Folder ID'] as string) || null,
    };
  } catch (error) {
    console.error(`[StrategyDoc] Failed to get fields for company ${companyId}:`, error);
    return null;
  }
}

/**
 * Update Strategy Doc fields for a company
 */
export async function updateStrategyDocFields(
  companyId: string,
  updates: Partial<StrategyDocFields>
): Promise<boolean> {
  try {
    const base = getBase();

    const airtableFields: Record<string, unknown> = {};

    if (updates.strategyDocId !== undefined) {
      airtableFields['Strategy Doc ID'] = updates.strategyDocId;
    }
    if (updates.strategyDocUrl !== undefined) {
      airtableFields['Strategy Doc URL'] = updates.strategyDocUrl;
    }
    if (updates.strategyDocSnapshotId !== undefined) {
      airtableFields['Strategy Doc Snapshot ID'] = updates.strategyDocSnapshotId;
    }
    if (updates.strategyDocLastSyncedAt !== undefined) {
      airtableFields['Strategy Doc Last Synced At'] = updates.strategyDocLastSyncedAt;
    }
    if (updates.strategyDocStalenessCount !== undefined) {
      airtableFields['Strategy Doc Staleness Count'] = updates.strategyDocStalenessCount;
    }
    if (updates.driveFolderId !== undefined) {
      airtableFields['Drive Folder ID'] = updates.driveFolderId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base(COMPANIES_TABLE).update(companyId, airtableFields as any);
    return true;
  } catch (error) {
    console.error(`[StrategyDoc] Failed to update fields for company ${companyId}:`, error);
    return false;
  }
}

// ============================================================================
// Snapshot Generation
// ============================================================================

/**
 * Generate a context snapshot ID from current confirmed fields
 */
export function generateSnapshotId(fields: ContextFieldV4[]): string {
  // Create a deterministic hash from field keys and values
  const content = fields
    .map(f => `${f.key}:${JSON.stringify(f.value)}`)
    .sort()
    .join('|');

  // Simple hash for snapshot comparison
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const timestamp = Date.now().toString(36);
  return `snap_${Math.abs(hash).toString(36)}_${timestamp}`;
}

/**
 * Create a context snapshot from confirmed V4 fields
 */
export async function createContextSnapshot(companyId: string): Promise<ContextSnapshot | null> {
  const fields = await getConfirmedFieldsV4(companyId);

  if (fields.length === 0) {
    return null;
  }

  const fieldsMap: Record<string, ContextFieldV4> = {};
  for (const field of fields) {
    fieldsMap[field.key] = field;
  }

  return {
    id: generateSnapshotId(fields),
    createdAt: new Date().toISOString(),
    fields: fieldsMap,
    confirmedCount: fields.length,
  };
}

// ============================================================================
// Document Content Building
// ============================================================================

/**
 * Build Strategy Document content from Context V4 fields
 */
export function buildStrategyDocContent(
  companyName: string,
  fields: Record<string, ContextFieldV4>
): DocumentContent {
  const sections: DocumentSection[] = [];

  // Title
  sections.push({
    heading: `${companyName} - Strategy Document`,
    headingLevel: 1,
    body: `Generated from Hive OS Context V4\nLast updated: ${new Date().toISOString().split('T')[0]}`,
  });

  // Executive Summary
  const executiveSummary = buildExecutiveSummary(fields);
  if (executiveSummary) {
    sections.push({
      heading: 'Executive Summary',
      headingLevel: 2,
      body: executiveSummary,
    });
  }

  // ICP (Ideal Customer Profile)
  const icpSection = buildICPSection(fields);
  if (icpSection) {
    sections.push({
      heading: 'Ideal Customer Profile',
      headingLevel: 2,
      body: icpSection,
    });
  }

  // Value Proposition
  const valueProp = buildValuePropositionSection(fields);
  if (valueProp) {
    sections.push({
      heading: 'Value Proposition',
      headingLevel: 2,
      body: valueProp,
    });
  }

  // Competitive Landscape
  const competitive = buildCompetitiveLandscapeSection(fields);
  if (competitive) {
    sections.push({
      heading: 'Competitive Landscape',
      headingLevel: 2,
      body: competitive,
    });
  }

  // Strategic Priorities
  const priorities = buildStrategicPrioritiesSection(fields);
  if (priorities) {
    sections.push({
      heading: 'Strategic Priorities',
      headingLevel: 2,
      body: priorities,
    });
  }

  return { sections };
}

/**
 * Build Executive Summary from fields
 */
function buildExecutiveSummary(fields: Record<string, ContextFieldV4>): string | null {
  const parts: string[] = [];

  const brandPositioning = getFieldValue(fields, 'brand.positioning');
  if (brandPositioning) {
    parts.push(`Positioning: ${brandPositioning}`);
  }

  const businessModel = getFieldValue(fields, 'company.businessModel');
  if (businessModel) {
    parts.push(`Business Model: ${businessModel}`);
  }

  const industry = getFieldValue(fields, 'company.industry');
  if (industry) {
    parts.push(`Industry: ${industry}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

/**
 * Build ICP section from fields
 */
function buildICPSection(fields: Record<string, ContextFieldV4>): string | null {
  const parts: string[] = [];

  const icpDescription = getFieldValue(fields, 'audience.icpDescription');
  if (icpDescription) {
    parts.push(String(icpDescription));
  }

  const demographics = getFieldValue(fields, 'audience.demographics');
  if (demographics) {
    parts.push(`\nDemographics: ${demographics}`);
  }

  const psychographics = getFieldValue(fields, 'audience.psychographics');
  if (psychographics) {
    parts.push(`\nPsychographics: ${psychographics}`);
  }

  const painPoints = getFieldValue(fields, 'audience.painPoints');
  if (painPoints) {
    parts.push(`\nPain Points: ${Array.isArray(painPoints) ? painPoints.join(', ') : painPoints}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Build Value Proposition section from fields
 */
function buildValuePropositionSection(fields: Record<string, ContextFieldV4>): string | null {
  const parts: string[] = [];

  const valueProposition = getFieldValue(fields, 'productOffer.valueProposition');
  if (valueProposition) {
    parts.push(String(valueProposition));
  }

  const differentiators = getFieldValue(fields, 'productOffer.differentiators');
  if (differentiators) {
    const diffText = Array.isArray(differentiators)
      ? differentiators.map(d => `- ${d}`).join('\n')
      : differentiators;
    parts.push(`\nKey Differentiators:\n${diffText}`);
  }

  const primaryOffer = getFieldValue(fields, 'productOffer.primaryOffer');
  if (primaryOffer) {
    parts.push(`\nPrimary Offer: ${primaryOffer}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Build Competitive Landscape section from fields
 */
function buildCompetitiveLandscapeSection(fields: Record<string, ContextFieldV4>): string | null {
  const parts: string[] = [];

  const competitors = getFieldValue(fields, 'competitive.competitors');
  if (competitors && Array.isArray(competitors) && competitors.length > 0) {
    const competitorList = competitors
      .slice(0, 5)
      .map(c => `- ${typeof c === 'string' ? c : c.name || c.domain || 'Unknown'}`)
      .join('\n');
    parts.push(`Key Competitors:\n${competitorList}`);
  }

  const competitiveAdvantage = getFieldValue(fields, 'competitive.competitiveAdvantage');
  if (competitiveAdvantage) {
    parts.push(`\nCompetitive Advantage: ${competitiveAdvantage}`);
  }

  const marketPosition = getFieldValue(fields, 'competitive.marketPosition');
  if (marketPosition) {
    parts.push(`\nMarket Position: ${marketPosition}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Build Strategic Priorities section from fields
 */
function buildStrategicPrioritiesSection(fields: Record<string, ContextFieldV4>): string | null {
  const parts: string[] = [];

  const priorities = getFieldValue(fields, 'strategy.priorities');
  if (priorities && Array.isArray(priorities)) {
    const priorityList = priorities
      .map((p, i) => `${i + 1}. ${typeof p === 'string' ? p : p.title || 'Untitled'}`)
      .join('\n');
    parts.push(priorityList);
  }

  const objectives = getFieldValue(fields, 'strategy.objectives');
  if (objectives && Array.isArray(objectives)) {
    const objectiveList = objectives
      .map((o, i) => `${i + 1}. ${typeof o === 'string' ? o : o.text || 'Untitled'}`)
      .join('\n');
    parts.push(`\nStrategic Objectives:\n${objectiveList}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Helper to get field value with type safety
 */
function getFieldValue(fields: Record<string, ContextFieldV4>, key: string): unknown {
  const field = fields[key];
  return field?.value ?? null;
}

// ============================================================================
// Update Content Building
// ============================================================================

/**
 * Build update section content from changed fields
 */
export function buildUpdateSection(
  changedFields: ContextFieldV4[],
  date: string
): DocumentSection {
  const parts: string[] = [];

  for (const field of changedFields) {
    const displayKey = field.key.replace(/\./g, ' > ');
    const value = typeof field.value === 'string'
      ? field.value
      : JSON.stringify(field.value, null, 2);

    parts.push(`**${displayKey}**\n${value}`);
  }

  return {
    heading: `Updates — ${date}`,
    headingLevel: 2,
    body: parts.join('\n\n'),
  };
}

/**
 * Compute diff between two snapshots
 */
export function computeSnapshotDiff(
  oldSnapshot: ContextSnapshot | null,
  newSnapshot: ContextSnapshot
): ContextFieldV4[] {
  const changed: ContextFieldV4[] = [];

  for (const [key, newField] of Object.entries(newSnapshot.fields)) {
    const oldField = oldSnapshot?.fields[key];

    // New field
    if (!oldField) {
      changed.push(newField);
      continue;
    }

    // Changed value
    if (JSON.stringify(oldField.value) !== JSON.stringify(newField.value)) {
      changed.push(newField);
    }
  }

  return changed;
}

// ============================================================================
// State Helpers
// ============================================================================

/**
 * Get current Strategy Doc state for a company
 */
export async function getStrategyDocState(companyId: string): Promise<StrategyDocState> {
  const fields = await getStrategyDocFields(companyId);

  return {
    exists: !!fields?.strategyDocId,
    isStale: (fields?.strategyDocStalenessCount ?? 0) > 0,
    stalenessCount: fields?.strategyDocStalenessCount ?? 0,
    docUrl: fields?.strategyDocUrl ?? null,
    lastSyncedAt: fields?.strategyDocLastSyncedAt ?? null,
  };
}

/**
 * Increment staleness count for a company's strategy doc
 * Called when context is confirmed/changed
 */
export async function incrementStrategyDocStaleness(companyId: string): Promise<void> {
  const fields = await getStrategyDocFields(companyId);

  // Only increment if doc exists
  if (fields?.strategyDocId) {
    await updateStrategyDocFields(companyId, {
      strategyDocStalenessCount: (fields.strategyDocStalenessCount || 0) + 1,
    });
  }
}

/**
 * Reset staleness count after sync
 */
export async function resetStrategyDocStaleness(
  companyId: string,
  snapshotId: string
): Promise<void> {
  await updateStrategyDocFields(companyId, {
    strategyDocStalenessCount: 0,
    strategyDocSnapshotId: snapshotId,
    strategyDocLastSyncedAt: new Date().toISOString(),
  });
}
