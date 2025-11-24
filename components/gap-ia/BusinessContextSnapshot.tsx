import React from "react";

interface BusinessContextSnapshotProps {
  context: {
    businessType?: string | null;
    brandTier?: string | null;
    maturityStage?: string | null;
    overallScore?: number | null;
  };
}

const formatScore = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${Math.round(value)}`;
};

export const BusinessContextSnapshot: React.FC<
  BusinessContextSnapshotProps
> = ({ context }) => {
  const {
    businessType = "Not specified",
    brandTier = "Not specified",
    maturityStage = "Not specified",
    overallScore,
  } = context;

  return (
    <section className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/5 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
        Business Context Snapshot
      </p>
      <p className="mt-1 text-xs text-amber-100/80">
        Context used to interpret your scores and recommendations.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
            Business Type
          </p>
          <p className="mt-1 text-sm text-amber-50">{businessType}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
            Brand Tier
          </p>
          <p className="mt-1 text-sm text-amber-50">{brandTier}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
            Maturity Stage
          </p>
          <p className="mt-1 text-sm text-amber-50">{maturityStage}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
            Overall Score
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-300">
            {formatScore(overallScore)}
            <span className="ml-1 text-xs font-normal text-amber-200">/100</span>
          </p>
        </div>
      </div>
    </section>
  );
};
