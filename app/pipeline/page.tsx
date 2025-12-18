// app/pipeline/page.tsx
// Pipeline Dashboard - KPIs and charts overview

import { getAllOpportunities } from '@/lib/airtable/opportunities';
import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { computePipelineKpis, calculateWinRate, calculateAverageDealSize } from '@/lib/pipeline/kpis';
import { PipelineDashboardClient } from './PipelineDashboardClient';
import type { OpportunityItem } from '@/lib/types/pipeline';

export const dynamic = 'force-dynamic';

// Helper to filter overdue opportunities client-side
function filterOverdueOpportunities(opportunities: OpportunityItem[], limit = 5) {
  const today = new Date().toISOString().split('T')[0];
  const openStages = ['discovery', 'qualification', 'proposal', 'negotiation'];

  const overdue = opportunities
    .filter((opp) => {
      if (!opp.nextStepDue) return false;
      if (opp.nextStepDue >= today) return false;
      return openStages.includes(opp.stage);
    })
    .sort((a, b) => (a.nextStepDue || '').localeCompare(b.nextStepDue || ''));

  return {
    overdueOpps: overdue.slice(0, limit),
    overdueCount: overdue.length,
  };
}

export default async function PipelineDashboardPage() {
  const [opportunities, leads] = await Promise.all([
    getAllOpportunities(),
    getAllInboundLeads(),
  ]);

  // Filter overdue from already-fetched opportunities (avoids extra API calls)
  const { overdueOpps, overdueCount } = filterOverdueOpportunities(opportunities);

  const kpis = computePipelineKpis(opportunities, leads);
  const winRate = calculateWinRate(opportunities);
  const avgDealSize = calculateAverageDealSize(opportunities);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Pipeline Dashboard</h1>
            <p className="text-slate-400 mt-1">
              At-a-glance health check for your pipeline
            </p>
          </div>
        </div>
      </div>

      <PipelineDashboardClient
        kpis={kpis}
        winRate={winRate}
        avgDealSize={avgDealSize}
        totalOpportunities={opportunities.length}
        totalLeads={leads.length}
        overdueOpportunities={overdueOpps}
        overdueCount={overdueCount}
      />
    </div>
  );
}
