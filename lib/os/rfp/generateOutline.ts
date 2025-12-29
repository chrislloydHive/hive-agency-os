// lib/os/rfp/generateOutline.ts
// RFP Response Outline Generator
//
// Creates a response outline from parsed requirements by mapping required
// sections to internal section keys or creating custom sections.

import type {
  ParsedRfpRequirements,
  RfpSectionKey,
} from '@/lib/types/rfp';
import { RFP_SECTION_ORDER, RFP_SECTION_LABELS } from '@/lib/types/rfp';

// ============================================================================
// Types
// ============================================================================

export interface OutlineSection {
  /** Internal section key (standard) or null for custom */
  sectionKey: RfpSectionKey | null;
  /** Custom section key (if not standard) */
  customKey: string | null;
  /** Display title */
  title: string;
  /** Description from RFP requirements */
  description?: string;
  /** Page limit from RFP */
  pageLimit?: number;
  /** Word limit from RFP */
  wordLimit?: number;
  /** Order in the outline */
  order: number;
  /** Whether this is a required section from RFP */
  isRequired: boolean;
  /** Whether this maps to a standard section */
  isStandard: boolean;
}

export interface GeneratedOutline {
  /** All sections in order */
  sections: OutlineSection[];
  /** Sections that don't map to standard types */
  customSections: OutlineSection[];
  /** Standard sections that aren't covered by requirements */
  uncoveredStandardSections: RfpSectionKey[];
  /** Confidence in the mapping */
  mappingConfidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Section Mapping
// ============================================================================

/**
 * Keywords and phrases that map to standard section keys
 */
const SECTION_MAPPINGS: Record<RfpSectionKey, string[]> = {
  agency_overview: [
    'company overview',
    'agency overview',
    'about the agency',
    'about your company',
    'about us',
    'firm profile',
    'agency profile',
    'company background',
    'organization overview',
    'corporate overview',
    'firm overview',
    'vendor profile',
    'supplier profile',
  ],
  approach: [
    'approach',
    'methodology',
    'solution',
    'proposed approach',
    'technical approach',
    'strategy',
    'strategic approach',
    'proposed solution',
    'proposed methodology',
    'our approach',
    'recommended approach',
    'project approach',
    'engagement approach',
  ],
  team: [
    'team',
    'personnel',
    'staff',
    'proposed team',
    'project team',
    'key personnel',
    'staffing',
    'team members',
    'project staff',
    'resources',
    'team qualifications',
    'key staff',
  ],
  work_samples: [
    'work samples',
    'case studies',
    'portfolio',
    'past performance',
    'relevant experience',
    'previous work',
    'examples',
    'prior work',
    'experience',
    'relevant projects',
    'past projects',
    'similar projects',
  ],
  plan_timeline: [
    'timeline',
    'schedule',
    'plan',
    'project plan',
    'work plan',
    'implementation plan',
    'project timeline',
    'milestones',
    'deliverables',
    'phasing',
    'project schedule',
    'implementation timeline',
  ],
  pricing: [
    'pricing',
    'cost',
    'budget',
    'fees',
    'investment',
    'price proposal',
    'cost proposal',
    'financial proposal',
    'rate card',
    'compensation',
    'pricing proposal',
    'cost breakdown',
  ],
  references: [
    'references',
    'client references',
    'testimonials',
    'referrals',
    'client list',
    'past clients',
    'reference list',
  ],
};

/**
 * Match a section title to a standard section key
 */
function matchToStandardSection(title: string): RfpSectionKey | null {
  const normalizedTitle = title.toLowerCase().trim();

  for (const [key, keywords] of Object.entries(SECTION_MAPPINGS)) {
    for (const keyword of keywords) {
      if (
        normalizedTitle.includes(keyword) ||
        keyword.includes(normalizedTitle) ||
        levenshteinSimilarity(normalizedTitle, keyword) > 0.7
      ) {
        return key as RfpSectionKey;
      }
    }
  }

  return null;
}

/**
 * Simple Levenshtein similarity (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLen;
}

/**
 * Generate a custom key from a title
 */
function generateCustomKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate an outline from parsed requirements
 *
 * @param requirements - Parsed RFP requirements
 * @param includeStandardSections - Whether to include standard sections not in requirements
 * @returns Generated outline with mapped and custom sections
 */
export function generateOutlineFromRequirements(
  requirements: ParsedRfpRequirements,
  includeStandardSections: boolean = true
): GeneratedOutline {
  const sections: OutlineSection[] = [];
  const customSections: OutlineSection[] = [];
  const mappedStandardKeys = new Set<RfpSectionKey>();
  let order = 0;

  // Map required sections from RFP
  for (const reqSection of requirements.requiredResponseSections) {
    const matchedKey = matchToStandardSection(reqSection.title);

    if (matchedKey && !mappedStandardKeys.has(matchedKey)) {
      // Map to standard section
      mappedStandardKeys.add(matchedKey);
      sections.push({
        sectionKey: matchedKey,
        customKey: null,
        title: RFP_SECTION_LABELS[matchedKey],
        description: reqSection.description,
        pageLimit: reqSection.pageLimit,
        wordLimit: reqSection.wordLimit,
        order: order++,
        isRequired: true,
        isStandard: true,
      });
    } else if (!matchedKey) {
      // Create custom section
      const customKey = generateCustomKey(reqSection.title);
      const customSection: OutlineSection = {
        sectionKey: null,
        customKey,
        title: reqSection.title,
        description: reqSection.description,
        pageLimit: reqSection.pageLimit,
        wordLimit: reqSection.wordLimit,
        order: order++,
        isRequired: true,
        isStandard: false,
      };
      sections.push(customSection);
      customSections.push(customSection);
    }
    // Skip if already mapped (duplicate requirement)
  }

  // Optionally add unmapped standard sections
  const uncoveredStandardSections: RfpSectionKey[] = [];
  if (includeStandardSections) {
    for (const key of RFP_SECTION_ORDER) {
      if (!mappedStandardKeys.has(key)) {
        uncoveredStandardSections.push(key);
        sections.push({
          sectionKey: key,
          customKey: null,
          title: RFP_SECTION_LABELS[key],
          description: undefined,
          order: order++,
          isRequired: false,
          isStandard: true,
        });
      }
    }
  }

  // Determine mapping confidence
  const totalRequired = requirements.requiredResponseSections.length;
  const mappedCount = mappedStandardKeys.size;
  let mappingConfidence: 'high' | 'medium' | 'low' = 'low';

  if (totalRequired === 0) {
    mappingConfidence = 'medium'; // No requirements to map
  } else if (mappedCount / totalRequired >= 0.7) {
    mappingConfidence = 'high';
  } else if (mappedCount / totalRequired >= 0.4) {
    mappingConfidence = 'medium';
  }

  return {
    sections,
    customSections,
    uncoveredStandardSections,
    mappingConfidence,
  };
}

/**
 * Get the standard section label for a key
 */
export function getSectionLabel(key: RfpSectionKey): string {
  return RFP_SECTION_LABELS[key] || key;
}

/**
 * Check if a key is a standard section key
 */
export function isStandardSectionKey(key: string): key is RfpSectionKey {
  return RFP_SECTION_ORDER.includes(key as RfpSectionKey);
}

/**
 * Create section records from an outline
 * Returns data that can be used to create RfpSection records
 */
export function outlineToSectionData(
  outline: GeneratedOutline,
  rfpId: string
): Array<{
  rfpId: string;
  sectionKey: RfpSectionKey;
  title: string;
  status: 'empty';
  customSectionData?: {
    customKey: string;
    description?: string;
    pageLimit?: number;
    wordLimit?: number;
  };
}> {
  return outline.sections
    .filter((s) => s.isStandard && s.sectionKey)
    .map((s) => ({
      rfpId,
      sectionKey: s.sectionKey!,
      title: s.title,
      status: 'empty' as const,
    }));
}

/**
 * Summary of outline for logging/display
 */
export function getOutlineSummary(outline: GeneratedOutline): string {
  const parts: string[] = [];

  const customCount = outline.customSections.length;
  const requiredCount = outline.sections.filter((s) => s.isRequired).length;

  parts.push(`${outline.sections.length} total sections`);
  if (requiredCount > 0) {
    parts.push(`${requiredCount} from RFP requirements`);
  }
  if (customCount > 0) {
    parts.push(`${customCount} custom`);
  }
  parts.push(`${outline.mappingConfidence} confidence`);

  return parts.join(' | ');
}
