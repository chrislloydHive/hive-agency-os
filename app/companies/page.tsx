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
  lastGapDate: Date | null,
  latestScore: number | null
): 'Healthy' | 'Watch' | 'At Risk' | null {
  // Only calculate health for Clients
  if (company.stage !== 'Client') return null;

  // Critical: No GAP ever or very low score
  if (!lastGapDate) return 'At Risk';
  if (latestScore !== null && latestScore < 40) return 'At Risk';

  const now = new Date();
  const daysSinceGap = Math.floor((now.getTime() - lastGapDate.getTime()) / (1000 * 60 * 60 * 24));

  // At risk: No activity in 90+ days
  if (daysSinceGap > 90) return 'At Risk';

  // Watch: No activity in 60+ days or low score
  if (daysSinceGap > 60) return 'Watch';
  if (latestScore !== null && latestScore < 60) return 'Watch';

  return 'Healthy';
}

export default async function CompaniesPage() {
  // Fetch companies and recent GAP runs in parallel
  const [companies, gapRuns] = await Promise.all([
    listCompaniesForOs(200),
    listRecentGapIaRuns(500), // Get more runs to find last activity per company
  ]);

  // Build maps for company -> last GAP date and score
  const lastGapByCompany = new Map<string, { date: Date; score: number | null }>();
  for (const run of gapRuns) {
    if (run.companyId && run.createdAt) {
      const runDate = new Date(run.createdAt);
      const existing = lastGapByCompany.get(run.companyId);
      if (!existing || runDate > existing.date) {
        // Get score from summary (v2+) or null
        const score = run.summary?.overallScore ?? null;
        lastGapByCompany.set(run.companyId, {
          date: runDate,
          score,
        });
      }
    }
  }

  // Enrich companies with health status, last activity, and score
  const enrichedCompanies = companies.map((company) => {
    const gapData = lastGapByCompany.get(company.id);
    const lastGapDate = gapData?.date || null;
    const latestScore = gapData?.score ?? null;
    const healthStatus = calculateHealthStatus(company, lastGapDate, latestScore);

    return {
      ...company,
      healthStatus,
      lastActivityDate: lastGapDate?.toISOString() || null,
      latestOverallScore: latestScore,
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
          Manage your client roster. Track health, scores, and prioritize who needs attention.
        </p>
      </div>

      <CompaniesRosterClient
        companies={enrichedCompanies}
        defaultView={defaultView}
      />
    </div>
  );
}
