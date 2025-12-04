// lib/companies/carToysConfig.ts
// Car Toys "golden path" configuration for reference client

/**
 * Car Toys company ID
 * This should match the Airtable record ID for the Car Toys company
 *
 * TODO: Update this with the actual Car Toys company ID from Airtable
 */
export const CAR_TOYS_COMPANY_ID = 'recCarToysPlaceholder';

/**
 * Car Toys default configuration values
 * Used to prefill SSM and ensure consistent data
 */
export const carToysDefaults = {
  // Business Identity
  businessName: 'Car Toys',
  vertical: 'multi-location automotive retail',
  industry: 'Automotive Retail',
  businessModel: 'Multi-location retail with services',
  revenueModel: 'Product sales + installation services',

  // Objectives
  primaryObjective: 'maximize installs',
  secondaryObjectives: [
    'increase online-to-store conversion',
    'improve local search visibility',
    'grow mobile electronics market share',
  ],
  businessGoal: 'Lead Generation',

  // Geographic
  markets: ['WA', 'CO'],
  serviceArea: 'Pacific Northwest and Colorado',
  geographicFootprint: 'Regional (US Multi-State)',

  // Audience
  coreSegments: [
    'Car audio enthusiasts',
    'New car owners seeking upgrades',
    'Safety-conscious parents',
    'Tech-savvy commuters',
  ],
  demographics: 'Ages 25-55, household income $50k+, vehicle owners',

  // Media
  activeChannels: [
    'Google Ads',
    'Meta Ads',
    'Local Services Ads',
    'YouTube',
  ],

  // KPIs
  targetCpa: 45,
  targetRoas: 4.0,
};

/**
 * Check if a company is Car Toys
 */
export function isCarToys(companyId: string): boolean {
  return companyId === CAR_TOYS_COMPANY_ID;
}

/**
 * Get Car Toys defaults for SSM prefill
 * Returns partial data to merge with user input
 */
export function getCarToysDefaultsForStep(stepNumber: number): Record<string, unknown> {
  switch (stepNumber) {
    case 1: // Welcome/Basic Info
      return {
        businessName: carToysDefaults.businessName,
        industry: carToysDefaults.industry,
      };

    case 2: // Business Identity
      return {
        businessModel: carToysDefaults.businessModel,
        revenueModel: carToysDefaults.revenueModel,
        geographicFootprint: carToysDefaults.geographicFootprint,
        serviceArea: carToysDefaults.serviceArea,
      };

    case 3: // Objectives
      return {
        primaryObjective: carToysDefaults.primaryObjective,
        secondaryObjectives: carToysDefaults.secondaryObjectives,
        businessGoal: carToysDefaults.businessGoal,
      };

    case 4: // Audience
      return {
        coreSegments: carToysDefaults.coreSegments,
        demographics: carToysDefaults.demographics,
      };

    case 6: // Media Foundations
      return {
        activeChannels: carToysDefaults.activeChannels,
      };

    case 7: // KPIs
      return {
        targetCpa: carToysDefaults.targetCpa,
        targetRoas: carToysDefaults.targetRoas,
      };

    default:
      return {};
  }
}

/**
 * Car Toys QBR narrative defaults
 * Used when generating QBR content for Car Toys
 */
export const carToysQbrDefaults = {
  executiveSummaryContext: `Car Toys is a leading mobile electronics retailer with locations across ${carToysDefaults.markets.join(' and ')}. The business focuses on maximizing professional installation appointments while maintaining strong retail sales.`,

  mediaPerformanceContext: `Car Toys runs performance media campaigns across ${carToysDefaults.activeChannels.join(', ')} with a focus on driving installation bookings and store visits.`,

  audienceContext: `Primary audience includes ${carToysDefaults.coreSegments.slice(0, 2).join(' and ')}, targeting ${carToysDefaults.demographics}.`,
};

/**
 * Integration checklist for Car Toys
 * Tracks what needs to be configured for full functionality
 */
export interface CarToysIntegrationStatus {
  hasCompanyRecord: boolean;
  hasContextGraph: boolean;
  hasGa4Property: boolean;
  hasSearchConsole: boolean;
  ssmCompleted: boolean;
  qbrRunThisQuarter: boolean;
  mediaLabConfigured: boolean;
}

/**
 * Get the current quarter string
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}
