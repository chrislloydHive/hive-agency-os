// lib/intelligence/dailyBriefing.ts
// Enhanced Daily Briefing Engine 2.0 with AI generation
// Answers: "What should I know and what should I do today?"

import { getOpenAI } from '@/lib/openai';
import { getCompaniesWithOsSummary } from '@/lib/airtable/companies';
import { getAllWorkItems, type WorkItemRecord } from '@/lib/airtable/workItems';
import { getAllFullReports, type FullReportRecord } from '@/lib/airtable/fullReports';
import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';

// ============================================================================
// Types
// ============================================================================

export type BriefingPriority = 'low' | 'medium' | 'high' | 'critical';

export interface BriefingItem {
  id: string;
  title: string;
  description?: string;
  priority: BriefingPriority;
  companyId?: string;
  companyName?: string;
  linkType?: 'company' | 'work' | 'diagnostic' | 'analytics' | 'none';
  linkHref?: string;
}

export interface DailyBriefingV2 {
  generatedAt: string;
  aiGenerated: boolean;

  // Overnight Summary
  overnightSummary: {
    headline: string;
    highlights: string[];
    workCreated: number;
    workCompleted: number;
    diagnosticsRun: number;
    plansGenerated: number;
    newOpportunities: number;
    atRiskChanges: string[];
  };

  // Today's Focus Plan
  focusPlan: {
    keyActions: BriefingItem[];
    quickWins: BriefingItem[];
    risks: BriefingItem[];
    outreachTasks: BriefingItem[];
  };

  // Priority Queue
  priorityQueue: Array<{
    companyId: string;
    companyName: string;
    reason: string;
    severity: BriefingPriority;
    issues: string[];
    lastActivity?: string;
  }>;

  // Diagnostic Review Queue
  diagnosticReviewQueue: Array<{
    id: string;
    companyId: string;
    companyName: string;
    toolName: string;
    score?: number;
    createdAt: string;
  }>;

  // Pipeline Highlights
  pipelineHighlights: {
    newLeads: number;
    qualifiedProspects: number;
    readyToClose: Array<{ companyId: string; companyName: string; reason: string }>;
  };

  // Yesterday's Activity
  yesterdayActivity: {
    workCreated: number;
    workCompleted: number;
    diagnosticsRun: number;
    plansGenerated: number;
  };

  // Owner/Assignment Issues
  ownerIssues: Array<{
    type: 'no_owner' | 'no_strategist' | 'stalled' | 'old_plan';
    companyId: string;
    companyName: string;
    description: string;
  }>;
}

export type BriefingRole = 'exec' | 'strategist' | 'pm';

// ============================================================================
// Context Building
// ============================================================================

interface EnrichedCompany {
  id: string;
  name: string;
  stage: string;
  owner?: string;
  updatedAt?: string;
  createdAt?: string;
  isAtRisk: boolean;
  healthReason?: string;
  hasFullReport: boolean;
  latestScore?: number;
}

interface BriefingContext {
  companies: EnrichedCompany[];
  workItems: WorkItemRecord[];
  fullReports: FullReportRecord[];
  leads: any[];
  timeWindows: {
    now: Date;
    yesterday: Date;
    twoDaysAgo: Date;
    sevenDaysAgo: Date;
    fourteenDaysAgo: Date;
    thirtyDaysAgo: Date;
    sixtyDaysAgo: Date;
  };
}

function enrichCompanies(rawCompanies: any[], fullReports: FullReportRecord[]): EnrichedCompany[] {
  // Build a map of companyId -> latest full report
  const reportsByCompany = new Map<string, FullReportRecord>();
  for (const report of fullReports) {
    const companyId = report.companyId;
    if (!companyId) continue;

    // Keep latest report per company (assuming reports are sorted by date desc)
    if (!reportsByCompany.has(companyId)) {
      reportsByCompany.set(companyId, report);
    }
  }

  return rawCompanies.map(c => {
    // Normalize stage to lowercase for consistency
    const rawStage = (c.stage || '').toLowerCase();
    const stage = rawStage === 'prospect' ? 'prospect'
                : rawStage === 'client' ? 'client'
                : rawStage === 'internal' ? 'internal'
                : rawStage === 'dormant' ? 'dormant'
                : rawStage === 'lost' ? 'lost'
                : 'unknown';

    // Determine health status from actual fields
    const isAtRisk = c.atRiskFlag === true || c.healthOverride === 'At Risk';
    let healthReason: string | undefined;
    if (c.atRiskFlag) healthReason = 'Flagged as at-risk';
    if (c.healthOverride === 'At Risk') healthReason = 'Manually marked at-risk';

    // Check for full report
    const report = reportsByCompany.get(c.id);

    return {
      id: c.id,
      name: c.name || 'Unknown Company',
      stage,
      owner: c.owner,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      isAtRisk,
      healthReason,
      hasFullReport: !!report,
      latestScore: report?.scores?.overall,
    };
  });
}

async function buildDailyBriefingContext(): Promise<BriefingContext> {
  console.log('[DailyBriefing] Building context...');

  const [rawCompanies, workItems, fullReports, leads] = await Promise.all([
    getCompaniesWithOsSummary().catch(() => []),
    getAllWorkItems().catch(() => []),
    getAllFullReports().catch(() => []),
    getAllInboundLeads().catch(() => []),
  ]);

  // Enrich companies with health and full report info
  const companies = enrichCompanies(rawCompanies, fullReports);

  console.log(`[DailyBriefing] Enriched ${companies.length} companies`);

  const now = new Date();

  return {
    companies,
    workItems,
    fullReports,
    leads,
    timeWindows: {
      now,
      yesterday: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      twoDaysAgo: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      fourteenDaysAgo: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      sixtyDaysAgo: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    },
  };
}

// ============================================================================
// AI Generation
// ============================================================================

function buildBriefingPrompt(ctx: BriefingContext): string {
  const { companies, workItems, fullReports, leads, timeWindows } = ctx;

  // Calculate metrics
  const workCreatedOvernight = workItems.filter(w => {
    const created = w.createdAt ? new Date(w.createdAt) : null;
    return created && created >= timeWindows.yesterday;
  }).length;

  const workCompletedOvernight = workItems.filter(w => {
    const updated = w.updatedAt ? new Date(w.updatedAt) : null;
    return w.status === 'Done' && updated && updated >= timeWindows.yesterday;
  }).length;

  const diagnosticsOvernight = fullReports.filter(r => {
    const created = r.createdAt ? new Date(r.createdAt) : null;
    return created && created >= timeWindows.yesterday;
  }).length;

  const atRiskCompanies = companies.filter(c => c.isAtRisk);

  const overdueWork = workItems.filter(w => {
    if (w.status === 'Done') return false;
    const due = w.dueDate ? new Date(w.dueDate) : null;
    return due && due < timeWindows.now;
  });

  const inactiveCompanies = companies.filter(c => {
    const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
    return c.stage === 'client' && (!lastActivity || lastActivity < timeWindows.fourteenDaysAgo);
  });

  const noOwnerCompanies = companies.filter(c =>
    !c.owner && (c.stage === 'client' || c.stage === 'prospect')
  );

  const qualifiedProspects = companies.filter(c =>
    c.stage === 'prospect' && c.hasFullReport
  );

  const workDueToday = workItems.filter(w => {
    if (w.status === 'Done') return false;
    const due = w.dueDate ? new Date(w.dueDate) : null;
    if (!due) return false;
    const todayEnd = new Date(timeWindows.now);
    todayEnd.setHours(23, 59, 59, 999);
    return due <= todayEnd && due >= new Date(timeWindows.now.setHours(0, 0, 0, 0));
  });

  const inProgressWork = workItems.filter(w => w.status === 'In Progress');

  return `You are the AI brain of an agency operating system. Your job is to create a concise, actionable daily briefing for the team.

## Context: Last 24 Hours
- Work items created: ${workCreatedOvernight}
- Work items completed: ${workCompletedOvernight}
- Diagnostics run: ${diagnosticsOvernight}

## Current State
- Total companies: ${companies.length}
- Companies at risk: ${atRiskCompanies.length}${atRiskCompanies.length > 0 ? ` (${atRiskCompanies.slice(0, 5).map(c => c.name).join(', ')})` : ''}
- Overdue work items: ${overdueWork.length}
- Work due today: ${workDueToday.length}
- In-progress work: ${inProgressWork.length}
- Inactive clients (14+ days): ${inactiveCompanies.length}
- Companies without owner: ${noOwnerCompanies.length}
- Qualified prospects ready to convert: ${qualifiedProspects.length}

## Work Due Today
${workDueToday.slice(0, 5).map(w => {
  const company = companies.find(c => c.id === w.companyId);
  return `- "${w.title}" for ${company?.name || 'Unknown'}`;
}).join('\n') || 'None'}

## At-Risk Companies
${atRiskCompanies.slice(0, 5).map(c => `- ${c.name}: ${c.healthReason || 'Flagged as at-risk'}`).join('\n') || 'None'}

## Inactive Clients (Need Follow-up)
${inactiveCompanies.slice(0, 5).map(c => `- ${c.name}: Last active ${c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'unknown'}`).join('\n') || 'None'}

## Qualified Prospects
${qualifiedProspects.slice(0, 3).map(c => `- ${c.name}: Has completed diagnostics`).join('\n') || 'None'}

---

Generate a JSON daily briefing with this structure:
{
  "overnightSummary": {
    "headline": "One-sentence summary of overnight activity and focus for today",
    "highlights": ["3-5 key bullet points about what changed overnight"]
  },
  "focusPlan": {
    "keyActions": [
      {"title": "Action title", "description": "Why this matters", "priority": "high|medium|low", "companyName": "if applicable"}
    ],
    "quickWins": [
      {"title": "Quick win", "description": "Easy task with high leverage", "priority": "medium"}
    ],
    "risks": [
      {"title": "Risk to address", "description": "What could go wrong", "priority": "high", "companyName": "if applicable"}
    ],
    "outreachTasks": [
      {"title": "Outreach task", "description": "Who to contact and why", "priority": "medium", "companyName": "Company name"}
    ]
  }
}

Rules:
1. Be specific and actionable. Reference real company names when relevant.
2. Prioritize urgent items (overdue work, at-risk companies) in keyActions.
3. Quick wins should be achievable in <30 minutes.
4. Risks should focus on potential churn or missed opportunities.
5. Outreach tasks should target inactive or at-risk companies.
6. Limit each section to 3-5 items.
7. Use "high" priority sparingly (only for truly urgent items).

Return ONLY valid JSON.`;
}

interface AIBriefingResponse {
  overnightSummary: {
    headline: string;
    highlights: string[];
  };
  focusPlan: {
    keyActions: Array<{ title: string; description: string; priority: string; companyName?: string }>;
    quickWins: Array<{ title: string; description: string; priority: string; companyName?: string }>;
    risks: Array<{ title: string; description: string; priority: string; companyName?: string }>;
    outreachTasks: Array<{ title: string; description: string; priority: string; companyName?: string }>;
  };
}

async function generateAIBriefing(ctx: BriefingContext): Promise<AIBriefingResponse | null> {
  try {
    const openai = getOpenAI();
    const prompt = buildBriefingPrompt(ctx);

    console.log('[DailyBriefing] Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant that generates structured daily briefings for a B2B marketing agency. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[DailyBriefing] No content in AI response');
      return null;
    }

    const parsed = JSON.parse(content) as AIBriefingResponse;
    console.log('[DailyBriefing] AI generation successful');
    return parsed;
  } catch (error) {
    console.error('[DailyBriefing] AI generation failed:', error);
    return null;
  }
}

// ============================================================================
// Deterministic Fallback
// ============================================================================

function generateFallbackBriefing(ctx: BriefingContext): DailyBriefingV2 {
  const { companies, workItems, fullReports, leads, timeWindows } = ctx;

  console.log('[DailyBriefing] Using deterministic fallback');

  // Calculate overnight activity
  const workCreated = workItems.filter(w => {
    const created = w.createdAt ? new Date(w.createdAt) : null;
    return created && created >= timeWindows.yesterday;
  }).length;

  const workCompleted = workItems.filter(w => {
    const updated = w.updatedAt ? new Date(w.updatedAt) : null;
    return w.status === 'Done' && updated && updated >= timeWindows.yesterday;
  }).length;

  const diagnosticsRun = fullReports.filter(r => {
    const created = r.createdAt ? new Date(r.createdAt) : null;
    return created && created >= timeWindows.yesterday;
  }).length;

  const plansGenerated = fullReports.filter(r => {
    const created = r.createdAt ? new Date(r.createdAt) : null;
    return r.planJson && created && created >= timeWindows.yesterday;
  }).length;

  // At-risk companies
  const atRiskCompanies = companies.filter(c => c.isAtRisk);

  // Generate headline
  let headline = '';
  if (workCompleted > 0) {
    headline = `${workCompleted} task${workCompleted > 1 ? 's' : ''} completed overnight. `;
  }
  if (atRiskCompanies.length > 0) {
    headline += `${atRiskCompanies.length} companies need attention.`;
  } else {
    headline += 'All systems normal.';
  }

  // Generate highlights
  const highlights: string[] = [];
  if (workCreated > 0) highlights.push(`${workCreated} new work items created`);
  if (workCompleted > 0) highlights.push(`${workCompleted} tasks completed`);
  if (diagnosticsRun > 0) highlights.push(`${diagnosticsRun} diagnostics run`);
  if (atRiskCompanies.length > 0) highlights.push(`${atRiskCompanies.length} companies at risk`);
  if (highlights.length === 0) highlights.push('Quiet night - no significant changes');

  // Key Actions: Work due today or overdue
  const todayEnd = new Date(timeWindows.now);
  todayEnd.setHours(23, 59, 59, 999);

  const keyActions: BriefingItem[] = workItems
    .filter(w => {
      if (w.status === 'Done') return false;
      const due = w.dueDate ? new Date(w.dueDate) : null;
      return due && due <= todayEnd;
    })
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDue - bDue;
    })
    .slice(0, 5)
    .map((w, idx) => {
      const company = companies.find(c => c.id === w.companyId);
      const isOverdue = w.dueDate && new Date(w.dueDate) < timeWindows.now;
      return {
        id: `key-${idx}`,
        title: w.title || 'Untitled task',
        description: isOverdue ? 'Overdue - needs immediate attention' : `Due ${new Date(w.dueDate!).toLocaleDateString()}`,
        priority: (isOverdue ? 'high' : 'medium') as BriefingPriority,
        companyId: w.companyId,
        companyName: company?.name,
        linkType: 'work' as const,
        linkHref: w.companyId ? `/c/${w.companyId}?tab=work` : '/work',
      };
    });

  // Quick Wins: In-progress work
  const quickWins: BriefingItem[] = workItems
    .filter(w => w.status === 'In Progress')
    .slice(0, 3)
    .map((w, idx) => {
      const company = companies.find(c => c.id === w.companyId);
      return {
        id: `win-${idx}`,
        title: w.title || 'In-progress task',
        description: 'Already started - push to completion',
        priority: 'medium' as BriefingPriority,
        companyId: w.companyId,
        companyName: company?.name,
        linkType: 'work' as const,
        linkHref: w.companyId ? `/c/${w.companyId}?tab=work` : '/work',
      };
    });

  // Risks: At-risk companies
  const risks: BriefingItem[] = atRiskCompanies.slice(0, 3).map((c, idx) => ({
    id: `risk-${idx}`,
    title: `Review ${c.name}`,
    description: c.healthReason || 'Flagged as at-risk',
    priority: 'high' as BriefingPriority,
    companyId: c.id,
    companyName: c.name,
    linkType: 'company' as const,
    linkHref: `/c/${c.id}`,
  }));

  // Outreach: Inactive clients
  const inactiveClients = companies.filter(c => {
    const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
    return c.stage === 'client' && (!lastActivity || lastActivity < timeWindows.fourteenDaysAgo);
  });

  const outreachTasks: BriefingItem[] = inactiveClients.slice(0, 3).map((c, idx) => ({
    id: `outreach-${idx}`,
    title: `Follow up with ${c.name}`,
    description: `No activity since ${c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'unknown'}`,
    priority: 'medium' as BriefingPriority,
    companyId: c.id,
    companyName: c.name,
    linkType: 'company' as const,
    linkHref: `/c/${c.id}`,
  }));

  // Priority Queue
  const priorityQueue = computePriorityQueue(companies, workItems, timeWindows);

  // Diagnostic Review Queue
  const diagnosticReviewQueue = fullReports
    .filter(r => {
      const created = r.createdAt ? new Date(r.createdAt) : null;
      return created && created >= timeWindows.sevenDaysAgo;
    })
    .slice(0, 5)
    .map(r => {
      const company = companies.find(c => c.id === r.companyId);
      return {
        id: r.id,
        companyId: r.companyId || '',
        companyName: company?.name || 'Unknown',
        toolName: 'GAP IA',
        score: r.scores?.overall,
        createdAt: r.createdAt || '',
      };
    });

  // Pipeline Highlights
  const newLeads = leads.filter(l => {
    const created = l.createdAt ? new Date(l.createdAt) : null;
    return created && created >= timeWindows.sevenDaysAgo;
  }).length;

  const qualifiedProspects = companies.filter(c =>
    c.stage === 'prospect' && c.hasFullReport
  );

  // Yesterday Activity
  const isYesterday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date >= timeWindows.twoDaysAgo && date < timeWindows.yesterday;
  };

  const yesterdayActivity = {
    workCreated: workItems.filter(w => w.createdAt && isYesterday(w.createdAt)).length,
    workCompleted: workItems.filter(w => w.status === 'Done' && w.updatedAt && isYesterday(w.updatedAt)).length,
    diagnosticsRun: fullReports.filter(r => r.createdAt && isYesterday(r.createdAt)).length,
    plansGenerated: fullReports.filter(r => r.planJson && r.createdAt && isYesterday(r.createdAt)).length,
  };

  // Owner Issues
  const ownerIssues = computeOwnerIssues(companies, timeWindows);

  return {
    generatedAt: new Date().toISOString(),
    aiGenerated: false,
    overnightSummary: {
      headline,
      highlights,
      workCreated,
      workCompleted,
      diagnosticsRun,
      plansGenerated,
      newOpportunities: 0,
      atRiskChanges: atRiskCompanies.slice(0, 3).map(c => `${c.name} is at risk`),
    },
    focusPlan: {
      keyActions,
      quickWins,
      risks,
      outreachTasks,
    },
    priorityQueue,
    diagnosticReviewQueue,
    pipelineHighlights: {
      newLeads,
      qualifiedProspects: qualifiedProspects.length,
      readyToClose: qualifiedProspects.slice(0, 3).map(c => ({
        companyId: c.id,
        companyName: c.name,
        reason: 'Has completed diagnostics',
      })),
    },
    yesterdayActivity,
    ownerIssues,
  };
}

function computePriorityQueue(
  companies: EnrichedCompany[],
  workItems: WorkItemRecord[],
  timeWindows: BriefingContext['timeWindows']
): DailyBriefingV2['priorityQueue'] {
  return companies
    .filter(c => c.isAtRisk || c.stage === 'client')
    .map(c => {
      const issues: string[] = [];
      let severity: BriefingPriority = 'low';
      let reason = '';

      // Check health status
      if (c.isAtRisk) {
        issues.push('At-risk status');
        severity = 'high';
        reason = c.healthReason || 'At-risk - needs review';
      }

      // Check overdue work
      const companyWork = workItems.filter(w => w.companyId === c.id && w.status !== 'Done');
      const overdueWork = companyWork.filter(w => {
        const due = w.dueDate ? new Date(w.dueDate) : null;
        return due && due < timeWindows.now;
      });

      if (overdueWork.length > 0) {
        issues.push(`${overdueWork.length} overdue work items`);
        if (severity === 'low') severity = 'medium';
        if (!reason) reason = `${overdueWork.length} overdue work items`;
      }

      // Check no owner
      if (!c.owner && c.stage === 'client') {
        issues.push('No owner assigned');
        if (severity === 'low') severity = 'medium';
        if (!reason) reason = 'No owner assigned';
      }

      // Check inactivity
      const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
      if (!lastActivity || lastActivity < timeWindows.thirtyDaysAgo) {
        issues.push('Inactive 30+ days');
        if (severity === 'low') severity = 'medium';
        if (!reason) reason = 'No activity in 30+ days';
      }

      return {
        companyId: c.id,
        companyName: c.name,
        reason: reason || 'Needs review',
        severity,
        issues,
        lastActivity: c.updatedAt,
      };
    })
    .filter(item => item.issues.length > 0)
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 10);
}

function computeOwnerIssues(
  companies: EnrichedCompany[],
  timeWindows: BriefingContext['timeWindows']
): DailyBriefingV2['ownerIssues'] {
  const issues: DailyBriefingV2['ownerIssues'] = [];

  // No owner assigned
  companies
    .filter(c => !c.owner && (c.stage === 'client' || c.stage === 'prospect'))
    .slice(0, 5)
    .forEach(c => {
      issues.push({
        type: 'no_owner',
        companyId: c.id,
        companyName: c.name,
        description: 'No owner assigned to this company',
      });
    });

  // Stalled companies
  companies
    .filter(c => {
      const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
      return c.stage === 'client' && (!lastActivity || lastActivity < timeWindows.sixtyDaysAgo);
    })
    .slice(0, 5)
    .forEach(c => {
      issues.push({
        type: 'stalled',
        companyId: c.id,
        companyName: c.name,
        description: 'No activity in 60+ days',
      });
    });

  return issues;
}

// ============================================================================
// Main Generator
// ============================================================================

export interface GenerateBriefingOptions {
  forceRefresh?: boolean;
  useAI?: boolean;
  role?: BriefingRole;
}

// In-memory cache
let briefingCache: {
  data: DailyBriefingV2 | null;
  timestamp: number;
  ttlMs: number;
} = {
  data: null,
  timestamp: 0,
  ttlMs: 10 * 60 * 1000, // 10 minutes
};

export function invalidateBriefingCache(): void {
  briefingCache.data = null;
  briefingCache.timestamp = 0;
  console.log('[DailyBriefing] Cache invalidated');
}

export async function generateDailyBriefing(
  options: GenerateBriefingOptions = {}
): Promise<DailyBriefingV2> {
  const { forceRefresh = false, useAI = true } = options;

  // Check cache
  const now = Date.now();
  if (!forceRefresh && briefingCache.data && now - briefingCache.timestamp < briefingCache.ttlMs) {
    console.log('[DailyBriefing] Returning cached briefing');
    return briefingCache.data;
  }

  console.log('[DailyBriefing] Generating fresh briefing...');

  // Build context
  const ctx = await buildDailyBriefingContext();

  // Try AI generation if enabled
  let briefing: DailyBriefingV2;

  if (useAI) {
    const aiResult = await generateAIBriefing(ctx);

    if (aiResult) {
      // Merge AI output with deterministic data
      const fallback = generateFallbackBriefing(ctx);

      briefing = {
        ...fallback,
        aiGenerated: true,
        overnightSummary: {
          ...fallback.overnightSummary,
          headline: aiResult.overnightSummary.headline,
          highlights: aiResult.overnightSummary.highlights,
        },
        focusPlan: {
          keyActions: mapAIItems(aiResult.focusPlan.keyActions, ctx.companies, 'key'),
          quickWins: mapAIItems(aiResult.focusPlan.quickWins, ctx.companies, 'win'),
          risks: mapAIItems(aiResult.focusPlan.risks, ctx.companies, 'risk'),
          outreachTasks: mapAIItems(aiResult.focusPlan.outreachTasks, ctx.companies, 'outreach'),
        },
      };
    } else {
      // Fallback to deterministic
      briefing = generateFallbackBriefing(ctx);
    }
  } else {
    briefing = generateFallbackBriefing(ctx);
  }

  // Update cache
  briefingCache = {
    data: briefing,
    timestamp: now,
    ttlMs: 10 * 60 * 1000,
  };

  console.log('[DailyBriefing] Generated:', {
    aiGenerated: briefing.aiGenerated,
    keyActions: briefing.focusPlan.keyActions.length,
    priorityQueue: briefing.priorityQueue.length,
  });

  return briefing;
}

function mapAIItems(
  items: Array<{ title: string; description: string; priority: string; companyName?: string }>,
  companies: EnrichedCompany[],
  prefix: string
): BriefingItem[] {
  return items.slice(0, 5).map((item, idx) => {
    const company = item.companyName
      ? companies.find(c => c.name.toLowerCase().includes(item.companyName!.toLowerCase()))
      : null;

    return {
      id: `${prefix}-${idx}`,
      title: item.title,
      description: item.description,
      priority: normalizePriority(item.priority),
      companyId: company?.id,
      companyName: item.companyName || company?.name,
      linkType: company ? 'company' as const : 'none' as const,
      linkHref: company ? `/c/${company.id}` : undefined,
    };
  });
}

function normalizePriority(priority: string): BriefingPriority {
  const p = priority.toLowerCase();
  if (p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

// ============================================================================
// Role-based Variations (Scaffold)
// ============================================================================

export function filterBriefingForRole(
  briefing: DailyBriefingV2,
  role: BriefingRole
): DailyBriefingV2 {
  // TODO: Implement role-based filtering
  // - exec: High-level summary, key metrics, critical risks only
  // - strategist: Focus on client health, opportunities, outreach
  // - pm: Focus on work items, deadlines, daily tasks

  switch (role) {
    case 'exec':
      return {
        ...briefing,
        focusPlan: {
          ...briefing.focusPlan,
          keyActions: briefing.focusPlan.keyActions.filter(a => a.priority === 'high' || a.priority === 'critical'),
          quickWins: [], // Execs don't need quick wins
        },
      };

    case 'strategist':
      return {
        ...briefing,
        focusPlan: {
          ...briefing.focusPlan,
          keyActions: briefing.focusPlan.keyActions.filter(a => a.companyId), // Focus on client-related
        },
      };

    case 'pm':
    default:
      return briefing;
  }
}
