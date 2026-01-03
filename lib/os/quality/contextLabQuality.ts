// lib/os/quality/contextLabQuality.ts
// Compute lab quality directly from Context V4 proposed fields.

import { getProposedFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { computeLabQuality, type LabFact, type LabQuality } from './computeLabQuality';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { getCanonicalCompetitionRun } from '@/lib/competition/getCanonicalCompetitionRun';

export type LabKey = 'websiteLab' | 'brandLab' | 'gapPlan' | 'competitionLab' | 'audienceLab';

export interface LabQualityMap {
  websiteLab: LabQuality;
  brandLab: LabQuality;
  gapPlan: LabQuality;
  competitionLab: LabQuality;
  audienceLab: LabQuality;
}

/**
 * Map ContextFieldV4 to LabFact
 */
function toLabFact(field: any): LabFact {
  const parts = field.key?.split('.') || [];
  const factKey = parts.slice(1).join('.') || field.key;
  return {
    domainKey: field.domain,
    factKey,
    value: field.value,
    confidence: field.confidence ?? 0,
    evidenceRefs: field.evidence ? [field.evidence] : [],
    sourceLab: field.importerId || field.source || 'lab',
    runId: field.sourceId,
    alternatives: (field.alternatives || []).map((a: any) => ({
      value: a.value,
      confidence: a.confidence ?? 0,
      sourceLab: a.source || a.importerId || 'lab',
      evidenceRefs: a.evidence ? [a.evidence] : [],
    })),
  };
}

async function fallbackInsufficient(
  companyId: string,
  lab: LabKey
): Promise<LabQuality> {
  let hasRun = false;
  if (lab === 'competitionLab') {
    const run = await getCanonicalCompetitionRun(companyId);
    hasRun = !!run && run.status === 'completed';
  } else {
    const run = await getLatestRunForCompanyAndTool(companyId, lab as any);
    hasRun = !!run && run.status === 'complete';
  }

  if (hasRun) {
    return {
      score: null,
      label: 'Insufficient',
      reasons: [{ code: 'no_facts', label: 'No proposed facts yet' }],
      metrics: {
        evidenceCoverage: 0,
        avgConfidence: 0,
        specificity: 0,
        conflictRate: 0,
        factCount: 0,
      },
    };
  }

  return {
    score: null,
    label: 'Insufficient',
    reasons: [{ code: 'no_run', label: 'Lab not run yet' }],
    metrics: {
      evidenceCoverage: 0,
      avgConfidence: 0,
      specificity: 0,
      conflictRate: 0,
      factCount: 0,
    },
  };
}

export async function computeContextLabQuality(
  companyId: string
): Promise<LabQualityMap> {
  const proposed = await getProposedFieldsV4(companyId);

  const byLab: Record<string, any[]> = {
    websiteLab: [],
    brandLab: [],
    gapPlan: [],
    competitionLab: [],
    audienceLab: [],
  };

  for (const f of proposed) {
    const lab = f.importerId || f.source;
    if (lab && byLab[lab]) {
      byLab[lab].push(f);
    }
  }

  const result: Partial<LabQualityMap> = {};

  for (const lab of Object.keys(byLab) as LabKey[]) {
    const facts = byLab[lab].map(toLabFact);
    if (facts.length === 0) {
      result[lab] = await fallbackInsufficient(companyId, lab);
    } else {
      result[lab] = computeLabQuality(facts);
    }
  }

  return result as LabQualityMap;
}

