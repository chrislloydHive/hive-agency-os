// lib/analytics/sites.ts
// Multi-site configuration for analytics

export interface AnalyticsSiteConfig {
  id: string;
  name: string;
  domain: string;
  ga4PropertyId: string | null;
  searchConsoleSiteUrl: string | null;
  color: string; // For UI display
}

/**
 * Get all configured analytics sites from environment variables
 *
 * Environment variable format:
 * - ANALYTICS_SITES=dma,trainerhub,hive (comma-separated site IDs)
 * - For each site:
 *   - {SITE_ID}_GA4_PROPERTY_ID=properties/XXXXXXX
 *   - {SITE_ID}_SEARCH_CONSOLE_SITE_URL=sc-domain:example.com
 *   - {SITE_ID}_NAME=Display Name
 *   - {SITE_ID}_DOMAIN=example.com
 */
export function getAnalyticsSites(): AnalyticsSiteConfig[] {
  // Default sites configuration
  const sites: AnalyticsSiteConfig[] = [];

  // Site 1: DigitalMarketingAudit.ai (default/legacy)
  const dmaGa4 = process.env.GA4_PROPERTY_ID || process.env.DMA_GA4_PROPERTY_ID;
  const dmaSc = process.env.SEARCH_CONSOLE_SITE_URL || process.env.DMA_SEARCH_CONSOLE_SITE_URL;
  if (dmaGa4 || dmaSc) {
    sites.push({
      id: 'dma',
      name: 'DigitalMarketingAudit.ai',
      domain: 'digitalmarketingaudit.ai',
      ga4PropertyId: dmaGa4 || null,
      searchConsoleSiteUrl: dmaSc || null,
      color: 'amber',
    });
  }

  // Site 2: TrainerHub
  const trainerhubGa4 = process.env.TRAINERHUB_GA4_PROPERTY_ID;
  const trainerhubSc = process.env.TRAINERHUB_SEARCH_CONSOLE_SITE_URL;
  if (trainerhubGa4 || trainerhubSc) {
    sites.push({
      id: 'trainerhub',
      name: 'TrainerHub',
      domain: 'trainrhub.com',
      ga4PropertyId: trainerhubGa4 || null,
      searchConsoleSiteUrl: trainerhubSc || null,
      color: 'purple',
    });
  }

  // Site 3: Hive
  const hiveGa4 = process.env.HIVE_GA4_PROPERTY_ID;
  const hiveSc = process.env.HIVE_SEARCH_CONSOLE_SITE_URL;
  if (hiveGa4 || hiveSc) {
    sites.push({
      id: 'hive',
      name: 'Hive',
      domain: 'hive8.us',
      ga4PropertyId: hiveGa4 || null,
      searchConsoleSiteUrl: hiveSc || null,
      color: 'yellow',
    });
  }

  return sites;
}

/**
 * Get a specific site config by ID
 */
export function getSiteConfig(siteId: string): AnalyticsSiteConfig | null {
  const sites = getAnalyticsSites();
  return sites.find(s => s.id === siteId) || null;
}

/**
 * Get the default site (first configured site)
 */
export function getDefaultSite(): AnalyticsSiteConfig | null {
  const sites = getAnalyticsSites();
  return sites.length > 0 ? sites[0] : null;
}

/**
 * Get color classes for a site
 */
export function getSiteColorClasses(color: string): { text: string; bg: string; border: string } {
  const colors: Record<string, { text: string; bg: string; border: string }> = {
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/30',
    },
    purple: {
      text: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/30',
    },
    yellow: {
      text: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/30',
    },
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/30',
    },
    green: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/30',
    },
  };
  return colors[color] || colors.amber;
}
