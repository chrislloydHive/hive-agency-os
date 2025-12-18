#!/usr/bin/env npx tsx
// scripts/debugContextSources.ts
// Debug script to check all context data sources for a company
//
// Usage: npx tsx scripts/debugContextSources.ts <companyId>

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getCompanyById } from '../lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '../lib/os/diagnostics/runs';
import { getGapIaRunsForCompanyOrDomain } from '../lib/airtable/gapIaRuns';
import { getGapPlanRunsForCompanyOrDomain } from '../lib/airtable/gapPlanRuns';
import { getHeavyGapRunsByCompanyId } from '../lib/airtable/gapHeavyRuns';
import { loadContextGraph } from '../lib/contextGraph/storage';
import { checkAvailableImporters } from '../lib/contextGraph/importers';

async function main() {
  const companyId = process.argv[2];

  if (!companyId) {
    console.error('Usage: npx tsx scripts/debugContextSources.ts <companyId>');
    process.exit(1);
  }

  console.log('\n=== CONTEXT DATA SOURCES DEBUG ===\n');
  console.log('Company ID:', companyId);

  // 1. Get company info
  console.log('\n--- Company Info ---');
  const company = await getCompanyById(companyId);
  if (!company) {
    console.error('Company not found!');
    process.exit(1);
  }
  console.log('Name:', company.name);
  console.log('Domain:', company.domain || company.website || '(none)');
  const domain = company.domain || company.website || '';

  // 2. Check Context Graph
  console.log('\n--- Context Graph (ContextGraphs table) ---');
  const contextGraph = await loadContextGraph(companyId);
  if (contextGraph) {
    console.log('✓ Context Graph exists');

    // Count fields with values across all domains
    let fieldsWithValues = 0;
    let totalFields = 0;
    // The context graph has domain properties directly on it (identity, brand, etc.)
    const domainNames = ['identity', 'brand', 'objectives', 'audience', 'productOffer', 'digitalInfra', 'website', 'content', 'seo', 'ops', 'performanceMedia', 'historical', 'creative', 'competitive'] as const;
    for (const domainName of domainNames) {
      const domainData = contextGraph[domainName];
      if (domainData && typeof domainData === 'object') {
        for (const [fieldName, fieldData] of Object.entries(domainData)) {
          if (fieldName === '_meta') continue;
          totalFields++;
          if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && fieldData.value) {
            fieldsWithValues++;
          }
        }
      }
    }
    console.log('  Fields with values:', fieldsWithValues, '/', totalFields);
  } else {
    console.log('✗ No Context Graph found');
  }

  // 3. Check Diagnostic Runs (unified table)
  console.log('\n--- Diagnostic Runs (unified table) ---');
  const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, { limit: 20 });
  console.log('Total runs:', diagnosticRuns.length);

  if (diagnosticRuns.length > 0) {
    // Group by tool
    const byTool: Record<string, typeof diagnosticRuns> = {};
    for (const run of diagnosticRuns) {
      if (!byTool[run.toolId]) byTool[run.toolId] = [];
      byTool[run.toolId].push(run);
    }

    for (const [toolId, runs] of Object.entries(byTool)) {
      const latest = runs[0];
      const hasRawJson = !!latest.rawJson;
      const rawJsonSize = hasRawJson ? JSON.stringify(latest.rawJson).length : 0;
      console.log(`  ${toolId}: ${runs.length} run(s)`);
      console.log(`    Latest: ${latest.status} | rawJson: ${hasRawJson ? `✓ (${rawJsonSize} chars)` : '✗ EMPTY'} | score: ${latest.score ?? 'n/a'}`);
    }
  }

  // 4. Check GAP-IA Runs (legacy table)
  console.log('\n--- GAP-IA Runs (legacy table) ---');
  try {
    const gapIaRuns = await getGapIaRunsForCompanyOrDomain(companyId, domain, 10);
    console.log('Total runs:', gapIaRuns.length);
    if (gapIaRuns.length > 0) {
      for (const run of gapIaRuns.slice(0, 3)) {
        const hasData = !!(run.core || run.dimensions || run.summary);
        console.log(`  ${run.id}: status=${run.status} | hasData=${hasData} | score=${run.overallScore ?? 'n/a'}`);
      }
    }
  } catch (e) {
    console.log('Error fetching GAP-IA runs:', e);
  }

  // 5. Check GAP Plan Runs (legacy table)
  console.log('\n--- GAP Plan Runs (legacy table) ---');
  try {
    const gapPlanRuns = await getGapPlanRunsForCompanyOrDomain(companyId, domain, 10);
    console.log('Total runs:', gapPlanRuns.length);
    if (gapPlanRuns.length > 0) {
      for (const run of gapPlanRuns.slice(0, 3)) {
        console.log(`  ${run.id}: status=${run.status} | score=${run.overallScore ?? 'n/a'}`);
      }
    }
  } catch (e) {
    console.log('Error fetching GAP Plan runs:', e);
  }

  // 6. Check Heavy GAP Runs (legacy table)
  console.log('\n--- Heavy GAP Runs (legacy table) ---');
  try {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 10);
    console.log('Total runs:', heavyRuns.length);
    if (heavyRuns.length > 0) {
      for (const run of heavyRuns.slice(0, 3)) {
        const hasEvidence = !!run.evidencePack;
        console.log(`  ${run.id}: status=${run.status} | hasEvidencePack=${hasEvidence}`);
      }
    }
  } catch (e) {
    console.log('Error fetching Heavy GAP runs:', e);
  }

  // 7. Check importer availability
  console.log('\n--- Importer Availability ---');
  try {
    const importers = await checkAvailableImporters(companyId, domain);
    for (const imp of importers) {
      console.log(`  ${imp.label}: ${imp.hasData ? '✓ HAS DATA' : '✗ no data'}`);
    }
  } catch (e) {
    console.log('Error checking importers:', e);
  }

  console.log('\n=== END DEBUG ===\n');
}

main().catch(console.error);
