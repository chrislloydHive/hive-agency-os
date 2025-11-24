/**
 * Unified Assessment System
 * 
 * Single source of truth for all website assessments.
 * Both Snapshot and Full Report use this function to ensure consistent scoring.
 */

import { env } from './env';
import { DEFAULT_RUBRIC, normalizeRubricWeights, getMaturityStage, getMaturityDescription, type ExtractionData, type Scorecard } from './rubric';
import { detectCompetitors } from './competitor-detection';
import { captureScreenshotsWithDetection, type ScreenshotData } from './screenshot-capture';
import { getPageSpeedScore, fetchHTMLHint } from './ai';
import { analyzeGoogleBusiness, analyzeLinkedIn } from './profile-analyzer';
import type { BlogAnalysis, AnalyticsAnalysis, BrandAuthority } from './extraction-utils';
import type { PriorityRoadmapItem, CopyRewrite, CompetitorAnalysis, ServiceReportBlock } from './full-report-analysis';
import { 
  extractWebsiteDataWithScreenshots, 
  scoreWebsite,
  safeScoreWebsite, 
  generateInsights, 
  generateCompetitorAnalysis,
  calculateServiceScore,
  getServiceForPillar,
  stretchScore,
  generateOverallScoreSummary
} from './full-report-analysis';
import { classifyBrandStrength, type BrandStrengthResult } from './brand-strength-classifier';

/**
 * Complete assessment result containing all analysis data
 */
export interface AssessmentResult {
  // Basic info
  companyName?: string;
  url: string;
  
  // Overall scores
  overallScore: number;
  overallScoreSummary?: string;
  maturityStage: 'Basic' | 'Developing' | 'Good' | 'Advanced' | 'World-Class';
  maturityDescription: string;
  
  // Service-level scores (for snapshot)
  brandScore: number;
  contentScore: number;
  websiteScore: number;
  
  // Full rubric data
  scorecard: Scorecard;
  extraction: ExtractionData;
  
  // Summary and insights
  summary: string;
  topStrengths: string[];
  quickWins: string[];
  emergingRisks: string[];
  
  // Competitor analysis
  competitorTeaser: string[]; // Array of 2-3 bullet points about competitors
  competitorAnalysis: CompetitorAnalysis;
  
  // Full report data (service blocks)
  services: {
    brandingAndImpact: ServiceReportBlock;
    contentAndEngagement: ServiceReportBlock;
    websiteAndConversion: ServiceReportBlock;
  };
  
  // Roadmap and suggestions
  globalRoadmap: PriorityRoadmapItem[];
  copySuggestions: CopyRewrite[];
  
  // Screenshots
  screenshots?: {
    aboveFoldUrl?: string;
    midPageUrl?: string;
    aboveFoldDescription?: string;
    midPageDescription?: string;
  };
  
  // Scoring metadata
  websiteScoringAvailable?: boolean; // Whether website scoring completed successfully (defaults to true for backward compatibility)
  
  // Brand strength classification (optional, backward compatible)
  brandStrength?: 'global_iconic' | 'major_established' | 'mid_market' | 'early_stage_startup' | 'small_local_business';
  brandStrengthConfidence?: number;
  brandStrengthReasoning?: string;
}

/**
 * Create a fallback scorecard when website scoring fails
 * Uses conservative scores based on maturity stage
 */
function createFallbackScorecard(
  maturityStage: 'Basic' | 'Developing' | 'Good' | 'Advanced' | 'World-Class',
  normalizedRubric: ReturnType<typeof normalizeRubricWeights>
): Scorecard {
  // Determine fallback website score based on maturity stage
  // Category Leaders (World-Class/Advanced) get at least 70, others get 60
  const fallbackWebsiteScore = (maturityStage === 'World-Class' || maturityStage === 'Advanced') ? 70 : 60;
  
  const fallbackPillars = DEFAULT_RUBRIC.pillars.map(pillar => {
    const normalizedWeight = normalizedRubric.pillars.find(p => p.id === pillar.id)?.normalizedWeight || 0;
    const service = getServiceForPillar(pillar.id);
    
    // Use fallback website score for website & conversion pillars, otherwise use a mid-range score
    let pillarScore = fallbackWebsiteScore;
    if (service !== 'websiteAndConversion') {
      // For brand and content pillars, use a conservative mid-range score
      pillarScore = 60;
    }
    
    return {
      id: pillar.id,
      score: pillarScore,
      weightedScore: pillarScore * normalizedWeight,
      subpillarScores: pillar.subpillars.map(sub => ({
        id: sub.id,
        score: pillarScore,
        notes: 'Scoring timed out - using conservative fallback score',
      })),
      notes: 'Scoring timed out - using conservative fallback score based on maturity stage',
    };
  });
  
  // Calculate overall score as weighted average
  const overallScore = Math.round(
    fallbackPillars.reduce((sum, p) => sum + p.weightedScore, 0)
  );
  
  return {
    overallScore,
    maturityStage: getMaturityStage(overallScore),
    pillars: fallbackPillars,
  };
}

/**
 * Generate complete assessment for a website
 * 
 * This is the single source of truth for all assessments.
 * Both Snapshot and Full Report use this function.
 * 
 * @param url - Website URL to assess
 * @param options - Optional configuration
 * @returns Complete AssessmentResult with all analysis data
 */
export async function generateFullAssessment(
  url: string,
  options?: {
    googleBusinessUrl?: string;
    linkedinUrl?: string;
    includeScreenshots?: boolean; // Default: true
    mode?: 'snapshot' | 'full'; // 'snapshot' skips heavy operations, 'full' does everything
    snapshotScores?: {
      brandScore: number;
      contentScore: number;
      websiteScore: number;
      overallScore: number;
    };
    snapshotScorecard?: Scorecard; // Full scorecard from snapshot to reuse
  }
): Promise<AssessmentResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 GENERATING UNIFIED ASSESSMENT');
  console.log(`📊 URL: ${url}`);
  console.log(`📊 Mode: ${options?.mode || 'full'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const mode = options?.mode || 'full';
  const isSnapshot = mode === 'snapshot';
  const includeScreenshots = isSnapshot ? false : (options?.includeScreenshots !== false); // Snapshot never includes screenshots
  
  // Step 1: Fetch PageSpeed score
  console.log('📊 Fetching PageSpeed score...');
  const pageSpeedResult = await Promise.race([
    getPageSpeedScore(url),
    new Promise<{ performance: number; url: string }>((resolve) =>
      setTimeout(() => resolve({ performance: 75, url }), 10000)
    ),
  ]);

  // Step 2: Fetch HTML hint and discover URLs
  console.log('📊 Fetching HTML content...');
  const htmlHintResult = await Promise.race([
    fetchHTMLHint(url, true),
    new Promise<{ htmlHint: string; urls: { blogUrls: string[]; linkedinUrls: string[]; facebookUrls: string[]; instagramUrls: string[]; gbpUrls: string[] } }>((resolve) => 
      setTimeout(() => resolve({ htmlHint: '', urls: { blogUrls: [], linkedinUrls: [], facebookUrls: [], instagramUrls: [], gbpUrls: [] } }), 10000)
    ),
  ]).catch(() => ({ htmlHint: '', urls: { blogUrls: [], linkedinUrls: [], facebookUrls: [], instagramUrls: [], gbpUrls: [] } }));
  
  const htmlHint = htmlHintResult.htmlHint || '';
  const discoveredUrls = htmlHintResult.urls || { blogUrls: [], linkedinUrls: [], facebookUrls: [], instagramUrls: [], gbpUrls: [] };

  // Step 3: Capture screenshots and perform detection (if enabled)
  let screenshots: ScreenshotData | null = null;
  let detectionData: {
    blogAnalysis: BlogAnalysis | null;
    analyticsAnalysis: AnalyticsAnalysis | null;
    brandAuthority: BrandAuthority | null;
  } | null = null;
  
  if (includeScreenshots) {
    console.log('📸 Capturing screenshots and performing detection...');
    try {
      const result = await Promise.race([
        captureScreenshotsWithDetection(url),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Screenshot capture and detection timed out after 45 seconds'));
          }, 45000);
        }),
      ]);
      
      screenshots = result?.screenshots || null;
      detectionData = result?.detection || null;
      console.log('✅ Screenshots captured successfully');
    } catch (screenshotError) {
      console.error('❌ Screenshot capture or detection failed:', screenshotError);
      // Continue without screenshots - they're optional for snapshot
      screenshots = null;
      detectionData = null;
    }
  }

  // Step 4: Analyze Google Business Profile and LinkedIn (non-blocking, optional)
  // Use discovered URLs if not provided in options
  const linkedinUrlToAnalyze = options?.linkedinUrl || discoveredUrls.linkedinUrls[0] || undefined;
  const gbpUrlToAnalyze = options?.googleBusinessUrl || discoveredUrls.gbpUrls[0] || undefined;
  
  console.log('🔍 Analyzing external profiles...');
  // Add timeouts to profile analysis to prevent hanging (8 seconds each)
  const profileTimeout = 8000;
  const [googleBusinessAnalysis, linkedinAnalysis] = await Promise.allSettled([
    gbpUrlToAnalyze 
      ? Promise.race([
          analyzeGoogleBusiness(gbpUrlToAnalyze),
          new Promise<{ found: false }>((resolve) => 
            setTimeout(() => resolve({ found: false }), profileTimeout)
          ),
        ])
      : Promise.resolve({ found: false }),
    linkedinUrlToAnalyze 
      ? Promise.race([
          analyzeLinkedIn(linkedinUrlToAnalyze),
          new Promise<{ found: false }>((resolve) => 
            setTimeout(() => resolve({ found: false }), profileTimeout)
          ),
        ])
      : Promise.resolve({ found: false }),
  ]);

  const googleBusiness =
    googleBusinessAnalysis.status === 'fulfilled'
      ? googleBusinessAnalysis.value
      : { found: false };
  const linkedin =
    linkedinAnalysis.status === 'fulfilled'
      ? linkedinAnalysis.value
      : { found: false };
  
  // Log analysis results with improved messaging
  if (googleBusiness.found) {
    console.log(`✅ Google Business Profile analyzed: ${(googleBusiness as any).insights?.length || 0} insights`);
  } else {
    // Check if we discovered GBP URLs but didn't analyze them
    if (discoveredUrls.gbpUrls.length > 0) {
      console.log(`ℹ️  Google Business Profile URL detected but not analyzed in this snapshot (${discoveredUrls.gbpUrls.length} URL(s) found)`);
    } else {
      console.log(`ℹ️  Google Business Profile was not evaluated in this snapshot`);
    }
  }
  
  if (linkedin.found) {
    console.log(`✅ LinkedIn profile analyzed: ${(linkedin as any).insights?.length || 0} insights`);
  } else {
    // Check if we discovered LinkedIn URLs but didn't analyze them
    if (discoveredUrls.linkedinUrls.length > 0) {
      console.log(`ℹ️  LinkedIn profile URL detected, but profile was not analyzed in this run (${discoveredUrls.linkedinUrls.length} URL(s) found)`);
    } else {
      console.log(`ℹ️  LinkedIn profile was not evaluated in this snapshot`);
    }
  }

  // Step 5: Extract website data (with screenshots if available)
  // For snapshot mode, skip detection (blog/analytics/social) to speed things up
  console.log('🔍 Extracting website data...');
  // Add timeout to extraction (25 seconds - OpenAI API calls can be slow)
  const extractionTimeout = 25000;
  const extraction = await Promise.race([
    extractWebsiteDataWithScreenshots(
      url,
      htmlHint,
      pageSpeedResult.performance,
      isSnapshot ? null : screenshots, // Skip screenshots for snapshot
      isSnapshot ? undefined : detectionData || undefined, // Skip detection for snapshot
      googleBusiness.found ? googleBusiness : undefined,
      linkedin.found ? linkedin : undefined
    ),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Website data extraction timed out after 15 seconds'));
      }, extractionTimeout);
    }),
  ]);
  
  // Reconcile blog detection with discovered URLs
  // Check if blog was detected via discovered URLs even if extraction didn't find it
  const hasBlogViaDiscovery = discoveredUrls.blogUrls.length > 0;
  const hasBlogViaExtraction = extraction.blogAnalysis?.postCount !== undefined && extraction.blogAnalysis.postCount > 0;
  
  // Also check brandAuthority for LinkedIn URL (indicates social presence, not blog)
  const hasLinkedInViaExtraction = extraction.brandAuthority?.linkedin?.url ? true : false;
  const hasLinkedInViaDiscovery = discoveredUrls.linkedinUrls.length > 0;
  
  // Log blog detection status with improved messaging
  if (hasBlogViaExtraction) {
    console.log(`✅ Blog detected: ${extraction.blogAnalysis?.postCount || 0} posts found`);
  } else if (hasBlogViaDiscovery) {
    console.log(`ℹ️  Blog detected via navigation and links (${discoveredUrls.blogUrls.length} URL(s) found); full content depth analyzed in later steps`);
  } else {
    // Only log info message if we truly didn't find any blog signals
    console.log(`ℹ️  Blog detection deferred to deep crawl analysis`);
  }
  
  // Reconcile LinkedIn detection (if not already logged above)
  if (!linkedin.found && hasLinkedInViaExtraction) {
    console.log(`ℹ️  LinkedIn URL detected via extraction, but profile was not analyzed in this run`);
  }
  
  // Log Facebook and Instagram detection
  if (discoveredUrls.facebookUrls.length > 0) {
    console.log(`📘 Found ${discoveredUrls.facebookUrls.length} Facebook URL(s):`, discoveredUrls.facebookUrls.slice(0, 3));
  }
  if (discoveredUrls.instagramUrls.length > 0) {
    console.log(`📷 Found ${discoveredUrls.instagramUrls.length} Instagram URL(s):`, discoveredUrls.instagramUrls.slice(0, 3));
  }
  
  // Dev-only debug log for reconciled flags
  if (process.env.NODE_ENV !== 'production') {
    console.info('[snapshotFlags]', {
      hasBlog: hasBlogViaExtraction || hasBlogViaDiscovery,
      hasLinkedInProfile: linkedin.found || hasLinkedInViaExtraction || hasLinkedInViaDiscovery,
      hasFacebookProfile: discoveredUrls.facebookUrls.length > 0,
      hasInstagramProfile: discoveredUrls.instagramUrls.length > 0,
      hasGoogleBusinessProfile: googleBusiness.found || discoveredUrls.gbpUrls.length > 0,
      discoveredBlogUrlsCount: discoveredUrls.blogUrls.length,
      discoveredLinkedInUrlsCount: discoveredUrls.linkedinUrls.length,
      discoveredFacebookUrlsCount: discoveredUrls.facebookUrls.length,
      discoveredInstagramUrlsCount: discoveredUrls.instagramUrls.length,
      discoveredGbpUrlsCount: discoveredUrls.gbpUrls.length,
      blogPostCount: extraction.blogAnalysis?.postCount || 0,
    });
  }

  // Extract company name
  let companyName = extraction.company_name;
  if (!companyName && extraction.meta?.title) {
    const title = extraction.meta.title;
    companyName = title.split('|')[0]?.split('-')[0]?.split('—')[0]?.trim();
    if (companyName) {
      companyName = companyName
        .replace(/\s+(Home|Welcome|Official|Website|Site)$/i, '')
        .trim();
    }
  }
  if (!companyName) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '').split('.')[0];
      companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      // Leave undefined
    }
  }

  // Step 5.5: Classify brand strength (for scoring calibration)
  // Start this in parallel with extraction completion - don't block on it
  console.log('🏷️  Classifying brand strength (non-blocking)...');
  const brandStrengthPromise = Promise.race([
    classifyBrandStrength(url, htmlHint, companyName),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Brand strength classification timed out'));
      }, 10000);
    }),
  ]).catch((error) => {
    console.warn('⚠️  Brand strength classification failed, continuing without calibration:', error);
    return undefined;
  });
  
  // Don't await - let it run in background, scoring will use it if available
  let brandStrengthResult: BrandStrengthResult | undefined;
  // We'll await it right before scoring if needed, but don't block here

  // Step 6: Score website using rubric
  // If snapshot scorecard is provided, reuse it to ensure exact alignment
  let scorecard: Scorecard;
  let brandScore: number;
  let contentScore: number;
  let websiteScore: number;
  let overallScore: number;
  let websiteScoringAvailable = true; // Track whether website scoring succeeded
  
  if (options?.snapshotScorecard) {
    // Reuse snapshot's scorecard to ensure exact alignment
    console.log('📊 Reusing snapshot scorecard for alignment...');
    scorecard = options.snapshotScorecard;
    const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
    brandScore = calculateServiceScore('brandingAndImpact', scorecard.pillars, normalizedRubric);
    contentScore = calculateServiceScore('contentAndEngagement', scorecard.pillars, normalizedRubric);
    websiteScore = calculateServiceScore('websiteAndConversion', scorecard.pillars, normalizedRubric);
    const rawOverallScore = (brandScore + contentScore + websiteScore) / 3;
    overallScore = Math.round(stretchScore(rawOverallScore));
  } else if (options?.snapshotScores) {
    // Use snapshot scores directly to ensure alignment
    console.log('📊 Using snapshot scores for alignment...');
    console.log(`   Snapshot scores: Brand=${options.snapshotScores.brandScore}, Content=${options.snapshotScores.contentScore}, Website=${options.snapshotScores.websiteScore}, Overall=${options.snapshotScores.overallScore}`);
    
    // Still need to generate scorecard for insights, but use snapshot scores
    // Wait for brand strength if it's still running (with short timeout)
    try {
      brandStrengthResult = await Promise.race([
        brandStrengthPromise,
        new Promise<BrandStrengthResult | undefined>((resolve) => 
          setTimeout(() => resolve(undefined), 2000) // Give it 2 more seconds max
        ),
      ]);
      if (brandStrengthResult) {
        console.log(`✅ Brand strength: ${brandStrengthResult.brand_strength} (confidence: ${brandStrengthResult.confidence.toFixed(2)})`);
      }
    } catch {
      // Already handled in promise catch
    }
    
    const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
    // Use safe scoring wrapper - if it fails, we'll use fallback scorecard
    const scoringResult = await safeScoreWebsite(extraction, DEFAULT_RUBRIC, brandStrengthResult);
    
    if (!scoringResult.ok) {
      console.warn(`⚠️  Website scoring failed: ${scoringResult.error}`);
      websiteScoringAvailable = false;
      // Create fallback scorecard - we'll override scores with snapshot scores anyway
      // Use maturity stage from snapshot overall score if available
      const fallbackMaturityStage = getMaturityStage(options.snapshotScores.overallScore);
      scorecard = createFallbackScorecard(fallbackMaturityStage, normalizedRubric);
    } else {
      scorecard = scoringResult.data!;
    }
    
    // Override scores with snapshot scores to ensure alignment
    brandScore = options.snapshotScores.brandScore;
    contentScore = options.snapshotScores.contentScore;
    websiteScore = options.snapshotScores.websiteScore;
    overallScore = options.snapshotScores.overallScore;
    
    console.log(`✅ Applied snapshot scores: Brand=${brandScore}, Content=${contentScore}, Website=${websiteScore}, Overall=${overallScore}`);
    
    // Update scorecard overall score to match
    scorecard.overallScore = overallScore;
    
    // Recalculate service scores in scorecard to match snapshot
    const brandingPillars = scorecard.pillars.filter(p => getServiceForPillar(p.id) === 'brandingAndImpact');
    const contentPillars = scorecard.pillars.filter(p => getServiceForPillar(p.id) === 'contentAndEngagement');
    const websitePillars = scorecard.pillars.filter(p => getServiceForPillar(p.id) === 'websiteAndConversion');
    
    // Adjust pillar scores proportionally to match snapshot service scores
    // This ensures the scorecard reflects the snapshot scores
    const brandingAvg = brandingPillars.length > 0 
      ? brandingPillars.reduce((sum, p) => sum + p.score, 0) / brandingPillars.length 
      : brandScore;
    const contentAvg = contentPillars.length > 0 
      ? contentPillars.reduce((sum, p) => sum + p.score, 0) / contentPillars.length 
      : contentScore;
    const websiteAvg = websitePillars.length > 0 
      ? websitePillars.reduce((sum, p) => sum + p.score, 0) / websitePillars.length 
      : websiteScore;
    
    if (brandingAvg > 0) {
      const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
      const brandRatio = brandScore / brandingAvg;
      brandingPillars.forEach(p => {
        const pillarDef = normalizedRubric.pillars.find(pd => pd.id === p.id);
        p.score = Math.round(p.score * brandRatio);
        p.weightedScore = p.score * ((pillarDef?.normalizedWeight || 0));
      });
    }
    
    if (contentAvg > 0) {
      const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
      const contentRatio = contentScore / contentAvg;
      contentPillars.forEach(p => {
        const pillarDef = normalizedRubric.pillars.find(pd => pd.id === p.id);
        p.score = Math.round(p.score * contentRatio);
        p.weightedScore = p.score * ((pillarDef?.normalizedWeight || 0));
      });
    }
    
    if (websiteAvg > 0) {
      const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
      const websiteRatio = websiteScore / websiteAvg;
      websitePillars.forEach(p => {
        const pillarDef = normalizedRubric.pillars.find(pd => pd.id === p.id);
        p.score = Math.round(p.score * websiteRatio);
        p.weightedScore = p.score * ((pillarDef?.normalizedWeight || 0));
      });
    }
  } else {
    // Normal flow: calculate scores fresh
    console.log('📊 Scoring website...');
    // Wait for brand strength if it's still running (with short timeout)
    try {
      brandStrengthResult = await Promise.race([
        brandStrengthPromise,
        new Promise<BrandStrengthResult | undefined>((resolve) => 
          setTimeout(() => resolve(undefined), 2000) // Give it 2 more seconds max
        ),
      ]);
      if (brandStrengthResult) {
        console.log(`✅ Brand strength: ${brandStrengthResult.brand_strength} (confidence: ${brandStrengthResult.confidence.toFixed(2)})`);
      }
    } catch {
      // Already handled in promise catch
    }
    
    const normalizedRubric = normalizeRubricWeights(DEFAULT_RUBRIC);
    // Use safe scoring wrapper - if it fails, we'll use fallback scorecard
    const scoringResult = await safeScoreWebsite(extraction, DEFAULT_RUBRIC, brandStrengthResult);
    
    if (!scoringResult.ok) {
      console.warn(`⚠️  Website scoring failed: ${scoringResult.error}`);
      websiteScoringAvailable = false;
      // Create fallback scorecard based on maturity stage
      // We'll determine maturity from other signals or use 'Good' as default
      scorecard = createFallbackScorecard('Good', normalizedRubric);
      
      // Calculate service-level scores from fallback scorecard
      brandScore = calculateServiceScore('brandingAndImpact', scorecard.pillars, normalizedRubric);
      contentScore = calculateServiceScore('contentAndEngagement', scorecard.pillars, normalizedRubric);
      websiteScore = calculateServiceScore('websiteAndConversion', scorecard.pillars, normalizedRubric);
      
      // Calculate overall score as weighted average
      const rawOverallScore = (brandScore + contentScore + websiteScore) / 3;
      overallScore = Math.round(stretchScore(rawOverallScore));
    } else {
      scorecard = scoringResult.data!;
      
      // Calculate service-level scores
      brandScore = calculateServiceScore('brandingAndImpact', scorecard.pillars, normalizedRubric);
      contentScore = calculateServiceScore('contentAndEngagement', scorecard.pillars, normalizedRubric);
      websiteScore = calculateServiceScore('websiteAndConversion', scorecard.pillars, normalizedRubric);
      
      // Calculate overall score as weighted average of the three service scores
      // Each service gets equal weight (1/3) for simplicity and consistency
      const rawOverallScore = (brandScore + contentScore + websiteScore) / 3;
      overallScore = Math.round(stretchScore(rawOverallScore));
    }
  }
  
  // Group pillars by service (needed for service blocks)
  const brandingPillars = scorecard.pillars.filter(p => getServiceForPillar(p.id) === 'brandingAndImpact');
  const contentPillars = scorecard.pillars.filter(p => getServiceForPillar(p.id) === 'contentAndEngagement');
  const websitePillars = scorecard.pillars.filter(p => getServiceForPillar(p.id) === 'websiteAndConversion');
  
  // Determine maturity stage
  const maturityStage = getMaturityStage(overallScore);
  const maturityDescription = getMaturityDescription(maturityStage);
  
  // Generate overall score summary (will be generated after insights)
  let overallScoreSummary: string | undefined;

  // Step 8: Detect competitors
  console.log('🔍 Detecting competitors...');
  const competitorCluster = detectCompetitors(htmlHint);
  const competitorNames = competitorCluster?.competitors || [];
  if (competitorNames.length > 0) {
    console.log(`🎯 Competitors detected: ${competitorNames.join(', ')}`);
  }
  
  // Step 9: Generate insights and roadmap (simplified for snapshot)
  console.log('💡 Generating insights...');
  let insightsResult: Awaited<ReturnType<typeof generateInsights>>;
  let competitorAnalysis: CompetitorAnalysis;
  let competitorTeaser: string[];
  
  if (isSnapshot) {
    // Snapshot: Generate lighter insights (fewer, simpler)
    // For snapshot, we'll generate fewer insights by modifying the prompt
    // Add timeout to insights generation (15 seconds)
    insightsResult = await Promise.race([
      generateInsights(extraction, scorecard, competitorNames, true), // Pass snapshot flag
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Insights generation timed out after 15 seconds'));
        }, 15000);
      }),
    ]);
    
    // Snapshot: Run competitive analysis to get actual insights (but lighter/faster)
    console.log('🏆 Generating competitive analysis (snapshot mode)...');
    // Add timeout to competitor analysis (15 seconds)
    competitorAnalysis = await Promise.race([
      generateCompetitorAnalysis(
        companyName || 'This business',
        extraction,
        competitorNames
      ),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Competitor analysis timed out after 15 seconds'));
        }, 15000);
      }),
    ]);
    
    // Debug: Log what we got from competitor analysis
    console.log('🔍 Competitor analysis structure:', {
      hasStrategicOpportunities: !!competitorAnalysis.strategicOpportunities?.length,
      strategicOpportunitiesCount: competitorAnalysis.strategicOpportunities?.length || 0,
      hasGaps: !!competitorAnalysis.positioningComparison?.gaps?.length,
      gapsCount: competitorAnalysis.positioningComparison?.gaps?.length || 0,
      hasMarketLandscape: !!competitorAnalysis.marketLandscapeOverview?.length,
      marketLandscapeCount: competitorAnalysis.marketLandscapeOverview?.length || 0,
    });
    
    // Extract 2-3 actual competitive insights from the analysis
    const competitorBullets: string[] = [];
    
    if (competitorNames.length > 0) {
      const competitorList = competitorNames.slice(0, 5);
      
      // Bullet 1: List competitors
      if (competitorList.length <= 3) {
        competitorBullets.push(`Key competitors identified: ${competitorList.join(', ')}`);
      } else {
        competitorBullets.push(`Key competitors identified: ${competitorList.slice(0, 3).join(', ')}, and ${competitorList.length - 3} others`);
      }
      
      // Bullet 2: Extract actual competitive insight (about competitors, not recommendations)
      let bullet2Added = false;
      
      // Try competitor patterns first (how competitors position themselves)
      if (competitorAnalysis.positioningComparison?.competitorPatterns && Array.isArray(competitorAnalysis.positioningComparison.competitorPatterns) && competitorAnalysis.positioningComparison.competitorPatterns.length > 0) {
        const pattern = competitorAnalysis.positioningComparison.competitorPatterns[0];
        if (pattern && typeof pattern === 'string' && pattern.length > 20) {
          competitorBullets.push(`Competitors typically ${pattern.toLowerCase()}`);
          bullet2Added = true;
        }
      }
      
      // Try market landscape overview (what users expect in this category)
      if (!bullet2Added && competitorAnalysis.marketLandscapeOverview && Array.isArray(competitorAnalysis.marketLandscapeOverview) && competitorAnalysis.marketLandscapeOverview.length > 0) {
        const insight = competitorAnalysis.marketLandscapeOverview[0];
        if (insight && typeof insight === 'string' && insight.length > 20) {
          competitorBullets.push(insight);
          bullet2Added = true;
        }
      }
      
      // Try trust comparison (what trust signals competitors use)
      if (!bullet2Added && competitorAnalysis.trustAndSocialProofComparison && Array.isArray(competitorAnalysis.trustAndSocialProofComparison) && competitorAnalysis.trustAndSocialProofComparison.length > 0) {
        const trustInsight = competitorAnalysis.trustAndSocialProofComparison[0];
        const trustInsightValue = trustInsight as { competitor?: string; signals?: string[] } | string | unknown;
        if (typeof trustInsightValue === 'object' && trustInsightValue && 'competitor' in trustInsightValue && 'signals' in trustInsightValue && Array.isArray(trustInsightValue.signals) && trustInsightValue.signals.length > 0) {
          competitorBullets.push(`${trustInsightValue.competitor} leverages ${trustInsightValue.signals.slice(0, 3).join(', ')} to build trust`);
          bullet2Added = true;
        } else if (typeof trustInsightValue === 'string' && trustInsightValue.length > 20 && trustInsightValue.toLowerCase().includes('competitor')) {
          competitorBullets.push(trustInsightValue);
          bullet2Added = true;
        }
      }
      
      // Try content/authority comparison (how competitors build authority)
      if (!bullet2Added && competitorAnalysis.contentAndAuthorityComparison?.blogDepth && Array.isArray(competitorAnalysis.contentAndAuthorityComparison.blogDepth) && competitorAnalysis.contentAndAuthorityComparison.blogDepth.length > 0) {
        const insight = competitorAnalysis.contentAndAuthorityComparison.blogDepth[0];
        if (insight && typeof insight === 'string' && insight.length > 20 && (insight.toLowerCase().includes('competitor') || insight.toLowerCase().includes('they') || insight.toLowerCase().includes('their'))) {
          competitorBullets.push(insight);
          bullet2Added = true;
        }
      }
      
      // Try positioning gaps (where competitors excel) - rewritten to be about competitors
      if (!bullet2Added && competitorAnalysis.positioningComparison?.gaps && Array.isArray(competitorAnalysis.positioningComparison.gaps) && competitorAnalysis.positioningComparison.gaps.length > 0) {
        const gap = competitorAnalysis.positioningComparison.gaps[0];
        if (gap && typeof gap === 'string' && gap.length > 20) {
          // Reword gaps to be about competitors, not recommendations
          if (gap.toLowerCase().includes('lack') || gap.toLowerCase().includes('limited')) {
            competitorBullets.push(`Competitors excel where you're under-positioned: ${gap.replace(/^(lack of|limited|no|underutilization of)/i, '').trim()}`);
          } else {
            competitorBullets.push(`Competitive gap: Competitors typically ${gap.toLowerCase()}`);
          }
          bullet2Added = true;
        }
      }
      
      // Try UX/funnel comparison (how competitors' UX differs)
      if (!bullet2Added && competitorAnalysis.uxAndFunnelComparison?.ctaClarity && Array.isArray(competitorAnalysis.uxAndFunnelComparison.ctaClarity) && competitorAnalysis.uxAndFunnelComparison.ctaClarity.length > 0) {
        const insight = competitorAnalysis.uxAndFunnelComparison.ctaClarity[0];
        if (insight && typeof insight === 'string' && insight.length > 20 && (insight.toLowerCase().includes('competitor') || insight.toLowerCase().includes('they'))) {
          competitorBullets.push(insight);
          bullet2Added = true;
        }
      }
      
      // Fallback only if nothing found
      if (!bullet2Added) {
        const weakPillars = scorecard.pillars.filter(p => p.score < 50);
        if (weakPillars.length > 0) {
          const weakestPillar = weakPillars.sort((a, b) => a.score - b.score)[0];
          if (weakestPillar.id === 'reviews' || weakestPillar.id === 'social') {
            competitorBullets.push(`Your review footprint and social proof are weaker than competitors—most competitors in this space leverage strong testimonials and ratings to build trust`);
          } else if (weakestPillar.id === 'content_depth') {
            competitorBullets.push(`Your content volume and depth lag behind competitors who typically maintain active blogs and educational resources to build authority`);
          }
        }
      }
      
      // Bullet 3: Extract second competitive insight (about competitors, not recommendations)
      let bullet3Added = false;
      
      // Try second competitor pattern
      if (competitorAnalysis.positioningComparison?.competitorPatterns && Array.isArray(competitorAnalysis.positioningComparison.competitorPatterns) && competitorAnalysis.positioningComparison.competitorPatterns.length > 1) {
        const pattern = competitorAnalysis.positioningComparison.competitorPatterns[1];
        if (pattern && typeof pattern === 'string' && pattern.length > 20) {
          competitorBullets.push(`Competitors also ${pattern.toLowerCase()}`);
          bullet3Added = true;
        }
      }
      
      // Try second market landscape insight
      if (!bullet3Added && competitorAnalysis.marketLandscapeOverview && Array.isArray(competitorAnalysis.marketLandscapeOverview) && competitorAnalysis.marketLandscapeOverview.length > 1) {
        const insight = competitorAnalysis.marketLandscapeOverview[1];
        if (insight && typeof insight === 'string' && insight.length > 20) {
          competitorBullets.push(insight);
          bullet3Added = true;
        }
      }
      
      // Try second trust comparison
      if (!bullet3Added && competitorAnalysis.trustAndSocialProofComparison && Array.isArray(competitorAnalysis.trustAndSocialProofComparison) && competitorAnalysis.trustAndSocialProofComparison.length > 1) {
        const trustInsight = competitorAnalysis.trustAndSocialProofComparison[1];
        if (typeof trustInsight === 'object' && trustInsight.competitor && trustInsight.signals && Array.isArray(trustInsight.signals) && trustInsight.signals.length > 0) {
          competitorBullets.push(`${trustInsight.competitor} uses ${trustInsight.signals.slice(0, 2).join(' and ')} to differentiate`);
          bullet3Added = true;
        }
      }
      
      // Try content freshness comparison
      if (!bullet3Added && competitorAnalysis.contentAndAuthorityComparison?.contentFreshness && Array.isArray(competitorAnalysis.contentAndAuthorityComparison.contentFreshness) && competitorAnalysis.contentAndAuthorityComparison.contentFreshness.length > 0) {
        const insight = competitorAnalysis.contentAndAuthorityComparison.contentFreshness[0];
        if (insight && typeof insight === 'string' && insight.length > 20 && (insight.toLowerCase().includes('competitor') || insight.toLowerCase().includes('they'))) {
          competitorBullets.push(insight);
          bullet3Added = true;
        }
      }
      
      // Try second positioning gap (rewritten to be about competitors)
      if (!bullet3Added && competitorAnalysis.positioningComparison?.gaps && Array.isArray(competitorAnalysis.positioningComparison.gaps) && competitorAnalysis.positioningComparison.gaps.length > 1) {
        const gap = competitorAnalysis.positioningComparison.gaps[1];
        if (gap && typeof gap === 'string' && gap.length > 20) {
          if (gap.toLowerCase().includes('lack') || gap.toLowerCase().includes('limited')) {
            competitorBullets.push(`Competitors excel where you're under-positioned: ${gap.replace(/^(lack of|limited|no|underutilization of)/i, '').trim()}`);
          } else {
            competitorBullets.push(`Competitive gap: Competitors typically ${gap.toLowerCase()}`);
          }
          bullet3Added = true;
        }
      }
      
      // Try UX/funnel comparison (how competitors' flows differ)
      if (!bullet3Added && competitorAnalysis.uxAndFunnelComparison?.guidedOnboardingMatchingFlows && Array.isArray(competitorAnalysis.uxAndFunnelComparison.guidedOnboardingMatchingFlows) && competitorAnalysis.uxAndFunnelComparison.guidedOnboardingMatchingFlows.length > 0) {
        const insight = competitorAnalysis.uxAndFunnelComparison.guidedOnboardingMatchingFlows[0];
        if (insight && typeof insight === 'string' && insight.length > 20 && (insight.toLowerCase().includes('competitor') || insight.toLowerCase().includes('they'))) {
          competitorBullets.push(insight);
          bullet3Added = true;
        }
      }
      
      // Try category leadership comparison
      if (!bullet3Added && competitorAnalysis.contentAndAuthorityComparison?.categoryLeadership && Array.isArray(competitorAnalysis.contentAndAuthorityComparison.categoryLeadership) && competitorAnalysis.contentAndAuthorityComparison.categoryLeadership.length > 0) {
        const insight = competitorAnalysis.contentAndAuthorityComparison.categoryLeadership[0];
        if (insight && typeof insight === 'string' && insight.length > 20 && (insight.toLowerCase().includes('competitor') || insight.toLowerCase().includes('they'))) {
          competitorBullets.push(insight);
          bullet3Added = true;
        }
      }
      
      // Fallback only if nothing found
      if (!bullet3Added) {
        // Use competitive insights from insightsResult
        const competitiveInsights = insightsResult.insights.filter(i => 
          i.pillar === 'competitor_positioning' || 
          i.issue.toLowerCase().includes('competitor') ||
          i.recommendation.toLowerCase().includes('competitor')
        );
        
        if (competitiveInsights.length > 0) {
          competitorBullets.push(competitiveInsights[0].recommendation || competitiveInsights[0].issue);
        } else {
          // Final fallback: Generate insight based on gaps
          const lowScoreSubpillars = scorecard.pillars.flatMap(p => 
            p.subpillarScores.filter(s => s.score < 40).map(s => ({ pillar: p.id, subpillar: s.id, score: s.score }))
          );
          
          if (lowScoreSubpillars.length > 0) {
            const gap = lowScoreSubpillars[0];
            if (gap.subpillar.includes('blog') || gap.subpillar.includes('content')) {
              competitorBullets.push(`Competitors typically invest more in content marketing—building a regular blog cadence would help close this competitive gap`);
            } else if (gap.subpillar.includes('review') || gap.subpillar.includes('testimonial')) {
              competitorBullets.push(`Competitors leverage reviews and testimonials more effectively—increasing your review footprint would improve competitive positioning`);
            }
          }
        }
      }
    } else {
      // No competitors detected - use scorecard gaps
      const weakPillars = scorecard.pillars.filter(p => p.score < 50);
      if (weakPillars.length > 0) {
        const weakestPillar = weakPillars.sort((a, b) => a.score - b.score)[0];
        competitorBullets.push(`Your ${weakestPillar.id.replace(/_/g, ' ')} is a competitive weakness—most successful competitors in this space excel in this area`);
        
        if (weakestPillar.id === 'reviews' || weakestPillar.id === 'social') {
          competitorBullets.push(`Building a stronger review footprint and social proof would improve your competitive positioning against industry leaders`);
        } else if (weakestPillar.id === 'content_depth') {
          competitorBullets.push(`Increasing content volume and depth would help you compete more effectively with content-driven competitors`);
        }
      }
    }
    
    competitorTeaser = competitorBullets.slice(0, 3);
    
    // Skip overall score summary generation for snapshot (saves time)
    overallScoreSummary = undefined;
  } else {
    // Full report: Generate comprehensive insights and competitor analysis
    insightsResult = await generateInsights(extraction, scorecard, competitorNames);
    
    // Generate overall score summary now that we have insights
    overallScoreSummary = await generateOverallScoreSummary(overallScore, scorecard, insightsResult.insights);
    
    // Step 10: Generate competitor analysis
    console.log('🏆 Generating competitor analysis...');
    competitorAnalysis = await generateCompetitorAnalysis(
      companyName || 'This business',
      extraction,
      competitorNames
    );
    
    // Extract competitor teaser as bullets from full competitor analysis
    const competitorBullets: string[] = [];
    
    // Bullet 1: List competitors
    if (competitorNames.length > 0) {
      const competitorList = competitorNames.slice(0, 5);
      if (competitorList.length <= 3) {
        competitorBullets.push(`Key competitors identified: ${competitorList.join(', ')}`);
      } else {
        competitorBullets.push(`Key competitors identified: ${competitorList.slice(0, 3).join(', ')}, and ${competitorList.length - 3} others`);
      }
    }
    
    // Bullet 2: Positioning insight from analysis
    if (competitorAnalysis.positioningComparison?.yourPositioning?.[0]) {
      competitorBullets.push(competitorAnalysis.positioningComparison.yourPositioning[0]);
    } else if (competitorAnalysis.marketLandscapeOverview?.[0]) {
      competitorBullets.push(competitorAnalysis.marketLandscapeOverview[0]);
    }
    
    // Bullet 3: Strategic opportunity
    if (competitorAnalysis.strategicOpportunities?.[0]) {
      competitorBullets.push(competitorAnalysis.strategicOpportunities[0]);
    } else if (competitorAnalysis.positioningComparison?.gaps?.[0]) {
      competitorBullets.push(`Opportunity: ${competitorAnalysis.positioningComparison.gaps[0]}`);
    }
    
    competitorTeaser = competitorBullets.length > 0 ? competitorBullets : [
      'Competitive positioning analysis available in full report'
    ];
  }

  // Step 11: Extract strengths, quick wins, and risks from insights
  const topStrengths = insightsResult.insights
    .filter(i => i.impact === 'high' && i.potentialGain <= 0)
    .slice(0, 3)
    .map(i => i.recommendation || i.issue);
  
  // Fallback strengths if none found
  if (topStrengths.length === 0) {
    topStrengths.push('Clear core value proposition');
    topStrengths.push('Clean navigation and page structure');
    topStrengths.push('Strong conversion fundamentals on primary CTAs');
  }

  const quickWins = insightsResult.priorityRoadmap
    .filter(r => r.impact === 'high' && r.priority <= 3)
    .slice(0, 3)
    .map(r => r.action);
  
  // Fallback quick wins if none found
  if (quickWins.length === 0) {
    quickWins.push('Improve hero clarity & messaging hierarchy');
    quickWins.push('Strengthen depth of content to build authority');
    quickWins.push('Enhance social proof and trust indicators');
  }

  // Generate emerging risks from low-scoring pillars
  const emergingRisks: string[] = [];
  scorecard.pillars.forEach((pillar) => {
    if (pillar.score < 50) {
      if (pillar.id === 'content_depth') {
        emergingRisks.push('Limited content volume restricts SEO authority');
      } else if (pillar.id === 'social' || pillar.id === 'reviews') {
        emergingRisks.push('Weak review footprint compared to competitors');
      } else if (pillar.id === 'technical_health') {
        emergingRisks.push('Missing analytics segmentation limits insight into funnel performance');
      }
    }
  });
  
  // Fallback risks if none found
  if (emergingRisks.length === 0) {
    emergingRisks.push('Limited content volume restricts SEO authority');
    emergingRisks.push('Weak review footprint compared to competitors');
    emergingRisks.push('Missing analytics segmentation limits insight into funnel performance');
  }

  // Step 12: Group insights and roadmap by service
  const brandingInsights = insightsResult.insights.filter(i => i.service === 'brandingAndImpact');
  const contentInsights = insightsResult.insights.filter(i => i.service === 'contentAndEngagement');
  const websiteInsights = insightsResult.insights.filter(i => i.service === 'websiteAndConversion');
  
  const brandingRoadmap = insightsResult.priorityRoadmap.filter(r => r.service === 'brandingAndImpact');
  const contentRoadmap = insightsResult.priorityRoadmap.filter(r => r.service === 'contentAndEngagement');
  const websiteRoadmap = insightsResult.priorityRoadmap.filter(r => r.service === 'websiteAndConversion');

  // Step 13: Build service blocks
  const services = {
    brandingAndImpact: {
      label: 'Branding & Impact',
      description: 'We develop brand identity systems that turn first impressions into lasting trust. From logo and messaging to visuals and voice, your brand becomes the foundation of every conversion and campaign.',
      score: brandScore,
      pillars: brandingPillars,
      keyInsights: brandingInsights,
      roadmap: brandingRoadmap,
      brandAuthority: extraction.brandAuthority || null,
    } as ServiceReportBlock,
    
    contentAndEngagement: {
      label: 'Content & Engagement',
      description: 'We deliver a content strategy that connects directly to your business goals—paired with videos, blogs, and social content designed to attract the right traffic and convert curiosity into action.',
      score: contentScore,
      pillars: contentPillars,
      keyInsights: contentInsights,
      roadmap: contentRoadmap,
      blogAnalysis: extraction.blogAnalysis || null,
    } as ServiceReportBlock,
    
    websiteAndConversion: {
      label: 'Website & Conversion',
      description: 'We audit, optimize, and redesign high-performance websites that are built to convert—fast, persuasive, and technically strong.',
      score: websiteScore,
      pillars: websitePillars,
      keyInsights: websiteInsights,
      roadmap: websiteRoadmap,
      screenshots: screenshots ? {
        aboveFoldUrl: screenshots.aboveFold,
        midPageUrl: screenshots.midPage,
        aboveFoldDescription: (extraction.screenshots as any)?.above_fold_description,
        midPageDescription: (extraction.screenshots as any)?.mid_page_description,
      } : undefined,
      analyticsAnalysis: extraction.analyticsAnalysis || null,
    } as ServiceReportBlock,
  };

  // Step 14: Extract summary from strategy
  const summary = insightsResult.summary || 'Marketing assessment complete. Review the detailed analysis below.';

  // Step 15: Extract copy suggestions from insights
  const copySuggestions: CopyRewrite[] = insightsResult.copyRewrites || [];

  // Step 16: Build global roadmap (sorted by potential gain)
  const globalRoadmap = [...insightsResult.priorityRoadmap].sort((a, b) => b.potentialGain - a.potentialGain);

  console.log('✅ Unified assessment complete');
  console.log(`   - Overall Score: ${overallScore}/100`);
  console.log(`   - Brand Score: ${brandScore}/100`);
  console.log(`   - Content Score: ${contentScore}/100`);
  console.log(`   - Website Score: ${websiteScore}/100`);

  return {
    companyName,
    url,
    overallScore,
    overallScoreSummary,
    maturityStage,
    maturityDescription,
    brandScore,
    contentScore,
    websiteScore,
    scorecard,
    extraction,
    summary,
    topStrengths,
    quickWins,
    emergingRisks,
    competitorTeaser,
    competitorAnalysis,
    services,
    globalRoadmap,
    copySuggestions,
    screenshots: screenshots ? {
      aboveFoldUrl: screenshots.aboveFold,
      midPageUrl: screenshots.midPage,
      aboveFoldDescription: (extraction.screenshots as any)?.above_fold_description,
      midPageDescription: (extraction.screenshots as any)?.mid_page_description,
    } : undefined,
    websiteScoringAvailable,
    // Brand strength classification (optional, backward compatible)
    brandStrength: brandStrengthResult?.brand_strength,
    brandStrengthConfidence: brandStrengthResult?.confidence,
    brandStrengthReasoning: brandStrengthResult?.reasoning,
  };
}

