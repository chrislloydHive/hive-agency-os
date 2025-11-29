// lib/intelligence/prompts.ts
// AI Prompts for OS Intelligence Layer

import type { OSMetrics, OSRisk, OSOpportunity, OSCluster } from './types';

// ============================================================================
// System Analysis Prompt
// ============================================================================

export function buildSystemAnalysisPrompt(input: {
  metrics: OSMetrics;
  risks: OSRisk[];
  opportunities: OSOpportunity[];
  clusters: OSCluster[];
}): string {
  const { metrics, risks, opportunities, clusters } = input;

  return `You are an AI operating system analyst for a B2B marketing agency. Analyze the following workspace health data and provide strategic recommendations.

## Current Metrics

### Company Portfolio
- Total Companies: ${metrics.totalCompanies}
- Companies with Diagnostics: ${metrics.companiesWithDiagnostics} (${metrics.diagnosticsCoverage.toFixed(1)}%)
- Companies with Plans: ${metrics.companiesWithPlans} (${metrics.plansCoverage.toFixed(1)}%)
- Companies At Risk: ${metrics.companiesAtRisk}
- Average GAP Score: ${metrics.avgGapScore !== null ? metrics.avgGapScore.toFixed(1) : 'N/A'}

### Work Throughput (Last 30 Days)
- Work Items Created: ${metrics.workCreated30d}
- Work Items Completed: ${metrics.workCompleted30d}
- Completion Rate: ${metrics.workCompletionRate.toFixed(1)}%
- Overdue Items: ${metrics.workOverdue}

### Engagement
- Active Last Week: ${metrics.companiesActiveLastWeek}
- Inactive 14+ Days: ${metrics.companiesInactiveOver14d}
- Inactive 30+ Days: ${metrics.companiesInactiveOver30d}

### DMA Funnel (Last 30 Days)
- Audits Started: ${metrics.dmaAuditsStarted30d}
- Audits Completed: ${metrics.dmaAuditsCompleted30d}
- Completion Rate: ${metrics.dmaCompletionRate.toFixed(1)}%
- Leads Generated: ${metrics.dmaLeads30d}

### Pipeline
- New Leads (30d): ${metrics.newLeads30d}
- Active Opportunities: ${metrics.activeOpportunities}

## Current Risks (${risks.length})
${risks.map(r => `- [${r.severity.toUpperCase()}] ${r.title}: ${r.description} (${r.count} companies)`).join('\n')}

## Current Opportunities (${opportunities.length})
${opportunities.map(o => `- [${o.impact.toUpperCase()}] ${o.title}: ${o.description} (${o.companies.length} companies)`).join('\n')}

## Risk Clusters (${clusters.length})
${clusters.map(c => `- ${c.clusterName}: ${c.description} (${c.companies.length} companies)`).join('\n')}

---

Based on this data, provide:

1. **Executive Summary** (2-3 sentences): A high-level assessment of workspace health and the most critical insight.

2. **Next Best Action**: The single most impactful action the team should take right now. Include:
   - Title (action-oriented, 5-8 words)
   - Description (1-2 sentences explaining why and expected impact)
   - Priority level (low/medium/high/critical)

3. **System Risks** (3 items): The top 3 systemic risks that need attention, phrased as actionable warnings.

4. **System Opportunities** (3 items): The top 3 opportunities to improve workspace performance, phrased as actionable recommendations.

Respond in JSON format:
{
  "executiveSummary": "...",
  "nextBestAction": {
    "title": "...",
    "description": "...",
    "priority": "high"
  },
  "systemRisks": ["...", "...", "..."],
  "systemOpportunities": ["...", "...", "..."]
}`;
}

// ============================================================================
// Daily Briefing Prompt
// ============================================================================

export function buildDailyBriefingPrompt(input: {
  metrics: OSMetrics;
  recentWork: { created: number; completed: number };
  recentDiagnostics: number;
  atRiskCompanies: { name: string; reason: string }[];
  staleCompanies: { name: string; lastActivity: string }[];
  topOpportunities: { title: string; company: string }[];
}): string {
  const { metrics, recentWork, recentDiagnostics, atRiskCompanies, staleCompanies, topOpportunities } = input;

  return `You are an AI assistant helping a marketing agency operator plan their day. Based on overnight activity and current state, create a focused daily plan.

## Overnight Activity (Since Yesterday)
- Work Items Created: ${recentWork.created}
- Work Items Completed: ${recentWork.completed}
- Diagnostics Run: ${recentDiagnostics}

## Current State
- Total Companies: ${metrics.totalCompanies}
- At Risk: ${metrics.companiesAtRisk}
- Overdue Work: ${metrics.workOverdue}
- Inactive 14+ Days: ${metrics.companiesInactiveOver14d}

## At-Risk Companies (${atRiskCompanies.length})
${atRiskCompanies.slice(0, 5).map(c => `- ${c.name}: ${c.reason}`).join('\n') || 'None'}

## Stale/Inactive Companies (${staleCompanies.length})
${staleCompanies.slice(0, 5).map(c => `- ${c.name}: Last activity ${c.lastActivity}`).join('\n') || 'None'}

## Top Opportunities (${topOpportunities.length})
${topOpportunities.slice(0, 5).map(o => `- ${o.title} (${o.company})`).join('\n') || 'None'}

---

Create a daily focus plan with:

1. **Headline** (1 sentence): A motivating summary of what to focus on today.

2. **Key Actions** (3 items): The most important strategic actions for today. Each should have:
   - Title (action-oriented)
   - Description (brief explanation)
   - Priority (low/medium/high)

3. **Quick Wins** (3 items): Small tasks that can be completed quickly for immediate value.

4. **Risks to Address** (3 items): Urgent issues that need attention today.

5. **Outreach Tasks** (3 items): Companies or stakeholders to contact today.

Respond in JSON format:
{
  "headline": "...",
  "keyActions": [{"title": "...", "description": "...", "priority": "high"}, ...],
  "quickWins": [{"title": "...", "description": "...", "priority": "medium"}, ...],
  "risks": [{"title": "...", "description": "...", "priority": "high"}, ...],
  "outreachTasks": [{"title": "...", "description": "...", "priority": "medium"}, ...]
}`;
}

// ============================================================================
// Overnight Summary Prompt
// ============================================================================

export function buildOvernightSummaryPrompt(input: {
  workCreated: number;
  workCompleted: number;
  diagnosticsRun: number;
  newOpportunities: number;
  atRiskChanges: string[];
  analyticsShifts: string[];
}): string {
  const { workCreated, workCompleted, diagnosticsRun, newOpportunities, atRiskChanges, analyticsShifts } = input;

  return `Summarize overnight activity for an agency operating system in 2-3 sentences. Be concise and highlight the most important changes.

Activity:
- Work created: ${workCreated}
- Work completed: ${workCompleted}
- Diagnostics run: ${diagnosticsRun}
- New opportunities: ${newOpportunities}
- At-risk changes: ${atRiskChanges.join(', ') || 'None'}
- Analytics shifts: ${analyticsShifts.join(', ') || 'None'}

Respond with just the summary text, no JSON.`;
}
