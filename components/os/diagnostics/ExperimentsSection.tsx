// components/os/diagnostics/ExperimentsSection.tsx
// Experiments Section Component

'use client';

import type { ExperimentIdea } from '@/lib/diagnostics/types';

type Props = {
  experiments: ExperimentIdea[];
};

export function ExperimentsSection({ experiments }: Props) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold text-slate-100">
        Suggested Experiments
        <span className="ml-2 text-lg font-normal text-slate-400">
          ({experiments.length})
        </span>
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        A/B tests to validate hypotheses and measure impact
      </p>
      <details className="group">
        <summary className="mb-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300">
          ▶ Show experiments
        </summary>
        <div className="space-y-3">
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
            >
              <h3 className="mb-2 text-sm font-semibold text-slate-100">{exp.hypothesis}</h3>
              <p className="mb-2 text-xs leading-relaxed text-slate-300">{exp.description}</p>
              <div className="flex gap-4 text-xs text-slate-400">
                <span>
                  Metric: <span className="font-medium text-slate-300">{exp.metric}</span>
                </span>
                {exp.expectedLift && (
                  <>
                    <span>•</span>
                    <span>
                      Expected: <span className="font-medium text-green-400">+{exp.expectedLift}%</span>
                    </span>
                  </>
                )}
                <span>•</span>
                <span>
                  Effort: <span className="font-medium text-slate-300">{exp.effortScore}/5</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
