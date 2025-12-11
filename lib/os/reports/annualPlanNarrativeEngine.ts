// lib/os/reports/annualPlanNarrativeEngine.ts
// Annual Plan Narrative Engine
//
// This module generates narrative content for the 12-month strategic Annual Plan.
// It transforms raw data into compelling strategic narratives that guide
// marketing execution for the coming year.

import Anthropic from '@anthropic-ai/sdk';
import type {
  AnnualPlanData,
  MaturityLevel,
  StrategicPattern,
  DiagnosticModuleSummary,
} from './annualPlanData';
import type { ThemeCluster } from './qbrData';

// ============================================================================
// Types
// ============================================================================

/**
 * A narrative block with title and markdown content
 */
export interface NarrativeBlock {
  title: string;
  content: string;
  icon?: string;
  priority?: number;
}

/**
 * Strategic pillar for the year
 */
export interface StrategicPillar {
  title: string;
  description: string;
  rationale: string;
  themes: string[];
  keyMetrics: string[];
  targetOutcomes: string[];
}

/**
 * Yearly objective (OKR-style)
 */
export interface YearlyObjective {
  objective: string;
  rationale: string;
  keyResults: {
    result: string;
    metric: string;
    target: string;
  }[];
  pillar: string;
  priority: 'P0' | 'P1' | 'P2';
}

/**
 * Quarterly roadmap entry
 */
export interface QuarterRoadmap {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  theme: string;
  focus: string;
  objectives: string[];
  keyDeliverables: string[];
  dependencies: string[];
}

/**
 * Theme roadmap for the year
 */
export interface ThemeRoadmap {
  themeId: string;
  themeLabel: string;
  currentState: string;
  targetState: string;
  quarters: {
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    initiatives: string[];
    milestone: string;
  }[];
  risks: string[];
  successMetrics: string[];
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
  title: string;
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
  category: 'strategic' | 'operational' | 'market' | 'resource';
}

/**
 * Budget framework
 */
export interface BudgetFramework {
  narrative: string;
  allocations: {
    category: string;
    percentAllocation: number;
    rationale: string;
    keyInvestments: string[];
  }[];
  totalEstimate: string;
  assumptions: string[];
}

/**
 * Complete Annual Plan narrative
 */
export interface AnnualPlanNarrative {
  executiveSummary: NarrativeBlock;
  situationalAnalysis: NarrativeBlock;
  strategicPillars: StrategicPillar[];
  yearlyObjectives: YearlyObjective[];
  quarterlyRoadmap: {
    q1: QuarterRoadmap;
    q2: QuarterRoadmap;
    q3: QuarterRoadmap;
    q4: QuarterRoadmap;
  };
  themeRoadmaps: ThemeRoadmap[];
  risks: RiskAssessment[];
  budgetFramework: BudgetFramework;
  fullNarrativeText: string;
  generatedAt: string;
  aiEnhanced: boolean;
}

/**
 * Options for narrative generation
 */
export interface GenerateAnnualPlanOptions {
  /** Use AI for enhanced narrative generation */
  useAI?: boolean;
  /** Target year (defaults to next calendar year) */
  targetYear?: number;
  /** Include budget recommendations */
  includeBudget?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get maturity level display text
 */
function getMaturityDisplay(level: MaturityLevel): string {
  const displays: Record<MaturityLevel, string> = {
    foundational: 'Foundational (Building basics)',
    developing: 'Developing (Growth phase)',
    established: 'Established (Solid foundation)',
    advanced: 'Advanced (High performance)',
    leading: 'Leading (Best-in-class)',
  };
  return displays[level];
}

/**
 * Get current quarter and year
 */
function getCurrentQuarter(): { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; year: number } {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const quarter = month < 3 ? 'Q1' : month < 6 ? 'Q2' : month < 9 ? 'Q3' : 'Q4';
  return { quarter, year };
}

/**
 * Get next year for planning
 */
function getTargetYear(): number {
  const { quarter, year } = getCurrentQuarter();
  // If we're in Q4, plan for next year; otherwise plan for current year
  return quarter === 'Q4' ? year + 1 : year;
}

type SeverityKey = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

/**
 * Get top themes by finding count and severity
 */
function getTopThemes(themes: ThemeCluster[], limit: number = 5): ThemeCluster[] {
  return [...themes]
    .sort((a, b) => {
      // Sort by severity first, then by count
      const severityOrder: Record<SeverityKey, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
      const aSev = severityOrder[a.dominantSeverity as SeverityKey] ?? 4;
      const bSev = severityOrder[b.dominantSeverity as SeverityKey] ?? 4;
      if (aSev !== bSev) return aSev - bSev;
      return b.count - a.count;
    })
    .slice(0, limit);
}

/**
 * Build context summary for AI prompts
 */
function buildContextSummary(data: AnnualPlanData): string {
  const parts: string[] = [];

  parts.push(`Company: ${data.company.name}`);
  parts.push(`Industry: ${data.company.industry || 'Not specified'}`);
  parts.push(`Marketing Maturity: ${getMaturityDisplay(data.diagnostics.maturity)}`);
  parts.push(`Overall Health Score: ${data.diagnostics.overallScore ?? 'N/A'}%`);
  parts.push(`Diagnostic Trend: ${data.diagnostics.trends.overallTrend}`);

  if (data.diagnostics.trends.strongestArea) {
    parts.push(`Strongest Area: ${data.diagnostics.trends.strongestArea}`);
  }
  if (data.diagnostics.trends.weakestArea) {
    parts.push(`Weakest Area: ${data.diagnostics.trends.weakestArea}`);
  }

  parts.push(`\nKey Themes (${data.themes.length} total):`);
  const topThemes = getTopThemes(data.themes, 5);
  for (const theme of topThemes) {
    parts.push(`- ${theme.label}: ${theme.count} findings (${theme.dominantSeverity})`);
  }

  parts.push(`\nStrategic Patterns (${data.strategicPatterns.length} identified):`);
  for (const pattern of data.strategicPatterns.slice(0, 5)) {
    parts.push(`- [${pattern.type}] ${pattern.title}: ${pattern.description}`);
  }

  parts.push(`\nWork Status:`);
  parts.push(`- Completed: ${data.work.totalCompleted}`);
  parts.push(`- In Progress: ${data.work.inProgress.length}`);
  parts.push(`- Backlog: ${data.work.totalBacklog}`);
  parts.push(`- Completion Rate: ${data.work.completionRate}%`);

  if (data.audience) {
    parts.push(`\nAudience:`);
    if (data.audience.primaryAudience) {
      parts.push(`- Primary: ${data.audience.primaryAudience}`);
    }
    if (data.audience.coreSegments.length > 0) {
      parts.push(`- Segments: ${data.audience.coreSegments.join(', ')}`);
    }
    if (data.audience.painPoints.length > 0) {
      parts.push(`- Pain Points: ${data.audience.painPoints.slice(0, 3).join(', ')}`);
    }
  }

  if (data.brand) {
    parts.push(`\nBrand:`);
    if (data.brand.positioning) {
      parts.push(`- Positioning: ${data.brand.positioning}`);
    }
    if (data.brand.valueProps.length > 0) {
      parts.push(`- Value Props: ${data.brand.valueProps.slice(0, 3).join(', ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
function parseAIJson<T>(text: string): T {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

// ============================================================================
// AI Generation Helper
// ============================================================================

/**
 * Call Anthropic API for narrative generation
 */
async function generateWithAI(prompt: string, systemPrompt: string): Promise<string> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

// ============================================================================
// Narrative Generators
// ============================================================================

/**
 * Generate Executive Summary
 */
async function generateExecutiveSummary(
  data: AnnualPlanData,
  targetYear: number,
  useAI: boolean
): Promise<NarrativeBlock> {
  if (useAI) {
    try {
      const systemPrompt = `You are a strategic marketing consultant writing an executive summary for an Annual Marketing Plan.
Be concise, strategic, and actionable. Focus on insights that drive decisions.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Write an executive summary for the ${targetYear} Annual Marketing Plan.

Return JSON:
{
  "title": "plan title",
  "content": "3-4 paragraph summary in markdown format"
}

The content should:
1. Open with the strategic vision for ${targetYear}
2. Highlight the current marketing maturity and key opportunities
3. Summarize the top 3 strategic priorities
4. Close with expected outcomes and success metrics`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{ title: string; content: string }>(result);

      return {
        title: parsed.title || `${targetYear} Annual Marketing Plan`,
        content: parsed.content,
        icon: 'FileText',
        priority: 1,
      };
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for executive summary:', error);
    }
  }

  // Fallback to template-based generation
  const maturityDesc = getMaturityDisplay(data.diagnostics.maturity);
  const topThemes = getTopThemes(data.themes, 3);

  let content = `This Annual Marketing Plan establishes the strategic direction for ${data.company.name}'s marketing organization in ${targetYear}. `;
  content += `Based on comprehensive diagnostic analysis, the organization currently operates at a **${maturityDesc}** maturity level`;
  if (data.diagnostics.overallScore !== null) {
    content += ` with an overall health score of **${data.diagnostics.overallScore}%**`;
  }
  content += '.\n\n';

  content += `The plan addresses ${data.themes.length} strategic themes identified through diagnostic findings. `;
  if (topThemes.length > 0) {
    content += `Priority areas include **${topThemes.map(t => t.label).join('**, **')}**. `;
  }
  content += `${data.strategicPatterns.filter(p => p.type === 'critical-failure').length} critical issues require immediate attention.\n\n`;

  content += `Execution will build on ${data.work.totalCompleted} completed initiatives while advancing ${data.work.totalBacklog} backlog items. `;
  content += `This plan outlines quarterly objectives, resource requirements, and success metrics to guide marketing excellence in ${targetYear}.`;

  return {
    title: `${targetYear} Annual Marketing Plan`,
    content,
    icon: 'FileText',
    priority: 1,
  };
}

/**
 * Generate Situational Analysis
 */
async function generateSituationalAnalysis(
  data: AnnualPlanData,
  useAI: boolean
): Promise<NarrativeBlock> {
  if (useAI) {
    try {
      const systemPrompt = `You are a strategic marketing consultant writing a situational analysis.
Be specific and data-driven. Reference actual scores and findings.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Write a situational analysis covering:
1. Current State Assessment - where the organization stands today
2. Strengths - what's working well (cite specific diagnostic areas)
3. Weaknesses - gaps and challenges (cite specific findings)
4. Opportunities - growth potential based on data
5. Threats/Risks - what could derail progress

Return JSON:
{
  "content": "4-5 paragraphs with bold headers for each section"
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{ content: string }>(result);

      return {
        title: 'Situational Analysis',
        content: parsed.content,
        icon: 'Target',
        priority: 2,
      };
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for situational analysis:', error);
    }
  }

  // Fallback template
  let content = '**Current State**\n\n';
  content += `${data.company.name} has completed ${data.diagnostics.all.length} diagnostic modules over the past 12 months, `;
  content += `establishing a baseline understanding of marketing capabilities. `;
  content += `The organization demonstrates a ${data.diagnostics.maturity} maturity level.\n\n`;

  content += '**Strengths**\n\n';
  const strengths = data.strategicPatterns.filter(p => p.type === 'strength');
  if (strengths.length > 0) {
    content += strengths.map(s => `- ${s.title}: ${s.description}`).join('\n');
  } else {
    content += '- Foundation established for marketing improvement\n';
    content += '- Diagnostic data available for informed decision-making';
  }
  content += '\n\n';

  content += '**Weaknesses**\n\n';
  const weaknesses = data.strategicPatterns.filter(p => p.type === 'critical-failure' || p.type === 'repeated-issue');
  if (weaknesses.length > 0) {
    content += weaknesses.slice(0, 3).map(w => `- ${w.title}: ${w.description}`).join('\n');
  } else {
    content += '- Areas for improvement identified through diagnostics';
  }
  content += '\n\n';

  content += '**Opportunities**\n\n';
  const opportunities = data.strategicPatterns.filter(p => p.type === 'opportunity');
  if (opportunities.length > 0) {
    content += opportunities.slice(0, 3).map(o => `- ${o.title}: ${o.description}`).join('\n');
  } else {
    content += '- Potential for significant improvement across marketing functions';
  }

  return {
    title: 'Situational Analysis',
    content,
    icon: 'Target',
    priority: 2,
  };
}

/**
 * Generate Strategic Pillars
 */
async function generateStrategicPillars(
  data: AnnualPlanData,
  targetYear: number,
  useAI: boolean
): Promise<StrategicPillar[]> {
  if (useAI) {
    try {
      const systemPrompt = `You are a strategic marketing consultant defining strategic pillars.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Define 3-5 strategic pillars for ${targetYear}. Each pillar should:
1. Have a clear, memorable title
2. Address specific diagnostic findings and patterns
3. Include measurable outcomes

Prioritize based on:
- Critical issues that need immediate attention
- Quick wins that build momentum
- Long-term capability building

Return JSON:
{
  "pillars": [
    {
      "title": "string",
      "description": "string",
      "rationale": "string",
      "themes": ["string"],
      "keyMetrics": ["string"],
      "targetOutcomes": ["string"]
    }
  ]
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{ pillars: StrategicPillar[] }>(result);
      return parsed.pillars;
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for strategic pillars:', error);
    }
  }

  // Fallback: Generate pillars from patterns and themes
  const pillars: StrategicPillar[] = [];
  const topThemes = getTopThemes(data.themes, 4);

  // Foundation pillar if maturity is low
  if (data.diagnostics.maturity === 'foundational' || data.diagnostics.maturity === 'developing') {
    pillars.push({
      title: 'Build Marketing Foundation',
      description: 'Establish core marketing capabilities and processes',
      rationale: `Current maturity level (${data.diagnostics.maturity}) indicates need for foundational improvements`,
      themes: ['foundation', 'process', 'infrastructure'],
      keyMetrics: ['Marketing maturity score', 'Process documentation coverage', 'Team capability assessment'],
      targetOutcomes: ['Move to next maturity level', 'Documented marketing processes', 'Clear team responsibilities'],
    });
  }

  // Theme-based pillars
  for (const theme of topThemes.slice(0, 3)) {
    pillars.push({
      title: `Excel in ${theme.label}`,
      description: `Address ${theme.count} identified findings in ${theme.label}`,
      rationale: `${theme.dominantSeverity} severity issues require focused attention`,
      themes: [theme.themeId],
      keyMetrics: [`${theme.label} health score`, 'Finding resolution rate', 'Capability assessment'],
      targetOutcomes: [`Resolve ${Math.ceil(theme.count * 0.7)} of ${theme.count} findings`, `Improve ${theme.label} score by 15 points`],
    });
  }

  return pillars.slice(0, 5);
}

/**
 * Generate Yearly Objectives (OKR-style)
 */
async function generateYearlyObjectives(
  data: AnnualPlanData,
  pillars: StrategicPillar[],
  targetYear: number,
  useAI: boolean
): Promise<YearlyObjective[]> {
  if (useAI) {
    try {
      const pillarContext = pillars.map(p => `- ${p.title}: ${p.description}`).join('\n');

      const systemPrompt = `You are a strategic marketing consultant creating OKR-style objectives.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Strategic Pillars:
${pillarContext}

Create 5-8 yearly objectives for ${targetYear} with 2-4 measurable key results each.
- P0: Must achieve (critical to success)
- P1: Should achieve (high impact)
- P2: Nice to achieve (incremental value)

Return JSON:
{
  "objectives": [
    {
      "objective": "string",
      "rationale": "string",
      "keyResults": [
        { "result": "string", "metric": "string", "target": "string" }
      ],
      "pillar": "string",
      "priority": "P0" | "P1" | "P2"
    }
  ]
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{ objectives: YearlyObjective[] }>(result);
      return parsed.objectives;
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for yearly objectives:', error);
    }
  }

  // Fallback: Generate from pillars
  const objectives: YearlyObjective[] = [];

  for (let i = 0; i < pillars.length; i++) {
    const pillar = pillars[i];
    objectives.push({
      objective: `Achieve excellence in ${pillar.title}`,
      rationale: pillar.rationale,
      keyResults: pillar.targetOutcomes.map((outcome, j) => ({
        result: outcome,
        metric: pillar.keyMetrics[j] || 'Progress assessment',
        target: j === 0 ? '100%' : '80%',
      })),
      pillar: pillar.title,
      priority: i === 0 ? 'P0' : i < 3 ? 'P1' : 'P2',
    });
  }

  return objectives;
}

/**
 * Generate Quarterly Roadmap
 */
async function generateQuarterlyRoadmap(
  data: AnnualPlanData,
  pillars: StrategicPillar[],
  objectives: YearlyObjective[],
  targetYear: number,
  useAI: boolean
): Promise<{
  q1: QuarterRoadmap;
  q2: QuarterRoadmap;
  q3: QuarterRoadmap;
  q4: QuarterRoadmap;
}> {
  if (useAI) {
    try {
      const pillarContext = pillars.map(p => `- ${p.title}`).join('\n');
      const objectiveContext = objectives.slice(0, 5).map(o => `- [${o.priority}] ${o.objective}`).join('\n');

      const systemPrompt = `You are a strategic marketing consultant creating a quarterly roadmap.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Strategic Pillars:
${pillarContext}

Yearly Objectives:
${objectiveContext}

Create a quarterly roadmap for ${targetYear} with:
- Q1: Foundation and quick wins
- Q2: Scale successful initiatives
- Q3: Optimization and expansion
- Q4: Consolidation and planning

Return JSON:
{
  "q1": { "quarter": "Q1", "theme": "string", "focus": "string", "objectives": ["string"], "keyDeliverables": ["string"], "dependencies": ["string"] },
  "q2": { "quarter": "Q2", "theme": "string", "focus": "string", "objectives": ["string"], "keyDeliverables": ["string"], "dependencies": ["string"] },
  "q3": { "quarter": "Q3", "theme": "string", "focus": "string", "objectives": ["string"], "keyDeliverables": ["string"], "dependencies": ["string"] },
  "q4": { "quarter": "Q4", "theme": "string", "focus": "string", "objectives": ["string"], "keyDeliverables": ["string"], "dependencies": ["string"] }
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{
        q1: QuarterRoadmap;
        q2: QuarterRoadmap;
        q3: QuarterRoadmap;
        q4: QuarterRoadmap;
      }>(result);
      return parsed;
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for quarterly roadmap:', error);
    }
  }

  // Fallback roadmap
  const p0Objectives = objectives.filter(o => o.priority === 'P0');
  const p1Objectives = objectives.filter(o => o.priority === 'P1');
  const p2Objectives = objectives.filter(o => o.priority === 'P2');

  return {
    q1: {
      quarter: 'Q1',
      theme: 'Foundation & Quick Wins',
      focus: 'Establish baselines and capture early wins',
      objectives: p0Objectives.slice(0, 2).map(o => o.objective),
      keyDeliverables: ['Updated diagnostic baselines', 'Quick win implementations', 'Team alignment'],
      dependencies: [],
    },
    q2: {
      quarter: 'Q2',
      theme: 'Build & Scale',
      focus: 'Scale successful Q1 initiatives',
      objectives: [...p0Objectives.slice(2), ...p1Objectives.slice(0, 2)].map(o => o.objective).slice(0, 3),
      keyDeliverables: ['Scaled programs', 'Process documentation', 'Performance dashboards'],
      dependencies: ['Q1 foundation complete'],
    },
    q3: {
      quarter: 'Q3',
      theme: 'Optimize & Expand',
      focus: 'Optimize performance and expand reach',
      objectives: p1Objectives.slice(2).map(o => o.objective),
      keyDeliverables: ['Optimization playbooks', 'Expanded programs', 'Mid-year review'],
      dependencies: ['Q2 scale achieved'],
    },
    q4: {
      quarter: 'Q4',
      theme: 'Consolidate & Plan',
      focus: 'Consolidate gains and plan next year',
      objectives: [...p2Objectives.map(o => o.objective), `Plan ${targetYear + 1} strategy`].slice(0, 3),
      keyDeliverables: ['Year-end review', `${targetYear + 1} plan draft`, 'Success documentation'],
      dependencies: ['Q3 optimization complete'],
    },
  };
}

/**
 * Generate Theme Roadmaps
 */
async function generateThemeRoadmaps(
  data: AnnualPlanData,
  targetYear: number,
  useAI: boolean
): Promise<ThemeRoadmap[]> {
  const topThemes = getTopThemes(data.themes, 4);

  if (useAI && topThemes.length > 0) {
    try {
      const themeContext = topThemes.map(t =>
        `- ${t.label}: ${t.count} findings, ${t.dominantSeverity} severity`
      ).join('\n');

      const systemPrompt = `You are a strategic marketing consultant creating theme-specific roadmaps.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Themes to roadmap:
${themeContext}

For each theme, create a year-long roadmap for ${targetYear} with:
1. Current state assessment (1 sentence)
2. Target state by year end (1 sentence)
3. Quarter-by-quarter initiatives and milestones
4. Key risks
5. Success metrics

Return JSON:
{
  "roadmaps": [
    {
      "themeId": "string",
      "themeLabel": "string",
      "currentState": "string",
      "targetState": "string",
      "quarters": [
        { "quarter": "Q1" | "Q2" | "Q3" | "Q4", "initiatives": ["string"], "milestone": "string" }
      ],
      "risks": ["string"],
      "successMetrics": ["string"]
    }
  ]
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{ roadmaps: ThemeRoadmap[] }>(result);
      return parsed.roadmaps;
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for theme roadmaps:', error);
    }
  }

  // Fallback: Generate from themes
  return topThemes.map((theme): ThemeRoadmap => ({
    themeId: theme.themeId,
    themeLabel: theme.label,
    currentState: `${theme.count} findings identified, ${theme.dominantSeverity} severity`,
    targetState: `Resolve 80% of findings, improve health score`,
    quarters: [
      { quarter: 'Q1', initiatives: ['Assessment and prioritization'], milestone: 'Prioritized action plan' },
      { quarter: 'Q2', initiatives: ['Address critical findings'], milestone: '50% critical issues resolved' },
      { quarter: 'Q3', initiatives: ['Scale improvements'], milestone: '70% findings addressed' },
      { quarter: 'Q4', initiatives: ['Sustain and optimize'], milestone: 'Target state achieved' },
    ],
    risks: ['Resource constraints', 'Competing priorities'],
    successMetrics: [`${theme.label} health score improvement`, 'Finding resolution rate'],
  }));
}

/**
 * Generate Risk Assessment
 */
async function generateRisks(
  data: AnnualPlanData,
  useAI: boolean
): Promise<RiskAssessment[]> {
  if (useAI) {
    try {
      const systemPrompt = `You are a strategic marketing consultant assessing risks.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Identify 5-7 key risks that could impact annual plan execution. Include:
1. Strategic risks (market changes, competitive pressure)
2. Operational risks (execution challenges, process gaps)
3. Resource risks (budget, talent, tools)
4. Market risks (economic factors, industry shifts)

Return JSON:
{
  "risks": [
    {
      "title": "string",
      "description": "string",
      "likelihood": "high" | "medium" | "low",
      "impact": "high" | "medium" | "low",
      "mitigation": "string",
      "category": "strategic" | "operational" | "market" | "resource"
    }
  ]
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<{ risks: RiskAssessment[] }>(result);
      return parsed.risks;
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for risks:', error);
    }
  }

  // Fallback risks
  const risks: RiskAssessment[] = [
    {
      title: 'Resource Constraints',
      description: 'Insufficient resources to execute all planned initiatives',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Prioritize P0/P1 objectives, identify efficiency opportunities',
      category: 'resource',
    },
    {
      title: 'Execution Challenges',
      description: 'Difficulty translating strategy into operational execution',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Quarterly reviews, clear ownership, documented processes',
      category: 'operational',
    },
    {
      title: 'Market Changes',
      description: 'Shifts in market conditions requiring strategy adjustment',
      likelihood: 'low',
      impact: 'high',
      mitigation: 'Quarterly strategy reviews, flexible planning approach',
      category: 'market',
    },
  ];

  // Add risks based on data patterns
  const criticalPatterns = data.strategicPatterns.filter(p => p.severity === 'critical');
  if (criticalPatterns.length > 0) {
    risks.unshift({
      title: 'Unresolved Critical Issues',
      description: `${criticalPatterns.length} critical issues may impact business operations`,
      likelihood: 'high',
      impact: 'high',
      mitigation: 'Prioritize critical issue resolution in Q1',
      category: 'strategic',
    });
  }

  return risks;
}

/**
 * Generate Budget Framework
 */
async function generateBudgetFramework(
  data: AnnualPlanData,
  pillars: StrategicPillar[],
  useAI: boolean
): Promise<BudgetFramework> {
  if (useAI) {
    try {
      const pillarContext = pillars.map(p => `- ${p.title}: ${p.description}`).join('\n');

      const systemPrompt = `You are a strategic marketing consultant creating a budget framework.
Do NOT include specific dollar amounts.
Return ONLY valid JSON with no markdown formatting.`;

      const prompt = `${buildContextSummary(data)}

Strategic Pillars:
${pillarContext}

Create a budget framework with:
1. Overall narrative about investment strategy
2. Percent allocation by category (should total ~100%)
3. Key investments per category
4. Assumptions (no specific dollar amounts)

Categories should include: Technology/Tools, Talent/Team, Programs/Campaigns, Agency/Partners, Training/Development

Return JSON:
{
  "narrative": "string",
  "allocations": [
    {
      "category": "string",
      "percentAllocation": number,
      "rationale": "string",
      "keyInvestments": ["string"]
    }
  ],
  "totalEstimate": "string",
  "assumptions": ["string"]
}`;

      const result = await generateWithAI(prompt, systemPrompt);
      const parsed = parseAIJson<BudgetFramework>(result);
      return parsed;
    } catch (error) {
      console.warn('[AnnualPlanNarrative] AI generation failed for budget framework:', error);
    }
  }

  // Fallback budget framework
  return {
    narrative: 'Investment should be allocated strategically across capability building, program execution, and enabling infrastructure. Prioritize investments that address critical gaps while building long-term capabilities.',
    allocations: [
      {
        category: 'Technology & Tools',
        percentAllocation: 25,
        rationale: 'Enable efficiency and measurement',
        keyInvestments: ['Marketing automation', 'Analytics platforms', 'Content tools'],
      },
      {
        category: 'Programs & Campaigns',
        percentAllocation: 35,
        rationale: 'Drive growth and engagement',
        keyInvestments: ['Brand campaigns', 'Demand generation', 'Content marketing'],
      },
      {
        category: 'Talent & Team',
        percentAllocation: 25,
        rationale: 'Build internal capabilities',
        keyInvestments: ['Training programs', 'Key hires', 'Skill development'],
      },
      {
        category: 'Agency & Partners',
        percentAllocation: 15,
        rationale: 'Supplement internal capabilities',
        keyInvestments: ['Creative services', 'Specialized expertise', 'Campaign support'],
      },
    ],
    totalEstimate: 'Based on company size and maturity level',
    assumptions: [
      'Current budget baseline maintained or modestly increased',
      'ROI accountability for all investments',
      'Phased investment aligned with quarterly roadmap',
    ],
  };
}

/**
 * Generate full narrative text (markdown export)
 */
function generateFullNarrativeText(
  narrative: Omit<AnnualPlanNarrative, 'fullNarrativeText' | 'generatedAt' | 'aiEnhanced'>,
  data: AnnualPlanData,
  targetYear: number
): string {
  const lines: string[] = [];

  lines.push(`# ${targetYear} Annual Marketing Plan`);
  lines.push(`## ${data.company.name}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Executive Summary
  lines.push(`## ${narrative.executiveSummary.title}`);
  lines.push('');
  lines.push(narrative.executiveSummary.content);
  lines.push('');

  // Situational Analysis
  lines.push(`## ${narrative.situationalAnalysis.title}`);
  lines.push('');
  lines.push(narrative.situationalAnalysis.content);
  lines.push('');

  // Strategic Pillars
  lines.push('## Strategic Pillars');
  lines.push('');
  for (const pillar of narrative.strategicPillars) {
    lines.push(`### ${pillar.title}`);
    lines.push('');
    lines.push(pillar.description);
    lines.push('');
    lines.push(`**Rationale:** ${pillar.rationale}`);
    lines.push('');
    lines.push('**Key Metrics:**');
    for (const metric of pillar.keyMetrics) {
      lines.push(`- ${metric}`);
    }
    lines.push('');
    lines.push('**Target Outcomes:**');
    for (const outcome of pillar.targetOutcomes) {
      lines.push(`- ${outcome}`);
    }
    lines.push('');
  }

  // Yearly Objectives
  lines.push('## Yearly Objectives');
  lines.push('');
  for (const obj of narrative.yearlyObjectives) {
    lines.push(`### [${obj.priority}] ${obj.objective}`);
    lines.push('');
    lines.push(`*Pillar: ${obj.pillar}*`);
    lines.push('');
    lines.push(obj.rationale);
    lines.push('');
    lines.push('**Key Results:**');
    for (const kr of obj.keyResults) {
      lines.push(`- ${kr.result} (${kr.metric}: ${kr.target})`);
    }
    lines.push('');
  }

  // Quarterly Roadmap
  lines.push('## Quarterly Roadmap');
  lines.push('');
  for (const q of [narrative.quarterlyRoadmap.q1, narrative.quarterlyRoadmap.q2, narrative.quarterlyRoadmap.q3, narrative.quarterlyRoadmap.q4]) {
    lines.push(`### ${q.quarter} ${targetYear}: ${q.theme}`);
    lines.push('');
    lines.push(`**Focus:** ${q.focus}`);
    lines.push('');
    lines.push('**Objectives:**');
    for (const obj of q.objectives) {
      lines.push(`- ${obj}`);
    }
    lines.push('');
    lines.push('**Key Deliverables:**');
    for (const del of q.keyDeliverables) {
      lines.push(`- ${del}`);
    }
    lines.push('');
  }

  // Theme Roadmaps
  if (narrative.themeRoadmaps.length > 0) {
    lines.push('## Theme Roadmaps');
    lines.push('');
    for (const tr of narrative.themeRoadmaps) {
      lines.push(`### ${tr.themeLabel}`);
      lines.push('');
      lines.push(`**Current State:** ${tr.currentState}`);
      lines.push('');
      lines.push(`**Target State:** ${tr.targetState}`);
      lines.push('');
      lines.push('**Quarterly Plan:**');
      for (const q of tr.quarters) {
        lines.push(`- **${q.quarter}:** ${q.initiatives.join(', ')} → *${q.milestone}*`);
      }
      lines.push('');
    }
  }

  // Risks
  lines.push('## Risk Assessment');
  lines.push('');
  for (const risk of narrative.risks) {
    lines.push(`### ${risk.title}`);
    lines.push('');
    lines.push(risk.description);
    lines.push('');
    lines.push(`- **Likelihood:** ${risk.likelihood}`);
    lines.push(`- **Impact:** ${risk.impact}`);
    lines.push(`- **Mitigation:** ${risk.mitigation}`);
    lines.push('');
  }

  // Budget Framework
  lines.push('## Budget Framework');
  lines.push('');
  lines.push(narrative.budgetFramework.narrative);
  lines.push('');
  lines.push('### Allocation Breakdown');
  lines.push('');
  for (const alloc of narrative.budgetFramework.allocations) {
    lines.push(`**${alloc.category}** (${alloc.percentAllocation}%)`);
    lines.push('');
    lines.push(alloc.rationale);
    lines.push('');
    lines.push('Key Investments:');
    for (const inv of alloc.keyInvestments) {
      lines.push(`- ${inv}`);
    }
    lines.push('');
  }

  lines.push('### Assumptions');
  lines.push('');
  for (const assumption of narrative.budgetFramework.assumptions) {
    lines.push(`- ${assumption}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`*Generated by Hive OS Annual Plan Engine on ${new Date().toLocaleDateString()}*`);

  return lines.join('\n');
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate complete Annual Plan narrative
 *
 * This is the main entry point for annual plan generation. It orchestrates
 * all narrative generators and produces a comprehensive strategic plan.
 *
 * @param data - Annual plan data bundle
 * @param options - Generation options
 * @returns Complete Annual Plan narrative
 */
export async function generateAnnualPlanNarrative(
  data: AnnualPlanData,
  options: GenerateAnnualPlanOptions = {}
): Promise<AnnualPlanNarrative> {
  const { useAI = true, targetYear = getTargetYear(), includeBudget = true } = options;

  console.log('[AnnualPlanNarrative] Generating narrative:', {
    company: data.company.name,
    targetYear,
    useAI,
    themes: data.themes.length,
    patterns: data.strategicPatterns.length,
  });

  // Generate all sections
  const [executiveSummary, situationalAnalysis] = await Promise.all([
    generateExecutiveSummary(data, targetYear, useAI),
    generateSituationalAnalysis(data, useAI),
  ]);

  const strategicPillars = await generateStrategicPillars(data, targetYear, useAI);

  const [yearlyObjectives, themeRoadmaps, risks] = await Promise.all([
    generateYearlyObjectives(data, strategicPillars, targetYear, useAI),
    generateThemeRoadmaps(data, targetYear, useAI),
    generateRisks(data, useAI),
  ]);

  const quarterlyRoadmap = await generateQuarterlyRoadmap(
    data,
    strategicPillars,
    yearlyObjectives,
    targetYear,
    useAI
  );

  const budgetFramework = includeBudget
    ? await generateBudgetFramework(data, strategicPillars, useAI)
    : {
        narrative: 'Budget framework not included in this plan.',
        allocations: [],
        totalEstimate: 'N/A',
        assumptions: [],
      };

  // Assemble partial narrative for full text generation
  const partialNarrative = {
    executiveSummary,
    situationalAnalysis,
    strategicPillars,
    yearlyObjectives,
    quarterlyRoadmap,
    themeRoadmaps,
    risks,
    budgetFramework,
  };

  const fullNarrativeText = generateFullNarrativeText(partialNarrative, data, targetYear);

  const narrative: AnnualPlanNarrative = {
    ...partialNarrative,
    fullNarrativeText,
    generatedAt: new Date().toISOString(),
    aiEnhanced: useAI,
  };

  console.log('[AnnualPlanNarrative] Narrative generated:', {
    pillars: strategicPillars.length,
    objectives: yearlyObjectives.length,
    themeRoadmaps: themeRoadmaps.length,
    risks: risks.length,
    textLength: fullNarrativeText.length,
  });

  return narrative;
}

/**
 * Generate a quick summary for preview purposes
 */
export function generateQuickAnnualPlanSummary(data: AnnualPlanData): {
  headline: string;
  maturity: string;
  topPriorities: string[];
  readinessScore: number;
} {
  const topThemes = getTopThemes(data.themes, 3);

  return {
    headline: `${data.company.name} Annual Marketing Plan`,
    maturity: getMaturityDisplay(data.diagnostics.maturity),
    topPriorities: topThemes.map(t => t.label),
    readinessScore: data.coverage.overallReadiness,
  };
}
