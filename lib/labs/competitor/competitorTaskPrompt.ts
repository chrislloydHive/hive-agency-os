// lib/labs/competitor/competitorTaskPrompt.ts
// Task prompt for Competitor Lab AI refinement

export const COMPETITOR_LAB_TASK_PROMPT = `Analyze and refine the company's competitive landscape.

## Step 1: Identify Top Competitors
From available signals (identity, brand, industry context):
- Identify the top 5-8 competitors in the market
- Categorize each as: direct, indirect, aspirational, or emerging
- Include the company itself as a competitor with category "own"

## Step 2: For Each Competitor, Document:
1. **Normalize name & domain**
   - Use official company name
   - Extract clean domain (e.g., "acme.com" not "https://www.acme.com/")

2. **Describe positioning** (1-2 sentences)
   - Their primary value proposition
   - How they differentiate in the market

3. **List strengths** (2-4 items)
   - Concrete competitive advantages
   - Areas where they excel

4. **List weaknesses** (2-4 items)
   - Gaps in their offering
   - Areas where they underperform

5. **Capture unique claims**
   - Distinctive marketing messages
   - Proprietary methodologies or technologies

6. **Summarize offers**
   - Primary products/services
   - Key solutions they provide

7. **Note pricing** (if known)
   - General pricing tier (budget/mid-market/premium)
   - Any notable pricing model (subscription, project-based, etc.)

8. **Position on 2-axis map** (-100 to +100 for each axis)

## Step 3: Define Positioning Axes
Choose two axes that best differentiate competitors in this market:

**Primary Axis (horizontal):**
- Label format: "Low Descriptor ↔ High Descriptor"
- Examples: "Budget ↔ Premium", "SMB ↔ Enterprise", "Self-Service ↔ Full-Service"

**Secondary Axis (vertical):**
- Label format: "Low Descriptor ↔ High Descriptor"
- Should capture a different dimension than primary axis

## Step 4: Position the Company
- Place the company on both axes
- This should be included as a competitor entry with category "own"
- Consider current positioning and aspirational positioning

## Step 5: Identify Whitespace Opportunities
Based on the competitive map, identify 3-5 strategic whitespace opportunities:
- Underserved market segments
- Positioning gaps between competitors
- Emerging market needs not well addressed
- Differentiation opportunities

Make each whitespace opportunity:
- Specific and actionable
- Connected to the company's potential strengths
- Realistic to pursue

## Step 6: Write Position Summary
Synthesize findings into a 2-3 paragraph strategic summary covering:
- The company's current competitive position
- Key differentiation points
- Primary competitive threats
- Strategic opportunities

## Output Fields to Refine:
- competitive.primaryAxis
- competitive.secondaryAxis
- competitive.positionSummary
- competitive.whitespaceOpportunities
- competitive.competitors (array of CompetitorProfile objects)
- competitive.competitiveAdvantages
- competitive.competitiveThreats
- competitive.competitiveOpportunities
- competitive.differentiationStrategy
`;
