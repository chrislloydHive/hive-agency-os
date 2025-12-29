import OpenAI from 'openai';
import { env } from './env';
import { DEFAULT_RUBRIC, normalizeRubricWeights, getMaturityStage, type ExtractionData, type Scorecard, type RubricDefinition } from './rubric';
import { detectCompetitors } from './competitor-detection';
import { EXTRACTION_PROMPT } from './ai-prompts';

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

export interface RubricAnalysisResult {
  extraction: ExtractionData;
  scorecard: Scorecard;
  strategy: {
    summary: string;
    top_opportunities: Array<{
      issue: string;
      why_it_matters: string;
      evidence: string;
      recommendation: string;
    }>;
    prioritized_roadmap: Array<{
      priority: number;
      action: string;
      impact: string;
      specific_changes: string;
    }>;
    rewrite_suggestions: Array<{
      element: string;
      current: string;
      recommended: string;
    }>;
    competitor_analysis: {
      competitors: string[];
      positioning_summary: string;
      gaps: string[];
    };
  };
  // Legacy compatibility scores (mapped from rubric)
  seo: number;
  content: number;
  conversion: number;
  performance: number;
  overall: number;
  strengths: string[];
  quickWins: string[];
  contentInsights?: string;
  industryBenchmark?: {
    overall: number;
    seo: number;
    content: number;
    conversion: number;
  };
  scoreBreakdowns?: {
    seo: { score: number; reasons: string[]; potential: number };
    content: { score: number; reasons: string[]; potential: number };
    conversion: { score: number; reasons: string[]; potential: number };
    performance: { score: number; reasons: string[]; potential: number };
  };
  priorityActions?: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    potentialGain: number;
  }>;
}

/**
 * Extract structured data from website HTML and metadata
 */
async function extractWebsiteData(
  url: string,
  htmlHint: string,
  pageSpeedScore: number,
  googleBusinessData?: { found: boolean; rating?: number; reviewCount?: number; completeness?: number },
  linkedinData?: { found: boolean; completeness?: number; followerCount?: number }
): Promise<ExtractionData> {
  // Optimize: Reduce HTML content to speed up processing
  const truncatedHtml = htmlHint.substring(0, 2000); // Reduced from 4000 to 2000
  
  const prompt = `${EXTRACTION_PROMPT}

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

  const extractionStartTime = Date.now();
  const promptLength = prompt.length;
   
  console.log(`📤 Starting extraction API call (HTML: ${truncatedHtml.length} chars, Total prompt: ${promptLength} chars)...`);

  try {
    // Wrap OpenAI call with timeout detection
    const openai = getOpenAI();
    const apiCallPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction expert. Return only valid JSON, no markdown, no explanations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 3000, // Reduced from 4000 to speed up
    });

    // Add timeout wrapper with detailed logging
    const timeoutMs = 25000; // 25 seconds (slightly less than 30s timeout)
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          const elapsed = Date.now() - extractionStartTime;
           
          console.error(`⏱️  Extraction API call timed out after ${elapsed}ms (timeout: ${timeoutMs}ms)`);
          reject(new Error(`OpenAI API call timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
    
    const completion = await Promise.race([
      apiCallPromise.then(result => {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        const elapsed = Date.now() - extractionStartTime;
         
        console.log(`✅ Extraction API call completed in ${elapsed}ms`);
        return result;
      }),
      timeoutPromise,
    ]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const extraction = JSON.parse(content) as ExtractionData;
    extraction.url = url;
    
    // Add external profiles data
    if (googleBusinessData?.found) {
      extraction.external_profiles.gbp_raw = JSON.stringify(googleBusinessData);
    }
    if (linkedinData?.found) {
      extraction.external_profiles.linkedin_raw = JSON.stringify(linkedinData);
    }

    return extraction;
  } catch (error) {
     
    console.error('Error in extraction:', error);
    // Return minimal extraction on error
    return {
      url,
      meta: { title: '', description: '' },
      hero_section: { headline_text: '', subheadline_text: '', cta_buttons: [], hero_image_description: '' },
      navigation: { primary_nav_items: [], secondary_nav_items: [] },
      sections: [],
      all_headings: [],
      all_ctas: [],
      trust_signals: { logos_visible: [], testimonials_visible: [], review_counts_visible: '', awards_visible: [] },
      value_props: [],
      content_depth_indicators: { feature_lists: [], benefit_lists: [], case_study_snippets: [], faq_present: false },
      seo_elements: { h1: '', h2_list: [], h3_list: [], schema_detected: [], internal_links_detected: [] },
      design_and_layout: { visual_hierarchy_notes: '', cta_visibility_notes: '', readability_notes: '' },
      external_profiles: { linkedin_raw: '', gbp_raw: '' },
    };
  }
}

/**
 * Score the website using the rubric system
 */
async function scoreWebsite(extraction: ExtractionData, rubric: RubricDefinition): Promise<Scorecard> {
   
  const normalizedRubric = normalizeRubricWeights(rubric);
  
  // Further optimize: Send only minimal data needed for scoring
  const minimalExtraction = {
    meta: extraction.meta,
    hero_section: {
      headline_text: extraction.hero_section.headline_text,
      cta_buttons: extraction.hero_section.cta_buttons.slice(0, 3),
    },
    sections: extraction.sections.slice(0, 3).map(s => ({
      type: s.type,
      heading: s.heading,
      cta_buttons: s.cta_buttons.slice(0, 2),
    })),
    all_headings: extraction.all_headings.slice(0, 5),
    all_ctas: extraction.all_ctas.slice(0, 5),
    trust_signals: {
      testimonials_visible: extraction.trust_signals.testimonials_visible.slice(0, 2),
      review_counts_visible: extraction.trust_signals.review_counts_visible,
    },
    value_props: extraction.value_props.slice(0, 3),
    seo_elements: {
      h1: extraction.seo_elements.h1,
      h2_list: extraction.seo_elements.h2_list.slice(0, 5),
    },
  };

  // Ultra-simplified rubric: Only IDs and weights
  const minimalRubric = {
    pillars: normalizedRubric.pillars.map(p => ({
      id: p.id,
      normalizedWeight: p.normalizedWeight,
      subpillars: p.subpillars.map(sp => ({ id: sp.id })),
    })),
  };
  
  const prompt = `Score website using rubric. Return JSON scorecard.

Extraction:
${JSON.stringify(minimalExtraction)}

Rubric:
${JSON.stringify(minimalRubric)}

Score each subpillar 0-100. Return: {overallScore, maturityStage, pillars: [{id, score, weightedScore, subpillarScores: [{id, score}]}]}`;

  const scoringStartTime = Date.now();
   
  console.log(`📤 Starting scoring API call...`);

  try {
    const openai = getOpenAI();
    const apiCallPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Score quickly. Return JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
       
      temperature: 0.1, // Lower temperature for faster, more consistent scoring
      response_format: { type: 'json_object' },
      max_tokens: 2500, // Reduced from 4000 to speed up
    });

    // Add timeout wrapper
    const timeoutMs = 40000; // 40 seconds
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          const elapsed = Date.now() - scoringStartTime;
           
          console.error(`⏱️  Scoring API call timed out after ${elapsed}ms`);
          reject(new Error(`Scoring timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
    
    const completion = await Promise.race([
      apiCallPromise.then(result => {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        const elapsed = Date.now() - scoringStartTime;
         
        console.log(`✅ Scoring API call completed in ${elapsed}ms`);
        return result;
      }),
      timeoutPromise,
    ]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const scorecard = JSON.parse(content) as Scorecard;
    
    // Ensure maturity stage is set
    if (!scorecard.maturityStage) {
      scorecard.maturityStage = getMaturityStage(scorecard.overallScore);
    }

    return scorecard;
  } catch (error) {
     
    console.error('Error in scoring:', error);
    // Return default scorecard on error
    return {
      overallScore: 50,
      maturityStage: 'Basic',
      pillars: normalizedRubric.pillars.map(p => ({
        id: p.id,
        score: 50,
        weightedScore: 50 * (p.normalizedWeight || 0),
        subpillarScores: p.subpillars.map(sp => ({ id: sp.id, score: 50 })),
      })),
    };
  }
}

/**
 * Generate strategic recommendations
 */
async function generateStrategy(
  extraction: ExtractionData,
  scorecard: Scorecard,
  competitors?: string[]
): Promise<RubricAnalysisResult['strategy']> {
  // Further optimize: Send only minimal data for strategy
  const minimalExtraction = {
    meta: extraction.meta,
    hero_section: {
      headline_text: extraction.hero_section.headline_text,
      cta_buttons: extraction.hero_section.cta_buttons.slice(0, 2),
    },
    value_props: extraction.value_props.slice(0, 3),
    trust_signals: {
      testimonials_visible: extraction.trust_signals.testimonials_visible.slice(0, 2),
    },
  };

  // Minimal scorecard: Only weak areas
  const minimalScorecard = {
    overallScore: scorecard.overallScore,
    maturityStage: scorecard.maturityStage,
    weakPillars: scorecard.pillars
      .filter(p => p.score < 70)
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        score: p.score,
        weakSubpillars: p.subpillarScores.filter(sp => sp.score < 60).slice(0, 2).map(sp => sp.id),
      })),
  };

  const prompt = `Generate marketing strategy. Return JSON.

Extraction:
${JSON.stringify(minimalExtraction)}

Weak Areas:
${JSON.stringify(minimalScorecard)}

${competitors && competitors.length > 0 ? `Competitors: ${competitors.slice(0, 3).join(', ')}` : ''}

Return: {summary, top_opportunities: [{issue, why_it_matters, recommendation}], prioritized_roadmap: [{priority, action, impact}], rewrite_suggestions: [{element, current, recommended}], competitor_analysis: {competitors, positioning_summary, gaps}}`;

  const strategyStartTime = Date.now();
   
  console.log(`📤 Starting strategy API call...`);

  try {
    const openai = getOpenAI();
    const apiCallPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate strategy quickly. Return JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for faster responses
      response_format: { type: 'json_object' },
      max_tokens: 2000, // Reduced from 3000
    });

    // Add timeout wrapper
    const timeoutMs = 25000; // 25 seconds
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          const elapsed = Date.now() - strategyStartTime;
           
          console.error(`⏱️  Strategy API call timed out after ${elapsed}ms`);
          reject(new Error(`Strategy timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
    
    const completion = await Promise.race([
      apiCallPromise.then(result => {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        const elapsed = Date.now() - strategyStartTime;
         
        console.log(`✅ Strategy API call completed in ${elapsed}ms`);
        return result;
      }),
      timeoutPromise,
    ]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const strategy = JSON.parse(content) as RubricAnalysisResult['strategy'];
    
    // Normalize all array fields to ensure they're always arrays
    if (strategy.competitor_analysis) {
      // Normalize gaps array
      if (!Array.isArray(strategy.competitor_analysis.gaps)) {
        const gapsValue = strategy.competitor_analysis.gaps as string | string[] | unknown;
        if (typeof gapsValue === 'string') {
          strategy.competitor_analysis.gaps = gapsValue
            .split(/[,\n]/)
            .map((g: string) => g.trim())
            .filter((g: string) => g.length > 0);
        } else {
          strategy.competitor_analysis.gaps = [];
        }
      }
      
      // Ensure competitors is always an array
      if (!Array.isArray(strategy.competitor_analysis.competitors)) {
        const competitorsValue = strategy.competitor_analysis.competitors as string | string[] | unknown;
        if (typeof competitorsValue === 'string') {
          strategy.competitor_analysis.competitors = competitorsValue
            .split(/[,\n]/)
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 0);
        } else {
          strategy.competitor_analysis.competitors = competitors || [];
        }
      }
    }
    
    // Normalize other array fields
    if (!Array.isArray(strategy.top_opportunities)) {
      strategy.top_opportunities = [];
    }
    if (!Array.isArray(strategy.prioritized_roadmap)) {
      strategy.prioritized_roadmap = [];
    }
    if (!Array.isArray(strategy.rewrite_suggestions)) {
      strategy.rewrite_suggestions = [];
    }
    
    return strategy;
  } catch (error) {
     
    console.error('Error in strategy generation:', error);
    // Return default strategy on error
    return {
      summary: 'Analysis completed with basic recommendations.',
      top_opportunities: [],
      prioritized_roadmap: [],
      rewrite_suggestions: [],
      competitor_analysis: {
        competitors: competitors || [],
        positioning_summary: '',
        gaps: [],
      },
    };
  }
}

/**
 * Convert rubric scores to legacy format for compatibility
 */
function convertToLegacyFormat(scorecard: Scorecard, strategy: RubricAnalysisResult['strategy']): Omit<RubricAnalysisResult, 'extraction' | 'scorecard' | 'strategy'> {
  // Map rubric pillars to legacy scores
  const seoPillar = scorecard.pillars.find(p => p.id === 'seo');
  const contentPillar = scorecard.pillars.find(p => p.id === 'content_depth');
  const conversionPillar = scorecard.pillars.find(p => p.id === 'conversion');
  const techPillar = scorecard.pillars.find(p => p.id === 'technical_health');

  const seo = seoPillar?.score || 50;
  const content = contentPillar?.score || 50;
  const conversion = conversionPillar?.score || 50;
  const performance = techPillar?.score || 50;

  // Extract strengths from top-scoring pillars
  const strengths = scorecard.pillars
    .filter(p => p.score >= 70)
    .slice(0, 3)
    .map(p => {
      const words = p.id.toLowerCase().split('_');
      const label = words[0].charAt(0).toUpperCase() + words[0].slice(1) + 
                    (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
      return `${label}: ${p.score}/100`;
    });

  // Convert opportunities to quick wins
  const quickWins = strategy.top_opportunities
    .slice(0, 3)
    .map(opp => opp.issue);

  // Convert roadmap to priority actions
  const priorityActions = strategy.prioritized_roadmap
    .slice(0, 7)
    .map((item, _idx) => ({
      action: item.action,
      impact: item.impact.toLowerCase() as 'high' | 'medium' | 'low',
      effort: 'medium' as const,
      potentialGain: Math.min(20, Math.max(0, Math.round((item.priority / strategy.prioritized_roadmap.length) * 20))),
    }));

  // Generate content insights from strategy summary
  const contentInsights = strategy.summary || undefined;

  // Generate industry benchmark (placeholder - can be enhanced later)
  const industryBenchmark = {
    overall: Math.max(60, Math.min(75, scorecard.overallScore + Math.random() * 10 - 5)),
    seo: Math.max(55, Math.min(70, seo + Math.random() * 10 - 5)),
    content: Math.max(60, Math.min(75, content + Math.random() * 10 - 5)),
    conversion: Math.max(55, Math.min(70, conversion + Math.random() * 10 - 5)),
  };

  return {
    seo,
    content,
    conversion,
    performance,
    overall: scorecard.overallScore,
    strengths: strengths.length > 0 ? strengths : ['Strong foundation', 'Clear value proposition', 'Good technical setup'],
    quickWins: quickWins.length > 0 ? quickWins : ['Improve SEO metadata', 'Enhance content depth', 'Optimize conversion elements'],
    contentInsights,
    industryBenchmark,
    scoreBreakdowns: {
      seo: {
        score: seo,
        reasons: (() => {
          const subpillars = seoPillar?.subpillarScores || [];
          if (subpillars.length > 0) {
            // Show subpillars needing improvement first, then lowest-scoring ones
            const needsImprovement = subpillars
              .filter(s => s.score < 70)
              .sort((a, b) => a.score - b.score)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} needs improvement`);
            if (needsImprovement.length > 0) {
              return needsImprovement.slice(0, 5);
            }
            // If all are >= 70, show lowest-scoring ones as areas to maintain
            return subpillars
              .sort((a, b) => a.score - b.score)
              .slice(0, 3)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} at ${s.score}/100`);
          }
          return seo < 70 ? [`SEO score of ${seo} indicates room for improvement`] : [`SEO foundation established`];
        })(),
        potential: Math.min(100, seo + 20),
      },
      content: {
        score: content,
        reasons: (() => {
          const subpillars = contentPillar?.subpillarScores || [];
          if (subpillars.length > 0) {
            const needsImprovement = subpillars
              .filter(s => s.score < 70)
              .sort((a, b) => a.score - b.score)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} needs improvement`);
            if (needsImprovement.length > 0) {
              return needsImprovement.slice(0, 5);
            }
            return subpillars
              .sort((a, b) => a.score - b.score)
              .slice(0, 3)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} at ${s.score}/100`);
          }
          return content < 70 ? [`Content score of ${content} indicates room for improvement`] : [`Content foundation established`];
        })(),
        potential: Math.min(100, content + 20),
      },
      conversion: {
        score: conversion,
        reasons: (() => {
          const subpillars = conversionPillar?.subpillarScores || [];
          if (subpillars.length > 0) {
            const needsImprovement = subpillars
              .filter(s => s.score < 70)
              .sort((a, b) => a.score - b.score)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} needs improvement`);
            if (needsImprovement.length > 0) {
              return needsImprovement.slice(0, 5);
            }
            return subpillars
              .sort((a, b) => a.score - b.score)
              .slice(0, 3)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} at ${s.score}/100`);
          }
          return conversion < 70 ? [`Conversion score of ${conversion} indicates room for improvement`] : [`Conversion foundation established`];
        })(),
        potential: Math.min(100, conversion + 20),
      },
      performance: {
        score: performance,
        reasons: (() => {
          const subpillars = techPillar?.subpillarScores || [];
          if (subpillars.length > 0) {
            const needsImprovement = subpillars
              .filter(s => s.score < 70)
              .sort((a, b) => a.score - b.score)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} needs improvement`);
            if (needsImprovement.length > 0) {
              return needsImprovement.slice(0, 5);
            }
            return subpillars
              .sort((a, b) => a.score - b.score)
              .slice(0, 3)
              .map(s => s.notes || `${s.id.replace(/_/g, ' ')} at ${s.score}/100`);
          }
          return performance < 70 ? [`Performance score of ${performance} indicates room for improvement`] : [`Performance foundation established`];
        })(),
        potential: Math.min(100, performance + 10),
      },
    },
    priorityActions,
  };
}

/**
 * Main analysis function using the rubric system
 */
export async function analyzeWebsiteWithRubric(
  url: string,
  htmlHint: string,
  pageSpeedScore: number,
  googleBusinessData?: { found: boolean; rating?: number; reviewCount?: number; completeness?: number },
  linkedinData?: { found: boolean; completeness?: number; followerCount?: number }
): Promise<RubricAnalysisResult> {
  const startTime = Date.now();
   
  console.log('🔍 Starting rubric-based analysis for:', url);

  try {
    // Step 1: Extract data (with timeout)
     
    console.log('📊 Step 1: Extracting website data...');
    let extractionTimeoutId: NodeJS.Timeout | null = null;
    let extractionResolved = false;
    
    const extractionTimeoutPromise = new Promise<ExtractionData>((_, reject) => {
      extractionTimeoutId = setTimeout(() => {
        if (!extractionResolved) {
           
          console.error(`⏱️  Extraction timed out after 30 seconds`);
          reject(new Error('Extraction timeout'));
        }
      }, 30000); // 30 seconds
    });
    
    const extraction = await Promise.race([
      extractWebsiteData(url, htmlHint, pageSpeedScore, googleBusinessData, linkedinData).then(result => {
        extractionResolved = true;
        if (extractionTimeoutId) clearTimeout(extractionTimeoutId);
        return result;
      }),
      extractionTimeoutPromise,
    ]);
     
    console.log(`✅ Extraction complete (${Date.now() - startTime}ms)`);

    // Step 2: Score using rubric (with timeout)
     
    console.log('📊 Step 2: Scoring website with rubric...');
    let scoringTimeoutId: NodeJS.Timeout | null = null;
    let scoringResolved = false;
    
    const scoringTimeoutPromise = new Promise<Scorecard>((_, reject) => {
      scoringTimeoutId = setTimeout(() => {
        if (!scoringResolved) {
           
          console.error(`⏱️  Scoring timed out after 45 seconds`);
          reject(new Error('Scoring timeout'));
        }
      }, 45000); // 45 seconds
    });
    
    const scorecard = await Promise.race([
      scoreWebsite(extraction, DEFAULT_RUBRIC).then(result => {
        scoringResolved = true;
        if (scoringTimeoutId) clearTimeout(scoringTimeoutId);
        return result;
      }),
      scoringTimeoutPromise,
    ]);
     
    console.log(`✅ Scoring complete. Overall score: ${scorecard.overallScore}/100 (${Date.now() - startTime}ms)`);

    // Step 3: Detect competitors
    const competitorCluster = detectCompetitors(htmlHint);
    const competitors = competitorCluster?.competitors || [];
    if (competitors.length > 0) {
       
      console.log(`🎯 Competitors detected: ${competitors.join(', ')}`);
    }

    // Step 4: Generate strategy (with timeout)
     
    console.log('📊 Step 3: Generating strategic recommendations...');
    let strategyTimeoutId: NodeJS.Timeout | null = null;
    let strategyResolved = false;
    
    const strategyTimeoutPromise = new Promise<RubricAnalysisResult['strategy']>((_, reject) => {
      strategyTimeoutId = setTimeout(() => {
        if (!strategyResolved) {
           
          console.error(`⏱️  Strategy generation timed out after 30 seconds`);
          reject(new Error('Strategy generation timeout'));
        }
      }, 30000); // 30 seconds
    });
    
    const strategy = await Promise.race([
      generateStrategy(extraction, scorecard, competitors).then(result => {
        strategyResolved = true;
        if (strategyTimeoutId) clearTimeout(strategyTimeoutId);
        return result;
      }),
      strategyTimeoutPromise,
    ]);
     
    console.log(`✅ Strategy generation complete (${Date.now() - startTime}ms)`);

    // Step 5: Convert to legacy format for compatibility
    const legacyFormat = convertToLegacyFormat(scorecard, strategy);

     
    console.log(`🎉 Rubric analysis completed successfully in ${Date.now() - startTime}ms`);

    return {
      extraction,
      scorecard,
      strategy,
      ...legacyFormat,
    };
  } catch (error) {
     
    console.error('❌ Error in rubric analysis:', error);
     
    console.error('   Error details:', error instanceof Error ? error.message : 'Unknown error');
    throw error; // Re-throw to trigger fallback
  }
}

