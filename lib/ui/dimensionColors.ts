// lib/ui/dimensionColors.ts

export type DimensionKey = "website" | "content" | "seo" | "brand" | "authority";

export interface DimensionColorSet {
  bg: string;
  border: string;
  pill: string;
  text: string;
}

export const dimensionColors: Record<DimensionKey, DimensionColorSet> = {
  website: {
    bg: "bg-sky-500/10",
    border: "border-sky-500/40",
    pill: "bg-sky-500/20 text-sky-200",
    text: "text-sky-300",
  },
  content: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/40",
    pill: "bg-purple-500/20 text-purple-200",
    text: "text-purple-300",
  },
  seo: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    pill: "bg-emerald-500/20 text-emerald-200",
    text: "text-emerald-300",
  },
  brand: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    pill: "bg-amber-500/20 text-amber-200",
    text: "text-amber-300",
  },
  authority: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/40",
    pill: "bg-orange-500/20 text-orange-200",
    text: "text-orange-300",
  },
};

/**
 * Get dimension key from section analysis key
 */
export function getDimensionKey(sectionKey: string): DimensionKey | null {
  const normalized = sectionKey.toLowerCase();
  if (normalized.includes("website")) return "website";
  if (normalized.includes("content")) return "content";
  if (normalized.includes("seo")) return "seo";
  if (normalized.includes("brand")) return "brand";
  if (normalized.includes("authority")) return "authority";
  return null;
}

/**
 * Get dimension colors for a section key
 */
export function getDimensionColors(
  sectionKey: string
): DimensionColorSet | null {
  const key = getDimensionKey(sectionKey);
  return key ? dimensionColors[key] : null;
}

/**
 * Convert Tailwind text color class to hex for SVG
 */
export function getTextColorHex(textColorClass: string): string {
  const colorMap: Record<string, string> = {
    "text-sky-300": "#7DD3FC",
    "text-purple-300": "#C084FC",
    "text-emerald-300": "#6EE7B7",
    "text-amber-300": "#FCD34D",
    "text-orange-300": "#FDBA74",
  };
  return colorMap[textColorClass] || "#FBBF24"; // Default to yellow
}

