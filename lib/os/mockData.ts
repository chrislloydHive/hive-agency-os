import type {
  Company,
  CompanyId,
  Diagnostics,
  PriorityItem,
  GrowthPlan,
  CompanyScorecard,
  Snapshot,
} from './types';

// Mock Companies
const companies: Company[] = [
  {
    id: 'hive',
    name: 'Hive',
    websiteUrl: 'https://hive.com',
    industry: 'SaaS',
    stage: 'Growth',
    lastSnapshotAt: '2025-01-15T10:00:00Z',
    latestOverallScore: 78,
    status: 'active',
  },
  {
    id: 'mobile-pack',
    name: 'Mobile-Pack',
    websiteUrl: 'https://mobile-pack.com',
    industry: 'E-commerce',
    stage: 'Series A',
    lastSnapshotAt: '2025-01-12T14:30:00Z',
    latestOverallScore: 65,
    status: 'in_progress',
  },
  {
    id: 'silo-staffing',
    name: 'Silo Staffing',
    websiteUrl: 'https://silostaffing.com',
    industry: 'Staffing',
    stage: 'Seed',
    lastSnapshotAt: '2025-01-10T09:15:00Z',
    latestOverallScore: 52,
    status: 'active',
  },
];

// Mock Snapshots
const snapshots: Snapshot[] = [
  {
    id: 'snap-hive-1',
    companyId: 'hive',
    createdAt: '2025-01-15T10:00:00Z',
    source: 'snapshot_form',
    notes: 'Q1 2025 assessment',
  },
  {
    id: 'snap-mobile-pack-1',
    companyId: 'mobile-pack',
    createdAt: '2025-01-12T14:30:00Z',
    source: 'manual',
    notes: 'Initial onboarding assessment',
  },
  {
    id: 'snap-silo-staffing-1',
    companyId: 'silo-staffing',
    createdAt: '2025-01-10T09:15:00Z',
    source: 'snapshot_form',
    notes: 'Baseline assessment',
  },
];

// Mock Diagnostics
const diagnostics: Diagnostics[] = [
  {
    companyId: 'hive',
    snapshotId: 'snap-hive-1',
    overallScore: 78,
    websiteScore: 82,
    brandScore: 75,
    contentScore: 80,
    seoScore: 76,
    keyIssues: [
      'Mobile page speed needs improvement (3.2s load time)',
      'Brand messaging inconsistency across landing pages',
      'Missing schema markup on key pages',
      'Limited content depth on product pages',
    ],
  },
  {
    companyId: 'mobile-pack',
    snapshotId: 'snap-mobile-pack-1',
    overallScore: 65,
    websiteScore: 58,
    brandScore: 68,
    contentScore: 62,
    seoScore: 72,
    keyIssues: [
      'Website navigation is confusing for first-time visitors',
      'No clear value proposition above the fold',
      'Product images are low quality and inconsistent',
      'Checkout flow has 5 unnecessary steps',
      'Missing trust signals (reviews, testimonials)',
    ],
  },
  {
    companyId: 'silo-staffing',
    snapshotId: 'snap-silo-staffing-1',
    overallScore: 52,
    websiteScore: 45,
    brandScore: 50,
    contentScore: 55,
    seoScore: 58,
    keyIssues: [
      'Website looks outdated (last redesign 2019)',
      'No mobile-responsive design',
      'Brand identity is unclear and generic',
      'Minimal content - only 3 pages total',
      'No lead capture mechanism',
      'Critical accessibility issues',
    ],
  },
];

// Mock Priorities
const priorities: PriorityItem[] = [
  // Hive priorities
  {
    id: 'pri-hive-1',
    companyId: 'hive',
    title: 'Optimize mobile page speed',
    description: 'Reduce mobile load time from 3.2s to under 2s through image optimization and lazy loading',
    impact: 9,
    effort: 5,
    category: 'website',
    status: 'in_progress',
  },
  {
    id: 'pri-hive-2',
    companyId: 'hive',
    title: 'Standardize brand messaging',
    description: 'Create and implement a consistent messaging framework across all landing pages',
    impact: 8,
    effort: 6,
    category: 'brand',
    status: 'not_started',
  },
  {
    id: 'pri-hive-3',
    companyId: 'hive',
    title: 'Add schema markup',
    description: 'Implement structured data (Organization, Product, FAQ) on key pages for rich snippets',
    impact: 7,
    effort: 3,
    category: 'seo',
    status: 'not_started',
  },
  {
    id: 'pri-hive-4',
    companyId: 'hive',
    title: 'Expand product page content',
    description: 'Add detailed use cases, FAQs, and technical specifications to each product page',
    impact: 7,
    effort: 7,
    category: 'content',
    status: 'not_started',
  },
  {
    id: 'pri-hive-5',
    companyId: 'hive',
    title: 'Implement conversion tracking',
    description: 'Set up GA4 conversion events and attribution modeling for all key user actions',
    impact: 6,
    effort: 4,
    category: 'funnel',
    status: 'completed',
  },

  // Mobile-Pack priorities
  {
    id: 'pri-mp-1',
    companyId: 'mobile-pack',
    title: 'Redesign navigation structure',
    description: 'Simplify main navigation from 8 items to 4-5 core sections with clear categorization',
    impact: 10,
    effort: 7,
    category: 'website',
    status: 'not_started',
  },
  {
    id: 'pri-mp-2',
    companyId: 'mobile-pack',
    title: 'Create hero value proposition',
    description: 'Design and implement a clear, benefit-focused hero section with strong CTA',
    impact: 9,
    effort: 4,
    category: 'brand',
    status: 'not_started',
  },
  {
    id: 'pri-mp-3',
    companyId: 'mobile-pack',
    title: 'Streamline checkout flow',
    description: 'Reduce checkout from 5 steps to 2 steps (cart review + payment)',
    impact: 10,
    effort: 8,
    category: 'funnel',
    status: 'in_progress',
  },
  {
    id: 'pri-mp-4',
    companyId: 'mobile-pack',
    title: 'Add social proof elements',
    description: 'Integrate customer reviews, trust badges, and testimonials throughout site',
    impact: 8,
    effort: 5,
    category: 'content',
    status: 'not_started',
  },
  {
    id: 'pri-mp-5',
    companyId: 'mobile-pack',
    title: 'Professional product photography',
    description: 'Hire photographer for high-quality, consistent product images across catalog',
    impact: 7,
    effort: 6,
    category: 'brand',
    status: 'not_started',
  },
  {
    id: 'pri-mp-6',
    companyId: 'mobile-pack',
    title: 'Implement abandoned cart emails',
    description: 'Set up automated email sequence for cart abandonment recovery',
    impact: 8,
    effort: 4,
    category: 'funnel',
    status: 'not_started',
  },

  // Silo Staffing priorities
  {
    id: 'pri-ss-1',
    companyId: 'silo-staffing',
    title: 'Complete website redesign',
    description: 'Modern, mobile-responsive redesign with clear service offering and professional aesthetics',
    impact: 10,
    effort: 9,
    category: 'website',
    status: 'not_started',
  },
  {
    id: 'pri-ss-2',
    companyId: 'silo-staffing',
    title: 'Develop brand identity',
    description: 'Create comprehensive brand guidelines including logo, colors, typography, and voice',
    impact: 9,
    effort: 7,
    category: 'brand',
    status: 'not_started',
  },
  {
    id: 'pri-ss-3',
    companyId: 'silo-staffing',
    title: 'Build content library',
    description: 'Create 10+ pages of content: services, industries, case studies, about, careers, blog',
    impact: 8,
    effort: 8,
    category: 'content',
    status: 'not_started',
  },
  {
    id: 'pri-ss-4',
    companyId: 'silo-staffing',
    title: 'Add lead capture forms',
    description: 'Implement contact forms, job seeker applications, and employer inquiry forms',
    impact: 9,
    effort: 4,
    category: 'funnel',
    status: 'not_started',
  },
  {
    id: 'pri-ss-5',
    companyId: 'silo-staffing',
    title: 'Fix accessibility issues',
    description: 'Resolve WCAG 2.1 AA compliance issues (contrast, alt text, keyboard navigation)',
    impact: 7,
    effort: 5,
    category: 'website',
    status: 'not_started',
  },
  {
    id: 'pri-ss-6',
    companyId: 'silo-staffing',
    title: 'Basic SEO foundation',
    description: 'Optimize title tags, meta descriptions, heading structure, and create XML sitemap',
    impact: 8,
    effort: 3,
    category: 'seo',
    status: 'not_started',
  },
  {
    id: 'pri-ss-7',
    companyId: 'silo-staffing',
    title: 'Set up Google Business Profile',
    description: 'Create and optimize GBP with photos, services, and review management',
    impact: 7,
    effort: 2,
    category: 'seo',
    status: 'not_started',
  },
];

// Mock Growth Plans
const growthPlans: GrowthPlan[] = [
  {
    companyId: 'hive',
    snapshotId: 'snap-hive-1',
    headlineSummary: 'Hive has a strong foundation with good brand recognition and solid SEO. Primary focus should be on technical optimization and content depth to drive higher-intent organic traffic.',
    recommendedFocusAreas: [
      'Website Performance',
      'Content Strategy',
      'Technical SEO',
      'Brand Consistency',
    ],
    planSections: [
      {
        id: 'sec-hive-1',
        title: 'Technical Excellence',
        summary: 'Optimize website performance and technical SEO to improve user experience and search visibility',
        recommendedActions: [
          'Reduce mobile page load time to under 2 seconds',
          'Implement comprehensive schema markup',
          'Optimize Core Web Vitals scores across all pages',
          'Set up monitoring and alerting for performance regressions',
        ],
      },
      {
        id: 'sec-hive-2',
        title: 'Content Depth & Authority',
        summary: 'Expand content to better educate prospects and demonstrate expertise',
        recommendedActions: [
          'Create detailed use case documentation for each product',
          'Develop technical guides and integration documentation',
          'Launch a resource center with best practices and templates',
          'Produce monthly thought leadership content',
        ],
      },
      {
        id: 'sec-hive-3',
        title: 'Brand Unification',
        summary: 'Ensure consistent messaging and positioning across all touchpoints',
        recommendedActions: [
          'Audit and standardize messaging across all landing pages',
          'Create brand messaging guidelines for the team',
          'Update sales collateral to match web messaging',
          'Implement A/B testing for key value propositions',
        ],
      },
    ],
  },
  {
    companyId: 'mobile-pack',
    snapshotId: 'snap-mobile-pack-1',
    headlineSummary: 'Mobile-Pack has solid SEO fundamentals but significant conversion friction. Focus on UX optimization and trust-building to improve conversion rates from existing traffic.',
    recommendedFocusAreas: [
      'Conversion Optimization',
      'UX/Navigation',
      'Trust & Social Proof',
      'Funnel Simplification',
    ],
    planSections: [
      {
        id: 'sec-mp-1',
        title: 'Conversion Rate Optimization',
        summary: 'Remove friction and build trust to convert more visitors into customers',
        recommendedActions: [
          'Streamline checkout flow from 5 steps to 2 steps',
          'Implement cart abandonment recovery email sequence',
          'Add trust signals throughout the purchase journey',
          'Create urgency with inventory indicators and limited offers',
        ],
      },
      {
        id: 'sec-mp-2',
        title: 'User Experience Overhaul',
        summary: 'Simplify navigation and clarify value proposition for better first impressions',
        recommendedActions: [
          'Redesign main navigation for clarity and simplicity',
          'Create benefit-focused hero section with clear CTA',
          'Improve product discovery with better filtering and search',
          'Optimize mobile experience for on-the-go shoppers',
        ],
      },
      {
        id: 'sec-mp-3',
        title: 'Trust & Credibility',
        summary: 'Build confidence through social proof and professional presentation',
        recommendedActions: [
          'Integrate customer reviews on all product pages',
          'Add trust badges and security certifications',
          'Create customer testimonial section',
          'Upgrade product photography to professional quality',
        ],
      },
    ],
  },
  {
    companyId: 'silo-staffing',
    snapshotId: 'snap-silo-staffing-1',
    headlineSummary: 'Silo Staffing needs foundational work across all areas. This is a rebuild scenario requiring investment in website, brand, content, and basic digital presence.',
    recommendedFocusAreas: [
      'Website Rebuild',
      'Brand Development',
      'Content Creation',
      'Lead Generation',
    ],
    planSections: [
      {
        id: 'sec-ss-1',
        title: 'Website & Brand Foundation',
        summary: 'Establish a modern, professional digital presence that reflects company capabilities',
        recommendedActions: [
          'Complete mobile-responsive website redesign',
          'Develop comprehensive brand identity (logo, colors, voice)',
          'Ensure WCAG 2.1 AA accessibility compliance',
          'Implement modern, trustworthy design aesthetic',
        ],
      },
      {
        id: 'sec-ss-2',
        title: 'Content & Messaging',
        summary: 'Create content that educates prospects and demonstrates expertise',
        recommendedActions: [
          'Write compelling service descriptions for all offerings',
          'Create industry-specific landing pages',
          'Develop case studies showcasing successful placements',
          'Build blog with staffing industry insights',
        ],
      },
      {
        id: 'sec-ss-3',
        title: 'Lead Generation System',
        summary: 'Implement mechanisms to capture and nurture both employer and job seeker leads',
        recommendedActions: [
          'Create dual-track lead capture (employers + job seekers)',
          'Set up email automation for lead nurturing',
          'Implement applicant tracking integration',
          'Add live chat for immediate engagement',
        ],
      },
      {
        id: 'sec-ss-4',
        title: 'Local SEO & Visibility',
        summary: 'Establish strong local presence for geographic service areas',
        recommendedActions: [
          'Optimize Google Business Profile with complete information',
          'Build location-specific landing pages',
          'Implement local schema markup',
          'Develop review collection and management process',
        ],
      },
    ],
  },
];

// Mock Scorecards
const scorecards: CompanyScorecard[] = [
  {
    companyId: 'hive',
    history: [
      {
        date: '2024-10-15T00:00:00Z',
        overallScore: 72,
        traffic: 45000,
        leads: 320,
        notes: 'Q4 2024 baseline',
      },
      {
        date: '2024-11-15T00:00:00Z',
        overallScore: 74,
        traffic: 48500,
        leads: 340,
        notes: 'Initial SEO improvements deployed',
      },
      {
        date: '2024-12-15T00:00:00Z',
        overallScore: 76,
        traffic: 52000,
        leads: 365,
        notes: 'Content expansion phase 1',
      },
      {
        date: '2025-01-15T00:00:00Z',
        overallScore: 78,
        traffic: 54500,
        leads: 385,
        notes: 'Performance optimizations showing impact',
      },
    ],
  },
  {
    companyId: 'mobile-pack',
    history: [
      {
        date: '2024-11-12T00:00:00Z',
        overallScore: 58,
        traffic: 12000,
        leads: 85,
        notes: 'Initial baseline assessment',
      },
      {
        date: '2024-12-12T00:00:00Z',
        overallScore: 61,
        traffic: 13200,
        leads: 92,
        notes: 'Minor UX improvements',
      },
      {
        date: '2025-01-12T00:00:00Z',
        overallScore: 65,
        traffic: 14500,
        leads: 110,
        notes: 'Navigation redesign in progress',
      },
    ],
  },
  {
    companyId: 'silo-staffing',
    history: [
      {
        date: '2024-10-10T00:00:00Z',
        overallScore: 48,
        traffic: 800,
        leads: 5,
        notes: 'Initial assessment - major work needed',
      },
      {
        date: '2024-11-10T00:00:00Z',
        overallScore: 50,
        traffic: 920,
        leads: 8,
        notes: 'Basic SEO fixes applied',
      },
      {
        date: '2024-12-10T00:00:00Z',
        overallScore: 51,
        traffic: 1050,
        leads: 12,
        notes: 'Content additions beginning',
      },
      {
        date: '2025-01-10T00:00:00Z',
        overallScore: 52,
        traffic: 1200,
        leads: 15,
        notes: 'Redesign project kickoff',
      },
    ],
  },
];

// Helper Functions
export function getCompanies(): Company[] {
  return companies;
}

export function getCompanyById(id: CompanyId): Company | undefined {
  return companies.find((c) => c.id === id);
}

export function getDiagnosticsForCompany(id: CompanyId): Diagnostics | undefined {
  return diagnostics.find((d) => d.companyId === id);
}

export function getPrioritiesForCompany(id: CompanyId): PriorityItem[] {
  return priorities.filter((p) => p.companyId === id);
}

export function getGrowthPlanForCompany(id: CompanyId): GrowthPlan | undefined {
  return growthPlans.find((g) => g.companyId === id);
}

export function getScorecardForCompany(id: CompanyId): CompanyScorecard | undefined {
  return scorecards.find((s) => s.companyId === id);
}

// =============================================================================
// Airtable Integration with Mock Data Fallback
// =============================================================================

/**
 * Get all companies - tries Airtable first, falls back to mock data
 */
export async function getOSCompanies(): Promise<Company[]> {
  try {
    const { fetchCompaniesFromAirtable } = await import('./airtable');
    const airtableCompanies = await fetchCompaniesFromAirtable();
    if (airtableCompanies.length > 0) {
      return airtableCompanies;
    }
  } catch (error) {
    console.error('Error loading Airtable companies:', error);
  }
  return getCompanies();
}

/**
 * Get company by ID - tries Airtable first, falls back to mock data
 */
export async function getOSCompanyById(id: CompanyId): Promise<Company | undefined> {
  try {
    const { fetchCompanyByIdFromAirtable } = await import('./airtable');
    const airtableCompany = await fetchCompanyByIdFromAirtable(id);
    if (airtableCompany) {
      return airtableCompany;
    }
  } catch (error) {
    console.error('Error loading Airtable company:', error);
  }
  return getCompanyById(id);
}

/**
 * Get diagnostics for company - tries Airtable first, falls back to mock data
 */
export async function getOSDiagnostics(id: CompanyId): Promise<Diagnostics | undefined> {
  try {
    const { fetchDiagnosticsFromAirtable } = await import('./airtable');
    const airtableDiagnostics = await fetchDiagnosticsFromAirtable(id);
    if (airtableDiagnostics) {
      return airtableDiagnostics;
    }
  } catch (error) {
    console.error('Error loading Airtable diagnostics:', error);
  }
  return getDiagnosticsForCompany(id);
}

/**
 * Get priorities for company - tries Airtable first, falls back to mock data
 */
export async function getOSPriorities(id: CompanyId): Promise<PriorityItem[]> {
  try {
    const { fetchPrioritiesFromAirtable } = await import('./airtable');
    const airtablePriorities = await fetchPrioritiesFromAirtable(id);
    if (airtablePriorities.length > 0) {
      return airtablePriorities;
    }
  } catch (error) {
    console.error('Error loading Airtable priorities:', error);
  }
  return getPrioritiesForCompany(id);
}

/**
 * Get growth plan for company - tries Airtable first, falls back to mock data
 */
export async function getOSGrowthPlan(id: CompanyId): Promise<GrowthPlan | undefined> {
  try {
    const { fetchGrowthPlanFromAirtable } = await import('./airtable');
    const airtableGrowthPlan = await fetchGrowthPlanFromAirtable(id);
    if (airtableGrowthPlan) {
      return airtableGrowthPlan;
    }
  } catch (error) {
    console.error('Error loading Airtable growth plan:', error);
  }
  return getGrowthPlanForCompany(id);
}

/**
 * Get scorecard for company - tries Airtable first, falls back to mock data
 */
export async function getOSScorecard(id: CompanyId): Promise<CompanyScorecard | undefined> {
  try {
    const { fetchScorecardFromAirtable } = await import('./airtable');
    const airtableScorecard = await fetchScorecardFromAirtable(id);
    if (airtableScorecard) {
      return airtableScorecard;
    }
  } catch (error) {
    console.error('Error loading Airtable scorecard:', error);
  }
  return getScorecardForCompany(id);
}
