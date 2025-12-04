// app/c/[companyId]/qbr/priorities/page.tsx
// QBR Priorities Page - Placeholder

import { Metadata } from 'next';
import { ListOrdered, Flag, CheckCircle2, Circle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Priorities - QBR',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QbrPrioritiesPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Coming Soon Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mb-6">
            <ListOrdered className="w-8 h-8 text-amber-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            Quarterly Priorities Coming Soon
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Define, rank, and track strategic priorities for the quarter. Connect priorities to work items and measure progress.
          </p>

          <div className="w-full space-y-3">
            <PriorityPreview
              rank={1}
              title="Launch new product landing page"
              status="in_progress"
              progress={65}
            />
            <PriorityPreview
              rank={2}
              title="Expand Google Ads to new markets"
              status="in_progress"
              progress={30}
            />
            <PriorityPreview
              rank={3}
              title="Implement email automation flow"
              status="not_started"
              progress={0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityPreview({
  rank,
  title,
  status,
  progress,
}: {
  rank: number;
  title: string;
  status: 'completed' | 'in_progress' | 'not_started';
  progress: number;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-amber-400">{rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{title}</div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'completed' ? 'bg-green-500' : status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="flex-shrink-0">
        {status === 'completed' ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : status === 'in_progress' ? (
          <Flag className="w-5 h-5 text-amber-400" />
        ) : (
          <Circle className="w-5 h-5 text-slate-500" />
        )}
      </div>
    </div>
  );
}
