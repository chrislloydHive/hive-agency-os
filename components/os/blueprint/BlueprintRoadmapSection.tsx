// components/os/blueprint/BlueprintRoadmapSection.tsx
// 90-Day Roadmap section: Now / Next / Later
// Visual roadmap timeline with action items

'use client';

import type { StrategySynthesis } from './types';

interface BlueprintRoadmapSectionProps {
  strategySynthesis: StrategySynthesis | null;
  companyId: string;
  className?: string;
}

interface RoadmapPhase {
  title: string;
  subtitle: string;
  items: string[];
  color: 'emerald' | 'amber' | 'blue';
}

const phaseColors = {
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    headerBg: 'bg-emerald-500/10',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    line: 'bg-emerald-500/30',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    headerBg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    line: 'bg-amber-500/30',
  },
  blue: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    headerBg: 'bg-blue-500/10',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    line: 'bg-blue-500/30',
  },
};

function RoadmapPhaseCard({ phase }: { phase: RoadmapPhase }) {
  const colors = phaseColors[phase.color];

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-2.5 ${colors.headerBg}`}>
        <div className="flex items-center justify-between">
          <h4 className={`text-sm font-semibold ${colors.text}`}>{phase.title}</h4>
          <span className="text-[10px] text-slate-500">{phase.subtitle}</span>
        </div>
      </div>

      {/* Items */}
      <div className="p-4">
        {phase.items.length > 0 ? (
          <ul className="space-y-2.5">
            {phase.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${colors.dot} mt-1.5`} />
                <span className="text-sm text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">No items planned for this phase.</p>
        )}
      </div>
    </div>
  );
}

function EmptyRoadmapState() {
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 border-dashed p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <span className="text-sm font-medium text-slate-400">No Roadmap Yet</span>
      </div>
      <p className="text-xs text-slate-500">
        Run diagnostics to generate a personalized 90-day roadmap.
      </p>
    </div>
  );
}

export function BlueprintRoadmapSection({
  strategySynthesis,
  companyId,
  className = '',
}: BlueprintRoadmapSectionProps) {
  if (!strategySynthesis?.ninetyDayPlan) {
    return <EmptyRoadmapState />;
  }

  const { ninetyDayPlan } = strategySynthesis;
  const hasContent = ninetyDayPlan.now.length > 0 || ninetyDayPlan.next.length > 0 || ninetyDayPlan.later.length > 0;

  if (!hasContent) {
    return <EmptyRoadmapState />;
  }

  const phases: RoadmapPhase[] = [
    {
      title: 'Now',
      subtitle: 'Week 1-2',
      items: ninetyDayPlan.now,
      color: 'emerald',
    },
    {
      title: 'Next',
      subtitle: 'Week 3-6',
      items: ninetyDayPlan.next,
      color: 'amber',
    },
    {
      title: 'Later',
      subtitle: 'Week 7-12',
      items: ninetyDayPlan.later,
      color: 'blue',
    },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      {phases.map((phase) => (
        <RoadmapPhaseCard key={phase.title} phase={phase} />
      ))}
    </div>
  );
}
