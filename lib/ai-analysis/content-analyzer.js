import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'

export class ContentAnalyzer {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.1 // Very low temperature for consistent content analysis
    })
  }

  async analyzeContent(websiteUrl, businessContext) {
    try {
      // eslint-disable-next-line no-console
      console.log(`Starting content analysis for: ${websiteUrl}`)
      
      const prompt = PromptTemplate.fromTemplate(`
You are a content marketing and engagement expert at Hive Ad Agency, specializing in content strategy, social media engagement, SEO content performance, and audience connection.

ANALYZE THIS WEBSITE: {websiteUrl}

COMPANY CONTEXT:
- Company: {company}
- Industry: {industry}
- Business Stage: {businessStage}
- Current Marketing Activities: {currentMarketingActivities}
- Primary Goal: {primaryMarketingGoal}
- Marketing Challenge: {biggestMarketingChallenge}

CONTENT & ENGAGEMENT FRAMEWORK ANALYSIS:

1. CONTENT STRATEGY EFFECTIVENESS (0-100):
   - Content quality and relevance to target audience
   - Publishing consistency and frequency
   - Content-to-conversion alignment
   - Content planning and editorial calendar

2. SOCIAL MEDIA ENGAGEMENT QUALITY (0-100):
   - Platform presence and activity levels
   - Audience engagement and growth metrics
   - Brand voice consistency across channels
   - Social media strategy effectiveness

3. SEO CONTENT PERFORMANCE (0-100):
   - Keyword targeting and optimization
   - Content structure and readability
   - Search traffic potential and optimization
   - Content SEO best practices implementation

4. AUDIENCE CONNECTION STRENGTH (0-100):
   - Message resonance and relevance
   - Community building and interaction
   - Brand personality expression
   - Customer relationship through content

For each area, provide:
- Score (0-100) with specific content examples
- 3 content improvement opportunities with specific topics
- Content creation requirements and resources needed
- Expected engagement and traffic improvements
- Specific Hive content services that address these gaps
- Implementation timeline and difficulty level

Focus on {industry}-specific content strategies and {businessStage} appropriate tactics.

Return as detailed JSON with content strategy recommendations and implementation plan.
      `)

      const result = await prompt.pipe(this.llm).invoke({
        websiteUrl,
        company: businessContext.company,
        industry: businessContext.industry,
        businessStage: businessContext.businessStage,
        currentMarketingActivities: Array.isArray(businessContext.currentMarketingActivities) 
          ? businessContext.currentMarketingActivities.join(', ') 
          : businessContext.currentMarketingActivities,
        primaryMarketingGoal: businessContext.primaryMarketingGoal,
        biggestMarketingChallenge: businessContext.biggestMarketingChallenge
      })

      try {
        const analysis = JSON.parse(result.content)
        return {
          score: this.calculateOverallContentScore(analysis),
          framework: analysis,
          insights: this.extractContentInsights(analysis),
          recommendations: this.generateContentRecommendations(analysis, businessContext),
          hiveServices: this.mapToHiveContentServices(analysis),
          contentStrategy: this.generateContentStrategy(analysis, businessContext)
        }
      } catch (parseError) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse content analysis:', parseError)
        return this.getDefaultContentAnalysis()
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Content analysis failed:', error)
      return this.getDefaultContentAnalysis()
    }
  }

  calculateOverallContentScore(analysis) {
    const scores = [
      analysis.contentStrategyEffectiveness || 50,
      analysis.socialMediaEngagementQuality || 50,
      analysis.seoContentPerformance || 50,
      analysis.audienceConnectionStrength || 50
    ]
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }

  extractContentInsights(analysis) {
    return {
      strengths: this.identifyContentStrengths(analysis),
      weaknesses: this.identifyContentWeaknesses(analysis),
      opportunities: this.identifyContentOpportunities(analysis),
      threats: this.identifyContentThreats(analysis)
    }
  }

  identifyContentStrengths(analysis) {
    const strengths = []
    if (analysis.contentStrategyEffectiveness >= 70) strengths.push('Effective content strategy and planning')
    if (analysis.socialMediaEngagementQuality >= 70) strengths.push('Strong social media presence and engagement')
    if (analysis.seoContentPerformance >= 70) strengths.push('Good SEO content optimization')
    if (analysis.audienceConnectionStrength >= 70) strengths.push('Strong audience connection and community building')
    return strengths.length > 0 ? strengths : ['Content foundation established']
  }

  identifyContentWeaknesses(analysis) {
    const weaknesses = []
    if (analysis.contentStrategyEffectiveness < 50) weaknesses.push('Poor content strategy and planning')
    if (analysis.socialMediaEngagementQuality < 50) weaknesses.push('Weak social media presence and engagement')
    if (analysis.seoContentPerformance < 50) weaknesses.push('Poor SEO content optimization')
    if (analysis.audienceConnectionStrength < 50) weaknesses.push('Weak audience connection and community building')
    return weaknesses.length > 0 ? weaknesses : ['Content needs development in multiple areas']
  }

  identifyContentOpportunities(_analysis) {
    return [
      'Content strategy development',
      'Social media engagement improvement',
      'SEO content optimization',
      'Audience community building'
    ]
  }

  identifyContentThreats(_analysis) {
    return [
      'Poor content quality affecting brand perception',
      'Low social media engagement reducing reach',
      'Poor SEO performance limiting visibility',
      'Weak audience connection reducing customer loyalty'
    ]
  }

  generateContentRecommendations(analysis, _businessContext) {
    const recommendations = []
    
    if (analysis.contentStrategyEffectiveness < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Content Strategy',
        action: 'Develop comprehensive content strategy and editorial calendar',
        impact: 'Improve content quality and consistency by 40-60%',
        timeline: '30-45 days',
        difficulty: 'Medium',
        hiveService: 'Content Strategy Development'
      })
    }

    if (analysis.socialMediaEngagementQuality < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Social Media',
        action: 'Optimize social media presence and engagement strategy',
        impact: 'Increase social media engagement by 50-100%',
        timeline: '45-60 days',
        difficulty: 'Medium',
        hiveService: 'Social Media Strategy & Management'
      })
    }

    if (analysis.seoContentPerformance < 70) {
      recommendations.push({
        priority: 'High',
        area: 'SEO Content',
        action: 'Optimize content for search engines and user experience',
        impact: 'Improve search visibility and traffic by 30-80%',
        timeline: '60-90 days',
        difficulty: 'Medium',
        hiveService: 'SEO Content Optimization'
      })
    }

    if (analysis.audienceConnectionStrength < 70) {
      recommendations.push({
        priority: 'Medium',
        area: 'Audience Connection',
        action: 'Develop audience engagement and community building strategy',
        impact: 'Strengthen customer relationships and loyalty',
        timeline: '45-75 days',
        difficulty: 'Medium',
        hiveService: 'Audience Engagement Strategy'
      })
    }

    return recommendations
  }

  mapToHiveContentServices(analysis) {
    const services = []
    
    if (analysis.contentStrategyEffectiveness < 70) {
      services.push({
        service: 'Content Strategy Development',
        description: 'Comprehensive content strategy, editorial calendar, and content planning',
        investment: '$2,500 - $5,000',
        timeline: '4-6 weeks',
        roi: '40-60% improvement in content quality and consistency'
      })
    }

    if (analysis.socialMediaEngagementQuality < 70) {
      services.push({
        service: 'Social Media Strategy & Management',
        description: 'Social media strategy, content creation, and community management',
        investment: '$1,500 - $3,500',
        timeline: '6-8 weeks',
        roi: '50-100% increase in social media engagement'
      })
    }

    if (analysis.seoContentPerformance < 70) {
      services.push({
        service: 'SEO Content Optimization',
        description: 'Content SEO optimization, keyword strategy, and search visibility improvement',
        investment: '$2,000 - $4,000',
        timeline: '8-12 weeks',
        roi: '30-80% improvement in search visibility and traffic'
      })
    }

    if (analysis.audienceConnectionStrength < 70) {
      services.push({
        service: 'Audience Engagement Strategy',
        description: 'Community building, audience engagement, and customer relationship strategy',
        investment: '$1,500 - $3,000',
        timeline: '6-10 weeks',
        roi: 'Improved customer loyalty and engagement'
      })
    }

    return services
  }

  generateContentStrategy(analysis, businessContext) {
    return {
      contentPillars: this.identifyContentPillars(businessContext.industry),
      publishingFrequency: this.recommendPublishingFrequency(businessContext.businessStage),
      contentTypes: this.recommendContentTypes(businessContext.industry, businessContext.businessStage),
      distributionChannels: this.recommendDistributionChannels(businessContext.currentMarketingActivities),
      measurementMetrics: this.defineMeasurementMetrics(analysis)
    }
  }

  identifyContentPillars(industry) {
    const industryPillars = {
      'professional-services': ['Industry Expertise', 'Client Success Stories', 'Thought Leadership', 'Service Education'],
      'healthcare-medical': ['Health Education', 'Patient Care', 'Medical Innovation', 'Wellness Tips'],
      'technology-software': ['Product Updates', 'Industry Trends', 'Technical Tutorials', 'Customer Success'],
      'ecommerce-retail': ['Product Showcases', 'Shopping Tips', 'Customer Reviews', 'Trend Analysis'],
      'real-estate': ['Market Insights', 'Property Spotlights', 'Investment Tips', 'Neighborhood Guides']
    }
    
    return industryPillars[industry] || ['Company Updates', 'Industry Insights', 'Customer Stories', 'Expert Tips']
  }

  recommendPublishingFrequency(businessStage) {
    const frequencyMap = {
      'Startup': '2-3 times per week',
      'Early Stage': '3-4 times per week',
      'Growth Stage': '4-5 times per week',
      'Established': '5-7 times per week'
    }
    
    return frequencyMap[businessStage] || '3-4 times per week'
  }

  recommendContentTypes(industry, businessStage) {
    const baseTypes = ['Blog Posts', 'Social Media Updates', 'Email Newsletters']
    
    if (businessStage === 'Startup' || businessStage === 'Early Stage') {
      return [...baseTypes, 'Company Updates', 'Industry Insights']
    } else if (businessStage === 'Growth Stage') {
      return [...baseTypes, 'Case Studies', 'Webinars', 'Video Content']
    } else {
      return [...baseTypes, 'Whitepapers', 'Research Reports', 'Podcasts', 'Interactive Content']
    }
  }

  recommendDistributionChannels(currentActivities) {
    const channels = ['Website Blog', 'Email Marketing']
    
    if (currentActivities.includes('social-media-marketing')) {
      channels.push('Social Media Platforms')
    }
    if (currentActivities.includes('content-marketing-blogging')) {
      channels.push('Content Syndication')
    }
    if (currentActivities.includes('search-engine-optimization-seo')) {
      channels.push('SEO & Search')
    }
    
    return channels
  }

  defineMeasurementMetrics(_analysis) {
    return {
      contentPerformance: ['Page views', 'Time on page', 'Social shares', 'Comments'],
      engagementMetrics: ['Social media engagement rate', 'Email open rates', 'Click-through rates'],
      businessImpact: ['Lead generation', 'Website traffic', 'Brand awareness', 'Customer engagement'],
      seoMetrics: ['Search rankings', 'Organic traffic', 'Backlinks', 'Keyword performance']
    }
  }

  getDefaultContentAnalysis() {
    return {
      score: 50,
      framework: {
        contentStrategyEffectiveness: 50,
        socialMediaEngagementQuality: 50,
        seoContentPerformance: 50,
        audienceConnectionStrength: 50
      },
      insights: {
        strengths: ['Content foundation established'],
        weaknesses: ['Content needs development in multiple areas'],
        opportunities: ['Comprehensive content strategy development'],
        threats: ['Poor content quality affecting brand perception']
      },
      recommendations: [{
        priority: 'High',
        area: 'Content Strategy',
        action: 'Complete content strategy and engagement audit',
        impact: 'Establish strong content foundation',
        timeline: '90-120 days',
        difficulty: 'Medium',
        hiveService: 'Complete Content Strategy Package'
      }],
      hiveServices: [{
        service: 'Complete Content Strategy Package',
        description: 'Full content strategy development and optimization',
        investment: '$5,000 - $12,000',
        timeline: '12-18 weeks',
        roi: 'Comprehensive content transformation and engagement improvement'
      }],
      contentStrategy: {
        contentPillars: ['Company Updates', 'Industry Insights', 'Customer Stories', 'Expert Tips'],
        publishingFrequency: '3-4 times per week',
        contentTypes: ['Blog Posts', 'Social Media Updates', 'Email Newsletters'],
        distributionChannels: ['Website Blog', 'Email Marketing'],
        measurementMetrics: {
          contentPerformance: ['Page views', 'Time on page', 'Social shares'],
          engagementMetrics: ['Social media engagement', 'Email open rates'],
          businessImpact: ['Lead generation', 'Website traffic', 'Brand awareness']
        }
      }
    }
  }
}

export default ContentAnalyzer
