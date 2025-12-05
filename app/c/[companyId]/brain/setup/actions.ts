'use server';

// app/c/[companyId]/setup/actions.ts
// Setup Server Actions - Write to Context Graph via mergeField
//
// These actions are used by Setup form components to persist
// changes directly to the Context Graph.

import { revalidatePath } from 'next/cache';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import {
  setFieldUntyped,
  setDomainFieldsWithResult,
  createProvenance,
  type ProvenanceSource,
} from '@/lib/contextGraph/mutate';
import {
  getBindingByFieldId,
  getBindingsForStep,
  type SetupFieldBinding,
} from '@/lib/contextGraph/setupSchema';
import type { SetupStepId, SetupFormData } from './types';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

export interface SaveFieldResult {
  success: boolean;
  contextPath: string;
  error?: string;
}

export interface SaveStepResult {
  success: boolean;
  fieldsWritten: number;
  fieldsBlocked: number;
  blockedPaths: string[];
  errors: string[];
}

// ============================================================================
// Single Field Save
// ============================================================================

/**
 * Save a single Setup field to Context Graph
 *
 * This is the primary action for persisting Setup form edits.
 * It writes directly to the Context Graph with proper provenance.
 */
export async function saveSetupField(
  companyId: string,
  stepId: SetupStepId,
  fieldId: string,
  value: unknown
): Promise<SaveFieldResult> {
  try {
    // Get binding for this field
    const binding = getBindingByFieldId(stepId, fieldId);
    if (!binding) {
      return {
        success: false,
        contextPath: `${stepId}.${fieldId}`,
        error: `Unknown field: ${stepId}.${fieldId}`,
      };
    }

    // Load current graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return {
        success: false,
        contextPath: binding.contextPath,
        error: 'Context graph not found',
      };
    }

    // Create provenance for Setup Wizard
    const provenance = createProvenance('setup_wizard', {
      confidence: 0.95, // High confidence for user edits
      notes: `Setup: ${binding.label}`,
    });

    // Write the field
    setFieldUntyped(
      graph,
      binding.domain,
      binding.field,
      value,
      provenance
    );

    // Save the updated graph
    await saveContextGraph(graph, 'setup-wizard');

    // Revalidate paths
    revalidatePath(`/c/${companyId}/setup`);
    revalidatePath(`/c/${companyId}/brain/context`);

    console.log(`[Setup] Saved ${binding.contextPath} for ${companyId}`);

    return {
      success: true,
      contextPath: binding.contextPath,
    };
  } catch (error) {
    console.error('[Setup] Save field error:', error);
    return {
      success: false,
      contextPath: `${stepId}.${fieldId}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Step Save
// ============================================================================

/**
 * Save all fields for a Setup step to Context Graph
 *
 * This action persists all form data for a step at once,
 * typically called when navigating to the next step.
 */
export async function saveSetupStep(
  companyId: string,
  stepId: SetupStepId,
  stepData: Record<string, unknown>
): Promise<SaveStepResult> {
  const errors: string[] = [];
  let totalWritten = 0;
  let totalBlocked = 0;
  const allBlockedPaths: string[] = [];

  try {
    // Load current graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return {
        success: false,
        fieldsWritten: 0,
        fieldsBlocked: 0,
        blockedPaths: [],
        errors: ['Context graph not found'],
      };
    }

    // Get bindings for this step
    const bindings = getBindingsForStep(stepId);
    if (bindings.length === 0) {
      return {
        success: true,
        fieldsWritten: 0,
        fieldsBlocked: 0,
        blockedPaths: [],
        errors: [],
      };
    }

    // Group bindings by domain
    const bindingsByDomain = new Map<DomainName, SetupFieldBinding[]>();
    for (const binding of bindings) {
      const existing = bindingsByDomain.get(binding.domain) || [];
      existing.push(binding);
      bindingsByDomain.set(binding.domain, existing);
    }

    // Create provenance
    const provenance = createProvenance('setup_wizard', {
      confidence: 0.95,
      notes: `Setup Step: ${stepId}`,
    });

    // Process each domain
    for (const [domain, domainBindings] of bindingsByDomain) {
      // Build fields object for this domain
      const fields: Record<string, unknown> = {};

      for (const binding of domainBindings) {
        const value = stepData[binding.setupFieldId];
        if (value !== undefined) {
          fields[binding.field] = value;
        }
      }

      if (Object.keys(fields).length === 0) continue;

      // Write domain fields
      const { result } = setDomainFieldsWithResult(
        graph,
        domain,
        fields as any,
        provenance
      );

      totalWritten += result.updated;
      totalBlocked += result.blocked;
      allBlockedPaths.push(...result.blockedPaths);
    }

    // Save the updated graph
    if (totalWritten > 0) {
      await saveContextGraph(graph, 'setup-wizard');
    }

    // Revalidate paths
    revalidatePath(`/c/${companyId}/setup`);
    revalidatePath(`/c/${companyId}/brain/context`);
    revalidatePath(`/c/${companyId}/qbr/strategic-plan`);

    console.log(`[Setup] Saved step ${stepId} for ${companyId}: ${totalWritten} fields written, ${totalBlocked} blocked`);

    return {
      success: errors.length === 0,
      fieldsWritten: totalWritten,
      fieldsBlocked: totalBlocked,
      blockedPaths: allBlockedPaths,
      errors,
    };
  } catch (error) {
    console.error('[Setup] Save step error:', error);
    return {
      success: false,
      fieldsWritten: totalWritten,
      fieldsBlocked: totalBlocked,
      blockedPaths: allBlockedPaths,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ============================================================================
// Full Save
// ============================================================================

/**
 * Save all Setup form data to Context Graph
 *
 * This action persists the entire form at once, typically
 * called when finalizing the Setup wizard.
 */
export async function saveSetupFormData(
  companyId: string,
  formData: Partial<SetupFormData>
): Promise<SaveStepResult> {
  const errors: string[] = [];
  let totalWritten = 0;
  let totalBlocked = 0;
  const allBlockedPaths: string[] = [];

  try {
    // Load current graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return {
        success: false,
        fieldsWritten: 0,
        fieldsBlocked: 0,
        blockedPaths: [],
        errors: ['Context graph not found'],
      };
    }

    // Map step form keys to step IDs
    const stepKeyToId: Record<keyof SetupFormData, SetupStepId> = {
      businessIdentity: 'business-identity',
      objectives: 'objectives',
      audience: 'audience',
      personas: 'personas',
      website: 'website',
      mediaFoundations: 'media-foundations',
      budgetScenarios: 'budget-scenarios',
      creativeStrategy: 'creative-strategy',
      measurement: 'measurement',
      summary: 'summary',
    };

    // Create provenance
    const provenance = createProvenance('setup_wizard', {
      confidence: 0.95,
      notes: 'Setup Finalize',
    });

    // Process each step's data
    for (const [stepKey, stepData] of Object.entries(formData)) {
      if (!stepData || typeof stepData !== 'object') continue;

      const stepId = stepKeyToId[stepKey as keyof SetupFormData];
      if (!stepId) continue;

      const bindings = getBindingsForStep(stepId);

      // Group by domain
      const bindingsByDomain = new Map<DomainName, SetupFieldBinding[]>();
      for (const binding of bindings) {
        const existing = bindingsByDomain.get(binding.domain) || [];
        existing.push(binding);
        bindingsByDomain.set(binding.domain, existing);
      }

      // Write each domain
      for (const [domain, domainBindings] of bindingsByDomain) {
        const fields: Record<string, unknown> = {};

        for (const binding of domainBindings) {
          const value = (stepData as Record<string, unknown>)[binding.setupFieldId];
          if (value !== undefined) {
            fields[binding.field] = value;
          }
        }

        if (Object.keys(fields).length === 0) continue;

        const { result } = setDomainFieldsWithResult(
          graph,
          domain,
          fields as any,
          provenance
        );

        totalWritten += result.updated;
        totalBlocked += result.blocked;
        allBlockedPaths.push(...result.blockedPaths);
      }
    }

    // Save the updated graph
    if (totalWritten > 0) {
      await saveContextGraph(graph, 'setup-wizard');
    }

    // Revalidate paths
    revalidatePath(`/c/${companyId}/setup`);
    revalidatePath(`/c/${companyId}/brain/context`);
    revalidatePath(`/c/${companyId}/qbr/strategic-plan`);
    revalidatePath(`/c/${companyId}`);

    console.log(`[Setup] Saved all form data for ${companyId}: ${totalWritten} fields written, ${totalBlocked} blocked`);

    return {
      success: errors.length === 0,
      fieldsWritten: totalWritten,
      fieldsBlocked: totalBlocked,
      blockedPaths: allBlockedPaths,
      errors,
    };
  } catch (error) {
    console.error('[Setup] Save all error:', error);
    return {
      success: false,
      fieldsWritten: totalWritten,
      fieldsBlocked: totalBlocked,
      blockedPaths: allBlockedPaths,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ============================================================================
// Utility Actions
// ============================================================================

/**
 * Clear a single field in Setup (set to null/empty)
 */
export async function clearSetupField(
  companyId: string,
  stepId: SetupStepId,
  fieldId: string
): Promise<SaveFieldResult> {
  const binding = getBindingByFieldId(stepId, fieldId);
  if (!binding) {
    return {
      success: false,
      contextPath: `${stepId}.${fieldId}`,
      error: `Unknown field: ${stepId}.${fieldId}`,
    };
  }

  // Determine empty value based on type
  const emptyValue = binding.type === 'string[]' ? [] :
                     binding.type === 'number' ? null :
                     binding.type === 'boolean' ? false : '';

  return saveSetupField(companyId, stepId, fieldId, emptyValue);
}
