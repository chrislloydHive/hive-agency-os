// lib/competition-v4/modalityInference.ts
// Competition V4 - Automatic Modality Inference
//
// Auto-infers CompetitiveModality from context signals with confidence scoring.
// Outputs a simple Yes/No clarifying question when confidence is low.

import type { CompetitiveModalityType } from './types';
import type { BusinessDecompositionResult } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ModalitySignals {
  // From decomposition
  offeringType?: string;
  economicModel?: string;
  primaryVertical?: string;
  geographicScope?: string;

  // From context graph
  hasServices?: boolean;
  hasProducts?: boolean;
  hasInstallation?: boolean;
  serviceCategories?: string[];
  productCategories?: string[];
  businessModel?: string;
  industry?: string;

  // From website/diagnostics
  websiteSignals?: {
    mentionsInstallation?: boolean;
    mentionsService?: boolean;
    mentionsLocalService?: boolean;
    hasBookingWidget?: boolean;
    hasEcommerce?: boolean;
    hasStoreLocator?: boolean;
  };
}

export interface ModalityInferenceResult {
  /** Inferred modality */
  modality: CompetitiveModalityType;
  /** Confidence in the inference (0-100) */
  confidence: number;
  /** Signals that contributed to the inference */
  signals: string[];
  /** Service emphasis (0-1) */
  serviceEmphasis: number;
  /** Product emphasis (0-1) */
  productEmphasis: number;
  /** Simple clarifying question if confidence < threshold */
  clarifyingQuestion: ClarifyingQuestion | null;
  /** Explanation of inference for debugging */
  explanation: string;
}

export interface ClarifyingQuestion {
  /** Simple yes/no question */
  question: string;
  /** What "yes" means for modality */
  yesImplies: CompetitiveModalityType;
  /** What "no" means for modality */
  noImplies: CompetitiveModalityType;
  /** Context for the question */
  context: string;
}

// ============================================================================
// Signal Detection
// ============================================================================

/**
 * Detect service/installation signals from various sources
 */
function detectServiceSignals(signals: ModalitySignals): {
  hasStrongServiceSignal: boolean;
  serviceScore: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // From explicit flags
  if (signals.hasServices) {
    score += 30;
    reasons.push('Has services flag');
  }
  if (signals.hasInstallation) {
    score += 25;
    reasons.push('Has installation flag');
  }

  // From service categories
  if (signals.serviceCategories && signals.serviceCategories.length > 0) {
    score += Math.min(25, signals.serviceCategories.length * 8);
    reasons.push(`${signals.serviceCategories.length} service categories`);
  }

  // From decomposition
  if (signals.offeringType === 'Labor-Based Service') {
    score += 30;
    reasons.push('Labor-based service offering');
  } else if (signals.offeringType === 'Hybrid') {
    score += 15;
    reasons.push('Hybrid offering type');
  }

  if (signals.economicModel === 'Service') {
    score += 20;
    reasons.push('Service economic model');
  }

  // From website signals
  if (signals.websiteSignals) {
    if (signals.websiteSignals.mentionsInstallation) {
      score += 15;
      reasons.push('Website mentions installation');
    }
    if (signals.websiteSignals.mentionsService) {
      score += 10;
      reasons.push('Website mentions services');
    }
    if (signals.websiteSignals.mentionsLocalService) {
      score += 10;
      reasons.push('Website mentions local service');
    }
    if (signals.websiteSignals.hasBookingWidget) {
      score += 15;
      reasons.push('Has booking widget');
    }
  }

  // From business model keywords
  if (signals.businessModel) {
    const bm = signals.businessModel.toLowerCase();
    if (bm.includes('service') || bm.includes('installation') || bm.includes('repair')) {
      score += 15;
      reasons.push('Business model mentions service');
    }
  }

  // From industry
  if (signals.industry) {
    const ind = signals.industry.toLowerCase();
    const serviceIndustries = ['plumbing', 'hvac', 'electrical', 'automotive', 'installation', 'repair', 'maintenance'];
    if (serviceIndustries.some(s => ind.includes(s))) {
      score += 20;
      reasons.push('Service-oriented industry');
    }
  }

  return {
    hasStrongServiceSignal: score >= 40,
    serviceScore: Math.min(100, score),
    reasons,
  };
}

/**
 * Detect product/retail signals from various sources
 */
function detectProductSignals(signals: ModalitySignals): {
  hasStrongProductSignal: boolean;
  productScore: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // From explicit flags
  if (signals.hasProducts) {
    score += 30;
    reasons.push('Has products flag');
  }

  // From product categories
  if (signals.productCategories && signals.productCategories.length > 0) {
    score += Math.min(25, signals.productCategories.length * 8);
    reasons.push(`${signals.productCategories.length} product categories`);
  }

  // From decomposition
  if (signals.offeringType === 'Physical Goods') {
    score += 30;
    reasons.push('Physical goods offering');
  } else if (signals.offeringType === 'Hybrid') {
    score += 15;
    reasons.push('Hybrid offering type');
  }

  if (signals.economicModel === 'Product') {
    score += 20;
    reasons.push('Product economic model');
  }

  // From website signals
  if (signals.websiteSignals) {
    if (signals.websiteSignals.hasEcommerce) {
      score += 20;
      reasons.push('Has ecommerce');
    }
    if (signals.websiteSignals.hasStoreLocator) {
      score += 10;
      reasons.push('Has store locator');
    }
  }

  // From business model keywords
  if (signals.businessModel) {
    const bm = signals.businessModel.toLowerCase();
    if (bm.includes('retail') || bm.includes('ecommerce') || bm.includes('store')) {
      score += 15;
      reasons.push('Business model mentions retail');
    }
  }

  return {
    hasStrongProductSignal: score >= 40,
    productScore: Math.min(100, score),
    reasons,
  };
}

// ============================================================================
// Modality Inference
// ============================================================================

const CONFIDENCE_THRESHOLD = 60; // Below this, ask clarifying question

/**
 * Infer competitive modality from available signals
 */
export function inferModality(signals: ModalitySignals): ModalityInferenceResult {
  const serviceResult = detectServiceSignals(signals);
  const productResult = detectProductSignals(signals);

  const allReasons = [...serviceResult.reasons, ...productResult.reasons];

  // Normalize to emphasis (0-1)
  const totalScore = serviceResult.serviceScore + productResult.productScore;
  const serviceEmphasis = totalScore > 0 ? serviceResult.serviceScore / totalScore : 0.5;
  const productEmphasis = totalScore > 0 ? productResult.productScore / totalScore : 0.5;

  // Determine modality and confidence
  let modality: CompetitiveModalityType;
  let confidence: number;
  let explanation: string;

  if (serviceResult.hasStrongServiceSignal && productResult.hasStrongProductSignal) {
    // Both strong - hybrid
    modality = 'Retail+Installation';
    confidence = Math.min(85, Math.round((serviceResult.serviceScore + productResult.productScore) / 2));
    explanation = 'Strong signals for both products and services indicate hybrid retail+installation';
  } else if (serviceResult.hasStrongServiceSignal && !productResult.hasStrongProductSignal) {
    // Strong service, weak product
    if (productResult.productScore > 20) {
      modality = 'Retail+Installation';
      confidence = Math.round((serviceResult.serviceScore * 0.7) + (productResult.productScore * 0.3));
      explanation = 'Strong service signals with some product presence';
    } else {
      modality = 'InstallationOnly';
      confidence = serviceResult.serviceScore;
      explanation = 'Strong service signals with minimal product presence';
    }
  } else if (!serviceResult.hasStrongServiceSignal && productResult.hasStrongProductSignal) {
    // Strong product, weak service
    if (serviceResult.serviceScore > 20) {
      modality = 'RetailWithInstallAddon';
      confidence = Math.round((productResult.productScore * 0.7) + (serviceResult.serviceScore * 0.3));
      explanation = 'Strong product signals with optional service add-on';
    } else {
      modality = 'ProductOnly';
      confidence = productResult.productScore;
      explanation = 'Strong product signals with minimal service presence';
    }
  } else {
    // Neither strong - need clarification
    if (serviceResult.serviceScore > productResult.productScore) {
      modality = 'InstallationOnly';
      confidence = Math.max(30, serviceResult.serviceScore);
      explanation = 'Weak signals suggest service focus but confidence is low';
    } else if (productResult.productScore > serviceResult.serviceScore) {
      modality = 'ProductOnly';
      confidence = Math.max(30, productResult.productScore);
      explanation = 'Weak signals suggest product focus but confidence is low';
    } else {
      // Truly ambiguous
      modality = 'ProductOnly';
      confidence = 30;
      explanation = 'Insufficient signals to determine modality';
    }
  }

  // Generate clarifying question if confidence is low
  let clarifyingQuestion: ClarifyingQuestion | null = null;

  if (confidence < CONFIDENCE_THRESHOLD) {
    clarifyingQuestion = generateClarifyingQuestion(modality, serviceResult, productResult);
  }

  return {
    modality,
    confidence,
    signals: allReasons,
    serviceEmphasis,
    productEmphasis,
    clarifyingQuestion,
    explanation,
  };
}

/**
 * Generate a simple clarifying question based on the current inference
 */
function generateClarifyingQuestion(
  currentModality: CompetitiveModalityType,
  serviceResult: { serviceScore: number },
  productResult: { productScore: number }
): ClarifyingQuestion {
  // Choose question based on what's ambiguous
  if (serviceResult.serviceScore > 0 && productResult.productScore > 0) {
    // Both have some signals - clarify relative importance
    return {
      question: 'Do you compete primarily on service/installation quality?',
      yesImplies: 'Retail+Installation',
      noImplies: productResult.productScore > 30 ? 'RetailWithInstallAddon' : 'ProductOnly',
      context: 'This helps us find the right mix of product and service competitors',
    };
  } else if (serviceResult.serviceScore > 0) {
    // Service signals only
    return {
      question: 'Do customers also compare you to big retailers?',
      yesImplies: 'Retail+Installation',
      noImplies: 'InstallationOnly',
      context: 'This determines whether we include national retail brands',
    };
  } else if (productResult.productScore > 0) {
    // Product signals only
    return {
      question: 'Do you offer installation or setup services?',
      yesImplies: 'RetailWithInstallAddon',
      noImplies: 'ProductOnly',
      context: 'This helps us identify service-capable competitors',
    };
  } else {
    // No signals
    return {
      question: 'Is your business primarily about providing a service (vs selling products)?',
      yesImplies: 'InstallationOnly',
      noImplies: 'ProductOnly',
      context: 'We need to understand your competitive landscape',
    };
  }
}

// ============================================================================
// Helper: Build signals from decomposition and context
// ============================================================================

/**
 * Build modality signals from business decomposition result
 */
export function buildSignalsFromDecomposition(
  decomposition: BusinessDecompositionResult
): Partial<ModalitySignals> {
  return {
    offeringType: decomposition.offering_type,
    economicModel: decomposition.economic_model,
    primaryVertical: decomposition.primary_vertical,
    geographicScope: decomposition.geographic_scope,
    hasServices: decomposition.offering_type === 'Labor-Based Service' ||
                 decomposition.offering_type === 'Hybrid',
    hasProducts: decomposition.offering_type === 'Physical Goods' ||
                 decomposition.offering_type === 'Digital Product' ||
                 decomposition.offering_type === 'Hybrid',
  };
}

/**
 * Build modality signals from context graph
 */
export function buildSignalsFromContext(
  graph: {
    productOffer?: {
      primaryProducts?: { value?: unknown };
      services?: { value?: unknown };
      coreServices?: { value?: unknown };
      productCategories?: { value?: unknown };
      serviceCategories?: { value?: unknown };
    };
    identity?: {
      businessModel?: { value?: string };
      industry?: { value?: string };
    };
  } | null
): Partial<ModalitySignals> {
  if (!graph) return {};

  const productOffer = graph.productOffer || {};
  const identity = graph.identity || {};

  const hasProducts = !!(productOffer.primaryProducts?.value ||
                        productOffer.productCategories?.value);

  const hasServices = !!(productOffer.services?.value ||
                        productOffer.coreServices?.value ||
                        productOffer.serviceCategories?.value);

  const productCategories = Array.isArray(productOffer.productCategories?.value)
    ? productOffer.productCategories.value as string[]
    : [];

  const serviceCategories = Array.isArray(productOffer.serviceCategories?.value)
    ? productOffer.serviceCategories.value as string[]
    : [];

  // Check for installation in services
  const allServices = [
    ...(Array.isArray(productOffer.services?.value) ? productOffer.services.value : []),
    ...(Array.isArray(productOffer.coreServices?.value) ? productOffer.coreServices.value : []),
    ...serviceCategories,
  ] as string[];

  const hasInstallation = allServices.some(s =>
    typeof s === 'string' &&
    (s.toLowerCase().includes('install') ||
     s.toLowerCase().includes('service') ||
     s.toLowerCase().includes('repair'))
  );

  return {
    hasProducts,
    hasServices,
    hasInstallation,
    productCategories,
    serviceCategories,
    businessModel: identity.businessModel?.value,
    industry: identity.industry?.value,
  };
}

/**
 * Merge multiple signal sources
 */
export function mergeSignals(...sources: Partial<ModalitySignals>[]): ModalitySignals {
  const merged: ModalitySignals = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && value !== null) {
        // For arrays, merge them
        if (Array.isArray(value)) {
          const existing = (merged as any)[key] || [];
          (merged as any)[key] = Array.from(new Set([...existing, ...value]));
        } else {
          // For primitives, later sources override earlier ones
          (merged as any)[key] = value;
        }
      }
    }
  }

  return merged;
}

// ============================================================================
// Apply clarifying question answer
// ============================================================================

/**
 * Update modality based on clarifying question answer
 */
export function applyQuestionAnswer(
  question: ClarifyingQuestion,
  answer: 'yes' | 'no'
): {
  modality: CompetitiveModalityType;
  confidence: number;
} {
  const modality = answer === 'yes' ? question.yesImplies : question.noImplies;

  return {
    modality,
    confidence: 85, // User confirmed, so higher confidence
  };
}
