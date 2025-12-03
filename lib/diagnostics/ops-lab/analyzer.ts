// lib/diagnostics/ops-lab/analyzer.ts
// Ops Lab Analyzer - Collects signals for marketing ops & analytics analysis
//
// Analyzes:
// - Tracking & instrumentation setup (GA4, GTM, pixels)
// - Data quality signals (UTM usage, naming conventions)
// - CRM detection (HubSpot, Salesforce, etc.)
// - Automation platforms (HubSpot, Marketo, etc.)
// - Experimentation tools (Optimizely, VWO, etc.)

import type {
  OpsLabAnalyzerInput,
  OpsLabAnalyticsSnapshot,
  OpsDataConfidence,
  OpsLabFindings,
} from './types';
import { getWorkspaceSettings } from '@/lib/os/workspaceSettings';

// ============================================================================
// Types
// ============================================================================

export interface OpsAnalyzerOutput {
  companyId?: string;
  url: string;
  companyType?: string | null;

  // Analytics snapshot
  analyticsSnapshot: OpsLabAnalyticsSnapshot;

  // Detection flags
  hasGa4: boolean;
  hasGtm: boolean;
  hasFacebookPixel: boolean;
  hasLinkedinInsight: boolean;
  hasGoogleAds: boolean;
  hasCrm: boolean;
  hasAutomationPlatform: boolean;
  hasExperimentationTool: boolean;

  // Detected tools
  trackingTools: string[];
  crmTools: string[];
  automationTools: string[];
  experimentationTools: string[];

  // UTM and data quality signals
  utmUsageLevel: 'none' | 'basic' | 'consistent';
  hasCleanUrlStructure: boolean;
  hasConversionTracking: boolean;

  // Data confidence
  dataConfidence: OpsDataConfidence;

  // Findings
  findings: OpsLabFindings;
}

// ============================================================================
// Tool Detection Patterns
// ============================================================================

const TRACKING_PATTERNS = {
  ga4: [
    'google-analytics.com/g/collect',
    'googletagmanager.com/gtag',
    'gtag(',
    'GA4',
    'G-',
  ],
  gtm: [
    'googletagmanager.com/gtm',
    'GTM-',
    'google_tag_manager',
  ],
  facebookPixel: [
    'connect.facebook.net',
    'fbevents.js',
    'fbq(',
    'facebook.com/tr',
  ],
  linkedinInsight: [
    'snap.licdn.com',
    'linkedin.com/px',
    '_linkedin_data_partner_id',
    'linkedin-insight',
  ],
  googleAds: [
    'googleads.g.doubleclick.net',
    'google.com/pagead',
    'googleadservices.com',
    'gtag_report_conversion',
  ],
  hotjar: [
    'hotjar.com',
    'hj(',
    '_hjSettings',
  ],
  mixpanel: [
    'mixpanel.com',
    'mixpanel.init',
  ],
  segment: [
    'segment.com',
    'analytics.js',
    'analytics.identify',
  ],
  heap: [
    'heap.io',
    'heapanalytics.com',
  ],
  amplitude: [
    'amplitude.com',
    'amplitude.getInstance',
  ],
};

const CRM_PATTERNS = {
  hubspot: [
    'hs-scripts.com',
    'hubspot.com',
    'hbspt.',
    '_hsq',
    'hubspot-forms',
    'hs-form',
  ],
  salesforce: [
    'salesforce.com',
    'pardot.com',
    'force.com',
    'salesforceiq',
  ],
  pipedrive: [
    'pipedrive.com',
    'pipedriveforms',
  ],
  close: [
    'close.com',
    'closeio',
  ],
  zoho: [
    'zoho.com',
    'zohocrm',
  ],
  freshsales: [
    'freshsales.io',
    'freshworks',
  ],
};

const AUTOMATION_PATTERNS = {
  hubspotMarketing: [
    'hs-scripts.com',
    'hubspot.com',
    '_hsq',
  ],
  marketo: [
    'marketo.com',
    'munchkin.js',
    'mktoForms',
  ],
  mailchimp: [
    'mailchimp.com',
    'list-manage.com',
    'mc.js',
  ],
  activecamp: [
    'activecampaign.com',
    'ac.js',
  ],
  klaviyo: [
    'klaviyo.com',
    '_learnq',
  ],
  intercom: [
    'intercom.io',
    'intercomSettings',
  ],
  drift: [
    'drift.com',
    'driftt.com',
  ],
  customerio: [
    'customer.io',
    '_cio',
  ],
};

const EXPERIMENTATION_PATTERNS = {
  optimizely: [
    'optimizely.com',
    'optimizelyEndUserId',
  ],
  vwo: [
    'visualwebsiteoptimizer.com',
    'vwo_',
  ],
  googleOptimize: [
    'optimize.google.com',
    'google_optimize',
  ],
  launchDarkly: [
    'launchdarkly.com',
    'ld-',
  ],
  splitio: [
    'split.io',
  ],
  abTasty: [
    'abtasty.com',
  ],
};

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze ops & analytics signals from website and existing data
 */
export async function analyzeOpsInputs(
  input: OpsLabAnalyzerInput
): Promise<OpsAnalyzerOutput> {
  const { companyId, url, companyType, workspaceId, htmlSummary, techStackSignals } = input;

  console.log('[OpsAnalyzer] Starting analysis for:', url);

  // Initialize findings
  const findings: OpsLabFindings = {
    trackingDetected: { tools: [], notes: [] },
    crmSignals: { tools: [], notes: [] },
    automationSignals: { tools: [], notes: [] },
    processSignals: { notes: [] },
  };

  // Check workspace integrations (GA4/GSC connected via OAuth)
  let workspaceHasGa4 = false;
  let workspaceHasGsc = false;
  if (workspaceId) {
    const settings = await getWorkspaceSettings(workspaceId);
    if (settings) {
      workspaceHasGa4 = !!settings.ga4RefreshToken && !!settings.ga4PropertyId;
      workspaceHasGsc = !!settings.gscRefreshToken && !!settings.gscPropertyUri;
      console.log('[OpsAnalyzer] Workspace integrations:', { workspaceHasGa4, workspaceHasGsc });
    }
  }

  // Get HTML content to analyze (from snapshot or crawl)
  const htmlContent = htmlSummary?.html || htmlSummary?.rawHtml || '';
  const scriptContent = htmlSummary?.scripts?.join(' ') || '';
  const combinedContent = `${htmlContent} ${scriptContent}`.toLowerCase();

  // Detect tracking tools (combine HTML detection + workspace integrations)
  const trackingTools: string[] = [];
  const hasGa4FromHtml = detectPattern(combinedContent, TRACKING_PATTERNS.ga4);
  const hasGa4 = hasGa4FromHtml || workspaceHasGa4;
  const hasGtm = detectPattern(combinedContent, TRACKING_PATTERNS.gtm);
  const hasFacebookPixel = detectPattern(combinedContent, TRACKING_PATTERNS.facebookPixel);
  const hasLinkedinInsight = detectPattern(combinedContent, TRACKING_PATTERNS.linkedinInsight);
  const hasGoogleAds = detectPattern(combinedContent, TRACKING_PATTERNS.googleAds);

  if (hasGa4) trackingTools.push('GA4');
  if (workspaceHasGsc) trackingTools.push('GSC');
  if (hasGtm) trackingTools.push('GTM');
  if (hasFacebookPixel) trackingTools.push('Facebook Pixel');
  if (hasLinkedinInsight) trackingTools.push('LinkedIn Insight');
  if (hasGoogleAds) trackingTools.push('Google Ads');
  if (detectPattern(combinedContent, TRACKING_PATTERNS.hotjar)) trackingTools.push('Hotjar');
  if (detectPattern(combinedContent, TRACKING_PATTERNS.mixpanel)) trackingTools.push('Mixpanel');
  if (detectPattern(combinedContent, TRACKING_PATTERNS.segment)) trackingTools.push('Segment');
  if (detectPattern(combinedContent, TRACKING_PATTERNS.heap)) trackingTools.push('Heap');
  if (detectPattern(combinedContent, TRACKING_PATTERNS.amplitude)) trackingTools.push('Amplitude');

  findings.trackingDetected.tools = trackingTools;
  if (hasGa4) {
    if (workspaceHasGa4 && !hasGa4FromHtml) {
      findings.trackingDetected.notes.push('GA4 connected via workspace integration');
    } else {
      findings.trackingDetected.notes.push('GA4 analytics detected');
    }
  }
  if (workspaceHasGsc) {
    findings.trackingDetected.notes.push('Google Search Console connected via workspace integration');
  }
  if (hasGtm) findings.trackingDetected.notes.push('Google Tag Manager detected - good for tag governance');
  if (!hasGa4 && !hasGtm) findings.trackingDetected.notes.push('No standard analytics detected');

  // Detect CRM tools
  const crmTools: string[] = [];
  let hasCrm = false;

  for (const [crm, patterns] of Object.entries(CRM_PATTERNS)) {
    if (detectPattern(combinedContent, patterns)) {
      hasCrm = true;
      const crmName = formatToolName(crm);
      crmTools.push(crmName);
      findings.crmSignals.tools.push(crmName);
    }
  }

  if (!hasCrm) {
    findings.crmSignals.notes.push('No CRM integration detected on website');
  }

  // Detect automation tools
  const automationTools: string[] = [];
  let hasAutomationPlatform = false;

  for (const [tool, patterns] of Object.entries(AUTOMATION_PATTERNS)) {
    if (detectPattern(combinedContent, patterns)) {
      hasAutomationPlatform = true;
      const toolName = formatToolName(tool);
      automationTools.push(toolName);
      findings.automationSignals.tools.push(toolName);
    }
  }

  if (!hasAutomationPlatform) {
    findings.automationSignals.notes.push('No marketing automation platform detected');
  }

  // Detect experimentation tools
  const experimentationTools: string[] = [];
  let hasExperimentationTool = false;

  for (const [tool, patterns] of Object.entries(EXPERIMENTATION_PATTERNS)) {
    if (detectPattern(combinedContent, patterns)) {
      hasExperimentationTool = true;
      experimentationTools.push(formatToolName(tool));
    }
  }

  // Analyze UTM usage
  const utmUsageLevel = analyzeUtmUsage(htmlContent, techStackSignals);

  // Check for clean URL structure
  const hasCleanUrlStructure = analyzeUrlStructure(url, htmlContent);

  // Check for conversion tracking
  const hasConversionTracking = hasGa4 || hasGoogleAds ||
    combinedContent.includes('conversion') ||
    combinedContent.includes('thank-you') ||
    combinedContent.includes('thank_you');

  // Note: GA4 event volume could be fetched here if needed in the future
  // For now, we focus on detection-based analysis
  const eventVolumeLast30d: number | null = null;

  // Build analytics snapshot
  const analyticsSnapshot: OpsLabAnalyticsSnapshot = {
    trackingStack: trackingTools,
    hasGa4,
    hasGsc: workspaceHasGsc,
    hasGtm,
    hasFacebookPixel,
    hasLinkedinInsight,
    hasCrm,
    hasAutomationPlatform,
    eventVolumeLast30d,
    utmUsageLevel,
  };

  // Compute data confidence
  const dataConfidence = computeOpsDataConfidence(analyticsSnapshot);

  // Add process signals
  if (hasGtm) {
    findings.processSignals.notes.push('GTM present - indicates some tag governance');
  }
  if (utmUsageLevel === 'consistent') {
    findings.processSignals.notes.push('Consistent UTM usage detected');
  } else if (utmUsageLevel === 'none') {
    findings.processSignals.notes.push('No UTM parameters detected - attribution may be limited');
  }
  if (hasExperimentationTool) {
    findings.processSignals.notes.push(`Experimentation tool detected: ${experimentationTools.join(', ')}`);
  }

  console.log('[OpsAnalyzer] Analysis complete:', {
    trackingTools: trackingTools.length,
    crmTools: crmTools.length,
    automationTools: automationTools.length,
    hasExperimentation: hasExperimentationTool,
    dataConfidence: dataConfidence.level,
  });

  return {
    companyId,
    url,
    companyType,
    analyticsSnapshot,
    hasGa4,
    hasGtm,
    hasFacebookPixel,
    hasLinkedinInsight,
    hasGoogleAds,
    hasCrm,
    hasAutomationPlatform,
    hasExperimentationTool,
    trackingTools,
    crmTools,
    automationTools,
    experimentationTools,
    utmUsageLevel,
    hasCleanUrlStructure,
    hasConversionTracking,
    dataConfidence,
    findings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function detectPattern(content: string, patterns: string[]): boolean {
  return patterns.some((pattern) => content.includes(pattern.toLowerCase()));
}

function formatToolName(key: string): string {
  const names: Record<string, string> = {
    hubspot: 'HubSpot',
    hubspotMarketing: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    close: 'Close',
    zoho: 'Zoho',
    freshsales: 'Freshsales',
    marketo: 'Marketo',
    mailchimp: 'Mailchimp',
    activecamp: 'ActiveCampaign',
    klaviyo: 'Klaviyo',
    intercom: 'Intercom',
    drift: 'Drift',
    customerio: 'Customer.io',
    optimizely: 'Optimizely',
    vwo: 'VWO',
    googleOptimize: 'Google Optimize',
    launchDarkly: 'LaunchDarkly',
    splitio: 'Split.io',
    abTasty: 'AB Tasty',
  };
  return names[key] || key;
}

function analyzeUtmUsage(
  htmlContent: string,
  techStackSignals?: any
): 'none' | 'basic' | 'consistent' {
  const content = htmlContent.toLowerCase();

  // Check for UTM parameters in links
  const hasUtmSource = content.includes('utm_source');
  const hasUtmMedium = content.includes('utm_medium');
  const hasUtmCampaign = content.includes('utm_campaign');

  // Check tech stack signals if available
  const utmFromSignals = techStackSignals?.utmUsageLevel;
  if (utmFromSignals) return utmFromSignals;

  if (hasUtmSource && hasUtmMedium && hasUtmCampaign) {
    return 'consistent';
  } else if (hasUtmSource || hasUtmMedium || hasUtmCampaign) {
    return 'basic';
  }
  return 'none';
}

function analyzeUrlStructure(url: string, htmlContent: string): boolean {
  // Check for clean URL patterns
  const hasQueryParams = url.includes('?') && !url.includes('utm_');
  const hasMixedCases = /[A-Z]/.test(url.split('//')[1] || '');
  const hasCleanSlugs = !url.includes('_') || url.includes('-');

  // Check internal links for cleanliness
  const content = htmlContent.toLowerCase();
  const hasCleanInternalLinks = !content.includes('.php?') && !content.includes('.asp?');

  return hasCleanSlugs && hasCleanInternalLinks && !hasMixedCases;
}

/**
 * Compute data confidence based on available signals
 *
 * Base = 30
 * +20 if GA4 present
 * +10 if GSC connected
 * +15 if GTM present
 * +10 if CRM detected
 * +10 if automation platform detected
 * Cap at 100
 */
function computeOpsDataConfidence(snapshot: OpsLabAnalyticsSnapshot): OpsDataConfidence {
  let score = 30; // Base score
  const reasons: string[] = [];

  if (snapshot.hasGa4) {
    score += 20;
    reasons.push('GA4 detected');
  } else {
    reasons.push('No GA4 detected');
  }

  if (snapshot.hasGsc) {
    score += 10;
    reasons.push('GSC connected');
  }

  if (snapshot.hasGtm) {
    score += 15;
    reasons.push('GTM detected');
  }

  if (snapshot.hasCrm) {
    score += 10;
    reasons.push('CRM detected');
  }

  if (snapshot.hasAutomationPlatform) {
    score += 10;
    reasons.push('Automation platform detected');
  }

  // Bonus for additional tracking
  if (snapshot.trackingStack.length > 3) {
    score += 5;
  }

  // Cap at 100
  score = Math.min(100, score);

  // Determine level
  let level: OpsDataConfidence['level'];
  if (score >= 70) {
    level = 'high';
  } else if (score >= 40) {
    level = 'medium';
  } else {
    level = 'low';
  }

  const reason = reasons.length > 0 ? reasons.join(', ') : 'Limited signals available';

  return { score, level, reason };
}
