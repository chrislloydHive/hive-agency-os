// app/c/[companyId]/diagnostics/audience/page.tsx
// Audience Lab Page - Server Component
//
// Loads audience signals, current model, personas, and renders the Audience Lab UI.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCurrentAudienceModel } from '@/lib/audience/storage';
import { loadAudienceSignalsForCompany, getSignalsSummary } from '@/lib/audience/signals';
import { getPersonaSet } from '@/lib/audience/personaStorage';
import { AudienceLabClient } from './AudienceLabClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function AudienceLabPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Load data in parallel
  const [currentModel, signals, personaSet] = await Promise.all([
    getCurrentAudienceModel(companyId),
    loadAudienceSignalsForCompany(companyId),
    getPersonaSet(companyId),
  ]);

  const signalsSummary = getSignalsSummary(signals);

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Audience Lab
          </span>
        </div>
      </div>

      {/* Main Content */}
      <AudienceLabClient
        companyId={companyId}
        companyName={company.name}
        initialModel={currentModel}
        initialPersonaSet={personaSet}
        signals={signals}
        signalsSummary={signalsSummary}
      />
    </div>
  );
}
