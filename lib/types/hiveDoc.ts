// lib/types/hiveDoc.ts
// Type definitions for HiveDoc printable document templates

// ============================================================================
// Shared Types
// ============================================================================

export interface HiveDocMeta {
  documentType: string; // e.g., "Program Timeline", "Program Brief"
  title: string; // e.g., "Timeline", "Brief"
  subtitle: string; // e.g., "Phases, Milestones & Operating Rhythm"
  clientName: string;
  programName: string;
  date: string; // ISO date or formatted string
  version?: string;
}

export interface InfoCardData {
  title: string;
  bullets: string[];
}

export interface QuickOverviewData {
  summary: string;
}

// ============================================================================
// Timeline Document Types
// ============================================================================

export interface PhaseData {
  name: string;
  duration: string; // e.g., "Weeks 1-4"
  objectives: string[];
  keyActions: string[];
  outputs: string[];
}

export interface CadenceData {
  name: string; // e.g., "Weekly", "Monthly", "Quarterly"
  items: string[];
}

export interface MilestoneData {
  name: string;
  timing: string;
  description?: string;
}

export interface DependencyData {
  clientInputs: string[];
  hiveOutputs: string[];
  note?: string;
}

export interface TimelineDocData {
  meta: HiveDocMeta;
  quickOverview: QuickOverviewData;
  phases: PhaseData[];
  cadences: CadenceData[];
  milestones: MilestoneData[];
  dependencies: DependencyData;
}

// ============================================================================
// Brief Document Types
// ============================================================================

export interface KPIData {
  primary: {
    name: string;
    definition: string;
  };
  secondary: string[];
}

export interface AudienceData {
  name: string;
  description?: string;
  signals: string[];
}

export interface MessagingData {
  title: string;
  points: string[];
}

export interface CreativeRequirements {
  assets: string[];
  formats: string[];
  cadence: string[];
}

export interface ChannelData {
  name: string;
  purpose: string;
}

export interface StakeholderData {
  name: string;
  role: string;
  approvalArea: string;
  sla: string;
}

export interface BriefDocData {
  meta: HiveDocMeta;
  quickOverview: QuickOverviewData;
  kpis: KPIData;
  audiences: {
    primary: AudienceData[];
    secondary: AudienceData[];
  };
  messaging: MessagingData[];
  creativeRequirements: CreativeRequirements;
  channels: ChannelData[];
  clientInputs: string[];
  stakeholders: StakeholderData[];
}

// ============================================================================
// Project Timeline Document Types
// ============================================================================

export interface ProjectOverviewData {
  projectName: string;
  clientName: string;
  projectOwner: string;
  startDate: string;
  targetCompletion: string;
  status: 'Planning' | 'In Progress' | 'Complete';
}

export interface PhaseOverviewData {
  name: string;
  duration: string;
}

export interface TimelineRowData {
  phase: string;
  task: string;
  description: string;
  owner: 'Hive' | 'Client' | 'Hive / Client';
  duration: string;
  dependencies: string;
}

export interface ProjectTimelineDocData {
  meta: HiveDocMeta;
  overview: ProjectOverviewData;
  phasesAtGlance: PhaseOverviewData[];
  detailedTimeline: TimelineRowData[];
  clientResponsibilities: string[];
  assumptions: string[];
  changeManagementNote: string;
}

// ============================================================================
// Sample Data
// ============================================================================

export const SAMPLE_TIMELINE_DATA: TimelineDocData = {
  meta: {
    documentType: 'Program Timeline',
    title: 'Timeline',
    subtitle: 'Phases, Milestones & Operating Rhythm',
    clientName: 'Car Toys',
    programName: 'Q1 2025 Media Program',
    date: '2025-01-15',
    version: '1.0',
  },
  quickOverview: {
    summary:
      'This Timeline outlines the phased approach to launching and optimizing the Car Toys media program. We will move through three phases—Stabilize, Optimize, and Grow—with clear milestones and a predictable operating rhythm to ensure alignment and continuous improvement.',
  },
  phases: [
    {
      name: 'Stabilize',
      duration: 'Weeks 1–4',
      objectives: [
        'Launch campaigns with proper tracking',
        'Establish baseline performance metrics',
        'Validate audience targeting',
      ],
      keyActions: [
        'Complete account setup & tracking',
        'Launch initial campaign structure',
        'Configure conversion tracking & attribution',
      ],
      outputs: ['Live campaigns', 'Tracking dashboard', 'Week 1-4 performance report'],
    },
    {
      name: 'Optimize',
      duration: 'Weeks 5–8',
      objectives: [
        'Improve efficiency metrics',
        'Test creative variations',
        'Refine audience segments',
      ],
      keyActions: [
        'A/B test ad creative',
        'Adjust bidding strategies',
        'Expand high-performing audiences',
      ],
      outputs: ['Optimization playbook', 'Creative test results', 'Refined targeting recommendations'],
    },
    {
      name: 'Grow',
      duration: 'Month 3+',
      objectives: [
        'Scale budget on proven tactics',
        'Expand channel mix',
        'Drive incremental growth',
      ],
      keyActions: [
        'Increase spend on top performers',
        'Test new channels/formats',
        'Implement advanced strategies',
      ],
      outputs: ['Growth roadmap', 'Channel expansion plan', 'Monthly performance reviews'],
    },
  ],
  cadences: [
    {
      name: 'Weekly',
      items: [
        'Performance check-in (15 min)',
        'Spend pacing review',
        'Quick wins & blockers',
      ],
    },
    {
      name: 'Monthly',
      items: [
        'Full performance review',
        'Creative refresh planning',
        'Budget reallocation decisions',
        'Strategic adjustments',
      ],
    },
    {
      name: 'Quarterly',
      items: [
        'QBR presentation',
        'Strategy refresh',
        'Goal setting for next quarter',
        'Annual planning alignment',
      ],
    },
  ],
  milestones: [
    { name: 'Kickoff Call', timing: 'Week 1', description: 'Align on goals, timeline, and deliverables' },
    { name: 'Tracking & Signal Readiness', timing: 'Week 2', description: 'All tracking live and verified' },
    { name: 'Campaign Launch', timing: 'Week 3', description: 'Initial campaigns go live' },
    { name: 'First Performance Report', timing: 'Week 4', description: 'Baseline metrics established' },
    { name: 'First Optimization Sprint', timing: 'Week 6', description: 'Initial optimizations implemented' },
    { name: 'Creative Refresh Drop', timing: 'Week 8', description: 'New creative assets deployed' },
    { name: 'Month 2 Review', timing: 'Week 8', description: 'Comprehensive performance review' },
    { name: 'Q1 QBR', timing: 'Week 12', description: 'Quarterly business review' },
  ],
  dependencies: {
    clientInputs: [
      'Ad account access & permissions',
      'Brand guidelines & approved assets',
      'Store location list with addresses',
      'Promotional calendar & key dates',
      'Access to door counter / foot traffic data',
    ],
    hiveOutputs: [
      'Campaign strategy & structure',
      'Creative recommendations & specs',
      'Weekly/monthly reporting',
      'Optimization recommendations',
      'QBR presentations',
    ],
    note: 'Delays in client approvals or asset delivery may shift campaign timelines. We will communicate any impacts proactively.',
  },
};

export const SAMPLE_BRIEF_DATA: BriefDocData = {
  meta: {
    documentType: 'Program Brief',
    title: 'Brief',
    subtitle: 'Strategy Inputs, Messaging & Requirements',
    clientName: 'Car Toys',
    programName: 'Q1 2025 Media Program',
    date: '2025-01-15',
    version: '1.0',
  },
  quickOverview: {
    summary:
      'This Brief captures the strategic inputs, audience definitions, messaging framework, and creative requirements for the Car Toys media program. It serves as the single source of truth for campaign planning and execution.',
  },
  kpis: {
    primary: {
      name: 'Store Foot Traffic',
      definition: 'Measured via door counters at retail locations. Goal: 15% lift vs. baseline period.',
    },
    secondary: [
      'Google Maps directions requests',
      'Phone calls from ads',
      'Store visit conversions (estimated)',
      'ROAS on measurable conversions',
    ],
  },
  audiences: {
    primary: [
      {
        name: 'In-Market Car Audio Shoppers',
        signals: [
          'Searching for car speakers, subwoofers, amplifiers',
          'Visiting competitor sites (Best Buy, Crutchfield)',
          'Recently purchased a vehicle',
          'Browsing car audio review content',
        ],
      },
      {
        name: 'Vehicle Upgraders',
        signals: [
          'Searching for car accessories',
          'Interest in car customization',
          'Visiting automotive forums',
          'Engaging with car enthusiast content',
        ],
      },
    ],
    secondary: [
      {
        name: 'New Car Owners',
        signals: [
          'Recently financed a vehicle',
          'Visiting dealership websites',
          'Searching for car insurance',
        ],
      },
      {
        name: 'Gift Shoppers (Seasonal)',
        signals: [
          'Searching for gift ideas',
          'Holiday shopping behavior',
          'Interest in tech/gadget gifts',
        ],
      },
    ],
  },
  messaging: [
    {
      title: 'Price & Value',
      points: [
        'Competitive pricing vs. online retailers',
        'Price match guarantee',
        'Financing options available',
        'Bundle deals & package pricing',
      ],
    },
    {
      title: 'Product & Expertise',
      points: [
        'Professional installation included',
        'Expert staff with hands-on experience',
        'Premium brand selection (JL Audio, Kenwood, etc.)',
        'Custom solutions for any vehicle',
      ],
    },
    {
      title: 'Proof & Trust Signals',
      points: [
        '40+ years in business',
        '50+ locations nationwide',
        '4.5+ star reviews across locations',
        'Lifetime installation warranty',
        '100,000+ happy customers',
      ],
    },
  ],
  creativeRequirements: {
    assets: [
      'Hero video (15s, 30s versions)',
      'Product showcase statics',
      'Store/installation imagery',
      'Customer testimonial clips',
      'Promotional offer graphics',
    ],
    formats: [
      '1:1 (Instagram, Facebook feed)',
      '9:16 (Stories, Reels, TikTok)',
      '16:9 (YouTube, Display)',
      '4:5 (Facebook feed optimized)',
    ],
    cadence: [
      'Monthly creative refresh (minimum)',
      'Weekly ad copy variations',
      'Promotional creative for key sale periods',
      'Seasonal messaging updates',
    ],
  },
  channels: [
    { name: 'Performance Max', purpose: 'Full-funnel reach across Google properties with automated optimization' },
    { name: 'Google Search', purpose: 'Capture high-intent queries for car audio and installation' },
    { name: 'Meta ASC+', purpose: 'Prospecting and retargeting across Facebook and Instagram' },
    { name: 'YouTube', purpose: 'Video awareness and consideration with in-market audiences' },
    { name: 'Local Services Ads', purpose: 'Drive calls and store visits for installation services' },
    { name: 'Google Business Profile', purpose: 'Local visibility and maps presence optimization' },
  ],
  clientInputs: [
    'Complete store list with addresses and phone numbers',
    'Promotional calendar with sale dates and offers',
    'Access to door counter data or reporting',
    'Brand guidelines and approved imagery',
    'Access to Google Ads and Meta ad accounts',
    'Google Business Profile manager access',
    'Product/service priorities and margin guidance',
  ],
  stakeholders: [
    { name: 'John Smith', role: 'Marketing Director', approvalArea: 'Strategy & Budget', sla: '3 business days' },
    { name: 'Sarah Johnson', role: 'Brand Manager', approvalArea: 'Creative & Messaging', sla: '2 business days' },
    { name: 'Mike Davis', role: 'Regional VP', approvalArea: 'Promotions & Pricing', sla: '5 business days' },
  ],
};

export const SAMPLE_PROJECT_TIMELINE_DATA: ProjectTimelineDocData = {
  meta: {
    documentType: 'Project Timeline',
    title: 'Project Timeline',
    subtitle: 'Phases, Milestones & Responsibilities',
    clientName: '[Client Name]',
    programName: '[Project Name]',
    date: '[Date]',
  },
  overview: {
    projectName: '[Project Name]',
    clientName: '[Client Name]',
    projectOwner: '[Hive Owner]',
    startDate: '[TBD]',
    targetCompletion: '[TBD]',
    status: 'Planning',
  },
  phasesAtGlance: [
    { name: 'Phase 1: Discovery & Planning', duration: '1–2 weeks' },
    { name: 'Phase 2: Strategy & Direction', duration: '1–2 weeks' },
    { name: 'Phase 3: Execution & Production', duration: '2–6 weeks' },
    { name: 'Phase 4: Review & Optimization', duration: 'ongoing or 1–2 weeks' },
  ],
  detailedTimeline: [
    {
      phase: 'Phase 1',
      task: 'Kickoff Call',
      description: 'Align on goals, stakeholders, and project scope',
      owner: 'Hive / Client',
      duration: '[1 day]',
      dependencies: '[Client availability]',
    },
    {
      phase: 'Phase 1',
      task: 'Discovery & Intake',
      description: 'Gather background materials, access, and inputs',
      owner: 'Hive',
      duration: '[3–5 days]',
      dependencies: '[Client to provide assets and access]',
    },
    {
      phase: 'Phase 1',
      task: 'Research & Analysis',
      description: 'Conduct relevant research and competitive review',
      owner: 'Hive',
      duration: '[3–5 days]',
      dependencies: '[Discovery complete]',
    },
    {
      phase: 'Phase 2',
      task: 'Strategy Development',
      description: 'Develop strategic recommendations and direction',
      owner: 'Hive',
      duration: '[5–7 days]',
      dependencies: '[Research complete]',
    },
    {
      phase: 'Phase 2',
      task: 'Strategy Presentation',
      description: 'Present strategy to client for alignment',
      owner: 'Hive / Client',
      duration: '[1 day]',
      dependencies: '[Strategy complete]',
    },
    {
      phase: 'Phase 2',
      task: 'Client Feedback & Approval',
      description: 'Client reviews and approves strategic direction',
      owner: 'Client',
      duration: '[3–5 days]',
      dependencies: '[Presentation complete]',
    },
    {
      phase: 'Phase 3',
      task: 'Creative / Execution Kickoff',
      description: 'Begin production based on approved direction',
      owner: 'Hive',
      duration: '[1 day]',
      dependencies: '[Strategy approved]',
    },
    {
      phase: 'Phase 3',
      task: 'Creative Development',
      description: 'Produce deliverables per agreed scope',
      owner: 'Hive',
      duration: '[1–4 weeks]',
      dependencies: '[Scope and direction finalized]',
    },
    {
      phase: 'Phase 3',
      task: 'Internal Review',
      description: 'Hive QA and internal review',
      owner: 'Hive',
      duration: '[2–3 days]',
      dependencies: '[Deliverables complete]',
    },
    {
      phase: 'Phase 3',
      task: 'Client Review & Revisions',
      description: 'Client reviews deliverables and provides feedback',
      owner: 'Client',
      duration: '[3–5 days]',
      dependencies: '[Internal review complete]',
    },
    {
      phase: 'Phase 3',
      task: 'Final Revisions',
      description: 'Incorporate client feedback and finalize',
      owner: 'Hive',
      duration: '[2–5 days]',
      dependencies: '[Client feedback received]',
    },
    {
      phase: 'Phase 4',
      task: 'Launch / Implementation',
      description: 'Deploy, publish, or hand off final deliverables',
      owner: 'Hive / Client',
      duration: '[1–3 days]',
      dependencies: '[Final approval received]',
    },
    {
      phase: 'Phase 4',
      task: 'Optimization / Handoff',
      description: 'Post-launch optimization or project closeout',
      owner: 'Hive',
      duration: '[Ongoing / 1–2 weeks]',
      dependencies: '[Launch complete]',
    },
  ],
  clientResponsibilities: [
    'Provide timely feedback within agreed review windows (typically 3–5 business days unless otherwise noted).',
    'Supply required inputs, assets, or access by the dates specified in the timeline.',
    'Designate a single point of contact for approvals and decisions.',
    'Communicate any changes to priorities, scope, or availability as early as possible.',
    'Delays in client feedback or approvals may result in corresponding shifts to downstream milestones.',
  ],
  assumptions: [
    'Scope remains as defined in the Statement of Work or project brief.',
    'Feedback will be consolidated and provided within agreed timelines.',
    'All required assets and access will be provided by the client as needed.',
    'This timeline assumes [X] rounds of revisions; additional revisions may extend the schedule.',
    'Additional scope or deliverables may require a timeline adjustment or SOW amendment.',
    '[Add any project-specific assumptions here.]',
  ],
  changeManagementNote:
    'If project scope, priorities, or requirements change during the engagement, Hive will communicate the impact on the timeline and deliverables. Minor adjustments will be reflected in an updated version of this document. Major changes may require a revised timeline, additional budget discussion, or a SOW amendment. All changes will be documented and agreed upon by both parties before proceeding.',
};
