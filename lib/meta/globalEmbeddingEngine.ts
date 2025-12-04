// lib/meta/globalEmbeddingEngine.ts
// Phase 6: Global Embedding Engine
//
// Cross-company analytics system that computes embedding vectors for
// similarity search, clustering, outlier detection, and meta-learning.

import Anthropic from '@anthropic-ai/sdk';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  GlobalEmbedding,
  CompanyCluster,
  CompanyOutlierScore,
} from './types';

// ============================================================================
// AI Client
// ============================================================================

const anthropic = new Anthropic();

// ============================================================================
// In-Memory Stores
// ============================================================================

const embeddingStore = new Map<string, GlobalEmbedding>();
const clusterStore = new Map<string, CompanyCluster>();

// ============================================================================
// Embedding Dimensions Configuration
// ============================================================================

const EMBEDDING_DIMENSIONS = {
  brand: ['positioning', 'differentiators', 'toneOfVoice', 'valueProps'],
  audience: ['coreSegments', 'demographics', 'painPoints', 'motivations', 'primaryMarkets'],
  product: ['productLines', 'productCategories', 'avgOrderValue', 'conversionOptIn'],
  media: ['activeChannels', 'totalMonthlySpend', 'blendedCpa', 'blendedRoas'],
  performance: ['conversionRate', 'leadVolume', 'revenueGrowth'],
  temporal: ['seasonalityNotes', 'peakSeasons', 'timeHorizon'],
};

// ============================================================================
// Core Embedding Functions
// ============================================================================

/**
 * Generate a comprehensive global embedding for a company
 */
export async function generateGlobalEmbedding(
  companyId: string,
  companyName: string,
  graph: CompanyContextGraph
): Promise<GlobalEmbedding> {
  const now = new Date().toISOString();

  // Extract dimensional data
  const brandData = extractBrandData(graph);
  const audienceData = extractAudienceData(graph);
  const productData = extractProductData(graph);
  const mediaData = extractMediaData(graph);
  const performanceData = extractPerformanceData(graph);
  const temporalData = extractTemporalData(graph);

  // Generate dimensional vectors using AI
  const [brandVector, audienceVector, productVector, mediaVector, performanceVector, temporalVector] =
    await Promise.all([
      generateDimensionalVector('brand', brandData),
      generateDimensionalVector('audience', audienceData),
      generateDimensionalVector('product', productData),
      generateDimensionalVector('media', mediaData),
      generateDimensionalVector('performance', performanceData),
      generateDimensionalVector('temporal', temporalData),
    ]);

  // Combine into unified embedding
  const embedding = [
    ...brandVector,
    ...audienceVector,
    ...productVector,
    ...mediaVector,
    ...performanceVector,
    ...temporalVector,
  ];

  // Calculate completeness
  const completeness = calculateCompleteness(graph);

  const globalEmbedding: GlobalEmbedding = {
    companyId,
    companyName,
    embedding,
    brandVector,
    audienceVector,
    productVector,
    mediaVector,
    performanceVector,
    temporalVector,
    industry: (graph.identity?.industry?.value as string) || 'Unknown',
    businessModel: (graph.identity?.businessModel?.value as string) || 'Unknown',
    companySize: inferCompanySize(graph),
    maturityStage: inferMaturityStage(graph),
    completeness,
    confidence: completeness * 0.9,
    lastUpdated: now,
    version: '2.0',
  };

  // Store the embedding
  embeddingStore.set(companyId, globalEmbedding);

  return globalEmbedding;
}

/**
 * Find similar companies globally
 */
export async function findSimilarCompaniesGlobal(
  companyId: string,
  options: {
    limit?: number;
    minSimilarity?: number;
    sameIndustryOnly?: boolean;
    excludeCompanyIds?: string[];
  } = {}
): Promise<Array<{ companyId: string; companyName: string; similarity: number; matchingDimensions: string[] }>> {
  const { limit = 10, minSimilarity = 0.5, sameIndustryOnly = false, excludeCompanyIds = [] } = options;

  const targetEmbedding = embeddingStore.get(companyId);
  if (!targetEmbedding) {
    console.warn(`[GlobalEmbedding] No embedding found for company ${companyId}`);
    return [];
  }

  const similarities: Array<{
    companyId: string;
    companyName: string;
    similarity: number;
    matchingDimensions: string[];
  }> = [];

  for (const [otherId, otherEmbedding] of embeddingStore) {
    if (otherId === companyId) continue;
    if (excludeCompanyIds.includes(otherId)) continue;
    if (sameIndustryOnly && otherEmbedding.industry !== targetEmbedding.industry) continue;

    // Calculate overall similarity
    const similarity = cosineSimilarity(targetEmbedding.embedding, otherEmbedding.embedding);
    if (similarity < minSimilarity) continue;

    // Find matching dimensions
    const matchingDimensions: string[] = [];
    const dimensionPairs = [
      { name: 'brand', a: targetEmbedding.brandVector, b: otherEmbedding.brandVector },
      { name: 'audience', a: targetEmbedding.audienceVector, b: otherEmbedding.audienceVector },
      { name: 'product', a: targetEmbedding.productVector, b: otherEmbedding.productVector },
      { name: 'media', a: targetEmbedding.mediaVector, b: otherEmbedding.mediaVector },
      { name: 'performance', a: targetEmbedding.performanceVector, b: otherEmbedding.performanceVector },
    ];

    for (const { name, a, b } of dimensionPairs) {
      if (cosineSimilarity(a, b) > 0.7) {
        matchingDimensions.push(name);
      }
    }

    similarities.push({
      companyId: otherId,
      companyName: otherEmbedding.companyName,
      similarity,
      matchingDimensions,
    });
  }

  // Sort by similarity and return top matches
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Find clusters of similar companies
 */
export async function findClusters(
  numberOfClusters: number,
  options: {
    industry?: string;
    minClusterSize?: number;
  } = {}
): Promise<CompanyCluster[]> {
  const { industry, minClusterSize = 3 } = options;

  // Get all embeddings
  let embeddings = Array.from(embeddingStore.values());

  // Filter by industry if specified
  if (industry) {
    embeddings = embeddings.filter(e => e.industry === industry);
  }

  if (embeddings.length < numberOfClusters * minClusterSize) {
    console.warn('[GlobalEmbedding] Not enough companies for clustering');
    return [];
  }

  // Simple k-means clustering
  const clusters = kMeansClustering(embeddings, numberOfClusters);

  // Convert to CompanyCluster format
  const companyClustersList: CompanyCluster[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < clusters.length; i++) {
    const clusterEmbeddings = clusters[i];
    if (clusterEmbeddings.length < minClusterSize) continue;

    // Calculate centroid
    const centroid = calculateCentroid(clusterEmbeddings.map(e => e.embedding));

    // Determine cluster characteristics
    const industries = clusterEmbeddings.map(e => e.industry);
    const businessModels = clusterEmbeddings.map(e => e.businessModel);
    const sizes = clusterEmbeddings.map(e => e.companySize);
    const maturities = clusterEmbeddings.map(e => e.maturityStage);

    const cluster: CompanyCluster = {
      clusterId: `cluster_${i}_${Date.now()}`,
      name: `Cluster ${i + 1}: ${getMostCommon(industries)}`,
      description: await generateClusterDescription(clusterEmbeddings),
      primaryIndustry: getMostCommon(industries),
      primaryBusinessModel: getMostCommon(businessModels),
      avgCompanySize: getMostCommon(sizes),
      avgMaturity: getMostCommon(maturities),
      companyIds: clusterEmbeddings.map(e => e.companyId),
      memberCount: clusterEmbeddings.length,
      centroidEmbedding: centroid,
      cohesion: calculateClusterCohesion(clusterEmbeddings, centroid),
      separation: 0, // Will be calculated after all clusters are formed
      createdAt: now,
      lastUpdated: now,
    };

    companyClustersList.push(cluster);
  }

  // Calculate separation between clusters
  for (const cluster of companyClustersList) {
    cluster.separation = calculateClusterSeparation(cluster, companyClustersList);
  }

  // Store clusters
  for (const cluster of companyClustersList) {
    clusterStore.set(cluster.clusterId, cluster);
  }

  return companyClustersList;
}

/**
 * Calculate outlier score for a company
 */
export async function calculateCompanyOutlierScore(
  companyId: string
): Promise<CompanyOutlierScore | null> {
  const embedding = embeddingStore.get(companyId);
  if (!embedding) {
    return null;
  }

  // Get all embeddings in the same industry
  const industryEmbeddings = Array.from(embeddingStore.values()).filter(
    e => e.industry === embedding.industry && e.companyId !== companyId
  );

  if (industryEmbeddings.length < 3) {
    // Not enough data for comparison
    return null;
  }

  // Calculate dimensional outlier scores
  const dimensionScores = {
    performance: calculateDimensionOutlierScore(
      embedding.performanceVector,
      industryEmbeddings.map(e => e.performanceVector)
    ),
    strategy: calculateDimensionOutlierScore(
      embedding.brandVector,
      industryEmbeddings.map(e => e.brandVector)
    ),
    audience: calculateDimensionOutlierScore(
      embedding.audienceVector,
      industryEmbeddings.map(e => e.audienceVector)
    ),
    creative: calculateDimensionOutlierScore(
      embedding.brandVector.slice(0, 5), // Creative aspects
      industryEmbeddings.map(e => e.brandVector.slice(0, 5))
    ),
    channel: calculateDimensionOutlierScore(
      embedding.mediaVector,
      industryEmbeddings.map(e => e.mediaVector)
    ),
    growth: calculateDimensionOutlierScore(
      embedding.temporalVector,
      industryEmbeddings.map(e => e.temporalVector)
    ),
  };

  // Calculate overall outlier score
  const overallScore =
    Object.values(dimensionScores).reduce((sum, score) => sum + score, 0) /
    Object.keys(dimensionScores).length;

  // Determine outlier type and reasons
  const { outlierType, outlierReasons } = await analyzeOutlierType(
    embedding,
    industryEmbeddings,
    dimensionScores
  );

  // Generate recommendations
  const recommendations = await generateOutlierRecommendations(
    outlierType,
    outlierReasons,
    dimensionScores
  );

  return {
    companyId,
    overallScore,
    dimensionScores,
    outlierReasons,
    outlierType,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Data Extraction Functions
// ============================================================================

function extractBrandData(graph: CompanyContextGraph): Record<string, unknown> {
  return {
    positioning: graph.brand?.positioning?.value,
    differentiators: graph.brand?.differentiators?.value,
    toneOfVoice: graph.brand?.toneOfVoice?.value,
    valueProps: graph.brand?.valueProps?.value,
    tagline: graph.brand?.tagline?.value,
  };
}

function extractAudienceData(graph: CompanyContextGraph): Record<string, unknown> {
  return {
    coreSegments: graph.audience?.coreSegments?.value,
    demographics: graph.audience?.demographics?.value,
    painPoints: graph.audience?.painPoints?.value,
    motivations: graph.audience?.motivations?.value,
    primaryMarkets: graph.audience?.primaryMarkets?.value,
  };
}

function extractProductData(graph: CompanyContextGraph): Record<string, unknown> {
  return {
    productLines: graph.productOffer?.productLines?.value,
    productCategories: graph.productOffer?.productCategories?.value,
    avgOrderValue: graph.budgetOps?.avgOrderValue?.value,
    conversionOffers: graph.productOffer?.conversionOffers?.value,
  };
}

function extractMediaData(graph: CompanyContextGraph): Record<string, unknown> {
  return {
    activeChannels: graph.performanceMedia?.activeChannels?.value,
    totalMonthlySpend: graph.performanceMedia?.totalMonthlySpend?.value,
    blendedCpa: graph.performanceMedia?.blendedCpa?.value,
    blendedRoas: graph.performanceMedia?.blendedRoas?.value,
  };
}

function extractPerformanceData(graph: CompanyContextGraph): Record<string, unknown> {
  return {
    blendedCpa: graph.performanceMedia?.blendedCpa?.value,
    blendedRoas: graph.performanceMedia?.blendedRoas?.value,
    leadGoal: graph.objectives?.leadGoal?.value,
    revenueGoal: graph.objectives?.revenueGoal?.value,
  };
}

function extractTemporalData(graph: CompanyContextGraph): Record<string, unknown> {
  return {
    seasonalityNotes: graph.identity?.seasonalityNotes?.value,
    peakSeasons: graph.identity?.peakSeasons?.value,
    timeHorizon: graph.objectives?.timeHorizon?.value,
  };
}

// ============================================================================
// Vector Generation
// ============================================================================

async function generateDimensionalVector(
  dimension: string,
  data: Record<string, unknown>
): Promise<number[]> {
  // Filter out null/undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== null && v !== undefined)
  );

  if (Object.keys(cleanData).length === 0) {
    // Return zero vector for empty data
    return new Array(16).fill(0);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Generate a 16-dimensional embedding vector for this ${dimension} data. Return ONLY a JSON array of 16 numbers between -1 and 1.

Data: ${JSON.stringify(cleanData)}

Return format: [0.1, -0.2, 0.3, ...]`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return new Array(16).fill(0);
    }

    const match = content.text.match(/\[[\s\S]*?\]/);
    if (!match) {
      return new Array(16).fill(0);
    }

    const vector = JSON.parse(match[0]) as number[];
    return vector.length === 16 ? vector : new Array(16).fill(0);
  } catch (error) {
    console.error(`[GlobalEmbedding] Error generating ${dimension} vector:`, error);
    return new Array(16).fill(0);
  }
}

// ============================================================================
// Clustering Functions
// ============================================================================

function kMeansClustering(
  embeddings: GlobalEmbedding[],
  k: number,
  maxIterations: number = 50
): GlobalEmbedding[][] {
  if (embeddings.length === 0 || k <= 0) return [];

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const shuffled = [...embeddings].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(k, shuffled.length); i++) {
    centroids.push([...shuffled[i].embedding]);
  }

  let clusters: GlobalEmbedding[][] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign to clusters
    clusters = centroids.map(() => []);

    for (const embedding of embeddings) {
      let bestCluster = 0;
      let bestDistance = Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const distance = euclideanDistance(embedding.embedding, centroids[c]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = c;
        }
      }

      clusters[bestCluster].push(embedding);
    }

    // Update centroids
    let converged = true;
    for (let c = 0; c < centroids.length; c++) {
      if (clusters[c].length === 0) continue;

      const newCentroid = calculateCentroid(clusters[c].map(e => e.embedding));
      if (euclideanDistance(centroids[c], newCentroid) > 0.001) {
        converged = false;
      }
      centroids[c] = newCentroid;
    }

    if (converged) break;
  }

  return clusters.filter(c => c.length > 0);
}

function calculateCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];

  const dimensions = vectors[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vector[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

function calculateClusterCohesion(embeddings: GlobalEmbedding[], centroid: number[]): number {
  if (embeddings.length === 0) return 0;

  const avgDistance =
    embeddings.reduce((sum, e) => sum + euclideanDistance(e.embedding, centroid), 0) /
    embeddings.length;

  // Convert distance to cohesion (0-1, higher is better)
  return Math.max(0, 1 - avgDistance / 2);
}

function calculateClusterSeparation(
  cluster: CompanyCluster,
  allClusters: CompanyCluster[]
): number {
  if (allClusters.length <= 1) return 1;

  const otherClusters = allClusters.filter(c => c.clusterId !== cluster.clusterId);
  const minDistance = Math.min(
    ...otherClusters.map(other =>
      euclideanDistance(cluster.centroidEmbedding, other.centroidEmbedding)
    )
  );

  // Normalize to 0-1
  return Math.min(1, minDistance / 2);
}

async function generateClusterDescription(embeddings: GlobalEmbedding[]): Promise<string> {
  const industries = embeddings.map(e => e.industry);
  const sizes = embeddings.map(e => e.companySize);
  const models = embeddings.map(e => e.businessModel);

  return `A cluster of ${embeddings.length} ${getMostCommon(industries)} companies, primarily ${getMostCommon(sizes)} size with ${getMostCommon(models)} business models.`;
}

// ============================================================================
// Outlier Analysis
// ============================================================================

function calculateDimensionOutlierScore(
  vector: number[],
  compareVectors: number[][]
): number {
  if (compareVectors.length === 0) return 0;

  // Calculate average distance to other vectors
  const distances = compareVectors.map(other => euclideanDistance(vector, other));
  const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const stdDev = Math.sqrt(
    distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length
  );

  // Calculate own distance from mean
  const centroid = calculateCentroid(compareVectors);
  const ownDistance = euclideanDistance(vector, centroid);

  // Z-score based outlier detection
  const zScore = stdDev > 0 ? (ownDistance - avgDistance) / stdDev : 0;

  // Normalize to 0-1
  return Math.min(1, Math.max(0, Math.abs(zScore) / 3));
}

async function analyzeOutlierType(
  embedding: GlobalEmbedding,
  industryEmbeddings: GlobalEmbedding[],
  dimensionScores: Record<string, number>
): Promise<{ outlierType: 'positive' | 'negative' | 'neutral'; outlierReasons: string[] }> {
  const reasons: string[] = [];
  let positiveIndicators = 0;
  let negativeIndicators = 0;

  // Check performance dimension
  if (dimensionScores.performance > 0.6) {
    const avgPerf = calculateCentroid(industryEmbeddings.map(e => e.performanceVector));
    const isOutperforming = embedding.performanceVector.reduce((sum, v, i) => sum + (v - avgPerf[i]), 0) > 0;

    if (isOutperforming) {
      reasons.push('Significantly outperforming industry on key metrics');
      positiveIndicators++;
    } else {
      reasons.push('Underperforming relative to industry peers');
      negativeIndicators++;
    }
  }

  // Check strategy uniqueness
  if (dimensionScores.strategy > 0.6) {
    reasons.push('Unique brand positioning compared to competitors');
    positiveIndicators++; // Unique strategy is often positive
  }

  // Check channel approach
  if (dimensionScores.channel > 0.6) {
    reasons.push('Distinctive channel mix compared to industry norms');
    // Neutral - could be good or bad
  }

  const outlierType: 'positive' | 'negative' | 'neutral' =
    positiveIndicators > negativeIndicators
      ? 'positive'
      : negativeIndicators > positiveIndicators
      ? 'negative'
      : 'neutral';

  return { outlierType, outlierReasons: reasons };
}

async function generateOutlierRecommendations(
  outlierType: 'positive' | 'negative' | 'neutral',
  outlierReasons: string[],
  dimensionScores: Record<string, number>
): Promise<string[]> {
  const recommendations: string[] = [];

  if (outlierType === 'positive') {
    recommendations.push('Document and share successful strategies with similar companies');
    recommendations.push('Consider expanding into adjacent markets or channels');
  } else if (outlierType === 'negative') {
    if (dimensionScores.performance > 0.5) {
      recommendations.push('Review and benchmark against top performers in your industry');
    }
    if (dimensionScores.channel > 0.5) {
      recommendations.push('Evaluate channel mix against industry best practices');
    }
    recommendations.push('Consider strategic pivot or focused optimization');
  } else {
    recommendations.push('Monitor unique positioning for market response');
    recommendations.push('Test whether differentiation drives competitive advantage');
  }

  return recommendations;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function getMostCommon<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let mostCommon = arr[0];
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = item;
    }
  }
  return mostCommon;
}

function calculateCompleteness(graph: CompanyContextGraph): number {
  let filledFields = 0;
  let totalFields = 0;

  for (const [dimension, fields] of Object.entries(EMBEDDING_DIMENSIONS)) {
    for (const field of fields) {
      totalFields++;
      const domain = graph[dimension as keyof CompanyContextGraph] as Record<string, { value: unknown }> | undefined;
      if (domain && domain[field]?.value !== null && domain[field]?.value !== undefined) {
        filledFields++;
      }
    }
  }

  return totalFields > 0 ? filledFields / totalFields : 0;
}

function inferCompanySize(graph: CompanyContextGraph): string {
  const budget = graph.budgetOps?.mediaSpendBudget?.value as number | undefined;
  const revenue = graph.objectives?.revenueGoal?.value as number | undefined;

  if (budget && budget > 1000000) return 'enterprise';
  if (budget && budget > 100000) return 'large';
  if (budget && budget > 10000) return 'medium';
  if (revenue && revenue > 10000000) return 'large';
  if (revenue && revenue > 1000000) return 'medium';
  return 'small';
}

function inferMaturityStage(
  graph: CompanyContextGraph
): 'startup' | 'growth' | 'mature' | 'enterprise' {
  const budget = graph.budgetOps?.mediaSpendBudget?.value as number | undefined;
  const revenue = graph.objectives?.revenueGoal?.value as number | undefined;

  if ((budget && budget > 1000000) || (revenue && revenue > 10000000)) {
    return 'enterprise';
  }
  if ((budget && budget > 100000) || (revenue && revenue > 1000000)) {
    return 'mature';
  }
  if ((budget && budget > 10000) || (revenue && revenue > 100000)) {
    return 'growth';
  }
  return 'startup';
}

// ============================================================================
// Store Access Functions
// ============================================================================

export function getEmbedding(companyId: string): GlobalEmbedding | undefined {
  return embeddingStore.get(companyId);
}

export function getAllEmbeddings(): GlobalEmbedding[] {
  return Array.from(embeddingStore.values());
}

export function getCluster(clusterId: string): CompanyCluster | undefined {
  return clusterStore.get(clusterId);
}

export function getAllClusters(): CompanyCluster[] {
  return Array.from(clusterStore.values());
}

export function getEmbeddingStats(): {
  totalCompanies: number;
  byIndustry: Record<string, number>;
  avgCompleteness: number;
} {
  const embeddings = Array.from(embeddingStore.values());
  const byIndustry: Record<string, number> = {};

  for (const e of embeddings) {
    byIndustry[e.industry] = (byIndustry[e.industry] || 0) + 1;
  }

  const avgCompleteness =
    embeddings.length > 0
      ? embeddings.reduce((sum, e) => sum + e.completeness, 0) / embeddings.length
      : 0;

  return {
    totalCompanies: embeddings.length,
    byIndustry,
    avgCompleteness,
  };
}
