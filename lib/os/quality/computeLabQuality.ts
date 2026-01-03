// lib/os/quality/computeLabQuality.ts
// Deterministic lab quality scoring from proposed facts (no AI calls).

export interface LabFact {
  domainKey: string;
  factKey: string;
  value: unknown;
  confidence: number; // 0..1
  evidenceRefs?: Array<unknown>;
  sourceLab: string;
  runId?: string;
  alternatives?: LabFactAlternative[];
}

export interface LabFactAlternative {
  value: unknown;
  confidence: number;
  sourceLab: string;
  evidenceRefs?: Array<unknown>;
}

export interface LabQuality {
  score: number | null;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Insufficient';
  reasons: Array<{ code: string; label: string; detail?: string; weightImpact?: number }>;
  metrics: {
    evidenceCoverage: number;
    avgConfidence: number;
    specificity: number;
    conflictRate: number;
    factCount: number;
  };
}

const EVIDENCE_WEIGHT = 0.45;
const CONFIDENCE_WEIGHT = 0.25;
const SPECIFICITY_WEIGHT = 0.2;
const CONFLICT_PENALTY = 0.1;

const GEO_TOKENS = [
  'pacific northwest',
  'new england',
  'midwest',
  'southeast',
  'southwest',
  'texas',
  'california',
  'ny',
  'ca',
  'wa',
  'or',
  'co',
  'fl',
];

function specificityScore(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return 0;

  let score = 0;
  if (/\d/.test(text)) score += 0.2;
  if (/\bhttps?:\/\/|\.com\b|\.net\b|\.org\b/i.test(text)) score += 0.2;
  if (/\/|homepage|pricing|contact|about|product|services/i.test(text)) score += 0.2;
  if (GEO_TOKENS.some(t => text.toLowerCase().includes(t))) score += 0.2;
  if (text.length >= 80 || (text.match(/\b[A-Z][a-z]+\b/g)?.length ?? 0) >= 2) score += 0.2;
  return Math.min(1, score);
}

function labelForScore(score: number | null): LabQuality['label'] {
  if (score === null) return 'Insufficient';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

export function computeLabQuality(facts: LabFact[]): LabQuality {
  if (!facts || facts.length === 0) {
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

  const factCount = facts.length;
  const evidenceHits = facts.filter(f => (f.evidenceRefs?.length ?? 0) > 0).length;
  const evidenceCoverage = evidenceHits / factCount;
  const avgConfidence = facts.reduce((s, f) => s + (f.confidence ?? 0), 0) / factCount;
  const specificity = facts.reduce((s, f) => s + specificityScore(f.value), 0) / factCount;
  const conflictFacts = facts.filter(f => (f.alternatives?.length ?? 0) > 0).length;
  const conflictRate = conflictFacts / factCount;

  const rawScore =
    100 *
    (EVIDENCE_WEIGHT * evidenceCoverage +
      CONFIDENCE_WEIGHT * avgConfidence +
      SPECIFICITY_WEIGHT * specificity -
      CONFLICT_PENALTY * conflictRate);

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const label = labelForScore(score);

  const reasons: LabQuality['reasons'] = [];
  if (evidenceCoverage < 0.35) {
    reasons.push({
      code: 'low_evidence',
      label: 'Missing evidence',
      detail: `Evidence on ${Math.round(evidenceCoverage * 100)}%`,
      weightImpact: EVIDENCE_WEIGHT,
    });
  }
  if (avgConfidence < 0.6) {
    reasons.push({
      code: 'low_confidence',
      label: 'Low confidence',
      detail: `Avg ${(avgConfidence * 100).toFixed(0)}%`,
      weightImpact: CONFIDENCE_WEIGHT,
    });
  }
  if (specificity < 0.45) {
    reasons.push({
      code: 'generic',
      label: 'Generic / non-specific',
      detail: `Specificity ${(specificity * 100).toFixed(0)}%`,
      weightImpact: SPECIFICITY_WEIGHT,
    });
  }
  if (conflictRate > 0.3) {
    reasons.push({
      code: 'conflicts',
      label: 'Conflicting proposals',
      detail: `${Math.round(conflictRate * 100)}% have alternatives`,
      weightImpact: CONFLICT_PENALTY,
    });
  }

  return {
    score,
    label,
    reasons: reasons.slice(0, 3),
    metrics: {
      evidenceCoverage,
      avgConfidence,
      specificity,
      conflictRate,
      factCount,
    },
  };
}

