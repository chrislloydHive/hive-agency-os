// lib/competition-v3/cleanup/selfCompetitorFilter.ts
// Competition Lab V3.6 - 4-Layer Self-Competitor Elimination
//
// Ensures the company itself NEVER appears as a competitor through:
// 1. Exact domain match
// 2. Normalized root domain match
// 3. Name similarity threshold (Levenshtein distance)
// 4. Brand alias comparison (company name variations)
//
// This is a CRITICAL filter - self-competitors must NEVER leak through.

// ============================================================================
// Types
// ============================================================================

export interface SelfCompetitorCheck {
  isMatch: boolean;
  matchType: 'exact-domain' | 'root-domain' | 'name-similarity' | 'brand-alias' | 'none';
  confidence: number;
  reason: string;
}

export interface CompanyIdentity {
  name: string;
  domain?: string | null;
  website?: string | null;
  aliases?: string[];
}

export interface CompetitorCandidate {
  name: string;
  domain?: string | null;
  website?: string | null;
}

// ============================================================================
// Layer 1: Exact Domain Match
// ============================================================================

/**
 * Normalize a domain for comparison
 * Removes protocol, www, paths, and handles edge cases
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;

  let domain = input.toLowerCase().trim();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // Remove trailing slash and path
  domain = domain.split('/')[0];

  // Remove port if present
  domain = domain.split(':')[0];

  // Remove query params
  domain = domain.split('?')[0];

  return domain || null;
}

/**
 * Layer 1: Check for exact domain match
 */
export function checkExactDomainMatch(
  company: CompanyIdentity,
  candidate: CompetitorCandidate
): boolean {
  const companyDomain = normalizeDomain(company.domain || company.website);
  const candidateDomain = normalizeDomain(candidate.domain || candidate.website);

  if (!companyDomain || !candidateDomain) return false;

  return companyDomain === candidateDomain;
}

// ============================================================================
// Layer 2: Root Domain Match
// ============================================================================

/**
 * Extract root domain (e.g., "example.com" from "shop.example.com")
 */
export function extractRootDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;

  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  // Handle common TLDs
  const parts = normalized.split('.');

  // Simple case: example.com -> example.com
  if (parts.length <= 2) return normalized;

  // Handle common country TLDs: example.co.uk -> example.co.uk
  const countryTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in'];
  const lastTwo = parts.slice(-2).join('.');
  if (countryTLDs.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }

  // Default: take last two parts
  return parts.slice(-2).join('.');
}

/**
 * Layer 2: Check for root domain match (handles subdomains)
 */
export function checkRootDomainMatch(
  company: CompanyIdentity,
  candidate: CompetitorCandidate
): boolean {
  const companyRoot = extractRootDomain(company.domain || company.website);
  const candidateRoot = extractRootDomain(candidate.domain || candidate.website);

  if (!companyRoot || !candidateRoot) return false;

  return companyRoot === candidateRoot;
}

// ============================================================================
// Layer 3: Name Similarity (Levenshtein Distance)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Calculate normalized similarity (0-1, where 1 = identical)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const a = name1.toLowerCase().trim();
  const b = name2.toLowerCase().trim();

  if (a === b) return 1;
  if (!a || !b) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - (distance / maxLength);
}

/**
 * Normalize a company name for comparison
 * Removes common suffixes, punctuation, and standardizes
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove common business suffixes
  const suffixes = [
    'inc', 'inc.', 'incorporated',
    'llc', 'l.l.c.', 'llp', 'l.l.p.',
    'ltd', 'ltd.', 'limited',
    'corp', 'corp.', 'corporation',
    'co', 'co.', 'company',
    'plc', 'gmbh', 'ag', 'sa',
    'group', 'holdings', 'partners',
  ];

  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s*,?\\s*${suffix}\\s*$`, 'i');
    normalized = normalized.replace(regex, '');
  }

  // Remove punctuation
  normalized = normalized.replace(/[.,\-_'"!?]/g, ' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Layer 3: Check for name similarity match
 * Returns true if similarity is above threshold (default: 0.8)
 */
export function checkNameSimilarity(
  company: CompanyIdentity,
  candidate: CompetitorCandidate,
  threshold: number = 0.8
): boolean {
  const companyName = normalizeCompanyName(company.name);
  const candidateName = normalizeCompanyName(candidate.name);

  const similarity = calculateNameSimilarity(companyName, candidateName);

  return similarity >= threshold;
}

// ============================================================================
// Layer 4: Brand Alias Comparison
// ============================================================================

/**
 * Generate common brand name variations
 */
export function generateBrandAliases(name: string): string[] {
  const normalized = normalizeCompanyName(name);
  const aliases = [normalized];

  // Add variations with/without "the"
  if (normalized.startsWith('the ')) {
    aliases.push(normalized.substring(4));
  } else {
    aliases.push(`the ${normalized}`);
  }

  // Add abbreviated versions (first letters of each word)
  const words = normalized.split(' ').filter(w => w.length > 0);
  if (words.length > 1) {
    aliases.push(words.map(w => w[0]).join(''));
  }

  // Add version without common words
  const stopWords = ['the', 'and', 'of', 'for', 'in', 'on', 'at'];
  const filtered = words.filter(w => !stopWords.includes(w)).join(' ');
  if (filtered !== normalized) {
    aliases.push(filtered);
  }

  // Add camelCase version
  if (words.length > 1) {
    aliases.push(words.map((w, i) =>
      i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
    ).join(''));
  }

  return [...new Set(aliases)].filter(a => a.length > 0);
}

/**
 * Layer 4: Check for brand alias match
 */
export function checkBrandAliasMatch(
  company: CompanyIdentity,
  candidate: CompetitorCandidate
): boolean {
  // Generate aliases for company
  const companyAliases = new Set(generateBrandAliases(company.name));

  // Add explicit aliases if provided
  if (company.aliases) {
    for (const alias of company.aliases) {
      companyAliases.add(normalizeCompanyName(alias));
    }
  }

  // Check candidate name against all aliases
  const candidateNormalized = normalizeCompanyName(candidate.name);

  if (companyAliases.has(candidateNormalized)) {
    return true;
  }

  // Also check candidate aliases
  const candidateAliases = generateBrandAliases(candidate.name);
  for (const alias of candidateAliases) {
    if (companyAliases.has(alias)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Combined 4-Layer Check
// ============================================================================

/**
 * Run all 4 layers of self-competitor detection
 * Returns detailed result about which layer matched (if any)
 */
export function checkIsSelfCompetitor(
  company: CompanyIdentity,
  candidate: CompetitorCandidate
): SelfCompetitorCheck {
  // Layer 1: Exact domain match
  if (checkExactDomainMatch(company, candidate)) {
    return {
      isMatch: true,
      matchType: 'exact-domain',
      confidence: 1.0,
      reason: `Domain "${candidate.domain || candidate.website}" exactly matches company domain`,
    };
  }

  // Layer 2: Root domain match
  if (checkRootDomainMatch(company, candidate)) {
    return {
      isMatch: true,
      matchType: 'root-domain',
      confidence: 0.95,
      reason: `Root domain "${extractRootDomain(candidate.domain || candidate.website)}" matches company`,
    };
  }

  // Layer 3: Name similarity
  const similarity = calculateNameSimilarity(
    normalizeCompanyName(company.name),
    normalizeCompanyName(candidate.name)
  );
  if (similarity >= 0.8) {
    return {
      isMatch: true,
      matchType: 'name-similarity',
      confidence: similarity,
      reason: `Name "${candidate.name}" is ${Math.round(similarity * 100)}% similar to company name`,
    };
  }

  // Layer 4: Brand alias match
  if (checkBrandAliasMatch(company, candidate)) {
    return {
      isMatch: true,
      matchType: 'brand-alias',
      confidence: 0.85,
      reason: `Name "${candidate.name}" matches a brand alias of the company`,
    };
  }

  return {
    isMatch: false,
    matchType: 'none',
    confidence: 0,
    reason: 'No match found in any layer',
  };
}

/**
 * Filter out self-competitors from a list
 * Returns filtered list and log of removed items
 */
export function filterSelfCompetitors<T extends CompetitorCandidate>(
  company: CompanyIdentity,
  candidates: T[]
): {
  filtered: T[];
  removed: Array<{ candidate: T; check: SelfCompetitorCheck }>;
} {
  const filtered: T[] = [];
  const removed: Array<{ candidate: T; check: SelfCompetitorCheck }> = [];

  for (const candidate of candidates) {
    const check = checkIsSelfCompetitor(company, candidate);

    if (check.isMatch) {
      removed.push({ candidate, check });
      console.log(
        `[selfCompetitorFilter] Removed: "${candidate.name}" - ${check.reason}`
      );
    } else {
      filtered.push(candidate);
    }
  }

  if (removed.length > 0) {
    console.log(
      `[selfCompetitorFilter] Removed ${removed.length} self-competitor(s) from ${candidates.length} candidates`
    );
  }

  return { filtered, removed };
}
