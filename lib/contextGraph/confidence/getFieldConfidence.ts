// lib/contextGraph/confidence/getFieldConfidence.ts
// Confidence extraction utility for Context fields
//
// Extracts confidence notes for specific fields from CompanyContext.confidenceNotes

import type { CompanyContext } from '@/lib/types/context';

/**
 * Confidence note for a specific field
 */
export interface FieldConfidenceNote {
  isHighConfidence: boolean;
  reason?: string;
}

/**
 * Extract confidence note for a specific field from confidenceNotes
 *
 * @param fieldName - The field name to look up (case-insensitive match)
 * @param confidenceNotes - The confidenceNotes object from CompanyContext
 * @returns FieldConfidenceNote if field has confidence info, null otherwise
 */
export function getFieldConfidence(
  fieldName: string,
  confidenceNotes?: CompanyContext['confidenceNotes']
): FieldConfidenceNote | null {
  if (!confidenceNotes) return null;

  // Check if field is in high confidence list
  if (confidenceNotes.highConfidence?.some(f =>
    f.toLowerCase().includes(fieldName.toLowerCase())
  )) {
    return { isHighConfidence: true };
  }

  // Check if field needs review (format: "fieldName: reason")
  const needsReviewEntry = confidenceNotes.needsReview?.find(entry =>
    entry.toLowerCase().startsWith(fieldName.toLowerCase())
  );

  if (needsReviewEntry) {
    // Extract reason after the colon
    const colonIndex = needsReviewEntry.indexOf(':');
    const reason = colonIndex > 0
      ? needsReviewEntry.slice(colonIndex + 1).trim()
      : undefined;
    return { isHighConfidence: false, reason };
  }

  return null;
}
