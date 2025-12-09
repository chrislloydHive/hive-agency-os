// app/c/[companyId]/media/scenarios/page.tsx
// Media Scenario Planning page
//
// Two-column layout:
// - Left: Scenario list and selection
// - Right: Scenario editor and forecast panel

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getMediaScenariosForCompany } from '@/lib/media/scenarios';
import { getMediaPlansForCompany } from '@/lib/airtable/mediaLab';
import { MediaProgramEmptyState } from '@/components/os/media';
import { ScenariosClient } from './ScenariosClient';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function MediaScenariosPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Check if media is enabled
  const hasMedia = companyHasMediaProgram(company);

  // Empty state for non-media companies
  if (!hasMedia) {
    return (
      <div className="space-y-6">
        {/* Header with back link */}
        <div className="flex items-center gap-3">
          <Link
            href={`/c/${companyId}/media`}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Media
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-200">Scenario Planning</span>
        </div>

        <MediaProgramEmptyState company={company} />
      </div>
    );
  }

  // Fetch scenarios and active plans
  const [scenarios, allPlans] = await Promise.all([
    getMediaScenariosForCompany(companyId),
    getMediaPlansForCompany(companyId),
  ]);
  const activePlans = allPlans.filter(p => p.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/c/${companyId}/media`}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Media
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-200">Scenario Planning</span>
        </div>
      </div>

      {/* Main content */}
      <ScenariosClient
        companyId={companyId}
        companyName={company.name}
        initialScenarios={scenarios}
        hasActivePlan={activePlans.length > 0}
        activePlanId={activePlans[0]?.id}
      />
    </div>
  );
}
