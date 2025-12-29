import WebsiteAnalyzer from './website-analyzer.js'
import BrandAnalyzer from './brand-analyzer.js'
import ContentAnalyzer from './content-analyzer.js'
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'

export class MasterAnalyzer {
  constructor() {
    this.websiteAnalyzer = new WebsiteAnalyzer()
    this.brandAnalyzer = new BrandAnalyzer()
    this.contentAnalyzer = new ContentAnalyzer()
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.2 // Lower temperature for more consistent analysis
    })
  }

  async performCompleteAnalysis(leadData) {
    try {
       
      console.log(`Starting Hive-specific analysis for: ${leadData.websiteUrl}`)
      
      const analysisId = `hive_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Enhanced business context from assessment data
      const businessContext = this.buildBusinessContext(leadData)
      
      // Run all analyses in parallel
      const [websiteResults, brandResults, contentResults] = await Promise.allSettled([
        this.websiteAnalyzer.analyzeWebsite(leadData.websiteUrl, businessContext),
        this.brandAnalyzer.analyzeBrand(leadData.websiteUrl, businessContext),
        this.contentAnalyzer.analyzeContent(leadData.websiteUrl, businessContext)
      ])
      
      // Handle analysis results
      const results = {
        website: websiteResults.status === 'fulfilled' ? websiteResults.value : this.getFailureResult('website'),
        brand: brandResults.status === 'fulfilled' ? brandResults.value : this.getFailureResult('brand'),
        content: contentResults.status === 'fulfilled' ? contentResults.value : this.getFailureResult('content')
      }
      
      // Apply Hive's service frameworks
      const hiveFrameworkAnalysis = await this.applyHiveFrameworks(results, businessContext, leadData)
      
      // Generate competitive analysis
      const competitiveAnalysis = await this.generateCompetitiveAnalysis(results, businessContext)
      
      // Calculate business-specific scores
      const hiveScores = this.calculateHiveSpecificScores(results, businessContext)
      
      // Generate ROI projections
      const roiProjections = await this.generateROIProjections(hiveFrameworkAnalysis, businessContext)
      
      // Create implementation roadmap
      const implementationRoadmap = this.createImplementationRoadmap(hiveFrameworkAnalysis, businessContext)
      
      // Generate executive summary
      const executiveSummary = await this.generateHiveExecutiveSummary(hiveFrameworkAnalysis, hiveScores, businessContext)
      
      // Compile final Hive-specific report
      const finalReport = {
        analysisId,
        leadId: leadData.recordId,
        businessContext,
        analyzedUrl: leadData.websiteUrl,
        analysisDate: new Date().toISOString(),
        
        // Hive Framework Results
        hiveFrameworks: hiveFrameworkAnalysis,
        competitiveAnalysis,
        scores: hiveScores,
        roiProjections,
        implementationRoadmap,
        executiveSummary,
        
        // Raw analysis data (for reference)
        rawAnalysis: {
          website: results.website,
          brand: results.brand,
          content: results.content
        },
        
        // Hive service recommendations
        hiveServiceRecommendations: this.generateHiveServiceRecommendations(hiveFrameworkAnalysis, businessContext),
        
        // Report metadata
        reportGenerated: new Date().toISOString(),
        version: '2.0',
        framework: 'Hive Service-Specific Analysis'
      }
      
       
      console.log(`Hive analysis complete for ${leadData.companyName}. Overall score: ${hiveScores.overall}`)
      return finalReport
      
    } catch (error) {
       
      console.error('Hive analysis failed:', error)
      throw new Error(`Hive analysis failed: ${error.message}`)
    }
  }

  buildBusinessContext(leadData) {
    return {
      // Basic info
      company: leadData.companyName,
      industry: leadData.industry,
      websiteUrl: leadData.websiteUrl,
      
      // Business profile
      yearsInBusiness: leadData.yearsInBusiness,
      numberOfEmployees: leadData.numberOfEmployees,
      annualRevenue: leadData.annualRevenue,
      
      // Marketing context
      monthlyMarketingBudget: leadData.monthlyMarketingBudget,
      currentMarketingActivities: leadData.currentMarketingActivities,
      currentMarketingPerformance: leadData.currentMarketingPerformance,
      biggestMarketingChallenge: leadData.biggestMarketingChallenge,
      
      // Goals and urgency
      primaryMarketingGoal: leadData.primaryMarketingGoal,
      implementationTimeline: leadData.implementationTimeline,
      urgencyLevel: leadData.urgencyLevel,
      
      // Decision making
      decisionMaker: leadData.decisionMaker,
      budgetAlignment: leadData.budgetAlignment,
      
      // Derived insights
      businessStage: this.determineBusinessStage(leadData),
      marketingMaturity: this.assessMarketingMaturity(leadData),
      investmentCapacity: this.assessInvestmentCapacity(leadData)
    }
  }

  async applyHiveFrameworks(results, businessContext, _leadData) {
    // Brand Identity Framework Analysis
    const brandFramework = await this.analyzeBrandIdentityFramework(results.brand, businessContext)
    
    // Website & Conversion Framework Analysis  
    const websiteFramework = await this.analyzeWebsiteConversionFramework(results.website, businessContext)
    
    // Content & Engagement Framework Analysis
    const contentFramework = await this.analyzeContentEngagementFramework(results.content, businessContext)
    
    return {
      brandIdentity: brandFramework,
      websiteConversion: websiteFramework,
      contentEngagement: contentFramework
    }
  }

  async analyzeBrandIdentityFramework(brandResults, businessContext) {
    const prompt = PromptTemplate.fromTemplate(`
You are a brand identity expert analyzing a {industry} company with {numberOfEmployees} employees and {yearsInBusiness} years in business.

COMPANY CONTEXT:
- Industry: {industry}
- Business Stage: {businessStage}
- Marketing Challenge: {biggestMarketingChallenge}
- Primary Goal: {primaryMarketingGoal}
- Marketing Budget: {monthlyMarketingBudget}

BRAND ANALYSIS DATA:
{brandAnalysisData}

Using Hive's Brand Identity Framework, evaluate:

1. BRAND RECOGNITION SCORE (0-100):
   - Logo effectiveness and memorability
   - Visual consistency across touchpoints
   - Brand mark strength and uniqueness

2. BRAND VOICE CLARITY (0-100):
   - Messaging consistency and alignment
   - Tone appropriateness for target audience
   - Value proposition clarity

3. MARKET POSITIONING STRENGTH (0-100):
   - Competitive differentiation
   - Target audience alignment
   - Industry positioning effectiveness

4. BRAND COHESION INDEX (0-100):
   - Cross-platform consistency
   - Visual identity system completeness
   - Brand guideline adherence

For each framework area, provide:
- Current score with specific reasoning
- 3 specific improvement opportunities with business impact
- Implementation difficulty (Easy/Medium/Hard)
- Expected timeline for results (30/60/90 days)
- How Hive's brand identity services specifically address these issues

Focus on {industry}-specific brand challenges and opportunities that match their {businessStage} stage.

Return as detailed JSON with scores, insights, and actionable recommendations.
    `)

    const result = await prompt.pipe(this.llm).invoke({
      industry: businessContext.industry,
      numberOfEmployees: businessContext.numberOfEmployees,
      yearsInBusiness: businessContext.yearsInBusiness,
      businessStage: businessContext.businessStage,
      biggestMarketingChallenge: businessContext.biggestMarketingChallenge,
      primaryMarketingGoal: businessContext.primaryMarketingGoal,
      monthlyMarketingBudget: businessContext.monthlyMarketingBudget,
      brandAnalysisData: JSON.stringify(brandResults, null, 2)
    })

    try {
      return JSON.parse(result.content)
    } catch {
      return this.getDefaultBrandFramework()
    }
  }

  async analyzeWebsiteConversionFramework(websiteResults, businessContext) {
    const prompt = PromptTemplate.fromTemplate(`
You are a website conversion expert analyzing a {industry} company website.

COMPANY CONTEXT:
- Industry: {industry}
- Business Stage: {businessStage}
- Primary Goal: {primaryMarketingGoal}
- Current Performance: {currentMarketingPerformance}
- Marketing Budget: {monthlyMarketingBudget}

WEBSITE ANALYSIS DATA:
{websiteAnalysisData}

Using Hive's Website & Conversion Framework, evaluate:

1. CONVERSION PATH EFFECTIVENESS (0-100):
   - User journey optimization
   - Call-to-action placement and effectiveness
   - Form optimization and lead capture

2. TECHNICAL PERFORMANCE SCORE (0-100):
   - Page speed and Core Web Vitals
   - Mobile responsiveness and UX
   - SEO technical foundation

3. LEAD GENERATION EFFICIENCY (0-100):
   - Contact form effectiveness
   - Lead magnet quality and placement
   - Conversion funnel optimization

4. USER EXPERIENCE QUALITY (0-100):
   - Navigation clarity and usability
   - Design quality and professionalism
   - Content accessibility and readability

For each framework area, provide:
- Current score with specific technical details
- 3 specific conversion optimization opportunities
- Technical implementation requirements
- Expected conversion rate improvements
- ROI projections for website improvements
- How Hive's website services specifically solve these issues

Include {industry}-specific conversion best practices and benchmarks.

Return as detailed JSON with technical analysis and implementation roadmap.
    `)

    const result = await prompt.pipe(this.llm).invoke({
      industry: businessContext.industry,
      businessStage: businessContext.businessStage,
      primaryMarketingGoal: businessContext.primaryMarketingGoal,
      currentMarketingPerformance: businessContext.currentMarketingPerformance,
      monthlyMarketingBudget: businessContext.monthlyMarketingBudget,
      websiteAnalysisData: JSON.stringify(websiteResults, null, 2)
    })

    try {
      return JSON.parse(result.content)
    } catch {
      return this.getDefaultWebsiteFramework()
    }
  }

  async analyzeContentEngagementFramework(contentResults, businessContext) {
    const prompt = PromptTemplate.fromTemplate(`
You are a content marketing expert analyzing a {industry} company's content strategy.

COMPANY CONTEXT:
- Industry: {industry}
- Business Stage: {businessStage}
- Current Activities: {currentMarketingActivities}
- Primary Goal: {primaryMarketingGoal}
- Marketing Challenge: {biggestMarketingChallenge}

CONTENT ANALYSIS DATA:
{contentAnalysisData}

Using Hive's Content & Engagement Framework, evaluate:

1. CONTENT STRATEGY EFFECTIVENESS (0-100):
   - Content quality and relevance
   - Publishing consistency and frequency
   - Content-to-conversion alignment

2. SOCIAL MEDIA ENGAGEMENT QUALITY (0-100):
   - Platform presence and activity
   - Audience engagement and growth
   - Brand voice consistency across channels

3. SEO CONTENT PERFORMANCE (0-100):
   - Keyword targeting and optimization
   - Content structure and readability
   - Search traffic potential

4. AUDIENCE CONNECTION STRENGTH (0-100):
   - Message resonance and relevance
   - Community building and interaction
   - Brand personality expression

For each framework area, provide:
- Current score with specific content examples
- 3 content improvement opportunities with topics
- Content creation requirements and resources needed
- Expected engagement and traffic improvements
- How Hive's content services specifically address gaps

Focus on {industry}-specific content strategies and {businessStage} appropriate tactics.

Return as detailed JSON with content strategy recommendations and implementation plan.
    `)

    const result = await prompt.pipe(this.llm).invoke({
      industry: businessContext.industry,
      businessStage: businessContext.businessStage,
      currentMarketingActivities: Array.isArray(businessContext.currentMarketingActivities) 
        ? businessContext.currentMarketingActivities.join(', ') 
        : businessContext.currentMarketingActivities,
      primaryMarketingGoal: businessContext.primaryMarketingGoal,
      biggestMarketingChallenge: businessContext.biggestMarketingChallenge,
      contentAnalysisData: JSON.stringify(contentResults, null, 2)
    })

    try {
      return JSON.parse(result.content)
    } catch {
      return this.getDefaultContentFramework()
    }
  }

  async generateCompetitiveAnalysis(results, businessContext) {
    const prompt = PromptTemplate.fromTemplate(`
Analyze competitive positioning for a {industry} company with {numberOfEmployees} employees.

Based on the analysis data, identify:
1. Industry benchmark gaps where this company underperforms
2. Competitive advantages they could develop
3. Market opportunities in their sector
4. Industry-specific best practices they're missing

ANALYSIS DATA: {analysisData}

Provide specific, actionable competitive insights without naming competitors.
Focus on gaps that Hive's services (brand identity, website design, content marketing) can address.

Return as JSON with competitive gaps, opportunities, and strategic recommendations.
    `)

    const result = await prompt.pipe(this.llm).invoke({
      industry: businessContext.industry,
      numberOfEmployees: businessContext.numberOfEmployees,
      analysisData: JSON.stringify({ 
        brandScore: results.brand.score, 
        websiteScore: results.website.score,
        contentScore: results.content.score 
      })
    })

    try {
      return JSON.parse(result.content)
    } catch {
      return {
        industryBenchmarkGaps: ["Analysis unavailable"],
        competitiveOpportunities: ["Manual review required"],
        strategicRecommendations: ["Contact Hive for detailed competitive analysis"]
      }
    }
  }

  async generateROIProjections(hiveFrameworkAnalysis, businessContext) {
    // Calculate potential ROI based on framework improvements
    const brandROI = this.calculateBrandROI(hiveFrameworkAnalysis.brandIdentity, businessContext)
    const websiteROI = this.calculateWebsiteROI(hiveFrameworkAnalysis.websiteConversion, businessContext)
    const contentROI = this.calculateContentROI(hiveFrameworkAnalysis.contentEngagement, businessContext)

    return {
      brandIdentityROI: brandROI,
      websiteConversionROI: websiteROI,
      contentEngagementROI: contentROI,
      combinedROI: this.calculateCombinedROI(brandROI, websiteROI, contentROI),
      investmentRecommendation: this.generateInvestmentRecommendation(businessContext)
    }
  }

  generateHiveServiceRecommendations(hiveFrameworkAnalysis, businessContext) {
    const recommendations = {
      priorityService: this.determinePriorityService(hiveFrameworkAnalysis),
      recommendedPackage: this.recommendPackage(businessContext),
      implementationPhase: this.suggestImplementationPhase(hiveFrameworkAnalysis, businessContext),
      expectedOutcomes: this.projectExpectedOutcomes(hiveFrameworkAnalysis),
      nextSteps: this.generateNextSteps(businessContext)
    }

    return recommendations
  }

  // Utility methods for business stage and maturity assessment
  determineBusinessStage(leadData) {
    const years = leadData.yearsInBusiness
    const employees = leadData.numberOfEmployees
    // const revenue = leadData.annualRevenue // Unused but kept for potential future use

    if (years === 'less-than-1-year' || employees === 'just-me-solopreneur') {
      return 'Startup'
    } else if (years === '1-2-years' || employees === '2-5-employees') {
      return 'Early Stage'
    } else if (years === '3-5-years' || employees === '6-15-employees') {
      return 'Growth Stage'
    } else {
      return 'Established'
    }
  }

  assessMarketingMaturity(leadData) {
    const activities = Array.isArray(leadData.currentMarketingActivities) 
      ? leadData.currentMarketingActivities.length 
      : 0
    const performance = leadData.currentMarketingPerformance

    if (activities <= 2 || performance.includes('terrible')) {
      return 'Basic'
    } else if (activities <= 5 || performance.includes('fair')) {
      return 'Developing'
    } else {
      return 'Advanced'
    }
  }

  assessInvestmentCapacity(leadData) {
    const budget = leadData.monthlyMarketingBudget
    const alignment = leadData.budgetAlignment

    if (budget.includes('under-1000') || alignment.includes('outside-budget')) {
      return 'Limited'
    } else if (budget.includes('1000-3000') || alignment.includes('higher-than-expected')) {
      return 'Moderate'
    } else {
      return 'Strong'
    }
  }

  // Default framework responses for error handling
  getDefaultBrandFramework() {
    return {
      brandRecognitionScore: 50,
      brandVoiceClarity: 50,
      marketPositioningStrength: 50,
      brandCohesionIndex: 50,
      improvements: ["Brand audit required", "Manual analysis recommended"],
      hiveRecommendations: ["Contact Hive for comprehensive brand assessment"]
    }
  }

  getDefaultWebsiteFramework() {
    return {
      conversionPathEffectiveness: 50,
      technicalPerformanceScore: 50,
      leadGenerationEfficiency: 50,
      userExperienceQuality: 50,
      improvements: ["Website audit required", "Manual analysis recommended"],
      hiveRecommendations: ["Contact Hive for website performance assessment"]
    }
  }

  getDefaultContentFramework() {
    return {
      contentStrategyEffectiveness: 50,
      socialMediaEngagementQuality: 50,
      seoContentPerformance: 50,
      audienceConnectionStrength: 50,
      improvements: ["Content audit required", "Manual analysis recommended"],
      hiveRecommendations: ["Contact Hive for content strategy assessment"]
    }
  }

  calculateHiveSpecificScores(results, businessContext) {
    // Weight scores based on business context and framework analysis
    const brandWeight = this.getBrandWeight(businessContext)
    const websiteWeight = this.getWebsiteWeight(businessContext)
    const contentWeight = this.getContentWeight(businessContext)

    const weightedBrand = results.brand.score * brandWeight
    const weightedWebsite = results.website.score * websiteWeight
    const weightedContent = results.content.score * contentWeight

    const overall = Math.round(weightedBrand + weightedWebsite + weightedContent)

    return {
      overall,
      brand: results.brand.score,
      website: results.website.score,
      content: results.content.score,
      weights: { brand: brandWeight, website: websiteWeight, content: contentWeight },
      businessContextScore: this.calculateBusinessContextScore(businessContext),
      improvementPotential: Math.max(0, 100 - overall)
    }
  }

  // Additional utility methods would continue here...
  // (calculateBrandROI, calculateWebsiteROI, etc.)

  getFailureResult(analysisType) {
    return {
      error: true,
      message: `${analysisType} analysis failed`,
      score: 0,
      insights: {
        assessment: `Unable to complete ${analysisType} analysis`,
        recommendations: [`Manual ${analysisType} review required`],
        priorities: ['Review analysis logs', 'Conduct manual assessment']
      }
    }
  }
}

export default MasterAnalyzer
