// components/qbr/QBRNextActions.tsx
// QBR Story View - What's Next Component
//
// Displays 30/60/90 day roadmap and top work items.

import type { WhatsNext } from '@/lib/os/qbr';

interface QBRNextActionsProps {
  data: WhatsNext;
}

export function QBRNextActions({ data }: QBRNextActionsProps) {
  const hasRoadmap = data.days30.length > 0 || data.days60.length > 0 || data.days90.length > 0;
  const hasWorkItems = data.topWorkItems.length > 0;

  if (!hasRoadmap && !hasWorkItems) {
    return (
      <div className="py-6 text-center text-slate-500 italic border border-dashed border-slate-200 rounded-lg">
        No execution plan available. Run Execution Lab to generate roadmap.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 30/60/90 Day Roadmap */}
      {hasRoadmap && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Execution Roadmap
          </h3>
          <div className="grid md:grid-cols-3 gap-6 print:grid-cols-3">
            {/* Days 1-30 */}
            <RoadmapColumn
              title="Days 1-30"
              subtitle="Immediate Focus"
              items={data.days30}
              accentColor="emerald"
            />

            {/* Days 31-60 */}
            <RoadmapColumn
              title="Days 31-60"
              subtitle="Build Momentum"
              items={data.days60}
              accentColor="amber"
            />

            {/* Days 61-90 */}
            <RoadmapColumn
              title="Days 61-90"
              subtitle="Scale & Optimize"
              items={data.days90}
              accentColor="blue"
            />
          </div>
        </div>
      )}

      {/* Top Work Items */}
      {hasWorkItems && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Active Work Items
          </h3>
          <div className="space-y-3">
            {data.topWorkItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <span className="text-slate-800">{item.title}</span>
                <div className="flex items-center gap-3">
                  {item.priority && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : item.priority === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.priority}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : item.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface RoadmapColumnProps {
  title: string;
  subtitle: string;
  items: string[];
  accentColor: 'emerald' | 'amber' | 'blue';
}

function RoadmapColumn({ title, subtitle, items, accentColor }: RoadmapColumnProps) {
  const colors = {
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      bullet: 'text-emerald-500',
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      bullet: 'text-amber-500',
    },
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      bullet: 'text-blue-500',
    },
  };

  const c = colors[accentColor];

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-4`}>
      <div className="mb-3">
        <div className={`font-semibold ${c.text}`}>{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className={`${c.bullet} mt-1`}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 italic">No items defined</p>
      )}
    </div>
  );
}
