'use client';

import { type Scorecard } from '@/lib/gap/client';

interface ScoreGaugeGroupProps {
  scorecard: Scorecard;
}

export default function ScoreGaugeGroup({ scorecard }: ScoreGaugeGroupProps) {
  const scores = [
    { label: 'Overall', value: scorecard.overall ?? 0, color: 'yellow' },
    { label: 'Website', value: scorecard.website ?? 0, color: 'blue' },
    { label: 'Content', value: scorecard.content ?? 0, color: 'green' },
    { label: 'SEO', value: scorecard.seo ?? 0, color: 'purple' },
    { label: 'Brand', value: scorecard.brand ?? 0, color: 'orange' },
    { label: 'Authority', value: scorecard.authority ?? 0, color: 'pink' },
  ].filter((s) => s.value > 0 || s.label === 'Overall');

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      yellow: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
      blue: { bg: 'bg-blue-500', text: 'text-blue-500' },
      green: { bg: 'bg-green-500', text: 'text-green-500' },
      purple: { bg: 'bg-purple-500', text: 'text-purple-500' },
      orange: { bg: 'bg-orange-500', text: 'text-orange-500' },
      pink: { bg: 'bg-pink-500', text: 'text-pink-500' },
    };
    return colors[color] || colors.yellow;
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-100 mb-6">Score Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scores.map((score) => {
          const colorClasses = getColorClasses(score.color);
          return (
            <div
              key={score.label}
              className="bg-gray-800 rounded-lg border border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-200">{score.label}</h3>
                <span className={`text-2xl font-bold ${colorClasses.text}`}>
                  {score.value}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full ${colorClasses.bg} transition-all duration-500`}
                  style={{ width: `${score.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

