/**
 * Social Presence Heuristics
 *
 * Detects and summarizes social media presence from HTML snippets:
 * - LinkedIn, Instagram, Facebook, Google Business
 * - Blog presence and activity estimation
 * - Overall presence level assessment
 *
 * Never throws - always returns safe defaults
 */

export type SocialPresence = {
  linkedinUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  googleBusinessUrl?: string;
  blogUrl?: string;
  blogPostCountEstimate?: number;
  overallPresenceLevel?: 'strong' | 'moderate' | 'weak' | 'missing';
  notes?: string;
};

export interface SocialHeuristicsInput {
  htmlSnippet: string;
  url: string;
}

export type SocialHeuristicsOutput = SocialPresence;

/**
 * Social platform URL patterns
 */
const SOCIAL_PATTERNS = {
  linkedin: [
    /https?:\/\/(www\.)?linkedin\.com\/(company|in|showcase)\/[^\s"')]+/gi,
  ],
  instagram: [
    /https?:\/\/(www\.)?instagram\.com\/[^\s"')]+/gi,
  ],
  facebook: [
    /https?:\/\/(www\.)?facebook\.com\/[^\s"')]+/gi,
  ],
  googleBusiness: [
    /https?:\/\/maps\.google\.com\/[^\s"')]+/gi,
    /https?:\/\/goo\.gl\/maps\/[^\s"')]+/gi,
    /https?:\/\/g\.page\/[^\s"')]+/gi,
    /https?:\/\/(www\.)?google\.com\/maps\/place\/[^\s"')]+/gi,
  ],
};

/**
 * Blog path patterns
 */
const BLOG_PATTERNS = [
  /\/blog\/?/i,
  /\/insights\/?/i,
  /\/resources\/?/i,
  /\/articles\/?/i,
  /\/news\/?/i,
  /\/posts\/?/i,
];

/**
 * Extract first matching URL for a platform
 */
function extractPlatformUrl(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(html);
    if (match) {
      return cleanUrl(match[0]);
    }
  }
  return undefined;
}

/**
 * Clean and normalize URLs
 */
function cleanUrl(url: string): string {
  // Remove common trailing characters
  return url.replace(/['")\]>]+$/, '').trim();
}

/**
 * Detect blog presence
 */
function detectBlog(html: string, baseUrl: string): { blogUrl?: string; postCount?: number } {
  try {
    // Find blog path
    let blogPath: string | undefined;
    for (const pattern of BLOG_PATTERNS) {
      const match = html.match(pattern);
      if (match) {
        blogPath = match[0];
        break;
      }
    }

    if (!blogPath) {
      return {};
    }

    // Try to construct full URL
    let blogUrl: string;
    try {
      const base = new URL(baseUrl);
      if (blogPath.startsWith('/')) {
        blogUrl = `${base.origin}${blogPath}`;
      } else {
        blogUrl = blogPath;
      }
    } catch {
      blogUrl = blogPath;
    }

    // Estimate post count by counting blog/article-like URLs
    const postPatterns = [
      /\/blog\/[^/\s"']+/gi,
      /\/article\/[^/\s"']+/gi,
      /\/post\/[^/\s"']+/gi,
      /\/insights\/[^/\s"']+/gi,
    ];

    let postCount = 0;
    for (const pattern of postPatterns) {
      pattern.lastIndex = 0;
      const matches = html.match(pattern);
      if (matches) {
        postCount += matches.length;
      }
    }

    // Cap at 50 to avoid inflated estimates
    postCount = Math.min(postCount, 50);

    return {
      blogUrl,
      postCount: postCount > 0 ? postCount : undefined,
    };
  } catch (error) {
    console.error('[Social Heuristics] Blog detection error:', error);
    return {};
  }
}

/**
 * Determine overall social presence level
 */
function assessPresenceLevel(presence: {
  hasLinkedIn: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasGoogleBusiness: boolean;
  hasBlog: boolean;
}): 'strong' | 'moderate' | 'weak' | 'missing' {
  const platformCount =
    (presence.hasLinkedIn ? 1 : 0) +
    (presence.hasInstagram ? 1 : 0) +
    (presence.hasFacebook ? 1 : 0) +
    (presence.hasGoogleBusiness ? 1 : 0);

  // strong: 3+ platforms OR 2 platforms + blog
  if (platformCount >= 3 || (platformCount === 2 && presence.hasBlog)) {
    return 'strong';
  }

  // moderate: 1-2 platforms or blog
  if (platformCount >= 1 || presence.hasBlog) {
    return 'moderate';
  }

  // weak: only one signal
  // Note: This is already covered by moderate, so we'll skip this level
  // and jump straight to missing if nothing is found

  return 'missing';
}

/**
 * Generate summary notes
 */
function generateNotes(presence: {
  hasLinkedIn: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasGoogleBusiness: boolean;
  hasBlog: boolean;
  level: string;
}): string {
  const platforms: string[] = [];

  if (presence.hasLinkedIn) platforms.push('LinkedIn');
  if (presence.hasInstagram) platforms.push('Instagram');
  if (presence.hasFacebook) platforms.push('Facebook');
  if (presence.hasGoogleBusiness) platforms.push('Google Business');
  if (presence.hasBlog) platforms.push('blog');

  if (platforms.length === 0) {
    return 'No social profiles or blog detected on the homepage.';
  }

  const platformList = platforms.join(', ');
  const missing: string[] = [];

  if (!presence.hasLinkedIn) missing.push('LinkedIn');
  if (!presence.hasInstagram) missing.push('Instagram');
  if (!presence.hasFacebook) missing.push('Facebook');

  if (missing.length > 0 && platforms.length > 0) {
    return `${platformList} detected. Missing: ${missing.join(', ')}.`;
  }

  return `${platformList} detected.`;
}

/**
 * Main social presence detection function
 *
 * Never throws - always returns safe defaults
 */
export function getSocialPresence(input: SocialHeuristicsInput): SocialHeuristicsOutput {
  try {
    const { htmlSnippet, url } = input;

    if (!htmlSnippet || htmlSnippet.length === 0) {
      return {
        overallPresenceLevel: 'missing',
        notes: 'No HTML content available to analyze social presence.',
      };
    }

    // Extract platform URLs
    const linkedinUrl = extractPlatformUrl(htmlSnippet, SOCIAL_PATTERNS.linkedin);
    const instagramUrl = extractPlatformUrl(htmlSnippet, SOCIAL_PATTERNS.instagram);
    const facebookUrl = extractPlatformUrl(htmlSnippet, SOCIAL_PATTERNS.facebook);
    const googleBusinessUrl = extractPlatformUrl(htmlSnippet, SOCIAL_PATTERNS.googleBusiness);

    // Detect blog
    const { blogUrl, postCount } = detectBlog(htmlSnippet, url);

    // Assess presence
    const hasLinkedIn = !!linkedinUrl;
    const hasInstagram = !!instagramUrl;
    const hasFacebook = !!facebookUrl;
    const hasGoogleBusiness = !!googleBusinessUrl;
    const hasBlog = !!blogUrl;

    const presenceLevel = assessPresenceLevel({
      hasLinkedIn,
      hasInstagram,
      hasFacebook,
      hasGoogleBusiness,
      hasBlog,
    });

    const notes = generateNotes({
      hasLinkedIn,
      hasInstagram,
      hasFacebook,
      hasGoogleBusiness,
      hasBlog,
      level: presenceLevel,
    });

    return {
      linkedinUrl,
      instagramUrl,
      facebookUrl,
      googleBusinessUrl,
      blogUrl,
      blogPostCountEstimate: postCount,
      overallPresenceLevel: presenceLevel,
      notes,
    };
  } catch (error) {
    console.error('[Social Heuristics] Error:', error);
    return {
      overallPresenceLevel: 'missing',
      notes: 'Unable to detect social presence.',
    };
  }
}
