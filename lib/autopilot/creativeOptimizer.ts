// lib/autopilot/creativeOptimizer.ts
// Phase 5: Creative Optimization Engine
//
// Generates creative recommendations based on performance data,
// persona hooks, platform trends, and market signals

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { CreativeRecommendation } from './types';

// ============================================================================
// Types
// ============================================================================

interface CreativePerformance {
  id: string;
  name: string;
  format: string;
  platform: string;
  angle?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  spend: number;
  cpa: number;
  roas: number;
  dateRange: { start: string; end: string };
}

interface PlatformTrend {
  platform: string;
  trend: string;
  relevance: 'high' | 'medium' | 'low';
  description: string;
}

interface MarketSignal {
  type: string;
  signal: string;
  source: string;
  impact: 'high' | 'medium' | 'low';
}

// ============================================================================
// Creative Recommendation Generation
// ============================================================================

/**
 * Generate creative recommendations based on performance and context
 */
export async function generateCreativeRecommendations(
  companyId: string,
  graph: CompanyContextGraph,
  options: {
    creativePerformance?: CreativePerformance[];
    platformTrends?: PlatformTrend[];
    marketSignals?: MarketSignal[];
    maxRecommendations?: number;
  } = {}
): Promise<CreativeRecommendation[]> {
  const { maxRecommendations = 10 } = options;
  const now = new Date().toISOString();

  const recommendations: CreativeRecommendation[] = [];

  // 1. Analyze creative fatigue
  const fatigueRecs = analyzeCreativeFatigue(companyId, graph, options.creativePerformance);
  recommendations.push(...fatigueRecs);

  // 2. Identify format gaps
  const formatRecs = identifyFormatGaps(companyId, graph, options.creativePerformance);
  recommendations.push(...formatRecs);

  // 3. Generate angle recommendations
  const angleRecs = await generateAngleRecommendations(companyId, graph, options);
  recommendations.push(...angleRecs);

  // 4. Platform-specific recommendations
  const platformRecs = generatePlatformRecommendations(companyId, graph, options.platformTrends);
  recommendations.push(...platformRecs);

  // 5. Audience-specific recommendations
  const audienceRecs = generateAudienceRecommendations(companyId, graph);
  recommendations.push(...audienceRecs);

  // Score and prioritize
  const scored = recommendations.map(rec => ({
    ...rec,
    score: calculateRecommendationScore(rec),
  }));

  // Sort by score and limit
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxRecommendations);
}

// ============================================================================
// Fatigue Analysis
// ============================================================================

function analyzeCreativeFatigue(
  companyId: string,
  graph: CompanyContextGraph,
  creativePerformance?: CreativePerformance[]
): CreativeRecommendation[] {
  const recommendations: CreativeRecommendation[] = [];
  const now = new Date().toISOString();

  // Check wearout status from graph
  const wearoutStatus = graph.performanceMedia?.creativeWearout?.value as string | undefined;

  if (wearoutStatus?.toLowerCase().includes('high') || wearoutStatus?.toLowerCase().includes('severe')) {
    recommendations.push({
      id: `rec_${randomUUID()}`,
      companyId,
      type: 'angle',
      platform: 'all',
      recommendation: 'Refresh primary creative angles to combat audience fatigue',
      reasoning: `Creative wearout detected at ${wearoutStatus} level. Audience is becoming desensitized to current messaging.`,
      basedOn: {
        topPerformers: [],
        underperformers: [],
        marketTrends: ['Ad fatigue is a leading cause of CTR decline'],
        competitorInsights: [],
      },
      expectedImpact: 0.25,
      confidence: 0.8,
      priority: 'high',
      suggestedCopy: undefined,
      suggestedVisual: undefined,
      suggestedFormat: undefined,
      status: 'pending',
      generatedAt: now,
    });
  }

  // Analyze performance trends if available
  if (creativePerformance && creativePerformance.length > 0) {
    // Find creatives with declining CTR
    const decliningCreatives = creativePerformance.filter(c => c.ctr < 0.5 && c.impressions > 10000);

    if (decliningCreatives.length > 0) {
      recommendations.push({
        id: `rec_${randomUUID()}`,
        companyId,
        type: 'angle',
        platform: 'all',
        recommendation: `Replace ${decliningCreatives.length} underperforming creative(s) with fresh variants`,
        reasoning: `${decliningCreatives.length} creatives showing CTR below 0.5% with significant impressions, indicating fatigue.`,
        basedOn: {
          topPerformers: [],
          underperformers: decliningCreatives.map(c => c.name),
          marketTrends: [],
          competitorInsights: [],
        },
        expectedImpact: 0.2,
        confidence: 0.75,
        priority: 'high',
        status: 'pending',
        generatedAt: now,
      });
    }
  }

  return recommendations;
}

// ============================================================================
// Format Gap Analysis
// ============================================================================

function identifyFormatGaps(
  companyId: string,
  graph: CompanyContextGraph,
  creativePerformance?: CreativePerformance[]
): CreativeRecommendation[] {
  const recommendations: CreativeRecommendation[] = [];
  const now = new Date().toISOString();

  // Get active channels
  const activeChannels = graph.performanceMedia?.activeChannels?.value as string[] | undefined;

  // Recommended formats by channel
  const formatRecommendations: Record<string, string[]> = {
    meta_ads: ['video', 'carousel', 'stories', 'reels'],
    google_ads: ['responsive_search', 'responsive_display', 'video'],
    tiktok_ads: ['in_feed_video', 'spark_ads', 'branded_content'],
    linkedin_ads: ['single_image', 'video', 'carousel', 'document'],
    youtube: ['skippable_in_stream', 'bumper', 'discovery'],
  };

  // Identify used formats
  const usedFormats = new Set<string>();
  if (creativePerformance) {
    creativePerformance.forEach(c => usedFormats.add(c.format.toLowerCase()));
  }

  // Check for format gaps
  if (activeChannels) {
    for (const channel of activeChannels) {
      const channelKey = channel.toLowerCase().replace(/\s+/g, '_');
      const recommendedFormats = formatRecommendations[channelKey];

      if (recommendedFormats) {
        const missingFormats = recommendedFormats.filter(f => !usedFormats.has(f));

        if (missingFormats.length > 0) {
          recommendations.push({
            id: `rec_${randomUUID()}`,
            companyId,
            type: 'format',
            platform: channel,
            recommendation: `Test ${missingFormats.slice(0, 2).join(' and ')} format(s) on ${channel}`,
            reasoning: `${channel} supports ${missingFormats.length} format(s) not currently in use that could expand reach and engagement.`,
            basedOn: {
              topPerformers: [],
              underperformers: [],
              marketTrends: [`${missingFormats[0]} showing strong performance across industry`],
              competitorInsights: [],
            },
            expectedImpact: 0.15,
            confidence: 0.65,
            priority: 'medium',
            suggestedFormat: missingFormats[0],
            status: 'pending',
            generatedAt: now,
          });
        }
      }
    }
  }

  return recommendations;
}

// ============================================================================
// Angle Recommendations (AI-Powered)
// ============================================================================

async function generateAngleRecommendations(
  companyId: string,
  graph: CompanyContextGraph,
  options: {
    creativePerformance?: CreativePerformance[];
    platformTrends?: PlatformTrend[];
    marketSignals?: MarketSignal[];
  }
): Promise<CreativeRecommendation[]> {
  const client = new Anthropic();
  const now = new Date().toISOString();

  // Extract context from graph
  const brandContext = {
    positioning: graph.brand?.positioning?.value,
    differentiators: graph.brand?.differentiators?.value,
    tone: graph.brand?.toneOfVoice?.value,
    valueProps: graph.brand?.valueProps?.value,
  };

  const audienceContext = {
    segments: graph.audience?.coreSegments?.value,
    demographics: graph.audience?.demographics?.value,
    painPoints: graph.audience?.painPoints?.value,
    motivations: graph.audience?.motivations?.value,
  };

  const currentAngles = graph.creative?.coreMessages?.value as string[] | undefined;

  const prompt = `You are a creative strategist. Generate 3 new creative angles for a brand.

## Brand Context
${JSON.stringify(brandContext, null, 2)}

## Audience Context
${JSON.stringify(audienceContext, null, 2)}

## Current Creative Angles
${currentAngles ? currentAngles.join(', ') : 'None defined'}

## Top Performing Creatives
${options.creativePerformance?.slice(0, 5).map(c => `- ${c.name}: CTR ${c.ctr}%, CVR ${c.cvr}%`).join('\n') || 'Not available'}

## Platform Trends
${options.platformTrends?.map(t => `- ${t.platform}: ${t.trend}`).join('\n') || 'Not available'}

Generate 3 fresh creative angles that:
1. Are distinct from current angles
2. Leverage brand differentiators
3. Address audience pain points or motivations
4. Align with current platform trends

Return JSON array:
[
  {
    "angle": "Angle name",
    "description": "Brief description",
    "targetAudience": "Primary audience segment",
    "platforms": ["platform1", "platform2"],
    "sampleHook": "Example hook/headline",
    "sampleCta": "Example CTA",
    "expectedImpact": 0.0-1.0,
    "confidence": 0.0-1.0
  }
]`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      angle: string;
      description: string;
      targetAudience: string;
      platforms: string[];
      sampleHook: string;
      sampleCta: string;
      expectedImpact: number;
      confidence: number;
    }>;

    return parsed.map(p => ({
      id: `rec_${randomUUID()}`,
      companyId,
      type: 'angle' as const,
      platform: p.platforms[0] || 'all',
      audience: p.targetAudience,
      recommendation: `New angle: ${p.angle}`,
      reasoning: p.description,
      basedOn: {
        topPerformers: [],
        underperformers: [],
        marketTrends: options.platformTrends?.map(t => t.trend) || [],
        competitorInsights: [],
      },
      expectedImpact: p.expectedImpact,
      confidence: p.confidence,
      priority: p.expectedImpact > 0.2 ? 'high' as const : 'medium' as const,
      suggestedCopy: p.sampleHook,
      status: 'pending' as const,
      generatedAt: now,
    }));
  } catch (error) {
    console.error('[creativeOptimizer] AI angle generation error:', error);
    return [];
  }
}

// ============================================================================
// Platform-Specific Recommendations
// ============================================================================

function generatePlatformRecommendations(
  companyId: string,
  graph: CompanyContextGraph,
  platformTrends?: PlatformTrend[]
): CreativeRecommendation[] {
  const recommendations: CreativeRecommendation[] = [];
  const now = new Date().toISOString();

  // Get active channels
  const activeChannels = graph.performanceMedia?.activeChannels?.value as string[] | undefined;

  // Platform-specific best practices
  const platformBestPractices: Record<string, { recommendation: string; format: string }[]> = {
    meta_ads: [
      { recommendation: 'Test UGC-style video content', format: 'reels' },
      { recommendation: 'Add motion to static images', format: 'animated' },
      { recommendation: 'Implement carousel storytelling', format: 'carousel' },
    ],
    tiktok_ads: [
      { recommendation: 'Create native-feeling content that blends with organic', format: 'in_feed' },
      { recommendation: 'Leverage trending sounds and formats', format: 'trend_based' },
    ],
    google_ads: [
      { recommendation: 'Maximize responsive ad asset variations', format: 'responsive' },
      { recommendation: 'Add video assets to display campaigns', format: 'video' },
    ],
    linkedin_ads: [
      { recommendation: 'Test thought leadership content', format: 'document' },
      { recommendation: 'Use carousel for B2B storytelling', format: 'carousel' },
    ],
  };

  if (activeChannels) {
    for (const channel of activeChannels) {
      const channelKey = channel.toLowerCase().replace(/\s+/g, '_');
      const practices = platformBestPractices[channelKey];

      if (practices && practices.length > 0) {
        // Add one recommendation per platform
        const practice = practices[0];
        recommendations.push({
          id: `rec_${randomUUID()}`,
          companyId,
          type: 'format',
          platform: channel,
          recommendation: practice.recommendation,
          reasoning: `Platform best practice for ${channel} to improve engagement and conversions.`,
          basedOn: {
            topPerformers: [],
            underperformers: [],
            marketTrends: platformTrends?.filter(t => t.platform === channel).map(t => t.trend) || [],
            competitorInsights: [],
          },
          expectedImpact: 0.15,
          confidence: 0.7,
          priority: 'medium',
          suggestedFormat: practice.format,
          status: 'pending',
          generatedAt: now,
        });
      }
    }
  }

  return recommendations;
}

// ============================================================================
// Audience-Specific Recommendations
// ============================================================================

function generateAudienceRecommendations(
  companyId: string,
  graph: CompanyContextGraph
): CreativeRecommendation[] {
  const recommendations: CreativeRecommendation[] = [];
  const now = new Date().toISOString();

  // Get audience segments
  const segments = graph.audience?.coreSegments?.value as string[] | undefined;
  const painPoints = graph.audience?.painPoints?.value as string[] | undefined;
  const motivations = graph.audience?.motivations?.value as string[] | undefined;

  // Generate personalization recommendations
  if (segments && segments.length > 1) {
    recommendations.push({
      id: `rec_${randomUUID()}`,
      companyId,
      type: 'angle',
      platform: 'all',
      recommendation: `Create segment-specific creative variants for ${segments.slice(0, 2).join(' and ')}`,
      reasoning: `${segments.length} audience segments identified. Personalized creative typically improves conversion rates by 10-30%.`,
      basedOn: {
        topPerformers: [],
        underperformers: [],
        marketTrends: ['Personalization drives higher engagement'],
        competitorInsights: [],
      },
      expectedImpact: 0.2,
      confidence: 0.7,
      priority: 'medium',
      status: 'pending',
      generatedAt: now,
    });
  }

  // Pain point-based recommendation
  if (painPoints && painPoints.length > 0) {
    recommendations.push({
      id: `rec_${randomUUID()}`,
      companyId,
      type: 'hook',
      platform: 'all',
      recommendation: `Lead with pain point: "${painPoints[0]}"`,
      reasoning: 'Problem-agitation-solution framework typically outperforms feature-focused creative.',
      basedOn: {
        topPerformers: [],
        underperformers: [],
        marketTrends: ['Problem-aware messaging increases relevance'],
        competitorInsights: [],
      },
      expectedImpact: 0.18,
      confidence: 0.65,
      priority: 'medium',
      suggestedCopy: `Tired of ${painPoints[0].toLowerCase()}? Here's how to...`,
      status: 'pending',
      generatedAt: now,
    });
  }

  // Motivation-based recommendation
  if (motivations && motivations.length > 0) {
    recommendations.push({
      id: `rec_${randomUUID()}`,
      companyId,
      type: 'cta',
      platform: 'all',
      recommendation: `Test aspiration-driven CTA aligned with "${motivations[0]}"`,
      reasoning: 'Motivation-aligned CTAs can improve click-through rates significantly.',
      basedOn: {
        topPerformers: [],
        underperformers: [],
        marketTrends: ['Emotional CTAs outperform transactional ones'],
        competitorInsights: [],
      },
      expectedImpact: 0.12,
      confidence: 0.6,
      priority: 'low',
      status: 'pending',
      generatedAt: now,
    });
  }

  return recommendations;
}

// ============================================================================
// Scoring
// ============================================================================

function calculateRecommendationScore(rec: CreativeRecommendation): number {
  let score = 0;

  // Expected impact (40%)
  score += rec.expectedImpact * 40;

  // Confidence (30%)
  score += rec.confidence * 30;

  // Priority bonus (20%)
  const priorityBonus = {
    high: 20,
    medium: 10,
    low: 5,
  };
  score += priorityBonus[rec.priority];

  // Type bonus (10%)
  const typeBonus: Record<string, number> = {
    angle: 10,
    format: 8,
    hook: 7,
    cta: 5,
    script: 6,
    visual: 6,
  };
  score += typeBonus[rec.type] || 5;

  return score;
}

// ============================================================================
// Script Generation
// ============================================================================

/**
 * Generate a creative script based on recommendation
 */
export async function generateCreativeScript(
  recommendation: CreativeRecommendation,
  graph: CompanyContextGraph,
  options: {
    duration?: number; // seconds
    platform?: string;
    format?: string;
  } = {}
): Promise<{
  script: string;
  scenes: Array<{ time: string; visual: string; audio: string; text: string }>;
}> {
  const client = new Anthropic();
  const { duration = 30, platform = recommendation.platform, format = 'video' } = options;

  const prompt = `You are a creative director. Write a ${duration}-second ${format} script for ${platform}.

## Brand
- Positioning: ${graph.brand?.positioning?.value || 'Not specified'}
- Tone: ${graph.brand?.toneOfVoice?.value || 'Professional'}

## Recommendation to Implement
${recommendation.recommendation}

## Reasoning
${recommendation.reasoning}

## Audience
${recommendation.audience || graph.audience?.coreSegments?.value?.[0] || 'General audience'}

Write a script with:
1. Hook (first 3 seconds)
2. Problem/opportunity statement
3. Solution introduction
4. Proof point or benefit
5. Strong CTA

Return JSON:
{
  "script": "Full script text",
  "scenes": [
    {
      "time": "0-3s",
      "visual": "Description",
      "audio": "Voiceover or music note",
      "text": "On-screen text"
    }
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { script: '', scenes: [] };
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { script: content.text, scenes: [] };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[creativeOptimizer] Script generation error:', error);
    return { script: '', scenes: [] };
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { CreativePerformance, PlatformTrend, MarketSignal };
