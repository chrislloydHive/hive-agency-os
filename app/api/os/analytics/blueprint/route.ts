// app/api/os/analytics/blueprint/route.ts
// API Route: Generate AI-powered Analytics Blueprint for a company
//
// This route analyzes a company's context (website, industry, GAP data)
// and generates a customized analytics configuration specifying which
// GA4/GSC metrics should be shown and how they should be visualized.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById, updateCompanyAnalyticsBlueprint } from '@/lib/airtable/companies';
import { getOpenAI } from '@/lib/openai';
import type { AnalyticsBlueprint } from '@/lib/analytics/blueprintTypes';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60 seconds for AI generation

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an analytics strategist for Hive OS, a marketing operating system for agencies.

Given a company's website, industry, business model, and any existing strategic analysis (GAP data),
you must design an "Analytics Blueprint": the 6–12 most important metrics from GA4 and Google Search Console
that strategists should monitor for this specific company.

The blueprint will be used to configure which metrics and charts are displayed to marketing strategists.

IMPORTANT: Return ONLY valid JSON matching this exact TypeScript structure:

interface AnalyticsMetricConfig {
  id: string;           // Use standard IDs like "ga4_sessions", "gsc_clicks", "ga4_bounceRate", etc.
  source: "ga4" | "gsc";
  label: string;        // Human-friendly label
  description: string;  // 1-2 sentences on why this metric matters for THIS company
  importance: "primary" | "secondary";
  chartType: "timeseries" | "bar" | "horizontalBar" | "pie" | "singleValue";
  group: "traffic" | "seo" | "conversion" | "engagement" | "local" | "ecommerce" | "brand";
  targetDirection: "up" | "down";  // What direction is "good"
  dimension?: "date" | "page" | "country" | "city" | "query" | "device" | "channel";
}

interface AnalyticsBlueprint {
  objectives: string[];           // 2-4 high-level analytics objectives
  notesForStrategist: string;     // 2-3 sentences on how to interpret these metrics together
  primaryMetrics: AnalyticsMetricConfig[];   // 3-5 primary metrics
  secondaryMetrics: AnalyticsMetricConfig[];  // 3-7 secondary metrics
  generatedAt: string;            // Will be set by the system
}

VALID METRIC IDS:
GA4 metrics: ga4_sessions, ga4_users, ga4_newUsers, ga4_pageviews, ga4_engagedSessions,
ga4_engagementRate, ga4_avgSessionDuration, ga4_bounceRate, ga4_pagesPerSession,
ga4_conversions, ga4_conversionRate, ga4_sessionsByChannel, ga4_sessionsByCountry,
ga4_sessionsByCity, ga4_sessionsByDevice, ga4_pageviewsByPage, ga4_sessionsByLandingPage

GSC metrics: gsc_clicks, gsc_impressions, gsc_ctr, gsc_avgPosition,
gsc_clicksByQuery, gsc_clicksByPage, gsc_clicksByCountry, gsc_clicksByDevice,
gsc_clicksOverTime, gsc_impressionsOverTime

CHART TYPE GUIDELINES:
- timeseries: Use for metrics over time (requires dimension: "date")
- bar: Use for top 10 rankings (pages, queries, channels)
- horizontalBar: Use for ranked lists where labels are long
- pie: Use for distribution (device types, countries)
- singleValue: Use for key KPIs with sparkline

GROUP GUIDELINES:
- traffic: Overall traffic volume (sessions, users)
- seo: Search Console metrics (clicks, impressions, position)
- conversion: Goal completions, conversion rates
- engagement: Time on site, bounce rate, pages per session
- local: Geographic breakdown (cities, regions) - for local businesses
- ecommerce: Revenue, transactions - for online stores
- brand: Brand search queries, direct traffic

Return ONLY the JSON object, no markdown code blocks or explanations.`;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Missing companyId' },
        { status: 400 }
      );
    }

    console.log('[Analytics Blueprint API] Generating blueprint for company:', companyId);

    // Fetch company data
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Build context for the AI
    const userPrompt = buildUserPrompt(company);

    // Call OpenAI to generate blueprint
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const rawContent = response.choices[0].message?.content || '{}';

    // Parse the response
    let blueprint: AnalyticsBlueprint;
    try {
      const parsed = JSON.parse(rawContent);
      blueprint = {
        objectives: parsed.objectives || [],
        notesForStrategist: parsed.notesForStrategist || '',
        primaryMetrics: parsed.primaryMetrics || [],
        secondaryMetrics: parsed.secondaryMetrics || [],
        generatedAt: new Date().toISOString(),
      };
    } catch {
      console.error('[Analytics Blueprint API] Failed to parse AI response:', rawContent);
      return NextResponse.json(
        { ok: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate we have some metrics
    if (blueprint.primaryMetrics.length === 0 && blueprint.secondaryMetrics.length === 0) {
      console.error('[Analytics Blueprint API] AI returned empty blueprint');
      return NextResponse.json(
        { ok: false, error: 'AI generated empty blueprint' },
        { status: 500 }
      );
    }

    // Save to Airtable
    const updatedCompany = await updateCompanyAnalyticsBlueprint(companyId, blueprint);

    if (!updatedCompany) {
      console.error('[Analytics Blueprint API] Failed to save blueprint to Airtable');
      return NextResponse.json(
        { ok: false, error: 'Failed to save blueprint' },
        { status: 500 }
      );
    }

    console.log('[Analytics Blueprint API] Blueprint generated and saved:', {
      companyId,
      companyName: company.name,
      primaryMetrics: blueprint.primaryMetrics.length,
      secondaryMetrics: blueprint.secondaryMetrics.length,
    });

    return NextResponse.json({
      ok: true,
      blueprint,
      company: {
        id: company.id,
        name: company.name,
      },
    });
  } catch (error) {
    console.error('[Analytics Blueprint API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Build User Prompt
// ============================================================================

function buildUserPrompt(company: Record<string, unknown>): string {
  const parts: string[] = [];

  parts.push(`Company Name: ${company.name}`);

  if (company.website) {
    parts.push(`Website: ${company.website}`);
  }

  if (company.industry) {
    parts.push(`Industry: ${company.industry}`);
  }

  if (company.companyType) {
    parts.push(`Business Model: ${company.companyType}`);
  }

  if (company.tier) {
    parts.push(`Client Tier: ${company.tier}`);
  }

  if (company.stage) {
    parts.push(`Relationship Stage: ${company.stage}`);
  }

  // Add any GAP or diagnostic summary if available
  // These would come from related tables in a full implementation
  // For now, we work with the basic company info

  parts.push('');
  parts.push('Based on this company profile, create an Analytics Blueprint with:');
  parts.push('- 3-5 PRIMARY metrics (most important for this business type)');
  parts.push('- 3-7 SECONDARY metrics (supporting insights)');
  parts.push('');
  parts.push('Consider:');
  parts.push('- What type of website is this? (SaaS, local service, ecommerce, etc.)');
  parts.push('- What metrics would indicate success for this business model?');
  parts.push('- What visualizations would be most useful for each metric?');
  parts.push('- How should a strategist interpret these metrics together?');

  return parts.join('\n');
}

// ============================================================================
// GET Handler - Retrieve existing blueprint
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Missing companyId query parameter' },
        { status: 400 }
      );
    }

    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      blueprint: company.analyticsBlueprint || null,
      company: {
        id: company.id,
        name: company.name,
      },
    });
  } catch (error) {
    console.error('[Analytics Blueprint API] GET Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
