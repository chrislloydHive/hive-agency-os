// components/gap/Scorecard.tsx

import React from "react";

import type { Scorecard } from "@/lib/growth-plan/growthActionPlanSchema";
import type { SocialSignals } from "@/lib/growth-plan/types";
import { RadarScorecard } from "@/components/growth/RadarScorecard";

type Props = {
  scorecard?: Scorecard;
  socialSignals?: SocialSignals;
};

export const ScorecardView: React.FC<Props> = ({ scorecard, socialSignals }) => {
  if (!scorecard) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400">
        GAP Score not available for this plan.
      </div>
    );
  }

  return (
    <div>
      {/* Radar Chart - Overall score is shown in the hero, so we only show dimension breakdown */}
      <RadarScorecard scorecard={scorecard} socialSignals={socialSignals} />
    </div>
  );
};

