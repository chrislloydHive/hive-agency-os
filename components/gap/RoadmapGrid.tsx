'use client';

import { type StrategicInitiative, type QuickWin, categorizeByDays } from '@/lib/gap/client';

interface RoadmapGridProps {
  initiatives: StrategicInitiative[];
  timeline?: {
    immediate?: Array<QuickWin | StrategicInitiative>;
    shortTerm?: Array<QuickWin | StrategicInitiative>;
    mediumTerm?: Array<StrategicInitiative>;
    longTerm?: Array<StrategicInitiative>;
  };
}

export default function RoadmapGrid({ initiatives, timeline }: RoadmapGridProps) {
  // Use timeline data if available, otherwise fall back to categorizing by days
  let buckets: {
    '0-30': Array<QuickWin | StrategicInitiative>;
    '30-60': Array<QuickWin | StrategicInitiative>;
    '60-90': Array<StrategicInitiative>;
    '90+': Array<StrategicInitiative>;
  };

  if (timeline) {
    // Map timeline buckets to day buckets
    buckets = {
      '0-30': timeline.immediate || [],
      '30-60': timeline.shortTerm || [],
      '60-90': timeline.mediumTerm || [],
      '90+': timeline.longTerm || [],
    };
  } else {
    // Fallback: categorize initiatives by parsing duration
    const categorized = categorizeByDays(initiatives);
    buckets = {
      '0-30': categorized['0-30'],
      '30-60': categorized['30-60'],
      '60-90': categorized['60-90'],
      '90+': categorized['90+'],
    };
  }

  const bucketLabels = {
    '0-30': '0-30 Days',
    '30-60': '30-60 Days',
    '60-90': '60-90 Days',
    '90+': '90+ Days',
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-700';
      case 'medium':
        return 'border-yellow-700';
      case 'low':
        return 'border-green-700';
      default:
        return 'border-gray-700';
    }
  };

  const getImpactBadgeColor = (impact: string) => {
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
      <h2 className="text-2xl font-semibold text-gray-100 mb-6">Strategic Roadmap</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(buckets).map(([key, items]) => (
          <div key={key} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-4 pb-2 border-b border-gray-700">
              {bucketLabels[key as keyof typeof bucketLabels]}
            </h3>
            <div className="space-y-4">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No initiatives</p>
              ) : (
                items.map((item) => {
                  // Handle both QuickWin and StrategicInitiative types
                  const isQuickWin = 'quickWinReason' in item;
                  const title = item.title;
                  const description = item.description;
                  const priority = item.priority;
                  const impact = item.impact;
                  const duration = isQuickWin 
                    ? (item as QuickWin).expectedTimeline 
                    : (item as StrategicInitiative).totalDuration || (item as StrategicInitiative).estimatedEffort;
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded border ${getPriorityColor(
                        priority
                      )} bg-gray-900/50`}
                    >
                      <h4 className="text-sm font-semibold text-gray-100 mb-2">
                        {title}
                      </h4>
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                        {description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getImpactBadgeColor(
                            impact
                          )}`}
                        >
                          {impact}
                        </span>
                        {duration && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                            {duration}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

