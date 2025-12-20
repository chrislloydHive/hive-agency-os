// scripts/seed-test-data.ts
// Run with: npx tsx scripts/seed-test-data.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

// Use existing lib functions which handle field mapping
import { createCompany } from '../lib/airtable/companies';
import { createInboundLead } from '../lib/airtable/inboundLeads';
import { createOpportunity } from '../lib/airtable/opportunities';

async function seedTestData() {
  console.log('Seeding test data...\n');

  // 1. Create test companies
  console.log('Creating test companies...');
  const companyIds: string[] = [];

  const companies = [
    { name: 'Acme Corp', website: 'https://acme.com' },
    { name: 'TechStart Inc', website: 'https://techstart.io' },
    { name: 'GreenLeaf Organics', website: 'https://greenleaf.com' },
  ];

  for (const company of companies) {
    try {
      const record = await createCompany(company);
      if (record) {
        companyIds.push(record.id);
        console.log(`  Created: ${company.name}`);
      }
    } catch (err: any) {
      console.log(`  Failed: ${company.name} - ${err.message}`);
    }
  }
  console.log(`Created ${companyIds.length} companies\n`);

  // 2. Create test inbound leads
  console.log('Creating test inbound leads...');
  let leadsCreated = 0;

  const leads = [
    {
      name: 'John Smith',
      email: 'john@acme.com',
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyId: companyIds[0],
    },
    {
      name: 'Sarah Chen',
      email: 'sarah@techstart.io',
      companyName: 'TechStart Inc',
      website: 'https://techstart.io',
      companyId: companyIds[1],
    },
    {
      name: 'Mike Johnson',
      email: 'mike@greenleaf.com',
      companyName: 'GreenLeaf Organics',
      website: 'https://greenleaf.com',
      companyId: companyIds[2],
    },
    {
      name: 'Emily Davis',
      email: 'emily@davisconsulting.com',
      companyName: 'Davis Consulting',
      website: 'https://davisconsulting.com',
    },
    {
      name: 'Alex Rivera',
      email: 'alex@riveradesign.com',
      companyName: 'Rivera Design Studio',
      website: 'https://riveradesign.com',
    },
  ];

  for (const lead of leads) {
    try {
      const record = await createInboundLead(lead);
      if (record) {
        leadsCreated++;
        console.log(`  Created: ${lead.name}`);
      }
    } catch (err: any) {
      console.log(`  Failed: ${lead.name} - ${err.message}`);
    }
  }
  console.log(`Created ${leadsCreated} inbound leads\n`);

  // 3. Create test opportunities
  console.log('Creating test opportunities...');
  let oppsCreated = 0;

  const opportunities = [
    {
      name: 'Website Redesign',
      stage: 'proposal_submitted' as const,
    },
    {
      name: 'SEO Campaign',
      stage: 'discovery_clarification' as const,
    },
    {
      name: 'E-commerce Optimization',
      stage: 'decision' as const,
    },
    {
      name: 'Brand Strategy Project',
      stage: 'solution_shaping' as const,
    },
  ];

  for (const opp of opportunities) {
    try {
      const record = await createOpportunity(opp);
      if (record) {
        oppsCreated++;
        console.log(`  Created: ${opp.name}`);
      }
    } catch (err: any) {
      console.log(`  Failed: ${opp.name} - ${err.message}`);
    }
  }
  console.log(`Created ${oppsCreated} opportunities\n`);

  console.log('Done! Test data seeded.');
  console.log(`Summary: ${companyIds.length} companies, ${leadsCreated} leads, ${oppsCreated} opportunities`);
}

seedTestData().catch((err) => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
