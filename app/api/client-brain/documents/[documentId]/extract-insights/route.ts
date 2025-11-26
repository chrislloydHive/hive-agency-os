// app/api/client-brain/documents/[documentId]/extract-insights/route.ts
// Extract insights from a document using AI

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getDocumentById } from '@/lib/airtable/clientBrain';
import { createInsightsBatch, getCompanyInsights } from '@/lib/airtable/clientBrain';
import type {
  CreateClientInsightInput,
  InsightCategory,
  InsightSeverity,
} from '@/lib/types/clientBrain';

interface ExtractedInsight {
  title: string;
  body: string;
  category: string;
  severity?: string;
}

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    // Get optional text content from request body (if pre-extracted)
    const body = await request.json().catch(() => ({}));
    const { textContent } = body;

    console.log('[DocumentInsightExtract] Starting extraction:', { documentId });

    // 1. Get the document
    const document = await getDocumentById(documentId);
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // 2. Get text content (from request body or document preview)
    const contentToAnalyze = textContent || document.textPreview;

    if (!contentToAnalyze) {
      return NextResponse.json(
        { error: 'No text content available to extract insights from. Please extract text first or provide textContent in the request body.' },
        { status: 400 }
      );
    }

    // 3. Check for existing insights from this document
    const existingInsights = await getCompanyInsights(document.companyId, { limit: 100 });
    const existingFromDoc = existingInsights.filter((insight) => {
      if (insight.source.type === 'document') {
        return insight.source.documentId === documentId;
      }
      return false;
    });

    if (existingFromDoc.length > 0) {
      return NextResponse.json({
        success: true,
        message: `Already extracted ${existingFromDoc.length} insights from this document`,
        insights: existingFromDoc,
        alreadyExtracted: true,
      });
    }

    // 4. Truncate content if too long
    const maxLength = 15000;
    const truncatedContent = contentToAnalyze.length > maxLength
      ? contentToAnalyze.slice(0, maxLength) + '\n...[truncated]'
      : contentToAnalyze;

    // 5. Build the prompt for AI extraction
    const systemPrompt = `You are an expert marketing analyst extracting strategic insights from client documents.

Your task is to identify the most important, actionable insights from the provided document content.

Document types and what to look for:
- Brief: Project goals, requirements, constraints, target audience
- Contract: Scope, deliverables, timeline commitments, SLAs
- Deck: Strategy, positioning, key messages, competitive analysis
- Research: Market data, customer insights, competitive intelligence
- Transcript: Client priorities, pain points, unmet needs, feedback
- Report: Performance data, recommendations, findings

Categories for insights:
- brand: Brand identity, positioning, messaging, differentiation
- content: Content strategy, blog, resources, messaging
- seo: Search engine optimization, keywords, rankings
- website: Website UX, conversion, design, performance
- analytics: Tracking, measurement, data quality
- demand: Lead generation, funnel, demand gen
- ops: Marketing operations, process, tooling
- competitive: Competitive landscape, market position
- structural: Architecture, infrastructure, technical
- product: Product marketing, positioning
- other: Other insights

Severity levels:
- critical: Urgent strategic priority
- high: Important finding or requirement
- medium: Useful context or consideration
- low: Minor detail or background info

Guidelines:
1. Extract 3-10 insights based on document richness
2. Focus on client-specific strategic insights, not generic observations
3. The title should be concise (under 80 chars)
4. The body should provide specific context with quotes/evidence where possible
5. Prioritize actionable insights that inform future work

Output your response as valid JSON:
{
  "insights": [
    {
      "title": "string",
      "body": "string (detailed explanation with evidence)",
      "category": "brand|content|seo|website|analytics|demand|ops|competitive|structural|product|other",
      "severity": "critical|high|medium|low"
    }
  ]
}`;

    const userPrompt = `Extract strategic insights from this ${document.type || 'client'} document:

Document: ${document.name}
Type: ${document.type || 'Unknown'}

---
Content:
${truncatedContent}
---

Extract the most important strategic insights from this document.`;

    // 6. Call OpenAI to extract insights
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';

    let parsed: { insights?: ExtractedInsight[] };
    try {
      parsed = JSON.parse(responseContent);
    } catch {
      console.error('[DocumentInsightExtract] Failed to parse AI response:', responseContent);
      return NextResponse.json(
        { error: 'Failed to parse AI extraction response' },
        { status: 500 }
      );
    }

    const extractedInsights = parsed.insights || [];
    console.log('[DocumentInsightExtract] Extracted insights:', extractedInsights.length);

    if (extractedInsights.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No significant insights found in this document',
        insights: [],
      });
    }

    // 7. Map to CreateClientInsightInput format
    const validCategories: InsightCategory[] = [
      'brand', 'content', 'seo', 'website', 'analytics',
      'demand', 'ops', 'competitive', 'structural', 'product', 'other'
    ];
    const validSeverities: InsightSeverity[] = ['low', 'medium', 'high', 'critical'];

    const insightInputs: CreateClientInsightInput[] = extractedInsights.map((insight) => ({
      title: insight.title.slice(0, 200),
      body: insight.body,
      category: validCategories.includes(insight.category as InsightCategory)
        ? (insight.category as InsightCategory)
        : 'other',
      severity: validSeverities.includes(insight.severity as InsightSeverity)
        ? (insight.severity as InsightSeverity)
        : 'medium',
      source: {
        type: 'document' as const,
        documentId,
      },
    }));

    // 8. Batch create insights
    const createdInsights = await createInsightsBatch(document.companyId, insightInputs);

    console.log('[DocumentInsightExtract] Created insights:', createdInsights.length);

    return NextResponse.json({
      success: true,
      message: `Extracted ${createdInsights.length} insights`,
      insights: createdInsights,
    });

  } catch (error) {
    console.error('[DocumentInsightExtract] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract insights' },
      { status: 500 }
    );
  }
}
