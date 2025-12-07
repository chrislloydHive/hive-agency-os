// app/c/[companyId]/brain/labs/competition/page.tsx
// Competition Lab V4 - Server Component Entry Point (under Brain → Labs)
//
// V4 Features:
// - Strategist View (default): AI-generated strategic intelligence
// - Data View: Full V3 positioning map and competitor list
// - Tabs for switching between views

import { getCompanyById } from '@/lib/airtable/companies';
import { CompetitionLabV4 } from '@/components/competition/CompetitionLabV4';
import Link from 'next/link';

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function CompetitionLabPage({ params }: Props) {
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

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-500">
        Brain &rarr; Labs &rarr; Competition Lab
      </div>

      <CompetitionLabV4
        companyId={companyId}
        companyName={company.name}
      />
    </div>
  );
}
