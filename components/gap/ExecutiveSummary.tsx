// components/gap/ExecutiveSummary.tsx

import React from "react";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";

type Props = {
  plan: GrowthAccelerationPlan;
};

export const ExecutiveSummaryCard: React.FC<Props> = ({ plan }) => {
  const es = plan.executiveSummary ?? {};

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        GAP Executive Summary
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-yellow-400">
            {plan.companyName}
          </div>
          <div className="text-xs text-gray-400">
            {plan.websiteUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>
        {es.maturityStage && (
          <span className="inline-flex items-center rounded-full bg-gray-700 px-3 py-1 text-xs font-medium text-gray-300">
            GAP Maturity Level: {es.maturityStage}
          </span>
        )}
      </div>

      {es.narrative && (
        <p className="mb-4 text-sm leading-relaxed text-gray-300 max-w-[70ch]">
          {es.narrative}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Strengths */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Strengths
          </h3>
          {es.strengths && es.strengths.length > 0 ? (
            <ul className="space-y-1.5">
              {es.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-300">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No strengths identified.</p>
          )}
        </div>

        {/* Key Issues */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
            Key Issues
          </h3>
          {es.keyIssues && es.keyIssues.length > 0 ? (
            <ul className="space-y-1.5">
              {es.keyIssues.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-300">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No key issues captured.</p>
          )}
        </div>

        {/* Strategic Bets */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-400">
            Strategic Bets
          </h3>
          {es.strategicPriorities && es.strategicPriorities.length > 0 ? (
            <ul className="space-y-1.5">
              {es.strategicPriorities.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-300">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">
              No strategic priorities listed.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

