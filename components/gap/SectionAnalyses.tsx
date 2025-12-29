// components/gap/SectionAnalyses.tsx

import React from "react";
import clsx from "clsx";

import type { GrowthAccelerationPlan } from "@/lib/growth-plan/growthActionPlanSchema";
import type { SocialSignals } from "@/lib/growth-plan/types";
import { getDimensionColors } from "@/lib/ui/dimensionColors";

/** Section analysis structure from the plan */
interface SectionAnalysis {
  summary?: string;
  keyFindings?: string[];
  quickWins?: string[];
  deeperInitiatives?: string[];
}

const LABELS: Record<string, string> = {
  websiteAndConversion: "Website & Conversion",
  seoAndVisibility: "SEO & Visibility",
  contentAndMessaging: "Content & Messaging",
  brandAndPositioning: "Brand & Positioning",
  authorityAndTrust: "Authority & Trust",
};

// Map section keys to scorecard dimension keys
const SECTION_TO_SCORE_KEY: Record<string, keyof NonNullable<GrowthAccelerationPlan["scorecard"]>> = {
  websiteAndConversion: "website",
  seoAndVisibility: "seo",
  contentAndMessaging: "content",
  brandAndPositioning: "brand",
  authorityAndTrust: "authority",
};

interface SignalChip {
  id: string;
  label: string;
  variant: "good" | "warning";
}

/**
 * Derive signal chips from section analysis data
 */
function deriveSignals(
  sectionKey: string,
  section: SectionAnalysis
): SignalChip[] {
  const chips: SignalChip[] = [];
  const summary = (section.summary || "").toLowerCase();
  const findings = (section.keyFindings || []).join(" ").toLowerCase();
  const allText = `${summary} ${findings}`;

  // Website & Conversion signals
  if (sectionKey === "websiteAndConversion") {
    if (allText.includes("cta") || allText.includes("call to action") || allText.includes("button")) {
      chips.push({ id: "ctas", label: "CTAs present", variant: "good" });
    }
    if (allText.includes("mobile") && (allText.includes("responsive") || allText.includes("optimized"))) {
      chips.push({ id: "mobile", label: "Mobile optimized", variant: "good" });
    }
    if (allText.includes("conversion") && (allText.includes("low") || allText.includes("missing") || allText.includes("weak"))) {
      chips.push({ id: "conversion", label: "Conversion gaps", variant: "warning" });
    }
  }

  // SEO & Visibility signals
  if (sectionKey === "seoAndVisibility") {
    if (allText.includes("meta") && (allText.includes("tag") || allText.includes("description"))) {
      chips.push({ id: "meta", label: "Meta tags", variant: "good" });
    }
    if (allText.includes("technical") && (allText.includes("solid") || allText.includes("strong") || allText.includes("good"))) {
      chips.push({ id: "technical", label: "Technical SEO", variant: "good" });
    }
    if (allText.includes("visibility") && (allText.includes("low") || allText.includes("limited") || allText.includes("missing"))) {
      chips.push({ id: "visibility", label: "Low visibility", variant: "warning" });
    }
  }

  // Content & Messaging signals
  if (sectionKey === "contentAndMessaging") {
    if (allText.includes("blog") || allText.includes("article") || allText.includes("post")) {
      chips.push({ id: "blog", label: "Blog content", variant: "good" });
    }
    if (allText.includes("case study") || allText.includes("case studies")) {
      chips.push({ id: "cases", label: "Case studies", variant: "good" });
    }
    if (allText.includes("content") && (allText.includes("thin") || allText.includes("limited") || allText.includes("missing"))) {
      chips.push({ id: "content", label: "Content gaps", variant: "warning" });
    }
  }

  // Brand & Positioning signals
  if (sectionKey === "brandAndPositioning") {
    if (allText.includes("testimonial") || allText.includes("review") || allText.includes("social proof")) {
      chips.push({ id: "testimonials", label: "Social proof", variant: "good" });
    }
    if (allText.includes("differentiation") && (allText.includes("clear") || allText.includes("strong"))) {
      chips.push({ id: "differentiation", label: "Clear differentiation", variant: "good" });
    }
    if (allText.includes("positioning") && (allText.includes("unclear") || allText.includes("weak") || allText.includes("missing"))) {
      chips.push({ id: "positioning", label: "Positioning unclear", variant: "warning" });
    }
  }

  return chips.slice(0, 3); // Limit to 3 chips
}

type Props = {
  plan: GrowthAccelerationPlan;
};

/**
 * Authority Social Card Component
 * Shows social presence within Authority section
 */
const AuthoritySocialCard: React.FC<{ social?: SocialSignals }> = ({ social }) => {
  if (!social) return null;

  const hasAny = social.hasLinkedIn || social.hasFacebook || social.hasInstagram;
  if (!hasAny) return null;

  const items = [
    { key: "LinkedIn", present: social.hasLinkedIn, strength: social.linkedinStrength },
    { key: "Facebook", present: social.hasFacebook, strength: social.facebookStrength },
    { key: "Instagram", present: social.hasInstagram, strength: social.instagramStrength },
  ].filter((i) => i.present);

  // Generate 2-3 bullet points summarizing social context
  const bulletPoints: string[] = [];
  
  if (social.hasLinkedIn) {
    const strength = social.linkedinStrength || (social.linkedinUrls?.length > 0 ? "present" : "weak");
    if (strength === "strong") {
      bulletPoints.push("Strong LinkedIn presence with active company profile");
    } else if (strength === "present") {
      bulletPoints.push("LinkedIn profile detected and linked from website");
    }
  }
  
  if (social.hasFacebook) {
    const strength = social.facebookStrength || (social.facebookUrls?.length > 0 ? "present" : "weak");
    if (strength === "strong") {
      bulletPoints.push("Active Facebook presence for community engagement");
    } else if (strength === "present") {
      bulletPoints.push("Facebook page linked from website");
    }
  }
  
  if (social.hasInstagram) {
    const strength = social.instagramStrength || (social.instagramUrls?.length > 0 ? "present" : "weak");
    if (strength === "strong") {
      bulletPoints.push("Strong Instagram presence for visual brand storytelling");
    } else if (strength === "present") {
      bulletPoints.push("Instagram account linked from website");
    }
  }

  // Limit to 2-3 bullet points
  const displayBullets = bulletPoints.slice(0, 3);

  return (
    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Social Presence &amp; Community
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {items.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-neutral-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            <span>{item.key}</span>
            {item.strength && (
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                {item.strength}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Show 2-3 bullet points summarizing social context */}
      {displayBullets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {displayBullets.map((bullet, idx) => (
            <li key={idx} className="flex gap-2 text-xs leading-relaxed text-neutral-300">
              <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-amber-300" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
};

/**
 * Social Presence Card Component
 */
const SocialPresenceCard: React.FC<{ socialSignals: SocialSignals }> = ({ socialSignals }) => {
  const platforms = [];
  if (socialSignals.hasLinkedIn) {
    platforms.push({ name: "LinkedIn", color: "text-blue-400", icon: "LI", urls: socialSignals.linkedinUrls });
  }
  if (socialSignals.hasFacebook) {
    platforms.push({ name: "Facebook", color: "text-blue-500", icon: "FB", urls: socialSignals.facebookUrls });
  }
  if (socialSignals.hasInstagram) {
    platforms.push({ name: "Instagram", color: "text-pink-400", icon: "IG", urls: socialSignals.instagramUrls });
  }

  const getStrengthColor = (strength?: "none" | "weak" | "present" | "strong") => {
    switch (strength) {
      case "strong": return "text-emerald-400";
      case "present": return "text-blue-400";
      case "weak": return "text-yellow-400";
      default: return "text-gray-400";
    }
  };

  if (platforms.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col rounded-xl border-2 border-orange-500/30 bg-gray-800 p-3 sm:p-4 bg-orange-500/5">
      <div className="mb-2 text-xs font-semibold sm:text-sm text-orange-300">
        Social Presence & Community
      </div>
      
      <div className="space-y-2">
        {platforms.map((platform) => {
          const strength = platform.name === "LinkedIn" 
            ? socialSignals.linkedinStrength
            : platform.name === "Facebook"
            ? socialSignals.facebookStrength
            : socialSignals.instagramStrength;
          
          return (
            <div key={platform.name} className="flex items-center justify-between rounded-lg bg-gray-700/50 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${platform.color}`}>
                  {platform.icon}
                </span>
                <span className="text-xs text-gray-300">{platform.name}</span>
                {strength && strength !== "none" && (
                  <span className={`text-[10px] ${getStrengthColor(strength)}`}>
                    ({strength})
                  </span>
                )}
              </div>
              {platform.urls.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {platform.urls.length} {platform.urls.length === 1 ? "link" : "links"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SectionAnalysesView: React.FC<Props> = ({ plan }) => {
  const sections = (plan.sectionAnalyses ?? {}) as Record<string, SectionAnalysis>;
  const scorecard = plan.scorecard;
  const socialSignals = plan.socialSignals;
  const authorityScore = scorecard?.authority;

  const entries = Object.entries(sections);
  const hasAuthoritySection = authorityScore !== undefined;
  const showSocialCard = socialSignals && (socialSignals.hasLinkedIn || socialSignals.hasFacebook || socialSignals.hasInstagram);

  if (entries.length === 0 && !showSocialCard) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
        Section Analyses
      </div>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {entries.map(([key, section]) => {
          const colors = getDimensionColors(key);
          const borderClass = colors?.border || "border-gray-700";
          const bgClass = colors?.bg || "";
          const textClass = colors?.text || "text-gray-300";
          const pillClass = colors?.pill || "bg-gray-500/20 text-gray-300";

          // Get score for this section
          const scoreKey = SECTION_TO_SCORE_KEY[key];
          const score = scoreKey && scorecard ? scorecard[scoreKey] : undefined;

          // Derive signal chips
          const chips = deriveSignals(key, section);

          return (
            <div
              key={key}
              className={`flex flex-col rounded-xl border-2 ${borderClass} bg-gray-800 p-3 sm:p-4 ${bgClass}`}
            >
              {/* Section Header with Dimension Color */}
              <div className={`mb-2 text-xs font-semibold sm:text-sm ${textClass}`}>
                {LABELS[key] ?? key}
              </div>

              {/* At a Glance Strip */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
                {score !== undefined && (
                  <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-100 sm:px-2 sm:text-[10px]">
                    {score}/100
                  </span>
                )}
                {chips.map((chip) => (
                  <span
                    key={chip.id}
                    className={clsx(
                      "rounded-full px-2 py-0.5",
                      chip.variant === "good"
                        ? "bg-emerald-500/10 text-emerald-200"
                        : "bg-red-500/10 text-red-200"
                    )}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
              {section.summary && (
                <p className="mb-2 text-xs leading-relaxed text-gray-300 max-w-[70ch] sm:mb-3 sm:text-sm">
                  {section.summary}
                </p>
              )}

              {/* Optional note for Content & Messaging section about social profiles */}
              {key === "contentAndMessaging" && socialSignals && (socialSignals.hasInstagram || socialSignals.hasFacebook) && (
                <p className="mb-2 text-xs text-neutral-400 italic">
                  Note: Detected active social profiles (e.g. Instagram/Facebook). Some content strategy may be executed primarily on social rather than on the website.
                </p>
              )}

              {section.keyFindings && section.keyFindings.length > 0 && (
                <div className="mb-2 sm:mb-3">
                  <div className="mb-1 text-[10px] font-medium text-gray-400 sm:text-[11px]">
                    Key findings
                  </div>
                  <ul className="space-y-1.5">
                    {section.keyFindings.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-300 sm:text-sm">
                        <span
                          className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${pillClass}`}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(section.quickWins?.length ?? 0) > 0 && (
                <div className="mt-auto pt-2">
                  <div className={`mb-1 text-[10px] font-medium sm:text-[11px] ${textClass}`}>
                    Recommended focus
                  </div>
                  <ul className="space-y-1.5">
                    {section.quickWins!.slice(0, 3).map((q, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-300 sm:text-sm">
                        <span
                          className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${pillClass}`}
                        />
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Authority Social Card - shown only in Authority & Trust section */}
              {key === "authorityAndTrust" && (
                <AuthoritySocialCard social={socialSignals} />
              )}
            </div>
          );
        })}
        
        {/* Social Presence Card - shown when social signals are present */}
        {showSocialCard && (
          <SocialPresenceCard socialSignals={socialSignals!} />
        )}
      </div>
    </div>
  );
};

