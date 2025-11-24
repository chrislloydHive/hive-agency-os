// lib/diagnostics/websiteUx.ts
// Website/UX Diagnostics Module - First OS Diagnostic Pillar
// Collects deterministic evidence (structure + PageSpeed) and uses OpenAI to interpret

import * as cheerio from 'cheerio';

// ============================================================================
// Type Definitions
// ============================================================================

export type Severity = 'low' | 'medium' | 'high';
export type Effort = 'low' | 'medium' | 'high';
export type Impact = 'low' | 'medium' | 'high';

export type WebsiteUxIssue = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
};

export type WebsiteUxPriority = {
  id: string;
  title: string;
  impact: Impact;
  effort: Effort;
  rationale: string;
};

export type WebsiteUxDiagnostic = {
  score: number; // 1–10 integer
  justification: string;
  issues: WebsiteUxIssue[];
  priorities: WebsiteUxPriority[];
};

export type WebsiteUxStructureSnapshot = {
  title?: string;
  metaDescription?: string;
  h1?: string;
  heroText?: string;
  primaryCtaAboveFold: boolean;
  hasContactForm: boolean;
};

export type WebsiteUxSpeedSnapshot = {
  performanceScore?: number;
  lcp?: number;
  cls?: number;
  inp?: number;
};

export type WebsiteUxEvidence = {
  url: string;
  structure: WebsiteUxStructureSnapshot;
  speed: WebsiteUxSpeedSnapshot;
};

export type CompanyContext = {
  id: string;
  name: string;
  websiteUrl: string;
  industry?: string | null;
  stage?: string | null;
};

// ============================================================================
// Evidence Collection
// ============================================================================

/**
 * Collect all Website/UX evidence (structure + speed)
 */
export async function collectWebsiteUxEvidence(
  url: string
): Promise<WebsiteUxEvidence> {
  console.log(`[WebsiteUX] Collecting evidence for: ${url}`);

  const html = await fetchRenderedHtml(url);
  const structure = analyzeHtmlStructure(html);
  const speed = await getPageSpeedSnapshot(url);

  return { url, structure, speed };
}

/**
 * Fetch HTML from URL
 * For now, use simple fetch. Later we'll replace with existing render/snapshot service.
 */
async function fetchRenderedHtml(url: string): Promise<string> {
  console.log(`[WebsiteUX] Fetching HTML from: ${url}`);

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
 * Analyze HTML structure using Cheerio
 */
function analyzeHtmlStructure(html: string): WebsiteUxStructureSnapshot {
  const $ = cheerio.load(html);

  // Extract title
  const title = $('title').first().text().trim() || undefined;

  // Extract meta description
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() || undefined;

  // Extract first H1
  const h1 = $('h1').first().text().trim() || undefined;

  // Extract hero text: H1 + first <p> after it
  let heroText: string | undefined;
  if (h1) {
    const h1El = $('h1').first();
    const nextP = h1El.nextAll('p').first().text().trim();
    heroText = [h1, nextP].filter(Boolean).join(' — ');
  }

  // Detect primary CTA above the fold
  let primaryCtaAboveFold = false;
  const ctaPattern =
    /get started|book a demo|schedule|contact|talk to us|request a quote|get a quote|start now/i;

  $('a, button')
    .slice(0, 40)
    .each((_, el) => {
      const text = $(el).text().toLowerCase().trim();
      if (ctaPattern.test(text)) {
        primaryCtaAboveFold = true;
        return false; // Break loop
      }
    });

  // Check for contact form
  const hasContactForm = $('form').length > 0;

  console.log(
    `[WebsiteUX] Structure analyzed: title=${!!title}, h1=${!!h1}, CTA=${primaryCtaAboveFold}, form=${hasContactForm}`
  );

  return {
    title,
    metaDescription,
    h1,
    heroText,
    primaryCtaAboveFold,
    hasContactForm,
  };
}

/**
 * Get PageSpeed snapshot from Google API
 */
async function getPageSpeedSnapshot(
  url: string
): Promise<WebsiteUxSpeedSnapshot> {
  const apiKey = process.env.PAGESPEED_API_KEY;

  if (!apiKey) {
    console.warn(
      '[WebsiteUX] PAGESPEED_API_KEY not set; skipping speed diagnostics.'
    );
    return {};
  }

  try {
    console.log(`[WebsiteUX] Calling PageSpeed API for: ${url}`);

    const apiUrl = new URL(
      'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    );
    apiUrl.searchParams.set('url', url);
    apiUrl.searchParams.set('category', 'PERFORMANCE');
    apiUrl.searchParams.set('strategy', 'DESKTOP');
    apiUrl.searchParams.set('key', apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const res = await fetch(apiUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(
        `[WebsiteUX] PageSpeed API failed for ${url}: ${res.status}`
      );
      return {};
    }

    const data = await res.json();
    const lighthouse = data.lighthouseResult;

    if (!lighthouse) {
      console.warn('[WebsiteUX] No lighthouse result in PageSpeed response');
      return {};
    }

    // Extract performance score (0-1 scale, convert to 0-100)
    const performanceScore =
      typeof lighthouse.categories?.performance?.score === 'number'
        ? Math.round(lighthouse.categories.performance.score * 100)
        : undefined;

    // Extract Core Web Vitals
    const audits = lighthouse.audits || {};
    const lcp = audits['largest-contentful-paint']?.numericValue;
    const cls = audits['cumulative-layout-shift']?.numericValue;
    const inp = audits['interaction-to-next-paint']?.numericValue;

    console.log(
      `[WebsiteUX] PageSpeed collected: score=${performanceScore}, LCP=${lcp}ms, CLS=${cls}, INP=${inp}ms`
    );

    return {
      performanceScore,
      lcp,
      cls,
      inp,
    };
  } catch (error) {
    console.error('[WebsiteUX] PageSpeed API error:', error);
    return {};
  }
}

// ============================================================================
// AI-Powered Diagnostics
// ============================================================================

/**
 * Run Website/UX diagnostics using OpenAI
 */
export async function runWebsiteUxDiagnostics(
  company: CompanyContext
): Promise<WebsiteUxDiagnostic> {
  console.log(
    `[WebsiteUX] Running diagnostics for: ${company.name} (${company.websiteUrl})`
  );

  const evidence = await collectWebsiteUxEvidence(company.websiteUrl);
  const diagnostic = await callWebsiteUxAi(evidence, company);

  return diagnostic;
}

/**
 * Call OpenAI to interpret evidence and generate diagnostic
 */
async function callWebsiteUxAi(
  evidence: WebsiteUxEvidence,
  company: CompanyContext
): Promise<WebsiteUxDiagnostic> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const systemPrompt = `
You are an expert Web UX and conversion auditor working for a marketing agency.
You are evaluating WEBSITE/UX ONLY (not brand, SEO, or content quality).

You are scoring on a strict 1–10 scale:

1–2: Very poor UX. Confusing, slow, unclear CTAs, feels untrustworthy.
3–4: Weak UX. Some basic structure but many issues and friction.
5–6: Average UX. Functional but generic, several clear areas to improve.
7–8: Strong UX. Clear hierarchy, obvious CTAs, decent performance; still improvable.
9–10: Excellent UX. Clear value prop, polished, fast, intentional conversion paths.

You MUST base all judgments ONLY on the evidence provided:
- HTML structure snapshot
- PageSpeed snapshot
- Conversion snapshot

Do not invent metrics you have not been given.
Return a single JSON object matching the WebsiteUxDiagnostic type:
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

  console.log(`[WebsiteUX] Calling OpenAI for diagnostic analysis...`);

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
      throw new Error(`OpenAI Website UX call failed: ${res.status} ${text}`);
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
      console.error('[WebsiteUX] Failed to parse OpenAI response:', content);
      throw new Error('Failed to parse WebsiteUxDiagnostic JSON from OpenAI');
    }

    // Sanitize and validate the response
    const safe: WebsiteUxDiagnostic = {
      score: clampToInt(parsed.score, 1, 10),
      justification: parsed.justification || '',
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.map((i: any, idx: number): WebsiteUxIssue => ({
            id: i.id || `issue-${idx + 1}`,
            title: i.title || 'Issue',
            description: i.description || '',
            severity: normalizeSeverity(i.severity),
          }))
        : [],
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.map((p: any, idx: number): WebsiteUxPriority => ({
            id: p.id || `priority-${idx + 1}`,
            title: p.title || 'Priority',
            impact: normalizeImpact(p.impact),
            effort: normalizeEffort(p.effort),
            rationale: p.rationale || '',
          }))
        : [],
    };

    console.log(
      `[WebsiteUX] Diagnostic complete: score=${safe.score}/10, issues=${safe.issues.length}, priorities=${safe.priorities.length}`
    );

    return safe;
  } catch (error) {
    console.error('[WebsiteUX] AI diagnostic error:', error);
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
