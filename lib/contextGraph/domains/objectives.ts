// lib/contextGraph/domains/objectives.ts
// Marketing Objectives & KPIs Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { PrimaryObjective, UniversalKpi, TimeHorizon } from '../enums';

/**
 * KPI Target definition
 */
export const KpiTarget = z.object({
  kpi: UniversalKpi,
  target: z.number().nullable(),
  currentValue: z.number().nullable(),
  unit: z.string().nullable(),
});

export type KpiTarget = z.infer<typeof KpiTarget>;

/**
 * Objectives domain captures marketing goals, KPIs, and targets.
 * This drives media planning and optimization decisions.
 */
export const ObjectivesDomain = z.object({
  // Primary Goal
  primaryObjective: WithMeta(PrimaryObjective),
  secondaryObjectives: WithMetaArray(PrimaryObjective),
  primaryBusinessGoal: WithMeta(z.string()),

  // Time Horizon
  timeHorizon: WithMeta(TimeHorizon),
  planningPeriodStart: WithMeta(z.string()),
  planningPeriodEnd: WithMeta(z.string()),

  // KPI Targets
  kpiLabels: WithMetaArray(z.string()),
  kpiTargets: WithMetaArray(KpiTarget),

  // Efficiency Targets
  targetCpa: WithMeta(z.number()),
  targetCpl: WithMeta(z.number()),
  targetRoas: WithMeta(z.number()),
  targetMer: WithMeta(z.number()),
  targetCac: WithMeta(z.number()),
  targetLtv: WithMeta(z.number()),

  // Contribution Requirements
  contributionMarginRequirement: WithMeta(z.string()),
  breakEvenCpa: WithMeta(z.number()),

  // Growth Targets
  revenueGoal: WithMeta(z.number()),
  leadGoal: WithMeta(z.number()),
  conversionGoal: WithMeta(z.number()),
});

export type ObjectivesDomain = z.infer<typeof ObjectivesDomain>;

/**
 * Create an empty Objectives domain
 */
export function createEmptyObjectivesDomain(): ObjectivesDomain {
  return {
    primaryObjective: { value: null, provenance: [] },
    secondaryObjectives: { value: [], provenance: [] },
    primaryBusinessGoal: { value: null, provenance: [] },
    timeHorizon: { value: null, provenance: [] },
    planningPeriodStart: { value: null, provenance: [] },
    planningPeriodEnd: { value: null, provenance: [] },
    kpiLabels: { value: [], provenance: [] },
    kpiTargets: { value: [], provenance: [] },
    targetCpa: { value: null, provenance: [] },
    targetCpl: { value: null, provenance: [] },
    targetRoas: { value: null, provenance: [] },
    targetMer: { value: null, provenance: [] },
    targetCac: { value: null, provenance: [] },
    targetLtv: { value: null, provenance: [] },
    contributionMarginRequirement: { value: null, provenance: [] },
    breakEvenCpa: { value: null, provenance: [] },
    revenueGoal: { value: null, provenance: [] },
    leadGoal: { value: null, provenance: [] },
    conversionGoal: { value: null, provenance: [] },
  };
}
