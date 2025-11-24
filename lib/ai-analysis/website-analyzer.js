import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'

export class WebsiteAnalyzer {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.1 // Very low temperature for consistent technical analysis
    })
  }

  async analyzeWebsite(websiteUrl, businessContext) {
    try {
      // eslint-disable-next-line no-console
      console.log(`Starting website analysis for: ${websiteUrl}`)
      
      const prompt = PromptTemplate.fromTemplate(`
You are a website conversion and technical performance expert at Hive Ad Agency, specializing in conversion optimization, technical performance, lead generation, and user experience.

ANALYZE THIS WEBSITE: {websiteUrl}

COMPANY CONTEXT:
- Company: {company}
- Industry: {industry}
- Business Stage: {businessStage}
- Primary Goal: {primaryMarketingGoal}
- Current Performance: {currentMarketingPerformance}
- Marketing Budget: {monthlyMarketingBudget}

WEBSITE & CONVERSION FRAMEWORK ANALYSIS:

1. CONVERSION PATH EFFECTIVENESS (0-100):
   - User journey optimization and flow
   - Call-to-action placement and effectiveness
   - Form optimization and lead capture
   - Conversion funnel design and optimization

2. TECHNICAL PERFORMANCE SCORE (0-100):
   - Page speed and Core Web Vitals
   - Mobile responsiveness and UX
   - SEO technical foundation
   - Website security and reliability

3. LEAD GENERATION EFFICIENCY (0-100):
   - Contact form effectiveness and optimization
   - Lead magnet quality and placement
   - Conversion funnel optimization
   - Lead nurturing and follow-up systems

4. USER EXPERIENCE QUALITY (0-100):
   - Navigation clarity and usability
   - Design quality and professionalism
   - Content accessibility and readability
   - Mobile user experience optimization

For each area, provide:
- Score (0-100) with specific technical details
- 3 specific conversion optimization opportunities
- Technical implementation requirements
- Expected conversion rate improvements
- ROI projections for website improvements
- Specific Hive website services that address these issues

Include {industry}-specific conversion best practices and benchmarks appropriate for {businessStage} businesses.

Return as detailed JSON with technical analysis and implementation roadmap.
      `)

      const result = await prompt.pipe(this.llm).invoke({
        websiteUrl,
        company: businessContext.company,
        industry: businessContext.industry,
        businessStage: businessContext.businessStage,
        primaryMarketingGoal: businessContext.primaryMarketingGoal,
        currentMarketingPerformance: businessContext.currentMarketingPerformance,
        monthlyMarketingBudget: businessContext.monthlyMarketingBudget
      })

      try {
        const analysis = JSON.parse(result.content)
        return {
          score: this.calculateOverallWebsiteScore(analysis),
          framework: analysis,
          insights: this.extractWebsiteInsights(analysis),
          recommendations: this.generateWebsiteRecommendations(analysis, businessContext),
          hiveServices: this.mapToHiveWebsiteServices(analysis),
          technicalSpecs: this.generateTechnicalSpecifications(analysis)
        }
      } catch (parseError) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse website analysis:', parseError)
        return this.getDefaultWebsiteAnalysis()
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Website analysis failed:', error)
      return this.getDefaultWebsiteAnalysis()
    }
  }

  calculateOverallWebsiteScore(analysis) {
    const scores = [
      analysis.conversionPathEffectiveness || 50,
      analysis.technicalPerformanceScore || 50,
      analysis.leadGenerationEfficiency || 50,
      analysis.userExperienceQuality || 50
    ]
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }

  extractWebsiteInsights(analysis) {
    return {
      strengths: this.identifyWebsiteStrengths(analysis),
      weaknesses: this.identifyWebsiteWeaknesses(analysis),
      opportunities: this.identifyWebsiteOpportunities(analysis),
      threats: this.identifyWebsiteThreats(analysis)
    }
  }

  identifyWebsiteStrengths(analysis) {
    const strengths = []
    if (analysis.conversionPathEffectiveness >= 70) strengths.push('Effective conversion paths and user journey')
    if (analysis.technicalPerformanceScore >= 70) strengths.push('Strong technical performance and SEO foundation')
    if (analysis.leadGenerationEfficiency >= 70) strengths.push('Efficient lead generation and capture systems')
    if (analysis.userExperienceQuality >= 70) strengths.push('High-quality user experience and design')
    return strengths.length > 0 ? strengths : ['Website foundation established']
  }

  identifyWebsiteWeaknesses(analysis) {
    const weaknesses = []
    if (analysis.conversionPathEffectiveness < 50) weaknesses.push('Poor conversion paths and user journey')
    if (analysis.technicalPerformanceScore < 50) weaknesses.push('Technical performance and SEO issues')
    if (analysis.leadGenerationEfficiency < 50) weaknesses.push('Ineffective lead generation systems')
    if (analysis.userExperienceQuality < 50) weaknesses.push('Poor user experience and design quality')
    return weaknesses.length > 0 ? weaknesses : ['Website needs development in multiple areas']
  }

  identifyWebsiteOpportunities(_analysis) {
    return [
      'Conversion rate optimization',
      'Technical performance improvement',
      'Lead generation system enhancement',
      'User experience redesign'
    ]
  }

  identifyWebsiteThreats(_analysis) {
    return [
      'Poor conversion rates affecting business',
      'Technical issues impacting SEO and performance',
      'Lost leads due to poor website experience',
      'Competitive disadvantage from poor website quality'
    ]
  }

  generateWebsiteRecommendations(analysis, _businessContext) {
    const recommendations = []
    
    if (analysis.conversionPathEffectiveness < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Conversion Optimization',
        action: 'Optimize conversion paths and user journey',
        impact: 'Increase conversion rates by 25-50%',
        timeline: '30-60 days',
        difficulty: 'Medium',
        hiveService: 'Conversion Rate Optimization'
      })
    }

    if (analysis.technicalPerformanceScore < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Technical Performance',
        action: 'Improve page speed and technical SEO',
        impact: 'Better search rankings and user experience',
        timeline: '45-75 days',
        difficulty: 'Medium',
        hiveService: 'Technical SEO & Performance'
      })
    }

    if (analysis.leadGenerationEfficiency < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Lead Generation',
        action: 'Optimize lead capture and nurturing systems',
        impact: 'Increase qualified leads by 30-60%',
        timeline: '30-45 days',
        difficulty: 'Easy',
        hiveService: 'Lead Generation Optimization'
      })
    }

    if (analysis.userExperienceQuality < 70) {
      recommendations.push({
        priority: 'Medium',
        area: 'User Experience',
        action: 'Redesign for better usability and conversion',
        impact: 'Improved user engagement and conversion',
        timeline: '60-90 days',
        difficulty: 'Hard',
        hiveService: 'Website Redesign & UX'
      })
    }

    return recommendations
  }

  mapToHiveWebsiteServices(analysis) {
    const services = []
    
    if (analysis.conversionPathEffectiveness < 70) {
      services.push({
        service: 'Conversion Rate Optimization',
        description: 'A/B testing, user journey optimization, and conversion funnel improvement',
        investment: '$2,000 - $5,000',
        timeline: '4-8 weeks',
        roi: '25-50% increase in conversion rates'
      })
    }

    if (analysis.technicalPerformanceScore < 70) {
      services.push({
        service: 'Technical SEO & Performance',
        description: 'Page speed optimization, Core Web Vitals improvement, and technical SEO audit',
        investment: '$1,500 - $3,500',
        timeline: '3-6 weeks',
        roi: 'Improved search rankings and user experience'
      })
    }

    if (analysis.leadGenerationEfficiency < 70) {
      services.push({
        service: 'Lead Generation Optimization',
        description: 'Form optimization, lead magnet development, and conversion funnel design',
        investment: '$1,000 - $2,500',
        timeline: '2-4 weeks',
        roi: '30-60% increase in qualified leads'
      })
    }

    if (analysis.userExperienceQuality < 70) {
      services.push({
        service: 'Website Redesign & UX',
        description: 'Complete website redesign with focus on conversion and user experience',
        investment: '$5,000 - $15,000',
        timeline: '8-16 weeks',
        roi: 'Significant improvement in user engagement and conversion'
      })
    }

    return services
  }

  generateTechnicalSpecifications(analysis) {
    return {
      conversionOptimization: {
        currentScore: analysis.conversionPathEffectiveness || 50,
        targetScore: 85,
        improvementAreas: ['User journey mapping', 'CTA optimization', 'Form design', 'A/B testing setup'],
        expectedResults: '25-50% increase in conversion rates'
      },
      technicalPerformance: {
        currentScore: analysis.technicalPerformanceScore || 50,
        targetScore: 90,
        improvementAreas: ['Page speed optimization', 'Mobile responsiveness', 'Core Web Vitals', 'Technical SEO'],
        expectedResults: 'Improved search rankings and user experience'
      },
      leadGeneration: {
        currentScore: analysis.leadGenerationEfficiency || 50,
        targetScore: 80,
        improvementAreas: ['Lead capture forms', 'Lead magnets', 'Conversion funnels', 'Lead nurturing'],
        expectedResults: '30-60% increase in qualified leads'
      },
      userExperience: {
        currentScore: analysis.userExperienceQuality || 50,
        targetScore: 85,
        improvementAreas: ['Navigation design', 'Content structure', 'Mobile UX', 'Accessibility'],
        expectedResults: 'Improved user engagement and satisfaction'
      }
    }
  }

  getDefaultWebsiteAnalysis() {
    return {
      score: 50,
      framework: {
        conversionPathEffectiveness: 50,
        technicalPerformanceScore: 50,
        leadGenerationEfficiency: 50,
        userExperienceQuality: 50
      },
      insights: {
        strengths: ['Website foundation established'],
        weaknesses: ['Website needs development in multiple areas'],
        opportunities: ['Comprehensive website optimization'],
        threats: ['Poor performance affecting business results']
      },
      recommendations: [{
        priority: 'High',
        area: 'Website Optimization',
        action: 'Complete website performance and conversion audit',
        impact: 'Establish strong website foundation',
        timeline: '90-120 days',
        difficulty: 'Medium',
        hiveService: 'Complete Website Optimization Package'
      }],
      hiveServices: [{
        service: 'Complete Website Optimization Package',
        description: 'Full website optimization and conversion improvement',
        investment: '$8,000 - $20,000',
        timeline: '12-20 weeks',
        roi: 'Comprehensive website transformation and performance improvement'
      }],
      technicalSpecs: {
        conversionOptimization: { currentScore: 50, targetScore: 85 },
        technicalPerformance: { currentScore: 50, targetScore: 90 },
        leadGeneration: { currentScore: 50, targetScore: 80 },
        userExperience: { currentScore: 50, targetScore: 85 }
      }
    }
  }
}

export default WebsiteAnalyzer
