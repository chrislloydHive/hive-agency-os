// app/c/[companyId]/strategy/compare/page.tsx
// Strategy Comparison Page
//
// Allows users to compare 2-4 strategies side-by-side with:
// - Objective coverage analysis
// - Decision matrix scoring
// - Pros/cons per strategy
// - Tradeoffs visualization
// - Risk assessment
// - AI-generated recommendations (conditional)

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCompanyById } from '@/lib/airtable/companies';
import { getStrategiesForCompany, getActiveStrategy } from '@/lib/os/strategy';
import { StrategyComparisonClient } from '@/components/strategy-comparison';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function StrategyComparePage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch all strategies for this company
  const [strategies, activeStrategy] = await Promise.all([
    getStrategiesForCompany(companyId),
    getActiveStrategy(companyId),
  ]);

  // Filter to non-archived strategies
  const availableStrategies = strategies.filter(s => s.status !== 'archived');

  // Need at least 2 strategies to compare
  if (availableStrategies.length < 2) {
    return (
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          href={`/c/${companyId}/strategy`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Strategy
        </Link>

        {/* Not Enough Strategies */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <h2 className="text-lg font-medium text-gray-200 mb-2">
            Not Enough Strategies
          </h2>
          <p className="text-gray-400 mb-4">
            You need at least 2 strategies to compare. Currently you have {availableStrategies.length}.
          </p>
          <Link
            href={`/c/${companyId}/strategy`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
          >
            Create More Strategies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href={`/c/${companyId}/strategy`}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Strategy
      </Link>

      {/* Comparison Client */}
      <StrategyComparisonClient
        companyId={companyId}
        companyName={company.name}
        strategies={availableStrategies}
        activeStrategyId={activeStrategy?.id || null}
      />
    </div>
  );
}
