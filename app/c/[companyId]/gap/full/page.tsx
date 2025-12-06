// app/c/[companyId]/gap/full/page.tsx
// Full GAP OS Orchestrator - Server Component
//
// Displays the structured orchestrator results:
// - Context delta summary (before vs after)
// - Labs run with status and refined fields
// - GAP dimension scores
// - Top insights from the run
// - Link to snapshot/QBR

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { FullGAPOrchestratorClient } from './FullGAPOrchestratorClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Full GAP Orchestrator',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function FullGAPOrchestratorPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            Full GAP Orchestrator
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Context-first analysis that runs Labs, fills gaps, and extracts insights
          </p>
        </div>
      </div>

      {/* Client component for interactive features */}
      <FullGAPOrchestratorClient
        companyId={companyId}
        companyName={company.name}
      />
    </div>
  );
}
