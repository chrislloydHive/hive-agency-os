// app/c/[companyId]/competition/page.tsx
// Competition Lab v2 - Server Component Entry Point
//
// Three-column competitive cockpit:
// - Left: Company context + filters
// - Center: Competitor map/list/compare
// - Right: Strategic impact panels

import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { CompetitionClient } from './CompetitionClient';
import Link from 'next/link';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function CompetitionPage({ params }: Props) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-200 mb-2">Company not found</h2>
        <p className="text-gray-400 mb-4">
          The company &quot;{companyId}&quot; does not exist.
        </p>
        <Link href="/companies" className="text-blue-400 hover:text-blue-300 transition-colors">
          &larr; Back to companies
        </Link>
      </div>
    );
  }

  // Load context graph for company context
  const contextGraph = await loadContextGraph(companyId);

  // Extract company context for the left panel
  // Uses 'identity' domain which contains business fundamentals
  const companyContext = {
    businessName: contextGraph?.identity?.businessName?.value || company.name,
    domain: company.website || null,
    industry: contextGraph?.identity?.industry?.value || null,
    icpDescription: contextGraph?.identity?.icpDescription?.value || null,
    geographicFootprint: contextGraph?.identity?.geographicFootprint?.value || null,
    marketMaturity: contextGraph?.identity?.marketMaturity?.value || null,
    revenueModel: contextGraph?.identity?.revenueModel?.value || null,
    primaryOffers: contextGraph?.productOffer?.productLines?.value || [],
  };

  // Extract existing competitors from context graph
  const existingCompetitors = contextGraph?.competitive?.competitors?.value || [];

  return (
    <CompetitionClient
      companyId={companyId}
      companyName={company.name}
      companyContext={companyContext}
      existingCompetitors={existingCompetitors}
    />
  );
}
