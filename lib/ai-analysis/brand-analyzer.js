import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'

export class BrandAnalyzer {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.1 // Very low temperature for consistent brand analysis
    })
  }

  async analyzeBrand(websiteUrl, businessContext) {
    try {
      // eslint-disable-next-line no-console
      console.log(`Starting brand analysis for: ${websiteUrl}`)
      
      const prompt = PromptTemplate.fromTemplate(`
You are a brand identity expert at Hive Ad Agency, specializing in brand recognition, voice clarity, market positioning, and brand cohesion.

ANALYZE THIS WEBSITE: {websiteUrl}

COMPANY CONTEXT:
- Company: {company}
- Industry: {industry}
- Business Stage: {businessStage}
- Years in Business: {yearsInBusiness}
- Number of Employees: {numberOfEmployees}
- Annual Revenue: {annualRevenue}

BRAND IDENTITY FRAMEWORK ANALYSIS:

1. BRAND RECOGNITION (0-100):
   - Logo design quality and memorability
   - Visual identity strength and uniqueness
   - Brand mark effectiveness across platforms
   - Color palette and typography consistency

2. BRAND VOICE CLARITY (0-100):
   - Messaging consistency and alignment
   - Tone appropriateness for target audience
   - Value proposition clarity and positioning
   - Brand personality expression

3. MARKET POSITIONING STRENGTH (0-100):
   - Competitive differentiation
   - Target audience alignment
   - Industry positioning effectiveness
   - Unique value proposition strength

4. BRAND COHESION INDEX (0-100):
   - Cross-platform visual consistency
   - Brand guideline adherence
   - Visual identity system completeness
   - Brand experience uniformity

For each area, provide:
- Score (0-100) with specific reasoning
- 3 actionable improvement opportunities
- Implementation difficulty (Easy/Medium/Hard)
- Expected timeline for results (30/60/90 days)
- Specific Hive brand identity services that address these issues

Focus on {industry}-specific brand challenges and opportunities appropriate for {businessStage} businesses.

Return as detailed JSON with scores, insights, and actionable recommendations.
      `)

      const result = await prompt.pipe(this.llm).invoke({
        websiteUrl,
        company: businessContext.company,
        industry: businessContext.industry,
        businessStage: businessContext.businessStage,
        yearsInBusiness: businessContext.yearsInBusiness,
        numberOfEmployees: businessContext.numberOfEmployees,
        annualRevenue: businessContext.annualRevenue
      })

      try {
        const analysis = JSON.parse(result.content)
        return {
          score: this.calculateOverallBrandScore(analysis),
          framework: analysis,
          insights: this.extractBrandInsights(analysis),
          recommendations: this.generateBrandRecommendations(analysis, businessContext),
          hiveServices: this.mapToHiveBrandServices(analysis)
        }
      } catch (parseError) {
        console.error('Failed to parse brand analysis:', parseError)
        return this.getDefaultBrandAnalysis()
      }

    } catch (error) {
      console.error('Brand analysis failed:', error)
      return this.getDefaultBrandAnalysis()
    }
  }

  calculateOverallBrandScore(analysis) {
    const scores = [
      analysis.brandRecognition || 50,
      analysis.brandVoiceClarity || 50,
      analysis.marketPositioningStrength || 50,
      analysis.brandCohesionIndex || 50
    ]
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }

  extractBrandInsights(analysis) {
    return {
      strengths: this.identifyBrandStrengths(analysis),
      weaknesses: this.identifyBrandWeaknesses(analysis),
      opportunities: this.identifyBrandOpportunities(analysis),
      threats: this.identifyBrandThreats(analysis)
    }
  }

  identifyBrandStrengths(analysis) {
    const strengths = []
    if (analysis.brandRecognition >= 70) strengths.push('Strong visual identity and logo recognition')
    if (analysis.brandVoiceClarity >= 70) strengths.push('Clear and consistent brand messaging')
    if (analysis.marketPositioningStrength >= 70) strengths.push('Effective market positioning and differentiation')
    if (analysis.brandCohesionIndex >= 70) strengths.push('Consistent brand experience across platforms')
    return strengths.length > 0 ? strengths : ['Brand foundation established']
  }

  identifyBrandWeaknesses(analysis) {
    const weaknesses = []
    if (analysis.brandRecognition < 50) weaknesses.push('Weak visual identity and logo effectiveness')
    if (analysis.brandVoiceClarity < 50) weaknesses.push('Unclear or inconsistent brand messaging')
    if (analysis.marketPositioningStrength < 50) weaknesses.push('Poor market positioning and differentiation')
    if (analysis.brandCohesionIndex < 50) weaknesses.push('Inconsistent brand experience across platforms')
    return weaknesses.length > 0 ? weaknesses : ['Brand needs development in multiple areas']
  }

  identifyBrandOpportunities(_analysis) {
    return [
      'Brand identity system development',
      'Visual identity guidelines creation',
      'Brand messaging strategy refinement',
      'Cross-platform brand consistency improvement'
    ]
  }

  identifyBrandThreats(_analysis) {
    return [
      'Brand dilution from inconsistent messaging',
      'Loss of competitive positioning',
      'Customer confusion about brand identity',
      'Reduced brand recognition and recall'
    ]
  }

  generateBrandRecommendations(analysis, _businessContext) {
    const recommendations = []
    
    if (analysis.brandRecognition < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Brand Recognition',
        action: 'Develop professional logo and visual identity system',
        impact: 'Increase brand recognition by 25-40%',
        timeline: '60-90 days',
        difficulty: 'Medium',
        hiveService: 'Brand Identity Design Package'
      })
    }

    if (analysis.brandVoiceClarity < 70) {
      recommendations.push({
        priority: 'High',
        area: 'Brand Voice',
        action: 'Create comprehensive brand messaging strategy',
        impact: 'Improve message clarity and customer understanding',
        timeline: '30-60 days',
        difficulty: 'Easy',
        hiveService: 'Brand Messaging & Positioning'
      })
    }

    if (analysis.marketPositioningStrength < 70) {
      recommendations.push({
        priority: 'Medium',
        area: 'Market Positioning',
        action: 'Conduct competitive analysis and positioning strategy',
        impact: 'Strengthen competitive differentiation',
        timeline: '45-75 days',
        difficulty: 'Medium',
        hiveService: 'Brand Strategy & Positioning'
      })
    }

    if (analysis.brandCohesionIndex < 70) {
      recommendations.push({
        priority: 'Medium',
        area: 'Brand Cohesion',
        action: 'Develop brand guidelines and consistency standards',
        impact: 'Create unified brand experience across all touchpoints',
        timeline: '30-60 days',
        difficulty: 'Easy',
        hiveService: 'Brand Guidelines & Standards'
      })
    }

    return recommendations
  }

  mapToHiveBrandServices(analysis) {
    const services = []
    
    if (analysis.brandRecognition < 70) {
      services.push({
        service: 'Brand Identity Design',
        description: 'Professional logo design and visual identity system',
        investment: '$2,500 - $5,000',
        timeline: '4-6 weeks',
        roi: '25-40% increase in brand recognition'
      })
    }

    if (analysis.brandVoiceClarity < 70) {
      services.push({
        service: 'Brand Messaging Strategy',
        description: 'Clear value proposition and brand voice development',
        investment: '$1,500 - $3,000',
        timeline: '2-3 weeks',
        roi: 'Improved customer understanding and engagement'
      })
    }

    if (analysis.marketPositioningStrength < 70) {
      services.push({
        service: 'Brand Strategy & Positioning',
        description: 'Competitive analysis and market positioning strategy',
        investment: '$2,000 - $4,000',
        timeline: '3-4 weeks',
        roi: 'Stronger competitive differentiation and market share'
      })
    }

    if (analysis.brandCohesionIndex < 70) {
      services.push({
        service: 'Brand Guidelines & Standards',
        description: 'Comprehensive brand guidelines for consistency',
        investment: '$1,000 - $2,500',
        timeline: '2-3 weeks',
        roi: 'Unified brand experience and increased trust'
      })
    }

    return services
  }

  getDefaultBrandAnalysis() {
    return {
      score: 50,
      framework: {
        brandRecognition: 50,
        brandVoiceClarity: 50,
        marketPositioningStrength: 50,
        brandCohesionIndex: 50
      },
      insights: {
        strengths: ['Brand foundation established'],
        weaknesses: ['Brand needs development in multiple areas'],
        opportunities: ['Comprehensive brand identity development'],
        threats: ['Brand dilution and positioning loss']
      },
      recommendations: [{
        priority: 'High',
        area: 'Brand Identity',
        action: 'Complete brand identity assessment and development',
        impact: 'Establish strong brand foundation',
        timeline: '90-120 days',
        difficulty: 'Medium',
        hiveService: 'Complete Brand Identity Package'
      }],
      hiveServices: [{
        service: 'Complete Brand Identity Package',
        description: 'Full brand identity development and strategy',
        investment: '$5,000 - $10,000',
        timeline: '8-12 weeks',
        roi: 'Comprehensive brand transformation and recognition'
      }]
    }
  }
}

export default BrandAnalyzer
