// app/c/[companyId]/diagnostics/competitor/page.tsx
// Competitor Deep Dive - Canonical diagnostic route
//
// Analyze individual competitors in-depth: positioning, messaging,
// strengths, and weaknesses.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadCompetitorLabContext } from '@/app/c/[companyId]/labs/competitor/loadCompetitorLab';
import { CompetitorLabClient } from '@/app/c/[companyId]/labs/competitor/CompetitorLabClient';

interface Props {
  params: Promise<{ companyId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function CompetitorDeepDivePage({ params }: Props) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  const labContext = await loadCompetitorLabContext(companyId, company.name);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 px-6 pt-4">
        <Link href={`/c/${companyId}`} className="hover:text-slate-300 transition-colors">
          {company.name}
        </Link>
        <span>/</span>
        <Link href={`/c/${companyId}/blueprint`} className="hover:text-slate-300 transition-colors">
          Diagnostics
        </Link>
        <span>/</span>
        <span className="text-slate-300">Competitor Deep Dive</span>
      </nav>

      <CompetitorLabClient
        companyId={companyId}
        companyName={company.name}
        labContext={labContext}
      />
    </div>
  );
}
