// lib/os/planning/templates.ts
// Deterministic planning templates for Programs
//
// Templates provide pre-populated deliverables and milestones
// based on workstream type. No LLM calls are made.

import type {
  PlanningDeliverable,
  PlanningMilestone,
  WorkstreamType,
  PlanningProgramKPI,
} from '@/lib/types/program';
import {
  generatePlanningDeliverableId,
  generatePlanningMilestoneId,
} from '@/lib/types/program';

// ============================================================================
// Template Types
// ============================================================================

export interface ProgramTemplate {
  workstream: WorkstreamType;
  deliverables: Omit<PlanningDeliverable, 'id' | 'status'>[];
  milestones: Omit<PlanningMilestone, 'id' | 'status'>[];
  suggestedKPIs: Omit<PlanningProgramKPI, 'key'>[];
  assumptions: string[];
  dependencies: string[];
}

// ============================================================================
// Workstream Templates
// ============================================================================

const CONTENT_TEMPLATE: ProgramTemplate = {
  workstream: 'content',
  deliverables: [
    {
      title: 'Content Strategy Brief',
      type: 'document',
      description: 'Define content themes, topics, and target audience alignment',
      workstreamType: 'content',
    },
    {
      title: 'Content Calendar',
      type: 'document',
      description: 'Schedule for content production and publishing',
      workstreamType: 'content',
    },
    {
      title: 'Content Pieces (x3)',
      type: 'asset',
      description: 'Primary content assets to be created',
      workstreamType: 'content',
    },
    {
      title: 'Distribution Checklist',
      type: 'process',
      description: 'Channels and tactics for content distribution',
      workstreamType: 'content',
    },
  ],
  milestones: [
    { title: 'Strategy Approved' },
    { title: 'First Draft Complete' },
    { title: 'Content Published' },
    { title: 'Distribution Complete' },
  ],
  suggestedKPIs: [
    { label: 'Organic Traffic', target: '+20%', timeframe: '90 days' },
    { label: 'Engagement Rate', target: '>2%', timeframe: 'per piece' },
    { label: 'Lead Conversions', target: 'TBD', timeframe: '90 days' },
  ],
  assumptions: [
    'Subject matter experts available for interviews',
    'Brand guidelines and voice documented',
    'Publishing platform access confirmed',
  ],
  dependencies: [
    'SEO keyword research (if applicable)',
    'Sales/product input on topics',
  ],
};

const WEBSITE_TEMPLATE: ProgramTemplate = {
  workstream: 'website',
  deliverables: [
    {
      title: 'UX Audit & Recommendations',
      type: 'document',
      description: 'Review of current site experience and improvement priorities',
      workstreamType: 'website',
    },
    {
      title: 'Wireframes / Mockups',
      type: 'asset',
      description: 'Design concepts for key pages or flows',
      workstreamType: 'website',
    },
    {
      title: 'Development Implementation',
      type: 'integration',
      description: 'Build and deploy website changes',
      workstreamType: 'website',
    },
    {
      title: 'QA & Launch',
      type: 'process',
      description: 'Testing and go-live checklist',
      workstreamType: 'website',
    },
  ],
  milestones: [
    { title: 'Audit Complete' },
    { title: 'Designs Approved' },
    { title: 'Development Complete' },
    { title: 'Launched' },
  ],
  suggestedKPIs: [
    { label: 'Bounce Rate', target: '-15%', timeframe: '30 days post-launch' },
    { label: 'Conversion Rate', target: '+10%', timeframe: '30 days post-launch' },
    { label: 'Page Load Time', target: '<3s', timeframe: 'at launch' },
  ],
  assumptions: [
    'CMS/platform access available',
    'Content for new pages ready',
    'Stakeholders available for review cycles',
  ],
  dependencies: [
    'Brand guidelines finalized',
    'Analytics tracking in place',
  ],
};

const SEO_TEMPLATE: ProgramTemplate = {
  workstream: 'seo',
  deliverables: [
    {
      title: 'Technical SEO Audit',
      type: 'document',
      description: 'Site crawl analysis and technical fixes',
      workstreamType: 'seo',
    },
    {
      title: 'Keyword Research & Strategy',
      type: 'document',
      description: 'Target keywords and content mapping',
      workstreamType: 'seo',
    },
    {
      title: 'On-Page Optimization',
      type: 'process',
      description: 'Meta tags, headers, and content optimization',
      workstreamType: 'seo',
    },
    {
      title: 'Link Building / Outreach',
      type: 'campaign',
      description: 'Authority building through backlinks',
      workstreamType: 'seo',
    },
  ],
  milestones: [
    { title: 'Audit Complete' },
    { title: 'Quick Wins Implemented' },
    { title: 'Content Optimization Done' },
    { title: 'First Ranking Improvements' },
  ],
  suggestedKPIs: [
    { label: 'Organic Traffic', target: '+30%', timeframe: '6 months' },
    { label: 'Keyword Rankings', target: 'Top 10 for 5 terms', timeframe: '6 months' },
    { label: 'Domain Authority', target: '+5 points', timeframe: '12 months' },
  ],
  assumptions: [
    'Access to Google Search Console and Analytics',
    'Website CMS allows meta tag edits',
    'Content team available for updates',
  ],
  dependencies: [
    'Competitor analysis',
    'Current traffic baseline',
  ],
};

const PAID_MEDIA_TEMPLATE: ProgramTemplate = {
  workstream: 'paid_media',
  deliverables: [
    {
      title: 'Media Plan',
      type: 'document',
      description: 'Channel mix, budget allocation, and targeting strategy',
      workstreamType: 'paid_media',
    },
    {
      title: 'Campaign Creative',
      type: 'asset',
      description: 'Ad copy, images, and video assets',
      workstreamType: 'paid_media',
    },
    {
      title: 'Tracking Setup',
      type: 'integration',
      description: 'Pixel installation, conversion tracking, attribution',
      workstreamType: 'paid_media',
    },
    {
      title: 'Campaign Build & Launch',
      type: 'campaign',
      description: 'Platform setup and campaign activation',
      workstreamType: 'paid_media',
    },
    {
      title: 'Landing Page QA',
      type: 'process',
      description: 'Ensure landing pages are optimized and tracking',
      workstreamType: 'paid_media',
    },
  ],
  milestones: [
    { title: 'Media Plan Approved' },
    { title: 'Tracking Verified' },
    { title: 'Campaign Launched' },
    { title: 'First Optimization Pass' },
  ],
  suggestedKPIs: [
    { label: 'ROAS', target: '>3x', timeframe: '30 days' },
    { label: 'CPA', target: '<$50', timeframe: 'ongoing' },
    { label: 'CTR', target: '>1%', timeframe: 'ongoing' },
  ],
  assumptions: [
    'Budget confirmed and available',
    'Landing pages ready',
    'Creative assets approved',
  ],
  dependencies: [
    'Audience targeting data',
    'Conversion goals defined',
  ],
};

const EMAIL_TEMPLATE: ProgramTemplate = {
  workstream: 'email',
  deliverables: [
    {
      title: 'Email Strategy & Segmentation',
      type: 'document',
      description: 'Audience segments and journey mapping',
      workstreamType: 'email',
    },
    {
      title: 'Email Templates',
      type: 'asset',
      description: 'Designed and coded email templates',
      workstreamType: 'email',
    },
    {
      title: 'Automation Flows',
      type: 'integration',
      description: 'Triggered email sequences in ESP',
      workstreamType: 'email',
    },
    {
      title: 'Campaign Calendar',
      type: 'document',
      description: 'Scheduled sends and content plan',
      workstreamType: 'email',
    },
  ],
  milestones: [
    { title: 'Strategy Approved' },
    { title: 'Templates Built' },
    { title: 'Automations Live' },
    { title: 'First Campaign Sent' },
  ],
  suggestedKPIs: [
    { label: 'Open Rate', target: '>25%', timeframe: 'ongoing' },
    { label: 'Click Rate', target: '>3%', timeframe: 'ongoing' },
    { label: 'Unsubscribe Rate', target: '<0.5%', timeframe: 'ongoing' },
  ],
  assumptions: [
    'ESP access available',
    'Clean subscriber list',
    'Sending domain configured',
  ],
  dependencies: [
    'CRM integration (if applicable)',
    'Content calendar alignment',
  ],
};

const SOCIAL_TEMPLATE: ProgramTemplate = {
  workstream: 'social',
  deliverables: [
    {
      title: 'Social Strategy',
      type: 'document',
      description: 'Platform priorities, content pillars, and voice',
      workstreamType: 'social',
    },
    {
      title: 'Content Calendar',
      type: 'document',
      description: 'Monthly posting schedule and themes',
      workstreamType: 'social',
    },
    {
      title: 'Visual Templates',
      type: 'asset',
      description: 'Branded post templates for each platform',
      workstreamType: 'social',
    },
    {
      title: 'Community Management SOP',
      type: 'document',
      description: 'Response guidelines and escalation process',
      workstreamType: 'social',
    },
  ],
  milestones: [
    { title: 'Strategy Approved' },
    { title: 'Templates Created' },
    { title: 'First Month Posted' },
    { title: 'Engagement Review' },
  ],
  suggestedKPIs: [
    { label: 'Engagement Rate', target: '>3%', timeframe: 'ongoing' },
    { label: 'Follower Growth', target: '+10%', timeframe: 'monthly' },
    { label: 'Post Frequency', target: '3x/week', timeframe: 'ongoing' },
  ],
  assumptions: [
    'Social account access available',
    'Brand guidelines documented',
    'Approval workflow defined',
  ],
  dependencies: [
    'Content assets from other programs',
    'Campaign calendar coordination',
  ],
};

const BRAND_TEMPLATE: ProgramTemplate = {
  workstream: 'brand',
  deliverables: [
    {
      title: 'Brand Audit',
      type: 'document',
      description: 'Current brand perception and competitive positioning',
      workstreamType: 'brand',
    },
    {
      title: 'Brand Guidelines',
      type: 'document',
      description: 'Visual identity, voice, and usage rules',
      workstreamType: 'brand',
    },
    {
      title: 'Messaging Framework',
      type: 'document',
      description: 'Value propositions, taglines, and talking points',
      workstreamType: 'brand',
    },
    {
      title: 'Asset Templates',
      type: 'asset',
      description: 'Core visual assets and templates',
      workstreamType: 'brand',
    },
  ],
  milestones: [
    { title: 'Audit Complete' },
    { title: 'Strategy Approved' },
    { title: 'Guidelines Documented' },
    { title: 'Assets Delivered' },
  ],
  suggestedKPIs: [
    { label: 'Brand Consistency Score', target: '>90%', timeframe: 'audit' },
    { label: 'Employee Adoption', target: '100%', timeframe: '30 days' },
    { label: 'External Recognition', target: 'qualitative', timeframe: 'ongoing' },
  ],
  assumptions: [
    'Stakeholder alignment on direction',
    'Historical brand assets available',
    'Competitive landscape understood',
  ],
  dependencies: [
    'Leadership buy-in',
    'Budget for asset creation',
  ],
};

const ANALYTICS_TEMPLATE: ProgramTemplate = {
  workstream: 'analytics',
  deliverables: [
    {
      title: 'Analytics Audit',
      type: 'document',
      description: 'Current tracking gaps and data quality assessment',
      workstreamType: 'analytics',
    },
    {
      title: 'Tracking Plan',
      type: 'document',
      description: 'Events, conversions, and parameters to implement',
      workstreamType: 'analytics',
    },
    {
      title: 'Dashboard Build',
      type: 'integration',
      description: 'Reporting dashboards in Looker/Data Studio/etc.',
      workstreamType: 'analytics',
    },
    {
      title: 'Documentation & Training',
      type: 'document',
      description: 'How to use reports and interpret data',
      workstreamType: 'analytics',
    },
  ],
  milestones: [
    { title: 'Audit Complete' },
    { title: 'Tracking Implemented' },
    { title: 'Dashboard Live' },
    { title: 'Team Trained' },
  ],
  suggestedKPIs: [
    { label: 'Data Accuracy', target: '>95%', timeframe: 'at launch' },
    { label: 'Report Adoption', target: 'weekly usage', timeframe: '30 days' },
    { label: 'Decision Velocity', target: 'qualitative', timeframe: 'ongoing' },
  ],
  assumptions: [
    'Platform access (GA, Tag Manager, etc.)',
    'Clear business questions to answer',
    'Data storage/warehouse available',
  ],
  dependencies: [
    'Website/app access for tracking',
    'Stakeholder requirements gathered',
  ],
};

const CONVERSION_TEMPLATE: ProgramTemplate = {
  workstream: 'conversion',
  deliverables: [
    {
      title: 'Conversion Audit',
      type: 'document',
      description: 'Funnel analysis and drop-off identification',
      workstreamType: 'conversion',
    },
    {
      title: 'Hypothesis Backlog',
      type: 'document',
      description: 'Prioritized test ideas based on data',
      workstreamType: 'conversion',
    },
    {
      title: 'A/B Test Setup',
      type: 'integration',
      description: 'Test implementation in optimization tool',
      workstreamType: 'conversion',
    },
    {
      title: 'Results Analysis',
      type: 'document',
      description: 'Test outcomes and recommendations',
      workstreamType: 'conversion',
    },
  ],
  milestones: [
    { title: 'Audit Complete' },
    { title: 'First Test Launched' },
    { title: 'First Winner Found' },
    { title: 'Learnings Documented' },
  ],
  suggestedKPIs: [
    { label: 'Conversion Rate', target: '+15%', timeframe: 'per test' },
    { label: 'Test Velocity', target: '2/month', timeframe: 'ongoing' },
    { label: 'Win Rate', target: '>30%', timeframe: 'ongoing' },
  ],
  assumptions: [
    'Sufficient traffic for statistical significance',
    'CRO tool access (Optimizely, VWO, etc.)',
    'Developer support available',
  ],
  dependencies: [
    'Analytics tracking in place',
    'Clear conversion goals defined',
  ],
};

const DEFAULT_TEMPLATE: ProgramTemplate = {
  workstream: 'other',
  deliverables: [
    {
      title: 'Project Brief',
      type: 'document',
      description: 'Scope, goals, and success criteria',
      workstreamType: 'other',
    },
    {
      title: 'Deliverable 1',
      type: 'other',
      description: 'Primary project output',
      workstreamType: 'other',
    },
    {
      title: 'Documentation',
      type: 'document',
      description: 'Process documentation and handoff',
      workstreamType: 'other',
    },
  ],
  milestones: [
    { title: 'Kickoff Complete' },
    { title: 'Midpoint Check-in' },
    { title: 'Deliverables Complete' },
    { title: 'Project Closed' },
  ],
  suggestedKPIs: [
    { label: 'On-Time Delivery', target: '100%', timeframe: 'at close' },
    { label: 'Stakeholder Satisfaction', target: '>8/10', timeframe: 'at close' },
  ],
  assumptions: [
    'Project scope agreed upon',
    'Resources allocated',
  ],
  dependencies: [
    'To be determined based on project type',
  ],
};

// ============================================================================
// Template Registry
// ============================================================================

const TEMPLATES: Record<WorkstreamType, ProgramTemplate> = {
  content: CONTENT_TEMPLATE,
  website: WEBSITE_TEMPLATE,
  seo: SEO_TEMPLATE,
  paid_media: PAID_MEDIA_TEMPLATE,
  email: EMAIL_TEMPLATE,
  social: SOCIAL_TEMPLATE,
  brand: BRAND_TEMPLATE,
  analytics: ANALYTICS_TEMPLATE,
  conversion: CONVERSION_TEMPLATE,
  partnerships: DEFAULT_TEMPLATE,
  ops: DEFAULT_TEMPLATE,
  other: DEFAULT_TEMPLATE,
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Get a program template by workstream type
 */
export function getProgramTemplate(workstream: WorkstreamType): ProgramTemplate {
  return TEMPLATES[workstream] || DEFAULT_TEMPLATE;
}

/**
 * Apply a template to generate deliverables with IDs
 */
export function applyDeliverableTemplate(
  template: ProgramTemplate
): PlanningDeliverable[] {
  return template.deliverables.map(d => ({
    id: generatePlanningDeliverableId(),
    ...d,
    status: 'planned' as const,
  }));
}

/**
 * Apply a template to generate milestones with IDs
 */
export function applyMilestoneTemplate(
  template: ProgramTemplate
): PlanningMilestone[] {
  return template.milestones.map(m => ({
    id: generatePlanningMilestoneId(),
    ...m,
    status: 'pending' as const,
  }));
}

/**
 * Apply a template to generate KPIs with keys
 */
export function applyKPITemplate(
  template: ProgramTemplate
): PlanningProgramKPI[] {
  return template.suggestedKPIs.map((kpi, index) => ({
    key: `kpi_${index}`,
    ...kpi,
  }));
}

/**
 * Get full template outputs ready to apply to a program
 */
export function getTemplateOutputs(workstream: WorkstreamType): {
  deliverables: PlanningDeliverable[];
  milestones: PlanningMilestone[];
  kpis: PlanningProgramKPI[];
  assumptions: string[];
  dependencies: string[];
} {
  const template = getProgramTemplate(workstream);

  return {
    deliverables: applyDeliverableTemplate(template),
    milestones: applyMilestoneTemplate(template),
    kpis: applyKPITemplate(template),
    assumptions: [...template.assumptions],
    dependencies: [...template.dependencies],
  };
}

/**
 * Get all available workstream types with labels
 */
export function getAvailableWorkstreams(): Array<{ value: WorkstreamType; label: string }> {
  return [
    { value: 'content', label: 'Content' },
    { value: 'website', label: 'Website' },
    { value: 'seo', label: 'SEO' },
    { value: 'paid_media', label: 'Paid Media' },
    { value: 'email', label: 'Email' },
    { value: 'social', label: 'Social' },
    { value: 'brand', label: 'Brand' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'conversion', label: 'CRO' },
    { value: 'partnerships', label: 'Partnerships' },
    { value: 'ops', label: 'Operations' },
    { value: 'other', label: 'Other' },
  ];
}
