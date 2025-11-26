// lib/pipeline/routingConfig.ts
// Lead routing rules configuration

export interface LeadRoutingRule {
  id: string;
  label: string;
  match: {
    industries?: string[];
    companyTypes?: string[];
    sizeBands?: string[];
    leadSources?: string[];
  };
  owner: string; // rep name or id
}

/**
 * Lead routing rules
 * Rules are evaluated in order - first match wins
 */
export const LEAD_ROUTING_RULES: LeadRoutingRule[] = [
  {
    id: 'saas_enterprise_chris',
    label: 'SaaS + Enterprise → Chris',
    match: {
      industries: ['SaaS', 'Software', 'Technology'],
      sizeBands: ['200+', '51-200'],
    },
    owner: 'Chris',
  },
  {
    id: 'services_mid_market',
    label: 'Services Mid-Market → Jordan',
    match: {
      industries: ['Services', 'Consulting', 'Agency'],
      sizeBands: ['11-50', '51-200'],
    },
    owner: 'Jordan',
  },
  {
    id: 'ecom_all',
    label: 'E-commerce → Alex',
    match: {
      industries: ['eCom', 'E-commerce', 'Retail', 'DTC'],
      companyTypes: ['eCom'],
    },
    owner: 'Alex',
  },
  {
    id: 'inbound_dma',
    label: 'DMA Inbound → Default Rep',
    match: {
      leadSources: ['DMA', 'Marketing Assessment', 'GAP'],
    },
    owner: 'Default Rep',
  },
  {
    id: 'smb_default',
    label: 'SMB → Default Rep',
    match: {
      sizeBands: ['1-10', '11-50'],
    },
    owner: 'Default Rep',
  },
];

/**
 * Default owner when no rules match
 */
export const DEFAULT_OWNER = 'Unassigned';

/**
 * Available team members for routing
 */
export const TEAM_MEMBERS = [
  { id: 'chris', name: 'Chris', specialty: 'Enterprise SaaS' },
  { id: 'jordan', name: 'Jordan', specialty: 'Services & Consulting' },
  { id: 'alex', name: 'Alex', specialty: 'E-commerce' },
  { id: 'default', name: 'Default Rep', specialty: 'General' },
];

/**
 * Match a lead against routing rules
 */
export function matchLeadToRule(params: {
  industry?: string | null;
  companyType?: string | null;
  sizeBand?: string | null;
  leadSource?: string | null;
}): LeadRoutingRule | null {
  const { industry, companyType, sizeBand, leadSource } = params;

  for (const rule of LEAD_ROUTING_RULES) {
    const matchesIndustry =
      !rule.match.industries ||
      rule.match.industries.some(
        (i) => industry?.toLowerCase().includes(i.toLowerCase())
      );

    const matchesType =
      !rule.match.companyTypes ||
      rule.match.companyTypes.some(
        (t) => companyType?.toLowerCase().includes(t.toLowerCase())
      );

    const matchesSize =
      !rule.match.sizeBands ||
      rule.match.sizeBands.some(
        (s) => sizeBand?.includes(s)
      );

    const matchesSource =
      !rule.match.leadSources ||
      rule.match.leadSources.some(
        (src) => leadSource?.toLowerCase().includes(src.toLowerCase())
      );

    // Rule matches if all non-empty conditions match
    if (matchesIndustry && matchesType && matchesSize && matchesSource) {
      return rule;
    }
  }

  return null;
}
