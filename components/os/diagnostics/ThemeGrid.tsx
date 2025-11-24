// components/os/diagnostics/ThemeGrid.tsx
// Theme Grid Component

'use client';

import type { DiagnosticTheme } from '@/lib/diagnostics/types';

type Props = {
  themes: DiagnosticTheme[];
};

export function ThemeGrid({ themes }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {themes.slice(0, 6).map((theme) => (
        <div key={theme.id} className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">{theme.label}</h3>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                theme.priority === 'critical'
                  ? 'bg-red-600/20 text-red-400'
                  : theme.priority === 'important'
                  ? 'bg-yellow-600/20 text-yellow-400'
                  : 'bg-slate-600/20 text-slate-400'
              }`}
            >
              {theme.priority}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">{theme.description}</p>
          {theme.expectedImpactSummary && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              💡 {theme.expectedImpactSummary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
