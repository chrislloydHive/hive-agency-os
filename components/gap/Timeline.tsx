// components/gap/Timeline.tsx

import React from "react";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";
import { ActionTimelineRoadmap } from "@/components/growth/ActionTimelineRoadmap";

type Props = {
  plan: GrowthAccelerationPlan;
};

export const TimelineView: React.FC<Props> = ({ plan }) => {
  return <ActionTimelineRoadmap plan={plan} />;
};

