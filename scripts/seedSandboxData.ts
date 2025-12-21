/**
 * Seed Sandbox Data for UI Validation
 *
 * Creates realistic test data for end-to-end UI testing.
 * This data is temporary and may be deleted later.
 *
 * Usage:
 *   npx tsx scripts/seedSandboxData.ts
 *
 * Creates:
 * - 1 Company: "Sandbox Company"
 * - 4 Opportunities linked to the company
 * - 10 Activities linked to the opportunities
 *
 * NOTE: The API token can only use select values that already exist in records.
 * After running this script, manually update Stage values in Airtable to:
 * - Sandbox RFP: "Proposal/RFP Submitted"
 * - Sandbox Discovery: "Discovery/Clarification"
 * - Sandbox Negotiation: "Solution Shaping"
 * - Sandbox Won: "Won" (already correct)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Airtable from 'airtable';

// Validate env
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Table names
const COMPANIES_TABLE = process.env.AIRTABLE_COMPANIES_TABLE || 'Companies';
const OPPORTUNITIES_TABLE = process.env.AIRTABLE_OPPORTUNITIES_TABLE || 'Opportunities';
const ACTIVITIES_TABLE = process.env.AIRTABLE_ACTIVITIES_TABLE || 'Activities';

// Date helpers
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🌱 Seeding Sandbox Data...\n');
  console.log(`Tables: Companies="${COMPANIES_TABLE}", Opportunities="${OPPORTUNITIES_TABLE}", Activities="${ACTIVITIES_TABLE}"\n`);

  // =========================================================================
  // 1. Create Company
  // =========================================================================
  console.log('Creating Company...');

  const companyRecords = await base(COMPANIES_TABLE).create([
    {
      fields: {
        'Company Name': 'Sandbox Company',
        'Domain': 'sandbox-company.example.com',
        'Website': 'https://sandbox-company.example.com',
      },
    },
  ]);

  const companyId = companyRecords[0].id;
  console.log(`  ✓ Created Company: ${companyId} - "Sandbox Company"\n`);

  // =========================================================================
  // 2. Create Opportunities
  // =========================================================================
  console.log('Creating Opportunities...');
  console.log('  Note: Using existing select values only. Update Stage manually afterward.\n');

  // Use existing select values (Lost/Won only for Stage)
  // User should manually update Stage in Airtable after creation
  const opportunityData = [
    {
      name: 'Sandbox RFP – Website Redesign',
      stage: 'Lost', // Change to "Proposal/RFP Submitted" in Airtable
      targetStage: 'Proposal/RFP Submitted',
      value: 125000,
      closeDate: daysFromNow(30),
      nextStep: 'Submit final RFP response',
      dueDate: daysFromNow(3),
    },
    {
      name: 'Sandbox Discovery – Brand Strategy',
      stage: 'Lost', // Change to "Discovery/Clarification" in Airtable
      targetStage: 'Discovery/Clarification',
      value: 45000,
      closeDate: daysFromNow(60),
      nextStep: 'Schedule discovery call',
      dueDate: daysFromNow(7),
    },
    {
      name: 'Sandbox Negotiation – Q1 Campaign',
      stage: 'Lost', // Change to "Solution Shaping" in Airtable
      targetStage: 'Solution Shaping',
      value: 78000,
      closeDate: daysFromNow(14),
      nextStep: 'Follow up on SOW',
      dueDate: daysFromNow(-2), // Overdue
    },
    {
      name: 'Sandbox Won – SEO Engagement',
      stage: 'Won', // Already correct
      targetStage: 'Won',
      value: 36000,
      closeDate: daysFromNow(-7),
      nextStep: 'Kickoff meeting scheduled',
      dueDate: daysFromNow(1),
    },
  ];

  const opportunityRecords: Airtable.Record<Airtable.FieldSet>[] = [];

  for (const opp of opportunityData) {
    try {
      // Create with minimal select fields that have existing values
      const fields: Record<string, unknown> = {
        'Name': opp.name,
        'Company': [companyId],
        'Stage': opp.stage,
        'Value (USD)': opp.value,
        'Expected Close Date': opp.closeDate,
        'Next Step': opp.nextStep,
        'Due Date': opp.dueDate,
      };

      // Only add Deal Health for Won (Stalled exists)
      if (opp.stage === 'Won') {
        fields['Deal Health'] = 'Stalled';
      }

      const record = await base(OPPORTUNITIES_TABLE).create(fields);
      opportunityRecords.push(record);
      console.log(`  ✓ Created: "${opp.name}" (${record.id})`);
      console.log(`      Value: $${opp.value.toLocaleString()}, Stage: ${opp.stage}`);
      if (opp.stage !== opp.targetStage) {
        console.log(`      → Change Stage to "${opp.targetStage}" in Airtable`);
      }
    } catch (err: any) {
      console.log(`  ✗ Failed: "${opp.name}" - ${err.message}`);
    }
  }

  console.log(`\n  Created ${opportunityRecords.length} of ${opportunityData.length} opportunities.\n`);

  // =========================================================================
  // 3. Create Activities
  // =========================================================================
  console.log('Creating Activities...');

  const activityData = [
    // Website Redesign RFP activities (opp 0)
    { oppIndex: 0, type: 'email', direction: 'inbound', subject: 'RFP: Website Redesign Project', fromName: 'Sarah Chen', fromEmail: 'sarah.chen@sandbox-company.example.com', snippet: 'Hi, we are seeking proposals for our website redesign project. Please find the attached RFP document with detailed requirements.', daysAgo: 14 },
    { oppIndex: 0, type: 'email', direction: 'outbound', subject: 'Re: RFP: Website Redesign Project', fromName: 'Chris Lloyd', fromEmail: 'chris@hive.com', snippet: 'Thank you for considering us for your website redesign. We have reviewed the RFP and are excited to submit our proposal.', daysAgo: 12 },
    { oppIndex: 0, type: 'email', direction: 'inbound', subject: 'Re: RFP: Website Redesign Project', fromName: 'Sarah Chen', fromEmail: 'sarah.chen@sandbox-company.example.com', snippet: 'We received your proposal and would like to schedule a presentation with our team. Are you available next week?', daysAgo: 7 },

    // Brand Strategy Discovery activities (opp 1)
    { oppIndex: 1, type: 'email', direction: 'inbound', subject: 'Interested in Brand Strategy Services', fromName: 'Michael Torres', fromEmail: 'michael.torres@sandbox-company.example.com', snippet: 'I found your website through a colleague recommendation. We are looking for help with our brand strategy and would like to learn more.', daysAgo: 5 },
    { oppIndex: 1, type: 'email', direction: 'outbound', subject: 'Re: Interested in Brand Strategy Services', fromName: 'Chris Lloyd', fromEmail: 'chris@hive.com', snippet: 'Great to hear from you! I would love to schedule a discovery call to understand your brand challenges and goals.', daysAgo: 4 },

    // Q1 Campaign Negotiation activities (opp 2)
    { oppIndex: 2, type: 'email', direction: 'inbound', subject: 'Q1 Campaign Planning', fromName: 'Jennifer Wu', fromEmail: 'jennifer.wu@sandbox-company.example.com', snippet: 'We need help planning our Q1 marketing campaign. Can you put together a proposal for us?', daysAgo: 21 },
    { oppIndex: 2, type: 'email', direction: 'outbound', subject: 'SOW: Q1 Campaign - Sandbox Company', fromName: 'Chris Lloyd', fromEmail: 'chris@hive.com', snippet: 'Please find attached the Statement of Work for your Q1 campaign. Let me know if you have any questions.', daysAgo: 14 },
    { oppIndex: 2, type: 'email', direction: 'outbound', subject: 'Following up: Q1 Campaign SOW', fromName: 'Chris Lloyd', fromEmail: 'chris@hive.com', snippet: 'Just following up on the SOW I sent last week. Please let me know if you need any clarifications.', daysAgo: 7 },

    // SEO Engagement Won activities (opp 3)
    { oppIndex: 3, type: 'email', direction: 'inbound', subject: 'SEO Services Inquiry', fromName: 'David Kim', fromEmail: 'david.kim@sandbox-company.example.com', snippet: 'Our mutual contact John recommended your SEO services. We would like to discuss improving our search rankings.', daysAgo: 30 },
    { oppIndex: 3, type: 'email', direction: 'inbound', subject: 'Re: SEO Proposal - We want to proceed!', fromName: 'David Kim', fromEmail: 'david.kim@sandbox-company.example.com', snippet: 'Great news - we have approved the budget and would like to move forward with the SEO engagement. Lets set up a kickoff call.', daysAgo: 3 },
  ];

  let activitiesCreated = 0;
  let activitiesLinkedToOpp = 0;

  for (const act of activityData) {
    const oppRecord = opportunityRecords[act.oppIndex];

    const fields: Record<string, unknown> = {
      'Title': act.subject,
      'Type': act.type,
      'Direction': act.direction,
      'Subject': act.subject,
      'From Name': act.fromName,
      'From Email': act.fromEmail,
      'Snippet': act.snippet,
      'Received At': daysAgo(act.daysAgo),
      'Source': 'gmail-addon',
      'Company': [companyId],
    };

    if (oppRecord) {
      fields['Opportunities'] = [oppRecord.id];
    }

    try {
      await base(ACTIVITIES_TABLE).create(fields);
      activitiesCreated++;
      if (oppRecord) activitiesLinkedToOpp++;
      console.log(`  ✓ Created: "${act.subject.slice(0, 40)}..." → Opp ${act.oppIndex + 1}`);
    } catch (err: any) {
      if (oppRecord && err.message.includes('Opportunities')) {
        console.log(`  ⚠️  Opportunities link failed, trying without...`);
        delete fields['Opportunities'];
        try {
          await base(ACTIVITIES_TABLE).create(fields);
          activitiesCreated++;
          console.log(`  ✓ Created (no opp link): "${act.subject.slice(0, 40)}..."`);
        } catch (err2: any) {
          console.log(`  ✗ Failed: ${err2.message}`);
        }
      } else {
        console.log(`  ✗ Failed: "${act.subject.slice(0, 30)}..." - ${err.message}`);
      }
    }
  }

  console.log(`\n  Created ${activitiesCreated} of ${activityData.length} activities.`);
  console.log(`  ${activitiesLinkedToOpp} linked to opportunities.\n`);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('========================================');
  console.log('✅ Sandbox Data Seeding Complete!');
  console.log('========================================\n');
  console.log('Created:');
  console.log(`  - 1 Company: "Sandbox Company" (${companyId})`);
  console.log(`  - ${opportunityRecords.length} Opportunities`);
  console.log(`  - ${activitiesCreated} Activities (${activitiesLinkedToOpp} linked to opportunities)`);

  if (opportunityRecords.length > 0) {
    console.log('\n📋 Manual Steps Required in Airtable:');
    console.log('   Update Stage values for these opportunities:');
    opportunityData.forEach((opp, i) => {
      if (opp.stage !== opp.targetStage && opportunityRecords[i]) {
        console.log(`   - "${opp.name}" → Stage: "${opp.targetStage}"`);
      }
    });
  }

  console.log('\nValidation checklist:');
  console.log('  [ ] Opportunities show in pipeline board');
  console.log('  [ ] Activity counts display on opportunity cards');
  console.log('  [ ] Activity timeline populates in Opportunity workspace');
  console.log('  [ ] Deal values show correctly ($125k, $45k, $78k, $36k)');

  console.log('\nTo clean up later, search for "Sandbox" in your Airtable base.');
}

main().catch((err) => {
  console.error('❌ Error seeding data:', err);
  process.exit(1);
});
