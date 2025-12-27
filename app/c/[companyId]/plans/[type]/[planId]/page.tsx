// app/c/[companyId]/plans/[type]/[planId]/page.tsx
// Plan Editor Page
//
// Editable for draft/in_review; read-only for approved/archived.
// Shows header with status, actions, and section editors.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getPlanById } from '@/lib/airtable/heavyPlans';
import { getPendingProposalsForCompany } from '@/lib/airtable/planProposals';
import { checkPlanStaleness, computeContextHash, computeStrategyHash } from '@/lib/os/plans/planSnapshots';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { PlanType } from '@/lib/types/plan';
import { PlanEditorClient } from './PlanEditorClient';

export const dynamic = 'force-dynamic';

interface PlanEditorPageProps {
  params: Promise<{ companyId: string; type: string; planId: string }>;
}

export async function generateMetadata({ params }: PlanEditorPageProps) {
  const { companyId, type, planId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  const plan = await getPlanById(type as PlanType, planId);
  if (!plan) {
    return { title: 'Plan Not Found | Hive OS' };
  }

  const planTypeLabel = type === 'media' ? 'Media Plan' : 'Content Plan';
  const statusLabel = plan.status === 'approved' ? `v${plan.version}` : plan.status;

  return {
    title: `${planTypeLabel} (${statusLabel}) | ${company.name} | Hive OS`,
    description: `Edit ${planTypeLabel} for ${company.name}`,
  };
}

export default async function PlanEditorPage({ params }: PlanEditorPageProps) {
  const { companyId, type, planId } = await params;

  // Validate type
  if (type !== 'media' && type !== 'content') {
    return notFound();
  }
  const planType = type as PlanType;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Load plan
  const plan = await getPlanById(planType, planId);
  if (!plan) {
    return notFound();
  }

  // Verify ownership
  if (plan.companyId !== companyId) {
    return notFound();
  }

  // Check for staleness (for approved plans)
  let isStale = false;
  let stalenessReason: string | null = null;

  if (plan.status === 'approved') {
    try {
      const [context, strategy] = await Promise.all([
        loadContextGraph(companyId),
        getActiveStrategy(companyId),
      ]);

      const currentContextHash = computeContextHash(context);
      const currentStrategyHash = computeStrategyHash(strategy);
      const staleness = checkPlanStaleness(plan, currentContextHash, currentStrategyHash);

      isStale = staleness.isStale;
      stalenessReason = staleness.reason;
    } catch (err) {
      console.error('[PlanEditor] Failed to check staleness:', err);
    }
  }

  // Load pending proposals for this plan
  const allProposals = await getPendingProposalsForCompany(companyId);
  const planProposals = allProposals.filter(
    (p) => p.planType === planType && (p.planId === planId || p.proposedPlanId === planId || p.approvedPlanId === planId)
  );

  return (
    <PlanEditorClient
      companyId={companyId}
      companyName={company.name}
      planType={planType}
      plan={plan}
      isStale={isStale}
      stalenessReason={stalenessReason}
      pendingProposalCount={planProposals.length}
    />
  );
}
