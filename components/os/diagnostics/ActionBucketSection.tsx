// components/os/diagnostics/ActionBucketSection.tsx
// Action Bucket Section (Now / Next / Later)

'use client';

import type { DiagnosticAction } from '@/lib/diagnostics/types';
import { ActionCard } from './ActionCard';

type Props = {
  title: string;
  subtitle: string;
  actions: DiagnosticAction[];
  originalCount: number;
  onSendToWork?: (actionId: string) => void;
  defaultOpen: boolean;
};

export function ActionBucketSection({
  title,
  subtitle,
  actions,
  originalCount,
  onSendToWork,
  defaultOpen,
}: Props) {
  const hasFilters = actions.length !== originalCount;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">
          {title}
          <span className="ml-2 text-lg font-normal text-slate-400">
            ({actions.length} {hasFilters && `of ${originalCount}`} items)
          </span>
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-400">{subtitle}</p>

      {defaultOpen ? (
        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
              {hasFilters ? 'No items match the current filters' : 'No actions in this bucket'}
            </div>
          ) : (
            actions.map((action) => (
              <ActionCard key={action.id} action={action} onSendToWork={onSendToWork} />
            ))
          )}
        </div>
      ) : (
        <details className="group">
          <summary className="mb-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300">
            {actions.length > 0 ? '▶ Show items' : 'No items'}
          </summary>
          <div className="space-y-3">
            {actions.map((action) => (
              <ActionCard key={action.id} action={action} onSendToWork={onSendToWork} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
