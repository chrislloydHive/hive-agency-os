// lib/contextGraph/domains/budgetOps.ts
// Budget & Financial Operations Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { MediaChannelId, TimeHorizon } from '../enums';

/**
 * Budget Allocation definition
 */
export const BudgetAllocation = z.object({
  channel: MediaChannelId,
  amount: z.number(),
  percentage: z.number().nullable(),
  period: TimeHorizon.nullable(),
  notes: z.string().nullable(),
});

export type BudgetAllocation = z.infer<typeof BudgetAllocation>;

/**
 * Investment Constraint definition
 */
export const InvestmentConstraint = z.object({
  type: z.enum(['min_spend', 'max_spend', 'channel_cap', 'timing', 'approval', 'other']),
  description: z.string(),
  channel: MediaChannelId.nullable(),
  value: z.number().nullable(),
  notes: z.string().nullable(),
});

export type InvestmentConstraint = z.infer<typeof InvestmentConstraint>;

/**
 * BudgetOps domain captures budget, financial goals, and investment constraints.
 * This informs media budget allocation and financial planning.
 */
export const BudgetOpsDomain = z.object({
  // Overall Budget
  totalMarketingBudget: WithMeta(z.number()),
  mediaSpendBudget: WithMeta(z.number()),
  budgetPeriod: WithMeta(TimeHorizon),
  budgetCadence: WithMeta(z.string()),

  // Current Allocation
  currentAllocation: WithMetaArray(BudgetAllocation),
  recommendedAllocation: WithMetaArray(BudgetAllocation),

  // Financial Goals
  revenueTarget: WithMeta(z.number()),
  leadTarget: WithMeta(z.number()),
  roasTarget: WithMeta(z.number()),
  cpaTarget: WithMeta(z.number()),

  // Unit Economics
  avgCustomerValue: WithMeta(z.number()),
  customerLTV: WithMeta(z.number()),
  avgOrderValue: WithMeta(z.number()),
  grossMargin: WithMeta(z.number()),
  contributionMargin: WithMeta(z.number()),

  // Investment Philosophy
  investmentPhilosophy: WithMeta(z.string()),
  riskTolerance: WithMeta(z.string()),
  growthAmbition: WithMeta(z.string()),

  // Constraints
  investmentConstraints: WithMetaArray(InvestmentConstraint),
  budgetFlexibility: WithMeta(z.string()),
  approvalProcess: WithMeta(z.string()),
  fundingCycle: WithMeta(z.string()),

  // Cash Flow
  cashFlowConsiderations: WithMeta(z.string()),
  paymentTerms: WithMeta(z.string()),
  billingCadence: WithMeta(z.string()),

  // Performance Thresholds
  minRoas: WithMeta(z.number()),
  maxCpa: WithMeta(z.number()),
  efficiencyThresholds: WithMeta(z.string()),

  // Historical
  historicalSpend: WithMeta(z.string()),
  yoyGrowth: WithMeta(z.number()),
  budgetTrend: WithMeta(z.string()),
});

export type BudgetOpsDomain = z.infer<typeof BudgetOpsDomain>;

/**
 * Create an empty BudgetOps domain
 */
export function createEmptyBudgetOpsDomain(): BudgetOpsDomain {
  return {
    totalMarketingBudget: { value: null, provenance: [] },
    mediaSpendBudget: { value: null, provenance: [] },
    budgetPeriod: { value: null, provenance: [] },
    budgetCadence: { value: null, provenance: [] },
    currentAllocation: { value: [], provenance: [] },
    recommendedAllocation: { value: [], provenance: [] },
    revenueTarget: { value: null, provenance: [] },
    leadTarget: { value: null, provenance: [] },
    roasTarget: { value: null, provenance: [] },
    cpaTarget: { value: null, provenance: [] },
    avgCustomerValue: { value: null, provenance: [] },
    customerLTV: { value: null, provenance: [] },
    avgOrderValue: { value: null, provenance: [] },
    grossMargin: { value: null, provenance: [] },
    contributionMargin: { value: null, provenance: [] },
    investmentPhilosophy: { value: null, provenance: [] },
    riskTolerance: { value: null, provenance: [] },
    growthAmbition: { value: null, provenance: [] },
    investmentConstraints: { value: [], provenance: [] },
    budgetFlexibility: { value: null, provenance: [] },
    approvalProcess: { value: null, provenance: [] },
    fundingCycle: { value: null, provenance: [] },
    cashFlowConsiderations: { value: null, provenance: [] },
    paymentTerms: { value: null, provenance: [] },
    billingCadence: { value: null, provenance: [] },
    minRoas: { value: null, provenance: [] },
    maxCpa: { value: null, provenance: [] },
    efficiencyThresholds: { value: null, provenance: [] },
    historicalSpend: { value: null, provenance: [] },
    yoyGrowth: { value: null, provenance: [] },
    budgetTrend: { value: null, provenance: [] },
  };
}
