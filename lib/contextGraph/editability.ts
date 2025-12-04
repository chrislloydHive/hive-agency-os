// lib/contextGraph/editability.ts
// Field-level editability rules for Context Graph

/**
 * Editability result for a field
 */
export interface FieldEditability {
  editable: boolean;
  reason?: string;
}

/**
 * Read-only field patterns - fields maintained automatically by Hive tools
 * These patterns are matched against the start of the path
 */
const READ_ONLY_PATTERNS = [
  // RULE A: System-generated fields
  'website.',
  'seo.',
  'content.',
  'performanceMedia.performance.',
  'performanceMedia.forecast.',
  'performanceMedia.actuals.',
  'analytics.',
  'diagnostics.',
  'competitive.',
  // Audience discovery is automated
  'audience.discovery.',
];

/**
 * Explicitly editable field patterns - strategic input fields
 * These patterns override read-only rules when more specific
 */
const EDITABLE_PATTERNS = [
  // RULE B: Strategic input fields
  'identity.',
  'brand.',
  'objectives.',
  'productOffer.',
  'digitalInfra.',
  'ops.',
  'budgetOps.',
  'operationalConstraints.',
  'storeRisk.',
  'historical.',
  'historyRefs.',
  'creative.',
  // Personas are editable
  'audience.personas.',
  // RULE C: Mixed domain - audience editable parts
  'audience.coreSegments',
  'audience.keyBehaviors',
  'audience.psychographics',
  'audience.valueProps',
  'audience.problemsToSolve',
  'audience.jobsToBeDone',
  // RULE C: Mixed domain - media editable parts
  'performanceMedia.objectives.',
  'performanceMedia.constraints.',
];

/**
 * Check if a path matches any pattern in a list
 */
function matchesPattern(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Exact match or starts with pattern
    return path === pattern.replace(/\.$/, '') || path.startsWith(pattern);
  });
}

/**
 * Determine if a field is editable based on its path
 *
 * Rules:
 * 1. Editable patterns take precedence (more specific rules)
 * 2. Read-only patterns block editing
 * 3. Unknown fields default to editable (strategic assumption)
 *
 * @param path - Dot-notation path like "identity.businessName" or "website.technical.coreWebVitals"
 * @returns Editability status with optional reason
 */
export function getFieldEditability(path: string): FieldEditability {
  // Normalize path - remove leading dots, lowercase for comparison
  const normalizedPath = path.replace(/^\.+/, '');

  // Meta fields are never editable
  if (normalizedPath.startsWith('meta.') || normalizedPath === 'meta') {
    return {
      editable: false,
      reason: 'System metadata cannot be edited.',
    };
  }

  // Check editable patterns first (more specific wins)
  if (matchesPattern(normalizedPath, EDITABLE_PATTERNS)) {
    return { editable: true };
  }

  // Check read-only patterns
  if (matchesPattern(normalizedPath, READ_ONLY_PATTERNS)) {
    return {
      editable: false,
      reason: 'This field is maintained automatically by Hive tools.',
    };
  }

  // Default: unknown fields are editable (strategic assumption)
  return { editable: true };
}

/**
 * Get a human-readable explanation of why a field has its editability status
 */
export function getEditabilityExplanation(path: string): string {
  const { editable, reason } = getFieldEditability(path);

  if (!editable) {
    return reason || 'This field cannot be edited.';
  }

  // Explain why it's editable
  const normalizedPath = path.replace(/^\.+/, '');

  if (normalizedPath.startsWith('identity.') || normalizedPath.startsWith('brand.')) {
    return 'Company identity and brand fields can be edited by strategists.';
  }

  if (normalizedPath.startsWith('objectives.')) {
    return 'Strategic objectives can be edited to reflect business goals.';
  }

  if (normalizedPath.startsWith('audience.')) {
    return 'Audience strategy fields can be edited to refine targeting.';
  }

  if (normalizedPath.startsWith('performanceMedia.objectives.') ||
      normalizedPath.startsWith('performanceMedia.constraints.')) {
    return 'Media strategy inputs can be edited to guide campaigns.';
  }

  if (normalizedPath.startsWith('creative.')) {
    return 'Creative strategy fields can be edited to guide creative development.';
  }

  return 'This field can be edited by authorized users.';
}

/**
 * Batch check editability for multiple paths
 */
export function getFieldsEditability(paths: string[]): Map<string, FieldEditability> {
  const result = new Map<string, FieldEditability>();
  for (const path of paths) {
    result.set(path, getFieldEditability(path));
  }
  return result;
}

/**
 * Check if any field in a domain is editable
 */
export function isDomainEditable(domainId: string): boolean {
  // Most domains have some editable fields
  const fullyReadOnlyDomains = ['website', 'seo', 'content', 'analytics', 'diagnostics', 'competitive'];
  return !fullyReadOnlyDomains.includes(domainId);
}
