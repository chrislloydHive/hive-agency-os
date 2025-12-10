// app/c/[companyId]/diagnostics/competition/page.tsx
// Competition Lab - Canonical diagnostic route
//
// Maps the competitive landscape: core competitors, alternatives,
// and strategic differentiation.

import { getCompanyById } from '@/lib/airtable/companies';
import { CompetitionLabV4 } from '@/components/competition/CompetitionLabV4';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function CompetitionLabPage({ params }: Props) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href={`/c/${companyId}`} className="hover:text-slate-300 transition-colors">
          {company.name}
        </Link>
        <span>/</span>
        <Link href={`/c/${companyId}/blueprint`} className="hover:text-slate-300 transition-colors">
          Diagnostics
        </Link>
        <span>/</span>
        <span className="text-slate-300">Competition Lab</span>
      </nav>

      <CompetitionLabV4
        companyId={companyId}
        companyName={company.name}
      />
    </div>
  );
}
