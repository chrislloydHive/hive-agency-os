// lib/contextGraph/benchmarks/embeddingEngine.ts
// Embedding generation for cross-company similarity
//
// Phase 4: Multi-company learning with embeddings

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import type {
  CompanyEmbedding,
  SimilarityMatch,
  SimilaritySearchOptions,
  CompanyClassification,
  IndustryCategory,
  ScaleCategory,
} from './types';

// ============================================================================
// Embedding Storage (In-memory for now, replace with DB)
// ============================================================================

/** Store of company embeddings */
const embeddingStore = new Map<string, CompanyEmbedding>();

/** Store of company classifications */
const classificationStore = new Map<string, CompanyClassification>();

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Source domains and fields for embedding generation
 */
const EMBEDDING_SOURCES: Array<{ domain: DomainName; fields: string[] }> = [
  { domain: 'identity', fields: ['companyName', 'industry', 'companySize'] },
  { domain: 'brand', fields: ['positioning', 'voiceTone', 'differentiators'] },
  { domain: 'objectives', fields: ['primaryGoal', 'targetMetrics', 'timeline'] },
  { domain: 'audience', fields: ['primaryAudience', 'secondaryAudiences', 'buyerJourney'] },
  { domain: 'productOffer', fields: ['productName', 'pricePoint', 'valueProps'] },
  { domain: 'performanceMedia', fields: ['channels', 'targetCpa', 'bestChannels'] },
];

/**
 * Generate embedding for a company
 */
export async function generateCompanyEmbedding(
  companyId: string,
  companyName: string,
  graph: CompanyContextGraph
): Promise<CompanyEmbedding> {
  // Extract relevant data from graph
  const sourceData = extractSourceData(graph);
  const completeness = calculateCompleteness(sourceData);

  // Generate embedding using AI
  const embedding = await generateEmbeddingVector(sourceData);

  const companyEmbedding: CompanyEmbedding = {
    companyId,
    companyName,
    embedding,
    sourceDomains: EMBEDDING_SOURCES.map(s => s.domain),
    sourceFields: EMBEDDING_SOURCES.flatMap(s => s.fields.map(f => `${s.domain}.${f}`)),
    generatedAt: new Date().toISOString(),
    generatedBy: 'ai',
    version: '1.0',
    completeness,
    confidence: completeness * 0.9,  // Confidence scales with completeness
  };

  // Store embedding
  embeddingStore.set(companyId, companyEmbedding);

  // Also classify the company
  await classifyCompany(companyId, graph);

  return companyEmbedding;
}

function extractSourceData(graph: CompanyContextGraph): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const source of EMBEDDING_SOURCES) {
    const domain = graph[source.domain];
    if (!domain) continue;

    for (const field of source.fields) {
      const fieldData = (domain as Record<string, unknown>)[field];
      if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
        const value = (fieldData as { value: unknown }).value;
        if (value !== null && value !== undefined) {
          data[`${source.domain}.${field}`] = value;
        }
      }
    }
  }

  return data;
}

function calculateCompleteness(data: Record<string, unknown>): number {
  const totalFields = EMBEDDING_SOURCES.reduce((sum, s) => sum + s.fields.length, 0);
  const populatedFields = Object.keys(data).length;
  return populatedFields / totalFields;
}

async function generateEmbeddingVector(data: Record<string, unknown>): Promise<number[]> {
  // For production, use a dedicated embedding model
  // For now, generate a deterministic pseudo-embedding based on data characteristics

  const EMBEDDING_DIM = 128;
  const embedding = new Array(EMBEDDING_DIM).fill(0);

  // Create a text representation
  const textRepresentation = JSON.stringify(data);

  // Generate embedding using AI
  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Generate a ${EMBEDDING_DIM}-dimensional embedding vector for this company profile.
Return ONLY a JSON array of ${EMBEDDING_DIM} floats between -1 and 1.

Company data:
${textRepresentation}

Return ONLY the JSON array, no other text.`,
      }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      try {
        const parsed = JSON.parse(textContent.text.trim());
        if (Array.isArray(parsed) && parsed.length === EMBEDDING_DIM) {
          return parsed.map(v => Math.max(-1, Math.min(1, Number(v) || 0)));
        }
      } catch {
        // Fall through to deterministic fallback
      }
    }
  } catch (error) {
    console.error('[embedding] AI embedding generation failed:', error);
  }

  // Fallback: deterministic pseudo-embedding
  let hash = 0;
  for (let i = 0; i < textRepresentation.length; i++) {
    hash = ((hash << 5) - hash) + textRepresentation.charCodeAt(i);
    hash = hash & hash;
  }

  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const seed = hash + i * 31;
    embedding[i] = (Math.sin(seed) + Math.cos(seed * 1.5)) / 2;
  }

  return embedding;
}

// ============================================================================
// Company Classification
// ============================================================================

async function classifyCompany(
  companyId: string,
  graph: CompanyContextGraph
): Promise<CompanyClassification> {
  const identity = graph.identity;
  const budgetOps = graph.budgetOps;

  // Infer industry
  const industry = inferIndustry(graph);

  // Infer scale from budget
  const scale = inferScale(graph);

  const classification: CompanyClassification = {
    companyId,
    industry: industry.category,
    industryConfidence: industry.confidence,
    subIndustry: industry.subIndustry,
    scale: scale.category,
    scaleConfidence: scale.confidence,
    tags: inferTags(graph),
    classifiedAt: new Date().toISOString(),
    classifiedBy: 'inferred',
  };

  classificationStore.set(companyId, classification);
  return classification;
}

function inferIndustry(graph: CompanyContextGraph): {
  category: IndustryCategory;
  confidence: number;
  subIndustry?: string;
} {
  const identity = graph.identity;
  const industryField = identity?.industry as { value?: string } | undefined;
  const industryValue = industryField?.value?.toLowerCase() || '';

  // Direct mapping
  const industryMap: Record<string, IndustryCategory> = {
    'technology': 'technology',
    'tech': 'technology',
    'software': 'saas',
    'saas': 'saas',
    'ecommerce': 'ecommerce',
    'e-commerce': 'ecommerce',
    'retail': 'retail',
    'fintech': 'fintech',
    'finance': 'fintech',
    'healthcare': 'healthcare',
    'health': 'healthcare',
    'education': 'education',
    'edtech': 'education',
    'media': 'media_entertainment',
    'entertainment': 'media_entertainment',
    'travel': 'travel_hospitality',
    'hospitality': 'travel_hospitality',
    'real estate': 'real_estate',
    'automotive': 'automotive',
    'food': 'food_beverage',
    'beverage': 'food_beverage',
    'manufacturing': 'manufacturing',
    'professional services': 'professional_services',
    'consulting': 'professional_services',
  };

  for (const [keyword, category] of Object.entries(industryMap)) {
    if (industryValue.includes(keyword)) {
      return { category, confidence: 0.8, subIndustry: industryValue };
    }
  }

  return { category: 'other', confidence: 0.3 };
}

function inferScale(graph: CompanyContextGraph): {
  category: ScaleCategory;
  confidence: number;
} {
  const budgetOps = graph.budgetOps;
  const budgetField = budgetOps?.totalMarketingBudget as { value?: number } | undefined;
  const annualBudget = budgetField?.value || 0;

  if (annualBudget > 100_000_000) {
    return { category: 'enterprise', confidence: 0.9 };
  } else if (annualBudget > 25_000_000) {
    return { category: 'large', confidence: 0.85 };
  } else if (annualBudget > 5_000_000) {
    return { category: 'medium', confidence: 0.8 };
  } else if (annualBudget > 1_000_000) {
    return { category: 'small', confidence: 0.75 };
  } else if (annualBudget > 0) {
    return { category: 'startup', confidence: 0.7 };
  }

  // Default if no budget data
  return { category: 'small', confidence: 0.3 };
}

function inferTags(graph: CompanyContextGraph): string[] {
  const tags: string[] = [];

  // Check for B2B vs B2C based on demographics
  const audience = graph.audience;
  const demographics = (audience?.demographics as { value?: string })?.value || '';
  if (demographics.toLowerCase().includes('business') ||
      demographics.toLowerCase().includes('b2b') ||
      demographics.toLowerCase().includes('enterprise')) {
    tags.push('b2b');
  } else if (demographics.toLowerCase().includes('consumer') ||
             demographics.toLowerCase().includes('b2c')) {
    tags.push('b2c');
  }

  // Check active channels
  const media = graph.performanceMedia;
  const activeChannels = (media?.activeChannels as { value?: string[] })?.value || [];
  for (const channel of activeChannels) {
    const channelStr = String(channel).toLowerCase();
    if (channelStr.includes('google')) tags.push('paid_search');
    if (channelStr.includes('meta') || channelStr.includes('facebook')) tags.push('social_advertising');
    if (channelStr.includes('linkedin')) tags.push('linkedin_advertising');
    if (channelStr.includes('programmatic') || channelStr.includes('dsp')) tags.push('programmatic');
  }

  // Check for forms and live chat as proxy for ecommerce/lead gen
  const website = graph.website;
  const hasContactForm = (website?.hasContactForm as { value?: boolean })?.value;
  if (hasContactForm) tags.push('lead_generation');

  return tags;
}

// ============================================================================
// Similarity Search
// ============================================================================

/**
 * Find companies similar to a given company
 */
export function findSimilarCompanies(
  companyId: string,
  options: SimilaritySearchOptions = {}
): SimilarityMatch[] {
  const {
    limit = 10,
    minSimilarity = 0.5,
    weightByDimension,
    excludeCompanyIds = [],
    filterByIndustry,
  } = options;

  const sourceEmbedding = embeddingStore.get(companyId);
  if (!sourceEmbedding) {
    return [];
  }

  const sourceClassification = classificationStore.get(companyId);
  const results: SimilarityMatch[] = [];

  for (const [otherId, otherEmbedding] of embeddingStore) {
    // Skip self and excluded
    if (otherId === companyId || excludeCompanyIds.includes(otherId)) {
      continue;
    }

    // Filter by industry if specified
    if (filterByIndustry) {
      const otherClassification = classificationStore.get(otherId);
      if (otherClassification?.industry !== filterByIndustry) {
        continue;
      }
    }

    // Calculate similarity
    const similarity = calculateSimilarity(
      sourceEmbedding.embedding,
      otherEmbedding.embedding,
      weightByDimension
    );

    if (similarity >= minSimilarity) {
      const otherClassification = classificationStore.get(otherId);

      results.push({
        companyId: otherId,
        companyName: otherEmbedding.companyName,
        similarity,
        dimensionSimilarity: calculateDimensionSimilarity(
          sourceEmbedding.embedding,
          otherEmbedding.embedding
        ),
        matchingAspects: findMatchingAspects(
          sourceClassification,
          otherClassification
        ),
        differentiatingAspects: findDifferentiatingAspects(
          sourceClassification,
          otherClassification
        ),
      });
    }
  }

  // Sort by similarity and limit
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function calculateSimilarity(
  embedding1: number[],
  embedding2: number[],
  weights?: Partial<Record<string, number>>
): number {
  // Cosine similarity
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return Math.max(0, Math.min(1, (similarity + 1) / 2));  // Normalize to 0-1
}

function calculateDimensionSimilarity(
  embedding1: number[],
  embedding2: number[]
): SimilarityMatch['dimensionSimilarity'] {
  // Split embedding into dimensions (16 values each for 128-dim embedding)
  const dimSize = Math.floor(embedding1.length / 7);

  const getDimSimilarity = (startIdx: number): number => {
    const slice1 = embedding1.slice(startIdx, startIdx + dimSize);
    const slice2 = embedding2.slice(startIdx, startIdx + dimSize);
    return calculateSimilarity(slice1, slice2);
  };

  return {
    industry: getDimSimilarity(0),
    scale: getDimSimilarity(dimSize),
    maturity: getDimSimilarity(dimSize * 2),
    channels: getDimSimilarity(dimSize * 3),
    audience: getDimSimilarity(dimSize * 4),
    brand: getDimSimilarity(dimSize * 5),
    objectives: getDimSimilarity(dimSize * 6),
  };
}

function findMatchingAspects(
  class1?: CompanyClassification,
  class2?: CompanyClassification
): string[] {
  const matching: string[] = [];

  if (!class1 || !class2) return matching;

  if (class1.industry === class2.industry) {
    matching.push(`Same industry: ${class1.industry}`);
  }
  if (class1.scale === class2.scale) {
    matching.push(`Same scale: ${class1.scale}`);
  }

  const commonTags = class1.tags.filter(t => class2.tags.includes(t));
  for (const tag of commonTags) {
    matching.push(`Shared characteristic: ${tag}`);
  }

  return matching;
}

function findDifferentiatingAspects(
  class1?: CompanyClassification,
  class2?: CompanyClassification
): string[] {
  const differentiating: string[] = [];

  if (!class1 || !class2) return differentiating;

  if (class1.industry !== class2.industry) {
    differentiating.push(`Different industry: ${class1.industry} vs ${class2.industry}`);
  }
  if (class1.scale !== class2.scale) {
    differentiating.push(`Different scale: ${class1.scale} vs ${class2.scale}`);
  }

  return differentiating;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Generate embeddings for all companies
 */
export async function generateAllEmbeddings(
  companies: Array<{ id: string; name: string; graph: CompanyContextGraph }>
): Promise<CompanyEmbedding[]> {
  const results: CompanyEmbedding[] = [];

  for (const company of companies) {
    try {
      const embedding = await generateCompanyEmbedding(
        company.id,
        company.name,
        company.graph
      );
      results.push(embedding);
    } catch (error) {
      console.error(`[embedding] Failed to generate embedding for ${company.id}:`, error);
    }
  }

  return results;
}

/**
 * Get embedding for a company
 */
export function getCompanyEmbedding(companyId: string): CompanyEmbedding | undefined {
  return embeddingStore.get(companyId);
}

/**
 * Get classification for a company
 */
export function getCompanyClassification(companyId: string): CompanyClassification | undefined {
  return classificationStore.get(companyId);
}

/**
 * Get all embeddings
 */
export function getAllEmbeddings(): CompanyEmbedding[] {
  return Array.from(embeddingStore.values());
}

/**
 * Get embedding stats
 */
export function getEmbeddingStats(): {
  totalCompanies: number;
  averageCompleteness: number;
  byIndustry: Record<string, number>;
  byScale: Record<string, number>;
} {
  const embeddings = getAllEmbeddings();
  const classifications = Array.from(classificationStore.values());

  const byIndustry: Record<string, number> = {};
  const byScale: Record<string, number> = {};

  for (const classification of classifications) {
    byIndustry[classification.industry] = (byIndustry[classification.industry] || 0) + 1;
    byScale[classification.scale] = (byScale[classification.scale] || 0) + 1;
  }

  return {
    totalCompanies: embeddings.length,
    averageCompleteness: embeddings.length > 0
      ? embeddings.reduce((sum, e) => sum + e.completeness, 0) / embeddings.length
      : 0,
    byIndustry,
    byScale,
  };
}
