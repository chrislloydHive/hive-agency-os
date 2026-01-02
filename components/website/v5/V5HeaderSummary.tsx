'use client';
// components/website/v5/V5HeaderSummary.tsx
// V5 Header Summary - Score, verdict, justification, and quick stats

import type { V5DiagnosticOutput, V5Verdict } from '@/lib/types/websiteLabV5';
import { deriveVerdict, VERDICT_CONFIG } from '@/lib/types/websiteLabV5';

type Props = {
  output: V5DiagnosticOutput;
};

function ScoreGauge({ score, verdict }: { score: number; verdict: V5Verdict }) {
  const config = VERDICT_CONFIG[verdict];

  // Calculate stroke dasharray for the circular progress
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-700"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={config.color}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${config.color}`}>{score}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

export function V5HeaderSummary({ output }: Props) {
  const verdict = deriveVerdict(output.score);
  const config = VERDICT_CONFIG[verdict];

  // Calculate stats
  const highIssues = output.blockingIssues.filter(i => i.severity === 'high').length;
  const mediumIssues = output.blockingIssues.filter(i => i.severity === 'medium').length;
  const totalIssues = output.blockingIssues.length;
  const quickWinsCount = output.quickWins.length;
  const structuralCount = output.structuralChanges.length;
  const failedJourneys = output.personaJourneys.filter(j => !j.succeeded).length;
  const totalJourneys = output.personaJourneys.length;

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/30 overflow-hidden">
      {/* Top section - Score and Verdict */}
      <div className="p-6 flex items-start gap-6">
        {/* Score gauge */}
        <ScoreGauge score={output.score} verdict={verdict} />

        {/* Verdict and justification */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${config.bgColor} ${config.color}`}>
              {config.label}
            </span>
            <span className="text-sm text-slate-500">
              Website Conversion Readiness
            </span>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            {output.scoreJustification}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Blocking Issues"
            value={totalIssues}
            color={totalIssues > 0 ? (highIssues > 0 ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}
          />
          <StatCard
            label="High Severity"
            value={highIssues}
            color={highIssues > 0 ? 'text-red-400' : 'text-slate-400'}
          />
          <StatCard
            label="Quick Wins"
            value={quickWinsCount}
            color="text-emerald-400"
          />
          <StatCard
            label="Structural Changes"
            value={structuralCount}
            color="text-indigo-400"
          />
          <StatCard
            label="Failed Journeys"
            value={failedJourneys}
            color={failedJourneys > 0 ? 'text-red-400' : 'text-emerald-400'}
          />
        </div>
      </div>

      {/* Pages analyzed footer */}
      <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
        <span>
          {output.observations.length} pages analyzed
        </span>
        <span>
          {totalJourneys} persona journeys simulated
        </span>
      </div>
    </div>
  );
}
