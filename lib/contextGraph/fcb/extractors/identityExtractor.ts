// lib/contextGraph/fcb/extractors/identityExtractor.ts
// Identity Extractor for FCB
//
// Extracts identity domain fields from website signals:
// - businessName, businessDescription, industry
// - businessModel, primaryOffering
// - geographicFootprint, serviceArea
// - foundedYear, companySize

import OpenAI from 'openai';
import type { SignalBundle, ExtractorResult, ExtractedField, ExtractorDiagnostic } from '../types';

// ============================================================================
// Types
// ============================================================================

interface IdentityExtraction {
  businessName?: string;
  businessDescription?: string;
  industry?: string;
  businessModel?: string;
  primaryOffering?: string;
  geographicFootprint?: string;
  serviceArea?: string;
  foundedYear?: number;
  companySize?: string;
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

  // OpenGraph
  if (signals.openGraph.description) {
    sections.push(`## OpenGraph Description
${signals.openGraph.description}`);
  }

  // Schema.org organization
  if (signals.schemaOrg?.organization) {
    const org = signals.schemaOrg.organization;
    const orgLines: string[] = [];
    if (org.name) orgLines.push(`Name: ${org.name}`);
    if (org.description) orgLines.push(`Description: ${org.description}`);
    if (org.address) {
      const addr = org.address;
      orgLines.push(`Location: ${[addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(', ')}`);
    }
    if (orgLines.length > 0) {
      sections.push(`## Schema.org Organization\n${orgLines.join('\n')}`);
    }
  }

  // Local business
  if (signals.schemaOrg?.localBusiness) {
    const biz = signals.schemaOrg.localBusiness;
    const bizLines: string[] = [];
    if (biz.name) bizLines.push(`Name: ${biz.name}`);
    if (biz.description) bizLines.push(`Description: ${biz.description}`);
    if (biz.areaServed) bizLines.push(`Area Served: ${biz.areaServed.join(', ')}`);
    if (biz.serviceArea) bizLines.push(`Service Area: ${biz.serviceArea.join(', ')}`);
    if (bizLines.length > 0) {
      sections.push(`## Schema.org Local Business\n${bizLines.join('\n')}`);
    }
  }

  // Homepage text (truncated)
  if (signals.homepage.text) {
    const truncated = signals.homepage.text.slice(0, 3000);
    sections.push(`## Homepage Text (first 3000 chars)\n${truncated}`);
  }

  // About page text (truncated)
  if (signals.aboutPage?.text) {
    const truncated = signals.aboutPage.text.slice(0, 2000);
    sections.push(`## About Page Text (first 2000 chars)\n${truncated}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Main Extractor
// ============================================================================

export async function extractIdentity(signals: SignalBundle): Promise<ExtractorResult> {
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
          content: `You are an expert at extracting structured business identity information from website content.

Your task is to extract the following fields with high accuracy. Only include fields where you have reasonable confidence in the value.

Fields to extract:
- businessName: The official business name (not domain)
- businessDescription: A 1-2 sentence description of what the business does
- industry: The primary industry (e.g., "Home Services", "Healthcare", "Technology")
- businessModel: The business model type (e.g., "B2B", "B2C", "B2B2C", "Service Provider", "SaaS")
- primaryOffering: What the business primarily sells or offers
- geographicFootprint: Geographic scope (e.g., "National", "Regional", "Local", "International")
- serviceArea: Specific areas served (e.g., "Greater Phoenix, AZ", "Tri-State Area")
- foundedYear: Year the company was founded (number)
- companySize: Size category (e.g., "Small", "Medium", "Enterprise", "1-10 employees", "50-200 employees")

Return a JSON object with these fields. Omit any field where you cannot make a confident extraction.
Also include a "confidence" object with 0-1 scores for each field you include.`,
        },
        {
          role: 'user',
          content: `Extract identity information from this website data:\n\n${context}`,
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

    const parsed = JSON.parse(content) as IdentityExtraction & { confidence?: Record<string, number> };
    const confidences = parsed.confidence || {};

    // Map extracted fields
    if (parsed.businessName) {
      fields.push({
        path: 'identity.businessName',
        value: parsed.businessName,
        confidence: confidences.businessName ?? 0.85,
        reasoning: 'Extracted from website content',
      });
    }

    if (parsed.businessDescription) {
      fields.push({
        path: 'identity.businessDescription',
        value: parsed.businessDescription,
        confidence: confidences.businessDescription ?? 0.8,
        reasoning: 'Synthesized from meta description and page content',
      });
    }

    if (parsed.industry) {
      fields.push({
        path: 'identity.industry',
        value: parsed.industry,
        confidence: confidences.industry ?? 0.75,
        reasoning: 'Inferred from business context and offerings',
      });
    }

    if (parsed.businessModel) {
      fields.push({
        path: 'identity.businessModel',
        value: parsed.businessModel,
        confidence: confidences.businessModel ?? 0.7,
        reasoning: 'Inferred from target audience and service descriptions',
      });
    }

    if (parsed.primaryOffering) {
      fields.push({
        path: 'identity.primaryOffering',
        value: parsed.primaryOffering,
        confidence: confidences.primaryOffering ?? 0.8,
        reasoning: 'Extracted from services and homepage content',
      });
    }

    if (parsed.geographicFootprint) {
      fields.push({
        path: 'identity.geographicFootprint',
        value: parsed.geographicFootprint,
        confidence: confidences.geographicFootprint ?? 0.7,
        reasoning: 'Inferred from service area mentions',
      });
    }

    if (parsed.serviceArea) {
      fields.push({
        path: 'identity.serviceArea',
        value: parsed.serviceArea,
        confidence: confidences.serviceArea ?? 0.75,
        reasoning: 'Extracted from location/service area mentions',
      });
    }

    if (parsed.foundedYear) {
      fields.push({
        path: 'identity.foundedYear',
        value: parsed.foundedYear,
        confidence: confidences.foundedYear ?? 0.9,
        reasoning: 'Extracted from about page or footer',
      });
    }

    if (parsed.companySize) {
      fields.push({
        path: 'identity.companySize',
        value: parsed.companySize,
        confidence: confidences.companySize ?? 0.6,
        reasoning: 'Inferred from company signals',
      });
    }

    diagnostics.push({
      code: 'EXTRACTION_SUCCESS',
      message: `Extracted ${fields.length} identity fields`,
      severity: 'info',
    });
  } catch (error) {
    diagnostics.push({
      code: 'EXTRACTION_ERROR',
      message: `Identity extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      severity: 'error',
    });
  }

  return { fields, diagnostics, source: 'fcb' };
}
