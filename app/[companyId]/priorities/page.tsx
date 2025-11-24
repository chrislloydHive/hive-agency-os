import { getOSPriorities } from '@/lib/os/mockData';
import {
  getLatestOsResultForCompany,
  getLatestOsFullReportForCompany
} from '@/lib/airtable/fullReports';
import { AddToWorkButton } from './AddToWorkButton';

export default async function PrioritiesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  // v2: Fetch from OS diagnostic result
  const osResult = await getLatestOsResultForCompany(companyId);
  const realPriorities = osResult?.priorities || [];

  // Also fetch the Full Report record to get its ID for work items
  const fullReport = await getLatestOsFullReportForCompany(companyId);
  const fullReportId = fullReport?.id;

  // Fallback to mock data if no real data available
  const mockPriorities = realPriorities.length === 0 ? await getOSPriorities(companyId) : [];
  const priorities = realPriorities.length > 0 ? realPriorities : mockPriorities;

  if (priorities.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <p className="text-gray-400">
          No priorities available yet for this company.
        </p>
      </div>
    );
  }

  // Convert impact/effort to numbers for sorting (v2 uses string enums)
  const impactToNum = (impact: string | number) => {
    if (typeof impact === 'number') return impact;
    return impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
  };

  const effortToNum = (effort: string | number) => {
    if (typeof effort === 'number') return effort;
    return effort === 'high' ? 3 : effort === 'medium' ? 2 : 1;
  };

  // Sort by impact (descending), then effort (ascending)
  const sortedPriorities = [...priorities].sort(
    (a, b) =>
      impactToNum(b.impact) - impactToNum(a.impact) ||
      effortToNum(a.effort) - effortToNum(b.effort)
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'website':
        return 'bg-blue-500/20 text-blue-300';
      case 'brand':
        return 'bg-purple-500/20 text-purple-300';
      case 'content':
        return 'bg-green-500/20 text-green-300';
      case 'seo':
        return 'bg-orange-500/20 text-orange-300';
      case 'funnel':
        return 'bg-pink-500/20 text-pink-300';
      case 'strategy':
        return 'bg-indigo-500/20 text-indigo-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300';
      case 'not_started':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-4 bg-[#050509] border-b border-gray-700 sm:px-6">
          <h3 className="text-lg font-semibold text-gray-200">
            All Priorities ({sortedPriorities.length})
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Sorted by impact (high to low), then effort (low to high)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-[#050509]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Impact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Effort
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedPriorities.map((priority) => (
                <tr key={priority.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-4 sm:px-6">
                    <div className="text-sm font-medium text-gray-200">
                      {priority.title}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {priority.description}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                        ('category' in priority ? priority.category : 'general') || 'general'
                      )}`}
                    >
                      {'category' in priority ? priority.category : 'general'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-green-400">
                        {priority.impact}
                      </div>
                      <div className="text-xs text-gray-500 ml-1">/ 10</div>
                    </div>
                    <div className="w-16 bg-[#050509] rounded-full h-1.5 mt-1">
                      <div
                        className="bg-green-500 h-1.5 rounded-full"
                        style={{ width: `${impactToNum(priority.impact) * 10}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-orange-400">
                        {priority.effort}
                      </div>
                      <div className="text-xs text-gray-500 ml-1">/ 10</div>
                    </div>
                    <div className="w-16 bg-[#050509] rounded-full h-1.5 mt-1">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full"
                        style={{ width: `${effortToNum(priority.effort) * 10}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        ('status' in priority ? priority.status : 'pending') || 'pending'
                      )}`}
                    >
                      {('status' in priority ? priority.status : 'pending').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap sm:px-6 text-right">
                    <AddToWorkButton
                      companyId={companyId}
                      fullReportId={fullReportId}
                      priority={priority}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-300">
              <strong>Impact:</strong> Potential business impact if completed (1-10, higher is
              better). <strong>Effort:</strong> Time and resources required (1-10, lower is
              easier). Priorities with high impact and low effort should be prioritized first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
