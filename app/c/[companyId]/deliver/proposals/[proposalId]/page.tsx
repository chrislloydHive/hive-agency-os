// app/c/[companyId]/deliver/proposals/[proposalId]/page.tsx
// Proposal Detail Page - Review individual proposal with diff and accept/reject
//
// Shows:
// - Proposal metadata (title, rationale, warnings, assumptions, unknowns)
// - Visual diff between approved and proposed plans
// - Accept/Reject actions

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getPlanProposalById } from '@/lib/airtable/planProposals';
import { getMediaPlanById, getContentPlanById } from '@/lib/airtable/heavyPlans';
import { computePlanDiff } from '@/lib/os/plans/diff/planDiff';
import { ProposalDetailClient } from './ProposalDetailClient';
import type { Plan } from '@/lib/types/plan';

export const dynamic = 'force-dynamic';

interface ProposalDetailPageProps {
  params: Promise<{ companyId: string; proposalId: string }>;
}

export async function generateMetadata({ params }: ProposalDetailPageProps) {
  const { companyId, proposalId } = await params;
  const company = await getCompanyById(companyId);
  const proposal = await getPlanProposalById(proposalId);

  if (!company || !proposal) {
    return { title: 'Proposal Not Found | Hive OS' };
  }

  const title = proposal.title || `Proposal ${proposalId.slice(-6)}`;

  return {
    title: `${title} | ${company.name} | Hive OS`,
    description: proposal.rationale || 'Review this plan proposal',
  };
}

export default async function ProposalDetailPage({ params }: ProposalDetailPageProps) {
  const { companyId, proposalId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  const proposal = await getPlanProposalById(proposalId);
  if (!proposal) {
    return notFound();
  }

  // Verify proposal belongs to this company
  if (proposal.companyId !== companyId) {
    return notFound();
  }

  // Load the proposed and approved plans
  let proposedPlan: Plan | null = null;
  let approvedPlan: Plan | null = null;

  const planIdToLoad = proposal.proposedPlanId || proposal.planId;
  const approvedPlanId = proposal.approvedPlanId;

  if (proposal.planType === 'media') {
    if (planIdToLoad) {
      proposedPlan = await getMediaPlanById(planIdToLoad);
    }
    if (approvedPlanId) {
      approvedPlan = await getMediaPlanById(approvedPlanId);
    }
  } else {
    if (planIdToLoad) {
      proposedPlan = await getContentPlanById(planIdToLoad);
    }
    if (approvedPlanId) {
      approvedPlan = await getContentPlanById(approvedPlanId);
    }
  }

  // Compute diff if we have a proposed plan
  let diff = null;
  if (proposedPlan) {
    try {
      diff = computePlanDiff(approvedPlan, proposedPlan);
    } catch (error) {
      console.error('[ProposalDetail] Failed to compute diff:', error);
    }
  }

  return (
    <ProposalDetailClient
      companyId={companyId}
      companyName={company.name}
      proposal={proposal}
      proposedPlan={proposedPlan}
      approvedPlan={approvedPlan}
      diff={diff}
    />
  );
}
