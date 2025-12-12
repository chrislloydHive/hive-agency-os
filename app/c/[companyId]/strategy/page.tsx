// app/c/[companyId]/strategy/page.tsx
// Strategy Workspace Page
//
// Single place to define, edit, and finalize a marketing strategy
// with AI-assisted pillar generation.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import { StrategyWorkspaceClient } from './StrategyWorkspaceClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function StrategyPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, strategy, context] = await Promise.all([
    getCompanyById(companyId),
    getActiveStrategy(companyId),
    getCompanyContext(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <StrategyWorkspaceClient
        companyId={companyId}
        companyName={company.name}
        initialStrategy={strategy}
        contextObjectives={context?.objectives || []}
      />
    </div>
  );
}
