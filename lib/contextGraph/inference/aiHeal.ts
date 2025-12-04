// lib/contextGraph/inference/aiHeal.ts
// AI Auto-Healing Engine
//
// Detects and repairs multiple issues in the context graph:
// - Missing required fields (from contracts)
// - Stale fields (from needsRefresh)
// - Contradictions (from validation rules)
//
// Proposes bulk fixes that can be accepted/rejected individually or all at once.

import Anthropic from '@anthropic-ai/sdk';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import { flattenGraphToFields } from '../uiHelpers';
import { validateGraphContracts, getMissingRequiredFields } from '../governance/contracts';
import { validateGraph, getAutoFixableIssues, type ValidationIssue } from '../governance/rules';
import { getNeedsRefreshReport } from '../needsRefresh';
import { convertNeedsRefreshReport, type NeedsRefreshFlag } from '../contextHealth';
import { checkLock } from '../governance/locks';

// ============================================================================
// Types
// ============================================================================

export interface HealingFix {
  id: string;
  path: string;
  fieldLabel: string;
  domain: DomainName;
  oldValue: unknown;
  newValue: unknown;
  confidence: number;           // 0-1
  reasoning: string;
  issueType: 'missing_required' | 'stale' | 'contradiction' | 'incomplete';
  originalIssue?: string;       // Description of the issue being fixed
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface HealingReport {
  fixes: HealingFix[];
  analyzedIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  generatedAt: string;
  canAutoHeal: boolean;
  error?: string;
}

export interface HealingOptions {
  includeMissing?: boolean;     // Heal missing required fields
  includeStale?: boolean;       // Heal stale fields
  includeContradictions?: boolean;  // Heal contradictions
  targetDomains?: DomainName[]; // Only heal specific domains
  maxFixes?: number;            // Max number of fixes to generate
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateFixId(): string {
  return `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getValueByPath(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value: unknown }).value;
  }

  return current;
}

function getPriority(issueType: string, severity?: string): 'critical' | 'high' | 'medium' | 'low' {
  if (issueType === 'missing_required') return 'critical';
  if (issueType === 'contradiction') return 'high';
  if (severity === 'error') return 'high';
  if (issueType === 'stale' || severity === 'warning') return 'medium';
  return 'low';
}

// ============================================================================
// Issue Detection
// ============================================================================

interface DetectedIssue {
  path: string;
  type: 'missing_required' | 'stale' | 'contradiction' | 'incomplete';
  description: string;
  currentValue: unknown;
  priority: 'critical' | 'high' | 'medium' | 'low';
  autoFixable: boolean;
}

async function detectIssues(
  companyId: string,
  graph: CompanyContextGraph,
  options: HealingOptions
): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = [];
  const {
    includeMissing = true,
    includeStale = true,
    includeContradictions = true,
    targetDomains,
  } = options;

  // 1. Check contract violations (missing required fields)
  if (includeMissing) {
    const missingFields = getMissingRequiredFields(graph);
    for (const violation of missingFields) {
      if (targetDomains && !targetDomains.includes(violation.domain)) continue;

      // Check if field is locked
      const lockCheck = await checkLock(companyId, violation.path);
      if (lockCheck.isLocked && lockCheck.lock?.severity === 'hard') continue;

      issues.push({
        path: violation.path,
        type: 'missing_required',
        description: violation.message,
        currentValue: getValueByPath(graph, violation.path),
        priority: 'critical',
        autoFixable: lockCheck.canAIOverride || !lockCheck.isLocked,
      });
    }
  }

  // 2. Check stale fields
  if (includeStale) {
    const refreshReport = getNeedsRefreshReport(graph);
    const needsRefreshFlags = convertNeedsRefreshReport(refreshReport);

    for (const flag of needsRefreshFlags) {
      const path = `${flag.domain}.${flag.field}`;
      if (targetDomains && !targetDomains.includes(flag.domain as DomainName)) continue;

      // Skip missing fields (handled above)
      if (flag.reason === 'missing') continue;

      // Check if field is locked
      const lockCheck = await checkLock(companyId, path);
      if (lockCheck.isLocked && lockCheck.lock?.severity === 'hard') continue;

      issues.push({
        path,
        type: 'stale',
        description: `Field is ${flag.reason}${flag.freshness !== undefined ? ` (${Math.round(flag.freshness * 100)}% fresh)` : ''}`,
        currentValue: getValueByPath(graph, path),
        priority: flag.reason === 'expired' ? 'high' : 'medium',
        autoFixable: lockCheck.canAIOverride || !lockCheck.isLocked,
      });
    }
  }

  // 3. Check validation rule issues (contradictions)
  if (includeContradictions) {
    const validationResult = validateGraph(graph);

    for (const issue of validationResult.issues) {
      if (targetDomains) {
        const domain = issue.path.split('.')[0] as DomainName;
        if (!targetDomains.includes(domain)) continue;
      }

      // Check if field is locked
      const lockCheck = await checkLock(companyId, issue.path);
      if (lockCheck.isLocked && lockCheck.lock?.severity === 'hard') continue;

      // Only include issues that don't already exist
      if (issues.some(i => i.path === issue.path)) continue;

      issues.push({
        path: issue.path,
        type: issue.category === 'contradiction' ? 'contradiction' : 'incomplete',
        description: issue.issue,
        currentValue: getValueByPath(graph, issue.path),
        priority: getPriority(issue.category, issue.severity),
        autoFixable: issue.autoFixable ?? false,
      });
    }
  }

  return issues;
}

// ============================================================================
// AI Healing Generation
// ============================================================================

async function generateHealingFixes(
  graph: CompanyContextGraph,
  issues: DetectedIssue[],
  maxFixes: number
): Promise<HealingFix[]> {
  if (issues.length === 0) return [];

  const client = new Anthropic();

  // Build context from existing populated fields
  const fields = flattenGraphToFields(graph);
  const populatedFields = fields.filter(f => f.value !== null && f.value !== '');

  const contextSummary = populatedFields
    .slice(0, 50)
    .map(f => `${f.path}: ${f.value?.slice(0, 300) ?? 'null'}`)
    .join('\n');

  // Prepare issues for AI
  const issuesForAI = issues
    .filter(i => i.autoFixable)
    .slice(0, maxFixes)
    .map(i => ({
      path: i.path,
      type: i.type,
      description: i.description,
      currentValue: i.currentValue,
    }));

  if (issuesForAI.length === 0) {
    return [];
  }

  const prompt = `You are an expert marketing strategist helping to heal/fix a company's marketing context graph.
Based on the existing context, generate appropriate values for fields that have issues.

## Existing Context:
${contextSummary}

## Issues to Fix:
${JSON.stringify(issuesForAI, null, 2)}

For each issue, provide a fix that makes sense given the existing context.
Only provide fixes where you can make a reasonable inference - don't invent data.

Respond with a JSON array of fixes:
[
  {
    "path": "domain.fieldName",
    "newValue": "the new value to use",
    "confidence": 0.8,
    "reasoning": "Why this value fixes the issue"
  }
]

Guidelines:
- For missing required fields: Infer from related populated fields
- For stale fields: Update based on current context, or keep similar if still valid
- For contradictions: Resolve by aligning with the more reliable/recent data
- Confidence 0.9+: High confidence fix
- Confidence 0.7-0.9: Good inference
- Confidence 0.5-0.7: Educated guess
- Skip fields you can't reasonably fix

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

    const fixes: HealingFix[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;

      const typedItem = item as {
        path: string;
        newValue: unknown;
        confidence: number;
        reasoning: string;
      };

      const issue = issues.find(i => i.path === typedItem.path);
      if (!issue) continue;
      if (typedItem.newValue === null || typedItem.newValue === undefined) continue;

      const pathParts = typedItem.path.split('.');
      const domain = pathParts[0] as DomainName;
      const fieldName = pathParts.slice(1).join('.');

      fixes.push({
        id: generateFixId(),
        path: typedItem.path,
        fieldLabel: fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        domain,
        oldValue: issue.currentValue,
        newValue: typedItem.newValue,
        confidence: Math.max(0, Math.min(1, typedItem.confidence ?? 0.7)),
        reasoning: typedItem.reasoning ?? 'AI-generated fix',
        issueType: issue.type,
        originalIssue: issue.description,
        priority: issue.priority,
      });
    }

    return fixes;
  } catch (error) {
    console.error('[aiHeal] AI generation error:', error);
    return [];
  }
}

// ============================================================================
// Main Healing Functions
// ============================================================================

/**
 * Generate a comprehensive healing report for the context graph
 */
export async function generateHealingReport(
  companyId: string,
  graph: CompanyContextGraph,
  options: HealingOptions = {}
): Promise<HealingReport> {
  const { maxFixes = 20 } = options;

  try {
    // Detect all issues
    const issues = await detectIssues(companyId, graph, options);

    if (issues.length === 0) {
      return {
        fixes: [],
        analyzedIssues: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        generatedAt: new Date().toISOString(),
        canAutoHeal: false,
      };
    }

    // Count by priority
    const criticalCount = issues.filter(i => i.priority === 'critical').length;
    const highCount = issues.filter(i => i.priority === 'high').length;
    const mediumCount = issues.filter(i => i.priority === 'medium').length;
    const lowCount = issues.filter(i => i.priority === 'low').length;

    // Generate fixes using AI
    const fixes = await generateHealingFixes(graph, issues, maxFixes);

    return {
      fixes,
      analyzedIssues: issues.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      generatedAt: new Date().toISOString(),
      canAutoHeal: fixes.length > 0,
    };
  } catch (error) {
    console.error('[aiHeal] Error generating healing report:', error);
    return {
      fixes: [],
      analyzedIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      generatedAt: new Date().toISOString(),
      canAutoHeal: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Quick check if the graph needs healing
 */
export async function needsHealing(
  companyId: string,
  graph: CompanyContextGraph
): Promise<{ needsHealing: boolean; issueCount: number; criticalCount: number }> {
  const issues = await detectIssues(companyId, graph, {
    includeMissing: true,
    includeStale: true,
    includeContradictions: true,
  });

  const criticalCount = issues.filter(i => i.priority === 'critical').length;

  return {
    needsHealing: issues.length > 0,
    issueCount: issues.length,
    criticalCount,
  };
}

/**
 * Get diagnostic recommendations based on issues
 */
export function getRecommendedDiagnostics(
  graph: CompanyContextGraph
): Array<{ lab: string; reason: string; priority: string }> {
  const recommendations: Array<{ lab: string; reason: string; priority: string }> = [];

  // Check contracts for missing required fields
  const contractStatus = validateGraphContracts(graph);

  for (const domainStatus of contractStatus.domainStatuses) {
    if (!domainStatus.isComplete) {
      const labMap: Record<string, string> = {
        brand: 'Brand Lab',
        audience: 'Audience Lab',
        performanceMedia: 'Media Lab',
        creative: 'Creative Lab',
        seo: 'SEO Lab',
        content: 'Content Lab',
        website: 'Website Lab',
        identity: 'Company Setup',
        objectives: 'Strategy Lab',
      };

      const lab = labMap[domainStatus.domain];
      if (lab) {
        const missingRequired = domainStatus.violations.filter(v => v.type === 'missing_required');
        if (missingRequired.length > 0) {
          recommendations.push({
            lab,
            reason: `Missing ${missingRequired.length} required field(s) in ${domainStatus.domain}`,
            priority: 'high',
          });
        }
      }
    }
  }

  // Check for stale data that could be refreshed
  const refreshReport = getNeedsRefreshReport(graph);
  const staleFlags = convertNeedsRefreshReport(refreshReport).filter(f => f.reason === 'stale' || f.reason === 'expired');

  const staleDomains = new Set(staleFlags.map(f => f.domain));
  for (const domain of staleDomains) {
    const labMap: Record<string, string> = {
      performanceMedia: 'Media Lab',
      audience: 'Audience Lab',
      brand: 'Brand Lab',
      creative: 'Creative Lab',
    };

    const lab = labMap[domain];
    if (lab && !recommendations.some(r => r.lab === lab)) {
      recommendations.push({
        lab,
        reason: `${domain} data is stale and needs refresh`,
        priority: 'medium',
      });
    }
  }

  return recommendations;
}
