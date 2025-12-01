/**
 * GAP Step Engine
 * 
 * Processes GAP generation one step at a time.
 * Each step completes quickly (< 15s) to stay within Vercel limits.
 * Steps are idempotent - they check if work is already done before executing.
 */

import type { GapRunState, GapRunStep } from '@/types/gap';
import { setCurrentFinding } from './runFindings';

// Import step functions from generateGrowthActionPlan
import {
  runInitStep,
  runAssessmentStep,
  runFetchHtmlStep,
  runExtractFeaturesStep,
  runDiscoverPagesStep,
  runFetchExtraPagesStep,
  runContentInventoryStep,
  runTechnicalSeoStep,
} from '@/lib/growth-plan/generateGrowthActionPlan';

// Import helpers for remaining steps
import {
  analyzeWebsiteAndConversion,
  analyzeSeoAndVisibility,
  analyzeContentAndMessaging,
  analyzeBrandAndPositioning,
} from '@/lib/growth-plan/section-analyses';
import { analyzeCompetitors } from '@/lib/growth-plan/analyzeCompetitors';
import { analyzeMarket } from '@/lib/growth-plan/analyzeMarket';
import { analyzePositioning } from '@/lib/growth-plan/analyzePositioning';
import {
  buildDimensionScores,
  scoreAll,
  applyScoreFloors,
} from '@/lib/growth-plan/scoring';
import { scoreBrandFromSignals } from '@/lib/growth-plan/brandScoring';
import { generateExecutiveSummary, type GenerateExecutiveSummaryResult } from '@/lib/growth-plan/generateExecutiveSummary';
import {
  generateQuickWins,
  generateStrategicInitiatives,
  generateFocusAreas,
  generateResourceRequirements,
  buildTimeline,
  calculateExpectedOutcomes,
  identifyRisks,
  generateNextSteps,
} from '@/lib/growth-plan/generateGrowthActionPlan';
import { validateGrowthAccelerationPlan } from '@/lib/growth-plan/schema';
import type { GrowthAccelerationPlan, DataAvailability } from '@/lib/growth-plan/types';

const STEP_ORDER: GapRunStep[] = [
  'init',
  'assessment',
  'fetch_html',
  'extract_features',
  'discover_pages',
  'fetch_extra_pages',
  'content_inventory',
  'technical_seo',
  'section_website',
  'section_seo',
  'section_content',
  'section_brand',
  'quick_wins',
  'strategic_initiatives',
  'scoring',
  'executive_summary',
  'assemble_plan',
  'done',
];

/**
 * Helper to log step execution
 */
const logStep = (state: GapRunState, msg: string) => {
  const step = state.step || state.currentStep || 'unknown';
  console.log(`[GAP runId=${state.runId}] [step=${step}] ${msg}`);
};

/**
 * Helper to get progress reporter
 */
function getReportProgress(state: GapRunState): (finding: string, progress?: number, stage?: string) => Promise<void> {
  const onProgress = state.options?.onProgress;
  if (!onProgress) {
    return async () => {};
  }
  return async (finding: string, progress?: number, stage?: string) => {
    const result = onProgress(finding, progress, stage);
    if (result instanceof Promise) {
      await result;
    }
  };
}

/**
 * Step: Run website section analysis
 */
async function runSectionWebsiteStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting section_website step');
  
  // Check if already computed
  if (state.websiteSectionAnalysis && state.websiteConversionAnalysis) {
    logStep(state, 'section_website already computed, skipping');
    return;
  }
  
  const reportProgress = getReportProgress(state);
  setCurrentFinding(state, 'Analyzing website conversion and user experience...');
  
  if (!state.assessment || !state.siteElementContext || !state.dataAvailability) {
    throw new Error('Missing required data: assessment, siteElementContext, or dataAvailability');
  }
  
  // Detect maturity if not already set
  if (!state.detectedMaturity) {
    const { detectMaturity } = await import('@/lib/growth-plan/detectMaturity');
    if (state.features) {
      state.detectedMaturity = detectMaturity(state.features) as any;
    } else {
      state.detectedMaturity = 'growing' as any;
    }
  }
  const detectedMaturity = state.detectedMaturity as any;
  state.detectedMaturity = detectedMaturity;
  
  try {
    // Run website section analysis with timeout
    const sectionAnalysisTimeout = 12000; // 12 seconds max
    const [websiteConversionAnalysis, websiteSectionAnalysis] = await Promise.all([
      Promise.race([
        analyzeWebsiteAndConversionPerformance(state.assessment),
        new Promise<any>((resolve) => 
          setTimeout(() => {
            console.warn('⚠️  Website conversion analysis timeout, using fallback');
            resolve({
              conversionFunnel: { currentState: 'Analysis timed out', stages: [], dropOffPoints: [], conversionRate: { estimated: 'Unknown', factors: [] } },
              ctaAnalysis: { ctaCount: 0, ctaClarity: 'poor', ctaPlacement: 'poor', ctaCopy: 'weak', primaryCta: 'Not found', issues: [], recommendations: [] },
              userExperience: { navigation: 'poor', pageSpeed: 'poor', mobileExperience: 'poor', trustSignals: 'missing', frictionPoints: [], strengths: [] },
              technicalPerformance: { pageSpeedScore: 0, analyticsSetup: 'missing', trackingCapabilities: [], missingTracking: [], technicalIssues: [] },
              opportunities: [],
              priorityActions: [],
            });
          }, sectionAnalysisTimeout)
        ),
      ]),
      Promise.race([
        analyzeWebsiteAndConversion(
          state.assessment,
          state.siteElementContext,
          state.competitorContexts || [],
          state.dataAvailability,
          detectedMaturity,
          state.features || undefined
        ),
        new Promise<any>((resolve) =>
          setTimeout(() => {
            console.warn('⚠️  Website section analysis timeout, using fallback');
            resolve({
              label: 'Website & Conversion',
              score: 0,
              grade: 'F',
              cardLevel: {
                verdict: 'Analysis incomplete due to timeout',
                summary: 'Website analysis timed out',
              },
              deepDive: {
                strengths: [],
                issues: ['Analysis incomplete due to timeout'],
                recommendations: ['Retry website analysis'],
                impactEstimate: 'Unknown',
              },
              summary: 'Analysis timed out',
              keyFindings: [],
              quickWins: [],
              deeperInitiatives: [],
            });
          }, sectionAnalysisTimeout)
        ),
      ]),
    ]);
    
    state.websiteConversionAnalysis = websiteConversionAnalysis;
    state.websiteSectionAnalysis = websiteSectionAnalysis;
    
    logStep(state, `completed section_website step (source=computed)`);
  } catch (err: any) {
    console.warn('[runSectionWebsiteStep] Error:', err?.message);
    // Use fallback
    state.websiteSectionAnalysis = {
      label: 'Website & Conversion',
      score: 0,
      grade: 'F',
      cardLevel: {
        verdict: 'Analysis incomplete due to error',
        summary: 'Website analysis could not be completed',
      },
      deepDive: {
        strengths: [],
        issues: ['Analysis encountered an error'],
        recommendations: ['Retry website analysis'],
        impactEstimate: 'Unknown',
      },
      summary: 'Analysis incomplete due to error',
      keyFindings: ['Analysis encountered an error'],
      quickWins: [],
      deeperInitiatives: [],
    };
    state.websiteConversionAnalysis = {
      conversionFunnel: { currentState: 'Analysis error', stages: [], dropOffPoints: [], conversionRate: { estimated: 'Unknown', factors: [] } },
      ctaAnalysis: { ctaCount: 0, ctaClarity: 'poor', ctaPlacement: 'poor', ctaCopy: 'weak', primaryCta: 'Not found', issues: [], recommendations: [] },
      userExperience: { navigation: 'poor', pageSpeed: 'poor', mobileExperience: 'poor', trustSignals: 'missing', frictionPoints: [], strengths: [] },
      technicalPerformance: { pageSpeedScore: 0, analyticsSetup: 'missing', trackingCapabilities: [], missingTracking: [], technicalIssues: [] },
      opportunities: [],
      priorityActions: [],
    };
    logStep(state, `completed section_website step (source=fallback)`);
  }
}

/**
 * Step: Run SEO section analysis
 */
async function runSectionSeoStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting section_seo step');
  
  if (state.seoSectionAnalysis) {
    logStep(state, 'section_seo already computed, skipping');
    return;
  }
  
  setCurrentFinding(state, 'Evaluating SEO visibility and content strategy...');
  
  if (!state.assessment || !state.siteElementContext || !state.dataAvailability) {
    throw new Error('Missing required data');
  }
  
  // Detect maturity if not already set
  if (!state.detectedMaturity) {
    const { detectMaturity } = await import('@/lib/growth-plan/detectMaturity');
    if (state.features) {
      state.detectedMaturity = detectMaturity(state.features) as any;
    } else {
      state.detectedMaturity = 'growing' as any;
    }
  }
  const detectedMaturity = state.detectedMaturity as any;
  const sectionAnalysisTimeout = 12000;
  
  try {
    const seoSectionAnalysis = await Promise.race([
      analyzeSeoAndVisibility(
        state.assessment,
        state.siteElementContext,
        state.competitorContexts || [],
        state.contentInventory,
        state.technicalSeoSignals || {},
        state.dataAvailability,
        detectedMaturity
      ),
      new Promise<any>((resolve) =>
        setTimeout(() => {
          console.warn('⚠️  SEO section analysis timeout, using fallback');
          resolve({
            label: 'SEO & Visibility',
            score: 0,
            grade: 'F',
            cardLevel: {
              verdict: 'Analysis incomplete due to timeout',
              summary: 'SEO analysis timed out',
            },
            deepDive: {
              strengths: [],
              issues: ['Analysis incomplete due to timeout'],
              recommendations: ['Retry SEO analysis'],
              impactEstimate: 'Unknown',
            },
            summary: 'Analysis timed out',
            keyFindings: [],
            quickWins: [],
            deeperInitiatives: [],
          });
        }, sectionAnalysisTimeout)
      ),
    ]);
    
    state.seoSectionAnalysis = seoSectionAnalysis;
    logStep(state, `completed section_seo step (source=computed)`);
  } catch (err: any) {
    console.warn('[runSectionSeoStep] Error:', err?.message);
    state.seoSectionAnalysis = {
      label: 'SEO & Visibility',
      score: 0,
      grade: 'F',
      cardLevel: {
        verdict: 'Analysis incomplete due to error',
        summary: 'SEO analysis could not be completed',
      },
      deepDive: {
        strengths: [],
        issues: ['Analysis encountered an error'],
        recommendations: ['Retry SEO analysis'],
        impactEstimate: 'Unknown',
      },
      summary: 'Analysis incomplete due to error',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
    logStep(state, `completed section_seo step (source=fallback)`);
  }
}

/**
 * Step: Run content section analysis
 */
async function runSectionContentStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting section_content step');
  
  if (state.contentSectionAnalysis) {
    logStep(state, 'section_content already computed, skipping');
    return;
  }
  
  setCurrentFinding(state, 'Analyzing content depth and messaging...');
  
  if (!state.assessment || !state.siteElementContext || !state.dataAvailability) {
    throw new Error('Missing required data');
  }
  
  // Detect maturity if not already set
  if (!state.detectedMaturity) {
    const { detectMaturity } = await import('@/lib/growth-plan/detectMaturity');
    if (state.features) {
      state.detectedMaturity = detectMaturity(state.features) as any;
    } else {
      state.detectedMaturity = 'growing' as any;
    }
  }
  const detectedMaturity = state.detectedMaturity as any;
  const sectionAnalysisTimeout = 12000;
  
  try {
    const contentSectionAnalysis = await Promise.race([
      analyzeContentAndMessaging(
        state.assessment,
        state.siteElementContext,
        state.competitorContexts || [],
        state.contentInventory,
        state.dataAvailability,
        state.features || undefined,
        detectedMaturity
      ),
      new Promise<any>((resolve) =>
        setTimeout(() => {
          console.warn('⚠️  Content section analysis timeout, using fallback');
          resolve({
            label: 'Content & Thought Leadership',
            score: 0,
            grade: 'F',
            cardLevel: {
              verdict: 'Analysis incomplete due to timeout',
              summary: 'Content analysis timed out',
            },
            deepDive: {
              strengths: [],
              issues: ['Analysis incomplete due to timeout'],
              recommendations: ['Retry content analysis'],
              impactEstimate: 'Unknown',
            },
            summary: 'Analysis timed out',
            keyFindings: [],
            quickWins: [],
            deeperInitiatives: [],
          });
        }, sectionAnalysisTimeout)
      ),
    ]);
    
    state.contentSectionAnalysis = contentSectionAnalysis;
    logStep(state, `completed section_content step (source=computed)`);
  } catch (err: any) {
    console.warn('[runSectionContentStep] Error:', err?.message);
    state.contentSectionAnalysis = {
      label: 'Content & Thought Leadership',
      score: 0,
      grade: 'F',
      cardLevel: {
        verdict: 'Analysis incomplete due to error',
        summary: 'Content analysis could not be completed',
      },
      deepDive: {
        strengths: [],
        issues: ['Analysis encountered an error'],
        recommendations: ['Retry content analysis'],
        impactEstimate: 'Unknown',
      },
      summary: 'Analysis incomplete due to error',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
    logStep(state, `completed section_content step (source=fallback)`);
  }
}

/**
 * Step: Run brand section analysis
 */
async function runSectionBrandStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting section_brand step');
  
  if (state.brandSectionAnalysis) {
    logStep(state, 'section_brand already computed, skipping');
    return;
  }
  
  setCurrentFinding(state, 'Analyzing brand positioning and differentiation...');
  
  if (!state.assessment || !state.siteElementContext || !state.dataAvailability) {
    throw new Error('Missing required data');
  }
  
  // Detect maturity if not already set
  if (!state.detectedMaturity) {
    const { detectMaturity } = await import('@/lib/growth-plan/detectMaturity');
    if (state.features) {
      state.detectedMaturity = detectMaturity(state.features) as any;
    } else {
      state.detectedMaturity = 'growing' as any;
    }
  }
  const detectedMaturity = state.detectedMaturity as any;
  const sectionAnalysisTimeout = 12000;
  
  try {
    // Run competitor/market/positioning analyses first if needed
    if (!state.competitorAnalysis && state.competitorContexts && state.competitorContexts.length > 0) {
      const companyName = state.assessment.companyName || 'Unknown Company';
      const analysisTimeout = 10000;
      try {
        state.competitorAnalysis = await Promise.race([
          analyzeCompetitors(companyName, state.url, state.siteElementContext, state.competitorContexts, state.dataAvailability),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Competitor analysis timeout')), analysisTimeout)
          ),
        ]);
      } catch (err: any) {
        console.warn('[runSectionBrandStep] Competitor analysis failed:', err?.message);
      }
    }
    
    if (!state.marketAnalysis && state.competitorContexts && state.competitorContexts.length > 0) {
      const companyName = state.assessment.companyName || 'Unknown Company';
      const analysisTimeout = 10000;
      try {
        state.marketAnalysis = await Promise.race([
          analyzeMarket(companyName, state.competitorContexts, state.siteElementContext, state.dataAvailability),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Market analysis timeout')), analysisTimeout)
          ),
        ]);
      } catch (err: any) {
        console.warn('[runSectionBrandStep] Market analysis failed:', err?.message);
        state.marketAnalysis = {
          category: 'Not evaluated (analysis unavailable).',
          commonPainPoints: [],
          commonClaims: [],
          pricingPatterns: [],
          ICPProfiles: [],
          categoryTrends: [],
          differentiationWhitespace: [],
        };
      }
    }
    
    if (!state.positioningAnalysis && state.competitorContexts && state.competitorContexts.length > 0) {
      const companyName = state.assessment.companyName || 'Unknown Company';
      const analysisTimeout = 10000;
      try {
        state.positioningAnalysis = await Promise.race([
          analyzePositioning(companyName, state.siteElementContext, state.competitorContexts, state.dataAvailability),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Positioning analysis timeout')), analysisTimeout)
          ),
        ]);
      } catch (err: any) {
        console.warn('[runSectionBrandStep] Positioning analysis failed:', err?.message);
        state.positioningAnalysis = {
          primaryAudience: 'Not evaluated (analysis unavailable).',
          geographicFocus: 'Not evaluated',
          corePositioningStatement: 'Not evaluated (analysis unavailable).',
          keyThemes: [],
          differentiationSignals: [],
          evidenceFromSite: [],
        };
      }
    }
    
    // Log if Brand Lab context is available
    if (state.brandLabContext) {
      console.log('[runSectionBrandStep] Using Brand Lab context (score:', state.brandLabContext.brandScore, ')');
    }

    const brandSectionAnalysis = await Promise.race([
      analyzeBrandAndPositioning(
        state.assessment,
        state.siteElementContext,
        state.competitorContexts || [],
        state.competitorAnalysis,
        state.marketAnalysis || {
          category: 'Not evaluated (no competitors provided).',
          commonPainPoints: [],
          commonClaims: [],
          pricingPatterns: [],
          ICPProfiles: [],
          categoryTrends: [],
          differentiationWhitespace: [],
        },
        state.positioningAnalysis || {
          primaryAudience: 'Not evaluated (no competitors provided).',
          geographicFocus: 'Not evaluated',
          corePositioningStatement: 'Not evaluated (no competitors provided).',
          keyThemes: [],
          differentiationSignals: [],
          evidenceFromSite: [],
        },
        state.dataAvailability,
        detectedMaturity,
        state.brandLabContext // Pass Brand Lab context if available
      ),
      new Promise<any>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️  Brand & Positioning analysis timeout, using fallback');
          resolve({
            label: 'Brand & Positioning',
            score: 0,
            grade: 'F',
            cardLevel: {
              verdict: 'Analysis incomplete due to timeout',
              summary: 'Brand analysis timed out',
            },
            deepDive: {
              strengths: [],
              issues: ['Analysis incomplete due to timeout'],
              recommendations: ['Retry brand analysis'],
              impactEstimate: 'Unknown',
            },
            summary: 'Brand and positioning analysis timed out. Analysis based on available data.',
            keyFindings: ['Analysis incomplete due to timeout'],
            quickWins: [],
            deeperInitiatives: [],
          });
        }, sectionAnalysisTimeout)
      ),
    ]);
    
    state.brandSectionAnalysis = brandSectionAnalysis;
    logStep(state, `completed section_brand step (source=computed)`);
  } catch (err: any) {
    console.warn('[runSectionBrandStep] Error:', err?.message);
    state.brandSectionAnalysis = {
      label: 'Brand & Positioning',
      score: 0,
      grade: 'F',
      cardLevel: {
        verdict: 'Analysis incomplete due to error',
        summary: 'Brand analysis could not be completed',
      },
      deepDive: {
        strengths: [],
        issues: ['Analysis encountered an error'],
        recommendations: ['Retry brand analysis'],
        impactEstimate: 'Unknown',
      },
      summary: 'Analysis incomplete due to error',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
    logStep(state, `completed section_brand step (source=fallback)`);
  }
}

/**
 * Step: Generate quick wins
 */
async function runQuickWinsStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting quick_wins step');
  
  if (state.quickWins && state.quickWins.length > 0) {
    logStep(state, `quick_wins already computed (${state.quickWins.length} items), skipping`);
    return;
  }
  
  setCurrentFinding(state, 'Identifying quick wins and immediate opportunities...');
  
  if (!state.assessment || !state.websiteConversionAnalysis || !state.siteElementContext) {
    throw new Error('Missing required data for quick wins');
  }
  
  try {
    const quickWinsTimeout = 10000; // 10 seconds
    const quickWins = await Promise.race([
      generateQuickWins(
        state.assessment,
        state.websiteConversionAnalysis,
        state.siteElementContext,
        state.competitorContexts || [],
        state.dataAvailability
      ),
      new Promise<any[]>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️  Quick wins generation timeout, using section analyses as fallback');
          resolve([]); // Will be replaced with fallback below
        }, quickWinsTimeout)
      ),
    ]);
    
    // Fallback: Use quick wins from section analyses if AI generation failed or timed out
    if (quickWins.length === 0) {
      console.log('📋 Using section analyses quick wins as fallback');
      const fallbackQuickWins: any[] = [];
      let qwIndex = 1;
      
      const allQuickWins = [
        ...(state.websiteSectionAnalysis?.quickWins || []),
        ...(state.seoSectionAnalysis?.quickWins || []),
        ...(state.contentSectionAnalysis?.quickWins || []),
        ...(state.brandSectionAnalysis?.quickWins || []),
      ].slice(0, 5);
      
      for (const qw of allQuickWins) {
        fallbackQuickWins.push({
          id: `qw-fallback-${qwIndex}`,
          title: qw.substring(0, 60),
          description: qw,
          impact: 'medium' as const,
          priority: 'high' as const,
          timeHorizon: 'immediate' as const,
          resourceRequirement: 'minimal' as const,
          specificChanges: [qw],
          expectedOutcome: 'Improved performance in this area',
          successMetrics: ['Measurable improvement'],
          estimatedEffort: '1-2 weeks',
          serviceArea: 'cross_cutting' as const,
          quickWinReason: 'Derived from section analysis',
          expectedTimeline: 'Within 30 days',
        });
        qwIndex++;
      }
      
      state.quickWins = fallbackQuickWins;
      logStep(state, `completed quick_wins step (source=fallback, count=${fallbackQuickWins.length})`);
    } else {
      state.quickWins = quickWins;
      logStep(state, `completed quick_wins step (source=ai, count=${quickWins.length})`);
    }
  } catch (err: any) {
    console.warn('[runQuickWinsStep] Error:', err?.message);
    // Use fallback from section analyses
    const fallbackQuickWins: any[] = [];
    const allQuickWins = [
      ...(state.websiteSectionAnalysis?.quickWins || []),
      ...(state.seoSectionAnalysis?.quickWins || []),
      ...(state.contentSectionAnalysis?.quickWins || []),
      ...(state.brandSectionAnalysis?.quickWins || []),
    ].slice(0, 5);
    
    for (let i = 0; i < allQuickWins.length; i++) {
      fallbackQuickWins.push({
        id: `qw-fallback-${i + 1}`,
        title: allQuickWins[i].substring(0, 60),
        description: allQuickWins[i],
        impact: 'medium' as const,
        priority: 'high' as const,
        timeHorizon: 'immediate' as const,
        resourceRequirement: 'minimal' as const,
        specificChanges: [allQuickWins[i]],
        expectedOutcome: 'Improved performance in this area',
        successMetrics: ['Measurable improvement'],
        estimatedEffort: '1-2 weeks',
        serviceArea: 'cross_cutting' as const,
        quickWinReason: 'Derived from section analysis',
        expectedTimeline: 'Within 30 days',
      });
    }
    
    state.quickWins = fallbackQuickWins;
    logStep(state, `completed quick_wins step (source=fallback, count=${fallbackQuickWins.length})`);
  }
}

/**
 * Step: Generate strategic initiatives
 */
async function runStrategicInitiativesStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting strategic_initiatives step');
  
  if (state.strategicInitiatives && state.strategicInitiatives.length > 0) {
    logStep(state, `strategic_initiatives already computed (${state.strategicInitiatives.length} items), skipping`);
    return;
  }
  
  setCurrentFinding(state, 'Generating strategic initiatives and long-term roadmap...');
  
  if (!state.assessment || !state.websiteConversionAnalysis || !state.quickWins) {
    throw new Error('Missing required data for strategic initiatives');
  }
  
  try {
    const strategicInitiativesTimeout = 10000; // 10 seconds
    const strategicInitiatives = await Promise.race([
      generateStrategicInitiatives(
        state.assessment,
        state.websiteConversionAnalysis,
        state.quickWins,
        state.siteElementContext || { pages: [], blogPosts: [], caseStudies: [] },
        state.competitorContexts || [],
        state.competitorAnalysis,
        state.marketAnalysis,
        state.positioningAnalysis,
        state.contentInventory || { 
          blogPostsFound: 0, 
          blogCategories: [], 
          caseStudiesFound: 0, 
          aboutPageDepth: 'minimal', 
          faqPresent: false, 
          contentGaps: [], 
          funnelStageCoverage: { topOfFunnel: 'weak', middleOfFunnel: 'weak', bottomOfFunnel: 'weak' },
          contentThemes: [],
          contentVolume: 'low',
        }
      ),
      new Promise<any[]>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️  Strategic initiatives generation timeout, using section analyses as fallback');
          resolve([]);
        }, strategicInitiativesTimeout)
      ),
    ]);
    
    // Fallback: Use deeper initiatives from section analyses if AI generation failed or timed out
    if (strategicInitiatives.length === 0) {
      console.log('📋 Using section analyses deeper initiatives as fallback');
      const fallbackInitiatives: any[] = [];
      let siIndex = 1;
      
      const allInitiatives = [
        ...(state.websiteSectionAnalysis?.deeperInitiatives || []),
        ...(state.seoSectionAnalysis?.deeperInitiatives || []),
        ...(state.contentSectionAnalysis?.deeperInitiatives || []),
        ...(state.brandSectionAnalysis?.deeperInitiatives || []),
      ].slice(0, 4);
      
      for (const init of allInitiatives) {
        fallbackInitiatives.push({
          id: `si-fallback-${siIndex}`,
          title: init.substring(0, 60),
          description: init,
          impact: 'high' as const,
          priority: 'high' as const,
          timeHorizon: 'medium_term' as const,
          resourceRequirement: 'moderate' as const,
          specificChanges: [init],
          expectedOutcome: 'Significant improvement in this area',
          successMetrics: ['Measurable improvement'],
          estimatedEffort: '90-180 days',
          serviceArea: 'cross_cutting' as const,
          totalDuration: '90-180 days',
          investmentLevel: 'medium' as const,
        });
        siIndex++;
      }
      
      state.strategicInitiatives = fallbackInitiatives;
      logStep(state, `completed strategic_initiatives step (source=fallback, count=${fallbackInitiatives.length})`);
    } else {
      state.strategicInitiatives = strategicInitiatives;
      logStep(state, `completed strategic_initiatives step (source=ai, count=${strategicInitiatives.length})`);
    }
  } catch (err: any) {
    console.warn('[runStrategicInitiativesStep] Error:', err?.message);
    // Use fallback
    const fallbackInitiatives: any[] = [];
    const allInitiatives = [
      ...(state.websiteSectionAnalysis?.deeperInitiatives || []),
      ...(state.seoSectionAnalysis?.deeperInitiatives || []),
      ...(state.contentSectionAnalysis?.deeperInitiatives || []),
      ...(state.brandSectionAnalysis?.deeperInitiatives || []),
    ].slice(0, 4);
    
    for (let i = 0; i < allInitiatives.length; i++) {
      fallbackInitiatives.push({
        id: `si-fallback-${i + 1}`,
        title: allInitiatives[i].substring(0, 60),
        description: allInitiatives[i],
        impact: 'high' as const,
        priority: 'high' as const,
        timeHorizon: 'medium_term' as const,
        resourceRequirement: 'moderate' as const,
        specificChanges: [allInitiatives[i]],
        expectedOutcome: 'Significant improvement in this area',
        successMetrics: ['Measurable improvement'],
        estimatedEffort: '90-180 days',
        serviceArea: 'cross_cutting' as const,
        totalDuration: '90-180 days',
        investmentLevel: 'medium' as const,
      });
    }
    
    state.strategicInitiatives = fallbackInitiatives;
    logStep(state, `completed strategic_initiatives step (source=fallback, count=${fallbackInitiatives.length})`);
  }
}

/**
 * Step: Compute scoring (pure function)
 */
function runScoringStep(state: GapRunState): void {
  logStep(state, 'starting scoring step');
  
  if (state.scorecard) {
    logStep(state, 'scorecard already computed, skipping');
    return;
  }
  
  setCurrentFinding(state, 'Calculating GAP scores...');
  
  if (!state.assessment || !state.dataAvailability) {
    throw new Error('Missing required data for scoring');
  }
  
  // Build dimension scores (features is required, use empty object if missing)
  if (!state.features) {
    throw new Error('Missing required data: features');
  }
  const dimensions = buildDimensionScores(
    state.features,
    state.siteElementContext || { pages: [], blogPosts: [], caseStudies: [] },
    state.contentInventory || { 
      blogPostsFound: 0, 
      blogCategories: [], 
      caseStudiesFound: 0, 
      aboutPageDepth: 'minimal', 
      faqPresent: false, 
      contentGaps: [], 
      funnelStageCoverage: { topOfFunnel: 'weak', middleOfFunnel: 'weak', bottomOfFunnel: 'weak' },
      contentThemes: [],
      contentVolume: 'low',
    },
    state.technicalSeoSignals || {},
    state.positioningAnalysis || { primaryAudience: '', geographicFocus: '', corePositioningStatement: '', keyThemes: [], differentiationSignals: [], evidenceFromSite: [] },
    state.assessment,
    state.dataAvailability
  );
  
  // Calculate scores
  const scoringResult = scoreAll(dimensions);
  
  // Apply score floors
  const adjustedScores = applyScoreFloors(
    scoringResult.dimensionScores,
    state.features,
    state.siteElementContext || { pages: [], blogPosts: [], caseStudies: [] },
    state.contentInventory || { 
      blogPostsFound: 0, 
      blogCategories: [], 
      caseStudiesFound: 0, 
      aboutPageDepth: 'minimal', 
      faqPresent: false, 
      contentGaps: [], 
      funnelStageCoverage: { topOfFunnel: 'weak', middleOfFunnel: 'weak', bottomOfFunnel: 'weak' },
      contentThemes: [],
      contentVolume: 'low',
    },
    state.assessment
  );
  
  // Calculate overall score
  const finalScoringResult = {
    overallScore: Math.round(
      (adjustedScores.websiteAndConversion ?? 0) * 0.25 +
      (adjustedScores.contentDepthAndVelocity ?? 0) * 0.25 +
      (adjustedScores.seoAndVisibility ?? 0) * 0.25 +
      (adjustedScores.brandAndPositioning ?? 0) * 0.15 +
      (adjustedScores.authorityAndTrust ?? 0) * 0.10
    ),
    dimensionScores: adjustedScores,
  };
  
  // Build evaluatedDimensions
  const evaluatedDimensions: ('website' | 'content' | 'seo' | 'brand' | 'authority')[] = [];
  if (state.dataAvailability.siteCrawl.successfulUrls.length > 0) {
    evaluatedDimensions.push('website');
  }
  if (state.dataAvailability.contentInventory.blogDetected || state.dataAvailability.contentInventory.caseStudiesDetected || state.dataAvailability.siteCrawl.successfulUrls.length > 0) {
    evaluatedDimensions.push('content');
  }
  if (state.dataAvailability.technicalSeo.lighthouseAvailable || state.dataAvailability.technicalSeo.metaTagsParsed) {
    evaluatedDimensions.push('seo');
  }
  evaluatedDimensions.push('brand');
  evaluatedDimensions.push('authority');
  
  // Extract dimension scores
  const websiteScore = state.dataAvailability.siteCrawl.successfulUrls.length > 0 
    ? finalScoringResult.dimensionScores.websiteAndConversion 
    : undefined;
  const contentScore = (state.dataAvailability.contentInventory.blogDetected || state.dataAvailability.contentInventory.caseStudiesDetected || state.dataAvailability.siteCrawl.successfulUrls.length > 0)
    ? finalScoringResult.dimensionScores.contentDepthAndVelocity
    : undefined;
  const seoScore = (state.dataAvailability.technicalSeo.lighthouseAvailable || state.dataAvailability.technicalSeo.metaTagsParsed)
    ? finalScoringResult.dimensionScores.seoAndVisibility
    : undefined;
  const brandScore = finalScoringResult.dimensionScores.brandAndPositioning;
  const authorityScore = finalScoringResult.dimensionScores.authorityAndTrust;
  
  state.scorecard = {
    overall: finalScoringResult.overallScore,
    website: websiteScore,
    content: contentScore,
    seo: seoScore,
    brand: brandScore,
    authority: authorityScore,
    evaluatedDimensions,
  };
  
  logStep(state, `completed scoring step (overall=${state.scorecard.overall})`);
}

/**
 * Step: Generate executive summary
 */
async function runExecutiveSummaryStep(state: GapRunState, _timeLeftMs: number): Promise<void> {
  logStep(state, 'starting executive_summary step');
  
  if (state.executiveSummary) {
    logStep(state, 'executive_summary already computed, skipping');
    return;
  }
  
  setCurrentFinding(state, 'Generating executive summary and key insights...');
  
  if (!state.assessment || !state.scorecard || !state.websiteSectionAnalysis || !state.seoSectionAnalysis || !state.contentSectionAnalysis || !state.brandSectionAnalysis) {
    throw new Error('Missing required data for executive summary');
  }
  
  try {
    const executiveSummaryTimeout = 10000; // 10 seconds
    const topOpportunities = [...(state.quickWins || []), ...(state.strategicInitiatives || [])];
    
    const executiveSummaryResult = await Promise.race([
      generateExecutiveSummary({
        companyName: state.assessment.companyName || 'Unknown Company',
        websiteUrl: state.url,
        scorecard: state.scorecard,
        sectionAnalyses: {
          websiteAndConversion: state.websiteSectionAnalysis,
          seoAndVisibility: state.seoSectionAnalysis,
          contentAndMessaging: state.contentSectionAnalysis,
          brandAndPositioning: state.brandSectionAnalysis,
        },
        marketAnalysis: state.marketAnalysis,
        positioningAnalysis: state.positioningAnalysis,
        dataAvailability: state.dataAvailability!,
        contentInventory: state.contentInventory || { 
          blogPostsFound: 0, 
          blogCategories: [], 
          caseStudiesFound: 0, 
          aboutPageDepth: 'minimal', 
          faqPresent: false, 
          contentGaps: [], 
          funnelStageCoverage: { topOfFunnel: 'weak', middleOfFunnel: 'weak', bottomOfFunnel: 'weak' },
          contentThemes: [],
          contentVolume: 'low',
        },
        technicalSeoSignals: state.technicalSeoSignals || {},
        competitorAnalysis: state.competitorAnalysis ? {
          categorySummary: state.competitorAnalysis.categorySummary,
          positioningPatterns: state.competitorAnalysis.positioningPatterns,
          messagingComparison: state.competitorAnalysis.messagingComparison,
          differentiationOpportunities: state.competitorAnalysis.differentiationOpportunities,
        } : undefined,
        topOpportunities,
        features: state.features || undefined,
      }),
      new Promise<GenerateExecutiveSummaryResult>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️  Executive summary generation timeout, using fallback');
          const fallbackSummary = {
            overallScore: state.scorecard?.overall,
            maturityStage: state.assessment?.maturityStage || 'Growing',
            narrative: `Growth Acceleration Plan (GAP) for ${state.assessment?.companyName || 'this website'}. Analysis based on available data.`,
            strengths: ['Analysis based on available data'],
            keyIssues: ['Analysis incomplete due to timeout'],
            strategicPriorities: ['Complete full analysis when available'],
            expectedOutcomes: ['Improved marketing performance and growth acceleration.'],
          };
          resolve({
            executiveSummary: fallbackSummary,
            fullGap: {
              gapId: `GAP-${Date.now()}`,
              companyName: state.assessment?.companyName || 'Unknown Company',
              websiteUrl: state.url,
              generatedAt: new Date().toISOString(),
              executiveSummary: {
                overallScore: state.scorecard?.overall || 0,
                maturityStage: state.assessment?.maturityStage || 'Growing',
                narrative: fallbackSummary.narrative,
                strengths: fallbackSummary.strengths,
                keyIssues: fallbackSummary.keyIssues,
                strategicPriorities: fallbackSummary.strategicPriorities,
              },
              scorecard: {
                brandScore: state.scorecard?.brand || 0,
                contentScore: state.scorecard?.content || 0,
                seoScore: state.scorecard?.seo || 0,
                websiteScore: state.scorecard?.website || 0,
                overallScore: state.scorecard?.overall || 0,
              },
              sectionAnalyses: {},
              accelerators: [],
              roadmap: { now: [], next: [], later: [] },
              expectedOutcomes: fallbackSummary.expectedOutcomes,
            },
          });
        }, executiveSummaryTimeout)
      ),
    ]);
    
    state.executiveSummary = executiveSummaryResult.executiveSummary;
    logStep(state, `completed executive_summary step (source=computed)`);
  } catch (err: any) {
    console.warn('[runExecutiveSummaryStep] Error:', err?.message);
    state.executiveSummary = {
      overallScore: state.scorecard.overall,
      maturityStage: state.assessment.maturityStage || 'Growing',
      narrative: `Growth Acceleration Plan (GAP) for ${state.assessment.companyName || 'this website'}. Analysis encountered an error.`,
      strengths: [],
      keyIssues: ['Analysis incomplete due to error'],
      strategicPriorities: [],
      expectedOutcomes: ['Please retry the analysis.'],
    };
    logStep(state, `completed executive_summary step (source=fallback)`);
  }
}

/**
 * Step: Assemble final plan (CHEAP and IDEMPOTENT)
 * This should NEVER call generateGrowthAccelerationPlan or re-run any heavy analysis.
 */
function runAssemblePlanStep(state: GapRunState): void {
  logStep(state, 'starting assemble_plan step');
  
  // Early exit if plan already exists
  if (state.plan) {
    logStep(state, 'plan already assembled, skipping');
    state.status = 'completed';
    state.step = 'done';
    state.currentStep = 'done';
    return;
  }
  
  setCurrentFinding(state, 'Assembling Growth Acceleration Plan...');
  
  // Validate we have minimum required data
  if (!state.assessment) {
    throw new Error('Missing required data: assessment');
  }
  if (!state.scorecard) {
    throw new Error('Missing required data: scorecard');
  }
  if (!state.executiveSummary) {
    throw new Error('Missing required data: executiveSummary');
  }
  if (!state.dataAvailability) {
    throw new Error('Missing required data: dataAvailability');
  }
  
  // Generate GAP ID if not present
  if (!state.gapId) {
    state.gapId = `GAP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Build focus areas, resources, timeline, outcomes, risks, next steps
  const focusAreas = generateFocusAreas(state.assessment, state.quickWins || [], state.strategicInitiatives || []);
  const resourceRequirements = generateResourceRequirements(state.assessment, state.quickWins || [], state.strategicInitiatives || []);
  const timeline = buildTimeline(state.quickWins || [], state.strategicInitiatives || []);
  const expectedOutcomes = calculateExpectedOutcomes(state.assessment, state.quickWins || [], state.strategicInitiatives || [], state.dataAvailability!);
  const risks = identifyRisks(state.assessment, state.quickWins || [], state.strategicInitiatives || []);
  const nextSteps = generateNextSteps(state.quickWins || [], state.strategicInitiatives || []);
  
  // Build complete plan data
  const planData = {
    gapId: state.gapId,
    companyName: state.assessment.companyName || 'Unknown Company',
    websiteUrl: state.url,
    generatedAt: new Date().toISOString(),
    assessmentSnapshotId: state.options?.snapshotId,
    executiveSummary: state.executiveSummary,
    quickWins: state.quickWins || [],
    strategicInitiatives: state.strategicInitiatives || [],
    focusAreas,
    resourceRequirements,
    timeline,
    expectedOutcomes,
    risks,
    nextSteps,
    sectionAnalyses: {
      websiteAndConversion: state.websiteSectionAnalysis || { summary: '', keyFindings: [], quickWins: [], deeperInitiatives: [] },
      seoAndVisibility: state.seoSectionAnalysis || { summary: '', keyFindings: [], quickWins: [], deeperInitiatives: [] },
      contentAndMessaging: state.contentSectionAnalysis || { summary: '', keyFindings: [], quickWins: [], deeperInitiatives: [] },
      brandAndPositioning: state.brandSectionAnalysis || { summary: '', keyFindings: [], quickWins: [], deeperInitiatives: [] },
    },
    competitorAnalysis: state.competitorAnalysis,
    marketAnalysis: state.marketAnalysis ? {
      category: (state.marketAnalysis.category.toLowerCase().includes('error') || state.marketAnalysis.category.toLowerCase().includes('unavailable due to'))
        ? 'Not evaluated (no market data available).'
        : state.marketAnalysis.category,
      commonPainPoints: state.marketAnalysis.commonPainPoints,
      commonClaims: state.marketAnalysis.commonClaims,
      pricingPatterns: state.marketAnalysis.pricingPatterns,
      ICPProfiles: state.marketAnalysis.ICPProfiles,
      categoryTrends: state.marketAnalysis.categoryTrends,
      differentiationWhitespace: state.marketAnalysis.differentiationWhitespace,
    } : {
      category: 'Not evaluated (no market data available).',
      commonPainPoints: [],
      commonClaims: [],
      pricingPatterns: [],
      ICPProfiles: [],
      categoryTrends: [],
      differentiationWhitespace: [],
    },
    positioningAnalysis: state.positioningAnalysis || {
      primaryAudience: 'Not evaluated',
      geographicFocus: 'Not evaluated',
      corePositioningStatement: 'Not evaluated',
      keyThemes: [],
      differentiationSignals: [],
      evidenceFromSite: [],
    },
    dataAvailability: {
      siteCrawl: state.dataAvailability!.siteCrawl,
      technicalSeo: state.dataAvailability!.technicalSeo,
      competitors: state.dataAvailability!.competitors,
      contentInventory: state.dataAvailability!.contentInventory,
      analytics: state.dataAvailability!.analytics,
      insightsAvailable: state.dataAvailability!.insightsAvailable !== undefined 
        ? state.dataAvailability!.insightsAvailable 
        : (state.assessment?.websiteScoringAvailable !== false && !state.assessmentError),
      overallConfidence: state.dataAvailability!.overallConfidence,
    },
    scorecard: state.scorecard,
    socialSignals: state.features?.social ? {
      hasLinkedIn: state.features.social.hasLinkedIn,
      hasFacebook: state.features.social.hasFacebook,
      hasInstagram: state.features.social.hasInstagram,
      linkedinUrls: state.features.social.linkedinUrls || [],
      facebookUrls: state.features.social.facebookUrls || [],
      instagramUrls: state.features.social.instagramUrls || [],
    } : undefined,
  };
  
  // Validate the plan
  const validatedPlan = validateGrowthAccelerationPlan(planData, {
    gapId: state.gapId,
    companyName: state.assessment.companyName || 'Unknown Company',
    websiteUrl: state.url,
    generatedAt: new Date().toISOString(),
  });
  
  // Handle validation errors (shouldn't happen, but be safe)
  if ('error' in validatedPlan) {
    console.error('[runAssemblePlanStep] Validation failed:', validatedPlan.error);
    throw new Error(`Plan validation failed: ${validatedPlan.error.message}`);
  }
  
  // TypeScript should now know this is GrowthAccelerationPlan, not GrowthAccelerationPlanFallback
  state.plan = validatedPlan as GrowthAccelerationPlan;
  state.status = 'completed';
  state.step = 'done';
  state.currentStep = 'done';
  
  logStep(state, `completed assemble_plan step (gapId=${state.gapId})`);
}

/**
 * Analyze website and conversion performance (helper function)
 */
function analyzeWebsiteAndConversionPerformance(assessment: any): any {
  const websiteService = assessment.services.websiteAndConversion;
  const websiteScore = assessment.websiteScore;
  const extraction = assessment.extraction;
  
  return {
    conversionFunnel: {
      currentState: `Current conversion funnel shows ${websiteScore < 50 ? 'significant' : websiteScore < 70 ? 'moderate' : 'strong'} performance`,
      stages: [
        { stage: 'Awareness', performance: (websiteScore >= 70 ? 'good' : websiteScore >= 50 ? 'needs_improvement' : 'critical') as any, issues: websiteService.keyInsights.filter((i: any) => i.impact === 'high').map((i: any) => i.issue).slice(0, 2), opportunities: websiteService.roadmap.filter((r: any) => r.impact === 'high').map((r: any) => r.action).slice(0, 2) },
        { stage: 'Consideration', performance: (websiteScore >= 70 ? 'good' : websiteScore >= 50 ? 'needs_improvement' : 'critical') as any, issues: [], opportunities: [] },
        { stage: 'Decision', performance: (websiteScore >= 70 ? 'good' : websiteScore >= 50 ? 'needs_improvement' : 'critical') as any, issues: [], opportunities: [] },
        { stage: 'Action', performance: (websiteScore >= 70 ? 'good' : websiteScore >= 50 ? 'needs_improvement' : 'critical') as any, issues: [], opportunities: [] },
      ],
      dropOffPoints: websiteService.keyInsights.filter((i: any) => i.pillar === 'conversion' && i.impact === 'high').map((i: any) => i.issue).slice(0, 3),
      conversionRate: {
        estimated: websiteScore >= 70 ? 'High (5%+)' : websiteScore >= 50 ? 'Moderate (3-5%)' : 'Low (1-2%)',
        factors: websiteService.keyInsights.filter((i: any) => i.pillar === 'conversion').map((i: any) => i.issue).slice(0, 3),
      },
    },
    ctaAnalysis: {
      ctaCount: extraction.all_ctas?.length || 0,
      ctaClarity: (extraction.all_ctas?.length > 0 ? (websiteScore >= 70 ? 'good' : 'needs_improvement') : 'poor') as any,
      ctaPlacement: (websiteScore >= 70 ? 'good' : 'needs_improvement') as any,
      ctaCopy: (websiteScore >= 70 ? 'clear' : 'generic') as any,
      primaryCta: extraction.hero_section?.cta_buttons?.[0] || extraction.all_ctas?.[0] || 'Not found',
      issues: websiteService.keyInsights.filter((i: any) => i.pillar === 'conversion' && i.issue.toLowerCase().includes('cta')).map((i: any) => i.issue).slice(0, 3),
      recommendations: assessment.copySuggestions.filter((c: any) => c.element === 'cta').map((c: any) => c.recommended).slice(0, 3),
    },
    userExperience: {
      navigation: (websiteScore >= 70 ? 'good' : 'needs_improvement') as any,
      pageSpeed: (websiteScore >= 70 ? 'good' : 'needs_improvement') as any,
      mobileExperience: (websiteScore >= 70 ? 'good' : 'needs_improvement') as any,
      trustSignals: (extraction.trust_signals?.testimonials_visible?.length > 0 || extraction.trust_signals?.review_counts_visible ? 'moderate' : 'weak') as any,
      frictionPoints: websiteService.keyInsights.filter((i: any) => i.impact === 'high').map((i: any) => i.issue).slice(0, 3),
      strengths: assessment.topStrengths.filter((s: string) => 
        s.toLowerCase().includes('navigation') || 
        s.toLowerCase().includes('experience') ||
        s.toLowerCase().includes('conversion')
      ).slice(0, 2),
    },
    technicalPerformance: {
      pageSpeedScore: 75,
      analyticsSetup: (extraction.analyticsAnalysis?.ga4Detected ? 'basic' : 'minimal') as any,
      trackingCapabilities: [
        extraction.analyticsAnalysis?.ga4Detected ? 'GA4' : null,
        extraction.analyticsAnalysis?.gtmDetected ? 'GTM' : null,
        extraction.analyticsAnalysis?.metaPixelDetected ? 'Meta Pixel' : null,
      ].filter(Boolean) as string[],
      missingTracking: [
        !extraction.analyticsAnalysis?.ga4Detected ? 'GA4' : null,
        !extraction.analyticsAnalysis?.hotjarDetected ? 'Heatmaps/Session Recording' : null,
        !extraction.analyticsAnalysis?.mixpanelOrAmplitudeDetected ? 'Event Tracking' : null,
      ].filter(Boolean) as string[],
      technicalIssues: websiteService.keyInsights.filter((i: any) => i.pillar === 'technical_health').map((i: any) => i.issue).slice(0, 3),
    },
    opportunities: websiteService.roadmap.filter((r: any) => r.service === 'websiteAndConversion').slice(0, 5).map((r: any) => ({
      opportunity: r.action,
      impact: r.impact,
      effort: (r.impact === 'high' ? 'low' : 'medium') as any,
      potentialGain: r.potentialGain,
      timeframe: r.impact === 'high' ? '1-2 weeks' : '30 days',
    })),
    priorityActions: websiteService.roadmap.filter((r: any) => r.priority <= 3).slice(0, 5).map((r: any) => ({
      action: r.action,
      reason: r.specific_changes,
      expectedImpact: `${r.potentialGain} point score improvement`,
      effort: r.impact === 'high' ? 'Low effort' : 'Moderate effort',
    })),
  };
}

/**
 * Process the next step in the GAP generation workflow
 * 
 * Returns the updated GapRunState after processing ONE step.
 * Each step should complete in < 15 seconds to stay within Vercel limits.
 * Steps are idempotent - they check if work is already done before executing.
 */
export async function processNextStep(run: GapRunState): Promise<GapRunState> {
  // Normalize url/websiteUrl
  if (!run.url && run.websiteUrl) {
    run.url = run.websiteUrl;
  }
  if (!run.websiteUrl && run.url) {
    run.websiteUrl = run.url;
  }
  
  // Sync step/currentStep for compatibility
  if (!run.step && run.currentStep) {
    run.step = run.currentStep;
  }
  if (!run.currentStep && run.step) {
    run.currentStep = run.step;
  }
  
  // Find the next step to process
  const next = STEP_ORDER.find((s) => !run.completedSteps.includes(s));
  
  // No more steps => mark completed
  if (!next) {
    run.status = 'completed';
    run.step = 'done';
    run.currentStep = 'done';
    setCurrentFinding(run, 'Growth Acceleration Plan ready to review.');
    return run;
  }
  
  run.status = 'running';
  run.step = next;
  run.currentStep = next;
  run.updatedAt = new Date().toISOString();
  
  const stepStartTime = Date.now();
  const hardTimeBudgetMs = 7000; // 7 seconds max per step
  
  try {
    logStep(run, `starting step execution`);
    
    switch (next) {
      case 'init':
        await runInitStep(run, hardTimeBudgetMs);
        break;
        
      case 'assessment':
        if (!run.assessment) {
          await runAssessmentStep(run, hardTimeBudgetMs);
        } else {
          logStep(run, 'assessment already computed, skipping');
        }
        break;
        
      case 'fetch_html':
        if (!run.htmlByUrl || !run.htmlByUrl[run.url]) {
          await runFetchHtmlStep(run, hardTimeBudgetMs);
        } else {
          logStep(run, 'HTML already fetched, skipping');
        }
        break;
        
      case 'extract_features':
        if (!run.features) {
          await runExtractFeaturesStep(run, hardTimeBudgetMs);
        } else {
          logStep(run, 'features already extracted, skipping');
        }
        break;
        
      case 'discover_pages':
        if (!run.discoveredPages) {
          runDiscoverPagesStep(run);
        } else {
          logStep(run, 'pages already discovered, skipping');
        }
        break;
        
      case 'fetch_extra_pages':
        // Check if we need to fetch more pages
        const hasExtraPages = run.htmlByUrl && Object.keys(run.htmlByUrl).length > 1;
        if (!hasExtraPages && run.discoveredPages && run.discoveredPages.length > 0) {
          await runFetchExtraPagesStep(run, hardTimeBudgetMs);
        } else {
          logStep(run, 'extra pages already fetched or none to fetch, skipping');
        }
        break;
        
      case 'content_inventory':
        if (!run.contentInventory) {
          await runContentInventoryStep(run, hardTimeBudgetMs);
        } else {
          logStep(run, 'content inventory already computed, skipping');
        }
        break;
        
      case 'technical_seo':
        if (!run.technicalSeoSignals || !run.dataAvailability) {
          await runTechnicalSeoStep(run, hardTimeBudgetMs);
        } else {
          logStep(run, 'technical SEO already computed, skipping');
        }
        break;
        
      case 'section_website':
        await runSectionWebsiteStep(run, hardTimeBudgetMs);
        break;
        
      case 'section_seo':
        await runSectionSeoStep(run, hardTimeBudgetMs);
        break;
        
      case 'section_content':
        await runSectionContentStep(run, hardTimeBudgetMs);
        break;
        
      case 'section_brand':
        await runSectionBrandStep(run, hardTimeBudgetMs);
        break;
        
      case 'quick_wins':
        await runQuickWinsStep(run, hardTimeBudgetMs);
        break;
        
      case 'strategic_initiatives':
        await runStrategicInitiativesStep(run, hardTimeBudgetMs);
        break;
        
      case 'scoring':
        runScoringStep(run);
        break;
        
      case 'executive_summary':
        await runExecutiveSummaryStep(run, hardTimeBudgetMs);
        break;
        
      case 'assemble_plan':
        runAssemblePlanStep(run);
        break;
        
      case 'done':
        run.status = 'completed';
        break;
        
      default:
        throw new Error(`Unknown step: ${next}`);
    }
    
    const elapsed = Date.now() - stepStartTime;
    logStep(run, `completed step execution (${elapsed}ms)`);
    
    if (elapsed > hardTimeBudgetMs) {
      console.warn(`[GAP runId=${run.runId}] Step ${next} took ${elapsed}ms, exceeding budget of ${hardTimeBudgetMs}ms`);
    }
    
    // Mark step as completed (unless assemble_plan already set status to completed)
    if (run.status !== 'completed') {
      run.completedSteps.push(next);
      
      // Determine next step
      const nextStepIndex = STEP_ORDER.indexOf(next) + 1;
      if (nextStepIndex < STEP_ORDER.length) {
        const nextStep = STEP_ORDER[nextStepIndex];
        run.step = nextStep;
        run.currentStep = nextStep;
      } else {
        run.step = 'done';
        run.currentStep = 'done';
        run.status = 'completed';
      }
    }
    
    run.error = null;
    run.updatedAt = new Date().toISOString();
    
    return run;
  } catch (err: any) {
    const elapsed = Date.now() - stepStartTime;
    console.error(`[GAP runId=${run.runId}] Error in step ${next} (${elapsed}ms):`, err);
    console.error(`[GAP runId=${run.runId}] Error stack:`, err?.stack);
    
    run.status = 'failed';
    run.step = 'done';
    run.currentStep = null;
    run.error = err?.message || 'Unknown error';
    setCurrentFinding(run, `Error in ${next}: ${err?.message || 'Something went wrong while building your plan.'}`);
    run.updatedAt = new Date().toISOString();
    
    return run;
  }
}
