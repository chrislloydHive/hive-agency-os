// lib/contextGraph/fcb/extractors/audienceExtractor.ts
// Audience Extractor for FCB
//
// Extracts audience domain fields from website signals:
// - primaryAudience, audienceDescription
// - targetDemographics, buyerTypes

import OpenAI from 'openai';
import type { SignalBundle, ExtractorResult, ExtractedField, ExtractorDiagnostic } from '../types';

// ============================================================================
// Types
// ============================================================================

interface AudienceExtraction {
  icpDescription?: string;
  primaryAudience?: string;
  audienceDescription?: string;
  targetDemographics?: string[];
  buyerTypes?: string[];
  painPoints?: string[];
  motivations?: string[];
}

// ============================================================================
// Prompt Construction
// ============================================================================

function buildExtractionPrompt(signals: SignalBundle): string {
  const sections: string[] = [];

  // Company context
  sections.push(`## Company
Name: ${signals.companyName}
Domain: ${signals.domain}`);

  // Meta tags
  if (signals.metaTags.description) {
    sections.push(`## Meta Description
${signals.metaTags.description}`);
  }

  // Homepage text (focus on who they serve)
  if (signals.homepage.text) {
    const truncated = signals.homepage.text.slice(0, 3000);
    sections.push(`## Homepage Text (first 3000 chars)\n${truncated}`);
  }

  // About page - often mentions who they serve
  if (signals.aboutPage?.text) {
    const truncated = signals.aboutPage.text.slice(0, 2000);
    sections.push(`## About Page Text (first 2000 chars)\n${truncated}`);
  }

  // Services page - often describes target customers
  if (signals.servicesPage?.text) {
    const truncated = signals.servicesPage.text.slice(0, 2000);
    sections.push(`## Services Page Text (first 2000 chars)\n${truncated}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Main Extractor
// ============================================================================

export async function extractAudience(signals: SignalBundle): Promise<ExtractorResult> {
  const fields: ExtractedField[] = [];
  const diagnostics: ExtractorDiagnostic[] = [];

  try {
    const openai = new OpenAI();
    const context = buildExtractionPrompt(signals);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at identifying target audiences and Ideal Customer Profiles (ICP) from website content.

Your task is to extract the following audience-related fields. Only include fields where you have reasonable confidence.

Fields to extract:
- icpDescription: A comprehensive 2-3 sentence description of the ideal customer profile. This should clearly describe WHO the ideal customer is, their characteristics, and what makes them ideal for this business. This is a CRITICAL field - try hard to extract it.
- primaryAudience: A brief one-sentence description of the primary target audience (e.g., "Small business owners", "Homeowners in suburban areas")
- audienceDescription: A more detailed 1-2 sentence description of who the ideal customer is
- targetDemographics: Array of demographic characteristics (e.g., ["Age 35-55", "Middle to upper income", "Homeowners"])
- buyerTypes: Array of buyer persona types (e.g., ["First-time buyers", "Cost-conscious", "Quality-focused"])
- painPoints: Array of problems/pain points the target audience experiences that this business solves (e.g., ["Struggling to manage complex projects", "Losing customers due to slow response times"])
- motivations: Array of what drives the target audience to seek this solution (e.g., ["Want to scale their business", "Need to reduce operational costs"])

Look for signals like:
- "Who we serve" sections
- Customer testimonials and case studies
- Problem statements and "challenges we solve"
- Language that addresses a specific audience
- Industry-specific terminology
- Value propositions that hint at customer needs

Return a JSON object with these fields. Omit any field where you cannot make a confident extraction.
Also include a "confidence" object with 0-1 scores for each field you include.`,
        },
        {
          role: 'user',
          content: `Extract audience information from this website data:\n\n${context}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      diagnostics.push({
        code: 'EMPTY_RESPONSE',
        message: 'LLM returned empty response',
        severity: 'error',
      });
      return { fields, diagnostics, source: 'fcb' };
    }

    const parsed = JSON.parse(content) as AudienceExtraction & { confidence?: Record<string, number> };
    const confidences = parsed.confidence || {};

    // Map extracted fields - note: audience fields typically have lower confidence
    // ICP Description is CRITICAL - extract to identity.icpDescription (canonical location)
    if (parsed.icpDescription) {
      fields.push({
        path: 'identity.icpDescription',
        value: parsed.icpDescription,
        confidence: confidences.icpDescription ?? 0.7,
        reasoning: 'Synthesized ICP from website messaging and target audience signals',
      });
    }

    if (parsed.primaryAudience) {
      fields.push({
        path: 'audience.primaryAudience',
        value: parsed.primaryAudience,
        confidence: confidences.primaryAudience ?? 0.65,
        reasoning: 'Inferred from website messaging and content',
      });
    }

    if (parsed.audienceDescription) {
      fields.push({
        path: 'audience.audienceDescription',
        value: parsed.audienceDescription,
        confidence: confidences.audienceDescription ?? 0.6,
        reasoning: 'Synthesized from target audience signals',
      });
    }

    if (parsed.targetDemographics && parsed.targetDemographics.length > 0) {
      fields.push({
        path: 'audience.targetDemographics',
        value: parsed.targetDemographics,
        confidence: confidences.targetDemographics ?? 0.55,
        reasoning: 'Inferred from content tone and product positioning',
      });
    }

    if (parsed.buyerTypes && parsed.buyerTypes.length > 0) {
      fields.push({
        path: 'audience.buyerTypes',
        value: parsed.buyerTypes,
        confidence: confidences.buyerTypes ?? 0.5,
        reasoning: 'Inferred from value propositions and messaging',
      });
    }

    if (parsed.painPoints && parsed.painPoints.length > 0) {
      fields.push({
        path: 'audience.painPoints',
        value: parsed.painPoints,
        confidence: confidences.painPoints ?? 0.6,
        reasoning: 'Inferred from problem statements and value propositions',
      });
    }

    if (parsed.motivations && parsed.motivations.length > 0) {
      fields.push({
        path: 'audience.motivations',
        value: parsed.motivations,
        confidence: confidences.motivations ?? 0.55,
        reasoning: 'Inferred from benefits and customer success messaging',
      });
    }

    diagnostics.push({
      code: 'EXTRACTION_SUCCESS',
      message: `Extracted ${fields.length} audience fields`,
      severity: 'info',
    });
  } catch (error) {
    diagnostics.push({
      code: 'EXTRACTION_ERROR',
      message: `Audience extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      severity: 'error',
    });
  }

  return { fields, diagnostics, source: 'fcb' };
}
