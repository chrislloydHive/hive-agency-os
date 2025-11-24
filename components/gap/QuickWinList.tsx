'use client';

import { type QuickWin } from '@/lib/gap/client';

interface QuickWinListProps {
  quickWins: QuickWin[];
}

export default function QuickWinList({ quickWins }: QuickWinListProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400 border-red-700';
      case 'medium':
        return 'text-yellow-400 border-yellow-700';
      case 'low':
        return 'text-green-400 border-green-700';
      default:
        return 'text-gray-400 border-gray-700';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500/20 text-red-300';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'low':
        return 'bg-green-500/20 text-green-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-100 mb-6">Quick Wins</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickWins.map((quickWin) => (
          <div
            key={quickWin.id}
            className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-100 flex-1">
                {quickWin.title}
              </h3>
              <span
                className={`ml-2 px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(
                  quickWin.priority
                )}`}
              >
                {quickWin.priority}
              </span>
            </div>

            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
              {quickWin.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getImpactColor(
                  quickWin.impact
                )}`}
              >
                Impact: {quickWin.impact}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300">
                Effort: {quickWin.resourceRequirement}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300">
                {quickWin.expectedTimeline}
              </span>
            </div>

            {quickWin.expectedOutcome && (
              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Expected Outcome</p>
                <p className="text-sm text-gray-300">{quickWin.expectedOutcome}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

