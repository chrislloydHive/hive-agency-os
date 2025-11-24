// components/growth/ExecutiveSummaryHero.tsx

import React from "react";
import clsx from "clsx";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";
import type { SocialSignals, SocialStrength } from "@/lib/growth-plan/types";

type Props = {
  plan: GrowthAccelerationPlan;
};

/**
 * Overall Score Gauge Component (reusable)
 */
const OverallScoreGauge: React.FC<{
  score: number;
  maturityStage?: string;
  size?: "sm" | "md" | "lg";
}> = ({ score, maturityStage, size = "md" }) => {
  const sizeClasses = {
    sm: {
      container: "h-16 w-16 sm:h-20 sm:w-20",
      inner: "h-12 w-12 sm:h-16 sm:w-16",
      text: "text-xl sm:text-2xl",
      label: "text-[9px] sm:text-[10px]",
    },
    md: {
      container: "h-24 w-24 sm:h-28 sm:w-28",
      inner: "h-16 w-16 sm:h-20 sm:w-20",
      text: "text-2xl sm:text-3xl",
      label: "text-[10px] sm:text-xs",
    },
    lg: {
      container: "h-28 w-28 sm:h-32 sm:w-32",
      inner: "h-20 w-20 sm:h-24 sm:w-24",
      text: "text-3xl sm:text-4xl",
      label: "text-xs sm:text-sm",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative flex ${classes.container} items-center justify-center rounded-full border-[8px] border-gray-700`}
      >
        <div
          className="absolute inset-1 rounded-full"
          style={{
            background: `conic-gradient(#fbbf24 ${score * 3.6}deg, #374151 0deg)`,
          }}
        />
        <div
          className={`relative flex ${classes.inner} flex-col items-center justify-center rounded-full bg-gray-900`}
        >
          <span className={`${classes.text} font-semibold text-yellow-400`}>
            {score}
          </span>
          <span
            className={`${classes.label} uppercase tracking-wide text-gray-400`}
          >
            /100
          </span>
        </div>
      </div>
      {maturityStage && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-[10px] font-medium text-yellow-400 sm:mt-3 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
          <span className="h-1 w-1 rounded-full bg-yellow-400 sm:h-1.5 sm:w-1.5" />
          {maturityStage}
        </div>
      )}
    </div>
  );
};

/**
 * Social Presence Row Component
 */
const SocialPresenceRow: React.FC<{ social?: SocialSignals }> = ({ social }) => {
  if (!social) return null;

  const items: { label: string; strength: SocialStrength; present: boolean }[] = [
    {
      label: "LinkedIn",
      strength: social.linkedinStrength ?? (social.hasLinkedIn ? "present" : "none"),
      present: social.hasLinkedIn,
    },
    {
      label: "Facebook",
      strength: social.facebookStrength ?? (social.hasFacebook ? "present" : "none"),
      present: social.hasFacebook,
    },
    {
      label: "Instagram",
      strength: social.instagramStrength ?? (social.hasInstagram ? "present" : "none"),
      present: social.hasInstagram,
    },
  ];

  const visible = items.filter((i) => i.present || i.strength !== "none");
  if (visible.length === 0) return null;

  const strengthLabel = (s: SocialStrength) => {
    if (s === "strong") return "strong";
    if (s === "present") return "present";
    if (s === "weak") return "weak";
    return "none";
  };

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        Social Presence
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
        {visible.map((item) => (
          <span
            key={item.label}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              item.strength === "strong" && "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
              item.strength === "present" && "border-neutral-700 bg-neutral-900 text-neutral-100",
              item.strength === "weak" && "border-neutral-800 bg-neutral-950 text-neutral-400",
              item.strength === "none" && "border-neutral-900 bg-neutral-950 text-neutral-500"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span>{item.label}</span>
            <span className="text-[10px] uppercase tracking-wide">
              {strengthLabel(item.strength)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export const ExecutiveSummaryHero: React.FC<Props> = ({ plan }) => {
  const es = plan.executiveSummary ?? {};
  const scorecard = plan.scorecard;
  const overallScore = scorecard?.overall ?? es.overallScore ?? 0;

  // Derive company name from plan or URL
  const companyName =
    plan.companyName ||
    plan.websiteUrl
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  const displayUrl = plan.websiteUrl.replace(/^https?:\/\//, "");

  // Get top 2-3 strengths and key issues
  const topStrengths = es.strengths?.slice(0, 3) || [];
  const topIssues = es.keyIssues?.slice(0, 3) || [];

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-gray-700 bg-neutral-950/80 p-4 shadow-2xl backdrop-blur-sm sm:p-6 lg:p-8">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 via-transparent to-gray-900/30" />
      
      <div className="relative z-10">
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr,1.2fr]">
          {/* Left Side: Brand Identity + Score */}
          <div className="flex flex-col justify-between gap-4 sm:gap-6">
            <div>
              {/* Company Name */}
              <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                {companyName}
              </h1>
              
              {/* URL */}
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
                <span className="text-xs text-gray-400 sm:text-sm">{displayUrl}</span>
                <span className="h-1 w-1 rounded-full bg-gray-600" />
                <span className="text-[10px] text-gray-500 sm:text-xs">Growth Acceleration Plan (GAP)</span>
              </div>
            </div>

            {/* Overall Score + Maturity */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <OverallScoreGauge
                score={overallScore}
                maturityStage={es.maturityStage}
                size="sm"
              />
              
              {/* Score Context */}
              <div className="flex-1 pt-0 sm:pt-2">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
                  GAP Score & Maturity
                </div>
                <p className="text-xs leading-relaxed text-gray-300 sm:text-sm">
                  {overallScore >= 80
                    ? "Leading performance with strong marketing fundamentals"
                    : overallScore >= 60
                      ? "Strong foundation with clear growth opportunities"
                      : overallScore >= 40
                        ? "Developing capabilities with significant potential"
                        : "Early stage with foundational improvements needed"}
                </p>
                
                {/* Social Presence Row */}
                <SocialPresenceRow social={plan.socialSignals} />
              </div>
            </div>
          </div>

          {/* Right Side: Summary + Highlights */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Executive Summary Text */}
            {es.narrative && (
              <div>
                <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:mb-3 sm:text-xs">
                  GAP Executive Summary
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-neutral-200 sm:mt-3 sm:text-sm">
                  {es.narrative}
                </p>
              </div>
            )}

            {/* Two Column Highlights */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Top Strengths */}
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
                  Top Strengths
                </h3>
                {topStrengths.length > 0 ? (
                  <ul className="space-y-1.5">
                    {topStrengths.map((strength, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-300 sm:text-sm">
                        <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-500 sm:h-1.5 sm:w-1.5" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-gray-500 sm:text-xs">No strengths identified.</p>
                )}
              </div>

              {/* Key Issues */}
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
                  Key Issues
                </h3>
                {topIssues.length > 0 ? (
                  <ul className="space-y-1.5">
                    {topIssues.map((issue, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-300 sm:text-sm">
                        <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-500 sm:h-1.5 sm:w-1.5" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-gray-500 sm:text-xs">No key issues captured.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

