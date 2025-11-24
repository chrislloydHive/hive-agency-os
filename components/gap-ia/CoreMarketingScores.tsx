import React from "react";

type CoreScore = {
  label: string;
  value: number | null | undefined;
};

interface CoreMarketingScoresProps {
  scores: {
    brandScore?: number | null;
    contentScore?: number | null;
    seoScore?: number | null;
    websiteScore?: number | null;
    authorityScore?: number | null;
  };
}

const formatScore = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${Math.round(value)}`;
};

export const CoreMarketingScores: React.FC<CoreMarketingScoresProps> = ({
  scores,
}) => {
  const items: CoreScore[] = [
    { label: "Brand & Positioning", value: scores.brandScore },
    { label: "Content & Messaging", value: scores.contentScore },
    { label: "SEO & Visibility", value: scores.seoScore },
    { label: "Website & Conversion", value: scores.websiteScore },
    { label: "Authority & Trust", value: scores.authorityScore },
  ];

  return (
    <section className="mt-6 mb-6 rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Core Marketing Scores
        </p>
        <p className="mt-1 text-xs text-slate-400">
          These core scores summarize your marketing system across the five
          dimensions used throughout this report.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg bg-slate-900/80 px-3 py-2.5 shadow-sm ring-1 ring-slate-800"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {item.label}
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-slate-50">
                {formatScore(item.value)}
              </span>
              <span className="text-[11px] text-slate-500">/100</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
