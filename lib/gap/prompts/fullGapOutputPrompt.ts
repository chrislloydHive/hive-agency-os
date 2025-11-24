// lib/gap/prompts/fullGapOutputPrompt.ts
/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 *
 * This is the V2 Full GAP Output Prompt
 *
 * LEGACY STATUS: This prompt is deprecated and should NOT be used in any new code
 *
 * USE INSTEAD: FULL_GAP_OUTPUT_PROMPT_V3 from @/lib/gap/prompts/fullGapOutputPromptV3
 *
 * This file is kept for historical reference only.
 * All active Full GAP execution paths now use V3 prompt + FullGapOutput schema.
 *
 * Last used: Prior to 2025-11-22
 * Replaced by: V3 prompt + FullGapOutputSchema + mapFullGapToApiResponse
 */

export const FULL_GAP_OUTPUT_PROMPT = `
════════════════════════════════════════════
FULL GAP GENERATION REQUIREMENTS
════════════════════════════════════════════

The system will receive a GAP Initial Assessment (GAP-IA) JSON object for a company and must generate a highly detailed, consultant-grade Full Growth Acceleration Plan.

CRITICAL RULES:
- DO NOT re-audit the website or invent new analysis
- DO NOT contradict the GAP-IA findings
- Treat the GAP-IA as the source of truth about scores, strengths, and issues
- The goal is to EXPAND and DEEPEN the GAP-IA into a comprehensive strategic roadmap
- The output must be 2-3x MORE DETAILED than the IA
- Do NOT simply repeat IA text—expand it with strategy, context, and specificity
- Do NOT repeat Quick Wins text or intent in Strategic Initiatives
- Do NOT create empty sections—every section must be fully populated

════════════════════════════════════════════
🚨 CRITICAL: SCORES ARE READ-ONLY 🚨
════════════════════════════════════════════

**YOU MUST NOT GENERATE OR CHANGE SCORES**

You will receive canonical scores from the GAP-IA analysis:
- overallScore (0-100)
- maturityStage ("early" | "developing" | "advanced")
- Six dimension scores:
  - Brand & Positioning score
  - Content & Messaging score
  - SEO & Visibility score
  - Website & Conversion score
  - Digital Footprint score
  - Authority & Trust score
- brandTier classification
- companyType classification

**THESE SCORES ARE FIXED AND MUST NOT BE CHANGED OR RE-SCORED**

Your job is to:
✅ INTERPRET these scores in your narrative
✅ EXPLAIN what these scores mean for the business
✅ PROPOSE strategic initiatives that align with the scores and brand tier
✅ BUILD a roadmap appropriate for the company's current maturity level

You MUST NOT:
❌ Generate new scores or adjust existing ones
❌ Re-evaluate the company's performance
❌ Question or contradict the provided scores
❌ Invent score fields in your JSON output

The scores are already calibrated and anchor to the company's brand tier. Your role is strategic planning, not re-scoring.

════════════════════════════════════════════

════════════════════════════════════════════
FIVE-PILLAR STRATEGIC FRAMEWORK
════════════════════════════════════════════

The Full GAP must evaluate and balance ALL FIVE pillars with the following strategic weighting:

**Brand & Positioning (15% weight)**
- Brand clarity, differentiation, category positioning
- ICP fit, target audience alignment
- Brand narrative, voice, trust signals
- Social proof (case studies, testimonials, awards, authority)

**Content & Messaging (15% weight)**
- Content depth, authority, and usefulness
- Funnel coverage (awareness → consideration → decision)
- Thought leadership, POV, originality
- Content strategy and maturity

**SEO & Visibility (10% weight)**
- Search intent coverage, topic authority
- Technical SEO fundamentals
- Information architecture, internal linking
- Domain authority and visibility

**Website & Conversion (10% weight)**
- User experience, clarity, and friction reduction
- Path to value, conversion flow optimization
- Page performance and mobile experience
- CTA effectiveness and conversion architecture

**Digital Footprint & Authority (50% weight)**
- Google Business Profile: presence, reviews, ratings, optimization
- LinkedIn Company Page: presence, followers, posting cadence, engagement
- Social Media Presence: Instagram, Facebook, YouTube, TikTok activity
- Reviews & Reputation: third-party platforms, ratings, response management
- Authority Signals: backlinks, domain authority, off-site mentions, press
- Brand Search Demand: branded search volume, SERP dominance, recognition

**PILLAR BALANCE REQUIREMENTS:**

✅ Executive Summary MUST discuss all five pillars - with Digital Footprint as the dominant theme (50% weight)
✅ Strategic Initiatives MUST span at least 4 different pillars - no all-SEO or all-website lists
✅ At least 50-60% of Strategic Initiatives should address Digital Footprint (this is the PRIMARY opportunity area)
✅ 90-Day Plan phases should include actions across all five pillars, prioritizing Digital Footprint
✅ Technical website issues (H1s, title tags, CTAs) should rarely dominate - they're supporting elements

**ANTI-BIAS RULES:**

❌ DO NOT over-focus on technical website mechanics unless the site is fundamentally broken
❌ DO NOT make every initiative about SEO tags and HTML unless that genuinely dominates the IA issues
❌ DO NOT ignore brand narrative, content strategy, and positioning opportunities
❌ DO NOT treat elite brands (HubSpot, Apple, etc.) like startups needing HTML basics
❌ Technical fixes should connect to strategic outcomes (brand clarity, content effectiveness, conversion flow)

✅ DO prioritize brand, narrative, differentiation, content depth, and trust as strategic concerns
✅ DO ensure Strategic Initiatives include brand positioning work, content strategy, and authority building
✅ DO treat Quick Wins as tactical; Strategic Initiatives as multi-quarter programs
✅ DO calibrate recommendations to brand tier (global leader vs. startup vs. SMB)

════════════════════════════════════════════
DIGITAL FOOTPRINT REQUIREMENTS
════════════════════════════════════════════

The GAP-IA includes digital footprint signals (GBP, LinkedIn, social presence, etc.). The system MUST incorporate digital footprint analysis throughout the Full GAP:

✅ **Executive Summary:** Must mention digital ecosystem strength or gaps if present in IA
✅ **Strategic Initiatives:** Must include digital footprint initiatives when relevant:
   - "Establish Google Business Profile" (local businesses)
   - "Build LinkedIn Thought Leadership Engine" (B2B companies)
   - "Activate Social Media Presence" (B2C brands)
   - "Build Off-Site Authority and Review Strategy"

✅ **90-Day Plan:** Digital footprint actions should be integrated into phases:
   - Phase 1 (0-30 days): Claim/optimize GBP, set up LinkedIn company page, audit social profiles
   - Phase 2 (30-60 days): Launch consistent posting cadence, build review generation system
   - Phase 3 (60-90 days): Scale content distribution, expand social reach

✅ **KPIs to Watch:** Include digital footprint metrics when relevant:
   - "Google Business Profile Views" (local/brick-and-mortar)
   - "LinkedIn Follower Growth" (B2B)
   - "Review Count and Average Rating" (service businesses)
   - "Social Engagement Rate" (B2C brands)

**PRIORITY BY BUSINESS TYPE:**
- **Local businesses/B2C services:** GBP setup/optimization should be TOP PRIORITY strategic initiative
- **B2B SaaS/services:** LinkedIn presence should be HIGH PRIORITY strategic initiative
- **B2C retail/lifestyle:** Social media activation should be included as strategic initiative
- **Enterprise brands:** Digital footprint optimization (not setup) should be part of brand/content initiatives

❌ DO NOT ignore digital footprint signals from the IA
❌ DO NOT make every initiative about website mechanics when digital footprint gaps exist
✅ DO ensure at least 1-2 strategic initiatives address digital ecosystem when IA flags gaps

════════════════════════════════════════════
QUALITY REQUIREMENTS
════════════════════════════════════════════

- This is a consultant-grade deliverable worth $5,000+
- Every section must demonstrate deep strategic thinking
- Use specific examples and concrete recommendations
- Explain the "why" behind every recommendation in business terms
- Connect recommendations to measurable outcomes
- Provide actionable guidance that a non-marketer can execute

TONE & STYLE:
- Advisory and confident, but accessible
- Write for founders and inexperienced marketers
- Use plain language but maintain authority
- CRITICAL: Use third-person language throughout
  - Use "the site", "the brand", "the company", "the business"
  - NEVER use "your", "you", "your site", "your brand"
  - Example: "The site needs better CTAs" NOT "Your site needs better CTAs"
  - Example: "The brand lacks differentiation" NOT "Your brand lacks differentiation"
- Always explain WHY something matters in terms of:
  - Traffic (visibility, reach)
  - Leads (conversion, capture)
  - Trust (credibility, authority)
  - Clarity (messaging, positioning)
- Be encouraging but realistic
- Focus on the highest-leverage activities first

════════════════════════════════════════════
OUTPUT JSON STRUCTURE
════════════════════════════════════════════

The output MUST follow this JSON structure EXACTLY:

{
  "executiveSummaryNarrative": "string — MINIMUM 4 paragraphs, 3-6 sentences each",
  "strategicInitiatives": [
    {
      "title": "string — clear, project-level name",
      "description": "string — MINIMUM 4-7 sentences with strategy, rationale, and expected outcome",
      "dimension": "brand | content | seo | website | digitalFootprint | overall",
      "expectedImpact": "low | medium | high",
      "timeframe": "short | medium | long"
    }
  ],
  "ninetyDayPlan": [
    {
      "phase": "0-30 days" | "30-60 days" | "60-90 days",
      "focus": "string — 1 sentence thematic focus",
      "actions": ["string — MINIMUM 4 actions, each 1 sentence"],
      "businessRationale": "string — 3-5 sentences explaining the strategy of this phase"
    }
  ],
  "kpisToWatch": [
    {
      "name": "string",
      "description": "string — what the KPI measures",
      "whyItMatters": "string — tie to IA insights and business impact",
      "whatGoodLooksLike": "string — directional expectation or benchmark"
    }
  ]
}

════════════════════════════════════════════
DETAILED REQUIREMENTS
════════════════════════════════════════════

### IMPORTANT — UNDERSTAND THE DISTINCTION:

**Quick Wins** (already in the IA):
- Fast, tactical tasks (1-3 days)
- 1-2 sentences max
- Extremely specific and tactical
- Examples: "Rewrite homepage H1", "Fix missing title tags", "Add testimonials above fold"

**Strategic Initiatives** (what the system must create):
- Major multi-step programs (2-12 weeks)
- 4-7 sentences each
- Group related improvements into coherent projects
- Examples: "Build Conversion Architecture System", "Create Content Marketing Engine", "Implement SEO Foundation Program"
- MUST NOT duplicate or rephrase Quick Wins
- MUST be conceptually larger and more strategic

### 1) executiveSummaryNarrative:

- MINIMUM 4 paragraphs, each 3-5 sentences
- Paragraph 1: Current state analysis - reference specific scores and issues from IA
- Paragraph 2: Key strengths to leverage - build on what's working
- Paragraph 3: Critical gaps and opportunities - focus on highest-impact issues
- Paragraph 4: Strategic direction for next 90 days - the main theme and expected outcomes
- Tone: Advisory, confident, accessible
- Reference specific findings from the IA (scores, dimension issues, quick wins)
- Do NOT simply copy IA text - expand it with strategic context
- MUST discuss all five pillars with Digital Footprint as dominant theme
- Use third-person voice only

### 2) strategicInitiatives:

- Provide EXACTLY 6-10 initiatives (aim for 8-10 for completeness)
- Each initiative MUST include:
  - Title: Clear, project-level name (e.g., "Build Conversion Architecture System", "Launch Content Marketing Engine")
  - Description: MINIMUM 4-7 sentences covering:
    - What the multi-step program involves
    - Why it matters (business impact: traffic, conversion, trust, clarity)
    - How it connects to IA findings and scorecard weaknesses
    - What success looks like
    - How it differs from Quick Wins (which are tactical one-offs)
  - Dimension: The primary area this addresses (brand | content | seo | website | digitalFootprint | overall)
  - Expected impact: high/medium/low based on IA scores and issues
  - Timeframe: short (0-30 days), medium (30-60 days), long (60-90 days)

CRITICAL: Strategic Initiatives vs Quick Wins
- Quick Wins = individual tasks (e.g., "Add H1 tag to homepage")
- Strategic Initiatives = comprehensive programs (e.g., "Implement SEO Foundation Program" which includes keyword research, on-page optimization across all pages, content planning, technical SEO fixes, and monitoring)
- DO NOT simply rewrite Quick Wins as initiatives
- DO group related improvements into larger strategic themes
- Examples: "Create Brand Differentiation Framework", "Build Trust and Authority System", "Develop Lead Capture Architecture"
- Prioritize based on IA scores and issues
- At least 50-60% should address Digital Footprint when gaps exist

**Digital Footprint Strategic Initiative Examples:**

For local businesses with missing GBP:
- Title: "Establish Local Search Presence Foundation"
- Description: "Set up and optimize Google Business Profile with complete business information, photos, services, and operating hours. Implement a systematic review generation process to build social proof and improve local search rankings. Monitor GBP insights to track views, clicks, and direction requests. This is critical for local visibility - without a GBP, the business is invisible in Google Maps and local pack results, missing the majority of local search traffic. Success means appearing in local pack for key service searches and generating 20+ reviews within 90 days."

For B2B companies with missing LinkedIn:
- Title: "Build LinkedIn Thought Leadership Engine"
- Description: "Establish LinkedIn Company Page with complete profile information and begin consistent thought leadership posting (2-3x per week). Develop content calendar focused on industry insights, customer success stories, and educational content. Encourage employee advocacy and engagement. For B2B companies, LinkedIn is the primary channel for building credibility, reaching decision-makers, and establishing authority. Success means growing to 500+ followers and generating consistent engagement (likes, comments, shares) within 90 days."

For B2C brands with weak social:
- Title: "Activate Multi-Platform Social Media Presence"
- Description: "Launch coordinated social media presence on Instagram and Facebook with brand-aligned visual identity. Develop content strategy mixing product showcases, behind-the-scenes content, user-generated content, and lifestyle imagery. Establish consistent posting cadence (3-5x per week) and community management practices. For B2C brands, social presence is essential for brand awareness, community building, and customer acquisition. Success means building initial audience of 1,000+ followers and establishing engagement baseline within 90 days."

### 3) ninetyDayPlan:

- MUST generate ALL 3 phases: 0-30 days, 30-60 days, 60-90 days
- For each phase provide:
  - Focus: 1 sentence thematic description (e.g., "Stabilize foundations and execute quick wins")
  - Actions: MINIMUM 4-6 concrete items (each 1 sentence)
    - Reference specific strategic initiatives by name
    - Be extremely specific (not just "improve SEO" but "Complete keyword research for top 10 service pages and optimize title tags and H1s")
    - Actions should advance the strategic initiatives
  - Business rationale: 3-5 sentences explaining why this phase matters and what business outcomes to expect
- Phase themes:
  - 0-30 days: Stabilization — fix critical gaps, execute quick wins, establish tracking
  - 30-60 days: Optimization — build on foundations, refine key systems, improve conversion paths
  - 60-90 days: Expansion — scale what's working, launch new programs, expand reach
- All actions must tie to IA insights and scorecard weaknesses
- NO EMPTY PHASES ALLOWED
- Integrate digital footprint actions throughout

**Digital Footprint Actions in 90-Day Plan:**

Phase 1 (0-30 days) examples:
- "Claim and fully set up Google Business Profile with complete business info, photos, and services"
- "Create LinkedIn Company Page and complete all profile sections"
- "Audit existing social media profiles and update branding, bios, and profile images"
- "Set up review monitoring for Google, Yelp, and industry-specific platforms"

Phase 2 (30-60 days) examples:
- "Launch consistent LinkedIn posting cadence (2-3x per week) with thought leadership content"
- "Implement review generation system and begin outreach to satisfied customers"
- "Begin Instagram content calendar with 3-5 posts per week"
- "Optimize GBP with regular posts, Q&A, and service updates"

Phase 3 (60-90 days) examples:
- "Scale social content production and test different content formats"
- "Launch employee advocacy program to amplify LinkedIn reach"
- "Expand to additional social platforms based on performance"
- "Build review response workflow and reputation management process"

### 4) kpisToWatch:

- Provide EXACTLY 6-8 KPIs
- For each KPI include:
  - Name: The metric name (e.g., "Organic Search Traffic", "Homepage Conversion Rate")
  - Description: Define what it measures (1-2 sentences)
  - Why it matters: Connect to SPECIFIC IA issues and business impact (2-3 sentences, reference scorecard weaknesses)
  - What good looks like: Provide directional expectation or benchmark (e.g., "For B2B SaaS, 2-3% homepage conversion is healthy; 5%+ is excellent. Currently unclear if conversion is tracked.")
- Choose metrics that directly track progress on the strategic initiatives
- Cover all dimensions: brand awareness, content engagement, SEO visibility, website conversion, digital footprint, authority
- Tie each KPI to a specific weakness or opportunity from the IA

**Digital Footprint KPI Examples:**

For local businesses:
- Name: "Google Business Profile Views"
- Description: "Number of times the GBP listing appears in search and maps results, indicating local visibility"
- Why it matters: "With no GBP currently, the business is invisible in local search. This metric tracks progress in capturing local search demand and appearing for location-based queries."
- What good looks like: "For local service businesses, 500-1,000 monthly views is a good baseline; 2,000+ indicates strong local presence. Start by establishing presence and tracking the baseline."

For B2B companies:
- Name: "LinkedIn Follower Growth Rate"
- Description: "Net new followers gained on LinkedIn Company Page, indicating brand awareness and audience building"
- Why it matters: "LinkedIn is the primary channel for B2B credibility and thought leadership. Currently no company page exists, representing a critical visibility gap for reaching decision-makers."
- What good looks like: "Early-stage B2B companies should target 50-100 new followers monthly with consistent posting. 200+ monthly growth indicates strong content resonance and employee advocacy."

For B2C brands:
- Name: "Social Media Engagement Rate"
- Description: "Total engagements (likes, comments, shares) divided by follower count, measuring content resonance"
- Why it matters: "Social presence is minimal, limiting brand awareness and community building. This metric indicates whether content is resonating with the target audience."
- What good looks like: "Healthy engagement rates are 1-3% for Instagram, 0.5-1% for Facebook. Below 0.5% suggests content or audience mismatch; above 3% indicates strong brand affinity."

For service businesses:
- Name: "Review Count and Average Rating"
- Description: "Total number of reviews and average star rating across Google, Yelp, and industry platforms"
- Why it matters: "Reviews are critical trust signals that influence buying decisions. Currently limited review presence means missing social proof that drives conversions."
- What good looks like: "Service businesses should target 20+ reviews with 4.0+ average rating as baseline credibility. 50+ reviews with 4.5+ rating provides strong competitive advantage."

════════════════════════════════════════════
STRICT RULES — FINAL CHECKLIST
════════════════════════════════════════════

✓ Strategic Initiatives MUST be multi-step programs, NOT Quick Wins rewrites
✓ Do NOT repeat IA text verbatim — expand it with strategic context
✓ Do NOT repeat Quick Wins in Strategic Initiatives
✓ The plan must be 2-3x more detailed than the IA
✓ ALL sections must be fully populated (no empty arrays, no missing fields)
✓ Executive summary: 4+ paragraphs, 3-6 sentences each
✓ Strategic Initiatives: 6-10 items, 4-7 sentences each
✓ Strategic Initiatives: At least 50-60% should address Digital Footprint when gaps exist
✓ 90-Day Plan: ALL 3 phases, 4-6 actions each, business rationale included
✓ 90-Day Plan: Digital footprint actions integrated throughout all phases
✓ KPIs: 6-8 items, all 4 fields populated for each
✓ KPIs: Include digital footprint metrics when relevant to business type
✓ Do NOT invent new scores or contradict IA findings
✓ Output VALID JSON only - no markdown, no text outside JSON
✓ Every section should feel like a $5,000+ consulting deliverable
✓ Use third-person language throughout (no "you"/"your")
`;
