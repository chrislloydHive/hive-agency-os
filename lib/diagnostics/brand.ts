// lib/diagnostics/brand.ts
// Brand Diagnostics Module - OS Diagnostic Pillar #2
// Collects brand evidence (logo, messaging, credibility) and uses AI to evaluate

import * as cheerio from 'cheerio';
import type {
  BrandEvidence,
  PillarScore,
  Issue,
  Severity,
  Impact,
  Effort,
  Priority,
} from './types';

// ============================================================================
// Type Definitions
// ============================================================================

export type CompanyContext = {
  id: string;
  name: string;
  websiteUrl: string;
  industry?: string | null;
  stage?: string | null;
};

export type BrandDiagnostic = {
  score: number; // 1-10
  justification: string;
  issues: Issue[];
  priorities: Priority[];
};

// ============================================================================
// Evidence Collection
// ============================================================================

/**
 * Collect all Brand evidence from website
 */
export async function collectBrandEvidence(url: string): Promise<BrandEvidence> {
  console.log(`[Brand] Collecting evidence for: ${url}`);

  const html = await fetchRenderedHtml(url);
  const $ = cheerio.load(html);

  // Visual brand elements
  const visual = analyzeBrandVisuals($, html);

  // Messaging & content
  const messaging = analyzeBrandMessaging($);

  // Credibility indicators
  const credibility = analyzeBrandCredibility($);

  return {
    url,
    visual,
    messaging,
    credibility,
    tone: {
      // Tone analysis can be done by AI in the diagnostic phase
      perceivedTone: undefined,
      confidenceLevel: 'low',
    },
  };
}

/**
 * Fetch HTML from URL (reuse pattern from websiteUx)
 */
async function fetchRenderedHtml(url: string): Promise<string> {
  console.log(`[Brand] Fetching HTML from: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; HiveBot/1.0; +https://hive.com/bot)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to fetch HTML for ${url}: ${res.status}`);
    }

    return await res.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Analyze visual brand elements
 */
function analyzeBrandVisuals(
  $: cheerio.CheerioAPI,
  html: string
): BrandEvidence['visual'] {
  // Detect logo
  let hasLogo = false;
  let logoLocation: 'header' | 'footer' | 'other' | null = null;
  let logoAltText: string | undefined;

  // Check header for logo
  const headerImages = $('header img, nav img, .header img, .navbar img');
  headerImages.each((_, el) => {
    const alt = $(el).attr('alt')?.toLowerCase() || '';
    const src = $(el).attr('src')?.toLowerCase() || '';
    const className = $(el).attr('class')?.toLowerCase() || '';

    if (
      alt.includes('logo') ||
      src.includes('logo') ||
      className.includes('logo')
    ) {
      hasLogo = true;
      logoLocation = 'header';
      logoAltText = $(el).attr('alt');
      return false; // Break loop
    }
  });

  // Check for SVG logos in header
  if (!hasLogo) {
    const headerSvg = $('header svg, nav svg, .header svg, .navbar svg');
    if (headerSvg.length > 0) {
      hasLogo = true;
      logoLocation = 'header';
    }
  }

  // Check footer if not found in header
  if (!hasLogo) {
    const footerImages = $('footer img, .footer img');
    footerImages.each((_, el) => {
      const alt = $(el).attr('alt')?.toLowerCase() || '';
      const src = $(el).attr('src')?.toLowerCase() || '';

      if (alt.includes('logo') || src.includes('logo')) {
        hasLogo = true;
        logoLocation = 'footer';
        logoAltText = $(el).attr('alt');
        return false;
      }
    });
  }

  // Check for favicon
  const hasFavicon =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0 ||
    html.includes('favicon');

  // Very basic consistency check (presence of CSS)
  const hasConsistentStyling =
    $('link[rel="stylesheet"]').length > 0 || $('style').length > 0;

  console.log(
    `[Brand] Visual analysis: logo=${hasLogo}, favicon=${hasFavicon}, styling=${hasConsistentStyling}`
  );

  return {
    hasLogo,
    logoLocation,
    logoAltText,
    hasFavicon,
    primaryColors: undefined, // Could extract from CSS, but complex
    hasConsistentStyling,
  };
}

/**
 * Analyze brand messaging
 */
function analyzeBrandMessaging(
  $: cheerio.CheerioAPI
): BrandEvidence['messaging'] {
  // Extract hero headline (H1)
  const heroHeadline = $('h1').first().text().trim() || undefined;

  // Extract tagline (often near logo or as subtitle)
  let tagline: string | undefined;
  const possibleTaglines = $(
    'header p, .hero p, .tagline, [class*="tagline"], [class*="subtitle"]'
  )
    .first()
    .text()
    .trim();
  if (possibleTaglines && possibleTaglines.length < 150) {
    tagline = possibleTaglines;
  }

  // Hero value prop (H1 + first paragraph)
  let heroValueProp: string | undefined;
  if (heroHeadline) {
    const heroSection = $('h1').first().parent();
    const firstP = heroSection.find('p').first().text().trim();
    heroValueProp = [heroHeadline, firstP].filter(Boolean).join(' — ');
  }

  // Check for About page link
  const hasAboutPage =
    $('a[href*="about"]').length > 0 || $('a:contains("About")').length > 0;

  // Check for testimonials
  const hasTestimonials =
    $('[class*="testimonial"]').length > 0 ||
    $('[class*="review"]').length > 0 ||
    $('blockquote').length > 0;

  // Check for case studies
  const hasCaseStudies =
    $('a[href*="case-stud"]').length > 0 ||
    $('a:contains("Case Studies")').length > 0 ||
    $('[class*="case-stud"]').length > 0;

  // Check for client logos
  const hasClientLogos =
    $('[class*="client"]').length > 0 ||
    $('[class*="partner"]').length > 0 ||
    $('[class*="logo"][class*="grid"]').length > 0;

  console.log(
    `[Brand] Messaging analysis: headline="${heroHeadline?.substring(0, 50)}", about=${hasAboutPage}, testimonials=${hasTestimonials}`
  );

  return {
    tagline,
    heroHeadline,
    heroValueProp,
    hasAboutPage,
    hasTestimonials,
    hasCaseStudies,
    hasClientLogos,
  };
}

/**
 * Analyze credibility indicators
 */
function analyzeBrandCredibility(
  $: cheerio.CheerioAPI
): BrandEvidence['credibility'] {
  // Social proof keywords
  const bodyText = $('body').text().toLowerCase();
  const hasSocialProof =
    bodyText.includes('trusted by') ||
    bodyText.includes('customers') ||
    bodyText.includes('clients we serve') ||
    $('[class*="testimonial"]').length > 0;

  // Contact information
  const hasContactInfo =
    $('a[href^="mailto:"]').length > 0 ||
    $('a[href^="tel:"]').length > 0 ||
    $('a:contains("Contact")').length > 0 ||
    bodyText.includes('@') ||
    bodyText.includes('contact us');

  // Team page
  const hasTeamPage =
    $('a[href*="team"]').length > 0 ||
    $('a:contains("Team")').length > 0 ||
    $('a:contains("About Us")').length > 0;

  // Certifications (simple text detection)
  const certifications: string[] = [];
  const certPatterns = [
    /ISO[\s-]?\d+/gi,
    /certified/gi,
    /accredited/gi,
    /award/gi,
  ];
  certPatterns.forEach((pattern) => {
    const matches = bodyText.match(pattern);
    if (matches) {
      certifications.push(...matches.slice(0, 3)); // Limit to 3
    }
  });

  // Press mentions
  const pressmentions =
    bodyText.includes('featured in') ||
    bodyText.includes('press') ||
    bodyText.includes('media');

  console.log(
    `[Brand] Credibility analysis: socialProof=${hasSocialProof}, contact=${hasContactInfo}, team=${hasTeamPage}`
  );

  return {
    hasSocialProof,
    hasContactInfo,
    hasTeamPage,
    certifications: certifications.length > 0 ? certifications : undefined,
    pressmentions,
  };
}

// ============================================================================
// AI-Powered Brand Diagnostics
// ============================================================================

/**
 * Run Brand diagnostics using OpenAI
 */
export async function runBrandDiagnostics(
  company: CompanyContext
): Promise<BrandDiagnostic> {
  console.log(`[Brand] Running diagnostics for: ${company.name}`);

  const evidence = await collectBrandEvidence(company.websiteUrl);
  const diagnostic = await callBrandAi(evidence, company);

  return diagnostic;
}

/**
 * Call OpenAI to interpret brand evidence and generate diagnostic
 */
async function callBrandAi(
  evidence: BrandEvidence,
  company: CompanyContext
): Promise<BrandDiagnostic> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const systemPrompt = `
You are an expert Brand Strategist evaluating BRAND STRENGTH ONLY (not UX, SEO, or content quality).

You are scoring on a strict 1–10 scale:

1–2: Very weak brand. No clear positioning, inconsistent visuals, zero credibility signals.
3–4: Weak brand. Generic messaging, missing logo or key elements, limited trust indicators.
5–6: Average brand. Basic elements present but generic, lacks differentiation or proof.
7–8: Strong brand. Clear positioning, professional visuals, good credibility signals, distinct voice.
9–10: Exceptional brand. Compelling positioning, cohesive identity, strong proof, memorable and trustworthy.

Evaluation criteria:
- Visual Identity: Logo quality, favicon, consistent styling
- Messaging: Clear value proposition, tagline, hero headline clarity
- Credibility: Social proof, testimonials, client logos, certifications, contact info
- Differentiation: Does the brand stand out or feel generic?
- Professionalism: Overall polish and attention to detail

You MUST base all judgments ONLY on the evidence provided.
Do not invent metrics you have not been given.

Return a single JSON object matching this structure:
{
  "score": number (1-10),
  "justification": string,
  "issues": [
    { "id": string, "title": string, "description": string, "severity": "low" | "medium" | "high" }
  ],
  "priorities": [
    { "id": string, "title": string, "impact": "low" | "medium" | "high", "effort": "low" | "medium" | "high", "rationale": string }
  ]
}
`.trim();

  const userPayload = {
    company,
    evidence,
  };

  console.log(`[Brand] Calling OpenAI for diagnostic analysis...`);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify(userPayload),
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI Brand call failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    const content = json.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('[Brand] Failed to parse OpenAI response:', content);
      throw new Error('Failed to parse BrandDiagnostic JSON from OpenAI');
    }

    // Sanitize and validate the response
    const safe: BrandDiagnostic = {
      score: clampToInt(parsed.score, 1, 10),
      justification: parsed.justification || '',
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.map((i: any, idx: number): Issue => ({
            id: i.id || `brand-issue-${idx + 1}`,
            title: i.title || 'Brand Issue',
            description: i.description || '',
            pillar: 'brand',
            severity: normalizeSeverity(i.severity),
          }))
        : [],
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.map((p: any, idx: number): Priority => ({
            id: p.id || `brand-priority-${idx + 1}`,
            title: p.title || 'Brand Priority',
            description: p.rationale || '',
            pillar: 'brand',
            impact: normalizeImpact(p.impact),
            effort: normalizeEffort(p.effort),
            rationale: p.rationale || '',
          }))
        : [],
    };

    console.log(
      `[Brand] Diagnostic complete: score=${safe.score}/10, issues=${safe.issues.length}, priorities=${safe.priorities.length}`
    );

    return safe;
  } catch (error) {
    console.error('[Brand] AI diagnostic error:', error);
    throw error;
  }
}

// ============================================================================
// Normalization Helpers
// ============================================================================

function clampToInt(value: any, min: number, max: number): number {
  const n = Math.round(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

function normalizeSeverity(value: any): Severity {
  const v = String(value || '').toLowerCase();
  if (v.includes('high')) return 'high';
  if (v.includes('low')) return 'low';
  return 'medium';
}

function normalizeImpact(value: any): Impact {
  const v = String(value || '').toLowerCase();
  if (v.includes('high')) return 'high';
  if (v.includes('low')) return 'low';
  return 'medium';
}

function normalizeEffort(value: any): Effort {
  const v = String(value || '').toLowerCase();
  if (v.includes('low')) return 'low';
  if (v.includes('high')) return 'high';
  return 'medium';
}
