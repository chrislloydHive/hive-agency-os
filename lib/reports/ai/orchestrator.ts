// lib/reports/ai/orchestrator.ts
// AI Orchestrator for Report Generation
//
// Coordinates data fetching and AI generation for different report types.
// Uses the existing context graph, insights, and work items.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import type { CompanyReport, ReportBlock, ReportSection, ReportType } from '../types';
import { createEmptyReport, getCurrentYear, getCurrentQuarter } from '../types';
import { saveReport } from '../store';
import { generateAnnualPlanBlocks } from './annualPlanPrompt';
import { generateQbrBlocks } from './qbrStoryPrompt';

// ============================================================================
// Types
// ============================================================================

export interface GenerationContext {
  companyId: string;
  companyName?: string;
  contextGraph: any | null;
  healthScore: any | null;
  // Future: insights, work items, KPIs, etc.
}

// ============================================================================
// Main Entry Points
// ============================================================================

/**
 * Generate an Annual Plan report
 */
export async function generateAnnualPlan(companyId: string): Promise<CompanyReport> {
  console.log(`[Report Orchestrator] Generating Annual Plan for ${companyId}`);

  // Gather context
  const context = await gatherGenerationContext(companyId);

  // Create base report
  const report = createEmptyReport(companyId, 'annual', getCurrentYear());

  // Generate blocks via AI
  const blocks = await generateAnnualPlanBlocks(context);

  // Organize into sections
  report.sections = organizeBlocksIntoSections(blocks, 'annual');
  report.content = blocks;

  // Update metadata
  report.meta.updatedAt = new Date().toISOString();
  report.meta.modelVersion = 'claude-sonnet-4-20250514';

  // Save the report
  await saveReport(report);

  console.log(`[Report Orchestrator] Annual Plan generated with ${blocks.length} blocks`);
  return report;
}

/**
 * Generate a QBR report
 */
export async function generateQBR(companyId: string): Promise<CompanyReport> {
  console.log(`[Report Orchestrator] Generating QBR for ${companyId}`);

  // Gather context
  const context = await gatherGenerationContext(companyId);

  // Create base report
  const report = createEmptyReport(companyId, 'qbr', getCurrentQuarter());

  // Generate blocks via AI
  const blocks = await generateQbrBlocks(context);

  // Organize into sections
  report.sections = organizeBlocksIntoSections(blocks, 'qbr');
  report.content = blocks;

  // Update metadata
  report.meta.updatedAt = new Date().toISOString();
  report.meta.modelVersion = 'claude-sonnet-4-20250514';

  // Save the report
  await saveReport(report);

  console.log(`[Report Orchestrator] QBR generated with ${blocks.length} blocks`);
  return report;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gather all context needed for report generation
 */
async function gatherGenerationContext(companyId: string): Promise<GenerationContext> {
  // Load context graph
  const contextGraph = await loadContextGraph(companyId);

  // Compute health score
  let healthScore = null;
  try {
    healthScore = await computeContextHealthScore(companyId);
  } catch (e) {
    console.warn('[Report Orchestrator] Could not compute health score:', e);
  }

  // Extract company name from context graph
  const companyName = contextGraph?.identity?.businessName?.value || undefined;

  return {
    companyId,
    companyName,
    contextGraph,
    healthScore,
  };
}

/**
 * Organize blocks into sections based on report type
 */
function organizeBlocksIntoSections(
  blocks: ReportBlock[],
  type: ReportType
): ReportSection[] {
  const sections: ReportSection[] = [];
  let currentSection: ReportSection | null = null;
  let sectionOrder = 0;

  for (const block of blocks) {
    // When we hit a section heading, start a new section
    if (block.kind === 'section_heading') {
      if (currentSection) {
        sections.push(currentSection);
      }
      sectionOrder++;
      currentSection = {
        id: `section-${sectionOrder}`,
        title: (block as any).title || `Section ${sectionOrder}`,
        order: sectionOrder,
        blocks: [block],
      };
    } else if (currentSection) {
      currentSection.blocks.push(block);
    } else {
      // Block before any section heading - create an intro section
      currentSection = {
        id: 'section-intro',
        title: 'Overview',
        order: 0,
        blocks: [block],
      };
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}
