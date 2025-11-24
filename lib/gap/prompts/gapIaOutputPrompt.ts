// lib/gap/prompts/gapIaOutputPrompt.ts
/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 *
 * This is the V2 GAP Initial Assessment Output Prompt
 *
 * LEGACY STATUS: This prompt is deprecated and should NOT be used in any new code
 *
 * USE INSTEAD: GAP_IA_OUTPUT_PROMPT_V3 from @/lib/gap/prompts/gapIaOutputPromptV3
 *
 * This file is kept for historical reference only.
 * All active GAP-IA execution paths now use V3 prompt + InitialAssessmentOutput schema.
 *
 * Last used: Prior to 2025-11-22
 * Replaced by: V3 prompt + InitialAssessmentOutputSchema + mapInitialAssessmentToApiResponse
 */

export const GAP_IA_OUTPUT_PROMPT = `
════════════════════════════════════════════
🚨 CRITICAL REQUIREMENT - DIGITAL FOOTPRINT 🚨
════════════════════════════════════════════

**YOU WILL RECEIVE DIGITAL FOOTPRINT SIGNALS** (GBP, LinkedIn, Instagram, Facebook, YouTube presence).

**YOU MUST ANALYZE DIGITAL FOOTPRINT IN YOUR NARRATIVE** - This is NOT optional:

1. In the **"narrative"** field under **"summary"** → You MUST mention digital footprint gaps if they exist
   - Example for missing LinkedIn (B2B): "The absence of a LinkedIn company presence limits professional credibility and thought leadership visibility."
   - Example for missing GBP (local): "Without a Google Business Profile, the business is invisible in local search and Google Maps."

2. In the **"topOpportunities"** array → MUST include 1-2 digital footprint items if gaps exist

3. In dimension **"narrative"** fields (brand, content, seo) → MUST discuss digital footprint as relevant

**VALIDATION:** If digitalFootprint shows missing LinkedIn for b2b_saas/b2b_services OR missing GBP for local_business, your "narrative" field MUST explicitly mention this gap. If it doesn't, you have FAILED the task.

### MANDATORY Digital Footprint Analysis Requirements

**CRITICAL:** Digital footprint analysis is REQUIRED in your output. You MUST address digital footprint in multiple sections:

✅ **Executive Summary & Narrative** → MUST mention digital footprint strength or gaps
✅ **Top Opportunities** → MUST include 1-2 digital footprint opportunities if gaps exist
✅ **Quick Wins** → MUST include digital footprint quick wins when applicable:
   - Missing GBP for local/service business → "Claim and optimize Google Business Profile"
   - Missing LinkedIn for B2B → "Set up and optimize LinkedIn Company Page"
   - Weak social for B2C → "Establish brand presence on Instagram/Facebook"
✅ **Dimension Narratives:**
   - Brand & Positioning → MUST discuss LinkedIn/social presence as brand authority signals
   - Content & Messaging → MUST discuss social posting/content distribution if weak
   - SEO & Visibility → MUST discuss GBP, social profiles as visibility channels

**OUTPUT VALIDATION - You will FAIL the task if:**
❌ You do NOT mention digital footprint in Executive Summary when GBP/LinkedIn/social gaps exist
❌ You ignore missing GBP for a local_business or b2c_services company
❌ You ignore missing/weak LinkedIn for a b2b_saas or b2b_services company
❌ Top Opportunities contains ONLY website fixes when digital footprint is weak
❌ Quick Wins contains ONLY HTML/CTA fixes when GBP or LinkedIn are missing

**EXAMPLES OF REQUIRED OUTPUT:**

If digitalFootprint.gbp.found = false AND companyType = "local_business":
→ Executive Summary MUST say: "The absence of a Google Business Profile is a critical visibility gap for a local business."
→ Top Opportunities MUST include: "Claim and optimize Google Business Profile to appear in local search and Google Maps"
→ Quick Wins MUST include GBP setup

If digitalFootprint.linkedin.found = false AND companyType = "b2b_saas":
→ Executive Summary MUST say: "Missing LinkedIn company presence limits B2B brand credibility and thought leadership opportunities."
→ Top Opportunities MUST include: "Establish LinkedIn Company Page and begin consistent posting"
→ Brand narrative MUST discuss LinkedIn as essential for B2B trust

════════════════════════════════════════════
🆕 MULTI-PAGE SNAPSHOT DATA
════════════════════════════════════════════

**YOU WILL RECEIVE A multiPageSnapshot OBJECT** containing:

1. **homepage**: Snippet of the homepage HTML/content
2. **discoveredPages**: Up to 3-5 additional internal pages (blog, resources, pricing, services, case studies) with short snippets
3. **contentSignals**: Metadata including:
   - blogFound: boolean (true if blog/article pages discovered)
   - blogUrlsFound: number (count of blog URLs found)
   - pricingFound: boolean (true if pricing page discovered)
   - resourcePagesFound: number (count of resource/guide pages)
   - caseStudyPagesFound: number (count of case study pages)

**YOU MUST USE THIS INFORMATION WHEN EVALUATING:**

✅ **Content & Messaging Dimension:**
   - If multiPageSnapshot.contentSignals.blogFound = true → Narrative MUST mention the blog and evaluate its role (depth, relevance, consistency)
   - If multiPageSnapshot.contentSignals.resourcePagesFound > 0 → Discuss resource depth and value
   - If multiPageSnapshot.contentSignals.blogFound = false → Score content lower and mention missing blog in issues

✅ **SEO & Visibility Dimension:**
   - If blog/resources exist → Acknowledge topic coverage and content ecosystem
   - Mention pricing page transparency if found

✅ **Website & Conversion Dimension:**
   - If multiPageSnapshot.contentSignals.pricingFound = true → Narrative MUST discuss pricing transparency and friction
   - If multiPageSnapshot.contentSignals.pricingFound = false for SaaS/services → Flag as an issue

✅ **Digital Footprint & Authority Dimension:**
   - Use discovered pages to assess content ecosystem maturity
   - Blog + resources + case studies = stronger authority signal

**HARD RULES:**
❌ Do NOT infer "no blog" if multiPageSnapshot.contentSignals.blogFound = false - explicitly state it as a gap
❌ Do NOT infer "no pricing" if multiPageSnapshot.contentSignals.pricingFound = false - flag it when relevant
❌ Do NOT ignore discovered pages in your analysis - they provide critical content depth signals

**EXAMPLES:**

If multiPageSnapshot.contentSignals.blogFound = true AND blogUrlsFound >= 1:
→ Content narrative MUST say: "The company maintains a blog/insights section, indicating some content marketing investment."
→ Content score should reflect blog presence (minimum +10 points vs. no blog)

If multiPageSnapshot.contentSignals.pricingFound = false AND companyType = "b2b_saas":
→ Website narrative MUST mention: "Missing pricing page creates friction in the buyer journey."
→ Website issues MUST include pricing transparency

If multiPageSnapshot.contentSignals.resourcePagesFound >= 2:
→ Content narrative: "Resource library with guides/whitepapers demonstrates thought leadership."
→ Authority score should reflect educational content depth

════════════════════════════════════════════
OUTPUT FORMAT (IMPORTANT)
════════════════════════════════════════════

You MUST output only valid JSON following this structure:

{
  "summary": {
    "overallScore": number,
    "maturityStage": "early" | "developing" | "advanced",
    "headlineDiagnosis": string,
    "narrative": string,
    "topOpportunities": [string]
  },
  "dimensions": {
    // 🔒 CRITICAL: ALL SIX dimensions must be present - brand, content, seo, website, digitalFootprint, authority
    // Do NOT omit any dimension. If signals are weak, use low scores with honest narratives.

    "brand": {
      "score": number,
      "label": "Brand & Positioning",
      "oneLiner": string,
      "issues": [string],
      "narrative": string
    },
    "content": {
      "score": number,
      "label": "Content & Messaging",
      "oneLiner": string,
      "issues": [string],
      "narrative": string
    },
    "seo": {
      "score": number,
      "label": "SEO & Visibility",
      "oneLiner": string,
      "issues": [string],
      "narrative": string
    },
    "website": {
      "score": number,
      "label": "Website & Conversion",
      "oneLiner": string,
      "issues": [string],
      "narrative": string
    },
    "digitalFootprint": {
      "score": number,
      "label": "Digital Footprint",
      "oneLiner": string,
      "issues": [string],
      "narrative": string,
      "subscores": {
        "googleBusinessProfile": number (0-100),
        "linkedinPresence": number (0-100),
        "socialPresence": number (0-100),
        "reviewsReputation": number (0-100)
      }
    },
    "authority": {
      "score": number,
      "label": "Authority & Trust",
      "oneLiner": string,
      "issues": [string],
      "narrative": string,
      "subscores": {
        "domainAuthority": number (0-100),
        "backlinks": number (0-100),
        "brandSearchDemand": number (0-100),
        "industryRecognition": number (0-100)
      }
    }
  },
  "breakdown": {
    "bullets": [{
      "category": string,
      "statement": string,
      "impactLevel": "low" | "medium" | "high"
    }]
  },
  "quickWins": {
    "bullets": [{
      "category": string,
      "action": string,
      "expectedImpact": "low" | "medium" | "high",
      "effortLevel": "low" | "medium"
    }]
  },
  "core": {
    "url": string,
    "domain": string,
    "brandTier": "global_category_leader" | "enterprise" | "mid_market" | "smb" | "startup" | "local_business" | "nonprofit" | "other",
    "companyType": "b2b_saas" | "b2c_saas" | "b2b_services" | "b2c_services" | "marketplace" | "ecommerce" | "brick_and_mortar" | "media_publisher" | "nonprofit" | "platform_infrastructure" | "other",
    "overallScore": number,
    "marketingMaturity": "early" | "developing" | "advanced",
    "brand": { /* brand context */ },
    "content": { /* content context */ },
    "seo": { /* seo context */ },
    "website": { /* website context */ },
    "digitalFootprint": { /* optional digital footprint context */ },
    "quickSummary": string,  // REQUIRED: 2-3 sentence executive summary
    "topOpportunities": [string]  // REQUIRED: 3-5 high-leverage opportunities
  },
  "insights": {
    "overallSummary": string,  // REQUIRED
    "brandInsights": [string],
    "contentInsights": [string],
    "seoInsights": [string],
    "websiteInsights": [string]
  }
}

════════════════════════════════════════════
FIELD-BY-FIELD REQUIREMENTS
════════════════════════════════════════════

### REQUIRED CLASSIFICATION OUTPUT

You MUST explicitly classify each company into these two required fields in your JSON output:

**"brandTier"** - REQUIRED, must be one of:
  - "global_category_leader" (Apple, HubSpot, Salesforce, Starbucks, Nike, Google, Microsoft, Shopify, Stripe, OpenAI, etc.)
  - "enterprise" (Large established companies with significant market presence)
  - "mid_market" (Well-established mid-sized companies)
  - "smb" (Small-to-medium businesses)
  - "startup" (Early-stage companies, lean marketing)
  - "local_business" (Local gyms, restaurants, single/few locations)
  - "nonprofit" (Non-profit organizations)
  - "other" (Only if truly doesn't fit above)

**"companyType"** - REQUIRED, must be one of:
  - "b2b_saas" (Software selling to businesses)
  - "b2c_saas" (Software selling to consumers)
  - "b2b_services" (Professional services to businesses)
  - "b2c_services" (Services to consumers)
  - "marketplace" (Platforms connecting buyers/sellers)
  - "ecommerce" (Online retail of physical products)
  - "brick_and_mortar" (Physical retail with online presence)
  - "media_publisher" (Content publishers, news, blogs)
  - "nonprofit" (Non-profit organizations)
  - "platform_infrastructure" (Developer tools, APIs, infrastructure)
  - "other" (Only if truly doesn't fit above)

**CRITICAL:** You MUST set these two fields in the "core" object of your JSON output. They are REQUIRED and must be consistent with your reasoning about the company.

**Examples:**
- Apple.com → brandTier: "global_category_leader", companyType: "platform_infrastructure"
- HubSpot.com → brandTier: "global_category_leader", companyType: "b2b_saas"
- Starbucks.com → brandTier: "global_category_leader", companyType: "brick_and_mortar"
- Local gym → brandTier: "local_business", companyType: "b2c_services"
- Early-stage marketplace → brandTier: "startup", companyType: "marketplace"

### Summary Object

**overallScore** (number):
- Must reflect the weighted formula: 0.15×brand + 0.15×content + 0.10×seo + 0.10×website + 0.30×digitalFootprint + 0.20×authority
- Apply brand tier floors (see calibration rules)
- Range: 0-100

**maturityStage** (string):
- "early" - Marketing foundation is nascent, many basic gaps
- "developing" - Core elements in place but inconsistent execution
- "advanced" - Sophisticated marketing operation with strategic execution

**headlineDiagnosis** (string):
- One crisp sentence that captures the overall state
- Examples:
  - "Strong brand presence but minimal content depth and weak digital footprint"
  - "Marketing foundation is nascent with critical gaps across all dimensions"
  - "Sophisticated marketing operation with minor optimization opportunities"

**narrative** (string):
- MINIMUM 2-4 full paragraphs
- MUST discuss all six dimensions
- MUST explicitly mention digital footprint strength or gaps
- MUST be site-specific, not generic
- Use third-person voice only
- Friendly, consultative tone

**topOpportunities** (array of strings):
- 3-5 HIGH-IMPACT opportunities
- Must lead with Digital Footprint opportunities when gaps exist
- Each should be 1-2 sentences
- Prioritize based on business type and tier
- Examples:
  - "Claim and optimize Google Business Profile to capture local search traffic and appear in Google Maps"
  - "Establish LinkedIn Company Page and begin consistent thought leadership posting to build B2B credibility"
  - "Develop comprehensive brand positioning framework to differentiate in crowded market"

### Dimensions Object

Each dimension must have:

**score** (number):
- 0-100 scale
- Apply dimension-specific floors for brand tier
- Reflect actual quality relative to tier

**label** (string):
- Use exact labels: "Brand & Positioning", "Content & Messaging", "SEO & Visibility", "Website & Conversion", "Digital Footprint", "Authority & Trust"

**oneLiner** (string):
- Brief diagnostic (8-15 words)
- Examples:
  - "Strong visual brand but unclear positioning and value prop"
  - "Minimal content depth; lacks funnel coverage and thought leadership"
  - "No Google Business Profile; missing in local search entirely"

**issues** (array of strings):
- 3-6 specific issues
- Must be contextual to this company
- Avoid generic template language
- Examples:
  - "Homepage headline doesn't communicate what the product does"
  - "No LinkedIn company page for a B2B SaaS company"
  - "Blog content is sporadic and lacks clear ICP focus"

**narrative** (string):
- MINIMUM 2-3 full paragraphs
- Explain why the issues matter for THIS company
- Connect to business outcomes
- Include examples from the actual site
- Use third-person voice

**subscores** (object) - REQUIRED for digitalFootprint and authority:
- Each subscore is 0-100
- See detailed subscore calibration in shared reasoning prompt
- Must be weighted appropriately by business type

### Breakdown Object

**bullets** (array):
- 6-10 specific findings
- Each with category, statement, impactLevel
- Cover all dimensions
- Examples:
  - category: "Brand", statement: "Homepage value proposition is unclear; doesn't explain what the product does", impactLevel: "high"
  - category: "Digital Footprint", statement: "No Google Business Profile found; invisible in local search", impactLevel: "high"

### Quick Wins Object

**bullets** (array):
- 5-8 tactical wins
- Each with category, action, expectedImpact, effortLevel
- Must span at least 4 different dimensions
- MUST include digital footprint wins when gaps exist
- Examples:
  - category: "Digital Footprint", action: "Claim and set up Google Business Profile with complete business info", expectedImpact: "high", effortLevel: "low"
  - category: "Brand", action: "Rewrite homepage H1 to clearly state what the product does and who it's for", expectedImpact: "medium", effortLevel: "low"

### Core Object (Legacy - REQUIRED for backward compatibility)

Complete CoreMarketingContext structure:
- **url** (string, required): The analyzed URL
- **domain** (string, required): The domain name
- **businessName** (string, REQUIRED): The company/business name - infer from domain, page title, branding, or content. Examples: "HubSpot", "Apple", "Queen Anne Farmers Market", "Mobile-Pack". NEVER leave this empty.
- **industry** (string, optional): Primary industry/category
- **primaryOffer** (string, optional): What the company offers
- **primaryAudience** (string, optional): Target customer segment
- **geography** (string, optional): Geographic focus
- **overallScore** (number, optional): Overall marketing score 0-100
- **marketingMaturity** (enum, optional): "early" | "developing" | "advanced"
- **marketingReadinessScore** (number, optional): 0-100
- **brandTier** (enum, optional): Classification from shared reasoning prompt
- **companyType** (enum, optional): Classification from shared reasoning prompt
- **brand** (object, required):
  - brandScore: number 0-100 (REQUIRED - must match dimensions.brand.score)
  - perceivedPositioning: string (optional)
  - toneOfVoice: string (optional)
  - visualConsistency: "low" | "medium" | "high" (optional, nullable)
- **content** (object, required):
  - contentScore: number 0-100 (REQUIRED - must match dimensions.content.score)
  - hasBlogOrResources: boolean (optional)
  - contentDepth: "shallow" | "medium" | "deep" (optional, nullable)
  - contentFocus: string (optional)
  - postingConsistency: "low" | "medium" | "high" (optional, nullable)
- **seo** (object, required):
  - seoScore: number 0-100 (REQUIRED - must match dimensions.seo.score)
  - appearsIndexable: boolean (optional, nullable)
  - onPageBasics: "ok" | "issues" (optional, nullable)
  - searchIntentFit: "weak" | "mixed" | "strong" (optional, nullable)
- **website** (object, required):
  - websiteScore: number 0-100 (REQUIRED - must match dimensions.website.score)
  - clarityOfMessage: "low" | "medium" | "high" (optional, nullable)
  - primaryCtaQuality: "weak" | "ok" | "strong" (optional, nullable)
  - perceivedFriction: "low" | "medium" | "high" (optional, nullable)
- **digitalFootprint** (object, optional):
  - footprintScore: number 0-100 (optional)
  - googleBusinessProfile: "none" | "weak" | "strong" (optional, nullable)
  - linkedinPresence: "none" | "weak" | "strong" (optional, nullable)
  - socialPresence: "none" | "weak" | "strong" (optional, nullable)
  - reviewsReputation: "none" | "weak" | "strong" (optional, nullable)
  - authoritySignals: "none" | "weak" | "strong" (optional, nullable)
  - brandSearchDemand: "low" | "medium" | "high" (optional, nullable)
- **quickSummary** (string, required): 2-3 sentence executive summary
- **topOpportunities** (array of strings, required): 3-5 high-leverage opportunities

### Insights Object (Legacy - REQUIRED for backward compatibility)

Complete insights structure:
- **overallSummary** (string, required): 2-3 paragraph narrative assessment
- **brandInsights** (array of strings, optional): 3-5 brand-specific observations
- **contentInsights** (array of strings, optional): 3-5 content-specific observations
- **seoInsights** (array of strings, optional): 3-5 SEO-specific observations
- **websiteInsights** (array of strings, optional): 3-5 website-specific observations
- **recommendedNextStep** (string, optional): Primary recommendation

════════════════════════════════════════════
🔒 JSON SCHEMA VALIDATION (MANDATORY)
════════════════════════════════════════════

Before outputting ANY JSON, you MUST validate the response against the following schema.
If the output does NOT conform exactly, you MUST regenerate internally until it does.

You MUST NOT return partial JSON.
You MUST NOT return extraneous fields.
You MUST NOT skip dimensions or subscores.

The dimensions object MUST include ALL SIX keys with complete structure:
- brand (with score, label, oneLiner, issues array, narrative)
- content (with score, label, oneLiner, issues array, narrative)
- seo (with score, label, oneLiner, issues array, narrative)
- website (with score, label, oneLiner, issues array, narrative)
- digitalFootprint (with score, label, oneLiner, issues array, narrative, AND subscores object)
- authority (with score, label, oneLiner, issues array, narrative, AND subscores object)

digitalFootprint.subscores MUST include: googleBusinessProfile, linkedinPresence, socialPresence, reviewsReputation
authority.subscores MUST include: domainAuthority, backlinks, brandSearchDemand, industryRecognition

breakdown.bullets and quickWins.bullets MUST be non-empty arrays.

════════════════════════════════════════════
🔒 MANDATORY JSON DIMENSION COMPLETENESS RULES
════════════════════════════════════════════

You MUST output **all six dimensions** in the "dimensions" object:

1. brand
2. content
3. seo
4. website
5. digitalFootprint
6. authority

These six keys are REQUIRED.
They MUST appear in the output JSON **every time**, with the correct structure.

If ANY of the six dimension objects is missing, incomplete, or renamed:

❌ The output is INVALID
❌ You MUST not "guess" or "omit"
❌ You MUST regenerate internally until all six are present

You MUST NOT compress dimensions or skip fields to save space.
You MUST NOT omit digitalFootprint or authority even when signals are weak.
Instead, provide an honest low score and narrative.

Each dimension object MUST contain:

- score (number)
- label (string)
- oneLiner (string)
- issues (array of strings)
- narrative (string)

For "digitalFootprint" and "authority", the "subscores" object is REQUIRED.

If any required field is missing:
→ Treat this as a generation error and regenerate internally
→ NEVER output partial JSON

════════════════════════════════════════════
VALIDATION CHECKLIST
════════════════════════════════════════════

You MUST fill ALL required fields.

Before submitting output, verify:

✅ Output is valid JSON only - no markdown, no text outside JSON
✅ ALL SIX dimensions are present: brand, content, seo, website, digitalFootprint, authority
✅ brandTier and companyType are set in core object
✅ businessName is set in core object (REQUIRED - infer from domain/branding)
✅ digitalFootprint has complete subscores object (googleBusinessProfile, linkedinPresence, socialPresence, reviewsReputation)
✅ authority has complete subscores object (domainAuthority, backlinks, brandSearchDemand, industryRecognition)
✅ Overall score reflects weighted formula
✅ Brand tier floors are applied correctly
✅ Executive summary narrative mentions digital footprint
✅ Top opportunities include digital footprint when gaps exist
✅ Quick wins include digital footprint when applicable
✅ breakdown.bullets is a non-empty array
✅ quickWins.bullets is a non-empty array
✅ All narratives use third-person voice (no "you"/"your")
✅ All narratives are 2+ paragraphs, site-specific, not generic
✅ Issues and opportunities are unique to this company
✅ Digital footprint is discussed in at least 30-40% of total output

🚨 CRITICAL: CORE OBJECT DIMENSION SCORES ARE REQUIRED 🚨

**YOU MUST POPULATE DIMENSION SCORES IN BOTH LOCATIONS:**

1. dimensions.brand.score → MUST have a value (0-100)
2. core.brand.brandScore → MUST match dimensions.brand.score exactly
3. dimensions.content.score → MUST have a value (0-100)
4. core.content.contentScore → MUST match dimensions.content.score exactly
5. dimensions.seo.score → MUST have a value (0-100)
6. core.seo.seoScore → MUST match dimensions.seo.score exactly
7. dimensions.website.score → MUST have a value (0-100)
8. core.website.websiteScore → MUST match dimensions.website.score exactly

**DO NOT GENERATE EMPTY CORE DIMENSION OBJECTS**
❌ WRONG: "brand": {}
✅ CORRECT: "brand": { "brandScore": 45, "perceivedPositioning": "...", ... }

If you generate empty core dimension objects like {"brand": {}}, you will FAIL validation and cause data corruption.
`;
