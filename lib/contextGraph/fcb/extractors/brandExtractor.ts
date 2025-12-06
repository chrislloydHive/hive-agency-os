// lib/contextGraph/fcb/extractors/brandExtractor.ts
// Brand Extractor for FCB
//
// Extracts brand domain fields from website signals:
// - tagline, voiceDescriptors
// - brandPromise, brandPersonality
// - toneOfVoice

import OpenAI from 'openai';
import type { SignalBundle, ExtractorResult, ExtractedField, ExtractorDiagnostic } from '../types';

// ============================================================================
// Types
// ============================================================================

interface BrandExtraction {
  tagline?: string;
  voiceDescriptors?: string[];
  brandPromise?: string;
  brandPersonality?: string[];
  toneOfVoice?: string;
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

  // Page titles (often contain taglines)
  const titles: string[] = [];
  if (signals.homepage.title) titles.push(`Homepage: ${signals.homepage.title}`);
  if (signals.aboutPage?.title) titles.push(`About: ${signals.aboutPage.title}`);
  if (titles.length > 0) {
    sections.push(`## Page Titles\n${titles.join('\n')}`);
  }

  // Meta description
  if (signals.metaTags.description) {
    sections.push(`## Meta Description
${signals.metaTags.description}`);
  }

  // OpenGraph
  if (signals.openGraph.description || signals.openGraph.title) {
    sections.push(`## OpenGraph
Title: ${signals.openGraph.title || 'N/A'}
Description: ${signals.openGraph.description || 'N/A'}`);
  }

  // Homepage hero section (first part typically has brand messaging)
  if (signals.homepage.text) {
    const truncated = signals.homepage.text.slice(0, 2000);
    sections.push(`## Homepage Text (first 2000 chars)\n${truncated}`);
  }

  // About page - often has brand story
  if (signals.aboutPage?.text) {
    const truncated = signals.aboutPage.text.slice(0, 2500);
    sections.push(`## About Page Text (first 2500 chars)\n${truncated}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Main Extractor
// ============================================================================

export async function extractBrand(signals: SignalBundle): Promise<ExtractorResult> {
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
          content: `You are an expert brand strategist analyzing website content to extract brand characteristics.

Your task is to extract the following brand-related fields. Only include fields where you have reasonable confidence.

Fields to extract:
- tagline: The company's tagline or slogan (e.g., "Your trusted partner in growth")
- voiceDescriptors: 3-5 adjectives that describe the brand voice (e.g., ["Professional", "Friendly", "Authoritative"])
- brandPromise: The core promise the brand makes to customers (1 sentence)
- brandPersonality: 3-5 personality traits (e.g., ["Innovative", "Reliable", "Customer-focused"])
- toneOfVoice: Overall tone description (e.g., "Professional yet approachable", "Bold and confident")

Analyze:
- Headlines and hero sections
- How they describe themselves
- The language and word choices they use
- The emotional appeals they make
- Imagery and messaging themes

Return a JSON object with these fields. Omit any field where you cannot make a confident extraction.
Also include a "confidence" object with 0-1 scores for each field you include.`,
        },
        {
          role: 'user',
          content: `Extract brand information from this website data:\n\n${context}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
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

    const parsed = JSON.parse(content) as BrandExtraction & { confidence?: Record<string, number> };
    const confidences = parsed.confidence || {};

    // Map extracted fields - brand fields have moderate confidence
    if (parsed.tagline) {
      fields.push({
        path: 'brand.tagline',
        value: parsed.tagline,
        confidence: confidences.tagline ?? 0.75,
        reasoning: 'Extracted from homepage hero or meta description',
      });
    }

    if (parsed.voiceDescriptors && parsed.voiceDescriptors.length > 0) {
      fields.push({
        path: 'brand.voiceDescriptors',
        value: parsed.voiceDescriptors,
        confidence: confidences.voiceDescriptors ?? 0.6,
        reasoning: 'Inferred from writing style and word choices',
      });
    }

    if (parsed.brandPromise) {
      fields.push({
        path: 'brand.brandPromise',
        value: parsed.brandPromise,
        confidence: confidences.brandPromise ?? 0.6,
        reasoning: 'Synthesized from value proposition and messaging',
      });
    }

    if (parsed.brandPersonality && parsed.brandPersonality.length > 0) {
      fields.push({
        path: 'brand.brandPersonality',
        value: parsed.brandPersonality,
        confidence: confidences.brandPersonality ?? 0.55,
        reasoning: 'Inferred from overall brand presentation',
      });
    }

    if (parsed.toneOfVoice) {
      fields.push({
        path: 'brand.toneOfVoice',
        value: parsed.toneOfVoice,
        confidence: confidences.toneOfVoice ?? 0.6,
        reasoning: 'Analyzed from content style and language patterns',
      });
    }

    diagnostics.push({
      code: 'EXTRACTION_SUCCESS',
      message: `Extracted ${fields.length} brand fields`,
      severity: 'info',
    });
  } catch (error) {
    diagnostics.push({
      code: 'EXTRACTION_ERROR',
      message: `Brand extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      severity: 'error',
    });
  }

  return { fields, diagnostics, source: 'fcb' };
}
