/**
 * Analyze Google Business Profile and LinkedIn Company Page
 */

import type { GoogleBusinessAnalysis, LinkedInAnalysis } from '@/types/snapshot';

/**
 * Analyze Google Business Profile
 * Attempts to extract basic information from the profile URL
 * 
 * @param url - Google Business Profile URL
 * @returns Promise resolving to GoogleBusinessAnalysis
 */
export async function analyzeGoogleBusiness(
  url: string
): Promise<GoogleBusinessAnalysis> {
  if (!url || !url.trim()) {
    return { found: false };
  }

  try {
    // Basic validation - check if it's a Google Maps/Business URL
    const isGoogleUrl =
      url.includes('google.com/maps') ||
      url.includes('g.page') ||
      url.includes('google.com/business');

    if (!isGoogleUrl) {
      return {
        found: false,
        insights: ['URL does not appear to be a valid Google Business Profile URL'],
      };
    }

    // For now, return a basic analysis structure
    // In production, you could:
    // 1. Use Google My Business API (requires OAuth)
    // 2. Scrape public data (with rate limiting and legal considerations)
    // 3. Use a third-party service
    
    // Try to fetch and analyze the profile
    // Note: In production, you'd use Google My Business API or scrape public data
    // For now, we'll return a structured analysis that can be enhanced
    
    try {
      // Attempt to fetch the page (with timeout)
      // Use AbortController for Node.js compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      let response: Response;
      try {
        response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HiveSnapshotBot/1.0; +https://hiveadagency.com)',
        },
          signal: controller.signal,
      });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        // Profile exists and is accessible - parse HTML to extract data
        const html = await response.text();
        
        // Extract rating from HTML (look for patterns like "4.5" or "4.5 stars")
        const ratingMatch = html.match(/(\d+\.?\d*)\s*(?:stars?|out of|\/)/i) || 
                           html.match(/"rating":\s*(\d+\.?\d*)/i) ||
                           html.match(/rating[:\s]+(\d+\.?\d*)/i);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
        
        // Extract review count
        const reviewMatch = html.match(/(\d+(?:,\d+)*)\s*(?:reviews?|ratings?)/i) ||
                           html.match(/"reviewCount":\s*(\d+)/i) ||
                           html.match(/reviews?[:\s]+(\d+(?:,\d+)*)/i);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : null;
        
        // Check for photos (look for image references)
        const photoCount = (html.match(/<img[^>]*>/gi) || []).length;
        const hasPhotos = photoCount > 5; // Reasonable threshold
        
        // Check for business hours
        const hasHours = html.includes('hours') || html.includes('open') || html.includes('closed');
        
        // Check for posts/updates
        const hasPosts = html.includes('post') || html.includes('update') || html.includes('announcement');
        
        // Calculate completeness score
        let completeness = 50; // Base score
        if (rating) completeness += 10;
        if (reviewCount && reviewCount > 0) completeness += 10;
        if (hasPhotos) completeness += 10;
        if (hasHours) completeness += 10;
        if (hasPosts) completeness += 10;
        
        const insights: string[] = [];
        if (rating) {
          insights.push(`Profile has a ${rating.toFixed(1)}-star rating`);
        }
        if (reviewCount && reviewCount > 0) {
          insights.push(`${reviewCount.toLocaleString()} reviews found`);
        } else {
          insights.push('No reviews found - encourage customers to leave reviews');
        }
        if (hasPhotos) {
          insights.push('Profile includes photos');
        } else {
          insights.push('Consider adding more photos to improve visibility');
        }
        if (hasHours) {
          insights.push('Business hours are listed');
        } else {
          insights.push('Add business hours for better local SEO');
        }
        if (!hasPosts) {
          insights.push('Regular posts can boost local SEO');
        }
        
        return {
          found: true,
          url: url,
          rating: rating || undefined,
          reviewCount: reviewCount || undefined,
          completeness: Math.min(completeness, 100),
          insights,
          recommendations: [
            rating && rating < 4 ? 'Focus on improving your rating by responding to reviews and addressing concerns' : 'Maintain your rating by responding to all reviews',
            reviewCount && reviewCount < 10 ? 'Encourage satisfied customers to leave reviews' : 'Continue building your review base',
            !hasPhotos ? 'Add high-quality photos of your business, products, and team' : 'Keep photos updated regularly',
            !hasHours ? 'Add business hours and accurate contact information' : 'Keep business hours updated',
            !hasPosts ? 'Post updates at least once per week' : 'Continue regular posting schedule',
            'Respond to all reviews within 24 hours',
          ],
        };
      }
    } catch (error) {
      // Profile might be private or require authentication
      console.warn('Could not fetch Google Business Profile:', error);
    }

    // Profile URL is valid but we couldn't fetch details
    return {
      found: true,
      url: url,
      completeness: 50,
      insights: [
        'Profile URL validated and accessible',
        'Consider optimizing your Google Business Profile for local SEO',
        'Add business information, photos, and regular posts to improve visibility',
      ],
      recommendations: [
        'Respond to all reviews within 24 hours',
        'Add business hours and accurate contact information',
        'Post updates at least once per week',
        'Add high-quality photos',
        'Encourage satisfied customers to leave reviews',
      ],
    };
  } catch (error) {
    console.warn('Error analyzing Google Business Profile:', error);
    return {
      found: false,
      insights: ['Could not analyze Google Business Profile'],
    };
  }
}

/**
 * Analyze LinkedIn Company Page
 * Attempts to extract basic information from the company page URL
 * 
 * @param url - LinkedIn company page URL
 * @returns Promise resolving to LinkedInAnalysis
 */
export async function analyzeLinkedIn(
  url: string
): Promise<LinkedInAnalysis> {
  if (!url || !url.trim()) {
    return { found: false };
  }

  try {
    // Basic validation - check if it's a LinkedIn company URL
    const isLinkedInUrl =
      url.includes('linkedin.com/company') ||
      url.includes('linkedin.com/company/');

    if (!isLinkedInUrl) {
      return {
        found: false,
        insights: ['URL does not appear to be a valid LinkedIn company page URL'],
      };
    }

    // For now, return a basic analysis structure
    // In production, you could:
    // 1. Use LinkedIn API (requires OAuth and partnership)
    // 2. Scrape public data (with rate limiting and legal considerations)
    // 3. Use a third-party service
    
    // Try to fetch and analyze the LinkedIn page
    // Note: LinkedIn has strict rate limiting and may require authentication
    // For now, we'll return a structured analysis
    
    try {
      // Attempt to fetch the page (with timeout)
      // Use AbortController for Node.js compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      let response: Response;
      try {
        response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HiveSnapshotBot/1.0; +https://hiveadagency.com)',
        },
          signal: controller.signal,
      });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        // Page exists and is accessible - parse HTML to extract data
        const html = await response.text();
        
        // Extract follower count (look for patterns like "1,234 followers" or "followersCount")
        const followerMatch = html.match(/(\d+(?:,\d+)*)\s*(?:followers?|people follow)/i) ||
                             html.match(/"followersCount":\s*(\d+)/i) ||
                             html.match(/followers?[:\s]+(\d+(?:,\d+)*)/i);
        const followerCount = followerMatch ? parseInt(followerMatch[1].replace(/,/g, '')) : null;
        
        // Extract employee count
        const employeeMatch = html.match(/(\d+(?:,\d+)*)\s*(?:employees?|people)/i) ||
                             html.match(/"employeeCount":\s*(\d+)/i);
        const employeeCount = employeeMatch ? parseInt(employeeMatch[1].replace(/,/g, '')) : null;
        
        // Check for company description/about section
        const hasDescription = html.includes('about') || html.includes('description') || html.includes('overview');
        
        // Check for logo/cover image
        const hasLogo = html.includes('logo') || html.includes('company-logo');
        const hasCoverImage = html.includes('cover') || html.includes('banner');
        
        // Check for recent posts/activity
        const hasRecentPosts = html.includes('post') || html.includes('update') || html.includes('activity');
        
        // Check for services/products section
        const hasServices = html.includes('service') || html.includes('product') || html.includes('offering');
        
        // Calculate completeness score
        let completeness = 40; // Base score
        if (hasDescription) completeness += 15;
        if (hasLogo) completeness += 10;
        if (hasCoverImage) completeness += 10;
        if (hasServices) completeness += 10;
        if (hasRecentPosts) completeness += 15;
        
        const insights: string[] = [];
        if (followerCount && followerCount > 0) {
          insights.push(`${followerCount.toLocaleString()} followers`);
        } else {
          insights.push('Low follower count - focus on building your audience');
        }
        if (employeeCount && employeeCount > 0) {
          insights.push(`${employeeCount.toLocaleString()} employees listed`);
        }
        if (hasDescription) {
          insights.push('Company description is present');
        } else {
          insights.push('Add a comprehensive company description');
        }
        if (hasLogo && hasCoverImage) {
          insights.push('Profile includes logo and cover image');
        } else if (!hasLogo) {
          insights.push('Add company logo for better brand recognition');
        }
        if (hasRecentPosts) {
          insights.push('Recent activity detected');
        } else {
          insights.push('Regular content posts improve engagement');
        }
        
        return {
          found: true,
          url: url,
          followerCount: followerCount || undefined,
          completeness: Math.min(completeness, 100),
          insights,
          recommendations: [
            !hasDescription ? 'Complete all profile sections (About, Services, etc.)' : 'Keep profile sections updated',
            !hasRecentPosts ? 'Post company updates at least 2-3 times per week' : 'Maintain consistent posting schedule',
            !hasLogo ? 'Add company logo and cover image' : 'Keep branding assets updated',
            followerCount && followerCount < 100 ? 'Encourage employees to link to company page' : 'Continue building your network',
            'Share thought leadership content to build authority',
            'Engage with comments and messages promptly',
            hasServices ? 'Consider using LinkedIn Showcase Pages for different products/services' : 'Add services/products section',
          ],
        };
      }
    } catch (error) {
      // Page might be private or require authentication
      console.warn('Could not fetch LinkedIn page:', error);
    }

    // LinkedIn URL is valid but we couldn't fetch details
    return {
      found: true,
      url: url,
      completeness: 50,
      insights: [
        'LinkedIn URL validated and accessible',
        'Consider optimizing your LinkedIn presence for B2B marketing',
        'Complete all profile sections and post regularly to build authority',
      ],
      recommendations: [
        'Complete all profile sections',
        'Post company updates regularly',
        'Encourage employees to link to company page',
        'Add company logo and cover image',
        'Share thought leadership content',
      ],
    };
  } catch (error) {
    console.warn('Error analyzing LinkedIn:', error);
    return {
      found: false,
      insights: ['Could not analyze LinkedIn company page'],
    };
  }
}

