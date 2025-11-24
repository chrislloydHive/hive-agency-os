// lib/digital-footprint/collectDigitalFootprint.ts
// Lightweight digital footprint detection for GAP analysis

import { z } from "zod";

// ============================================================================
// Schema Definitions
// ============================================================================

export const DigitalFootprintSchema = z.object({
  gbp: z.object({
    found: z.boolean(),
    hasReviews: z.boolean(),
    reviewCountBucket: z.enum(["none", "few", "moderate", "many", "unknown"]),
    ratingBucket: z.enum(["low", "mixed", "strong", "unknown"]),
  }),
  linkedin: z.object({
    found: z.boolean(),
    followerBucket: z.enum(["none", "0-100", "100-1k", "1k-10k", "10k+", "unknown"]),
    postingCadence: z.enum(["none", "rare", "occasional", "consistent", "unknown"]),
  }),
  otherSocials: z.object({
    instagram: z.boolean(),
    facebook: z.boolean(),
    youtube: z.boolean(),
  }),
  brandedSearch: z.object({
    ownDomainDominates: z.boolean(),
    confusingNameCollisions: z.boolean(),
  }),
});

export type DigitalFootprint = z.infer<typeof DigitalFootprintSchema>;

// ============================================================================
// Digital Footprint Collection
// ============================================================================

/**
 * Collect digital footprint signals for a domain.
 *
 * NOTE: This function is intentionally lightweight.
 * We don't need full scraping — only presence detection, follower buckets, review buckets, etc.
 * The LLM will do the heavy reasoning based on these signals.
 *
 * @param domain - The domain to analyze (e.g., "example.com")
 * @param htmlSnippet - Optional HTML content to extract social links from
 * @returns Digital footprint signals
 */
export async function collectDigitalFootprint(
  domain: string,
  htmlSnippet?: string
): Promise<DigitalFootprint> {
  console.log('[Digital Footprint] Collecting signals for:', domain);

  const safeDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Extract company name from domain for better search
  const companyName = extractCompanyName(safeDomain);

  // --- GOOGLE BUSINESS PROFILE DETECTION ---
  // Detect from HTML if available (most reliable method)
  let gbpFound = false;

  if (htmlSnippet) {
    // Check for Google Business Profile / Google Maps links in HTML
    const gbpPatterns = [
      /https?:\/\/maps\.google\.com\/[^\s"')]+/i,
      /https?:\/\/goo\.gl\/maps\/[^\s"')]+/i,
      /https?:\/\/g\.page\/[^\s"')]+/i,
      /https?:\/\/(www\.)?google\.com\/maps\/place\/[^\s"')]+/i,
    ];

    gbpFound = gbpPatterns.some(pattern => pattern.test(htmlSnippet));

    if (gbpFound) {
      console.log('[Digital Footprint] ✅ Google Business Profile link found in HTML');
    }
  }

  const gbp = {
    found: gbpFound,
    hasReviews: gbpFound ? true : false, // If GBP exists, assume it likely has reviews
    reviewCountBucket: gbpFound ? ("unknown" as const) : ("none" as const),
    ratingBucket: gbpFound ? ("unknown" as const) : ("unknown" as const),
  };

  // --- LINKEDIN DETECTION ---
  let linkedinFound = false;

  // First try to detect from HTML (fastest and most reliable)
  if (htmlSnippet) {
    const linkedinPatterns = [
      /https?:\/\/(www\.)?linkedin\.com\/(company|in|showcase)\/[^\s"')]+/i,
    ];
    linkedinFound = linkedinPatterns.some(pattern => pattern.test(htmlSnippet));

    if (linkedinFound) {
      console.log('[Digital Footprint] ✅ LinkedIn link found in HTML');
    }
  }

  // Fallback to HTTP check if not found in HTML
  if (!linkedinFound) {
    const linkedinUrl = `https://www.linkedin.com/company/${companyName}`;
    try {
      const res = await fetch(linkedinUrl, {
        method: "HEAD",
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
        },
        signal: AbortSignal.timeout(5000),
      });
      linkedinFound = res.status !== 404;
      console.log('[Digital Footprint] LinkedIn HTTP check:', linkedinUrl, '→', res.status);
    } catch (err) {
      console.log('[Digital Footprint] LinkedIn HTTP check failed:', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  const linkedin = {
    found: linkedinFound,
    followerBucket: linkedinFound ? ("unknown" as const) : ("none" as const),
    postingCadence: linkedinFound ? ("unknown" as const) : ("none" as const),
  };

  // --- OTHER SOCIAL PRESENCE ---
  // Prefer HTML detection over HTTP checks
  const otherSocials = {
    instagram: false,
    facebook: false,
    youtube: false,
  };

  if (htmlSnippet) {
    const instagramPattern = /https?:\/\/(www\.)?instagram\.com\/[^\s"')]+/i;
    const facebookPattern = /https?:\/\/(www\.)?facebook\.com\/[^\s"')]+/i;
    const youtubePattern = /https?:\/\/(www\.)?youtube\.com\/(channel|c|@)[^\s"')]+/i;

    otherSocials.instagram = instagramPattern.test(htmlSnippet);
    otherSocials.facebook = facebookPattern.test(htmlSnippet);
    otherSocials.youtube = youtubePattern.test(htmlSnippet);

    console.log('[Digital Footprint] Social links in HTML:', {
      instagram: otherSocials.instagram ? '✅' : '❌',
      facebook: otherSocials.facebook ? '✅' : '❌',
      youtube: otherSocials.youtube ? '✅' : '❌',
    });
  } else {
    // Fallback to HTTP checks if no HTML provided
    try {
      const socialChecks = await Promise.allSettled([
        checkSocialPresence(`https://www.instagram.com/${companyName}`),
        checkSocialPresence(`https://www.facebook.com/${companyName}`),
        checkSocialPresence(`https://www.youtube.com/@${companyName}`),
      ]);

      otherSocials.instagram = socialChecks[0].status === 'fulfilled' && socialChecks[0].value;
      otherSocials.facebook = socialChecks[1].status === 'fulfilled' && socialChecks[1].value;
      otherSocials.youtube = socialChecks[2].status === 'fulfilled' && socialChecks[2].value;
    } catch (err) {
      console.log('[Digital Footprint] Social HTTP checks failed:', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // --- BRANDED SEARCH FLAGS ---
  // Stub until full search API integration
  // Future: Could use Google Custom Search API or SerpAPI
  const brandedSearch = {
    ownDomainDominates: false,
    confusingNameCollisions: false,
  };

  console.log('[Digital Footprint] Results:', {
    gbp: gbp.found,
    linkedin: linkedin.found,
    socials: otherSocials,
  });

  return {
    gbp,
    linkedin,
    otherSocials,
    brandedSearch,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract likely company name from domain
 * e.g., "example.com" → "example"
 *      "my-company.io" → "my-company"
 */
function extractCompanyName(domain: string): string {
  // Remove common TLDs and www
  let name = domain
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|app|dev|tech|me|us|uk|ca)$/, '');

  // Remove remaining dots (e.g., co.uk)
  name = name.split('.')[0];

  return name;
}

/**
 * Check if a social profile URL exists
 * Returns true if profile likely exists (not 404)
 */
async function checkSocialPresence(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
      },
      signal: AbortSignal.timeout(5000),
    });

    // Consider 2xx and 3xx as "found" (redirects are common for social profiles)
    const found = res.status >= 200 && res.status < 400;
    console.log('[Digital Footprint] Social check:', url, '→', res.status, found ? '✓' : '✗');
    return found;
  } catch (err) {
    console.log('[Digital Footprint] Social check failed:', url, err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}
