// app/c/[companyId]/diagnostics/media/page.tsx
// Media Lab - Strategic Media Planning Tool
//
// Modes:
// 1. Smart Planner (mode=planner) - Enterprise 13-category AI planner with Brain integration
// 2. Creative Lab (mode=creative) - AI creative & messaging generator
// 3. Advanced Editor (default) - Full CRUD for plans, channels, flights
//
// V2.0: Added AI Planner with 3-option generation and promotion flow
// V2.1: Added Creative Lab for AI-powered creative generation
// V3.0: Upgraded to SmartIntakePlanner with 13-category inputs and Brain integration

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaLabForCompany, getPrimaryPlan } from '@/lib/mediaLab';
import { MediaLabClient } from './MediaLabClient';
import { SmartIntakePlanner } from '@/components/mediaLab/SmartIntakePlanner';
import { CreativeLabWizard } from '@/components/mediaLab/CreativeLabWizard';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ plan?: string; mode?: string }>;
};

export default async function MediaLabPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { plan: selectedPlanId, mode } = await searchParams;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // If mode=planner, show the Smart Intake Planner (enterprise version)
  if (mode === 'planner') {
    return (
      <SmartIntakePlanner
        companyId={companyId}
        companyName={company.name}
      />
    );
  }

  // If mode=creative, show the Creative Lab wizard
  if (mode === 'creative') {
    return (
      <CreativeLabWizard
        companyId={companyId}
        companyName={company.name}
      />
    );
  }

  // Otherwise, show the advanced editor
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
