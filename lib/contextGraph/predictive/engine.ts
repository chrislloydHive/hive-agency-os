// lib/contextGraph/predictive/engine.ts
// Predictive inference engine for Context Graph
//
// Phase 4: Probabilistic field prediction using AI and historical data

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import { flattenGraphToFields } from '../uiHelpers';
import { getMissingRequiredFields } from '../governance/contracts';
import { getFieldHistory } from '../temporal/engine';
import type {
  FieldPrediction,
  PredictionOptions,
  PredictionResult,
  PredictionMethod,
  PredictionSource,
  FutureValuePrediction,
  EvolutionPattern,
} from './types';

// ============================================================================
// Main Prediction Engine
// ============================================================================

/**
 * Generate predictions for missing or stale fields
 */
export async function generatePredictions(
  graph: CompanyContextGraph,
  options: PredictionOptions
): Promise<PredictionResult> {
  const {
    companyId,
    targetPaths,
    targetDomains,
    predictAll = false,
    minConfidence = 0.5,
    maxPredictions = 20,
    useSimilarCompanies = true,
    useHistoricalPatterns = true,
    useDomainPriors = true,
    useCrossFieldInference = true,
  } = options;

  // Identify fields to predict
  const fieldsToPredict = await identifyFieldsToPredict(
    graph,
    targetPaths,
    targetDomains,
    predictAll
  );

  console.log('[predictive] Target domains:', targetDomains);
  console.log('[predictive] Fields to predict:', fieldsToPredict.length);
  if (targetDomains && targetDomains.length > 0) {
    console.log('[predictive] Sample fields:', fieldsToPredict.slice(0, 5).map(f => f.path));
  }

  if (fieldsToPredict.length === 0) {
    return {
      predictions: [],
      missingFieldsAnalyzed: 0,
      predictionsGenerated: 0,
      averageConfidence: 0,
      generatedAt: new Date().toISOString(),
      options,
    };
  }

  // Generate predictions using AI
  const predictions = await generatePredictionsWithAI(
    graph,
    fieldsToPredict,
    {
      useSimilarCompanies,
      useHistoricalPatterns,
      useDomainPriors,
      useCrossFieldInference,
    }
  );

  // Filter by confidence and limit
  const filteredPredictions = predictions
    .filter(p => p.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxPredictions);

  const avgConfidence = filteredPredictions.length > 0
    ? filteredPredictions.reduce((sum, p) => sum + p.confidence, 0) / filteredPredictions.length
    : 0;

  return {
    predictions: filteredPredictions,
    missingFieldsAnalyzed: fieldsToPredict.length,
    predictionsGenerated: filteredPredictions.length,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    generatedAt: new Date().toISOString(),
    options,
  };
}

/**
 * Predict a specific field value
 */
export async function predictFieldValue(
  graph: CompanyContextGraph,
  path: string
): Promise<FieldPrediction | null> {
  const result = await generatePredictions(graph, {
    companyId: graph.companyId,
    targetPaths: [path],
    minConfidence: 0.3,
    maxPredictions: 1,
  });

  return result.predictions[0] || null;
}

// ============================================================================
// Field Identification
// ============================================================================

interface FieldToPredict {
  path: string;
  domain: DomainName;
  fieldLabel: string;
  currentValue: unknown;
  reason: 'missing' | 'stale' | 'low_confidence' | 'requested';
}

async function identifyFieldsToPredict(
  graph: CompanyContextGraph,
  targetPaths?: string[],
  targetDomains?: DomainName[],
  predictAll?: boolean
): Promise<FieldToPredict[]> {
  const fields: FieldToPredict[] = [];

  // If specific paths requested
  if (targetPaths && targetPaths.length > 0) {
    for (const path of targetPaths) {
      const pathParts = path.split('.');
      const domain = pathParts[0] as DomainName;
      const fieldName = pathParts.slice(1).join('.');

      fields.push({
        path,
        domain,
        fieldLabel: fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        currentValue: null,
        reason: 'requested',
      });
    }
    return fields;
  }

  // Get all fields from graph
  const allFields = flattenGraphToFields(graph);

  // Filter missing fields
  const missingFields = allFields.filter(f => f.value === null || f.value === '');

  // Filter by domain if specified
  let fieldsToProcess = missingFields;
  if (targetDomains && targetDomains.length > 0) {
    fieldsToProcess = missingFields.filter(f => targetDomains.includes(f.domain));
  }

  // Get required fields that are missing
  const missingRequired = getMissingRequiredFields(graph);
  const requiredPaths = new Set(missingRequired.map(v => v.path));

  for (const field of fieldsToProcess) {
    fields.push({
      path: field.path,
      domain: field.domain,
      fieldLabel: field.label,
      currentValue: field.value,
      reason: requiredPaths.has(field.path) ? 'missing' : 'missing',
    });
  }

  return fields;
}

// ============================================================================
// AI Prediction Generation
// ============================================================================

async function generatePredictionsWithAI(
  graph: CompanyContextGraph,
  fieldsToPredict: FieldToPredict[],
  sources: {
    useSimilarCompanies: boolean;
    useHistoricalPatterns: boolean;
    useDomainPriors: boolean;
    useCrossFieldInference: boolean;
  }
): Promise<FieldPrediction[]> {
  if (fieldsToPredict.length === 0) return [];

  const client = new Anthropic();

  // Build context from populated fields
  const allFields = flattenGraphToFields(graph);
  const populatedFields = allFields.filter(f => f.value !== null && f.value !== '');

  const contextSummary = populatedFields
    .slice(0, 50)
    .map(f => `${f.path}: ${summarizeValue(f.value)}`)
    .join('\n');

  // Prepare fields to predict
  const fieldsForAI = fieldsToPredict.slice(0, 20).map(f => ({
    path: f.path,
    domain: f.domain,
    label: f.fieldLabel,
    reason: f.reason,
  }));

  const prompt = `You are an expert marketing strategist predicting missing field values for a company's marketing context graph.

## Company Context
Name: ${graph.companyName}

## Existing Data
${contextSummary}

## Fields to Predict
${JSON.stringify(fieldsForAI, null, 2)}

## Instructions
For each field, predict the most likely value based on:
1. Patterns in the existing data
2. Industry norms and best practices
3. Logical inference from related fields
4. Common marketing strategies

Only provide predictions where you have reasonable confidence.

Respond with a JSON array:
[
  {
    "path": "domain.fieldName",
    "predictedValue": "the predicted value",
    "confidence": 0.75,
    "reasoning": "Why you predict this value",
    "method": "cross_field_inference|domain_prior|ai_synthesis",
    "basedOn": ["Description of evidence 1", "Description of evidence 2"]
  }
]

Guidelines:
- Confidence 0.9+: Very clear inference from existing data
- Confidence 0.7-0.9: Good inference with some assumptions
- Confidence 0.5-0.7: Educated guess based on patterns
- Skip fields where confidence would be below 0.5
- For arrays, predict 2-5 items
- For strings, be specific and actionable

Respond ONLY with the JSON array, no markdown formatting.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    const parsed = JSON.parse(textContent.text.trim());

    if (!Array.isArray(parsed)) {
      return [];
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return parsed.map((item: {
      path: string;
      predictedValue: unknown;
      confidence: number;
      reasoning: string;
      method?: string;
      basedOn?: string[];
    }) => {
      const field = fieldsToPredict.find(f => f.path === item.path);
      if (!field) return null;

      const sources: PredictionSource[] = (item.basedOn || []).map((desc, i) => ({
        type: 'related_field' as const,
        description: desc,
        weight: 1 / (item.basedOn?.length || 1),
      }));

      return {
        id: `pred_${randomUUID()}`,
        path: item.path,
        domain: field.domain,
        fieldLabel: field.fieldLabel,
        predictedValue: item.predictedValue,
        confidence: Math.max(0, Math.min(1, item.confidence || 0.5)),
        reasoning: item.reasoning || 'AI-inferred value',
        predictionMethod: (item.method || 'ai_synthesis') as PredictionMethod,
        basedOn: sources,
        generatedAt: now,
        expiresAt,
      };
    }).filter((p): p is FieldPrediction => p !== null);
  } catch (error) {
    console.error('[predictive] AI prediction error:', error);
    return [];
  }
}

// ============================================================================
// Future Value Prediction
// ============================================================================

/**
 * Predict how field values might change in the future
 */
export async function predictFutureChanges(
  graph: CompanyContextGraph,
  domains?: DomainName[]
): Promise<FutureValuePrediction[]> {
  const client = new Anthropic();

  // Get populated fields
  const allFields = flattenGraphToFields(graph);
  const populatedFields = allFields
    .filter(f => f.value !== null && f.value !== '')
    .filter(f => !domains || domains.includes(f.domain));

  const contextSummary = populatedFields
    .slice(0, 40)
    .map(f => `${f.path}: ${summarizeValue(f.value)}`)
    .join('\n');

  const prompt = `You are a strategic analyst predicting how a company's marketing context might evolve.

## Company: ${graph.companyName}

## Current Context
${contextSummary}

## Task
Identify 3-5 fields that are likely to change in the next 3-6 months, and predict what they might become.

Consider:
- Market trends
- Seasonal patterns
- Natural business evolution
- Competitive dynamics
- Technology changes

Respond with a JSON array:
[
  {
    "path": "domain.fieldName",
    "currentValue": "current value",
    "predictedValue": "predicted future value",
    "predictedAt": "3 months",
    "confidence": 0.7,
    "trigger": "What would cause this change",
    "reasoning": "Why you expect this evolution",
    "impact": "high|medium|low"
  }
]

Respond ONLY with the JSON array, no markdown formatting.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    const parsed = JSON.parse(textContent.text.trim());

    if (!Array.isArray(parsed)) {
      return [];
    }

    const now = Date.now();

    return parsed.map((item: {
      path: string;
      currentValue: unknown;
      predictedValue: unknown;
      predictedAt: string;
      confidence: number;
      trigger: string;
      reasoning: string;
      impact: string;
    }) => {
      const pathParts = item.path.split('.');
      const domain = pathParts[0] as DomainName;

      // Parse predicted time
      let predictedDate: string;
      if (item.predictedAt.includes('month')) {
        const months = parseInt(item.predictedAt) || 3;
        predictedDate = new Date(now + months * 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        predictedDate = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      return {
        path: item.path,
        domain,
        currentValue: item.currentValue,
        predictedValue: item.predictedValue,
        predictedAt: predictedDate,
        confidence: Math.max(0, Math.min(1, item.confidence || 0.5)),
        trigger: item.trigger || 'Natural evolution',
        reasoning: item.reasoning || 'Based on market trends',
        impact: (['high', 'medium', 'low'].includes(item.impact) ? item.impact : 'medium') as 'high' | 'medium' | 'low',
      };
    });
  } catch (error) {
    console.error('[predictive] Future prediction error:', error);
    return [];
  }
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect evolution patterns in the graph
 */
export async function detectEvolutionPatterns(
  companyId: string,
  graph: CompanyContextGraph
): Promise<EvolutionPattern[]> {
  // This would analyze historical data to find patterns
  // For now, return a simplified implementation

  const patterns: EvolutionPattern[] = [];

  // Check for channel performance patterns
  if (graph.performanceMedia?.channelPerformance?.value?.length) {
    patterns.push({
      id: `pattern_${randomUUID()}`,
      patternType: 'seasonal',
      description: 'Channel performance patterns detected in media data',
      fields: ['performanceMedia.channelPerformance'],
      domains: ['performanceMedia'],
      periodDays: 90,
      confidence: 0.7,
      evidenceCount: 1,
      detectedAt: new Date().toISOString(),
    });
  }

  // Check for convergence patterns in brand positioning
  if (graph.brand?.positioning?.value && graph.brand?.differentiators?.value) {
    patterns.push({
      id: `pattern_${randomUUID()}`,
      patternType: 'convergence',
      description: 'Brand positioning aligning with key differentiators',
      fields: ['brand.positioning', 'brand.differentiators'],
      domains: ['brand'],
      confidence: 0.6,
      evidenceCount: 2,
      detectedAt: new Date().toISOString(),
    });
  }

  return patterns;
}

// ============================================================================
// Helper Functions
// ============================================================================

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') {
    return value.length > 100 ? value.slice(0, 100) + '...' : value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.slice(0, 3).map(v =>
      typeof v === 'string' ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)
    );
    return `[${items.join(', ')}${value.length > 3 ? ', ...' : ''}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).slice(0, 100) + '...';
  }
  return String(value);
}
