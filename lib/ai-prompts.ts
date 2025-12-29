/**
 * AI Prompts for the comprehensive rubric-based scoring system
 */

export const OVERALL_SCORE_SUMMARY_PROMPT = `You are generating a concise, analytical summary explaining *why the business received its Overall Marketing Score*.

Inputs you will receive:
- overall_score (0–100)
- pillar_scores: an array of { name, score }
- top_strengths: an array of evidence-based strengths
- top_gaps: an array of evidence-based weaknesses

Your task:
Produce a 3–5 sentence summary that explains the score using an objective, consulting-style tone.

Rules:
- Focus on the biggest factors influencing the score (both positive and negative).
- Reference patterns across pillars (ex: "Strong technical health but underdeveloped content depth creates imbalance.").
- Highlight the most influential strengths AND most influential weaknesses.
- DO NOT offer recommendations here.
- DO NOT repeat the pillar names mechanically.
- DO NOT use marketing language. Stay analytical and matter-of-fact.
- DO NOT exceed 120 words.

Output format (JSON):
{
  "summary": "string"
}

Example structure:
"The overall score reflects strong technical foundations and clear messaging, but limited content depth and weak trust indicators significantly reduce performance. SEO fundamentals are in place, though missing metadata and internal linking limit organic potential. While the website performs well visually, a lack of reviews and social proof reduces conversion readiness. Together, these factors place the business in its current maturity stage."

Generate the summary now based on the provided inputs.`;

export const EXTRACTION_PROMPT = `Extract observable facts from the website HTML and screenshots. Return JSON only.

You will receive:
1. Primary HTML content
2. Screenshot A (above-the-fold) - analyze this image
3. Screenshot B (mid-page) - analyze this image
4. Metadata (URL, title, description)
5. Optional backend enrichment (DNS, social scrape, review scrape)

Schema:

{
  "url": "",
  "company_name": "(extract the company/brand name from title tag, h1, logo alt text, or site header. Examples: 'Starbucks', 'Portage Bank', 'O3 Industries'. If title is 'Starbucks Coffee Company | Official Site', extract 'Starbucks Coffee Company'. If title is 'Home - Portage Bank', extract 'Portage Bank')",
  "meta": { "title": "", "description": "" },
  "hero_section": {
    "headline_text": "",
    "subheadline_text": "",
    "cta_buttons": [],
    "hero_image_description": "(describe what you see in screenshot A)"
  },
  "navigation": {
    "primary_nav_items": [],
    "secondary_nav_items": []
  },
  "sections": [
    {
      "type": "",
      "heading": "",
      "subheading": "",
      "body_text": "",
      "cta_buttons": [],
      "trust_indicators": [],
      "visual_description": ""
    }
  ],
  "all_headings": [],
  "all_ctas": [],
  "trust_signals": {
    "logos_visible": [],
    "testimonials_visible": [],
    "review_counts_visible": "",
    "awards_visible": []
  },
  "value_props": [],
  "content_depth_indicators": {
    "feature_lists": [],
    "benefit_lists": [],
    "case_study_snippets": [],
    "faq_present": false,
    "blog_content": {
      "blog_section_detected": false,
      "blog_link_in_nav": false,
      "blog_urls_found": [],
      "blog_post_count_estimate": 0,
      "blog_categories": [],
      "recent_blog_topics": [],
      "blog_content_quality": "",
      "blog_posts": [
        {
          "url": "",
          "title": "",
          "publish_date": "",
          "category": "",
          "tags": []
        }
      ],
      "posting_frequency": "",
      "recency": "",
      "internal_linking_patterns": []
    }
  },
  "blogAnalysis": {
    "postCount": 0,
    "latestPostDate": "",
    "postingFrequency": "",
    "topics": [],
    "hasInternalLinksToCorePages": false,
    "notes": ""
  },
  "seo_elements": {
    "h1": "",
    "h2_list": [],
    "h3_list": [],
    "schema_detected": [],
    "internal_links_detected": []
  },
  "design_and_layout": {
    "visual_hierarchy_notes": "",
    "cta_visibility_notes": "",
    "readability_notes": ""
  },
  "tech_stack": {},
  "analytics_analysis": {
    "ga4_detected": false,
    "gtm_detected": false,
    "meta_pixel_detected": false,
    "hubspot_detected": false,
    "mixpanel_detected": false,
    "hotjar_detected": false,
    "amplitude_detected": false,
    "analytics_tools_found": [],
    "analytics_correctness": "",
    "analytics_completeness": ""
  },
  "analyticsAnalysis": {
    "ga4Detected": false,
    "gtmDetected": false,
    "metaPixelDetected": false,
    "hotjarDetected": false,
    "mixpanelOrAmplitudeDetected": false,
    "summary": ""
  },
  "social": {
    "platform_presence": [],
    "posting_frequency": "",
    "recent_activity": "",
    "engagement": "",
    "linkedin_analysis": {
      "company_page_found": false,
      "follower_count": 0,
      "posting_frequency": "",
      "latest_post_date": "",
      "latest_post_text": "",
      "activity_level": ""
    },
    "gbp_analysis": {
      "listing_found": false,
      "review_count": 0,
      "rating": 0,
      "review_recency": "",
      "latest_review_date": ""
    }
  },
  "brandAuthority": {
    "linkedin": {
      "url": "",
      "followers": null,
      "postingFrequency": null,
      "latestPostDate": null,
      "summary": ""
    },
    "gbp": {
      "url": "",
      "reviewCount": null,
      "rating": null,
      "latestReviewDate": null,
      "summary": ""
    }
  },
  "review_footprint": {},
  "external_profiles": {
    "linkedin_raw": "",
    "gbp_raw": ""
  },
  "screenshots": {
    "above_fold_description": "(describe key UI elements, layout, visual hierarchy, CTA visibility, trust signals visible in screenshot A)",
    "mid_page_description": "(describe content sections, structure, visual flow, additional CTAs, trust indicators visible in screenshot B)"
  }
}

Rules: 
- Facts only. If unsure, leave empty. 
- Analyze screenshots carefully for visual elements.
- CRITICAL BLOG ANALYSIS: Use the blogAnalysis object from extraction if present (this comes from browser-based detection and is highly accurate). If blogAnalysis.postCount > 0, use those exact numbers. Otherwise, look for blog/news section. Check navigation for "Blog", "Articles", "Resources", "News" links. Look for URLs containing /blog, /news, /insights, /resources. Check the "BLOG/ARTICLE URLs DETECTED" section in the HTML hint if present. Extract blog post URLs, titles, publish dates, categories/tags. Estimate total postCount. Determine postingFrequency (e.g., "1-2 posts per month", "Quarterly", "No recent posts"). Assess latestPostDate (when was last post). Extract topics array from titles/categories. Check if posts link back to main product/service pages (hasInternalLinksToCorePages). Populate blogAnalysis object with postCount, latestPostDate, postingFrequency, topics, hasInternalLinksToCorePages, and notes (brief summary). IMPORTANT: If blogAnalysis.postCount exists and is > 0, trust that number over any estimates from HTML text alone (browser detection is more accurate for JS-rendered sites).
- CRITICAL ANALYTICS DETECTION: Scan HTML for analytics scripts. Detect GA4 (gtag('config', or GA4 script pattern), GTM (googletagmanager.com/gtm.js or GTM-), MetaPixel (connect.facebook.net and fbq('init')), Hotjar (static.hotjar.com / hjsv=), Mixpanel/Amplitude (known script URLs / globals). Populate analyticsAnalysis object with ga4Detected, gtmDetected, metaPixelDetected, hotjarDetected, mixpanelOrAmplitudeDetected (true if either Mixpanel OR Amplitude detected), and summary (brief explanation of what was found).
- CRITICAL LINKEDIN DETECTION: FIRST check the "LINKEDIN COMPANY PAGE URLs DETECTED" section in the HTML hint - if URLs are listed there, use the first URL found. Also search footer links, navigation, and all anchor tags for links containing "linkedin.com/company" or "linkedin.com/company/". Look for social media icons or links with text containing "LinkedIn". If a LinkedIn URL is found, populate brandAuthority.linkedin.url with the full URL. If no URL is found in HTML, set url to empty string and other fields to null. Note: You cannot extract follower count or posting frequency from just the website HTML - these fields should remain null unless explicitly provided in the metadata.
- CRITICAL GBP DETECTION: FIRST check the "GOOGLE BUSINESS PROFILE URLs DETECTED" section in the HTML hint - if URLs are listed there, use the first URL found. Also search footer links, navigation, and all anchor tags for links containing "google.com/maps", "g.page", "google.com/business", or "maps.google.com". Look for embedded Google Maps widgets, review widgets, or links with text containing "Google", "Maps", "Reviews", or "Business Profile". If a GBP URL is found, populate brandAuthority.gbp.url with the full URL. If no URL is found in HTML, set url to empty string and other fields to null. Note: You cannot extract review count, rating, or review dates from just the website HTML - these fields should remain null unless explicitly provided in the metadata.
- Return JSON only.`;

export const SCORING_PROMPT = `You are a rigorous scoring engine. Score websites with REAL variation based on actual evidence.

CRITICAL: Avoid clustering scores between 50-70. Use the full 0-100 range based on actual evidence quality.

Input: 
1. Extraction JSON (with actual website content)
2. Rubric (complete pillar + subpillar structure)

Output:
Return a JSON Scorecard:

{
  "overallScore": 0-100,
  "maturityStage": "",
  "pillars": [
    {
      "id": "",
      "score": 0-100,
      "weightedScore": 0-100,
      "subpillarScores": [
        { "id": "", "score": 0-100, "notes": "specific evidence from extraction" }
      ],
      "notes": "brief explanation of score"
    }
  ]
}

BRAND STRENGTH & CALIBRATION

If brand strength classification is provided, use it to calibrate scores appropriately:

**Global Iconic Brands** (brand_strength = "global_iconic" and confidence ≥ 0.8):
- Branding score MUST be between 9-10 (90-100). These brands have exceptional brand equity and visual identity.
- Content quality score MUST be between 8-10 (80-100). Minimal content is often an intentional design choice for premium brands. Do NOT penalize luxury minimalism or storytelling-first design.
- SEO score should realistically be between 7-9 (70-90). They may not rely heavily on blog SEO but have strong technical/brand search presence.
- Conversion score should be between 6-9 (60-90) and must NOT be penalized for:
  - Storytelling-first design
  - Light CTA usage (premium brands often use subtle CTAs)
  - Luxury minimalism
  - When these patterns clearly match a premium brand aesthetic
- Performance score can still range 4-10 (40-100) - heavy imagery and animations are allowed for premium brands.

**Major Established Brands** (brand_strength = "major_established"):
- Branding: 8-10 (80-100) when visual identity is consistent and professional.
- Content: 7-9 (70-90) if content is clear, on-brand, and covers key user journeys.
- SEO: Evaluate with normal expectations for a mature company (3-9 / 30-90).
- Conversion: Score based on clarity of CTAs, funnels, and friction (normal range 0-100).

**Others** (mid_market, early_stage_startup, small_local_business):
- Use the normal 1-10 (0-100) rubric without forced minimums.
- Penalize messy branding, thin content, poor SEO, or weak conversion flows as appropriate.

**Important Calibration Rules:**
- For global_iconic and major_established brands, do NOT treat luxury minimalism, sparse CTAs, or heavy visual storytelling as mistakes. These patterns are often intentional.
- Minimal copy and whitespace are not weaknesses by default for premium brands.
- Lack of blog content does NOT automatically mean low SEO for dominant brands; consider authority and navigational/technical SEO.
- When in doubt, err on the side of recognizing intentional design choices for established brands.

EXPLICIT SCORING BANDS (use these ranges strictly, adjusted by brand strength above):

0-20 = Broken / missing / actively harmful
- No evidence found OR evidence is actively bad
- Missing critical elements (no headline, no CTAs, broken functionality)
- Examples: No blog posts found → blog_volume scores 0-20. No analytics detected → analytics_presence scores 0-20. No LinkedIn URL found → linkedin_presence scores 0-20.

21-40 = Weak / below expectations
- Evidence exists but is minimal, generic, or poorly executed
- Present but not meeting basic standards
- Examples: Generic headline like "Welcome" → score 21-40. Blog exists but only 2-3 posts → blog_volume scores 21-40. Analytics present but only basic GA4 → analytics_completeness scores 21-40.

41-60 = Basic / meets minimum expectations only
- Evidence exists and meets basic requirements, but nothing more
- Functional but not impressive
- Examples: Clear headline but not benefit-driven → score 41-60. Blog has 10-20 posts but infrequent updates → blog_frequency scores 41-60. Has GA4 and GTM but no advanced tools → analytics_completeness scores 41-60.

61-80 = Strong / clearly above basic, consistently executed
- Clear, repeated evidence of quality implementation
- Multiple strong signals, consistent execution
- Examples: Specific, benefit-driven headline → score 61-80. Blog has 50+ posts with regular updates → blog_frequency scores 61-80. Multiple analytics tools properly configured → analytics_completeness scores 61-80.

81-100 = Best-in-class / rare, exemplary performance
- Exceptional quality, rare excellence
- Clearly superior to typical companies in this category
- Examples: Highly differentiated, emotional headline → score 81-100. Blog has 100+ posts, daily updates, excellent internal linking → blog_frequency scores 81-100. Comprehensive analytics stack with advanced tools → analytics_completeness scores 81-100.

CRITICAL RULES:

1. AVOID CLUSTERING SCORES BETWEEN 50-70. Spread scores across the full range. Use the entire 0-100 spectrum based on actual evidence quality.

2. If evidence is missing or extremely weak, score 0-20, NOT 40-60.
   - No blog posts found (blogAnalysis.postCount === 0 or blogAnalysis is null/undefined) → blog_volume = 0-20
   - No analytics detected → analytics_presence = 0-20
   - No LinkedIn URL found → linkedin_presence = 0-20
   - No GBP URL found → gbp_review_count = 0-20
   - No testimonials visible → review_footprint = 0-20

3. If implementation is present but underdeveloped, score 21-40.
   - Blog exists but only 1-5 posts (blogAnalysis.postCount 1-5) → blog_volume = 21-40
   - Analytics detected but incorrectly configured → analytics_correctness = 21-40
   - LinkedIn URL found but no activity data → linkedin_activity = 21-40

4. Use 41-60 only when something meets basic expectations but is not strong.
   - Blog has 6-20 posts (blogAnalysis.postCount 6-20) → blog_volume = 41-60
   - Basic analytics setup (GA4 only) → analytics_completeness = 41-60

5. Use 61-80 only when there is clear, repeated evidence of strength.
   - Blog has 21-50+ posts with regular updates (blogAnalysis.postCount 21-50+) → blog_volume = 61-80
   - Multiple analytics tools properly configured → analytics_completeness = 61-80
   - Strong, specific value props → messaging = 61-80

6. Use 81-100 only when there is clear, repeated evidence of excellence compared to typical companies.
   - Blog has 50+ posts, frequent updates, excellent SEO (blogAnalysis.postCount 50+) → blog_volume = 81-100
   - Comprehensive analytics stack with advanced tools → analytics_completeness = 81-100
   - Exceptional, differentiated messaging → messaging = 81-100

SCORING PROCESS:

- Score each subpillar 0–100 based ONLY on extracted data.
- Use the ACTUAL extracted text, headings, CTAs, value props to determine scores.
- CRITICAL: For blog scoring, use blogAnalysis.postCount if present (from browser detection). This is more accurate than HTML text estimates for JS-rendered sites.
  - If blogAnalysis.postCount === 0 or blogAnalysis is null/undefined → blog_volume = 0-20
  - If blogAnalysis.postCount 1-5 → blog_volume = 21-40
  - If blogAnalysis.postCount 6-20 → blog_volume = 41-60
  - If blogAnalysis.postCount 21-50 → blog_volume = 61-80
  - If blogAnalysis.postCount 50+ → blog_volume = 81-100
- If no evidence exists for a subpillar → score 0-20 (not 40-60).
- If evidence is weak/minimal → score 21-40.
- If evidence meets basic expectations → score 41-60.
- If evidence shows strength → score 61-80.
- If evidence shows excellence → score 81-100.
- Compute pillar.score = average(subpillar scores).
- Compute pillar.weightedScore = pillar.score * normalizedWeight.
- Compute overall = sum(weightedScores).
- Determine marketing maturity stage based on overall score.
- Add "notes" field to each subpillar score citing specific evidence.
- Vary scores significantly - spread across the full 0-100 range.

Return JSON only.`;

export const INSIGHTS_PROMPT = `You are a senior marketing strategist generating evidence-based insights.

CRITICAL: Every insight MUST include specific evidence from the extraction JSON.

Input:
1. Extraction JSON (with all extracted text, headings, CTAs, value props, etc.)
2. Scorecard JSON (with pillar and subpillar scores)
3. Named competitors (if available)

Output:
{
  "summary": "(2-3 paragraph strategic summary)",
  "insights": [
    {
      "issue": "Specific issue identified",
      "evidence": "EXACT QUOTE from extraction - e.g., 'Your hero headline is: "Taking banking forward".'",
      "why_it_matters": "Why this issue impacts marketing performance",
      "recommendation": "Specific, actionable recommendation",
      "pillar": "pillar_id",
      "service": "brandingAndImpact|contentAndEngagement|websiteAndConversion",
      "impact": "high|medium|low",
      "potentialGain": 0-20
    }
  ],
  "priorityRoadmap": [
    {
      "priority": 1,
      "action": "Specific action item",
      "impact": "high|medium|low",
      "specific_changes": "Detailed changes needed",
      "pillar": "pillar_id",
      "service": "brandingAndImpact|contentAndEngagement|websiteAndConversion",
      "potentialGain": 0-20
    }
  ],
  "copyRewrites": [
    {
      "element": "headline|subheadline|cta|section_header",
      "current": "EXACT current text from extraction",
      "recommended": "Improved version",
      "rationale": "Why this change improves conversion/clarity"
    }
  ],
}

SERVICE CLASSIFICATION:
Each insight and roadmap item must include a "service" field indicating which service area it belongs to:
- "brandingAndImpact": For insights related to brand_clarity, messaging_value, social, reviews pillars, or brand-related competitor positioning
- "contentAndEngagement": For insights related to content_depth pillar, blog content, content-related SEO (keyword_alignment, h1_quality), or content-related competitor insights
- "websiteAndConversion": For insights related to conversion, technical_health, tech_stack pillars, technical SEO (metadata, crawlability, internal_linking, sitemap_schema), analytics, or screenshots

PILLAR TO SERVICE MAPPING:
- brand_clarity → brandingAndImpact
- messaging_value → brandingAndImpact
- social → brandingAndImpact
- reviews → brandingAndImpact
- content_depth → contentAndEngagement
- seo (keyword_alignment, h1_quality subpillars) → contentAndEngagement
- seo (metadata, crawlability, internal_linking, sitemap_schema, alt_tags subpillars) → websiteAndConversion
- conversion → websiteAndConversion
- technical_health → websiteAndConversion
- tech_stack → websiteAndConversion
- competitor_positioning (brand-related) → brandingAndImpact
- competitor_positioning (content-related) → contentAndEngagement

Rules:
- Generate 15-25 insights (not 7-10)
- EVERY insight MUST quote specific extracted text in the "evidence" field
- Use exact quotes from extraction: headlines, CTAs, value props, headings
- Example evidence format: "Your hero headline is: '[exact headline text]'" or "Your primary CTA says: '[exact CTA text]'"
- CRITICAL: When citing blog evidence, quote specific blog post titles, URLs, or content. Example: "Your blog post '[exact title]' published on [date] demonstrates..."
- CRITICAL: When citing analytics evidence, reference specific tools detected. Example: "GA4 detected but GTM missing" or "Hotjar detected: [specific evidence]"
- CRITICAL: When citing LinkedIn evidence, reference specific data. Example: "LinkedIn Company Page has [X] followers with last post on [date]: '[exact post text]'"
- CRITICAL: When citing GBP evidence, reference specific review data. Example: "Google Business Profile shows [X] reviews with [rating] average, latest review on [date]"
- No generic advice - all recommendations must reference actual content from the extraction
- If extraction shows generic headline like "Welcome" → flag as issue with evidence
- If extraction shows specific benefit-driven headline → note as strength with evidence
- Prioritize insights by impact (high impact first)
- Include competitor comparison when competitors are provided
- Provide copy rewrites for headline, subheadline, primary CTA, and 2-3 section headers
- Copy rewrites must use EXACT current text from extraction, not approximations
- Calculate potentialGain based on pillar weight and current score gap
- Make insights specific to THIS website, not generic templates
- Blog-related insights MUST cite blog_posts, blog_urls_found, posting_frequency, or recency from extraction
- Analytics-related insights MUST cite analytics_tools_found, analytics_correctness, or analytics_completeness from extraction
- LinkedIn-related insights MUST cite linkedin_analysis data (follower_count, posting_frequency, latest_post_text)
- GBP-related insights MUST cite gbp_analysis data (review_count, rating, review_recency)
- CRITICAL: Assign the correct "service" field to each insight and roadmap item based on the pillar it references
- Aim for balanced distribution: at least 3-5 insights per service if there are issues in each area
Return JSON only.`;

export const STRATEGY_PROMPT = `You are a senior marketing strategist.

Input:
1. Extraction JSON
2. Scorecard JSON
3. Named competitors (if available)

Output:
{
  "summary": "",
  "top_opportunities": [
    {
      "issue": "",
      "why_it_matters": "",
      "evidence": "",
      "recommendation": ""
    }
  ],
  "prioritized_roadmap": [
    { "priority": 1, "action": "", "impact": "", "specific_changes": "" }
  ],
  "rewrite_suggestions": [
    { "element": "", "current": "", "recommended": "" }
  ],
  "competitor_analysis": {
    "competitors": [],
    "positioning_summary": "",
    "gaps": []
  }
}

Rules:
- Cite actual extracted text.
- No generic advice.
- Provide 7–10 insights for Full Snapshot.
- Provide 15–25 insights for Full Report if requested.
- Include a 1-paragraph competitor comparison when competitors are provided.
- Provide real copy rewrites where relevant.
Return JSON only.`;
