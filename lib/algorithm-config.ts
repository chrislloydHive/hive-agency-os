import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AlgorithmConfig {
  // Base scores
  baseScore: number;
  
  // Performance multipliers
  excellentPerformance: number;
  goodPerformance: number;
  fairPerformance: number;
  poorPerformance: number;
  terriblePerformance: number;
  
  // Activity bonuses
  googleAdsBonus: number;
  seoBonus: number;
  emailMarketingBonus: number;
  contentMarketingBonus: number;
  basicWebsiteBonus: number;
  noActivitiesPenalty: number;
  
  // Challenge penalties
  noLeadsPenalty: number;
  poorWebsitePenalty: number;
  lowVisibilityPenalty: number;
  brandIdentityPenalty: number;
  
  // Budget alignment
  budgetAlignedBonus: number;
  budgetOpenBonus: number;
  budgetMismatchPenalty: number;
  
  // Urgency levels
  extremelyUrgentBonus: number;
  veryImportantBonus: number;
  notUrgentPenalty: number;
  
  // Industry-specific bonuses
  techIndustryBonus: number;
  realEstateBonus: number;
  healthcareBonus: number;
}

const defaultConfig: AlgorithmConfig = {
  baseScore: 50,
  excellentPerformance: 20,
  goodPerformance: 10,
  fairPerformance: 0,
  poorPerformance: -15,
  terriblePerformance: -25,
  googleAdsBonus: 15,
  seoBonus: 20,
  emailMarketingBonus: 15,
  contentMarketingBonus: 15,
  basicWebsiteBonus: 5,
  noActivitiesPenalty: -20,
  noLeadsPenalty: -20,
  poorWebsitePenalty: -25,
  lowVisibilityPenalty: -20,
  brandIdentityPenalty: -20,
  budgetAlignedBonus: 10,
  budgetOpenBonus: 5,
  budgetMismatchPenalty: -10,
  extremelyUrgentBonus: 15,
  veryImportantBonus: 10,
  notUrgentPenalty: -10,
  techIndustryBonus: 10,
  realEstateBonus: 8,
  healthcareBonus: 8,
};

export function loadAlgorithmConfig(): AlgorithmConfig {
  try {
    const configPath = join(process.cwd(), 'config', 'ai-algorithm-config.json');
    
    if (existsSync(configPath)) {
      const configData = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Merge with defaults to ensure all properties exist
      return { ...defaultConfig, ...config };
    }
  } catch (error) {
    console.warn('⚠️ Could not load algorithm config, using defaults:', error);
  }
  
  return defaultConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateMarketingScore(data: any, config: AlgorithmConfig = loadAlgorithmConfig()) {
  let overall = config.baseScore;
  let leadGeneration = 50;
  let brandVisibility = 50;
  let conversionOptimization = 50;
  let marketingStrategy = 50;
  
  // Performance analysis
  if (data.currentMarketingPerformance.includes('🔥 Excellent')) {
    overall += config.excellentPerformance;
    marketingStrategy += 25;
  } else if (data.currentMarketingPerformance.includes('👍 Good')) {
    overall += config.goodPerformance;
    marketingStrategy += 15;
  } else if (data.currentMarketingPerformance.includes('😐 Fair')) {
    overall += config.fairPerformance;
    marketingStrategy += 5;
  } else if (data.currentMarketingPerformance.includes('👎 Poor')) {
    overall += config.poorPerformance;
    marketingStrategy -= 20;
  } else if (data.currentMarketingPerformance.includes('💸 Terrible')) {
    overall += config.terriblePerformance;
    marketingStrategy -= 30;
  }
  
  // Activities analysis
  if (data.currentMarketingActivities.includes('Google/Facebook Ads')) {
    leadGeneration += config.googleAdsBonus;
    overall += config.googleAdsBonus;
  }
  if (data.currentMarketingActivities.includes('Search Engine Optimization (SEO)')) {
    brandVisibility += config.seoBonus;
    overall += config.seoBonus;
  }
  if (data.currentMarketingActivities.includes('Email marketing')) {
    conversionOptimization += config.emailMarketingBonus;
    overall += config.emailMarketingBonus;
  }
  if (data.currentMarketingActivities.includes('Content marketing/blogging')) {
    brandVisibility += config.contentMarketingBonus;
    overall += config.contentMarketingBonus;
  }
  if (data.currentMarketingActivities.includes('Basic website')) {
    conversionOptimization += config.basicWebsiteBonus;
    overall += config.basicWebsiteBonus;
  }
  if (data.currentMarketingActivities.includes('None of the above')) {
    overall += config.noActivitiesPenalty;
    leadGeneration += config.noActivitiesPenalty;
    brandVisibility += config.noActivitiesPenalty;
  }
  
  // Challenge analysis
  if (data.biggestMarketingChallenge.includes('Not generating enough qualified leads')) {
    leadGeneration += config.noLeadsPenalty;
    overall += config.noLeadsPenalty;
  }
  if (data.biggestMarketingChallenge.includes('Poor website performance/low conversions')) {
    conversionOptimization += config.poorWebsitePenalty;
    overall += config.poorWebsitePenalty;
  }
  if (data.biggestMarketingChallenge.includes('Low visibility in search results')) {
    brandVisibility += config.lowVisibilityPenalty;
    overall += config.lowVisibilityPenalty;
  }
  if (data.biggestMarketingChallenge.includes('Inconsistent or unclear brand identity')) {
    brandVisibility += config.brandIdentityPenalty;
    overall += config.brandIdentityPenalty;
  }
  
  // Budget analysis
  if (data.budgetAlignment.includes('Yes, this aligns')) {
    overall += config.budgetAlignedBonus;
    marketingStrategy += 15;
  } else if (data.budgetAlignment.includes('Higher than expected')) {
    overall += config.budgetOpenBonus;
    marketingStrategy += 10;
  } else if (data.budgetAlignment.includes('Outside our current budget')) {
    overall += config.budgetMismatchPenalty;
    marketingStrategy -= 15;
  }
  
  // Urgency analysis
  if (data.urgencyLevel.includes('9-10: Extremely urgent')) {
    overall += config.extremelyUrgentBonus;
    marketingStrategy += 20;
  } else if (data.urgencyLevel.includes('7-8: Very important')) {
    overall += config.veryImportantBonus;
    marketingStrategy += 15;
  } else if (data.urgencyLevel.includes('1-2: Not urgent')) {
    overall += config.notUrgentPenalty;
    marketingStrategy -= 15;
  }
  
  // Industry analysis
  if (data.industry === 'Technology & Software') {
    overall += config.techIndustryBonus;
  } else if (data.industry === 'Real Estate') {
    overall += config.realEstateBonus;
  } else if (data.industry === 'Healthcare & Medical') {
    overall += config.healthcareBonus;
  }
  
  // Clamp scores to 0-100 range
  overall = Math.max(0, Math.min(100, Math.round(overall)));
  leadGeneration = Math.max(0, Math.min(100, Math.round(leadGeneration)));
  brandVisibility = Math.max(0, Math.min(100, Math.round(brandVisibility)));
  conversionOptimization = Math.max(0, Math.min(100, Math.round(conversionOptimization)));
  marketingStrategy = Math.max(0, Math.min(100, Math.round(marketingStrategy)));
  
  return {
    overall,
    leadGeneration,
    brandVisibility,
    conversionOptimization,
    marketingStrategy
  };
}
