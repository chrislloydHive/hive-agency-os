import { WebsiteAnalysis } from './web-scraper';

export interface ContentAnalysis {
  brandStrength: number;
  messagingClarity: number;
  contentQuality: number;
  conversionOptimization: number;
  industryAlignment: number;
  competitivePositioning: number;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export class ContentAnalyzer {
  analyzeContent(websiteData: WebsiteAnalysis, industry: string): ContentAnalysis {
    const analysis: ContentAnalysis = {
      brandStrength: 0,
      messagingClarity: 0,
      contentQuality: 0,
      conversionOptimization: 0,
      industryAlignment: 0,
      competitivePositioning: 0,
      recommendations: [],
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: []
    };

    // Analyze brand strength
    analysis.brandStrength = this.calculateBrandStrength(websiteData);
    
    // Analyze messaging clarity
    analysis.messagingClarity = this.calculateMessagingClarity(websiteData);
    
    // Analyze content quality
    analysis.contentQuality = this.calculateContentQuality(websiteData);
    
    // Analyze conversion optimization
    analysis.conversionOptimization = this.calculateConversionOptimization(websiteData);
    
    // Analyze industry alignment
    analysis.industryAlignment = this.calculateIndustryAlignment(websiteData, industry);
    
    // Analyze competitive positioning
    analysis.competitivePositioning = this.calculateCompetitivePositioning(websiteData, industry);

    // Generate insights
    this.generateInsights(analysis, websiteData, industry);

    return analysis;
  }

  private calculateBrandStrength(websiteData: WebsiteAnalysis): number {
    let score = 0;
    
    // Logo presence
    if (websiteData.brandElements.logo) score += 20;
    
    // Tagline presence
    if (websiteData.brandElements.tagline) score += 15;
    
    // Contact information
    if (websiteData.brandElements.contactInfo) score += 15;
    
    // Social media presence
    if (websiteData.brandElements.socialLinks) score += 10;
    
    // Professional appearance (SEO score as proxy)
    score += Math.round(websiteData.seoScore * 0.4);
    
    return Math.min(100, score);
  }

  private calculateMessagingClarity(websiteData: WebsiteAnalysis): number {
    let score = 0;
    
    // Title clarity
    if (websiteData.title && websiteData.title.length > 0) score += 20;
    
    // Description clarity
    if (websiteData.description && websiteData.description.length > 0) score += 20;
    
    // Content length (more content often means clearer messaging)
    if (websiteData.contentQuality.wordCount > 500) score += 20;
    else if (websiteData.contentQuality.wordCount > 200) score += 10;
    
    // Call-to-action presence
    if (websiteData.contentQuality.callToActions.length > 0) score += 20;
    
    // Professional content types
    if (websiteData.contentQuality.hasBlog) score += 10;
    if (websiteData.contentQuality.hasTestimonials) score += 10;
    
    return Math.min(100, score);
  }

  private calculateContentQuality(websiteData: WebsiteAnalysis): number {
    let score = 0;
    
    // Base content score
    if (websiteData.contentQuality.wordCount > 1000) score += 30;
    else if (websiteData.contentQuality.wordCount > 500) score += 20;
    else if (websiteData.contentQuality.wordCount > 200) score += 10;
    
    // Content variety
    if (websiteData.contentQuality.hasBlog) score += 20;
    if (websiteData.contentQuality.hasTestimonials) score += 15;
    if (websiteData.contentQuality.hasCaseStudies) score += 15;
    
    // Technical quality
    score += Math.round(websiteData.seoScore * 0.2);
    
    // Mobile friendliness
    if (websiteData.mobileFriendly) score += 10;
    
    return Math.min(100, score);
  }

  private calculateConversionOptimization(websiteData: WebsiteAnalysis): number {
    let score = 0;
    
    // Call-to-action presence
    const ctaCount = websiteData.contentQuality.callToActions.length;
    if (ctaCount > 3) score += 30;
    else if (ctaCount > 1) score += 20;
    else if (ctaCount > 0) score += 10;
    
    // Contact information
    if (websiteData.brandElements.contactInfo) score += 20;
    
    // Social proof
    if (websiteData.contentQuality.hasTestimonials) score += 20;
    if (websiteData.contentQuality.hasCaseStudies) score += 15;
    
    // Page load speed (faster is better)
    if (websiteData.loadTime < 2000) score += 15;
    else if (websiteData.loadTime < 4000) score += 10;
    
    return Math.min(100, score);
  }

  private calculateIndustryAlignment(websiteData: WebsiteAnalysis, industry: string): number {
    let score = 0;
    
    // Industry-specific keywords in content
    const industryKeywords = this.getIndustryKeywords(industry);
    const contentLower = websiteData.content.toLowerCase();
    
    let keywordMatches = 0;
    industryKeywords.forEach(keyword => {
      if (contentLower.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    });
    
    if (keywordMatches > 5) score += 30;
    else if (keywordMatches > 3) score += 20;
    else if (keywordMatches > 1) score += 10;
    
    // Industry-specific content types
    if (industry === 'Financial Services' && websiteData.contentQuality.hasCaseStudies) score += 20;
    if (industry === 'Healthcare & Medical' && websiteData.contentQuality.hasTestimonials) score += 20;
    if (industry === 'Technology' && websiteData.contentQuality.hasBlog) score += 20;
    
    // Professional appearance
    if (websiteData.seoScore > 70) score += 25;
    else if (websiteData.seoScore > 50) score += 15;
    
    // Mobile optimization (important for all industries)
    if (websiteData.mobileFriendly) score += 25;
    
    return Math.min(100, score);
  }

  private calculateCompetitivePositioning(websiteData: WebsiteAnalysis, _industry: string): number {
    let score = 0;
    
    // Content depth
    if (websiteData.contentQuality.wordCount > 1500) score += 25;
    else if (websiteData.contentQuality.wordCount > 800) score += 15;
    
    // Content variety
    const contentTypes = [
      websiteData.contentQuality.hasBlog,
      websiteData.contentQuality.hasTestimonials,
      websiteData.contentQuality.hasCaseStudies
    ].filter(Boolean).length;
    
    if (contentTypes > 2) score += 25;
    else if (contentTypes > 1) score += 15;
    
    // Technical excellence
    if (websiteData.seoScore > 80) score += 25;
    else if (websiteData.seoScore > 60) score += 15;
    
    // User experience
    if (websiteData.mobileFriendly) score += 15;
    if (websiteData.loadTime < 3000) score += 10;
    
    return Math.min(100, score);
  }

  private generateInsights(analysis: ContentAnalysis, websiteData: WebsiteAnalysis, industry: string) {
    // Generate strengths
    if (analysis.brandStrength > 70) analysis.strengths.push('Strong brand presence and professional appearance');
    if (analysis.messagingClarity > 70) analysis.strengths.push('Clear and compelling messaging');
    if (analysis.contentQuality > 70) analysis.strengths.push('High-quality, comprehensive content');
    if (analysis.conversionOptimization > 70) analysis.strengths.push('Effective conversion optimization');
    if (analysis.industryAlignment > 70) analysis.strengths.push('Strong industry-specific positioning');
    
    // Generate weaknesses
    if (analysis.brandStrength < 50) analysis.weaknesses.push('Weak brand presence and unclear identity');
    if (analysis.messagingClarity < 50) analysis.weaknesses.push('Unclear or inconsistent messaging');
    if (analysis.contentQuality < 50) analysis.weaknesses.push('Limited or low-quality content');
    if (analysis.conversionOptimization < 50) analysis.weaknesses.push('Poor conversion optimization');
    if (analysis.industryAlignment < 50) analysis.weaknesses.push('Weak industry-specific positioning');
    
    // Generate opportunities
    if (websiteData.contentQuality.wordCount < 500) analysis.opportunities.push('Expand content to improve SEO and user engagement');
    if (!websiteData.contentQuality.hasBlog) analysis.opportunities.push('Start a blog to establish thought leadership');
    if (!websiteData.contentQuality.hasTestimonials) analysis.opportunities.push('Add customer testimonials for social proof');
    if (websiteData.seoScore < 60) analysis.opportunities.push('Improve SEO to increase organic traffic');
    if (!websiteData.mobileFriendly) analysis.opportunities.push('Optimize for mobile to capture mobile users');
    
    // Generate threats
    if (websiteData.loadTime > 5000) analysis.threats.push('Slow loading times may drive users away');
    if (websiteData.technicalIssues.length > 3) analysis.threats.push('Technical issues may harm user experience');
    if (analysis.contentQuality < 40) analysis.threats.push('Poor content quality may damage brand reputation');
    
    // Generate recommendations
    this.generateRecommendations(analysis, websiteData, industry);
  }

  private generateRecommendations(analysis: ContentAnalysis, websiteData: WebsiteAnalysis, industry: string) {
    // Brand recommendations
    if (analysis.brandStrength < 60) {
      analysis.recommendations.push('Develop a clear brand identity with consistent logo and messaging');
      analysis.recommendations.push('Add professional contact information and social media links');
    }
    
    // Content recommendations
    if (analysis.contentQuality < 60) {
      analysis.recommendations.push('Create comprehensive, industry-specific content');
      analysis.recommendations.push('Start a blog to establish thought leadership in your industry');
      analysis.recommendations.push('Add customer testimonials and case studies for credibility');
    }
    
    // Conversion recommendations
    if (analysis.conversionOptimization < 60) {
      analysis.recommendations.push('Add clear call-to-action buttons throughout the website');
      analysis.recommendations.push('Implement lead capture forms and contact information');
      analysis.recommendations.push('Add social proof elements like testimonials and reviews');
    }
    
    // Technical recommendations
    if (websiteData.seoScore < 60) {
      analysis.recommendations.push('Optimize page titles and meta descriptions');
      analysis.recommendations.push('Improve heading structure and add alt text to images');
      analysis.recommendations.push('Fix technical issues that may harm SEO performance');
    }
    
    if (!websiteData.mobileFriendly) {
      analysis.recommendations.push('Optimize website for mobile devices');
      analysis.recommendations.push('Ensure responsive design and mobile-friendly navigation');
    }
    
    // Industry-specific recommendations
    if (industry === 'Financial Services') {
      analysis.recommendations.push('Emphasize trust, security, and regulatory compliance');
      analysis.recommendations.push('Add educational content about financial planning and services');
    } else if (industry === 'Healthcare & Medical') {
      analysis.recommendations.push('Focus on patient education and trust-building content');
      analysis.recommendations.push('Highlight credentials, experience, and patient testimonials');
    } else if (industry === 'Technology') {
      analysis.recommendations.push('Showcase technical expertise and innovation');
      analysis.recommendations.push('Provide detailed product information and use cases');
    }
  }

  private getIndustryKeywords(industry: string): string[] {
    const industryKeywords: Record<string, string[]> = {
      'Financial Services': ['banking', 'financial', 'investment', 'loan', 'credit', 'mortgage', 'insurance', 'wealth', 'planning', 'retirement'],
      'Healthcare & Medical': ['healthcare', 'medical', 'patient', 'treatment', 'doctor', 'clinic', 'hospital', 'wellness', 'prevention', 'care'],
      'Technology': ['technology', 'software', 'digital', 'innovation', 'solution', 'platform', 'system', 'automation', 'cloud', 'data'],
      'Real Estate': ['real estate', 'property', 'home', 'house', 'buying', 'selling', 'renting', 'investment', 'commercial', 'residential'],
      'Education': ['education', 'learning', 'training', 'course', 'program', 'certification', 'skill', 'knowledge', 'development', 'academic'],
      'Retail': ['retail', 'shopping', 'store', 'product', 'customer', 'service', 'quality', 'value', 'convenience', 'experience']
    };
    
    return industryKeywords[industry] || ['business', 'service', 'quality', 'professional', 'expertise'];
  }
}


