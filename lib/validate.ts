import { z } from 'zod';
import type { SnapshotRequest } from '@/types/snapshot';

/**
 * Validation schemas for Snapshot API
 */

export const snapshotRequestSchema = z.object({
  website_url: z
    .string()
    .url('Please provide a valid website URL')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'URL must start with http:// or https://' }
    ),
  email: z.string().email('Please provide a valid email address').optional(),
  google_business_url: z
    .string()
    .url('Please provide a valid Google Business Profile URL')
    .optional()
    .or(z.literal('')),
  linkedin_url: z
    .string()
    .url('Please provide a valid LinkedIn company URL')
    .optional()
    .or(z.literal('')),
});

/**
 * Validate snapshot request body using Zod schema
 * 
 * @param body - Unknown request body to validate
 * @returns Validated SnapshotRequest object
 * @throws ZodError if validation fails
 */
export function validateSnapshotRequest(
  body: unknown
): SnapshotRequest {
  return snapshotRequestSchema.parse(body);
}

/**
 * Extract domain from URL for analytics
 * Removes www. prefix and returns clean hostname
 * 
 * @param url - Full URL string
 * @returns Clean domain name (e.g., "example.com")
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

