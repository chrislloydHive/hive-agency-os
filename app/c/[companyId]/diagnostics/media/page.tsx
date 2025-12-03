// app/c/[companyId]/diagnostics/media/page.tsx
// Media Lab - Strategic Media Planning Tool
//
// This Lab is for planning media programs, not diagnostic analysis.
// V1.1: Full CRUD for plans, channels, flights + work item generation

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaLabForCompany, getPrimaryPlan } from '@/lib/mediaLab';
import { MediaLabClient } from './MediaLabClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ plan?: string }>;
};

export default async function MediaLabPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { plan: selectedPlanId } = await searchParams;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch Media Lab data
  const mediaLabData = await getMediaLabForCompany(companyId);
  const { plans } = mediaLabData;

  // Determine initial selected plan
  let initialSelectedPlanId: string | undefined;
  if (selectedPlanId && plans.some(p => p.id === selectedPlanId)) {
    initialSelectedPlanId = selectedPlanId;
  } else {
    const primaryPlan = getPrimaryPlan(plans);
    initialSelectedPlanId = primaryPlan?.id;
  }

  return (
    <MediaLabClient
      companyId={companyId}
      companyName={company.name}
      initialPlans={plans}
      initialSelectedPlanId={initialSelectedPlanId}
    />
  );
}
