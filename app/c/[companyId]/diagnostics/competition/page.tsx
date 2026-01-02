// app/c/[companyId]/diagnostics/competition/page.tsx
// Competition Lab - Canonical diagnostic route
//
// Maps the competitive landscape: core competitors, alternatives,
// and strategic differentiation.
//
// UI Pattern: Matches Website Lab V5 full-page layout

import { getCompanyById } from '@/lib/airtable/companies';
import { CompetitionLabV5 } from '@/components/competition/CompetitionLabV5';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ companyId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function CompetitionLabPage({ params }: Props) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation - matches Website Lab V5 */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${companyId}/blueprint`}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              ← Back to Blueprint
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-sm text-slate-500">{company.name}</span>
          </div>
          <span className="text-xs font-medium text-purple-400/80 bg-purple-500/10 px-2 py-1 rounded">
            Competition Lab
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <CompetitionLabV5
          companyId={companyId}
          companyName={company.name}
        />
      </div>
    </div>
  );
}
