// scripts/seedTemplates.ts
// Seed Templates and TemplatePacks tables with initial data
//
// Usage: npx tsx scripts/seedTemplates.ts
// Usage: npx tsx scripts/seedTemplates.ts --force  (to delete and recreate)

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getBase } from '../lib/airtable';

const TEMPLATES_TABLE = 'Templates';
const TEMPLATE_PACKS_TABLE = 'TemplatePacks';
const COUNTERS_TABLE = 'Counters';

const forceRecreate = process.argv.includes('--force');

async function seedTemplates() {
  console.log('🌱 Seeding Templates and TemplatePacks...\n');

  const base = getBase();

  // Check existing templates
  const existingTemplates = await base(TEMPLATES_TABLE)
    .select({})
    .all();

  console.log(`Found ${existingTemplates.length} existing templates:`);
  for (const t of existingTemplates) {
    console.log(`   - ${t.fields.Name} (${t.fields['Document Type']}) - ID: ${t.id}`);
  }
  console.log('');

  if (existingTemplates.length > 0 && forceRecreate) {
    console.log('--force flag detected. Deleting existing templates...');
    const ids = existingTemplates.map((t) => t.id);
    // Delete in batches of 10
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await base(TEMPLATES_TABLE).destroy(batch);
    }
    console.log(`Deleted ${ids.length} templates.\n`);
  }

  // Get current templates after potential deletion
  const currentTemplates = forceRecreate
    ? []
    : await base(TEMPLATES_TABLE).select({}).all();

  if (currentTemplates.length === 0) {
    // Create Templates
    console.log('Creating Templates...');

    const templateRecords = await base(TEMPLATES_TABLE).create([
      {
        fields: {
          Name: 'Standard SOW',
          Scope: 'job',
          'Document Type': 'SOW',
          'Drive Template File ID': 'REPLACE_WITH_YOUR_GOOGLE_DOC_ID',
          'Destination Folder Key': 'estimate',
          'Naming Pattern': '{jobCode} – Statement of Work',
          'Allow AI Drafting': false,
        },
      },
      {
        fields: {
          Name: 'Standard Brief',
          Scope: 'job',
          'Document Type': 'BRIEF',
          'Drive Template File ID': 'REPLACE_WITH_YOUR_GOOGLE_DOC_ID',
          'Destination Folder Key': 'brief',
          'Naming Pattern': '{jobCode} – Project Brief',
          'Allow AI Drafting': false,
        },
      },
      {
        fields: {
          Name: 'Standard Timeline',
          Scope: 'job',
          'Document Type': 'TIMELINE',
          'Drive Template File ID': 'REPLACE_WITH_YOUR_GOOGLE_DOC_ID',
          'Destination Folder Key': 'timeline',
          'Naming Pattern': '{jobCode} – Timeline',
          'Allow AI Drafting': false,
        },
      },
      {
        fields: {
          Name: 'Master Services Agreement',
          Scope: 'client',
          'Document Type': 'MSA',
          'Drive Template File ID': 'REPLACE_WITH_YOUR_GOOGLE_DOC_ID',
          'Destination Folder Key': 'client_msa_folder',
          'Naming Pattern': 'Hive x {clientName} – Master Services Agreement',
          'Allow AI Drafting': false,
        },
      },
    ]);

    console.log(`✅ Created ${templateRecords.length} templates:`);
    for (const record of templateRecords) {
      console.log(`   - ${record.fields.Name} (${record.id})`);
    }
    console.log('');
  } else {
    console.log('Templates already exist. Use --force to delete and recreate.\n');
  }

  // Now handle TemplatePacks
  const existingPacks = await base(TEMPLATE_PACKS_TABLE)
    .select({})
    .all();

  console.log(`Found ${existingPacks.length} existing template packs:`);
  for (const p of existingPacks) {
    console.log(`   - ${p.fields.Name} (${p.id})`);
  }
  console.log('');

  if (existingPacks.length > 0 && forceRecreate) {
    console.log('--force flag detected. Deleting existing packs...');
    const ids = existingPacks.map((p) => p.id);
    await base(TEMPLATE_PACKS_TABLE).destroy(ids);
    console.log(`Deleted ${ids.length} packs.\n`);
  }

  const currentPacks = forceRecreate
    ? []
    : await base(TEMPLATE_PACKS_TABLE).select({}).all();

  if (currentPacks.length === 0) {
    // Get template IDs for linking
    const allTemplates = await base(TEMPLATES_TABLE).select({}).all();
    const sowTemplate = allTemplates.find((r) => r.fields['Document Type'] === 'SOW');
    const briefTemplate = allTemplates.find((r) => r.fields['Document Type'] === 'BRIEF');
    const timelineTemplate = allTemplates.find((r) => r.fields['Document Type'] === 'TIMELINE');

    if (sowTemplate && briefTemplate && timelineTemplate) {
      console.log('Creating Template Pack...');

      const packRecords = await base(TEMPLATE_PACKS_TABLE).create([
        {
          fields: {
            Name: 'Standard Job Pack',
            Templates: [sowTemplate.id, briefTemplate.id, timelineTemplate.id],
            'Is Default': true,
          },
        },
      ]);

      console.log(`✅ Created ${packRecords.length} template pack:`);
      for (const record of packRecords) {
        console.log(`   - ${record.fields.Name} (${record.id})`);
      }
      console.log('');
    } else {
      console.log('⚠️  Could not find all template types to create pack.');
      console.log(`   SOW: ${sowTemplate?.id || 'MISSING'}`);
      console.log(`   BRIEF: ${briefTemplate?.id || 'MISSING'}`);
      console.log(`   TIMELINE: ${timelineTemplate?.id || 'MISSING'}`);
    }
  } else {
    console.log('Template packs already exist. Use --force to delete and recreate.\n');
  }

  // Handle Counters
  console.log('Checking Counters table...');

  try {
    const existingCounters = await base(COUNTERS_TABLE)
      .select({
        filterByFormula: `{Name} = "jobNumber"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingCounters.length > 0) {
      console.log(`✅ jobNumber counter exists with value: ${existingCounters[0].fields.Value}`);
    } else {
      await base(COUNTERS_TABLE).create([
        {
          fields: {
            Name: 'jobNumber',
            Value: 116,
          },
        },
      ]);
      console.log(`✅ Created jobNumber counter with value: 116`);
    }
  } catch (error: any) {
    console.log(`⚠️  Could not access Counters table: ${error.message}`);
  }

  console.log('\n🎉 Seeding complete!');
  console.log('\n⚠️  IMPORTANT: Replace "REPLACE_WITH_YOUR_GOOGLE_DOC_ID" in each template');
  console.log('   with the actual Google Doc template file IDs from your Drive.');
}

seedTemplates().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
