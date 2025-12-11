// lib/os/detection/detectSchemaSameAs.ts
// Schema.org sameAs parser and extractor

import type { SchemaSignal, SocialPlatform, SignalSource, PLATFORM_DOMAINS } from './types';

/**
 * Schema types that commonly contain sameAs
 */
const SCHEMA_TYPES_WITH_SAMEAS = [
  'Organization',
  'LocalBusiness',
  'WebSite',
  'Person',
  'Brand',
  'Corporation',
  'Restaurant',
  'Store',
  'ProfessionalService',
  'MedicalBusiness',
  'FinancialService',
  'RealEstateAgent',
  'TravelAgency',
  'AutoDealer',
];

/**
 * Extract all JSON-LD blocks from HTML
 */
export function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];

  // Match <script type="application/ld+json">...</script>
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const content = match[1].trim();
      if (content) {
        const parsed = JSON.parse(content);

        // Handle @graph arrays
        if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
          blocks.push(...parsed['@graph']);
        } else if (Array.isArray(parsed)) {
          blocks.push(...parsed);
        } else {
          blocks.push(parsed);
        }
      }
    } catch (e) {
      // Skip invalid JSON
      console.warn('[SchemaSameAs] Failed to parse JSON-LD block:', e);
    }
  }

  return blocks;
}

/**
 * Extract sameAs URLs from a schema object
 */
export function extractSameAsUrls(schema: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const sameAs = schema.sameAs;

  if (typeof sameAs === 'string') {
    urls.push(sameAs);
  } else if (Array.isArray(sameAs)) {
    for (const item of sameAs) {
      if (typeof item === 'string') {
        urls.push(item);
      } else if (typeof item === 'object' && item !== null) {
        // Handle objects with @id or url
        const obj = item as Record<string, unknown>;
        if (typeof obj['@id'] === 'string') urls.push(obj['@id']);
        if (typeof obj.url === 'string') urls.push(obj.url);
      }
    }
  }

  return urls.filter(url => url && url.startsWith('http'));
}

/**
 * Get the schema type (handles @type as string or array)
 */
function getSchemaType(schema: Record<string, unknown>): string {
  const type = schema['@type'];
  if (typeof type === 'string') return type;
  if (Array.isArray(type) && type.length > 0) return String(type[0]);
  return 'Unknown';
}

/**
 * Classify a URL by platform
 */
export function classifyUrl(url: string): { platform: SocialPlatform | 'gbp' | 'other'; confidence: number } {
  const urlLower = url.toLowerCase();

  // Check for GBP
  if (urlLower.includes('google.com/maps') || urlLower.includes('g.page') || urlLower.includes('goo.gl/maps')) {
    return { platform: 'gbp', confidence: 90 };
  }

  // Check social platforms
  const platformChecks: [SocialPlatform, string[]][] = [
    ['facebook', ['facebook.com', 'fb.com', 'fb.me']],
    ['instagram', ['instagram.com', 'instagr.am']],
    ['tiktok', ['tiktok.com']],
    ['youtube', ['youtube.com', 'youtu.be']],
    ['linkedin', ['linkedin.com']],
    ['x', ['twitter.com', 'x.com']],
  ];

  for (const [platform, domains] of platformChecks) {
    for (const domain of domains) {
      if (urlLower.includes(domain)) {
        return { platform, confidence: 95 };
      }
    }
  }

  return { platform: 'other', confidence: 0 };
}

/**
 * Parse all schema.org blocks and extract signals
 */
export function parseSchemaSignals(html: string): {
  signals: SchemaSignal[];
  sameAsUrls: { url: string; schemaType: string; confidence: number }[];
  failures: string[];
} {
  const signals: SchemaSignal[] = [];
  const sameAsUrls: { url: string; schemaType: string; confidence: number }[] = [];
  const failures: string[] = [];

  try {
    const blocks = extractJsonLdBlocks(html);

    if (blocks.length === 0) {
      failures.push('schema-missing: No JSON-LD blocks found');
      return { signals, sameAsUrls, failures };
    }

    for (const block of blocks) {
      const schemaType = getSchemaType(block);

      // Check if this is a type we care about
      const isRelevantType = SCHEMA_TYPES_WITH_SAMEAS.some(t =>
        schemaType.toLowerCase().includes(t.toLowerCase())
      );

      // Extract sameAs from any block
      const urls = extractSameAsUrls(block);

      if (urls.length > 0) {
        for (const url of urls) {
          const classification = classifyUrl(url);
          sameAsUrls.push({
            url,
            schemaType,
            confidence: classification.confidence,
          });
        }
      }

      // Create signal for relevant types
      if (isRelevantType || urls.length > 0) {
        signals.push({
          type: schemaType,
          url: typeof block.url === 'string' ? block.url : null,
          name: typeof block.name === 'string' ? block.name : null,
          sameAs: urls,
          raw: block,
        });
      }
    }

    // Check for unparseable sameAs
    const blocksWithSameAs = blocks.filter(b => b.sameAs !== undefined);
    if (blocksWithSameAs.length > 0 && sameAsUrls.length === 0) {
      failures.push('sameAs-unparseable: sameAs present but could not extract valid URLs');
    }

  } catch (error) {
    failures.push(`schema-parse-error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { signals, sameAsUrls, failures };
}

/**
 * Get social profile URLs from sameAs data
 */
export function getSocialFromSameAs(sameAsUrls: { url: string; schemaType: string; confidence: number }[]): {
  platform: SocialPlatform;
  url: string;
  confidence: number;
  source: SignalSource;
}[] {
  const results: {
    platform: SocialPlatform;
    url: string;
    confidence: number;
    source: SignalSource;
  }[] = [];

  for (const { url, schemaType, confidence } of sameAsUrls) {
    const classification = classifyUrl(url);

    if (classification.platform !== 'gbp' && classification.platform !== 'other') {
      results.push({
        platform: classification.platform,
        url,
        confidence: Math.min(confidence, classification.confidence),
        source: {
          type: 'schema-sameAs',
          value: url,
          confidence: Math.min(confidence, classification.confidence),
          url,
        },
      });
    }
  }

  return results;
}

/**
 * Get GBP URL from sameAs data
 */
export function getGBPFromSameAs(sameAsUrls: { url: string; schemaType: string; confidence: number }[]): {
  url: string;
  confidence: number;
  source: SignalSource;
} | null {
  for (const { url, confidence } of sameAsUrls) {
    const classification = classifyUrl(url);

    if (classification.platform === 'gbp') {
      return {
        url,
        confidence: Math.min(confidence, classification.confidence),
        source: {
          type: 'schema-sameAs',
          value: url,
          confidence: Math.min(confidence, classification.confidence),
          url,
        },
      };
    }
  }

  return null;
}

/**
 * Extract LocalBusiness data that might indicate GBP presence
 */
export function extractLocalBusinessData(signals: SchemaSignal[]): {
  hasLocalBusiness: boolean;
  businessName: string | null;
  address: string | null;
  geo: { lat: number; lng: number } | null;
} {
  for (const signal of signals) {
    if (signal.type.toLowerCase().includes('localbusiness') ||
        signal.type.toLowerCase().includes('organization')) {
      const raw = signal.raw;

      let address: string | null = null;
      if (typeof raw.address === 'string') {
        address = raw.address;
      } else if (typeof raw.address === 'object' && raw.address !== null) {
        const addr = raw.address as Record<string, unknown>;
        address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
          .filter(Boolean)
          .join(', ');
      }

      let geo: { lat: number; lng: number } | null = null;
      if (typeof raw.geo === 'object' && raw.geo !== null) {
        const g = raw.geo as Record<string, unknown>;
        if (typeof g.latitude === 'number' && typeof g.longitude === 'number') {
          geo = { lat: g.latitude, lng: g.longitude };
        }
      }

      return {
        hasLocalBusiness: true,
        businessName: signal.name,
        address,
        geo,
      };
    }
  }

  return {
    hasLocalBusiness: false,
    businessName: null,
    address: null,
    geo: null,
  };
}
