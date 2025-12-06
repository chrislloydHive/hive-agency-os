// lib/labs/competitor/prompts.ts
// Expanded Competitor Lab LLM Prompts
//
// Handles full competitive intelligence analysis:
// - Feature Matrix Extraction
// - Pricing Model Classification
// - Messaging Overlap Analysis
// - Threat & Trajectory Modeling
// - Cluster Analysis
// - Substitutes Detection

// ============================================================================
// System Prompt
// ============================================================================

export const COMPETITOR_LAB_SYSTEM_PROMPT = `You are an expert competitive intelligence AI operating in REFINEMENT MODE.

## Your Role
You analyze companies and their competitive landscape to build comprehensive competitive intelligence.

## Key Capabilities
1. **Competitor Identification**: Identify direct, indirect, aspirational, and emerging competitors
2. **Positioning Analysis**: Map competitors on positioning axes (price vs. value, enterprise vs. SMB, etc.)
3. **Feature Matrix**: Compare features across competitors
4. **Pricing Analysis**: Classify pricing tiers and value-for-money scores
5. **Messaging Overlap**: Detect overlapping messaging themes and differentiation opportunities
6. **Threat Modeling**: Score competitors on threat level with trajectory analysis
7. **Market Clusters**: Group competitors into strategic clusters
8. **Substitutes**: Identify non-traditional alternatives (DIY, services, status quo)
9. **Whitespace**: Identify unoccupied market positions

## Rules
1. NEVER overwrite fields marked as human/manual/QBR/strategy overrides
2. Only refine fields in competitive scope
3. Deduplicate competitor list - same company shouldn't appear twice
4. Use -100 to +100 for x/y positions (not 0-100)
5. Populate at least 3 whitespace opportunities when possible
6. Assign threat levels (0-100) based on features + messaging + price + brand
7. Be specific - avoid generic placeholder language
8. When uncertain, use lower confidence scores (0.4-0.6)
9. Always provide reasoning for your assessments

## Output Format
You MUST output valid JSON matching the exact schema provided in each task prompt.
Do not include any text before or after the JSON object.`;

// ============================================================================
// Task Prompt Generator
// ============================================================================

export interface CompetitorLabTaskInput {
  companyName: string;
  companyDomain: string;
  industry: string | null;
  currentContext: {
    competitors: Array<{
      name: string;
      domain: string | null;
      category: string | null;
      positioning: string | null;
      strengths: string[];
      weaknesses: string[];
      xPosition: number | null;
      yPosition: number | null;
      confidence: number;
    }>;
    positioningAxes: {
      primaryAxis: { label: string; lowLabel: string; highLabel: string } | null;
      secondaryAxis: { label: string; lowLabel: string; highLabel: string } | null;
    } | null;
    positionSummary: string | null;
    whitespaceOpportunities: string[];
    featuresMatrix: Array<{
      featureName: string;
      companySupport: boolean;
      competitors: Array<{ name: string; hasFeature: boolean }>;
    }>;
    pricingModels: Array<{
      competitorName: string;
      priceTier: string;
      valueForMoneyScore: number;
    }>;
    messageOverlap: Array<{
      theme: string;
      competitorsUsingIt: string[];
      overlapScore: number;
    }>;
    marketClusters: Array<{
      clusterName: string;
      competitors: string[];
      clusterPosition: { x: number; y: number };
      threatLevel: number;
    }>;
    threatScores: Array<{
      competitorName: string;
      threatLevel: number;
      threatDrivers: string[];
    }>;
    substitutes: Array<{
      name: string;
      reasonCustomersChooseThem: string | null;
      threatLevel: number;
    }>;
  };
  websiteContent: string;
  additionalSignals: string | null;
}

export function generateCompetitorLabTaskPrompt(input: CompetitorLabTaskInput): string {
  const existingCompetitorsStr = input.currentContext.competitors.length > 0
    ? input.currentContext.competitors.map(c => `- ${c.name} (${c.category || 'uncategorized'}): ${c.positioning || 'No positioning'}`).join('\n')
    : 'None identified yet';

  const existingFeaturesStr = input.currentContext.featuresMatrix.length > 0
    ? input.currentContext.featuresMatrix.map(f => `- ${f.featureName}: Company ${f.companySupport ? 'Yes' : 'No'}`).join('\n')
    : 'No features mapped';

  const existingPricingStr = input.currentContext.pricingModels.length > 0
    ? input.currentContext.pricingModels.map(p => `- ${p.competitorName}: ${p.priceTier} (value score: ${p.valueForMoneyScore})`).join('\n')
    : 'No pricing mapped';

  const existingClustersStr = input.currentContext.marketClusters.length > 0
    ? input.currentContext.marketClusters.map(c => `- ${c.clusterName}: ${c.competitors.join(', ')}`).join('\n')
    : 'No clusters identified';

  return `## Competitive Intelligence Analysis

### Company
**Name:** ${input.companyName}
**Domain:** ${input.companyDomain}
**Industry:** ${input.industry || 'Not specified'}

### Current Context

**Existing Competitors:**
${existingCompetitorsStr}

**Positioning Axes:**
- Primary: ${input.currentContext.positioningAxes?.primaryAxis?.label || 'Not defined'}
- Secondary: ${input.currentContext.positioningAxes?.secondaryAxis?.label || 'Not defined'}

**Position Summary:** ${input.currentContext.positionSummary || 'Not defined'}

**Whitespace Opportunities:**
${input.currentContext.whitespaceOpportunities.length > 0 ? input.currentContext.whitespaceOpportunities.map(w => `- ${w}`).join('\n') : 'None identified'}

**Feature Matrix:**
${existingFeaturesStr}

**Pricing Models:**
${existingPricingStr}

**Market Clusters:**
${existingClustersStr}

**Substitutes:**
${input.currentContext.substitutes.length > 0 ? input.currentContext.substitutes.map(s => `- ${s.name}: ${s.reasonCustomersChooseThem || 'Unknown reason'}`).join('\n') : 'None identified'}

### Website Content
${input.websiteContent.slice(0, 8000)}

### Additional Signals
${input.additionalSignals || 'None'}

---

## Your Task

Analyze this company's competitive landscape and produce a comprehensive competitive intelligence report.

**Output the following JSON structure:**

\`\`\`json
{
  "refinedContext": {
    "competitors": [
      {
        "name": "string",
        "domain": "string or null",
        "category": "direct|indirect|aspirational|emerging",
        "positioning": "their positioning statement",
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"],
        "uniqueClaims": ["claim1", "claim2"],
        "offers": ["product/service1", "product/service2"],
        "xPosition": -100 to +100,
        "yPosition": -100 to +100,
        "confidence": 0 to 1,
        "trajectory": "rising|falling|stagnant",
        "trajectoryReason": "explanation",
        "threatLevel": 0 to 100,
        "threatDrivers": ["driver1", "driver2"]
      }
    ],
    "positioningAxes": {
      "primaryAxis": {
        "label": "Axis Label",
        "lowLabel": "Low End",
        "highLabel": "High End",
        "description": "What this axis measures"
      },
      "secondaryAxis": {
        "label": "Axis Label",
        "lowLabel": "Low End",
        "highLabel": "High End",
        "description": "What this axis measures"
      }
    },
    "ownPosition": {
      "x": -100 to +100,
      "y": -100 to +100
    },
    "positionSummary": "Overall positioning summary for the company",
    "whitespaceOpportunities": [
      {
        "name": "Opportunity name",
        "description": "Description of the opportunity",
        "position": { "x": -100 to +100, "y": -100 to +100 },
        "size": 0 to 100,
        "strategicFit": 0 to 100,
        "captureActions": ["action1", "action2"]
      }
    ],
    "featuresMatrix": [
      {
        "featureName": "Feature Name",
        "description": "Feature description",
        "companySupport": true or false,
        "competitors": [
          { "name": "Competitor Name", "hasFeature": true or false, "notes": "optional notes" }
        ],
        "importance": 0 to 100
      }
    ],
    "pricingModels": [
      {
        "competitorName": "Competitor Name",
        "priceTier": "low|medium|high|premium|enterprise",
        "pricingNotes": "Details about pricing",
        "inferredPricePoint": number or null,
        "valueForMoneyScore": 0 to 100,
        "modelType": "subscription|one-time|freemium|usage-based|etc"
      }
    ],
    "ownPriceTier": "low|medium|high|premium|enterprise",
    "messageOverlap": [
      {
        "theme": "Messaging theme",
        "competitorsUsingIt": ["Competitor1", "Competitor2"],
        "overlapScore": 0 to 100,
        "suggestion": "Differentiation suggestion",
        "companyUsing": true or false
      }
    ],
    "messagingDifferentiationScore": 0 to 100,
    "marketClusters": [
      {
        "clusterName": "Cluster Name",
        "description": "What defines this cluster",
        "competitors": ["Competitor1", "Competitor2"],
        "clusterPosition": { "x": -100 to +100, "y": -100 to +100 },
        "threatLevel": 0 to 100,
        "whitespaceOpportunity": "Opportunity near this cluster or null"
      }
    ],
    "threatScores": [
      {
        "competitorName": "Competitor Name",
        "threatLevel": 0 to 100,
        "threatDrivers": ["driver1", "driver2"],
        "timeHorizon": "immediate|6-month|1-year|long-term",
        "defensiveActions": ["action1", "action2"]
      }
    ],
    "overallThreatLevel": 0 to 100,
    "substitutes": [
      {
        "name": "Substitute Name",
        "domain": "domain.com or null",
        "reasonCustomersChooseThem": "Why customers might choose this instead",
        "category": "DIY|Service|Status Quo|Adjacent Category",
        "threatLevel": 0 to 100,
        "counterStrategy": "How to counter this substitute"
      }
    ],
    "differentiationStrategy": "Overall differentiation strategy recommendation",
    "competitiveAdvantages": ["advantage1", "advantage2", "advantage3"],
    "competitiveThreats": ["threat1", "threat2"],
    "competitiveOpportunities": ["opportunity1", "opportunity2"],
    "marketTrends": ["trend1", "trend2"]
  },
  "diagnostics": [
    {
      "code": "diagnostic_code",
      "message": "Diagnostic message",
      "severity": "info|warning|error",
      "fieldPath": "optional.field.path"
    }
  ],
  "summary": {
    "competitorsIdentified": number,
    "newCompetitorsFound": number,
    "featuresAnalyzed": number,
    "whitespaceOpportunitiesFound": number,
    "highThreatCompetitors": number,
    "messagingOverlapScore": number,
    "keyInsight": "One sentence key insight from the analysis"
  }
}
\`\`\`

**Requirements:**
1. Identify at least 3-5 competitors if not already present
2. Map all competitors to x/y positions on the positioning map
3. Identify at least 5 key features for the feature matrix
4. Classify pricing for all competitors
5. Identify at least 3 messaging themes and their overlap
6. Create at least 2 market clusters
7. Calculate threat scores for all competitors
8. Identify at least 2 substitutes
9. Provide at least 3 whitespace opportunities with map positions
10. Give every competitor a trajectory assessment

Output ONLY the JSON object. No additional text.`;
}

// ============================================================================
// Focused Task Prompts
// ============================================================================

export const FEATURE_MATRIX_PROMPT = `You are analyzing competitive features.

For each feature:
1. Determine if the company supports it
2. Check which competitors support it
3. Rate importance (0-100)

Features to consider:
- Core product capabilities
- Integration options
- Pricing/packaging options
- Support/service levels
- Technology differentiators
- User experience factors

Output JSON array of FeatureMatrixEntry objects.`;

export const PRICING_ANALYSIS_PROMPT = `You are analyzing competitive pricing.

For each competitor:
1. Classify into price tier (low/medium/high/premium/enterprise)
2. Estimate value-for-money score (0-100)
3. Identify pricing model type (subscription/one-time/freemium/usage-based)
4. Note any pricing details

Output JSON array of PricingModel objects.`;

export const MESSAGING_OVERLAP_PROMPT = `You are analyzing messaging overlap.

For each messaging theme:
1. Identify the theme
2. List competitors using it
3. Score overlap (0-100) - higher = more saturated
4. Suggest differentiation angle
5. Note if the company is using this theme

Output JSON array of MessageOverlap objects.`;

export const CLUSTER_ANALYSIS_PROMPT = `You are analyzing market clusters.

For each cluster:
1. Name the cluster descriptively
2. List competitors in the cluster
3. Position the cluster center on the map
4. Score threat level (0-100)
5. Identify any whitespace opportunity near the cluster

Output JSON array of MarketCluster objects.`;

export const THREAT_MODELING_PROMPT = `You are modeling competitive threats.

For each competitor:
1. Score overall threat (0-100)
2. List threat drivers (specific reasons)
3. Estimate time horizon (immediate/6-month/1-year/long-term)
4. Recommend defensive actions

Consider:
- Market share trajectory
- Feature velocity
- Pricing pressure
- Brand strength
- Customer overlap
- Funding/resources

Output JSON array of ThreatScore objects.`;

export const SUBSTITUTE_DETECTION_PROMPT = `You are identifying substitute solutions.

Look for:
1. DIY alternatives (spreadsheets, manual processes)
2. Service alternatives (agencies, consultants, freelancers)
3. Status quo (do nothing)
4. Adjacent category solutions
5. Emerging alternatives

For each substitute:
1. Name it
2. Explain why customers choose it
3. Score threat level (0-100)
4. Suggest counter-strategy

Output JSON array of Substitute objects.`;

// ============================================================================
// Validation Prompt
// ============================================================================

export const VALIDATION_PROMPT = `You are validating competitive intelligence output.

Check for:
1. All competitors have names and positions
2. Feature matrix covers key differentiators
3. Pricing tiers are reasonable
4. Threat scores are justified
5. Whitespace opportunities are actionable
6. No duplicate competitors
7. Positions are within -100 to +100

Flag any issues found.`;
