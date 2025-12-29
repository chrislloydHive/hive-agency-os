// scripts/seedCaseStudies.ts
// Run: npx tsx scripts/seedCaseStudies.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { upsertCaseStudy } from '../lib/airtable/firmBrain';
import { SEED_CASE_STUDIES } from '../lib/os/caseStudies/seed';

async function main() {
  console.log(`Seeding ${SEED_CASE_STUDIES.length} case studies...`);

  const results: Array<{ title: string; client: string; status: string; error?: string }> = [];

  for (const seedData of SEED_CASE_STUDIES) {
    try {
      const caseStudy = await upsertCaseStudy(seedData);
      console.log(`✓ ${seedData.client}: ${seedData.title} (${caseStudy.id})`);
      results.push({ title: seedData.title, client: seedData.client, status: 'success' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`✗ ${seedData.client}: ${errorMessage}`);
      results.push({ title: seedData.title, client: seedData.client, status: 'error', error: errorMessage });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`\nDone: ${successCount} success, ${errorCount} errors`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
