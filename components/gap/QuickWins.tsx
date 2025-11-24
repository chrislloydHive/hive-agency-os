// components/gap/QuickWins.tsx

import React from "react";

import type { QuickWin } from "@/lib/growth-plan/growthActionPlanSchema";
import { QuickWinsPanel } from "@/components/growth/QuickWinsPanel";

type Props = {
  quickWins: QuickWin[];
};

export const QuickWinsList: React.FC<Props> = ({ quickWins }) => {
  return <QuickWinsPanel quickWins={quickWins} />;
};

