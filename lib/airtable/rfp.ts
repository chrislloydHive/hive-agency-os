// lib/airtable/rfp.ts
// Airtable CRUD operations for RFP workflow
// Used in Deliver phase for heavy RFP response generation

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  Rfp,
  RfpInput,
  RfpSection,
  RfpSectionInput,
  RfpBindings,
  RfpBindingsInput,
  RfpWithDetails,
  RfpSectionKey,
  RFP_SECTION_ORDER,
  RFP_SECTION_LABELS,
} from '@/lib/types/rfp';

// ============================================================================
// RFP Main Entity
// ============================================================================

export async function getRfpsForCompany(companyId: string): Promise<Rfp[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.RFPS)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      companyId: (record.get('companyId') as string) || '',
      opportunityId: record.get('opportunityId') as string | null,
      title: (record.get('title') as string) || '',
      status: (record.get('status') as Rfp['status']) || 'intake',
      dueDate: record.get('dueDate') as string | null,
      scopeSummary: record.get('scopeSummary') as string | null,
      sourceDocUrl: record.get('sourceDocUrl') as string | null,
      requirementsChecklist: parseJsonArray(record.get('requirementsChecklist')),
      selectedPath: (record.get('selectedPath') as Rfp['selectedPath']) || 'project',
      // V2.5: RFP Source
      sourceText: record.get('sourceText') as string | null,
      parsedRequirements: parseJsonObject(record.get('parsedRequirements')) as Rfp['parsedRequirements'],
      // V3: Win Strategy
      competitors: parseJsonArray(record.get('competitors')) as string[],
      winStrategy: parseJsonObject(record.get('winStrategy')) as Rfp['winStrategy'],
      // V4: Submission Readiness Snapshot
      submissionSnapshot: parseJsonObject(record.get('submissionSnapshot')) as Rfp['submissionSnapshot'],
      createdBy: record.get('createdBy') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[rfp] Failed to get RFPs for company:', error);
    return [];
  }
}

export async function getRfpById(id: string): Promise<Rfp | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.RFPS).find(id);

    return {
      id: record.id,
      companyId: (record.get('companyId') as string) || '',
      opportunityId: record.get('opportunityId') as string | null,
      title: (record.get('title') as string) || '',
      status: (record.get('status') as Rfp['status']) || 'intake',
      dueDate: record.get('dueDate') as string | null,
      scopeSummary: record.get('scopeSummary') as string | null,
      sourceDocUrl: record.get('sourceDocUrl') as string | null,
      requirementsChecklist: parseJsonArray(record.get('requirementsChecklist')),
      selectedPath: (record.get('selectedPath') as Rfp['selectedPath']) || 'project',
      // V2.5: RFP Source
      sourceText: record.get('sourceText') as string | null,
      parsedRequirements: parseJsonObject(record.get('parsedRequirements')) as Rfp['parsedRequirements'],
      // V3: Win Strategy
      competitors: parseJsonArray(record.get('competitors')) as string[],
      winStrategy: parseJsonObject(record.get('winStrategy')) as Rfp['winStrategy'],
      // V4: Submission Readiness Snapshot
      submissionSnapshot: parseJsonObject(record.get('submissionSnapshot')) as Rfp['submissionSnapshot'],
      createdBy: record.get('createdBy') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[rfp] Failed to get RFP:', error);
    return null;
  }
}

export async function createRfp(input: RfpInput): Promise<Rfp> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const record = await base(AIRTABLE_TABLES.RFPS).create({
    companyId: input.companyId,
    opportunityId: input.opportunityId || null,
    title: input.title,
    status: input.status || 'intake',
    dueDate: input.dueDate || null,
    scopeSummary: input.scopeSummary || null,
    sourceDocUrl: input.sourceDocUrl || null,
    requirementsChecklist: JSON.stringify(input.requirementsChecklist || []),
    selectedPath: input.selectedPath || 'project',
    // V2.5: RFP Source
    sourceText: input.sourceText || null,
    parsedRequirements: input.parsedRequirements ? JSON.stringify(input.parsedRequirements) : null,
    // V3: Win Strategy
    competitors: input.competitors ? JSON.stringify(input.competitors) : null,
    winStrategy: input.winStrategy ? JSON.stringify(input.winStrategy) : null,
    createdBy: input.createdBy || null,
    createdAt: now,
    updatedAt: now,
  });

  const rfp: Rfp = {
    id: record.id,
    companyId: input.companyId,
    opportunityId: input.opportunityId || null,
    title: input.title,
    status: input.status || 'intake',
    dueDate: input.dueDate || null,
    scopeSummary: input.scopeSummary || null,
    sourceDocUrl: input.sourceDocUrl || null,
    requirementsChecklist: input.requirementsChecklist || [],
    selectedPath: input.selectedPath || 'project',
    // V2.5: RFP Source
    sourceText: input.sourceText || null,
    parsedRequirements: input.parsedRequirements || null,
    // V3: Win Strategy
    competitors: input.competitors || [],
    winStrategy: input.winStrategy || null,
    createdBy: input.createdBy || null,
    createdAt: now,
    updatedAt: now,
  };

  // Create initial sections
  await initializeRfpSections(rfp.id);

  // Create initial bindings
  await createRfpBindings({
    rfpId: rfp.id,
    teamMemberIds: [],
    caseStudyIds: [],
    referenceIds: [],
    pricingTemplateId: null,
    planTemplateId: null,
  });

  return rfp;
}

export async function updateRfp(id: string, input: Partial<RfpInput>): Promise<Rfp | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, unknown> = { updatedAt: now };
  if (input.title !== undefined) fields.title = input.title;
  if (input.status !== undefined) fields.status = input.status;
  if (input.dueDate !== undefined) fields.dueDate = input.dueDate;
  if (input.scopeSummary !== undefined) fields.scopeSummary = input.scopeSummary;
  if (input.sourceDocUrl !== undefined) fields.sourceDocUrl = input.sourceDocUrl;
  if (input.requirementsChecklist !== undefined) {
    fields.requirementsChecklist = JSON.stringify(input.requirementsChecklist);
  }
  if (input.selectedPath !== undefined) fields.selectedPath = input.selectedPath;
  if (input.opportunityId !== undefined) fields.opportunityId = input.opportunityId;
  // V2.5: RFP Source
  if (input.sourceText !== undefined) fields.sourceText = input.sourceText;
  if (input.parsedRequirements !== undefined) {
    fields.parsedRequirements = input.parsedRequirements ? JSON.stringify(input.parsedRequirements) : null;
  }
  // V3: Win Strategy
  if (input.competitors !== undefined) {
    fields.competitors = input.competitors ? JSON.stringify(input.competitors) : null;
  }
  if (input.winStrategy !== undefined) {
    fields.winStrategy = input.winStrategy ? JSON.stringify(input.winStrategy) : null;
  }
  // V4: Submission Readiness Snapshot
  if (input.submissionSnapshot !== undefined) {
    fields.submissionSnapshot = input.submissionSnapshot ? JSON.stringify(input.submissionSnapshot) : null;
  }

  await base(AIRTABLE_TABLES.RFPS).update([{ id, fields }]);
  return getRfpById(id);
}

export async function deleteRfp(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();

    // Delete sections first
    const sections = await getRfpSections(id);
    if (sections.length > 0) {
      await base(AIRTABLE_TABLES.RFP_SECTIONS).destroy(sections.map(s => s.id));
    }

    // Delete bindings
    const bindings = await getRfpBindings(id);
    if (bindings) {
      await base(AIRTABLE_TABLES.RFP_BINDINGS).destroy([bindings.id]);
    }

    // Delete RFP
    await base(AIRTABLE_TABLES.RFPS).destroy([id]);
    return true;
  } catch (error) {
    console.error('[rfp] Failed to delete RFP:', error);
    return false;
  }
}

// ============================================================================
// RFP Sections
// ============================================================================

const SECTION_ORDER: RfpSectionKey[] = [
  'agency_overview',
  'approach',
  'team',
  'work_samples',
  'plan_timeline',
  'pricing',
  'references',
];

const SECTION_LABELS: Record<RfpSectionKey, string> = {
  agency_overview: 'Agency Overview',
  approach: 'Our Approach',
  team: 'Proposed Team',
  work_samples: 'Work Samples',
  plan_timeline: 'Plan & Timeline',
  pricing: 'Investment',
  references: 'References',
};

async function initializeRfpSections(rfpId: string): Promise<void> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const sections = SECTION_ORDER.map((key) => ({
    fields: {
      rfpId,
      sectionKey: key,
      title: SECTION_LABELS[key],
      status: 'empty',
      contentWorking: null,
      contentApproved: null,
      sourceType: null,
      generatedUsing: null,
      needsReview: false,
      lastGeneratedAt: null,
      isStale: false,
      staleReason: null,
      reviewNotes: null,
      createdAt: now,
      updatedAt: now,
    },
  }));

  await base(AIRTABLE_TABLES.RFP_SECTIONS).create(sections);
}

export async function getRfpSections(rfpId: string): Promise<RfpSection[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.RFP_SECTIONS)
      .select({
        filterByFormula: `{rfpId} = '${rfpId}'`,
      })
      .all();

    const sections = records.map((record) => ({
      id: record.id,
      rfpId: (record.get('rfpId') as string) || '',
      sectionKey: (record.get('sectionKey') as RfpSectionKey) || 'agency_overview',
      title: (record.get('title') as string) || '',
      status: (record.get('status') as RfpSection['status']) || 'empty',
      contentWorking: record.get('contentWorking') as string | null,
      contentApproved: record.get('contentApproved') as string | null,
      sourceType: record.get('sourceType') as RfpSection['sourceType'] | null,
      generatedUsing: parseJsonObject(record.get('generatedUsing')),
      needsReview: Boolean(record.get('needsReview')),
      lastGeneratedAt: record.get('lastGeneratedAt') as string | null,
      isStale: Boolean(record.get('isStale')),
      staleReason: record.get('staleReason') as string | null,
      reviewNotes: record.get('reviewNotes') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));

    // Sort by section order
    return sections.sort((a, b) => {
      const aIndex = SECTION_ORDER.indexOf(a.sectionKey);
      const bIndex = SECTION_ORDER.indexOf(b.sectionKey);
      return aIndex - bIndex;
    });
  } catch (error) {
    console.error('[rfp] Failed to get RFP sections:', error);
    return [];
  }
}

export async function getRfpSectionByKey(rfpId: string, sectionKey: RfpSectionKey): Promise<RfpSection | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.RFP_SECTIONS)
      .select({
        filterByFormula: `AND({rfpId} = '${rfpId}', {sectionKey} = '${sectionKey}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      rfpId: (record.get('rfpId') as string) || '',
      sectionKey: (record.get('sectionKey') as RfpSectionKey) || 'agency_overview',
      title: (record.get('title') as string) || '',
      status: (record.get('status') as RfpSection['status']) || 'empty',
      contentWorking: record.get('contentWorking') as string | null,
      contentApproved: record.get('contentApproved') as string | null,
      sourceType: record.get('sourceType') as RfpSection['sourceType'] | null,
      generatedUsing: parseJsonObject(record.get('generatedUsing')),
      needsReview: Boolean(record.get('needsReview')),
      lastGeneratedAt: record.get('lastGeneratedAt') as string | null,
      isStale: Boolean(record.get('isStale')),
      staleReason: record.get('staleReason') as string | null,
      reviewNotes: record.get('reviewNotes') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[rfp] Failed to get RFP section:', error);
    return null;
  }
}

export async function updateRfpSection(
  id: string,
  input: Partial<Omit<RfpSectionInput, 'rfpId' | 'sectionKey'>>
): Promise<RfpSection | null> {
  try {
    const base = getAirtableBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = { updatedAt: now };
    if (input.title !== undefined) fields.title = input.title;
    if (input.status !== undefined) fields.status = input.status;
    if (input.contentWorking !== undefined) fields.contentWorking = input.contentWorking;
    if (input.contentApproved !== undefined) fields.contentApproved = input.contentApproved;
    if (input.sourceType !== undefined) fields.sourceType = input.sourceType;
    if (input.generatedUsing !== undefined) {
      fields.generatedUsing = input.generatedUsing ? JSON.stringify(input.generatedUsing) : null;
    }
    if (input.needsReview !== undefined) fields.needsReview = input.needsReview;
    if (input.lastGeneratedAt !== undefined) fields.lastGeneratedAt = input.lastGeneratedAt;
    if (input.isStale !== undefined) fields.isStale = input.isStale;
    if (input.staleReason !== undefined) fields.staleReason = input.staleReason;
    if (input.reviewNotes !== undefined) fields.reviewNotes = input.reviewNotes;

    const [updated] = await base(AIRTABLE_TABLES.RFP_SECTIONS).update([{ id, fields }]);

    return {
      id: updated.id,
      rfpId: (updated.get('rfpId') as string) || '',
      sectionKey: (updated.get('sectionKey') as RfpSectionKey) || 'agency_overview',
      title: (updated.get('title') as string) || '',
      status: (updated.get('status') as RfpSection['status']) || 'empty',
      contentWorking: updated.get('contentWorking') as string | null,
      contentApproved: updated.get('contentApproved') as string | null,
      sourceType: updated.get('sourceType') as RfpSection['sourceType'] | null,
      generatedUsing: parseJsonObject(updated.get('generatedUsing')),
      needsReview: Boolean(updated.get('needsReview')),
      lastGeneratedAt: updated.get('lastGeneratedAt') as string | null,
      isStale: Boolean(updated.get('isStale')),
      staleReason: updated.get('staleReason') as string | null,
      reviewNotes: updated.get('reviewNotes') as string | null,
      createdAt: updated.get('createdAt') as string | null,
      updatedAt: now,
    };
  } catch (error) {
    console.error('[rfp] Failed to update RFP section:', error);
    return null;
  }
}

// ============================================================================
// RFP Bindings
// ============================================================================

export async function getRfpBindings(rfpId: string): Promise<RfpBindings | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.RFP_BINDINGS)
      .select({
        filterByFormula: `{rfpId} = '${rfpId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      rfpId: (record.get('rfpId') as string) || '',
      teamMemberIds: parseJsonArray(record.get('teamMemberIds')) as string[],
      caseStudyIds: parseJsonArray(record.get('caseStudyIds')) as string[],
      referenceIds: parseJsonArray(record.get('referenceIds')) as string[],
      pricingTemplateId: record.get('pricingTemplateId') as string | null,
      planTemplateId: record.get('planTemplateId') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[rfp] Failed to get RFP bindings:', error);
    return null;
  }
}

export async function createRfpBindings(input: RfpBindingsInput): Promise<RfpBindings> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const record = await base(AIRTABLE_TABLES.RFP_BINDINGS).create({
    rfpId: input.rfpId,
    teamMemberIds: JSON.stringify(input.teamMemberIds || []),
    caseStudyIds: JSON.stringify(input.caseStudyIds || []),
    referenceIds: JSON.stringify(input.referenceIds || []),
    pricingTemplateId: input.pricingTemplateId || null,
    planTemplateId: input.planTemplateId || null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: record.id,
    rfpId: input.rfpId,
    teamMemberIds: input.teamMemberIds || [],
    caseStudyIds: input.caseStudyIds || [],
    referenceIds: input.referenceIds || [],
    pricingTemplateId: input.pricingTemplateId || null,
    planTemplateId: input.planTemplateId || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateRfpBindings(
  id: string,
  input: Partial<Omit<RfpBindingsInput, 'rfpId'>>
): Promise<RfpBindings | null> {
  try {
    const base = getAirtableBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = { updatedAt: now };
    if (input.teamMemberIds !== undefined) {
      fields.teamMemberIds = JSON.stringify(input.teamMemberIds);
    }
    if (input.caseStudyIds !== undefined) {
      fields.caseStudyIds = JSON.stringify(input.caseStudyIds);
    }
    if (input.referenceIds !== undefined) {
      fields.referenceIds = JSON.stringify(input.referenceIds);
    }
    if (input.pricingTemplateId !== undefined) {
      fields.pricingTemplateId = input.pricingTemplateId;
    }
    if (input.planTemplateId !== undefined) {
      fields.planTemplateId = input.planTemplateId;
    }

    const [updated] = await base(AIRTABLE_TABLES.RFP_BINDINGS).update([{ id, fields }]);

    return {
      id: updated.id,
      rfpId: (updated.get('rfpId') as string) || '',
      teamMemberIds: parseJsonArray(updated.get('teamMemberIds')) as string[],
      caseStudyIds: parseJsonArray(updated.get('caseStudyIds')) as string[],
      referenceIds: parseJsonArray(updated.get('referenceIds')) as string[],
      pricingTemplateId: updated.get('pricingTemplateId') as string | null,
      planTemplateId: updated.get('planTemplateId') as string | null,
      createdAt: updated.get('createdAt') as string | null,
      updatedAt: now,
    };
  } catch (error) {
    console.error('[rfp] Failed to update RFP bindings:', error);
    return null;
  }
}

// ============================================================================
// RFP with Full Details
// ============================================================================

export async function getRfpWithDetails(rfpId: string): Promise<RfpWithDetails | null> {
  const [rfp, sections, bindings] = await Promise.all([
    getRfpById(rfpId),
    getRfpSections(rfpId),
    getRfpBindings(rfpId),
  ]);

  if (!rfp) return null;

  return { rfp, sections, bindings };
}

// ============================================================================
// Staleness Detection
// ============================================================================

export interface StalenessCheckInput {
  rfp: Rfp;
  sections: RfpSection[];
  bindings: RfpBindings | null;
  agencyProfileUpdatedAt: string | null;
  teamMemberUpdatedAts: Record<string, string>; // id -> updatedAt
  caseStudyUpdatedAts: Record<string, string>;
  referenceUpdatedAts: Record<string, string>;
  pricingTemplateUpdatedAt: string | null;
  planTemplateUpdatedAt: string | null;
  strategyUpdatedAt: string | null;
}

export interface SectionStalenessResult {
  sectionId: string;
  sectionKey: RfpSectionKey;
  isStale: boolean;
  staleReason: string | null;
}

export function checkSectionStaleness(
  section: RfpSection,
  input: StalenessCheckInput
): SectionStalenessResult {
  const { bindings } = input;
  const generatedUsing = section.generatedUsing;

  // If never generated, not stale (just empty)
  if (!section.lastGeneratedAt || !generatedUsing) {
    return { sectionId: section.id, sectionKey: section.sectionKey, isStale: false, staleReason: null };
  }

  const generatedAt = new Date(section.lastGeneratedAt).getTime();
  const reasons: string[] = [];

  // Check agency profile for agency_overview and approach
  if (['agency_overview', 'approach'].includes(section.sectionKey)) {
    if (input.agencyProfileUpdatedAt) {
      const profileUpdated = new Date(input.agencyProfileUpdatedAt).getTime();
      if (profileUpdated > generatedAt) {
        reasons.push('Agency Profile updated');
      }
    }
  }

  // Check team members for team section
  if (section.sectionKey === 'team' && bindings?.teamMemberIds) {
    for (const memberId of bindings.teamMemberIds) {
      const memberUpdated = input.teamMemberUpdatedAts[memberId];
      if (memberUpdated && new Date(memberUpdated).getTime() > generatedAt) {
        reasons.push('Team member updated');
        break;
      }
    }
  }

  // Check case studies for work_samples section
  if (section.sectionKey === 'work_samples' && bindings?.caseStudyIds) {
    for (const caseId of bindings.caseStudyIds) {
      const caseUpdated = input.caseStudyUpdatedAts[caseId];
      if (caseUpdated && new Date(caseUpdated).getTime() > generatedAt) {
        reasons.push('Case study updated');
        break;
      }
    }
  }

  // Check references for references section
  if (section.sectionKey === 'references' && bindings?.referenceIds) {
    for (const refId of bindings.referenceIds) {
      const refUpdated = input.referenceUpdatedAts[refId];
      if (refUpdated && new Date(refUpdated).getTime() > generatedAt) {
        reasons.push('Reference updated');
        break;
      }
    }
  }

  // Check pricing template for pricing section
  if (section.sectionKey === 'pricing' && bindings?.pricingTemplateId) {
    if (input.pricingTemplateUpdatedAt) {
      const pricingUpdated = new Date(input.pricingTemplateUpdatedAt).getTime();
      if (pricingUpdated > generatedAt) {
        reasons.push('Pricing template updated');
      }
    }
  }

  // Check plan template for plan_timeline section
  if (section.sectionKey === 'plan_timeline' && bindings?.planTemplateId) {
    if (input.planTemplateUpdatedAt) {
      const planUpdated = new Date(input.planTemplateUpdatedAt).getTime();
      if (planUpdated > generatedAt) {
        reasons.push('Plan template updated');
      }
    }
  }

  // Check scope summary for approach, plan_timeline, pricing
  if (['approach', 'plan_timeline', 'pricing'].includes(section.sectionKey)) {
    const scopeHash = generatedUsing.scopeSummaryHash;
    const currentScopeHash = hashString(input.rfp.scopeSummary || '');
    if (scopeHash && scopeHash !== currentScopeHash) {
      reasons.push('Scope summary changed');
    }
  }

  // Check strategy for approach, plan_timeline, pricing (optional)
  if (['approach', 'plan_timeline', 'pricing'].includes(section.sectionKey)) {
    if (input.strategyUpdatedAt && generatedUsing.strategyVersion) {
      const strategyUpdated = new Date(input.strategyUpdatedAt).getTime();
      if (strategyUpdated > generatedAt) {
        reasons.push('Strategy updated');
      }
    }
  }

  const isStale = reasons.length > 0;
  return {
    sectionId: section.id,
    sectionKey: section.sectionKey,
    isStale,
    staleReason: isStale ? reasons.join(', ') : null,
  };
}

export async function updateSectionStaleness(
  sectionId: string,
  isStale: boolean,
  staleReason: string | null
): Promise<void> {
  const base = getAirtableBase();
  await base(AIRTABLE_TABLES.RFP_SECTIONS).update([
    {
      id: sectionId,
      fields: {
        isStale,
        staleReason,
        updatedAt: new Date().toISOString(),
      },
    },
  ]);
}

// ============================================================================
// Firm-Scoped Outcome Analysis
// ============================================================================

export type OutcomeTimeRange = '90d' | '180d' | '365d' | 'all';

/**
 * Minimal RFP data for outcome analysis (firm-scoped)
 */
export interface RfpOutcomeMinimal {
  id: string;
  status: 'won' | 'lost';
  submissionSnapshot: NonNullable<Rfp['submissionSnapshot']>;
  createdAt: string;
}

/**
 * Fetch all RFPs across the firm for outcome analysis
 * Only returns RFPs with status won/lost AND a submissionSnapshot
 */
export async function listFirmRfpsForOutcomeAnalysis(options: {
  timeRange?: OutcomeTimeRange;
}): Promise<RfpOutcomeMinimal[]> {
  try {
    const base = getAirtableBase();

    // Build filter formula
    // Must have outcome (won/lost) AND submissionSnapshot is not empty
    let formula = `AND(OR({status} = 'won', {status} = 'lost'), {submissionSnapshot} != '')`;

    // Add time range filter
    if (options.timeRange && options.timeRange !== 'all') {
      const days = options.timeRange === '90d' ? 90 : options.timeRange === '180d' ? 180 : 365;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISO = cutoffDate.toISOString();
      formula = `AND(${formula}, {createdAt} >= '${cutoffISO}')`;
    }

    const records = await base(AIRTABLE_TABLES.RFPS)
      .select({
        filterByFormula: formula,
        fields: ['status', 'submissionSnapshot', 'createdAt'],
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records
      .map((record) => {
        const snapshot = parseJsonObject(record.get('submissionSnapshot')) as Rfp['submissionSnapshot'];
        const status = record.get('status') as Rfp['status'];
        const createdAt = record.get('createdAt') as string | null;

        // Filter out records with null snapshot or invalid status
        if (!snapshot || (status !== 'won' && status !== 'lost') || !createdAt) {
          return null;
        }

        return {
          id: record.id,
          status: status as 'won' | 'lost',
          submissionSnapshot: snapshot,
          createdAt,
        };
      })
      .filter((r): r is RfpOutcomeMinimal => r !== null);
  } catch (error) {
    console.error('[rfp] Failed to list firm RFPs for outcome analysis:', error);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function parseJsonArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
