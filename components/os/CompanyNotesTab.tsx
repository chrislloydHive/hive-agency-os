// components/os/CompanyNotesTab.tsx
// Notes/Activity tab for company detail page - shows timeline of activity

import type { CompanyRecord } from '@/lib/airtable/companies';
import type { WorkItemRecord } from '@/lib/airtable/workItems';

interface CompanyNotesTabProps {
  company: CompanyRecord;
  gapIaRuns: any[];
  gapPlanRuns: any[];
  workItems: WorkItemRecord[];
}

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

export function CompanyNotesTab({
  company,
  gapIaRuns,
  gapPlanRuns,
  workItems,
}: CompanyNotesTabProps) {
  // Build timeline from all activities
  type TimelineItem = {
    type: 'gap-ia' | 'gap-plan' | 'work' | 'note';
    title: string;
    subtitle?: string;
    timestamp: string;
    status?: string;
  };

  const timeline: TimelineItem[] = [];

  // Add GAP IA runs
  gapIaRuns.forEach((run) => {
    timeline.push({
      type: 'gap-ia',
      title: 'GAP Assessment',
      subtitle: run.status === 'completed' ? `Score: ${run.overallScore || '—'}` : undefined,
      timestamp: run.createdAt,
      status: run.status,
    });
  });

  // Add GAP Plan runs
  gapPlanRuns.forEach((plan) => {
    timeline.push({
      type: 'gap-plan',
      title: 'Growth Plan Generated',
      subtitle: plan.maturityStage,
      timestamp: plan.createdAt,
      status: plan.status,
    });
  });

  // Add work items
  workItems.forEach((item) => {
    timeline.push({
      type: 'work',
      title: item.title,
      subtitle: item.area,
      timestamp: item.createdAt || '',
      status: item.status,
    });
  });

  // Sort by timestamp (newest first)
  timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Internal Notes */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Internal Notes
        </h3>
        {company.internalNotes || company.notes ? (
          <div className="text-sm text-slate-300 whitespace-pre-wrap">
            {company.internalNotes || company.notes}
          </div>
        ) : (
          <div className="text-sm text-slate-500 py-4 text-center">
            No notes yet. Add notes from the company settings.
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Activity Timeline
        </h3>
        {timeline.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            No activity yet
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.slice(0, 20).map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      item.type === 'gap-ia'
                        ? 'bg-amber-500'
                        : item.type === 'gap-plan'
                        ? 'bg-purple-500'
                        : 'bg-blue-500'
                    }`}
                  />
                  {index < timeline.length - 1 && (
                    <div className="w-px h-full bg-slate-800 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200">{item.title}</span>
                    {item.status && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.status === 'completed' || item.status === 'Done'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.subtitle}
                    </div>
                  )}
                  <div className="text-xs text-slate-600 mt-1">
                    {formatDate(item.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
