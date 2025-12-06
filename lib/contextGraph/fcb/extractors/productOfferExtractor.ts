// lib/contextGraph/fcb/extractors/productOfferExtractor.ts
// Product/Offer Extractor for FCB
//
// Extracts productOffer domain fields from website signals:
// - primaryProducts, services
// - valueProposition, pricingModel
// - keyDifferentiators

import OpenAI from 'openai';
import type { SignalBundle, ExtractorResult, ExtractedField, ExtractorDiagnostic } from '../types';

// ============================================================================
// Types
// ============================================================================

interface ProductOfferExtraction {
  primaryProducts?: string[];
  services?: string[];
  valueProposition?: string;
  pricingModel?: string;
  keyDifferentiators?: string[];
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

  // Schema.org products/services
  if (signals.schemaOrg?.product && signals.schemaOrg.product.length > 0) {
    const products = signals.schemaOrg.product
      .map(p => `- ${p.name}: ${p.description || 'No description'}`)
      .join('\n');
    sections.push(`## Schema.org Products\n${products}`);
  }

  if (signals.schemaOrg?.service && signals.schemaOrg.service.length > 0) {
    const services = signals.schemaOrg.service
      .map(s => `- ${s.name}: ${s.description || 'No description'}`)
      .join('\n');
    sections.push(`## Schema.org Services\n${services}`);
  }

  // Homepage text
  if (signals.homepage.text) {
    const truncated = signals.homepage.text.slice(0, 2500);
    sections.push(`## Homepage Text (first 2500 chars)\n${truncated}`);
  }

  // Services page - primary source
  if (signals.servicesPage?.text) {
    const truncated = signals.servicesPage.text.slice(0, 3000);
    sections.push(`## Services Page Text (first 3000 chars)\n${truncated}`);
  }

  // Pricing page
  if (signals.pricingPage?.text) {
    const truncated = signals.pricingPage.text.slice(0, 2000);
    sections.push(`## Pricing Page Text (first 2000 chars)\n${truncated}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Main Extractor
// ============================================================================

export async function extractProductOffer(signals: SignalBundle): Promise<ExtractorResult> {
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
          content: `You are an expert at extracting product and service offerings from website content.

Your task is to extract the following fields. Only include fields where you have reasonable confidence.

Fields to extract:
- primaryProducts: Array of main products sold (e.g., ["Widget Pro", "Widget Enterprise"])
- services: Array of services offered (e.g., ["Installation", "Maintenance", "Consulting"])
- valueProposition: The core value proposition or unique selling point (1-2 sentences)
- pricingModel: How the company prices (e.g., "Per project", "Monthly subscription", "Hourly rate", "Quote-based")
- keyDifferentiators: Array of what makes them different (e.g., ["24/7 support", "10-year warranty", "Local team"])

Look for:
- Services/Products pages
- "What we offer" sections
- Pricing information
- "Why choose us" content
- Competitive differentiators

Return a JSON object with these fields. Omit any field where you cannot make a confident extraction.
Also include a "confidence" object with 0-1 scores for each field you include.`,
        },
        {
          role: 'user',
          content: `Extract product/offer information from this website data:\n\n${context}`,
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

    const parsed = JSON.parse(content) as ProductOfferExtraction & { confidence?: Record<string, number> };
    const confidences = parsed.confidence || {};

    // Map extracted fields
    if (parsed.primaryProducts && parsed.primaryProducts.length > 0) {
      fields.push({
        path: 'productOffer.primaryProducts',
        value: parsed.primaryProducts,
        confidence: confidences.primaryProducts ?? 0.75,
        reasoning: 'Extracted from product listings and service pages',
      });
    }

    if (parsed.services && parsed.services.length > 0) {
      fields.push({
        path: 'productOffer.services',
        value: parsed.services,
        confidence: confidences.services ?? 0.8,
        reasoning: 'Extracted from services page and navigation',
      });
    }

    if (parsed.valueProposition) {
      fields.push({
        path: 'productOffer.valueProposition',
        value: parsed.valueProposition,
        confidence: confidences.valueProposition ?? 0.7,
        reasoning: 'Synthesized from homepage messaging and differentiators',
      });
    }

    if (parsed.pricingModel) {
      fields.push({
        path: 'productOffer.pricingModel',
        value: parsed.pricingModel,
        confidence: confidences.pricingModel ?? 0.65,
        reasoning: 'Inferred from pricing page or service descriptions',
      });
    }

    if (parsed.keyDifferentiators && parsed.keyDifferentiators.length > 0) {
      fields.push({
        path: 'productOffer.keyDifferentiators',
        value: parsed.keyDifferentiators,
        confidence: confidences.keyDifferentiators ?? 0.7,
        reasoning: 'Extracted from "why choose us" and competitive content',
      });
    }

    diagnostics.push({
      code: 'EXTRACTION_SUCCESS',
      message: `Extracted ${fields.length} productOffer fields`,
      severity: 'info',
    });
  } catch (error) {
    diagnostics.push({
      code: 'EXTRACTION_ERROR',
      message: `ProductOffer extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      severity: 'error',
    });
  }

  return { fields, diagnostics, source: 'fcb' };
}
