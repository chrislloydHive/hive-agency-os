// lib/os/library/clientLeakageCheck.ts
// Heuristic scanner for client-specific content before global promotion
// Warning system only - does not block promotion

import type { LeakageCheckResult } from '@/lib/types/sectionLibrary';

/**
 * Common patterns that indicate client-specific content
 */
const LEAKAGE_PATTERNS = {
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Phone numbers (various formats)
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,

  // URLs (might contain client domains)
  url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi,

  // Money amounts with dollar signs (specific quotes/budgets)
  money: /\$[\d,]+(?:\.\d{2})?(?:\s*(?:k|K|m|M|million|thousand))?/g,

  // Dates (specific project timelines)
  specificDate: /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/gi,

  // Project codes (common patterns)
  projectCode: /\b(?:PRJ|PROJ|PROJECT)[-_]?\d{3,}/gi,

  // Invoice/PO numbers
  invoiceNumber: /\b(?:INV|PO|INVOICE)[-_#]?\d{4,}/gi,
};

/**
 * Common client-identifying terms (case-insensitive)
 */
const CLIENT_TERMS = [
  'our client',
  'the client',
  'client name',
  'client company',
  'your company',
  'your organization',
  'your brand',
  'your team',
];

/**
 * Check content for potential client-specific information
 * Returns warnings but does NOT block promotion
 */
export function checkForClientLeakage(
  content: string,
  companyName?: string
): LeakageCheckResult {
  const warnings: string[] = [];
  const detectedPatterns: string[] = [];

  // Normalize content for searching
  const normalizedContent = content.toLowerCase();

  // Check for company name if provided
  if (companyName) {
    const companyNameLower = companyName.toLowerCase();
    const companyNameWords = companyNameLower.split(/\s+/).filter(w => w.length > 2);

    // Check full company name
    if (normalizedContent.includes(companyNameLower)) {
      warnings.push(`Contains company name: "${companyName}"`);
      detectedPatterns.push(`company_name:${companyName}`);
    }

    // Check significant words from company name
    for (const word of companyNameWords) {
      // Skip common words
      if (['the', 'and', 'inc', 'llc', 'ltd', 'corp', 'company', 'group'].includes(word)) {
        continue;
      }
      if (normalizedContent.includes(word)) {
        // Only warn if the word appears in a context that suggests it's the company name
        const wordRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
        const matches = content.match(wordRegex);
        if (matches && matches.length > 0) {
          warnings.push(`May contain part of company name: "${word}"`);
          detectedPatterns.push(`company_word:${word}`);
        }
      }
    }
  }

  // Check for common patterns
  for (const [patternName, regex] of Object.entries(LEAKAGE_PATTERNS)) {
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      const uniqueMatches = [...new Set(matches)].slice(0, 3); // Show up to 3 examples
      warnings.push(`Contains ${patternName}: ${uniqueMatches.join(', ')}`);
      detectedPatterns.push(`pattern:${patternName}`);
    }
  }

  // Check for client-identifying terms
  for (const term of CLIENT_TERMS) {
    if (normalizedContent.includes(term)) {
      warnings.push(`Contains client reference: "${term}"`);
      detectedPatterns.push(`client_term:${term}`);
    }
  }

  // Check for possessive pronouns that might indicate client-specific content
  const possessivePatterns = [
    /\byour\s+(?:website|app|application|platform|product|service|brand|company|business|team|organization)\b/gi,
    /\btheir\s+(?:website|app|application|platform|product|service|brand|company|business|team|organization)\b/gi,
  ];

  for (const pattern of possessivePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      warnings.push(`Contains possessive reference: "${matches[0]}"`);
      detectedPatterns.push('possessive_reference');
    }
  }

  return {
    hasWarnings: warnings.length > 0,
    warnings,
    detectedPatterns,
  };
}

/**
 * Generate a summary message for the user
 */
export function getLeakageSummary(result: LeakageCheckResult): string | null {
  if (!result.hasWarnings) return null;

  const warningCount = result.warnings.length;
  const summary = warningCount === 1
    ? '1 potential issue detected'
    : `${warningCount} potential issues detected`;

  return `${summary}. Please review the content to ensure no client-specific information is included before promoting to global.`;
}

/**
 * Check if content is safe for global promotion (no warnings)
 */
export function isSafeForGlobal(result: LeakageCheckResult): boolean {
  return !result.hasWarnings;
}

/**
 * Helper to escape regex special characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
