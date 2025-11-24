import OpenAI from 'openai';
import { env } from './env';
import { DEFAULT_RUBRIC, normalizeRubricWeights, getMaturityStage, getMaturityDescription, type ExtractionData, type Scorecard, type RubricDefinition, type PillarScore } from './rubric';
import { detectCompetitors } from './competitor-detection';
import { EXTRACTION_PROMPT, SCORING_PROMPT, INSIGHTS_PROMPT, OVERALL_SCORE_SUMMARY_PROMPT } from './ai-prompts';
import { captureScreenshotsWithDetection, type ScreenshotData } from './screenshot-capture';
import type { BlogAnalysis, AnalyticsAnalysis, BrandAuthority } from './extraction-utils';

// Lazy initialization to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export interface FullReportInsight {
  issue: string;
  evidence: string; // Must quote specific extracted text
  why_it_matters: string;
  recommendation: string;
  pillar: string;
  service: ServiceType; // Which service this insight belongs to
  impact: 'high' | 'medium' | 'low';
  potentialGain: number; // 0-20 points
}

export interface PriorityRoadmapItem {
  priority: number;
  action: string;
  impact: 'high' | 'medium' | 'low';
  specific_changes: string;
  pillar: string;
  service: ServiceType; // Which service this roadmap item belongs to
  potentialGain: number;
}

export interface CopyRewrite {
  element: 'headline' | 'subheadline' | 'cta' | 'section_header';
  current: string; // Exact current text
  recommended: string;
  rationale: string;
}

export interface CompetitorAnalysis {
  competitorsIdentified: Array<{ name: string; descriptor: string }>;
  marketLandscapeOverview: string[];
  positioningComparison: {
    competitorPatterns: string[];
    yourPositioning: string[];
    gaps: string[];
  };
  trustAndSocialProofComparison: Array<{ competitor: string; signals: string[] }>;
  uxAndFunnelComparison: {
    guidedOnboardingMatchingFlows: string[];
    ctaClarity: string[];
    stepsToEngage: string[];
    profileDepth: string[];
    bookingWorkflow: string[];
    mobileUX: string[];
    frictionPoints: string[];
  };
  contentAndAuthorityComparison: {
    blogDepth: string[];
    contentFreshness: string[];
    educationalResources: string[];
    expertPositioning: string[];
    seoStructure: string[];
    categoryLeadership: string[];
  };
  featureSetComparison: {
    bookingTools: string[];
    communicationTools: string[];
    trainerVerification: string[];
    guarantees: string[];
    pricingVisibility: string[];
    membershipOptions: string[];
    appAvailability: string[];
    retentionEngagementFeatures: string[];
  };
  strategicOpportunities: string[];
}

// BlogAnalysis, AnalyticsAnalysis, and BrandAuthority are imported from './extraction-utils'

export interface LinkedInBrandAuthority {
  url?: string;
  followers?: number | null;
  postingFrequency?: string | null;
  latestPostDate?: string | null;
  summary?: string;
}

export interface GBPBrandAuthority {
  url?: string;
  reviewCount?: number | null;
  rating?: number | null;
  latestReviewDate?: string | null;
  summary?: string;
}

// BrandAuthority is imported from './extraction-utils'
// LinkedInBrandAuthority and GBPBrandAuthority are defined above for internal use

export type ServiceType = 'brandingAndImpact' | 'contentAndEngagement' | 'websiteAndConversion';

export interface ServiceReportBlock {
  label: string;
  description: string;
  score: number;
  pillars: PillarScore[];
  keyInsights: FullReportInsight[];
  roadmap: PriorityRoadmapItem[];
  screenshots?: {
    aboveFoldUrl?: string;
    midPageUrl?: string;
    aboveFoldDescription?: string;
    midPageDescription?: string;
  };
  blogAnalysis?: BlogAnalysis | null;
  analyticsAnalysis?: AnalyticsAnalysis | null;
  brandAuthority?: BrandAuthority | null;
}

export interface FullReportResult {
  ok: boolean;
  reportId?: string; // Airtable record ID
  shareUrl?: string; // Unique shareable URL
  companyName?: string; // Extracted company name from website
  overallScore: number;
  overallScoreSummary?: string; // Analytical summary explaining why the score was earned
  maturityStage: 'Basic' | 'Developing' | 'Good' | 'Advanced' | 'World-Class';
  maturityDescription: string;
  services: {
    brandingAndImpact: ServiceReportBlock;
    contentAndEngagement: ServiceReportBlock;
    websiteAndConversion: ServiceReportBlock;
  };
  competitorAnalysis: CompetitorAnalysis;
  globalRoadmap: PriorityRoadmapItem[];
  copySuggestions: CopyRewrite[];
}

/**
 * Extract website data with screenshot analysis using GPT Vision
 */
export async function extractWebsiteDataWithScreenshots(
  url: string,
  htmlHint: string,
  pageSpeedScore: number,
  screenshots: ScreenshotData | null,
  detectionData?: {
    blogAnalysis: BlogAnalysis | null;
    analyticsAnalysis: AnalyticsAnalysis | null;
    brandAuthority: BrandAuthority | null;
  },
  googleBusinessData?: { found: boolean; url?: string; rating?: number; reviewCount?: number; completeness?: number; insights?: string[]; recommendations?: string[] },
  linkedinData?: { found: boolean; url?: string; completeness?: number; followerCount?: number; insights?: string[]; recommendations?: string[] }
): Promise<ExtractionData> {
  // Use more HTML content to ensure footer/social links are included
  const truncatedHtml = htmlHint.substring(0, 6000);
  
  const openai = getOpenAI();
  // Build messages array - include screenshots if available
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You are a data extraction expert. Return only valid JSON, no markdown, no explanations.',
    },
  ];

  // Build user message with screenshots
  let userContent: string | OpenAI.Chat.Completions.ChatCompletionContentPart[] = '';
  
  if (screenshots) {
    // Use vision API with images
    userContent = [
      {
        type: 'text',
        text: `${EXTRACTION_PROMPT}

URL: ${url}
PageSpeed Score: ${pageSpeedScore}/100
HTML Content (truncated):
${truncatedHtml}
${googleBusinessData?.found ? `
Google Business Profile:
- Rating: ${googleBusinessData.rating || 'N/A'}/5.0
- Reviews: ${googleBusinessData.reviewCount || 'N/A'}
- Completeness: ${googleBusinessData.completeness || 'N/A'}%
` : ''}
${linkedinData?.found ? `
LinkedIn Company Page:
- Followers: ${linkedinData.followerCount || 'N/A'}
- Completeness: ${linkedinData.completeness || 'N/A'}%
` : ''}

Analyze the screenshots and HTML. Return JSON only.`,
      },
      {
        type: 'image_url',
        image_url: {
          url: screenshots.aboveFold,
        },
      },
      {
        type: 'image_url',
        image_url: {
          url: screenshots.midPage,
        },
      },
    ];
  } else {
    // Fallback to text-only if no screenshots
    userContent = `${EXTRACTION_PROMPT}

URL: ${url}
PageSpeed Score: ${pageSpeedScore}/100
HTML Content (truncated):
${truncatedHtml}
${googleBusinessData?.found ? `
Google Business Profile:
- Rating: ${googleBusinessData.rating || 'N/A'}/5.0
- Reviews: ${googleBusinessData.reviewCount || 'N/A'}
- Completeness: ${googleBusinessData.completeness || 'N/A'}%
` : ''}
${linkedinData?.found ? `
LinkedIn Company Page:
- Followers: ${linkedinData.followerCount || 'N/A'}
- Completeness: ${linkedinData.completeness || 'N/A'}%
` : ''}

Extract data from the HTML and metadata above. Return JSON only.`;
  }

  messages.push({
    role: 'user',
    content: userContent,
  });

  try {
    const openai = getOpenAI();
    // Add timeout wrapper around OpenAI call (20 seconds - extraction is critical)
    const completionPromise = openai.chat.completions.create({
      model: screenshots ? 'gpt-4o' : 'gpt-4o-mini', // Use vision model if screenshots available
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 2000, // Reduced from 3000 to speed up response
    });
    
    const completionTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('OpenAI extraction API call timed out after 20 seconds'));
      }, 20000);
    });
    
    const completion = await Promise.race([completionPromise, completionTimeout]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const extraction = JSON.parse(content) as ExtractionData;
    extraction.url = url;
    
    // Merge detection data (from browser) with LLM extraction
    // Detection data takes precedence as it's more reliable
    if (detectionData) {
      // Merge blog analysis
      if (detectionData.blogAnalysis) {
        extraction.blogAnalysis = detectionData.blogAnalysis;
        console.log(`✅ Blog detected via browser: ${detectionData.blogAnalysis.postCount} posts`);
      } else if (!extraction.blogAnalysis || extraction.blogAnalysis.postCount === 0) {
        // Only set to null if LLM also didn't find anything
        // Note: Blog URLs may have been discovered in fetchHTMLHint but not analyzed here
        // This is expected in snapshot mode - blog detection is deferred to deep crawl
        extraction.blogAnalysis = undefined;
        // Don't log warning here - it will be logged in unified-assessment.ts with better context
      }
      
      // Merge analytics analysis
      if (detectionData.analyticsAnalysis) {
        extraction.analyticsAnalysis = detectionData.analyticsAnalysis;
        console.log(`✅ Analytics detected via browser: GA4=${detectionData.analyticsAnalysis.ga4Detected}, GTM=${detectionData.analyticsAnalysis.gtmDetected}`);
      } else {
        // null means "unknown" - detection failed
        extraction.analyticsAnalysis = null;
        console.log('⚠️  Analytics detection failed (unknown status)');
      }
      
      // Merge brand authority
      if (detectionData.brandAuthority) {
        extraction.brandAuthority = detectionData.brandAuthority;
        if (detectionData.brandAuthority.linkedin?.url) {
          console.log(`✅ LinkedIn URL detected: ${detectionData.brandAuthority.linkedin.url}`);
        }
        if (detectionData.brandAuthority.gbp?.url) {
          console.log(`✅ GBP URL detected: ${detectionData.brandAuthority.gbp.url}`);
        }
      } else {
        // null means not detected
        extraction.brandAuthority = null;
        console.log('⚠️  No brand authority profiles detected');
      }
    } else {
      // No detection data available - log what LLM found
      // LinkedIn and GBP URLs are logged in unified-assessment.ts with better context
      // Blog detection is also handled there with discovered URLs reconciliation
      if (extraction.brandAuthority?.linkedin?.url) {
        console.log(`✅ LinkedIn URL extracted by LLM: ${extraction.brandAuthority.linkedin.url}`);
      }
      
      if (extraction.brandAuthority?.gbp?.url) {
        console.log(`✅ GBP URL extracted by LLM: ${extraction.brandAuthority.gbp.url}`);
      }
      
      if (extraction.blogAnalysis?.postCount !== undefined && extraction.blogAnalysis.postCount > 0) {
        console.log(`✅ Blog detected by LLM: ${extraction.blogAnalysis.postCount} posts`);
      }
    }
    
    // Add external profiles data (from analysis)
    if (googleBusinessData?.found) {
      extraction.external_profiles.gbp_raw = JSON.stringify(googleBusinessData);
      // Merge with detected GBP if available, or create new entry
      if (!extraction.brandAuthority) {
        extraction.brandAuthority = {};
      }
      extraction.brandAuthority.gbp = {
        url: googleBusinessData.url || null,
        reviewCount: googleBusinessData.reviewCount || null,
        rating: googleBusinessData.rating || null,
        latestReviewDate: null,
        summary: googleBusinessData.insights?.join('. ') || undefined,
        analysis: googleBusinessData, // Include full analysis
      } as any; // Type assertion needed because BrandAuthority.gbp doesn't include analysis in its type definition
    } else if (googleBusinessData && !googleBusinessData.found) {
      // Profile was checked but not found - indicate this
      if (!extraction.brandAuthority) {
        extraction.brandAuthority = {};
      }
      extraction.brandAuthority.gbp = {
        url: null,
        reviewCount: null,
        rating: null,
        latestReviewDate: null,
        summary: 'Google Business Profile not found or not accessible',
        analysis: googleBusinessData,
      } as any; // Type assertion needed because BrandAuthority.gbp doesn't include analysis in its type definition
    }
    
    if (linkedinData?.found) {
      extraction.external_profiles.linkedin_raw = JSON.stringify(linkedinData);
      // Merge with detected LinkedIn if available, or create new entry
      if (!extraction.brandAuthority) {
        extraction.brandAuthority = {};
      }
      extraction.brandAuthority.linkedin = {
        url: linkedinData.url || null,
        followers: linkedinData.followerCount || null,
        postingFrequency: null,
        latestPostDate: null,
        summary: linkedinData.insights?.join('. ') || undefined,
        analysis: linkedinData, // Include full analysis
      } as any; // Type assertion needed for consistency with gbp
    } else if (linkedinData && !linkedinData.found) {
      // Profile was checked but not found - indicate this
      if (!extraction.brandAuthority) {
        extraction.brandAuthority = {};
      }
      extraction.brandAuthority.linkedin = {
        url: null,
        followers: null,
        postingFrequency: null,
        latestPostDate: null,
        summary: 'LinkedIn company page not found or not accessible',
        analysis: linkedinData,
      } as any; // Type assertion needed for consistency with gbp
    }

    return extraction;
  } catch (error) {
    console.error('Error in extraction:', error);
    
    // If timeout occurred, create minimal fallback extraction to allow pipeline to continue
    const isTimeout = error instanceof Error && (
      error.message.includes('timed out') || 
      error.message.includes('timeout') ||
      error.message.includes('Timeout')
    );
    
    if (isTimeout) {
      console.warn('⚠️  Extraction timed out - using minimal fallback data');
      
      // Extract basic info from HTML hint as fallback
      const titleMatch = htmlHint.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const descMatch = htmlHint.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const description = descMatch ? descMatch[1].trim() : '';
      const h1Match = htmlHint.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const h1 = h1Match ? h1Match[1].trim() : '';
      
      // Extract nav items
      const navMatches = htmlHint.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi) || [];
      const navItems: string[] = [];
      navMatches.forEach(nav => {
        const linkMatches = nav.match(/<a[^>]*>([^<]+)<\/a>/gi) || [];
        linkMatches.forEach(link => {
          const textMatch = link.match(/>([^<]+)</i);
          if (textMatch) {
            const text = textMatch[1].trim();
            if (text && !navItems.includes(text)) {
              navItems.push(text);
            }
          }
        });
      });
      
      // Extract company name from title or URL domain
      let companyName = 'Unknown';
      if (title) {
        // Try to extract from title (remove common suffixes, split on | or -)
        const cleanTitle = title
          .split('|')[0]
          .split('-')[0]
          .replace(/\s*-\s*Official.*$/i, '')
          .replace(/\s*-\s*Home.*$/i, '')
          .replace(/\s*\|\s*.*$/, '')
          .trim();
        if (cleanTitle && cleanTitle.length > 2) {
          companyName = cleanTitle;
        }
      }
      
      // Fallback to domain name if title extraction failed
      if (companyName === 'Unknown' || companyName.length < 2) {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace(/^www\./, '');
          // Capitalize first letter of domain
          companyName = domain.split('.')[0]
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        } catch {
          // If URL parsing fails, keep 'Unknown'
        }
      }
      
      // Create minimal fallback extraction
      const fallbackExtraction: ExtractionData = {
        url,
        company_name: companyName,
        meta: {
          title: title || 'Untitled',
          description: description || '',
        },
        hero_section: {
          headline_text: h1 || title || '',
          subheadline_text: description || '',
          cta_buttons: [],
          hero_image_description: '',
        },
        navigation: {
          primary_nav_items: navItems.slice(0, 10),
          secondary_nav_items: [],
        },
        sections: [],
        all_headings: h1 ? [h1] : [],
        all_ctas: [],
        trust_signals: {
          logos_visible: [],
          testimonials_visible: [],
          review_counts_visible: '',
          awards_visible: [],
        },
        value_props: [],
        content_depth_indicators: {
          feature_lists: [],
          benefit_lists: [],
          case_study_snippets: [],
          faq_present: false,
        },
        seo_elements: {
          h1: h1 || '',
          h2_list: [],
          h3_list: [],
          schema_detected: [],
          internal_links_detected: [],
        },
        design_and_layout: {
          visual_hierarchy_notes: 'Extraction timed out - minimal data available',
          cta_visibility_notes: '',
          readability_notes: '',
        },
        external_profiles: {
          linkedin_raw: linkedinData?.found ? JSON.stringify(linkedinData) : '',
          gbp_raw: googleBusinessData?.found ? JSON.stringify(googleBusinessData) : '',
        },
      };
      
      // Merge detection data if available
      if (detectionData) {
        if (detectionData.blogAnalysis) {
          fallbackExtraction.blogAnalysis = detectionData.blogAnalysis;
        }
        if (detectionData.analyticsAnalysis) {
          fallbackExtraction.analyticsAnalysis = detectionData.analyticsAnalysis;
        }
        if (detectionData.brandAuthority) {
          fallbackExtraction.brandAuthority = detectionData.brandAuthority;
        }
      }
      
      // Add external profiles data
      if (googleBusinessData?.found) {
        if (!fallbackExtraction.brandAuthority) {
          fallbackExtraction.brandAuthority = {};
        }
        fallbackExtraction.brandAuthority.gbp = {
          url: googleBusinessData.url || null,
          reviewCount: googleBusinessData.reviewCount || null,
          rating: googleBusinessData.rating || null,
          latestReviewDate: null,
          summary: googleBusinessData.insights?.join('. ') || undefined,
          analysis: googleBusinessData,
        } as any;
      }
      
      if (linkedinData?.found) {
        if (!fallbackExtraction.brandAuthority) {
          fallbackExtraction.brandAuthority = {};
        }
        fallbackExtraction.brandAuthority.linkedin = {
          url: linkedinData.url || null,
          followerCount: linkedinData.followerCount || null,
          summary: linkedinData.insights?.join('. ') || undefined,
          analysis: linkedinData,
        } as any;
      }
      
      console.log('✅ Using fallback extraction data (extraction timed out)');
      return fallbackExtraction;
    }
    
    // For non-timeout errors, fail fast
    throw new Error(`Failed to extract website data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Map pillar ID to service type
 */
export function getServiceForPillar(pillarId: string): ServiceType {
  // Branding & Impact pillars
  if (pillarId === 'brand_clarity' || pillarId === 'messaging_value' || 
      pillarId === 'social' || pillarId === 'reviews') {
    return 'brandingAndImpact';
  }
  
  // Content & Engagement pillars
  if (pillarId === 'content_depth') {
    return 'contentAndEngagement';
  }
  
  // Website & Conversion pillars
  if (pillarId === 'conversion' || pillarId === 'technical_health' || 
      pillarId === 'tech_stack') {
    return 'websiteAndConversion';
  }
  
  // SEO pillar: split between Content & Engagement (content-related) and Website & Conversion (technical)
  // For now, assign based on subpillar context - default to Website & Conversion for technical SEO
  if (pillarId === 'seo') {
    // This will be handled more granularly when we split SEO subpillars
    return 'websiteAndConversion'; // Default to technical/website side
  }
  
  // Competitor positioning: can relate to any service, default to branding
  if (pillarId === 'competitor_positioning') {
    return 'brandingAndImpact';
  }
  
  // Default fallback
  return 'websiteAndConversion';
}

/**
 * Determine if an SEO subpillar is content-related or technical
 */
export function isContentRelatedSEO(subpillarId: string): boolean {
  const contentRelatedSubpillars = ['keyword_alignment', 'h1_quality'];
  return contentRelatedSubpillars.includes(subpillarId);
}

/**
 * Calculate service score from relevant pillars
 * Uses weighted average of pillar scores, re-normalized within the service group
 */
export function calculateServiceScore(
  serviceType: ServiceType,
  pillars: PillarScore[],
  normalizedRubric: RubricDefinition
): number {
  // Define which pillars belong to each service
  const servicePillarMap: Record<ServiceType, string[]> = {
    brandingAndImpact: ['brand_clarity', 'messaging_value', 'social', 'reviews'],
    contentAndEngagement: ['content_depth'],
    websiteAndConversion: ['conversion', 'technical_health', 'tech_stack'],
  };
  
  const relevantPillarIds = servicePillarMap[serviceType];
  let relevantPillars = pillars.filter(p => relevantPillarIds.includes(p.id));
  
  // Handle SEO pillar splitting
  const seoPillar = pillars.find(p => p.id === 'seo');
  if (seoPillar && seoPillar.subpillarScores) {
    const seoPillarDef = normalizedRubric.pillars.find(p => p.id === 'seo');
    if (seoPillarDef) {
      // Split SEO subpillars between content and technical
      const contentSubpillars = seoPillar.subpillarScores.filter(sp => 
        isContentRelatedSEO(sp.id)
      );
      const technicalSubpillars = seoPillar.subpillarScores.filter(sp => 
        !isContentRelatedSEO(sp.id)
      );
      
      if (serviceType === 'contentAndEngagement' && contentSubpillars.length > 0) {
        // Calculate content SEO score from content-related subpillars
        const contentSEOScore = contentSubpillars.reduce((sum, sp) => sum + sp.score, 0) / contentSubpillars.length;
        // Create a virtual SEO pillar for content
        relevantPillars = [...relevantPillars, {
          ...seoPillar,
          id: 'seo_content',
          score: contentSEOScore,
          weightedScore: contentSEOScore * ((seoPillarDef.normalizedWeight || 0) * 0.4),
          subpillarScores: contentSubpillars,
        }];
      } else if (serviceType === 'websiteAndConversion' && technicalSubpillars.length > 0) {
        // Calculate technical SEO score from technical subpillars
        const technicalSEOScore = technicalSubpillars.reduce((sum, sp) => sum + sp.score, 0) / technicalSubpillars.length;
        // Create a virtual SEO pillar for technical
        relevantPillars = [...relevantPillars, {
          ...seoPillar,
          id: 'seo_technical',
          score: technicalSEOScore,
          weightedScore: technicalSEOScore * ((seoPillarDef.normalizedWeight || 0) * 0.6),
          subpillarScores: technicalSubpillars,
        }];
      }
    }
  }
  
  if (relevantPillars.length === 0) {
    return 0;
  }
  
  // Get weights for relevant pillars from rubric
  // For virtual SEO pillars, use the SEO pillar weight adjusted by the split ratio
  const totalWeight = relevantPillars.reduce((sum, p) => {
    if (p.id === 'seo_content' || p.id === 'seo_technical') {
      const seoPillarDef = normalizedRubric.pillars.find(pd => pd.id === 'seo');
      return sum + ((seoPillarDef?.normalizedWeight || 0) * (p.id === 'seo_content' ? 0.4 : 0.6));
    }
    const pillarDef = normalizedRubric.pillars.find(pd => pd.id === p.id);
    return sum + (pillarDef?.normalizedWeight || 0);
  }, 0);
  
  if (totalWeight === 0) {
    // Fallback to simple average if weights aren't available
    // Use normalized pillar scores (they're already normalized in scoreWebsite)
    const avgScore = relevantPillars.reduce((sum, p) => sum + p.score, 0) / relevantPillars.length;
    return Math.round(avgScore);
  }
  
  // Re-normalize weights within this service group and calculate weighted average
  const normalizedWeightedSum = relevantPillars.reduce((sum, p) => {
    let originalWeight = 0;
    if (p.id === 'seo_content' || p.id === 'seo_technical') {
      const seoPillarDef = normalizedRubric.pillars.find(pd => pd.id === 'seo');
      originalWeight = (seoPillarDef?.normalizedWeight || 0) * (p.id === 'seo_content' ? 0.4 : 0.6);
    } else {
      const pillarDef = normalizedRubric.pillars.find(pd => pd.id === p.id);
      originalWeight = pillarDef?.normalizedWeight || 0;
    }
    const normalizedWeight = totalWeight > 0 ? originalWeight / totalWeight : 0;
    return sum + (p.score * normalizedWeight);
  }, 0);
  
  return Math.round(normalizedWeightedSum);
}

/**
 * Normalize score: apply floor and light stretching to avoid harsh 0s and clustering
 * Enforces a minimum visual floor so we rarely show absolute 0s
 * 
 * @param raw - Raw score from LLM (0-100)
 * @returns Normalized score with floor applied (minimum 20)
 */
export function normalizeScore(raw: number): number {
  if (Number.isNaN(raw)) return 40;

  // Clamp 0–100 first
  let s = Math.max(0, Math.min(100, raw));

  // Apply a minimum visual floor so we rarely show absolute 0s
  const FLOOR = 20;
  if (s === 0) return FLOOR;        // truly missing → 20
  if (s < FLOOR) s = FLOOR;

  // Optionally stretch around the middle so we don't cluster at 50–60
  // But preserve the floor - don't stretch below it
  const center = 60;
  const factor = 1.2; // mild stretch
  const centered = s - center;
  const stretched = centered * factor + center;

  // Final clamp - ensure we never go below the floor after stretching
  s = Math.max(FLOOR, Math.min(100, stretched));
  return Math.round(s);
}

/**
 * Stretch score away from center to create broader distribution
 * Centers at 60, multiplies distance by 1.25, clamps to 0-100
 * 
 * @param raw - Raw score from 0-100
 * @returns Stretched score from 0-100
 */
export function stretchScore(raw: number): number {
  const center = 60;
  const stretchFactor = 1.15; // Reduced from 1.25 to be less aggressive
  
  // Clamp input to valid range
  const clampedRaw = Math.max(0, Math.min(100, raw));
  
  // Calculate distance from center
  const distance = clampedRaw - center;
  
  // Stretch the distance
  const stretchedDistance = distance * stretchFactor;
  
  // Calculate new score
  const stretchedScore = center + stretchedDistance;
  
  // Clamp to 0-100 (but allow natural distribution, don't force floor here)
  return Math.max(0, Math.min(100, Math.round(stretchedScore)));
}

/**
 * Score website using rubric
 */
import type { BrandStrengthResult } from './brand-strength-classifier';

export async function scoreWebsite(
  extraction: ExtractionData,
  rubric: RubricDefinition,
  brandStrengthResult?: BrandStrengthResult
): Promise<Scorecard> {
  const normalizedRubric = normalizeRubricWeights(rubric);
  
  // Send FULL extraction data for accurate scoring (not truncated)
  // Include blogAnalysis if available (from browser detection) for accurate blog scoring
  const fullExtractionForScoring = {
    url: extraction.url,
    meta: extraction.meta,
    hero_section: extraction.hero_section,
    navigation: extraction.navigation,
    sections: extraction.sections, // Send all sections, not just 5
    all_headings: extraction.all_headings, // Send all headings
    all_ctas: extraction.all_ctas, // Send all CTAs
    trust_signals: extraction.trust_signals,
    value_props: extraction.value_props, // Send all value props
    content_depth_indicators: extraction.content_depth_indicators,
    seo_elements: extraction.seo_elements,
    design_and_layout: extraction.design_and_layout,
    screenshots: extraction.screenshots,
    blogAnalysis: extraction.blogAnalysis, // Include browser-detected blog analysis for accurate scoring
  };

  // Simplified rubric structure
  const simplifiedRubric = {
    pillars: normalizedRubric.pillars.map(p => ({
      id: p.id,
      label: p.label,
      normalizedWeight: p.normalizedWeight || 0,
      subpillars: p.subpillars.map(sp => ({ id: sp.id, label: sp.label })),
    })),
  };
  
  // Build brand strength context for prompt
  let brandStrengthContext = '';
  if (brandStrengthResult) {
    brandStrengthContext = `

BRAND STRENGTH & CALIBRATION

You are given a brand strength classification for this website:
- brand_strength: ${brandStrengthResult.brand_strength}
- confidence: ${brandStrengthResult.confidence.toFixed(2)}
- reasoning: ${brandStrengthResult.reasoning}

Use this to calibrate your scores appropriately. See the calibration guidelines below.`;
  }

  const prompt = `${SCORING_PROMPT}${brandStrengthContext}

Extraction Data (FULL - use this to score accurately):
${JSON.stringify(fullExtractionForScoring, null, 2)}

Rubric Structure:
${JSON.stringify(simplifiedRubric, null, 2)}

Score each subpillar 0-100 based on the ACTUAL extraction data above. Use the real headlines, CTAs, value props, and content to determine scores. Return JSON with scorecard structure.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a rigorous scoring engine. Score with real variation based on evidence. Return only valid JSON, no markdown, no explanations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4, // Increased to 0.4 to encourage broader score distribution and reduce clustering
      response_format: { type: 'json_object' },
      max_tokens: 5000, // Increased to allow for detailed notes
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const scorecard = JSON.parse(content) as Scorecard;
    
    // Log LLM's original overallScore for debugging
    if (scorecard.overallScore) {
      console.log(`📊 LLM returned overallScore: ${scorecard.overallScore}`);
    }
    
    // Normalize all subpillar scores (apply floor and light stretching)
    scorecard.pillars.forEach(pillar => {
      if (pillar.subpillarScores) {
        pillar.subpillarScores = pillar.subpillarScores.map(sp => ({
          ...sp,
          score: normalizeScore(sp.score),
        }));
      }
      
      // Recalculate pillar score from normalized subpillar scores
      if (pillar.subpillarScores && pillar.subpillarScores.length > 0) {
        const avgSubpillarScore = pillar.subpillarScores.reduce((sum, sp) => sum + sp.score, 0) / pillar.subpillarScores.length;
        pillar.score = normalizeScore(avgSubpillarScore);
      } else {
        pillar.score = normalizeScore(pillar.score);
      }
      
      // Recalculate weighted score
      const pillarDef = normalizedRubric.pillars.find(p => p.id === pillar.id);
      if (pillarDef) {
        pillar.weightedScore = pillar.score * ((pillarDef?.normalizedWeight) || 0);
      }
    });
    
    // Recalculate overall score from normalized pillar scores
    // Verify weights sum to 1.0 for correct calculation
    const totalWeight = scorecard.pillars.reduce((sum, p) => {
      const pillarDef = normalizedRubric.pillars.find(pd => pd.id === p.id);
      return sum + (pillarDef?.normalizedWeight || 0);
    }, 0);
    
    const totalWeightedScore = scorecard.pillars.reduce((sum, p) => sum + p.weightedScore, 0);
    
    // If weights don't sum to 1.0, normalize the weighted sum
    let rawOverallScore: number;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      // Weights don't sum to 1.0, use simple average as fallback
      console.warn(`⚠️  Pillar weights sum to ${totalWeight}, not 1.0. Using weighted average.`);
      rawOverallScore = Math.round(totalWeightedScore / Math.max(totalWeight, 0.01));
    } else {
      rawOverallScore = Math.round(totalWeightedScore);
    }
    
    // Log individual pillar scores for debugging
    console.log(`📊 Pillar scores:`, scorecard.pillars.map(p => `${p.id}: ${p.score} (weight: ${normalizedRubric.pillars.find(pd => pd.id === p.id)?.normalizedWeight || 0})`).join(', '));
    console.log(`📊 Score calculation: totalWeightedScore=${totalWeightedScore}, totalWeight=${totalWeight}, rawOverall=${rawOverallScore}`);
    
    scorecard.overallScore = stretchScore(rawOverallScore);
    
    console.log(`📊 Score normalization: raw overall ${rawOverallScore} → stretched ${scorecard.overallScore}`);
    
    // Ensure maturity stage is set based on normalized score
    if (!scorecard.maturityStage) {
      scorecard.maturityStage = getMaturityStage(scorecard.overallScore);
    }

    return scorecard;
  } catch (error) {
    console.error('Error in scoring:', error);
    // CRITICAL: Scoring is required - fail fast, don't return hardcoded fallback scores
    throw new Error(`Failed to score website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Safe wrapper for scoreWebsite that catches timeouts and errors
 * Returns a result object instead of throwing
 */
export async function safeScoreWebsite(
  extraction: ExtractionData,
  rubric: RubricDefinition,
  brandStrengthResult?: BrandStrengthResult
): Promise<{
  ok: boolean;
  data: Scorecard | null;
  error: string | null;
}> {
  try {
    // Call scoreWebsite with 45s timeout (increased from 20s to handle complex sites)
    const scorecard = await Promise.race([
      scoreWebsite(extraction, rubric, brandStrengthResult),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Website scoring timed out after 45 seconds'));
        }, 45000);
      }),
    ]);
    
    return {
      ok: true,
      data: scorecard,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`⚠️  Website scoring failed or timed out: ${errorMessage}`);
    
    return {
      ok: false,
      data: null,
      error: errorMessage,
    };
  }
}

/**
 * Generate overall score summary explaining why the business earned its score
 */
export async function generateOverallScoreSummary(
  overallScore: number,
  scorecard: Scorecard,
  insights: FullReportInsight[]
): Promise<string | undefined> {
  try {
    // Extract pillar scores
    const pillarScores = scorecard.pillars.map(p => ({
      name: p.id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      score: p.score,
    }));

    // Extract top strengths (from high-scoring pillars and positive insights)
    const topStrengths: string[] = [];
    
    // Get strengths from high-scoring pillars (score >= 70)
    scorecard.pillars
      .filter(p => p.score >= 70)
      .forEach(p => {
        const pillarName = p.id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        topStrengths.push(`${pillarName} (${p.score}/100)`);
      });

    // Get strengths from positive insights (if any mention strengths)
    insights
      .filter(i => i.impact === 'low' && i.issue.toLowerCase().includes('strong'))
      .slice(0, 3)
      .forEach(i => {
        if (!topStrengths.some(s => s.includes(i.issue))) {
          topStrengths.push(i.issue);
        }
      });

    // Extract top gaps (from low-scoring pillars and high-impact insights)
    const topGaps: string[] = [];
    
    // Get gaps from low-scoring pillars (score < 50)
    scorecard.pillars
      .filter(p => p.score < 50)
      .sort((a, b) => a.score - b.score) // Lowest scores first
      .slice(0, 3)
      .forEach(p => {
        const pillarName = p.id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        topGaps.push(`${pillarName} (${p.score}/100)`);
      });

    // Get gaps from high-impact insights
    insights
      .filter(i => i.impact === 'high')
      .slice(0, 3)
      .forEach(i => {
        if (!topGaps.some(g => g.includes(i.issue))) {
          topGaps.push(i.issue);
        }
      });

    // If we don't have enough strengths/gaps, add generic ones based on scores
    if (topStrengths.length === 0) {
      const highestPillar = scorecard.pillars.reduce((max, p) => p.score > max.score ? p : max);
      const pillarName = highestPillar.id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      topStrengths.push(`${pillarName} foundation`);
    }

    if (topGaps.length === 0) {
      const lowestPillar = scorecard.pillars.reduce((min, p) => p.score < min.score ? p : min);
      const pillarName = lowestPillar.id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      topGaps.push(`${pillarName} needs improvement`);
    }

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: OVERALL_SCORE_SUMMARY_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify({
            overall_score: overallScore,
            pillar_scores: pillarScores,
            top_strengths: topStrengths.slice(0, 5),
            top_gaps: topGaps.slice(0, 5),
          }),
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return undefined;
    }

    const result = JSON.parse(content) as { summary: string };
    return result.summary;
  } catch (error) {
    console.error('Error generating overall score summary:', error);
    return undefined;
  }
}

/**
 * Generate high-quality competitor analysis
 */
export async function generateCompetitorAnalysis(
  companyName: string,
  extraction: ExtractionData,
  competitors: string[]
): Promise<CompetitorAnalysis> {
  const competitorAnalysisPrompt = `
You are generating a high-quality, scan-friendly competitor analysis as part of a comprehensive marketing report.

🎯 COMPETITOR ANALYSIS — FRAMEWORK REQUIREMENTS

Structure your output EXACTLY as follows. OUTPUT MUST BE HIGHLY SCANNABLE (HEADINGS, BULLETS, SHORT SECTIONS). DO NOT OUTPUT LARGE PARAGRAPH BLOCKS.

1. Competitors Identified
- Identify 3–5 direct competitors based on: SERP results, website metadata, category context, offer type
- Each competitor must include a one-line descriptor (e.g., "Thumbtack — general services marketplace with large review ecosystem")
- Format: Array of objects with "name" and "descriptor" fields

2. Market Landscape Overview (3–4 bullets)
- Summarize the category and buyer expectations in fast bullets:
  - What users expect when choosing a provider in this category
  - How competitors typically differentiate
  - What signals matter most (trust, reviews, onboarding, UX, etc.)
- Format: Array of short bullet strings

3. Positioning Comparison
- Break this into three bullet groups:
  - Competitor Positioning Patterns: [3–5 bullets summarizing how competitors position themselves]
  - Your Website Positioning: [2–3 bullets describing what the audited site emphasizes]
  - Positioning Gaps: [3–5 bullets showing where the site is under-positioned relative to competitors]
- Format: Object with "competitorPatterns", "yourPositioning", and "gaps" arrays

4. Trust & Social Proof Comparison
- For each major competitor, list what trust signals they use
- Format example: Thumbtack: review volume, verified pros, rating system, badges
- Include the analyzed site's trust signals (or highlight what is missing or underdeveloped, e.g., no reviews, no proof, low credibility)
- This section must be clear, blunt, and specific
- Format: Array of objects with "competitor" name and "signals" array

5. UX & Funnel Comparison
- Compare competitor flows vs. the audited site in structured bullets:
  - guidedOnboardingMatchingFlows: How competitors guide new users vs. the site
  - ctaClarity: CTA visibility and clarity comparison
  - stepsToEngage: Number of steps to engage comparison
  - profileDepth: Profile detail and completeness comparison
  - bookingWorkflow: Booking workflow comparison
  - mobileUX: Mobile UX comparison
  - frictionPoints: Friction points competitors avoid that this site still has
- Format: Object with arrays for each category

6. Content & Authority Comparison
- Analyze how competitors build authority through content:
- Categories: blogDepth, contentFreshness, educationalResources, expertPositioning, seoStructure, categoryLeadership
- Directly compare to what the audited site currently provides
- Format: Object with arrays for each category

7. Feature Set Comparison (Mini Matrix)
- Use bullet lists to compare exactly what competitors offer vs. what is missing:
- Categories: bookingTools, communicationTools, trainerVerification, guarantees, pricingVisibility, membershipOptions, appAvailability, retentionEngagementFeatures
- Call out exactly what competitors offer vs. what is missing on the audited site
- Format: Object with arrays for each feature category

8. Strategic Opportunities (High-Leverage)
- End with a short list of very sharp, actionable opportunities that emerge from the comparison
- Examples:
  - Introduce a structured onboarding/matching flow to reduce friction and increase conversions.
  - Add high-visibility trust elements (reviews, ratings, testimonials) to match category expectations.
  - Create a content hub to close the authority gap with top competitors.
  - Strengthen and clarify the value proposition to differentiate from broad marketplaces.
- Nothing generic. These must be specific and business-critical.
- Format: Array of specific opportunity strings

📌 STYLE REQUIREMENTS:
- Break everything into short scan-friendly blocks
- Use bullets, not paragraphs
- No paragraphs longer than 3 lines
- Use comparative language: "Compared to X, your site…"
- Lean into specificity (pull real insights where possible)
- If competitor signals cannot be detected, transparently note "Not detected" instead of guessing
- Your analysis must be specific to the business based solely on the website content and the inferred competitors
- Avoid generic statements such as "it is important to differentiate" or "competitors have strong marketing"
- Do NOT praise the company; remain factual and analytical
- Keep the tone objective, concise, and consistent with a McKinsey/Bain-style audit

Output format (JSON only):
{
  "competitorsIdentified": [{"name": "Competitor A", "descriptor": "One-line description"}, {"name": "Competitor B", "descriptor": "One-line description"}],
  "marketLandscapeOverview": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "positioningComparison": {
    "competitorPatterns": ["Pattern 1", "Pattern 2"],
    "yourPositioning": ["Your pattern 1", "Your pattern 2"],
    "gaps": ["Gap 1", "Gap 2"]
  },
  "trustAndSocialProofComparison": [
    {"competitor": "Competitor A", "signals": ["Signal 1", "Signal 2"]},
    {"competitor": "Competitor B", "signals": ["Signal 1", "Signal 2"]}
  ],
  "uxAndFunnelComparison": {
    "guidedOnboardingMatchingFlows": ["Comparison point 1", "Comparison point 2"],
    "ctaClarity": ["Comparison point 1"],
    "stepsToEngage": ["Comparison point 1"],
    "profileDepth": ["Comparison point 1"],
    "bookingWorkflow": ["Comparison point 1"],
    "mobileUX": ["Comparison point 1"],
    "frictionPoints": ["Friction point 1"]
  },
  "contentAndAuthorityComparison": {
    "blogDepth": ["Comparison point 1"],
    "contentFreshness": ["Comparison point 1"],
    "educationalResources": ["Comparison point 1"],
    "expertPositioning": ["Comparison point 1"],
    "seoStructure": ["Comparison point 1"],
    "categoryLeadership": ["Comparison point 1"]
  },
  "featureSetComparison": {
    "bookingTools": ["Comparison point 1"],
    "communicationTools": ["Comparison point 1"],
    "trainerVerification": ["Comparison point 1"],
    "guarantees": ["Comparison point 1"],
    "pricingVisibility": ["Comparison point 1"],
    "membershipOptions": ["Comparison point 1"],
    "appAvailability": ["Comparison point 1"],
    "retentionEngagementFeatures": ["Comparison point 1"]
  },
  "strategicOpportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"]
}
`;

  // Extract key website content for analysis
  const extractedWebsiteContent = {
    hero: extraction.hero_section,
    navigation: extraction.navigation,
    headings: extraction.all_headings,
    valueProps: extraction.value_props,
    trustSignals: extraction.trust_signals,
    sections: extraction.sections?.slice(0, 10), // Limit sections
  };

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: competitorAnalysisPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            company_name: companyName,
            extracted_website_content: extractedWebsiteContent,
            industry: undefined, // Can be enhanced later
            competitor_list: competitors,
          }),
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 4000, // Increased for detailed scan-friendly structure
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const result = JSON.parse(content) as CompetitorAnalysis;

    // Normalize competitors to new format if needed
    const normalizedCompetitors = result.competitorsIdentified?.map(c => 
      typeof c === 'string' ? { name: c, descriptor: '' } : c
    ) || competitors.map(c => ({ name: c, descriptor: '' }));

    return {
      competitorsIdentified: normalizedCompetitors,
      marketLandscapeOverview: Array.isArray(result.marketLandscapeOverview) ? result.marketLandscapeOverview : [],
      positioningComparison: result.positioningComparison || {
        competitorPatterns: [],
        yourPositioning: [],
        gaps: [],
      },
      trustAndSocialProofComparison: Array.isArray(result.trustAndSocialProofComparison) ? result.trustAndSocialProofComparison : [],
      uxAndFunnelComparison: result.uxAndFunnelComparison || {
        guidedOnboardingMatchingFlows: [],
        ctaClarity: [],
        stepsToEngage: [],
        profileDepth: [],
        bookingWorkflow: [],
        mobileUX: [],
        frictionPoints: [],
      },
      contentAndAuthorityComparison: result.contentAndAuthorityComparison || {
        blogDepth: [],
        contentFreshness: [],
        educationalResources: [],
        expertPositioning: [],
        seoStructure: [],
        categoryLeadership: [],
      },
      featureSetComparison: result.featureSetComparison || {
        bookingTools: [],
        communicationTools: [],
        trainerVerification: [],
        guarantees: [],
        pricingVisibility: [],
        membershipOptions: [],
        appAvailability: [],
        retentionEngagementFeatures: [],
      },
      strategicOpportunities: Array.isArray(result.strategicOpportunities) ? result.strategicOpportunities : [],
    };
  } catch (error) {
    console.error('Error generating competitor analysis:', error);
    // Return fallback
    return {
      competitorsIdentified: competitors.map(c => ({ name: c, descriptor: '' })),
      marketLandscapeOverview: [],
      positioningComparison: {
        competitorPatterns: [],
        yourPositioning: [],
        gaps: [],
      },
      trustAndSocialProofComparison: [],
      uxAndFunnelComparison: {
        guidedOnboardingMatchingFlows: [],
        ctaClarity: [],
        stepsToEngage: [],
        profileDepth: [],
        bookingWorkflow: [],
        mobileUX: [],
        frictionPoints: [],
      },
      contentAndAuthorityComparison: {
        blogDepth: [],
        contentFreshness: [],
        educationalResources: [],
        expertPositioning: [],
        seoStructure: [],
        categoryLeadership: [],
      },
      featureSetComparison: {
        bookingTools: [],
        communicationTools: [],
        trainerVerification: [],
        guarantees: [],
        pricingVisibility: [],
        membershipOptions: [],
        appAvailability: [],
        retentionEngagementFeatures: [],
      },
      strategicOpportunities: [],
    };
  }
}

/**
 * Generate evidence-based insights
 */
export async function generateInsights(
  extraction: ExtractionData,
  scorecard: Scorecard,
  competitors?: string[],
  isSnapshot?: boolean // If true, generate fewer insights for faster processing
): Promise<{
  summary: string;
  insights: FullReportInsight[];
  priorityRoadmap: PriorityRoadmapItem[];
  copyRewrites: CopyRewrite[];
}> {
  // Send full extraction for evidence-based insights
  const fullExtraction = {
    url: extraction.url,
    meta: extraction.meta,
    hero_section: extraction.hero_section,
    navigation: extraction.navigation,
    sections: extraction.sections,
    all_headings: extraction.all_headings,
    all_ctas: extraction.all_ctas,
    trust_signals: extraction.trust_signals,
    value_props: extraction.value_props,
    content_depth_indicators: extraction.content_depth_indicators,
    seo_elements: extraction.seo_elements,
    design_and_layout: extraction.design_and_layout,
    screenshots: extraction.screenshots,
  };

  // Full scorecard with weak areas highlighted
  const fullScorecard = {
    overallScore: scorecard.overallScore,
    maturityStage: scorecard.maturityStage,
    pillars: scorecard.pillars.map(p => ({
      id: p.id,
      score: p.score,
      subpillarScores: p.subpillarScores,
    })),
  };

  const insightCount = isSnapshot ? '5-10' : '15-25';
  const prompt = `${INSIGHTS_PROMPT}

Extraction Data (full):
${JSON.stringify(fullExtraction, null, 2)}

Scorecard:
${JSON.stringify(fullScorecard, null, 2)}

${competitors && competitors.length > 0 ? `Competitors: ${competitors.join(', ')}` : ''}

${isSnapshot ? 'Generate 5-10 evidence-based insights (snapshot mode - focus on top priorities only).' : 'Generate 15-25 evidence-based insights.'} Every insight MUST quote specific extracted text. Return JSON only.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a senior marketing strategist. Return only valid JSON, no markdown, no explanations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.6, // Increased from 0.4 to 0.6 for more creative, varied insights
      response_format: { type: 'json_object' },
      max_tokens: isSnapshot ? 4000 : 8000, // Reduced tokens for snapshot mode (fewer insights)
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const result = JSON.parse(content) as {
      summary: string;
      insights: FullReportInsight[];
      priorityRoadmap: PriorityRoadmapItem[];
      copyRewrites: CopyRewrite[];
      competitorAnalysis: CompetitorAnalysis;
    };

    // Normalize arrays
    if (!Array.isArray(result.insights)) result.insights = [];
    if (!Array.isArray(result.priorityRoadmap)) result.priorityRoadmap = [];
    if (!Array.isArray(result.copyRewrites)) result.copyRewrites = [];
    // Use the separately generated competitor analysis instead of from insights
    // (competitorAnalysis is generated separately above)

    // Calculate potential gains for insights and roadmap items based on pillar weights
    const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
    
    // Calculate potential gains and assign service classification for insights
    result.insights = result.insights.map(insight => {
      const pillar = normalizedRubric.pillars.find(p => p.id === insight.pillar);
      const pillarScore = scorecard.pillars.find(p => p.id === insight.pillar)?.score || 35;
      // Formula: potential = (100 - pillar.score) * pillar.normalizedWeight * 1.2
      const potential = Math.round((100 - pillarScore) * (pillar?.normalizedWeight || 0) * 1.2);
      
      // Assign service if not already assigned
      const service = insight.service || getServiceForPillar(insight.pillar);
      
      return {
        ...insight,
        service,
        potentialGain: Math.min(20, Math.max(0, potential)),
      };
    });
    
    // Calculate potential gains and assign service classification for roadmap items
    result.priorityRoadmap = result.priorityRoadmap.map(item => {
      const pillar = normalizedRubric.pillars.find(p => p.id === item.pillar);
      const pillarScore = scorecard.pillars.find(p => p.id === item.pillar)?.score || 35;
      // Formula: potential = (100 - pillar.score) * pillar.normalizedWeight * 1.2
      const potential = Math.round((100 - pillarScore) * (pillar?.normalizedWeight || 0) * 1.2);
      
      // Assign service if not already assigned
      const service = item.service || getServiceForPillar(item.pillar);
      
      return {
        ...item,
        service,
        potentialGain: Math.min(20, Math.max(0, potential)),
      };
    });

    return result;
  } catch (error) {
    console.error('Error in insights generation:', error);
    // CRITICAL: Insights generation is required - fail fast, don't return hardcoded empty data
    throw new Error(`Failed to generate insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate full comprehensive report
 */
export async function generateFullReport(
  url: string,
  htmlHint: string,
  pageSpeedScore: number,
  screenshots: ScreenshotData | null,
  detectionData?: {
    blogAnalysis: BlogAnalysis | null;
    analyticsAnalysis: AnalyticsAnalysis | null;
    brandAuthority: BrandAuthority | null;
  },
  googleBusinessData?: { found: boolean; url?: string; rating?: number; reviewCount?: number; completeness?: number; insights?: string[]; recommendations?: string[] },
  linkedinData?: { found: boolean; url?: string; completeness?: number; followerCount?: number; insights?: string[]; recommendations?: string[] }
): Promise<FullReportResult> {
  const startTime = Date.now();
  console.log('🔍 Starting full report generation for:', url);

  try {
    // Step 1: Extract data with screenshots
    console.log('📊 Step 1: Extracting website data with screenshots...');
    const extraction = await extractWebsiteDataWithScreenshots(
      url,
      htmlHint,
      pageSpeedScore,
      screenshots,
      detectionData,
      googleBusinessData,
      linkedinData
    );
    console.log(`✅ Extraction complete (${Date.now() - startTime}ms)`);

    // Step 2: Score using rubric
    console.log('📊 Step 2: Scoring website with rubric...');
    const scorecard = await scoreWebsite(extraction, DEFAULT_RUBRIC);
    console.log(`✅ Scoring complete. Overall score: ${scorecard.overallScore}/100 (${Date.now() - startTime}ms)`);

    // Step 3: Detect competitors
    const competitorCluster = detectCompetitors(htmlHint);
    const competitors = competitorCluster?.competitors || [];
    if (competitors.length > 0) {
      console.log(`🎯 Competitors detected: ${competitors.join(', ')}`);
    }

    // Step 4: Generate high-quality competitor analysis
    console.log('📊 Step 4: Generating competitor analysis...');
    const competitorAnalysis = await generateCompetitorAnalysis(
      extraction.company_name || url,
      extraction,
      competitors
    );
    console.log(`✅ Competitor analysis complete`);

    // Step 5: Generate evidence-based insights
    console.log('📊 Step 5: Generating evidence-based insights...');
    const insightsResult = await generateInsights(extraction, scorecard, competitors);
    console.log(`✅ Insights generation complete (${Date.now() - startTime}ms)`);

    console.log(`🎉 Full report generation completed successfully in ${Date.now() - startTime}ms`);

    // Get maturity stage and description
    const maturityStage = scorecard.maturityStage;
    const maturityDescription = getMaturityDescription(maturityStage);

    // Build screenshots object with URLs
    const screenshotsData = screenshots ? {
      aboveFoldUrl: screenshots.aboveFold.startsWith('data:') ? screenshots.aboveFold : `data:image/png;base64,${screenshots.aboveFold}`,
      midPageUrl: screenshots.midPage.startsWith('data:') ? screenshots.midPage : `data:image/png;base64,${screenshots.midPage}`,
      aboveFoldDescription: extraction.screenshots?.above_fold_description || '',
      midPageDescription: extraction.screenshots?.mid_page_description || '',
    } : undefined;

    if (screenshotsData) {
      console.log(`📸 Screenshots included in response`);
    } else {
      console.log('⚠️  No screenshots in response (screenshots were not captured)');
    }

    // Extract blog analysis - prefer new top-level field (which may be null), fallback to nested
    const blogAnalysis: BlogAnalysis | null | undefined = 
      extraction.blogAnalysis !== undefined 
        ? (extraction.blogAnalysis as BlogAnalysis | null) // Can be BlogAnalysis object or null - cast to handle postingFrequency type mismatch
        : (extraction.content_depth_indicators?.blog_content && extraction.content_depth_indicators.blog_content.blog_post_count_estimate > 0
          ? {
              postCount: extraction.content_depth_indicators.blog_content.blog_post_count_estimate,
              latestPostDate: extraction.content_depth_indicators.blog_content.recency || undefined,
              postingFrequency: (extraction.content_depth_indicators.blog_content.posting_frequency as 'no_recent_posts' | 'low' | 'medium' | 'high' | undefined) || undefined,
              topics: extraction.content_depth_indicators.blog_content.recent_blog_topics?.length > 0 
                ? extraction.content_depth_indicators.blog_content.recent_blog_topics 
                : extraction.content_depth_indicators.blog_content.blog_categories || undefined,
              hasInternalLinksToCorePages: extraction.content_depth_indicators.blog_content.internal_linking_patterns 
                ? extraction.content_depth_indicators.blog_content.internal_linking_patterns.length > 0 
                : undefined,
              notes: extraction.content_depth_indicators.blog_content.blog_content_quality || undefined,
            } as BlogAnalysis
          : null); // null means not detected

    // Extract analytics analysis - prefer new top-level field (which may be null), fallback to nested
    const analyticsAnalysis: AnalyticsAnalysis | null | undefined = 
      extraction.analyticsAnalysis !== undefined
        ? extraction.analyticsAnalysis // Can be AnalyticsAnalysis object or null
        : (extraction.analytics_analysis
          ? {
              ga4Detected: extraction.analytics_analysis.ga4_detected || false,
              gtmDetected: extraction.analytics_analysis.gtm_detected || false,
              metaPixelDetected: extraction.analytics_analysis.meta_pixel_detected || false,
              hotjarDetected: extraction.analytics_analysis.hotjar_detected || false,
              mixpanelOrAmplitudeDetected: (extraction.analytics_analysis.mixpanel_detected || extraction.analytics_analysis.amplitude_detected) || false,
              summary: extraction.analytics_analysis.analytics_completeness || extraction.analytics_analysis.analytics_correctness || 
                `Detected: ${extraction.analytics_analysis.analytics_tools_found.join(', ') || 'None'}`,
            }
          : null); // null means unknown (detection failed)

    // Extract brand authority - prefer new top-level field (which may be null), fallback to nested
    const brandAuthority: BrandAuthority | null | undefined = 
      extraction.brandAuthority !== undefined
        ? (extraction.brandAuthority as BrandAuthority | null) // Can be BrandAuthority object or null - cast to handle type mismatch
        : ((extraction.social?.linkedin_analysis || extraction.social?.gbp_analysis) ? {
      linkedin: extraction.social?.linkedin_analysis ? {
        url: extraction.external_profiles?.linkedin_raw ? (() => {
          try {
            const parsed = JSON.parse(extraction.external_profiles.linkedin_raw || '{}');
            return parsed.url || undefined;
          } catch {
            return undefined;
          }
        })() : undefined,
        followers: extraction.social.linkedin_analysis.follower_count || null,
        postingFrequency: extraction.social.linkedin_analysis.posting_frequency || null,
        latestPostDate: extraction.social.linkedin_analysis.latest_post_date || null,
        summary: extraction.social.linkedin_analysis.activity_level || undefined,
      } : undefined,
      gbp: extraction.social?.gbp_analysis ? {
        url: extraction.external_profiles?.gbp_raw ? (() => {
          try {
            const parsed = JSON.parse(extraction.external_profiles.gbp_raw || '{}');
            return parsed.url || undefined;
          } catch {
            return undefined;
          }
        })() : undefined,
        reviewCount: extraction.social.gbp_analysis.review_count || null,
        rating: extraction.social.gbp_analysis.rating || null,
          latestReviewDate: extraction.social.gbp_analysis.latest_review_date || null,
          summary: extraction.social.gbp_analysis.review_recency || undefined,
        } : undefined,
      } as BrandAuthority
        : null); // null means not detected - cast to BrandAuthority to handle type mismatch

    console.log(`📊 Analysis sections extracted:`);
    console.log(`   - Blog Analysis: ${blogAnalysis ? '✅' : '❌'}`);
    console.log(`   - Analytics Analysis: ${analyticsAnalysis ? '✅' : '❌'}`);
    console.log(`   - Brand Authority: ${brandAuthority ? '✅' : '❌'}`);

    // Get normalized rubric for service score calculations
    const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);

    // Group pillars by service
    const brandingPillars = scorecard.pillars.filter(p => 
      ['brand_clarity', 'messaging_value', 'social', 'reviews'].includes(p.id)
    );
    const contentPillars = scorecard.pillars.filter(p => 
      p.id === 'content_depth'
    );
    const websitePillars = scorecard.pillars.filter(p => 
      ['conversion', 'technical_health', 'tech_stack'].includes(p.id)
    );

    // Handle SEO pillar splitting - add content-related SEO to content, technical SEO to website
    const seoPillar = scorecard.pillars.find(p => p.id === 'seo');
    if (seoPillar) {
      const contentSEOSubpillars = seoPillar.subpillarScores?.filter(sp => 
        isContentRelatedSEO(sp.id)
      ) || [];
      const technicalSEOSubpillars = seoPillar.subpillarScores?.filter(sp => 
        !isContentRelatedSEO(sp.id)
      ) || [];
      
      if (contentSEOSubpillars.length > 0) {
        const contentSEOScore = contentSEOSubpillars.reduce((sum, sp) => sum + sp.score, 0) / contentSEOSubpillars.length;
        contentPillars.push({
          ...seoPillar,
          score: contentSEOScore,
          weightedScore: contentSEOScore * ((normalizedRubric.pillars.find(p => p.id === 'seo')?.normalizedWeight || 0) * 0.4),
          subpillarScores: contentSEOSubpillars,
        });
      }
      
      if (technicalSEOSubpillars.length > 0) {
        const technicalSEOScore = technicalSEOSubpillars.reduce((sum, sp) => sum + sp.score, 0) / technicalSEOSubpillars.length;
        websitePillars.push({
          ...seoPillar,
          score: technicalSEOScore,
          weightedScore: technicalSEOScore * ((normalizedRubric.pillars.find(p => p.id === 'seo')?.normalizedWeight || 0) * 0.6),
          subpillarScores: technicalSEOSubpillars,
        });
      }
    }

    // Calculate service scores
    const brandingScore = calculateServiceScore('brandingAndImpact', scorecard.pillars, normalizedRubric);
    const contentScore = calculateServiceScore('contentAndEngagement', scorecard.pillars, normalizedRubric);
    const websiteScore = calculateServiceScore('websiteAndConversion', scorecard.pillars, normalizedRubric);

    // Group insights by service
    const brandingInsights = insightsResult.insights.filter(i => i.service === 'brandingAndImpact');
    const contentInsights = insightsResult.insights.filter(i => i.service === 'contentAndEngagement');
    const websiteInsights = insightsResult.insights.filter(i => i.service === 'websiteAndConversion');

    // Group roadmap items by service
    const brandingRoadmap = insightsResult.priorityRoadmap.filter(r => r.service === 'brandingAndImpact');
    const contentRoadmap = insightsResult.priorityRoadmap.filter(r => r.service === 'contentAndEngagement');
    const websiteRoadmap = insightsResult.priorityRoadmap.filter(r => r.service === 'websiteAndConversion');

    // Create global roadmap (all items, sorted by potential points gain)
    const globalRoadmap = [...insightsResult.priorityRoadmap].sort((a, b) => {
      // Sort by potentialGain (points) descending, then by priority
      if (b.potentialGain !== a.potentialGain) return b.potentialGain - a.potentialGain;
      return a.priority - b.priority;
    });

    // Build service report blocks
    const services = {
      brandingAndImpact: {
        label: 'Branding & Impact',
        description: 'A clearly defined brand reduces friction in the buying process by improving message clarity, increasing perceived credibility, and aligning internal and external communication. Strong brand foundations improve marketing efficiency by ensuring all content, campaigns, and sales interactions communicate consistent value.',
        score: brandingScore,
        pillars: brandingPillars,
        keyInsights: brandingInsights.slice(0, 6), // Top 4-6 insights
        roadmap: brandingRoadmap.slice(0, 5), // Top 3-5 roadmap items
        brandAuthority: brandAuthority,
      },
      contentAndEngagement: {
        label: 'Content & Engagement',
        description: 'A structured content system enhances discoverability, supports SEO growth, and drives sustained inbound demand. High-quality content improves lead quality by educating prospects, accelerating problem awareness, and positioning your business as a trusted authority within your category.',
        score: contentScore,
        pillars: contentPillars,
        keyInsights: contentInsights.slice(0, 6), // Top 4-6 insights
        roadmap: contentRoadmap.slice(0, 5), // Top 3-5 roadmap items
        blogAnalysis: blogAnalysis,
      },
      websiteAndConversion: {
        label: 'Website & Conversion',
        description: 'Website performance directly influences conversion rates, user trust, and revenue efficiency. When UX, messaging, and analytics are aligned, the website becomes a measurable acquisition asset—reducing cost per lead, improving engagement, and enabling continuous optimization through data-driven insights.',
        score: websiteScore,
        pillars: websitePillars,
        keyInsights: websiteInsights.slice(0, 6), // Top 4-6 insights
        roadmap: websiteRoadmap.slice(0, 5), // Top 3-5 roadmap items
        screenshots: screenshotsData,
        analyticsAnalysis: analyticsAnalysis,
      },
    };

    console.log(`📊 Service scores calculated:`);
    console.log(`   - Branding & Impact: ${brandingScore}/100`);
    console.log(`   - Content & Engagement: ${contentScore}/100`);
    console.log(`   - Website & Conversion: ${websiteScore}/100`);

    // Generate overall score summary
    console.log('📊 Generating overall score summary...');
    const overallScoreSummary = await generateOverallScoreSummary(
      scorecard.overallScore,
      scorecard,
      insightsResult.insights
    );
    if (overallScoreSummary) {
      console.log(`✅ Overall score summary generated`);
    }

    return {
      ok: true,
      companyName: extraction.company_name,
      overallScore: scorecard.overallScore,
      overallScoreSummary,
      maturityStage,
      maturityDescription,
      services,
      competitorAnalysis,
      globalRoadmap,
      copySuggestions: insightsResult.copyRewrites,
    };
  } catch (error) {
    console.error('❌ Error in full report generation:', error);
    throw error;
  }
}

