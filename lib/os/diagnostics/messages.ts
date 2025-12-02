// lib/os/diagnostics/messages.ts
// Centralized error and success messaging for diagnostic tool runs
//
// This module provides:
// - Structured error codes with user-friendly messages
// - Success messages with actionable next steps
// - Consistent formatting across all diagnostic tools

// ============================================================================
// Error Codes
// ============================================================================

export type DiagnosticErrorCode =
  // Validation errors (4xx)
  | 'MISSING_COMPANY_ID'
  | 'MISSING_URL'
  | 'COMPANY_NOT_FOUND'
  | 'NO_WEBSITE_URL'
  | 'INVALID_COMPANY_ID'
  | 'INVALID_URL_FORMAT'
  // External service errors
  | 'AIRTABLE_RATE_LIMIT'
  | 'AIRTABLE_CONFIG_ERROR'
  | 'OPENAI_ERROR'
  | 'OPENAI_RATE_LIMIT'
  | 'GSC_AUTH_REQUIRED'
  | 'GSC_NO_DATA'
  | 'GA4_AUTH_REQUIRED'
  | 'CRAWL_FAILED'
  | 'CRAWL_TIMEOUT'
  | 'CRAWL_BLOCKED'
  // Engine errors
  | 'ENGINE_FAILED'
  | 'ENGINE_TIMEOUT'
  | 'PARSE_ERROR'
  // Generic
  | 'UNKNOWN_ERROR';

// ============================================================================
// Error Definitions
// ============================================================================

export interface DiagnosticError {
  code: DiagnosticErrorCode;
  message: string;
  userMessage: string;
  suggestion?: string;
  retryable: boolean;
}

const ERROR_DEFINITIONS: Record<DiagnosticErrorCode, Omit<DiagnosticError, 'code'>> = {
  // Validation errors
  MISSING_COMPANY_ID: {
    message: 'Company ID is required',
    userMessage: 'No company selected',
    suggestion: 'Please select a company before running this diagnostic.',
    retryable: false,
  },
  MISSING_URL: {
    message: 'URL is required',
    userMessage: 'No website URL provided',
    suggestion: 'Enter a website URL to analyze.',
    retryable: false,
  },
  COMPANY_NOT_FOUND: {
    message: 'Company not found in database',
    userMessage: 'Company not found',
    suggestion: 'The company may have been deleted. Try refreshing the page.',
    retryable: false,
  },
  NO_WEBSITE_URL: {
    message: 'Company has no website URL',
    userMessage: 'Missing website URL',
    suggestion: 'Add a website URL to this company before running diagnostics.',
    retryable: false,
  },
  INVALID_COMPANY_ID: {
    message: 'Invalid company record ID format',
    userMessage: 'Invalid company reference',
    suggestion: 'Try refreshing the page or contact support if this persists.',
    retryable: false,
  },
  INVALID_URL_FORMAT: {
    message: 'Invalid URL format provided',
    userMessage: 'Invalid website URL',
    suggestion: 'Enter a valid URL starting with http:// or https://',
    retryable: false,
  },

  // External service errors
  AIRTABLE_RATE_LIMIT: {
    message: 'Airtable API rate limit exceeded',
    userMessage: 'Database is busy',
    suggestion: 'Wait a moment and try again.',
    retryable: true,
  },
  AIRTABLE_CONFIG_ERROR: {
    message: 'Airtable configuration error',
    userMessage: 'Database configuration issue',
    suggestion: 'Contact support - there may be a missing field in the database.',
    retryable: false,
  },
  OPENAI_ERROR: {
    message: 'OpenAI API error',
    userMessage: 'AI analysis failed',
    suggestion: 'The AI service encountered an issue. Try again in a few moments.',
    retryable: true,
  },
  OPENAI_RATE_LIMIT: {
    message: 'OpenAI rate limit exceeded',
    userMessage: 'AI service is busy',
    suggestion: 'Wait a moment and try again.',
    retryable: true,
  },
  GSC_AUTH_REQUIRED: {
    message: 'Google Search Console authentication required',
    userMessage: 'Search Console not connected',
    suggestion: 'Connect Google Search Console in Settings to get search performance data.',
    retryable: false,
  },
  GSC_NO_DATA: {
    message: 'No data available from Google Search Console',
    userMessage: 'No Search Console data',
    suggestion: 'The site may be new to Search Console or have very low traffic. Results will be based on on-site analysis only.',
    retryable: false,
  },
  GA4_AUTH_REQUIRED: {
    message: 'Google Analytics authentication required',
    userMessage: 'Analytics not connected',
    suggestion: 'Connect Google Analytics in Settings to include traffic data.',
    retryable: false,
  },
  CRAWL_FAILED: {
    message: 'Failed to crawl website',
    userMessage: 'Could not access website',
    suggestion: 'Check that the website is online and publicly accessible.',
    retryable: true,
  },
  CRAWL_TIMEOUT: {
    message: 'Website crawl timed out',
    userMessage: 'Website took too long to respond',
    suggestion: 'The site may be slow. Try again or check if the site is experiencing issues.',
    retryable: true,
  },
  CRAWL_BLOCKED: {
    message: 'Website blocked crawling',
    userMessage: 'Website blocked our access',
    suggestion: 'The site may have security measures that prevent analysis.',
    retryable: false,
  },

  // Engine errors
  ENGINE_FAILED: {
    message: 'Diagnostic engine failed',
    userMessage: 'Analysis failed',
    suggestion: 'Something went wrong during analysis. Try running again.',
    retryable: true,
  },
  ENGINE_TIMEOUT: {
    message: 'Diagnostic engine timed out',
    userMessage: 'Analysis took too long',
    suggestion: 'The analysis timed out. Try again - complex sites may take longer.',
    retryable: true,
  },
  PARSE_ERROR: {
    message: 'Failed to parse analysis results',
    userMessage: 'Could not process results',
    suggestion: 'Try running the diagnostic again.',
    retryable: true,
  },

  // Generic
  UNKNOWN_ERROR: {
    message: 'An unexpected error occurred',
    userMessage: 'Something went wrong',
    suggestion: 'Try again. If this persists, contact support.',
    retryable: true,
  },
};

// ============================================================================
// Error Helper Functions
// ============================================================================

/**
 * Create a structured diagnostic error
 */
export function createDiagnosticError(code: DiagnosticErrorCode): DiagnosticError {
  const definition = ERROR_DEFINITIONS[code];
  return {
    code,
    ...definition,
  };
}

/**
 * Detect error code from error message
 */
export function detectErrorCode(error: Error | string): DiagnosticErrorCode {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Rate limits
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    if (lowerMessage.includes('airtable')) return 'AIRTABLE_RATE_LIMIT';
    if (lowerMessage.includes('openai')) return 'OPENAI_RATE_LIMIT';
    return 'AIRTABLE_RATE_LIMIT'; // Default to Airtable for generic rate limits
  }

  // Airtable errors
  if (lowerMessage.includes('invalid_value_for_column') || lowerMessage.includes('airtable')) {
    return 'AIRTABLE_CONFIG_ERROR';
  }

  // OpenAI errors
  if (lowerMessage.includes('openai') || lowerMessage.includes('gpt')) {
    return 'OPENAI_ERROR';
  }

  // Crawl errors
  if (lowerMessage.includes('timeout')) {
    if (lowerMessage.includes('crawl') || lowerMessage.includes('fetch')) {
      return 'CRAWL_TIMEOUT';
    }
    return 'ENGINE_TIMEOUT';
  }
  if (lowerMessage.includes('blocked') || lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
    return 'CRAWL_BLOCKED';
  }
  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('enotfound') || lowerMessage.includes('econnrefused')) {
    return 'CRAWL_FAILED';
  }

  // Validation errors
  if (lowerMessage.includes('company not found')) return 'COMPANY_NOT_FOUND';
  if (lowerMessage.includes('no website')) return 'NO_WEBSITE_URL';
  if (lowerMessage.includes('invalid') && lowerMessage.includes('url')) return 'INVALID_URL_FORMAT';

  // Parse errors
  if (lowerMessage.includes('json') || lowerMessage.includes('parse')) {
    return 'PARSE_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Create a user-friendly error response from any error
 */
export function formatErrorForUser(error: Error | string): DiagnosticError {
  const code = detectErrorCode(error);
  return createDiagnosticError(code);
}

// ============================================================================
// Success Messages
// ============================================================================

export interface DiagnosticSuccessMessage {
  headline: string;
  detail?: string;
  nextSteps: string[];
}

export type SuccessMessageType = 'gapIa' | 'gapPlan' | 'gapHeavy' | 'websiteLab' | 'seoLab' | 'brandLab' | 'contentLab' | 'demandLab' | 'opsLab' | 'analyticsScan';

/**
 * Get success message based on tool type and result
 */
export function getSuccessMessage(
  toolType: SuccessMessageType,
  result: { score?: number; summary?: string }
): DiagnosticSuccessMessage {
  const score = result.score;
  const scoreText = score !== undefined ? ` Score: ${score}/100.` : '';

  switch (toolType) {
    case 'gapIa':
      return {
        headline: `GAP IA complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review the full assessment for detailed insights',
          'Run Website Lab or SEO Lab for deeper analysis',
          'Check the Brain for AI-generated recommendations',
        ],
      };

    case 'gapPlan':
      return {
        headline: `Full GAP complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review the Growth Acceleration Plan',
          'Check Blueprint for prioritized work',
          'Share the plan with your team',
        ],
      };

    case 'gapHeavy':
      return {
        headline: `GAP Heavy complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review competitive landscape analysis',
          'Check opportunity zones identified',
          'Use insights to inform strategy',
        ],
      };

    case 'websiteLab':
      return {
        headline: `Website Lab complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review UX and conversion issues found',
          'Check quick wins for immediate improvements',
          'Plan larger website projects',
        ],
      };

    case 'seoLab':
      return {
        headline: `SEO Lab complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review SEO issues and quick wins',
          'Connect Search Console for deeper insights',
          'Prioritize technical SEO fixes',
        ],
      };

    case 'brandLab':
      return {
        headline: `Brand Lab complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review brand clarity assessment',
          'Check positioning gaps identified',
          'Plan brand strengthening initiatives',
        ],
      };

    case 'contentLab':
      return {
        headline: `Content Lab complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review content coverage analysis',
          'Check topic and funnel gaps',
          'Plan content creation priorities',
        ],
      };

    case 'demandLab':
      return {
        headline: `Demand Lab complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review channel mix assessment',
          'Check campaign opportunities',
          'Plan demand gen experiments',
        ],
      };

    case 'opsLab':
      return {
        headline: `Ops Lab complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review ops and tracking health',
          'Check handoff and workflow gaps',
          'Prioritize reliability fixes',
        ],
      };

    case 'analyticsScan':
      return {
        headline: `Analytics Scan complete.${scoreText}`,
        detail: result.summary,
        nextSteps: [
          'Review key trends and anomalies',
          'Check conversion bottlenecks',
          'Use insights for Blueprint planning',
        ],
      };

    default:
      return {
        headline: `Diagnostic complete.${scoreText}`,
        detail: result.summary,
        nextSteps: ['Review the results', 'Check the Brain for insights'],
      };
  }
}

// ============================================================================
// Tool ID Mapping
// ============================================================================

/**
 * Map diagnostic tool IDs to success message types
 */
export function toolIdToSuccessType(toolId: string): SuccessMessageType {
  const mapping: Record<string, SuccessMessageType> = {
    gapSnapshot: 'gapIa',
    gapIa: 'gapIa',
    gapPlan: 'gapPlan',
    fullGap: 'gapPlan',
    gapHeavy: 'gapHeavy',
    websiteLab: 'websiteLab',
    seoLab: 'seoLab',
    brandLab: 'brandLab',
    contentLab: 'contentLab',
    demandLab: 'demandLab',
    opsLab: 'opsLab',
    analyticsScan: 'analyticsScan',
  };
  return mapping[toolId] || 'gapIa';
}

// ============================================================================
// Progress Stages
// ============================================================================

export interface ProgressStage {
  id: string;
  label: string;
  description: string;
}

/**
 * Get progress stages for a tool
 */
export function getToolProgressStages(toolId: string): ProgressStage[] {
  switch (toolId) {
    case 'gapSnapshot':
    case 'gapIa':
      return [
        { id: 'init', label: 'Starting', description: 'Initializing assessment...' },
        { id: 'crawl', label: 'Crawling', description: 'Fetching website pages...' },
        { id: 'analyze', label: 'Analyzing', description: 'AI analyzing marketing signals...' },
        { id: 'score', label: 'Scoring', description: 'Calculating scores and insights...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];

    case 'seoLab':
      return [
        { id: 'init', label: 'Starting', description: 'Initializing SEO analysis...' },
        { id: 'crawl', label: 'Crawling', description: 'Fetching website pages...' },
        { id: 'technical', label: 'Technical', description: 'Checking technical SEO...' },
        { id: 'gsc', label: 'Search Data', description: 'Fetching Search Console data...' },
        { id: 'analyze', label: 'Analyzing', description: 'AI analyzing SEO signals...' },
        { id: 'score', label: 'Scoring', description: 'Calculating SEO scores...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];

    case 'websiteLab':
      return [
        { id: 'init', label: 'Starting', description: 'Initializing website analysis...' },
        { id: 'crawl', label: 'Crawling', description: 'Fetching key pages...' },
        { id: 'ux', label: 'UX Analysis', description: 'Analyzing user experience...' },
        { id: 'conversion', label: 'Conversion', description: 'Checking conversion elements...' },
        { id: 'score', label: 'Scoring', description: 'Calculating scores...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];

    case 'brandLab':
      return [
        { id: 'init', label: 'Starting', description: 'Initializing brand analysis...' },
        { id: 'crawl', label: 'Crawling', description: 'Fetching brand touchpoints...' },
        { id: 'analyze', label: 'Analyzing', description: 'AI analyzing brand signals...' },
        { id: 'score', label: 'Scoring', description: 'Calculating brand scores...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];

    case 'gapPlan':
    case 'fullGap':
      return [
        { id: 'init', label: 'Starting', description: 'Initializing Full GAP...' },
        { id: 'gather', label: 'Gathering', description: 'Collecting diagnostic data...' },
        { id: 'analyze', label: 'Analyzing', description: 'AI building growth plan...' },
        { id: 'prioritize', label: 'Prioritizing', description: 'Prioritizing recommendations...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];

    case 'gapHeavy':
      return [
        { id: 'init', label: 'Starting', description: 'Initializing GAP Heavy...' },
        { id: 'crawl', label: 'Crawling', description: 'Deep crawling website...' },
        { id: 'competitors', label: 'Competitors', description: 'Analyzing competitors...' },
        { id: 'search', label: 'Search', description: 'Analyzing search landscape...' },
        { id: 'analyze', label: 'Analyzing', description: 'AI building competitive intelligence...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];

    default:
      return [
        { id: 'init', label: 'Starting', description: 'Initializing...' },
        { id: 'analyze', label: 'Analyzing', description: 'Running analysis...' },
        { id: 'save', label: 'Saving', description: 'Saving results...' },
      ];
  }
}
