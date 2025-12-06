// lib/contextGraph/fcb/extractors/competitorExtractor.ts
// Competitor Detector Extractor for FCB (Enhanced)
//
// Detects competitors via:
// - Homepage comparison language ("unlike X...", "vs", "alternative to")
// - "Alternatives to X" phrases
// - Footer competitor logos (via link patterns)
// - Link-out patterns to competitor domains
// - Meta tags ("compare", "versus", "switch from")
// - Schema.org competitor mentions
//
// This runs with LOW/MEDIUM confidence only (0.3-0.55) since competitor
// detection from website content is inherently uncertain.
// FCB should only seed, not conclude.

import type { SignalBundle, ExtractorResult, ExtractedField, ExtractorDiagnostic } from '../types';
import type { CompetitorProfile, CompetitorCategory, Substitute } from '../../domains/competitive';
import {
  normalizeCompetitorName,
  normalizeDomain,
  sanitizeCompetitorProfile,
} from '@/lib/labs/competitor/mergeCompetitors';

// ============================================================================
// Types
// ============================================================================

interface DetectedCompetitor {
  name: string;
  domain: string | null;
  confidence: number;
  sources: string[];
  category: CompetitorCategory | null;
}

// ============================================================================
// Patterns for Competitor Detection
// ============================================================================

const COMPETITOR_MENTION_PATTERNS = [
  // Direct comparison patterns
  { pattern: /unlike\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'comparison', confidence: 0.5 },
  { pattern: /compared\s+to\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'comparison', confidence: 0.5 },
  { pattern: /vs\.?\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'comparison', confidence: 0.55 },
  { pattern: /better\s+than\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'comparison', confidence: 0.5 },
  { pattern: /alternative\s+to\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'alternative', confidence: 0.55 },
  { pattern: /instead\s+of\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'comparison', confidence: 0.45 },
  { pattern: /switch\s+from\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'migration', confidence: 0.55 },
  { pattern: /migrate\s+from\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'migration', confidence: 0.55 },
  { pattern: /moving\s+from\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'migration', confidence: 0.5 },
  { pattern: /replacing\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/gi, source: 'replacement', confidence: 0.5 },
  { pattern: /competitors?\s+(?:like\s+)?([A-Z][a-zA-Z0-9]+(?:,?\s*(?:and\s+)?[A-Z][a-zA-Z0-9]+)*)/gi, source: 'explicit_competitor', confidence: 0.55 },
];

// Substitute/category-creep patterns
const SUBSTITUTE_PATTERNS = [
  { pattern: /(?:spreadsheet|excel|sheets|manual|in-house|homegrown)/gi, source: 'diy_substitute' },
  { pattern: /(?:outsourc|freelanc|consultant|agency)/gi, source: 'service_substitute' },
  { pattern: /(?:status quo|do nothing|existing solution)/gi, source: 'inertia' },
];

// Common non-competitor terms to filter out
const FALSE_POSITIVE_TERMS = new Set([
  // Social/tech giants (unless they're actual competitors)
  'google', 'facebook', 'twitter', 'linkedin', 'instagram', 'youtube',
  'chrome', 'safari', 'firefox', 'windows', 'mac', 'ios', 'android',
  'javascript', 'python', 'react', 'angular', 'vue', 'node', 'typescript',
  'amazon', 'aws', 'azure', 'gcp', 'cloudflare', 'vercel', 'netlify',
  // Days and months
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // Common words
  'your', 'our', 'their', 'other', 'another', 'some', 'many',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'about',
  'what', 'when', 'where', 'which', 'who', 'how', 'why',
  // Generic terms
  'company', 'business', 'enterprise', 'startup', 'team', 'user', 'customer',
  'product', 'service', 'solution', 'platform', 'tool', 'software',
]);

// Known competitor domains by category (sample - can be expanded)
const KNOWN_COMPETITOR_PATTERNS: Record<string, string[]> = {
  crm: ['salesforce', 'hubspot', 'pipedrive', 'zoho', 'freshworks', 'zendesk'],
  marketing: ['mailchimp', 'klaviyo', 'activecampaign', 'marketo', 'pardot', 'sendgrid'],
  analytics: ['amplitude', 'mixpanel', 'heap', 'fullstory', 'hotjar', 'posthog'],
  ecommerce: ['shopify', 'bigcommerce', 'woocommerce', 'magento', 'squarespace'],
  project: ['asana', 'trello', 'jira', 'notion', 'clickup', 'basecamp', 'monday'],
};

// ============================================================================
// Main Extractor
// ============================================================================

export async function extractCompetitors(signals: SignalBundle): Promise<ExtractorResult> {
  const fields: ExtractedField[] = [];
  const diagnostics: ExtractorDiagnostic[] = [];

  console.log(`[FCB CompetitorDetector] Detecting competitors for ${signals.companyName}`);

  // Collect all text content
  const allText = collectAllText(signals);
  const allHtml = collectAllHtml(signals);

  // 1. Extract competitor mentions from text
  const textMentions = extractCompetitorMentions(allText);

  // 2. Extract from meta tags
  const metaMentions = extractFromMetaTags(signals);

  // 3. Extract from link patterns (footer logos, competitor links)
  const linkMentions = extractFromLinks(allHtml, signals.domain);

  // 4. Extract from schema.org mentions
  const schemaMentions = extractFromSchemaOrg(signals.schemaOrg);

  // Combine all detected competitors
  const allDetected = new Map<string, DetectedCompetitor>();

  const addDetected = (
    name: string,
    domain: string | null,
    confidence: number,
    source: string,
    category: CompetitorCategory | null
  ) => {
    const normalized = normalizeCompetitorName(name);
    if (!normalized || !isLikelyCompetitor(name)) return;

    if (!allDetected.has(normalized)) {
      allDetected.set(normalized, {
        name: capitalizeFirstLetter(name),
        domain: normalizeDomain(domain),
        confidence: Math.min(0.55, confidence), // Cap at 0.55 for FCB
        sources: [source],
        category,
      });
    } else {
      const existing = allDetected.get(normalized)!;
      // Boost confidence for multiple sources, but cap at 0.55
      existing.confidence = Math.min(0.55, existing.confidence + 0.05);
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      // Prefer domain if we have one
      if (domain && !existing.domain) {
        existing.domain = normalizeDomain(domain);
      }
      // Prefer more specific category
      if (category && (!existing.category || existing.category === 'indirect')) {
        existing.category = category;
      }
    }
  };

  // Add all mentions
  for (const mention of textMentions) {
    addDetected(mention.name, null, mention.confidence, mention.source, 'direct');
  }
  for (const mention of metaMentions) {
    addDetected(mention.name, null, mention.confidence, 'meta_tags', 'direct');
  }
  for (const mention of linkMentions) {
    addDetected(mention.name, mention.domain, mention.confidence, 'links', 'direct');
  }
  for (const mention of schemaMentions) {
    addDetected(mention.name, mention.domain, mention.confidence, 'schema_org', mention.category);
  }

  // Build competitor profiles
  const competitors: CompetitorProfile[] = [];
  allDetected.forEach((data) => {
    competitors.push(sanitizeCompetitorProfile({
      name: data.name,
      domain: data.domain,
      website: data.domain ? `https://${data.domain}` : null,
      category: data.category,
      positioning: null,
      estimatedBudget: null,
      primaryChannels: [],
      strengths: [],
      weaknesses: [],
      uniqueClaims: [],
      offers: [],
      pricingSummary: null,
      pricingNotes: null,
      notes: `Detected via ${data.sources.join(', ')}. Low confidence - needs human verification.`,
      xPosition: null,
      yPosition: null,
      positionPrimary: null,
      positionSecondary: null,
      confidence: data.confidence,
      lastValidatedAt: null,
      trajectory: null,
      trajectoryReason: null,
      provenance: [{
        field: '*',
        source: 'fcb',
        updatedAt: new Date().toISOString(),
        confidence: data.confidence,
      }],
      threatLevel: null,
      threatDrivers: [],
      autoSeeded: true, // FCB-detected competitors are AI-seeded
    }));
  });

  // Add competitor profiles if found
  if (competitors.length > 0) {
    fields.push({
      path: 'competitive.competitors',
      value: competitors,
      confidence: 0.4, // Low confidence - needs human review
      reasoning: `Detected ${competitors.length} potential competitor(s) from website analysis`,
    });

    // Also set primaryCompetitors for legacy compatibility
    fields.push({
      path: 'competitive.primaryCompetitors',
      value: competitors,
      confidence: 0.4,
      reasoning: `Legacy alias for competitors field`,
    });

    diagnostics.push({
      code: 'competitors_detected',
      message: `Found ${competitors.length} potential competitor(s): ${competitors.map(c => c.name).join(', ')}`,
      severity: 'info',
    });
  } else {
    diagnostics.push({
      code: 'no_competitors_found',
      message: 'No competitor mentions detected on website. Competitor Lab can propose competitors.',
      severity: 'info',
    });
  }

  // Extract substitutes (category-creep competitors)
  const substitutes = extractSubstitutes(allText);
  if (substitutes.length > 0) {
    fields.push({
      path: 'competitive.substitutes',
      value: substitutes,
      confidence: 0.35,
      reasoning: 'Detected potential substitute solutions mentioned on website',
    });

    diagnostics.push({
      code: 'substitutes_detected',
      message: `Found ${substitutes.length} potential substitute(s): ${substitutes.map(s => s.name).join(', ')}`,
      severity: 'info',
    });
  }

  // Extract positioning clues
  const positioningClues = extractPositioningClues(allText);
  if (positioningClues) {
    fields.push({
      path: 'competitive.positioningSummary',
      value: positioningClues,
      confidence: 0.4,
      reasoning: 'Extracted from competitive positioning language on website',
    });
  }

  // Infer positioning axes from industry/content
  const positioningAxes = inferPositioningAxes(signals, allText);
  if (positioningAxes) {
    fields.push({
      path: 'competitive.positioningAxes',
      value: positioningAxes,
      confidence: 0.3, // Very low confidence - just a suggestion
      reasoning: 'Inferred default positioning axes for industry',
    });

    // Also set as strings for new schema
    fields.push({
      path: 'competitive.primaryAxis',
      value: positioningAxes.primaryAxis.label,
      confidence: 0.3,
      reasoning: 'Inferred from industry signals',
    });
    fields.push({
      path: 'competitive.secondaryAxis',
      value: positioningAxes.secondaryAxis.label,
      confidence: 0.3,
      reasoning: 'Inferred from industry signals',
    });
  }

  // Set data confidence (overall)
  if (fields.length > 0) {
    const avgConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;
    fields.push({
      path: 'competitive.dataConfidence',
      value: avgConfidence,
      confidence: 1.0,
      reasoning: 'Average confidence of FCB-extracted competitive data',
    });

    fields.push({
      path: 'competitive.lastValidatedAt',
      value: new Date().toISOString(),
      confidence: 1.0,
      reasoning: 'FCB extraction timestamp',
    });
  }

  return {
    fields,
    diagnostics,
    source: 'fcb',
  };
}

// ============================================================================
// Text Collection
// ============================================================================

function collectAllText(signals: SignalBundle): string {
  const texts: string[] = [];

  if (signals.homepage?.text) texts.push(signals.homepage.text);
  if (signals.aboutPage?.text) texts.push(signals.aboutPage.text);
  if (signals.servicesPage?.text) texts.push(signals.servicesPage.text);
  if (signals.pricingPage?.text) texts.push(signals.pricingPage.text);
  if (signals.metaTags?.description) texts.push(signals.metaTags.description);

  return texts.join('\n\n');
}

function collectAllHtml(signals: SignalBundle): string {
  const htmls: string[] = [];

  if (signals.homepage?.html) htmls.push(signals.homepage.html);
  if (signals.aboutPage?.html) htmls.push(signals.aboutPage.html);

  return htmls.join('\n\n');
}

// ============================================================================
// Competitor Detection Methods
// ============================================================================

function extractCompetitorMentions(text: string): Array<{ name: string; confidence: number; source: string }> {
  const mentions: Array<{ name: string; confidence: number; source: string }> = [];

  for (const { pattern, source, confidence } of COMPETITOR_MENTION_PATTERNS) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for each pattern
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (name && name.length >= 2 && name.length <= 40) {
        // Split on commas and "and" for lists
        const names = name.split(/,\s*(?:and\s+)?|\s+and\s+/);
        for (const n of names) {
          const trimmed = n.trim();
          if (trimmed.length >= 2) {
            mentions.push({
              name: trimmed,
              confidence,
              source,
            });
          }
        }
      }
    }
  }

  return mentions;
}

function extractFromMetaTags(signals: SignalBundle): Array<{ name: string; confidence: number }> {
  const mentions: Array<{ name: string; confidence: number }> = [];

  const metaText = [
    signals.metaTags?.title,
    signals.metaTags?.description,
    signals.metaTags?.keywords,
    signals.openGraph?.title,
    signals.openGraph?.description,
  ].filter(Boolean).join(' ');

  // Look for "vs X" or "alternative to X" in meta
  const vsPattern = /(?:vs|versus|alternative to)\s+([A-Z][a-zA-Z0-9]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = vsPattern.exec(metaText)) !== null) {
    mentions.push({
      name: match[1],
      confidence: 0.5,
    });
  }

  return mentions;
}

function extractFromLinks(html: string, ownDomain: string): Array<{ name: string; domain: string; confidence: number }> {
  const mentions: Array<{ name: string; domain: string; confidence: number }> = [];

  // Look for competitor comparison links
  const linkPattern = /href=["']https?:\/\/([^"'/]+)/gi;
  let match: RegExpExecArray | null;

  const ownDomainNorm = normalizeDomain(ownDomain) || '';
  const seenDomains = new Set<string>();

  while ((match = linkPattern.exec(html)) !== null) {
    const domain = match[1].toLowerCase().replace(/^www\./, '');

    // Skip own domain and common non-competitor domains
    if (domain === ownDomainNorm) continue;
    if (seenDomains.has(domain)) continue;
    if (isCommonNonCompetitorDomain(domain)) continue;

    // Check if this looks like a competitor domain
    for (const [category, competitors] of Object.entries(KNOWN_COMPETITOR_PATTERNS)) {
      for (const comp of competitors) {
        if (domain.includes(comp)) {
          seenDomains.add(domain);
          mentions.push({
            name: capitalizeFirstLetter(comp),
            domain,
            confidence: 0.45,
          });
        }
      }
    }
  }

  return mentions;
}

function extractFromSchemaOrg(schemaOrg?: object): Array<{ name: string; domain: string | null; confidence: number; category: CompetitorCategory | null }> {
  const mentions: Array<{ name: string; domain: string | null; confidence: number; category: CompetitorCategory | null }> = [];

  if (!schemaOrg) return mentions;

  // Schema.org can contain competitor references in various places
  // This is a simplified implementation
  const schemaStr = JSON.stringify(schemaOrg);

  // Look for mentions of "competitor" or "competitor" type data
  // This would need more sophisticated parsing for production

  return mentions;
}

function extractSubstitutes(text: string): Substitute[] {
  const substitutes: Substitute[] = [];
  const seen = new Set<string>();

  // Look for "instead of spreadsheets", "replace manual processes", etc.
  const patterns = [
    { regex: /(?:instead of|replace|replacing|no more)\s+(spreadsheets?|excel|manual\s+\w+)/gi, name: 'Spreadsheets/Manual Process', category: 'DIY' },
    { regex: /(?:instead of|replace|replacing)\s+(hiring|outsourc\w+|freelanc\w+|agenc\w+|consultant\w*)/gi, name: 'Outsourcing/Services', category: 'Service' },
    { regex: /(?:stop|quit|eliminate)\s+(doing\s+it\s+yourself|in-?house|homegrown)/gi, name: 'In-house Solutions', category: 'DIY' },
  ];

  for (const { regex, name, category } of patterns) {
    if (regex.test(text) && !seen.has(name)) {
      seen.add(name);
      substitutes.push({
        name,
        domain: null,
        reasonCustomersChooseThem: 'Cost savings or familiarity',
        category,
        threatLevel: 30,
        counterStrategy: null,
      });
    }
    regex.lastIndex = 0;
  }

  return substitutes;
}

// ============================================================================
// Filtering & Validation
// ============================================================================

function isLikelyCompetitor(name: string): boolean {
  const normalized = name.toLowerCase().trim();

  // Filter out false positives
  if (FALSE_POSITIVE_TERMS.has(normalized)) {
    return false;
  }

  // Filter out single letters or very short names
  if (name.length < 3) {
    return false;
  }

  // Filter out names that are all lowercase (likely not a brand)
  if (name === name.toLowerCase() && !/[A-Z]/.test(name)) {
    return false;
  }

  // Filter out names with too many spaces (likely a phrase, not a brand)
  if ((name.match(/\s/g) || []).length > 2) {
    return false;
  }

  return true;
}

function isCommonNonCompetitorDomain(domain: string): boolean {
  const nonCompetitorDomains = [
    'google.com', 'facebook.com', 'twitter.com', 'linkedin.com',
    'youtube.com', 'instagram.com', 'tiktok.com', 'pinterest.com',
    'github.com', 'stackoverflow.com', 'medium.com', 'wordpress.com',
    'cloudflare.com', 'amazonaws.com', 'googleapis.com',
    'fonts.googleapis.com', 'cdn.', 'static.',
    'w3.org', 'schema.org',
  ];

  return nonCompetitorDomains.some(d => domain.includes(d));
}

// ============================================================================
// Positioning Detection
// ============================================================================

function extractPositioningClues(text: string): string | null {
  // Look for "why us" or "why choose us" sections
  const patterns = [
    /why\s+(?:choose\s+)?(?:us|[a-z]+)\??\s*[:.]?\s*([^.!?]{50,300})/gi,
    /what\s+makes\s+us\s+different\??\s*[:.]?\s*([^.!?]{50,300})/gi,
    /our\s+difference\s*[:.]?\s*([^.!?]{50,300})/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function inferPositioningAxes(
  signals: SignalBundle,
  text: string
): { primaryAxis: { label: string; lowLabel: string; highLabel: string; description: string | null }; secondaryAxis: { label: string; lowLabel: string; highLabel: string; description: string | null } } | null {
  const lowercaseText = text.toLowerCase();

  // Detect industry signals to customize axes
  const isSoftware = lowercaseText.includes('software') || lowercaseText.includes('saas') || lowercaseText.includes('platform');
  const isService = lowercaseText.includes('service') || lowercaseText.includes('consulting') || lowercaseText.includes('agency');
  const isEcommerce = lowercaseText.includes('ecommerce') || lowercaseText.includes('e-commerce') || lowercaseText.includes('shop');
  const isB2B = lowercaseText.includes('b2b') || lowercaseText.includes('enterprise') || lowercaseText.includes('business');

  if (isSoftware && isB2B) {
    return {
      primaryAxis: {
        label: 'Enterprise ↔ SMB',
        lowLabel: 'SMB Focus',
        highLabel: 'Enterprise Focus',
        description: 'Target customer size',
      },
      secondaryAxis: {
        label: 'Full Suite ↔ Best of Breed',
        lowLabel: 'Point Solution',
        highLabel: 'Full Platform',
        description: 'Product scope',
      },
    };
  }

  if (isService) {
    return {
      primaryAxis: {
        label: 'Premium ↔ Affordable',
        lowLabel: 'Budget-Friendly',
        highLabel: 'Premium',
        description: 'Price positioning',
      },
      secondaryAxis: {
        label: 'Specialized ↔ Full Service',
        lowLabel: 'Specialized',
        highLabel: 'Full Service',
        description: 'Service scope',
      },
    };
  }

  if (isEcommerce) {
    return {
      primaryAxis: {
        label: 'Luxury ↔ Value',
        lowLabel: 'Value-Focused',
        highLabel: 'Luxury',
        description: 'Brand positioning',
      },
      secondaryAxis: {
        label: 'Niche ↔ Mass Market',
        lowLabel: 'Niche',
        highLabel: 'Mass Market',
        description: 'Market breadth',
      },
    };
  }

  // Generic default
  return {
    primaryAxis: {
      label: 'Premium ↔ Affordable',
      lowLabel: 'Budget-Friendly',
      highLabel: 'Premium',
      description: 'Price positioning',
    },
    secondaryAxis: {
      label: 'Simple ↔ Comprehensive',
      lowLabel: 'Simple',
      highLabel: 'Comprehensive',
      description: 'Solution complexity',
    },
  };
}

// ============================================================================
// Utilities
// ============================================================================

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
