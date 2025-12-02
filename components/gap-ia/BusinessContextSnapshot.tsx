import React from "react";

// Types for business context normalization
type BusinessType =
  | "b2b_services"
  | "b2c"
  | "local_service"
  | "ecommerce"
  | "saas"
  | "unknown";

interface CanonicalBusinessContext {
  businessType: string;
  brandTier: string | null;
  confidence: "low" | "medium" | "high";
}

interface BusinessContextSnapshotProps {
  context: {
    businessType?: string | null;
    brandTier?: string | null;
    maturityStage?: string | null;
    overallScore?: number | null;
  };
  // Additional props for canonical context derivation
  coreCompanyType?: string | null;
  coreBrandTier?: string | null;
}

const formatScore = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${Math.round(value)}`;
};

/**
 * Derive canonical business context, preferring core classification over businessContext
 * when the core has a specific (non-unknown) value.
 */
function deriveCanonicalBusinessContext(params: {
  coreCompanyType?: string | null;
  coreBrandTier?: string | null;
  businessContextType?: string | null;
  businessContextBrandTier?: string | null;
  businessContextConfidence?: "low" | "medium" | "high" | null;
}): CanonicalBusinessContext {
  const {
    coreCompanyType,
    coreBrandTier,
    businessContextType,
    businessContextBrandTier,
  } = params;

  // Prefer core classification when present and not "unknown"
  if (coreCompanyType && coreCompanyType !== "unknown") {
    return {
      businessType: coreCompanyType,
      brandTier: coreBrandTier ?? businessContextBrandTier ?? null,
      confidence: "medium", // bump to medium if we have a confident core classification
    };
  }

  // Fall back to businessContext
  if (businessContextType && businessContextType !== "unknown") {
    return {
      businessType: businessContextType,
      brandTier: businessContextBrandTier ?? coreBrandTier ?? null,
      confidence: (params.businessContextConfidence as "low" | "medium" | "high") || "low",
    };
  }

  // Unknown
  return {
    businessType: "unknown",
    brandTier: coreBrandTier ?? businessContextBrandTier ?? null,
    confidence: "low",
  };
}

/**
 * Format business type for display (e.g., "b2b_services" -> "B2B Services")
 */
function formatBusinessType(type: string | null | undefined): string {
  if (!type || type === "unknown") return "Not specified";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const BusinessContextSnapshot: React.FC<
  BusinessContextSnapshotProps
> = ({ context, coreCompanyType, coreBrandTier }) => {
  // Derive canonical context, preferring core values when available
  const canonical = deriveCanonicalBusinessContext({
    coreCompanyType,
    coreBrandTier,
    businessContextType: context.businessType,
    businessContextBrandTier: context.brandTier,
  });

  const displayBusinessType = formatBusinessType(canonical.businessType);
  const displayBrandTier = canonical.brandTier
    ? canonical.brandTier.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "Not specified";
  const displayMaturityStage = context.maturityStage || "Not specified";
  const overallScore = context.overallScore;

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
          <p className="mt-1 text-sm text-amber-50">{displayBusinessType}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
            Brand Tier
          </p>
          <p className="mt-1 text-sm text-amber-50">{displayBrandTier}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">
            Maturity Stage
          </p>
          <p className="mt-1 text-sm text-amber-50">{displayMaturityStage}</p>
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
