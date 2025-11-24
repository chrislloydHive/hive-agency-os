// components/growth/QuickWinsPanel.tsx

import React, { useState } from "react";

import type { QuickWin } from "@/lib/growth-plan/growthActionPlanSchema";
import {
  GlobeIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  TargetIcon,
  StarIcon,
  BoltIcon,
} from "./Icons";

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

const TIME_HORIZON_LABELS: Record<string, string> = {
  immediate: "Immediate",
  short_term: "Short Term",
};

/**
 * Get icon component for quick win based on service area or priority
 */
function getQuickWinIcon(quickWin: QuickWin): React.ReactNode {
  // Use priority for high-impact quick wins
  if (quickWin.priority === "high") {
    return <BoltIcon className="w-4 h-4 text-amber-300" />;
  }
  
  // Otherwise use service area
  if (quickWin.serviceArea) {
    const area = quickWin.serviceArea.toLowerCase();
    if (area.includes("website"))
      return <GlobeIcon className="w-4 h-4 text-gray-300" />;
    if (area.includes("content"))
      return <DocumentIcon className="w-4 h-4 text-gray-300" />;
    if (area.includes("seo"))
      return <MagnifyingGlassIcon className="w-4 h-4 text-gray-300" />;
    if (area.includes("brand"))
      return <TargetIcon className="w-4 h-4 text-gray-300" />;
    if (area.includes("authority"))
      return <StarIcon className="w-4 h-4 text-gray-300" />;
  }
  return <BoltIcon className="w-4 h-4 text-gray-300" />;
}

interface QuickWinTileProps {
  quickWin: QuickWin;
}

const QuickWinTile: React.FC<QuickWinTileProps> = ({ quickWin }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasSpecificChanges =
    quickWin.specificChanges && quickWin.specificChanges.length > 0;

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-700 bg-gray-800 p-3 transition-all hover:border-gray-600 hover:bg-gray-800/80 sm:p-4">
      {/* Icon - Top Left */}
      <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-neutral-900 sm:h-8 sm:w-8">
          {getQuickWinIcon(quickWin)}
        </div>
      </div>

      {/* Impact Badge - Top Right */}
      {quickWin.potentialScoreGain != null && (
        <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 shadow-sm sm:px-2.5 sm:py-1 sm:text-xs">
            +{quickWin.potentialScoreGain}
          </span>
        </div>
      )}

      {/* Title */}
      <div className="mb-2 pr-12 pl-10 sm:mb-3 sm:pr-16 sm:pl-12">
        <h3 className="line-clamp-2 text-xs font-semibold text-gray-200 sm:text-sm md:text-base">
          {quickWin.title}
        </h3>
      </div>

      {/* Description */}
      <p className="mb-2 line-clamp-3 text-[11px] leading-relaxed text-gray-400 sm:mb-3 sm:text-xs md:text-sm">
        {quickWin.description}
      </p>

      {/* Secondary Badges Row */}
      <div className="mb-2 mt-1.5 flex flex-wrap gap-1 text-[10px] sm:mb-3 sm:mt-2 sm:text-[11px]">
        {/* Priority Badge - Prominent */}
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
          {quickWin.priority}
        </span>

        {/* Time Horizon Badge - Neutral */}
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
          {TIME_HORIZON_LABELS[quickWin.timeHorizon] || quickWin.timeHorizon.replace("_", " ")}
        </span>

        {/* Service Area Badge - Neutral */}
        {quickWin.serviceArea && (
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
            {quickWin.serviceArea
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase())
              .trim()}
          </span>
        )}
      </div>

      {/* Metadata Footer */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 sm:gap-2 sm:text-xs">
        {quickWin.estimatedEffort && (
          <span>Effort: {quickWin.estimatedEffort}</span>
        )}
        {quickWin.expectedTimeline && (
          <span>• {quickWin.expectedTimeline}</span>
        )}
      </div>

      {/* Specific Changes (Collapsible) */}
      {hasSpecificChanges && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex w-full items-center justify-between text-xs font-medium text-gray-400 transition-colors hover:text-gray-300"
          >
            <span>View specific changes</span>
            <svg
              className={`h-4 w-4 transition-transform ${
                detailsOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Collapsible Content */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              detailsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            {detailsOpen && (
              <ul className="mt-2 space-y-1.5 text-xs text-gray-400">
                {quickWin.specificChanges!.map((change, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

type Props = {
  quickWins: QuickWin[];
};

export const QuickWinsPanel: React.FC<Props> = ({ quickWins }) => {
  if (!quickWins || quickWins.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800 p-6 text-center">
        <p className="text-sm text-gray-400">
          No quick wins were identified for this snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            GAP Accelerators
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            High-leverage, low-to-moderate effort actions you can start now.
          </p>
        </div>
        <span className="rounded-full bg-gray-700 px-3 py-1 text-xs font-medium text-yellow-400">
          {quickWins.length} {quickWins.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Tile Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {quickWins.map((quickWin) => (
          <QuickWinTile key={quickWin.id} quickWin={quickWin} />
        ))}
      </div>
    </div>
  );
};

