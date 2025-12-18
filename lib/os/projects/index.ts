// lib/os/projects/index.ts
// Project lifecycle management
//
// Projects flow: GAP → Project Strategy → Creative Brief → Work Items
// After brief approval, strategy is locked and brief becomes canonical

import {
  createProject as createProjectRecord,
  getProjectById,
  getProjectsForCompany,
  getProjectsForEngagement,
  updateProject,
  linkStrategyToProject,
  linkBriefToProject,
  lockProject,
  updateProjectBetsStatus,
  getProjectListItems,
} from '@/lib/airtable/projects';
import {
  createProjectStrategy,
  getProjectStrategyByProjectId,
  lockProjectStrategy,
} from '@/lib/airtable/projectStrategies';
import { getCreativeBriefByProjectId } from '@/lib/airtable/creativeBriefs';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { Project, CreateProjectInput, ProjectReadiness } from '@/lib/types/project';
import type { ProjectStrategy, CompanyStrategySnapshot } from '@/lib/types/projectStrategy';
import type { CreativeBrief } from '@/lib/types/creativeBrief';
import { validateGapReadiness } from './gapGating';
import { calculateStrategyReadiness, hasAcceptedBets } from '@/lib/types/projectStrategy';

// Re-export types
export type { Project, CreateProjectInput, ProjectReadiness };
export type { ProjectStrategy };
export type { CreativeBrief };

// Re-export CRUD operations
export {
  getProjectById,
  getProjectsForCompany,
  getProjectsForEngagement,
  updateProject,
  getProjectListItems,
};

// ============================================================================
// Project Creation
// ============================================================================

/**
 * Create a new project with associated project strategy
 * Optionally inherits from company strategy
 */
export async function createProjectWithStrategy(
  input: CreateProjectInput,
  options?: {
    inheritFromCompanyStrategy?: boolean;
  }
): Promise<{ project: Project; strategy: ProjectStrategy } | null> {
  try {
    // 1. Create the project record
    const project = await createProjectRecord(input);
    if (!project) {
      console.error('[Projects] Failed to create project record');
      return null;
    }

    // 2. Get company strategy for inheritance if requested
    let inheritedSnapshot: CompanyStrategySnapshot | undefined;

    if (options?.inheritFromCompanyStrategy !== false) {
      const companyStrategy = await getActiveStrategy(input.companyId);
      if (companyStrategy) {
        inheritedSnapshot = {
          companyStrategyId: companyStrategy.id,
          snapshotAt: new Date().toISOString(),
          audience: companyStrategy.strategyFrame?.audience,
          offering: companyStrategy.strategyFrame?.offering,
          valueProp: companyStrategy.strategyFrame?.valueProp,
          positioning: companyStrategy.strategyFrame?.positioning,
          constraints: companyStrategy.strategyFrame?.constraints,
        };
      }
    }

    // 3. Create project strategy with inherited snapshot
    const strategy = await createProjectStrategy(
      {
        companyId: input.companyId,
        projectId: project.id,
      },
      inheritedSnapshot,
      inheritedSnapshot
        ? {
            targetAudience: inheritedSnapshot.audience,
          }
        : undefined
    );

    if (!strategy) {
      console.error('[Projects] Failed to create project strategy');
      // Note: We don't delete the project here - it's created but without strategy
      return null;
    }

    // 4. Link strategy to project
    const updatedProject = await linkStrategyToProject(project.id, strategy.id);

    return {
      project: updatedProject || project,
      strategy,
    };
  } catch (error) {
    console.error('[Projects] Failed to create project with strategy:', error);
    return null;
  }
}

// ============================================================================
// Project Data Loading
// ============================================================================

/**
 * Full project view model with strategy and brief
 */
export interface ProjectViewModel {
  project: Project;
  strategy: ProjectStrategy | null;
  brief: CreativeBrief | null;
  readiness: ProjectReadiness;
}

/**
 * Get complete project data with strategy and brief
 */
export async function getProjectWithDetails(projectId: string): Promise<ProjectViewModel | null> {
  try {
    // Load project
    const project = await getProjectById(projectId);
    if (!project) return null;

    // Load strategy
    const strategy = project.projectStrategyId
      ? await getProjectStrategyByProjectId(project.id)
      : null;

    // Load brief
    const brief = project.creativeBriefId
      ? await getCreativeBriefByProjectId(project.id)
      : null;

    // Calculate readiness
    const readiness = await calculateProjectReadiness(project, strategy);

    return {
      project,
      strategy,
      brief,
      readiness,
    };
  } catch (error) {
    console.error(`[Projects] Failed to get project details for ${projectId}:`, error);
    return null;
  }
}

// ============================================================================
// Readiness Calculations
// ============================================================================

/**
 * Calculate project readiness for brief generation
 */
export async function calculateProjectReadiness(
  project: Project,
  strategy: ProjectStrategy | null
): Promise<ProjectReadiness> {
  // Check GAP readiness
  const gapResult = await validateGapReadiness(project.companyId);

  // Check strategy readiness
  const strategyReadiness = strategy
    ? calculateStrategyReadiness(strategy)
    : { ready: false, frameComplete: false, hasObjectives: false, hasAcceptedBets: false };

  // Check brief status
  const briefExists = Boolean(project.creativeBriefId);
  const briefApproved = project.briefApproved;

  // Can generate brief if:
  // 1. GAP is complete
  // 2. Strategy exists with complete frame, objectives, and accepted bets
  const canGenerateBrief =
    gapResult.ready &&
    strategy !== null &&
    strategyReadiness.ready;

  // Determine blocked reason
  let blockedReason: string | undefined;
  if (!gapResult.ready) {
    blockedReason = gapResult.blockedReason || 'Complete Full GAP before generating brief';
  } else if (!strategy) {
    blockedReason = 'Project strategy not found';
  } else if (!strategyReadiness.ready) {
    blockedReason = strategyReadiness.blockedReason;
  }

  return {
    gapComplete: gapResult.ready,
    gapReportId: gapResult.gapReportId,
    gapScore: gapResult.gapScore,
    strategyExists: strategy !== null,
    frameComplete: strategyReadiness.frameComplete,
    hasObjectives: strategyReadiness.hasObjectives,
    hasAcceptedBets: strategyReadiness.hasAcceptedBets,
    canGenerateBrief,
    briefExists,
    briefApproved,
    blockedReason,
  };
}

// ============================================================================
// Brief Approval and Locking
// ============================================================================

/**
 * Approve brief and lock project + strategy
 * This is the terminal action for project-scoped strategy
 */
export async function approveBriefAndLockProject(
  projectId: string,
  briefId: string,
  approvedBy?: string
): Promise<{
  success: boolean;
  project?: Project;
  strategy?: ProjectStrategy;
  error?: string;
}> {
  try {
    // 1. Get project
    const project = await getProjectById(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // 2. Verify brief belongs to project
    if (project.creativeBriefId !== briefId) {
      return { success: false, error: 'Brief does not belong to this project' };
    }

    // 3. Lock strategy
    let lockedStrategy: ProjectStrategy | null = null;
    if (project.projectStrategyId) {
      lockedStrategy = await lockProjectStrategy(
        project.projectStrategyId,
        'Brief approved'
      );
    }

    // 4. Update project with brief approval and lock
    const now = new Date().toISOString();
    const updatedProject = await updateProject(projectId, {
      briefApproved: true,
      briefApprovedAt: now,
      briefApprovedBy: approvedBy,
      isLocked: true,
      lockedAt: now,
      lockedReason: 'Brief approved',
      status: 'in_progress',
    });

    if (!updatedProject) {
      return { success: false, error: 'Failed to update project' };
    }

    return {
      success: true,
      project: updatedProject,
      strategy: lockedStrategy || undefined,
    };
  } catch (error) {
    console.error('[Projects] Failed to approve brief:', error);
    return { success: false, error: 'Failed to approve brief' };
  }
}

// ============================================================================
// Strategy Bets Sync
// ============================================================================

/**
 * Sync accepted bets status from strategy to project
 * Called after bet status changes
 */
export async function syncBetsStatusToProject(projectId: string): Promise<Project | null> {
  try {
    const project = await getProjectById(projectId);
    if (!project) return null;

    if (!project.projectStrategyId) return project;

    const strategy = await getProjectStrategyByProjectId(project.id);
    if (!strategy) return project;

    const betsAccepted = hasAcceptedBets(strategy);

    if (project.hasAcceptedBets !== betsAccepted) {
      return await updateProjectBetsStatus(projectId, betsAccepted);
    }

    return project;
  } catch (error) {
    console.error('[Projects] Failed to sync bets status:', error);
    return null;
  }
}
