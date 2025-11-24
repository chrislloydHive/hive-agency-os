// components/growth/ActionTimelineRoadmap.tsx

import React, { useState } from "react";
import { z } from "zod";
import clsx from "clsx";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";
import { BaseActionSchema } from "@/lib/growth-plan/growthActionPlanSchema";

type ActionLike = z.infer<typeof BaseActionSchema>;

const SERVICE_AREA_COLORS: Record<string, string> = {
  websiteAndConversion: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  contentAndMessaging: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  seoAndVisibility: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  brandAndPositioning: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  authority: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300",
  high: "bg-orange-500/20 text-orange-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-gray-500/20 text-gray-400",
};

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-gray-500/20 text-gray-400",
};

interface TimelineItemCardProps {
  action: ActionLike;
}

const TimelineItemCard: React.FC<TimelineItemCardProps> = ({ action }) => {
  const [expanded, setExpanded] = useState(false);
  
  const serviceAreaColor =
    action.serviceArea && SERVICE_AREA_COLORS[action.serviceArea]
      ? SERVICE_AREA_COLORS[action.serviceArea]
      : "bg-gray-500/20 text-gray-300 border-gray-500/30";

  const priorityColor =
    PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.low;
  const impactColor =
    IMPACT_COLORS[action.impact] || IMPACT_COLORS.low;

  // Estimate if description is long enough to need expansion
  // ~140 characters is roughly 3 lines at small text size
  const descriptionLength = action.description?.length || 0;
  const needsExpansion = descriptionLength > 140;

  return (
    <div className="group rounded-xl border border-gray-700 bg-gray-800 p-2.5 transition-all hover:border-gray-600 hover:bg-gray-700/50 sm:p-3">
      {/* Title */}
      <h4 className="mb-1 text-xs font-semibold text-gray-200 line-clamp-2 sm:mb-1.5 sm:text-sm">
        {action.title}
      </h4>

      {/* Description with expand/collapse */}
      {action.description && (
        <div className="mb-2">
          <p
            className={clsx(
              "text-[10px] leading-relaxed text-gray-400 sm:text-xs",
              !expanded && needsExpansion && "line-clamp-3"
            )}
          >
            {action.description}
          </p>
          
          {needsExpansion && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-[10px] font-medium text-amber-300 transition-colors hover:text-amber-200 sm:text-xs"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Service Area Tag (if available) */}
        {action.serviceArea && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${serviceAreaColor}`}
          >
            {action.serviceArea
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase())
              .trim()}
          </span>
        )}

        {/* Priority Badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColor}`}
        >
          {action.priority}
        </span>

        {/* Impact Badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${impactColor}`}
        >
          {action.impact}
        </span>

        {/* Resource Requirement (if available) */}
        {action.resourceRequirement && (
          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-400">
            {action.resourceRequirement}
          </span>
        )}
      </div>
    </div>
  );
};

interface TimelineBucketProps {
  label: string;
  actions: ActionLike[];
  isFirst?: boolean;
  isLast?: boolean;
}

const TimelineBucket: React.FC<TimelineBucketProps> = ({
  label,
  actions,
  isFirst = false,
  isLast = false,
}) => {
  return (
    <div className="flex flex-col">
      {/* Actions Stack */}
      <div className="flex-1 space-y-2">
        {actions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-3 text-center">
            <p className="text-xs text-gray-500">No actions scheduled</p>
          </div>
        ) : (
          actions.map((action) => (
            <TimelineItemCard key={action.id} action={action} />
          ))
        )}
      </div>
    </div>
  );
};

type Props = {
  plan: GrowthAccelerationPlan;
};

export const ActionTimelineRoadmap: React.FC<Props> = ({ plan }) => {
  const t = plan.timeline;

  const buckets = [
    { label: "Immediate", actions: t.immediate ?? [], isFirst: true },
    { label: "Short Term", actions: t.shortTerm ?? [] },
    { label: "Medium Term", actions: t.mediumTerm ?? [] },
    { label: "Long Term", actions: t.longTerm ?? [], isLast: true },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:text-sm">
          GAP Roadmap
        </h2>
        <div className="text-[10px] text-gray-500 sm:text-xs">
          {buckets.reduce((sum, b) => sum + b.actions.length, 0)} total actions
        </div>
      </div>

      {/* Roadmap Container */}
      <div className="relative">
        {/* Bucket Headers Row with Timeline Rail */}
        <div className="relative mb-4 flex justify-between border-b border-neutral-800 pb-2 sm:mb-6 sm:pb-3">
          {/* Timeline Rail Connector */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-neutral-800" />
          
          {/* Bucket Headers */}
          <div className="relative z-10 grid w-full grid-cols-4 gap-2 sm:gap-4 md:gap-6">
            {buckets.map((bucket, index) => (
              <div key={bucket.label} className="relative flex flex-col items-center">
                {/* "Now" marker for Immediate */}
                {index === 0 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 sm:-top-8">
                    <div className="rounded-full bg-yellow-400 px-2 py-1 text-[9px] font-bold text-gray-900 shadow-lg ring-2 ring-yellow-400/50 sm:px-3 sm:py-1.5 sm:text-[11px]">
                      NOW
                    </div>
                  </div>
                )}
                
                {/* Bucket Label Pill */}
                <div className="relative z-10 flex flex-col items-center gap-0.5 sm:gap-1">
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-100 sm:px-3 sm:py-1 sm:text-xs">
                    {bucket.label}
                  </span>
                  <span className="text-[9px] text-neutral-400 sm:text-[11px]">
                    {bucket.actions.length} {bucket.actions.length === 1 ? "action" : "actions"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buckets Grid */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-4">
          {buckets.map((bucket, index) => (
            <TimelineBucket
              key={bucket.label}
              label={bucket.label}
              actions={bucket.actions}
              isFirst={index === 0}
              isLast={index === buckets.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

