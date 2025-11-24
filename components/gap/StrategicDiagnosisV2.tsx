// components/gap/StrategicDiagnosisV2.tsx
'use client';

import type { GrowthAccelerationPlan } from '@/lib/growth-plan/types';

interface StrategicDiagnosisV2Props {
  plan: GrowthAccelerationPlan;
}

export function StrategicDiagnosisV2({ plan }: StrategicDiagnosisV2Props) {
  const { strategicDiagnosis } = plan;

  // Defensive check - render nothing if no V2 data
  if (!strategicDiagnosis) {
    return null;
  }

  const { growthBottleneck, bottleneckCategory, whyThisMatters, primaryIcp, secondaryIcp } = strategicDiagnosis;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
      <h3 className="text-2xl font-bold text-slate-100 mb-6">Strategic Diagnosis</h3>

      {/* Growth Bottleneck */}
      <div className="mb-6 bg-red-950/20 border border-red-900/50 rounded-lg p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">🚧</span>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-red-400 mb-1">Growth Bottleneck</h4>
            <span className="inline-block text-xs px-2 py-1 bg-red-900/40 text-red-300 rounded border border-red-800/50 mb-2">
              {bottleneckCategory}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-300 mb-3">{growthBottleneck}</p>
        <div className="bg-red-950/40 border border-red-900/30 rounded-md p-3">
          <p className="text-xs text-red-200/80">
            <span className="font-semibold">Why this matters:</span> {whyThisMatters}
          </p>
        </div>
      </div>

      {/* Primary ICP */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">🎯</span>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-blue-400 mb-1">Ideal Customer Profile</h4>
            <span className="inline-block text-xs px-2 py-1 bg-blue-900/40 text-blue-300 rounded border border-blue-800/50 mb-2">
              Primary Audience
            </span>
          </div>
        </div>

        <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-5">
          <h5 className="font-semibold text-slate-100 mb-2">{primaryIcp.label}</h5>
          <p className="text-sm text-slate-300 mb-4">{primaryIcp.description}</p>

          {/* Key Pain Points */}
          <div className="mb-4">
            <h6 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Key Pain Points
            </h6>
            <ul className="space-y-1.5">
              {primaryIcp.keyPainPoints.map((pain, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{pain}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Objections */}
          <div>
            <h6 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Key Objections
            </h6>
            <ul className="space-y-1.5">
              {primaryIcp.keyObjections.map((objection, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{objection}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Secondary ICP (if present) */}
      {secondaryIcp && (
        <div>
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <span className="inline-block text-xs px-2 py-1 bg-purple-900/40 text-purple-300 rounded border border-purple-800/50 mb-2">
                Secondary Audience
              </span>
            </div>
          </div>

          <div className="bg-purple-950/20 border border-purple-900/50 rounded-lg p-5">
            <h5 className="font-semibold text-slate-100 mb-2">{secondaryIcp.label}</h5>
            <p className="text-sm text-slate-300">{secondaryIcp.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
