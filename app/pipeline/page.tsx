// app/pipeline/page.tsx
// Pipeline Dashboard - KPIs and charts overview

import { getAllOpportunities } from '@/lib/airtable/opportunities';
import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { computePipelineKpis, calculateWinRate, calculateAverageDealSize } from '@/lib/pipeline/kpis';
import { PipelineDashboardClient } from './PipelineDashboardClient';

export const dynamic = 'force-dynamic';

export default async function PipelineDashboardPage() {
  const [opportunities, leads] = await Promise.all([
    getAllOpportunities(),
    getAllInboundLeads(),
  ]);

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
              Overview of opportunities, leads, and pipeline health
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
      />
    </div>
  );
}
