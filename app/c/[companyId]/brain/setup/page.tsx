// app/c/[companyId]/brain/setup/page.tsx
// Strategic Setup Mode entry point (within Brain workspace)
//
// This page loads Setup form data directly from the Context Graph,
// making Setup a view/editor on Brain data. It renders within the
// Brain layout with the Context/Setup/Insights/Library/History sub-nav.

import { getCompanyById } from '@/lib/airtable/companies';
import { loadSetupFromContextGraph } from '@/lib/contextGraph/setupLoader';
import { redirect } from 'next/navigation';
import { SetupClient } from './SetupClient';
import { createEmptyFormData, SETUP_STEPS, SetupStepId } from './types';

export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { companyId } = await params;
  const { step: stepParam } = await searchParams;

  // Convert step number to step ID (e.g., "9" -> "measurement")
  let initialStep: SetupStepId | undefined;
  if (stepParam) {
    const stepNum = parseInt(stepParam, 10);
    if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= SETUP_STEPS.length) {
      initialStep = SETUP_STEPS[stepNum - 1];
    } else if (SETUP_STEPS.includes(stepParam as SetupStepId)) {
      // Also accept step ID directly (e.g., "measurement")
      initialStep = stepParam as SetupStepId;
    }
  }
  const company = await getCompanyById(companyId);

  if (!company) {
    redirect('/companies');
  }

  // Load Setup data from Context Graph
  const loaderResult = await loadSetupFromContextGraph(companyId);

  // If no graph exists, create empty form with company name pre-filled
  let initialFormData = loaderResult.formData;
  if (!loaderResult.hasGraph) {
    const empty = createEmptyFormData();
    if (empty.businessIdentity) {
      empty.businessIdentity.businessName = company.name;
    }
    initialFormData = empty;
  }

  // Convert provenance map to plain object for serialization
  const provenanceMapData: Record<string, {
    value: unknown;
    source: string | null;
    sourceName: string | null;
    confidence: number;
    updatedAt: string | null;
    isHumanOverride: boolean;
  }> = {};

  for (const [key, value] of loaderResult.provenanceMap) {
    provenanceMapData[key] = value;
  }

  return (
    <SetupClient
      companyId={companyId}
      companyName={company.name}
      initialFormData={initialFormData}
      initialProvenanceMap={new Map(Object.entries(provenanceMapData))}
      missingFields={loaderResult.missingFields}
      hasGraph={loaderResult.hasGraph}
      initialStep={initialStep}
    />
  );
}
