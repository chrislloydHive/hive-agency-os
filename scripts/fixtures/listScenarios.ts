#!/usr/bin/env npx tsx
// scripts/fixtures/listScenarios.ts
// List all available lab test scenarios
//
// Usage:
//   npx ts-node scripts/fixtures/listScenarios.ts
//   npx ts-node scripts/fixtures/listScenarios.ts --lab=brand
//   npx ts-node scripts/fixtures/listScenarios.ts --tag=golden
//   pnpm fixtures:list

import { scenarioRegistry } from '../../tests/fixtures/labs';

// ============================================================================
// Argument Parsing
// ============================================================================

interface ListArgs {
  lab?: string;
  tag?: string;
  verbose?: boolean;
}

function parseArgs(): ListArgs {
  const args: ListArgs = {};

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    switch (key) {
      case 'lab':
        args.lab = value;
        break;
      case 'tag':
        args.tag = value;
        break;
      case 'verbose':
      case 'v':
        args.verbose = true;
        break;
    }
  }

  return args;
}

// ============================================================================
// Display
// ============================================================================

function displayScenario(name: string, verbose: boolean): void {
  const scenario = scenarioRegistry.getScenario(name);
  if (!scenario) return;

  const { snapshot, tags } = scenario;
  const profile = snapshot.companyProfile;

  if (verbose) {
    console.log(`\n  ${name}`);
    console.log(`    Lab: ${snapshot.labKey}`);
    console.log(`    Profile: ${profile.businessModel} | ${profile.industry} | ${profile.stage}`);
    console.log(`    Purpose: ${snapshot.runPurpose}`);
    console.log(`    Tags: ${tags?.join(', ') || 'none'}`);
    console.log(`    Description: ${snapshot.description || 'none'}`);
  } else {
    const tagsStr = tags?.includes('golden') ? ' [golden]' : '';
    console.log(`  ${name}${tagsStr}`);
    console.log(`    ${profile.businessModel} | ${snapshot.labKey} | ${snapshot.runPurpose}`);
  }
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('Lab Test Scenarios');
  console.log('==================\n');

  const args = parseArgs();

  let scenarios = scenarioRegistry.getAllScenarios();

  // Filter by lab
  if (args.lab) {
    scenarios = scenarios.filter((s) => s.snapshot.labKey === args.lab);
    console.log(`Filtered by lab: ${args.lab}\n`);
  }

  // Filter by tag
  if (args.tag) {
    const tag = args.tag;
    scenarios = scenarios.filter((s) => s.tags?.includes(tag));
    console.log(`Filtered by tag: ${tag}\n`);
  }

  if (scenarios.length === 0) {
    console.log('No scenarios found matching criteria.\n');
    console.log('Available scenario names:');
    scenarioRegistry.getScenarioNames().forEach((name) => {
      console.log(`  - ${name}`);
    });
    return;
  }

  console.log(`Found ${scenarios.length} scenario(s):\n`);

  // Group by lab
  const byLab = new Map<string, string[]>();
  scenarios.forEach((s) => {
    const lab = s.snapshot.labKey;
    if (!byLab.has(lab)) byLab.set(lab, []);
    byLab.get(lab)!.push(s.name);
  });

  for (const [lab, names] of byLab) {
    console.log(`${lab.toUpperCase()} LAB:`);
    names.forEach((name) => displayScenario(name, args.verbose || false));
    console.log('');
  }

  // Summary
  console.log('---');
  console.log('Run tests with:');
  console.log('  pnpm test:labs');
  console.log('  pnpm test:labs --scenario=new_b2c_pet_food_baseline');
  console.log('  pnpm test:labs --tag=golden');
}

main();
