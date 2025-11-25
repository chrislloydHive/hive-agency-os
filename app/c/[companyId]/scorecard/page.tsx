import { getOSScorecard } from '@/lib/os/mockData';

export default async function ScorecardPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const scorecard = await getOSScorecard(companyId);

  if (!scorecard || scorecard.history.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
        <p className="text-gray-400">No scorecard data available yet for this company.</p>
      </div>
    );
  }

  // Sort by date (most recent first)
  const sortedHistory = [...scorecard.history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate trends for the last 2 entries
  const getTrend = (metric: 'overallScore' | 'traffic' | 'leads') => {
    if (sortedHistory.length < 2) return null;
    const recent = sortedHistory.slice(0, 2);
    const current = recent[0][metric];
    const previous = recent[1][metric];
    if (current === undefined || previous === undefined) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  const scoreTrend = getTrend('overallScore');
  const trafficTrend = getTrend('traffic');
  const leadsTrend = getTrend('leads');

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'neutral' | null }) => {
    if (!trend) return null;

    if (trend === 'up') {
      return (
        <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    }

    if (trend === 'down') {
      return (
        <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }

    return (
      <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
          <div className="text-sm text-gray-400 mb-1">Overall Score</div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-bold text-amber-400">
              {sortedHistory[0].overallScore ?? '—'}
            </div>
            <TrendIcon trend={scoreTrend} />
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
          <div className="text-sm text-gray-400 mb-1">Traffic</div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-bold text-amber-400">
              {sortedHistory[0].traffic?.toLocaleString() ?? '—'}
            </div>
            <TrendIcon trend={trafficTrend} />
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6">
          <div className="text-sm text-gray-400 mb-1">Leads</div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-bold text-amber-400">
              {sortedHistory[0].leads?.toLocaleString() ?? '—'}
            </div>
            <TrendIcon trend={leadsTrend} />
          </div>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-4 bg-[#050509] border-b border-gray-700 sm:px-6">
          <h3 className="text-lg font-semibold text-gray-200">Historical Data</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-[#050509]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Overall Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Traffic
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Leads
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sm:px-6">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedHistory.map((entry, idx) => (
                <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 sm:px-6">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-amber-400 sm:px-6">
                    {entry.overallScore ?? '—'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 sm:px-6">
                    {entry.traffic?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 sm:px-6">
                    {entry.leads?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-400 sm:px-6">
                    {entry.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-sm text-gray-400">
          Scorecard data is collected monthly to track progress over time. Metrics include
          overall diagnostic score, website traffic, and qualified leads.
        </p>
      </div>
    </div>
  );
}
