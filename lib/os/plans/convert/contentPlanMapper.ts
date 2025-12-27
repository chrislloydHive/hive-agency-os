// lib/os/plans/convert/contentPlanMapper.ts
// Maps Content Plan sections to Work Items
//
// Conversion mapping:
// - Calendar → Content production tasks (one per calendar item)
// - SEO → SEO setup tasks (keyword clusters, on-page standards)
// - Distribution → Distribution channel setup tasks
// - Pillars → Strategic content pillar tasks
// - Production → Workflow setup tasks

import type {
  ContentPlan,
  ContentCalendarItem,
  ContentPillar,
  DistributionChannel,
} from '@/lib/types/plan';
import type { WorkSourceHeavyPlan, WorkItemArea, WorkItemSeverity } from '@/lib/types/work';
import {
  generateCalendarWorkKey,
  generateSEOWorkKey,
  generateDistributionWorkKey,
  generateWorkKey,
} from './workKeyGenerator';

// ============================================================================
// Types
// ============================================================================

export interface ConvertedWorkItem {
  title: string;
  notes: string;
  area: WorkItemArea;
  severity: WorkItemSeverity;
  source: WorkSourceHeavyPlan;
}

export interface ContentPlanConversionResult {
  calendarTasks: ConvertedWorkItem[];
  seoTasks: ConvertedWorkItem[];
  distributionTasks: ConvertedWorkItem[];
  pillarTasks: ConvertedWorkItem[];
  productionTasks: ConvertedWorkItem[];
  all: ConvertedWorkItem[];
}

// ============================================================================
// Calendar → Work Items
// ============================================================================

/**
 * Convert calendar items to content production tasks
 */
export function mapCalendarToWorkItems(
  plan: ContentPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { calendar } = plan.sections;
  if (!calendar?.length) return [];

  // Only create tasks for planned/in_progress items (not published/archived)
  const activeItems = calendar.filter(
    (item) => item.status === 'planned' || item.status === 'in_progress'
  );

  return activeItems.map((item, index) => {
    const workKey = generateCalendarWorkKey(companyId, plan.id, item.id, item.title);

    return {
      title: `Create ${item.format}: "${item.title}"`,
      notes: buildCalendarNotes(item),
      area: formatToArea(item.format),
      severity: statusToSeverity(item.status),
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'calendar',
        sectionName: 'Content Calendar',
        itemIndex: index,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    };
  });
}

function buildCalendarNotes(item: ContentCalendarItem): string {
  const lines: string[] = [
    `**Format:** ${item.format}`,
    `**Channel:** ${item.channel}`,
    `**Pillar:** ${item.pillar}`,
    `**Objective:** ${item.objective}`,
  ];

  if (item.date || item.weekOf) {
    lines.push(`**Target Date:** ${item.date || `Week of ${item.weekOf}`}`);
  }

  if (item.owner) {
    lines.push(`**Owner:** ${item.owner}`);
  }

  if (item.brief) {
    lines.push(`\n**Brief:**\n${item.brief}`);
  }

  return lines.join('\n');
}

function formatToArea(format: string): WorkItemArea {
  const lower = format.toLowerCase();
  if (lower.includes('blog') || lower.includes('article') || lower.includes('ebook')) return 'Content';
  if (lower.includes('video') || lower.includes('podcast')) return 'Content';
  if (lower.includes('social') || lower.includes('post')) return 'Content';
  if (lower.includes('email') || lower.includes('newsletter')) return 'Funnel';
  if (lower.includes('landing') || lower.includes('page')) return 'Website UX';
  return 'Content';
}

function statusToSeverity(status: ContentCalendarItem['status']): WorkItemSeverity {
  switch (status) {
    case 'in_progress':
      return 'High';
    case 'planned':
      return 'Medium';
    default:
      return 'Low';
  }
}

// ============================================================================
// SEO → Work Items
// ============================================================================

/**
 * Convert SEO section to setup tasks
 */
export function mapSEOToWorkItems(
  plan: ContentPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { seo } = plan.sections;
  if (!seo) return [];

  const tasks: ConvertedWorkItem[] = [];
  let itemIndex = 0;

  // Keyword clusters
  if (seo.keywordClusters?.length) {
    const workKey = generateSEOWorkKey(companyId, plan.id, 'keywords', 'clusters');
    tasks.push({
      title: 'Implement keyword cluster strategy',
      notes: `**Keyword Clusters to Target:**\n${seo.keywordClusters.map((k) => `- ${k}`).join('\n')}`,
      area: 'SEO',
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'seo',
        sectionName: 'SEO Strategy',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  // On-page standards
  if (seo.onPageStandards?.length) {
    const workKey = generateSEOWorkKey(companyId, plan.id, 'onpage', 'standards');
    tasks.push({
      title: 'Establish on-page SEO standards',
      notes: `**On-Page Standards:**\n${seo.onPageStandards.map((s) => `- ${s}`).join('\n')}`,
      area: 'SEO',
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'seo',
        sectionName: 'SEO Strategy',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  // Internal linking rules
  if (seo.internalLinkingRules?.length) {
    const workKey = generateSEOWorkKey(companyId, plan.id, 'linking', 'rules');
    tasks.push({
      title: 'Implement internal linking strategy',
      notes: `**Internal Linking Rules:**\n${seo.internalLinkingRules.map((r) => `- ${r}`).join('\n')}`,
      area: 'SEO',
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'seo',
        sectionName: 'SEO Strategy',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  return tasks;
}

// ============================================================================
// Distribution → Work Items
// ============================================================================

/**
 * Convert distribution channels to setup tasks
 */
export function mapDistributionToWorkItems(
  plan: ContentPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { distribution } = plan.sections;
  if (!distribution?.channels?.length) return [];

  return distribution.channels.map((channel, index) => {
    const workKey = generateDistributionWorkKey(companyId, plan.id, channel.id, channel.channel);

    return {
      title: `Set up ${channel.channel} distribution channel`,
      notes: buildDistributionNotes(channel),
      area: channelToArea(channel.channel),
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'distribution',
        sectionName: 'Distribution',
        itemIndex: index,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    };
  });
}

function buildDistributionNotes(channel: DistributionChannel): string {
  const lines: string[] = [
    `**Channel:** ${channel.channel}`,
    `**Frequency:** ${channel.frequency}`,
    `**Audience:** ${channel.audience}`,
  ];

  if (channel.goals?.length) {
    lines.push('\n**Goals:**');
    channel.goals.forEach((g) => lines.push(`- ${g}`));
  }

  return lines.join('\n');
}

function channelToArea(channel: string): WorkItemArea {
  const lower = channel.toLowerCase();
  if (lower.includes('email') || lower.includes('newsletter')) return 'Funnel';
  if (lower.includes('social') || lower.includes('linkedin') || lower.includes('twitter')) return 'Content';
  if (lower.includes('seo') || lower.includes('organic')) return 'SEO';
  if (lower.includes('partner') || lower.includes('syndication')) return 'Content';
  return 'Content';
}

// ============================================================================
// Pillars → Work Items
// ============================================================================

/**
 * Convert content pillars to strategic setup tasks
 */
export function mapPillarsToWorkItems(
  plan: ContentPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { pillars } = plan.sections;
  if (!pillars?.length) return [];

  return pillars.map((pillar, index) => {
    const workKey = generateWorkKey(companyId, plan.id, 'pillar', `${pillar.id}-${pillar.pillar}`);

    return {
      title: `Develop content pillar: "${pillar.pillar}"`,
      notes: buildPillarNotes(pillar),
      area: 'Content',
      severity: 'High' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'pillars',
        sectionName: 'Content Pillars',
        itemIndex: index,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    };
  });
}

function buildPillarNotes(pillar: ContentPillar): string {
  const lines: string[] = [
    `**Pillar:** ${pillar.pillar}`,
    `**Why:** ${pillar.why}`,
  ];

  if (pillar.targetIntents?.length) {
    lines.push('\n**Target Intents:**');
    pillar.targetIntents.forEach((i) => lines.push(`- ${i}`));
  }

  if (pillar.proofPoints?.length) {
    lines.push('\n**Proof Points:**');
    pillar.proofPoints.forEach((p) => lines.push(`- ${p}`));
  }

  return lines.join('\n');
}

// ============================================================================
// Production → Work Items
// ============================================================================

/**
 * Convert production section to workflow setup tasks
 */
export function mapProductionToWorkItems(
  plan: ContentPlan,
  companyId: string
): ConvertedWorkItem[] {
  const { production } = plan.sections;
  if (!production) return [];

  const tasks: ConvertedWorkItem[] = [];
  let itemIndex = 0;

  // Workflow setup
  if (production.workflowSteps?.length) {
    const workKey = generateWorkKey(companyId, plan.id, 'production', 'workflow');
    tasks.push({
      title: 'Establish content production workflow',
      notes: buildWorkflowNotes(production),
      area: 'Operations',
      severity: 'Medium' as WorkItemSeverity,
      source: {
        sourceType: 'heavy_plan',
        planId: plan.id,
        planType: 'content',
        planVersion: plan.version,
        sectionId: 'production',
        sectionName: 'Production',
        itemIndex: itemIndex++,
        workKey,
        convertedAt: new Date().toISOString(),
      },
    });
  }

  return tasks;
}

function buildWorkflowNotes(production: ContentPlan['sections']['production']): string {
  const lines: string[] = [];

  if (production.workflowSteps?.length) {
    lines.push('**Workflow Steps:**');
    production.workflowSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }

  if (production.roles?.length) {
    lines.push('\n**Roles:**');
    production.roles.forEach((r) => lines.push(`- ${r}`));
  }

  if (production.sla) {
    lines.push(`\n**SLA:** ${production.sla}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Convert a Content Plan to Work Items
 */
export function convertContentPlanToWorkItems(
  plan: ContentPlan,
  companyId: string
): ContentPlanConversionResult {
  // Validate plan is approved
  if (plan.status !== 'approved') {
    throw new Error(`Cannot convert plan in status "${plan.status}". Plan must be approved.`);
  }

  const calendarTasks = mapCalendarToWorkItems(plan, companyId);
  const seoTasks = mapSEOToWorkItems(plan, companyId);
  const distributionTasks = mapDistributionToWorkItems(plan, companyId);
  const pillarTasks = mapPillarsToWorkItems(plan, companyId);
  const productionTasks = mapProductionToWorkItems(plan, companyId);

  return {
    calendarTasks,
    seoTasks,
    distributionTasks,
    pillarTasks,
    productionTasks,
    all: [
      ...pillarTasks, // Pillars first (strategic)
      ...calendarTasks,
      ...seoTasks,
      ...distributionTasks,
      ...productionTasks,
    ],
  };
}
