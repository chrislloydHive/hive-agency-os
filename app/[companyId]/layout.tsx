import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getLatestOsFullReportForCompany,
  parseFullReportToOsResult,
} from '@/lib/airtable/fullReports';
import CompanyTabs from '@/components/os/CompanyTabs';

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  
  // Get latest OS Full Report to derive score
  const latestReport = company ? await getLatestOsFullReportForCompany(companyId) : null;
  const osResult = latestReport ? parseFullReportToOsResult(latestReport) : null;
  const overallScore = osResult?.overallScore ? Math.round(osResult.overallScore * 10) : undefined;

  if (!company) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-200 mb-2">Company not found</h2>
        <p className="text-gray-400 mb-4">
          The company &quot;{companyId}&quot; does not exist.
        </p>
        <Link href="/os" className="text-blue-400 hover:text-blue-300 transition-colors">
          ← Back to companies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link
          href="/os"
          className="text-sm text-gray-400 hover:text-gray-300 mb-3 inline-block transition-colors"
        >
          ← Back to companies
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-100 sm:text-2xl">{company.name}</h2>
            <a
              href={company.website || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {company.website}
            </a>
          </div>
          {overallScore !== undefined && (
            <div className="text-left sm:text-right">
              <div className="text-sm text-gray-400">Overall Score</div>
              <div className="text-3xl font-bold text-amber-400">
                {overallScore}
              </div>
            </div>
          )}
        </div>
      </div>

      <CompanyTabs companyId={companyId} />

      {children}
    </div>
  );
}
