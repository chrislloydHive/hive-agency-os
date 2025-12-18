// tests/fixtures/labs/index.ts
// Lab fixture loader and registry
//
// Loads snapshot fixtures and provides a registry for test scenarios.

import type {
  LabKey,
  LabTestScenario,
  ScenarioRegistry,
} from './types';

// Import fixture files
import { newB2cPetFoodBaseline } from './scenarios/new-b2c-pet-food-baseline';
import { newB2bSaasBaseline } from './scenarios/new-b2b-saas-baseline';
import { existingCompanyRefinement } from './scenarios/existing-company-refinement';
import { localServiceBusiness } from './scenarios/local-service-business';
import { b2bEnterpriseBaseline } from './scenarios/b2b-enterprise-baseline';

// ============================================================================
// Scenario Registry Implementation
// ============================================================================

class LabScenarioRegistry implements ScenarioRegistry {
  scenarios: Map<string, LabTestScenario> = new Map();

  constructor() {
    // Register all scenarios
    this.register(newB2cPetFoodBaseline);
    this.register(newB2bSaasBaseline);
    this.register(existingCompanyRefinement);
    this.register(localServiceBusiness);
    this.register(b2bEnterpriseBaseline);
  }

  register(scenario: LabTestScenario): void {
    this.scenarios.set(scenario.name, scenario);
  }

  getScenario(name: string): LabTestScenario | undefined {
    return this.scenarios.get(name);
  }

  getScenariosForLab(labKey: LabKey): LabTestScenario[] {
    return Array.from(this.scenarios.values()).filter(
      (s) => s.snapshot.labKey === labKey
    );
  }

  getScenariosWithTag(tag: string): LabTestScenario[] {
    return Array.from(this.scenarios.values()).filter(
      (s) => s.tags?.includes(tag)
    );
  }

  getGoldenScenarios(): LabTestScenario[] {
    return Array.from(this.scenarios.values()).filter(
      (s) => s.tags?.includes('golden')
    );
  }

  getAllScenarios(): LabTestScenario[] {
    return Array.from(this.scenarios.values());
  }

  getScenarioNames(): string[] {
    return Array.from(this.scenarios.keys());
  }
}

// ============================================================================
// Exports
// ============================================================================

export const scenarioRegistry = new LabScenarioRegistry();

export { newB2cPetFoodBaseline } from './scenarios/new-b2c-pet-food-baseline';
export { newB2bSaasBaseline } from './scenarios/new-b2b-saas-baseline';
export { existingCompanyRefinement } from './scenarios/existing-company-refinement';
export { localServiceBusiness } from './scenarios/local-service-business';
export { b2bEnterpriseBaseline } from './scenarios/b2b-enterprise-baseline';

export * from './types';
