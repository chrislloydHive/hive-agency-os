#!/usr/bin/env npx tsx
// scripts/fixtures/captureLabOutput.ts
// Capture lab output to fixture file for snapshot testing
//
// Usage:
//   npx ts-node scripts/fixtures/captureLabOutput.ts --runId=abc123 --scenario=new_b2c_retail --lab=brand
//   pnpm fixtures:capture --runId=abc123 --scenario=new_b2c_retail --lab=brand

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface CaptureArgs {
  runId: string;
  scenario: string;
  lab: string;
  companyId?: string;
  businessModel?: 'b2b' | 'b2c' | 'local';
  industry?: string;
  stage?: 'new' | 'existing';
  runPurpose?: 'baseline' | 'refinement';
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(): CaptureArgs {
  const args: CaptureArgs = {
    runId: '',
    scenario: '',
    lab: '',
  };

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    switch (key) {
      case 'runId':
        args.runId = value;
        break;
      case 'scenario':
        args.scenario = value;
        break;
      case 'lab':
        args.lab = value;
        break;
      case 'companyId':
        args.companyId = value;
        break;
      case 'businessModel':
        args.businessModel = value as 'b2b' | 'b2c' | 'local';
        break;
      case 'industry':
        args.industry = value;
        break;
      case 'stage':
        args.stage = value as 'new' | 'existing';
        break;
      case 'runPurpose':
        args.runPurpose = value as 'baseline' | 'refinement';
        break;
    }
  }

  return args;
}

function validateArgs(args: CaptureArgs): void {
  if (!args.runId) {
    console.error('Error: --runId is required');
    console.error('Usage: npx ts-node scripts/fixtures/captureLabOutput.ts --runId=abc123 --scenario=my_scenario --lab=brand');
    process.exit(1);
  }

  if (!args.scenario) {
    console.error('Error: --scenario is required');
    console.error('Usage: npx ts-node scripts/fixtures/captureLabOutput.ts --runId=abc123 --scenario=my_scenario --lab=brand');
    process.exit(1);
  }

  if (!args.lab) {
    console.error('Error: --lab is required (brand, website, seo, content, etc.)');
    process.exit(1);
  }
}

// ============================================================================
// Fixture Writing
// ============================================================================

interface LabSnapshot {
  id: string;
  labKey: string;
  companyProfile: {
    businessModel: string;
    industry: string;
    stage: string;
    companyName?: string;
  };
  runPurpose: string;
  rawLabOutput: unknown;
  capturedAt: string;
  description?: string;
}

async function loadLabOutput(runId: string, labKey: string, companyId?: string): Promise<unknown> {
  // Try to load from Airtable diagnostic runs or lab results
  // This is a placeholder - in production, you'd query your actual lab result storage

  console.log(`Looking for lab output: runId=${runId}, lab=${labKey}, companyId=${companyId || 'any'}`);

  // For now, return placeholder instructing manual capture
  console.log('\n--- MANUAL CAPTURE REQUIRED ---');
  console.log('To capture a real lab output:');
  console.log('1. Run the lab for your target company');
  console.log('2. Copy the raw output from the console logs');
  console.log('3. Paste it into the generated fixture file');
  console.log('');

  return {
    _placeholder: true,
    _instructions: 'Replace this with actual lab output',
    findings: {
      positioning: {
        statement: 'PASTE ACTUAL POSITIONING HERE',
      },
      valueProp: {
        primary: 'PASTE ACTUAL VALUE PROP HERE',
        bullets: [],
      },
      differentiators: [],
      icp: {
        primaryAudience: 'PASTE ACTUAL ICP HERE',
        segments: [],
      },
    },
  };
}

async function writeFixture(args: CaptureArgs, labOutput: unknown): Promise<void> {
  const fixturesDir = path.resolve(__dirname, '../../tests/fixtures/labs/captured');

  // Create directory if needed
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const fileName = `${args.scenario}.json`;
  const filePath = path.join(fixturesDir, fileName);

  const snapshot: LabSnapshot = {
    id: `snap-${args.scenario}-${Date.now()}`,
    labKey: args.lab,
    companyProfile: {
      businessModel: args.businessModel || 'b2b',
      industry: args.industry || 'Unknown',
      stage: args.stage || 'new',
    },
    runPurpose: args.runPurpose || 'baseline',
    rawLabOutput: labOutput,
    capturedAt: new Date().toISOString(),
    description: `Captured from run ${args.runId}`,
  };

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

  console.log(`\nFixture written to: ${filePath}`);
  console.log('\nNext steps:');
  console.log('1. Edit the fixture to add expected extraction results');
  console.log('2. Create a TypeScript scenario file in tests/fixtures/labs/scenarios/');
  console.log('3. Register the scenario in tests/fixtures/labs/index.ts');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Lab Output Capture Tool');
  console.log('=======================\n');

  const args = parseArgs();
  validateArgs(args);

  console.log('Configuration:');
  console.log(`  Run ID: ${args.runId}`);
  console.log(`  Scenario: ${args.scenario}`);
  console.log(`  Lab: ${args.lab}`);
  console.log(`  Business Model: ${args.businessModel || 'not specified'}`);
  console.log(`  Stage: ${args.stage || 'not specified'}`);
  console.log('');

  const labOutput = await loadLabOutput(args.runId, args.lab, args.companyId);
  await writeFixture(args, labOutput);

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
