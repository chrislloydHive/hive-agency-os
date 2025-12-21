// lib/airtable/selectCoercion.ts
// Strict coercion helpers for Client Insights single-select fields.
// Prevents Airtable 422 errors by mapping AI outputs to exact allowlist values.

/**
 * Airtable Category options (from screenshot - exact values)
 */
const CATEGORY_ALLOWLIST = [
  'brand',
  'content',
  'seo',
  'website',
  'analytics',
  'demand',
  'ops',
  'competitive',
  'structural',
  'product',
  'other',
] as const;

type InsightCategory = (typeof CATEGORY_ALLOWLIST)[number];

/**
 * Category synonym mappings - map common AI outputs to allowed values
 */
const CATEGORY_SYNONYMS: Record<string, InsightCategory> = {
  // Brand-related
  positioning: 'brand',
  messaging: 'brand',
  trust: 'brand',
  visual: 'brand',
  identity: 'brand',
  voice: 'brand',
  tone: 'brand',
  branding: 'brand',

  // Audience/ICP → brand (no 'audience' or 'strategy' in Airtable)
  audience: 'brand',
  audiencefit: 'brand',
  audience_fit: 'brand',
  icp: 'brand',
  targeting: 'brand',
  persona: 'brand',

  // Competition → competitive
  competition: 'competitive',
  competitors: 'competitive',
  competitor: 'competitive',

  // Conversion/Funnel → demand
  conversion: 'demand',
  funnel: 'demand',
  leads: 'demand',
  pipeline: 'demand',

  // Media → demand (no 'media' in Airtable)
  media: 'demand',
  paid: 'demand',
  paid_search: 'demand',
  advertising: 'demand',
  ads: 'demand',

  // Strategy → structural (no 'strategy' in Airtable)
  strategy: 'structural',
  planning: 'structural',
  roadmap: 'structural',

  // Operations → ops
  operations: 'ops',
  process: 'ops',
  workflow: 'ops',

  // Technical → website
  technical: 'website',
  performance: 'website',
  speed: 'website',
  ux: 'website',
  ui: 'website',

  // Analytics synonyms
  data: 'analytics',
  metrics: 'analytics',
  tracking: 'analytics',
  reporting: 'analytics',
};

/**
 * Normalize input string for matching
 */
function normalize(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s-]/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Coerce AI output to valid Airtable Category option.
 * @returns Exact Airtable option string, never creates new options.
 */
export function coerceInsightCategory(input: unknown): InsightCategory {
  const normalized = normalize(input);
  if (!normalized) return 'other';

  // Direct match to allowlist
  if (CATEGORY_ALLOWLIST.includes(normalized as InsightCategory)) {
    return normalized as InsightCategory;
  }

  // Synonym mapping
  if (normalized in CATEGORY_SYNONYMS) {
    return CATEGORY_SYNONYMS[normalized];
  }

  // Partial match - check if normalized starts with or contains an allowed value
  for (const allowed of CATEGORY_ALLOWLIST) {
    if (normalized.includes(allowed) || allowed.includes(normalized)) {
      return allowed;
    }
  }

  return 'other';
}

// ============================================================================
// Severity
// ============================================================================

const SEVERITY_ALLOWLIST = ['low', 'medium', 'high', 'critical'] as const;
type InsightSeverity = (typeof SEVERITY_ALLOWLIST)[number];

const SEVERITY_SYNONYMS: Record<string, InsightSeverity> = {
  minor: 'low',
  minimal: 'low',
  slight: 'low',

  moderate: 'medium',
  normal: 'medium',
  average: 'medium',

  major: 'high',
  significant: 'high',
  important: 'high',
  severe: 'high',

  urgent: 'critical',
  blocker: 'critical',
  showstopper: 'critical',
};

/**
 * Coerce AI output to valid Airtable Severity option.
 * @returns Exact Airtable option string, defaults to 'medium'.
 */
export function coerceInsightSeverity(input: unknown): InsightSeverity {
  const normalized = normalize(input);
  if (!normalized) return 'medium';

  // Direct match
  if (SEVERITY_ALLOWLIST.includes(normalized as InsightSeverity)) {
    return normalized as InsightSeverity;
  }

  // Synonym mapping
  if (normalized in SEVERITY_SYNONYMS) {
    return SEVERITY_SYNONYMS[normalized];
  }

  return 'medium';
}

// ============================================================================
// Source Type
// ============================================================================

const SOURCE_TYPE_ALLOWLIST = ['tool_run', 'document', 'manual'] as const;
type InsightSourceType = (typeof SOURCE_TYPE_ALLOWLIST)[number];

const SOURCE_TYPE_SYNONYMS: Record<string, InsightSourceType> = {
  // Tool run synonyms
  lab: 'tool_run',
  gap: 'tool_run',
  diagnostic: 'tool_run',
  run: 'tool_run',
  tool: 'tool_run',
  automated: 'tool_run',
  auto: 'tool_run',
  ai: 'tool_run',
  system: 'tool_run',
  brandlab: 'tool_run',
  websitelab: 'tool_run',
  gapplan: 'tool_run',

  // Document synonyms
  doc: 'document',
  file: 'document',
  upload: 'document',
  imported: 'document',

  // Manual synonyms
  human: 'manual',
  user: 'manual',
  entry: 'manual',
};

/**
 * Coerce AI output to valid Airtable Source Type option.
 * @returns Exact Airtable option string, defaults to 'tool_run'.
 */
export function coerceInsightSourceType(input: unknown): InsightSourceType {
  const normalized = normalize(input);
  if (!normalized) return 'tool_run';

  // Direct match
  if (SOURCE_TYPE_ALLOWLIST.includes(normalized as InsightSourceType)) {
    return normalized as InsightSourceType;
  }

  // Synonym mapping
  if (normalized in SOURCE_TYPE_SYNONYMS) {
    return SOURCE_TYPE_SYNONYMS[normalized];
  }

  return 'tool_run';
}

// ============================================================================
// Debug helper for logging coercions
// ============================================================================

/**
 * Log coercion only when the value was actually changed.
 */
export function logCoercionIfChanged(
  field: string,
  original: unknown,
  coerced: string
): void {
  const originalStr = typeof original === 'string' ? original : String(original);
  const normalizedOriginal = normalize(original);

  // Only log if the value was actually transformed
  if (normalizedOriginal !== coerced) {
    console.log(`[ClientInsights] Coerced ${field}:`, {
      from: originalStr,
      to: coerced,
    });
  }
}
