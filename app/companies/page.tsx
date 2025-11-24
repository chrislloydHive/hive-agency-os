import { listCompaniesForOs } from '@/lib/airtable/companies';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { CompaniesRosterClient } from '@/components/os/CompaniesRosterClient';

/**
 * Companies page - Roster + Triage view
 *
 * Organized around decisions:
 * - Who needs attention?
 * - What's the health of each client?
 * - When was the last activity?
 */

// Calculate health status for clients
function calculateHealthStatus(
  company: { id: string; stage?: string; createdAt?: string },
  lastGapDate: Date | null
): 'Healthy' | 'Watch' | 'At Risk' | null {
  // Only calculate health for Clients
  if (company.stage !== 'Client') return null;

  if (!lastGapDate) {
    return 'At Risk'; // No GAP ever
  }

  const now = new Date();
  const daysSinceGap = Math.floor((now.getTime() - lastGapDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceGap > 90) return 'At Risk';
  if (daysSinceGap > 60) return 'Watch';
  return 'Healthy';
}

export default async function CompaniesPage() {
  // Fetch companies and recent GAP runs in parallel
  const [companies, gapRuns] = await Promise.all([
    listCompaniesForOs(200),
    listRecentGapIaRuns(500), // Get more runs to find last activity per company
  ]);

  // Build a map of company -> last GAP date
  const lastGapByCompany = new Map<string, Date>();
  for (const run of gapRuns) {
    if (run.companyId && run.createdAt) {
      const runDate = new Date(run.createdAt);
      const existing = lastGapByCompany.get(run.companyId);
      if (!existing || runDate > existing) {
        lastGapByCompany.set(run.companyId, runDate);
      }
    }
  }

  // Enrich companies with health status and last activity
  const enrichedCompanies = companies.map((company) => {
    const lastGapDate = lastGapByCompany.get(company.id) || null;
    const healthStatus = calculateHealthStatus(company, lastGapDate);

    return {
      ...company,
      healthStatus,
      lastActivityDate: lastGapDate?.toISOString() || null,
    };
  });

  // Determine default view based on data
  const hasClients = enrichedCompanies.some((c) => c.stage === 'Client');
  const defaultView = hasClients ? 'Clients' : 'All';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Companies</h1>
        <p className="text-slate-400 mt-1">
          All companies in your roster. Filter by client stage and prioritize who needs attention.
        </p>
      </div>

      <CompaniesRosterClient
        companies={enrichedCompanies}
        defaultView={defaultView}
      />
    </div>
  );
}
