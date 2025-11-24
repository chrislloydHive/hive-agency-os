// components/growth/StrategicOutcomes.tsx

import React from "react";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";
import {
  ChartBarIcon,
  StarIcon,
  MagnifyingGlassIcon,
} from "./Icons";

type Props = {
  plan: GrowthAccelerationPlan;
};

interface OutcomeTile {
  icon: React.ReactNode;
  title: string;
  description: string;
  bg: string;
  border: string;
  text: string;
}

/**
 * Derive outcome descriptions from plan data
 */
function deriveOutcomes(plan: GrowthAccelerationPlan): OutcomeTile[] {
  const es = plan.executiveSummary ?? {};
  const scorecard = plan.scorecard;
  const websiteScore = scorecard?.website;
  const seoScore = scorecard?.seo;
  const authorityScore = scorecard?.authority;

  // Engagement - user engagement / conversion
  const hasWebsiteIssues = es.keyIssues?.some(
    (i) =>
      i.toLowerCase().includes("conversion") ||
      i.toLowerCase().includes("engagement") ||
      i.toLowerCase().includes("website") ||
      i.toLowerCase().includes("cta")
  );
  const hasWebsiteStrengths = es.strengths?.some(
    (s) =>
      s.toLowerCase().includes("conversion") ||
      s.toLowerCase().includes("engagement") ||
      s.toLowerCase().includes("website")
  );

  let engagementDesc = "";
  if (websiteScore !== undefined) {
    engagementDesc = `Website & Conversion currently scores ${websiteScore}/100. With improvements in website structure and content clarity, you can expect more visitors to understand your offer quickly and take the next step, increasing on-site engagement and conversions.`;
  } else if (hasWebsiteIssues) {
    engagementDesc =
      "With improvements in website structure and content clarity, you can expect more visitors to understand your offer quickly and take the next step, increasing on-site engagement and conversions.";
  } else {
    engagementDesc =
      "Optimize your website experience and calls-to-action to drive higher engagement rates and convert more visitors into leads and customers.";
  }

  // Credibility - authority/trust
  const hasAuthorityIssues = es.keyIssues?.some(
    (i) =>
      i.toLowerCase().includes("authority") ||
      i.toLowerCase().includes("trust") ||
      i.toLowerCase().includes("credibility") ||
      i.toLowerCase().includes("testimonial")
  );
  const hasAuthorityStrengths = es.strengths?.some(
    (s) =>
      s.toLowerCase().includes("authority") ||
      s.toLowerCase().includes("trust") ||
      s.toLowerCase().includes("testimonial") ||
      s.toLowerCase().includes("case study")
  );

  let credibilityDesc = "";
  if (authorityScore !== undefined) {
    credibilityDesc = `Authority & Trust currently scores ${authorityScore}/100. By adding testimonials, case studies, and social proof, you'll build stronger credibility that helps prospects trust your brand and choose you over competitors.`;
  } else if (hasAuthorityIssues) {
    credibilityDesc =
      "By adding testimonials, case studies, and social proof, you'll build stronger credibility that helps prospects trust your brand and choose you over competitors.";
  } else {
    credibilityDesc =
      "Strengthen your brand authority through strategic content, social proof, and trust signals that demonstrate your expertise and reliability.";
  }

  // Visibility - SEO / discoverability
  const hasSeoIssues = es.keyIssues?.some(
    (i) =>
      i.toLowerCase().includes("seo") ||
      i.toLowerCase().includes("visibility") ||
      i.toLowerCase().includes("ranking") ||
      i.toLowerCase().includes("search")
  );
  const hasSeoStrengths = es.strengths?.some(
    (s) =>
      s.toLowerCase().includes("seo") ||
      s.toLowerCase().includes("visibility") ||
      s.toLowerCase().includes("ranking")
  );

  let visibilityDesc = "";
  if (seoScore !== undefined) {
    visibilityDesc = `SEO & Visibility currently scores ${seoScore}/100. Through improved technical SEO, content depth, and keyword optimization, you'll rank higher in search results and attract more qualified organic traffic.`;
  } else if (hasSeoIssues) {
    visibilityDesc =
      "Through improved technical SEO, content depth, and keyword optimization, you'll rank higher in search results and attract more qualified organic traffic.";
  } else {
    visibilityDesc =
      "Enhance your search visibility and organic discovery through strategic SEO improvements and content optimization that drives qualified traffic.";
  }

  return [
    {
      icon: <ChartBarIcon className="w-5 h-5 text-blue-300" />,
      title: "Stronger User Engagement",
      description: engagementDesc,
      bg: "bg-blue-500/10",
      border: "border-blue-500/40",
      text: "text-blue-300",
    },
    {
      icon: <StarIcon className="w-5 h-5 text-amber-300" />,
      title: "Higher Trust & Authority",
      description: credibilityDesc,
      bg: "bg-amber-500/10",
      border: "border-amber-500/40",
      text: "text-amber-300",
    },
    {
      icon: <MagnifyingGlassIcon className="w-5 h-5 text-emerald-300" />,
      title: "Improved Search Visibility",
      description: visibilityDesc,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
    },
  ];
}

export const StrategicOutcomes: React.FC<Props> = ({ plan }) => {
  const outcomes = deriveOutcomes(plan);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs md:text-sm">
          Strategic Outcomes
        </h2>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {outcomes.map((outcome, index) => (
          <div
            key={index}
            className={`group flex flex-col rounded-xl border-2 ${outcome.border} ${outcome.bg} bg-gray-800 p-4 shadow-sm transition-all hover:border-opacity-60 hover:shadow-md sm:p-5`}
          >
            {/* Icon */}
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-base sm:mb-4 sm:h-10 sm:w-10 sm:text-lg">
              {outcome.icon}
            </div>

            {/* Title */}
            <h3 className={`mb-2 text-sm font-semibold sm:mb-3 sm:text-base md:text-lg ${outcome.text}`}>
              {outcome.title}
            </h3>

            {/* Description */}
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-300 sm:mt-2 sm:text-xs">
              {outcome.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

