export interface CompetitorCluster {
  industry: string;
  competitors: string[];
  confidence: "high" | "medium" | "low";
  keywords: string[]; 
}

export const COMPETITOR_MAP: CompetitorCluster[] = [
  {
    industry: "Personal Training Marketplace",
    competitors: [
      "Thumbtack — Personal Training",
      "Fyt (Find Your Trainer)",
      "Trainerize Marketplace"
    ],
    confidence: "high",
    keywords: ["trainer", "personal training", "fitness coach", "find trainer"]
  },
  {
    industry: "Food Safety / Ozone Sanitation",
    competitors: [
      "Ecolab",
      "Aquaox",
      "Oxidation Technologies LLC"
    ],
    confidence: "high",
    keywords: ["ozone", "food safety", "sanitation", "sterilization", "processing plant"]
  },
  {
    industry: "Community / Commercial Banking",
    competitors: [
      "Umpqua Bank",
      "First Interstate Bank",
      "Seattle Bank"
    ],
    confidence: "medium",
    keywords: ["bank", "checking", "business banking", "loans", "credit union"]
  },
  {
    industry: "Digital Marketing Agency",
    competitors: [
      "Portent",
      "HawkSEM",
      "Single Grain"
    ],
    confidence: "medium",
    keywords: ["seo", "marketing agency", "ppc", "digital marketing"]
  }
];

export function detectCompetitors(html: string): CompetitorCluster | null {
  const text = html.toLowerCase();

  for (const cluster of COMPETITOR_MAP) {
    for (const kw of cluster.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return cluster;
      }
    }
  }

  return null;
}

