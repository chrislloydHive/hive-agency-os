// scripts/seedFirmBrain.ts
// One-time seed script to populate Firm Brain profile for Hive Agency
// Run with: npx tsx scripts/seedFirmBrain.ts

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { upsertAgencyProfile } from '../lib/airtable/firmBrain';
import type { AgencyProfileInput } from '../lib/types/firmBrain';

const hiveAgencyProfile: AgencyProfileInput = {
  name: 'Hive Agency',

  oneLiner: 'An AI-native marketing operating system and growth consultancy that turns strategy into execution—fast.',

  overviewLong: `Hive is an AI-native marketing consultancy and operating system built to help modern businesses move from insight to execution with speed, clarity, and confidence.

We combine strategic rigor, deep diagnostics, and AI-powered workflows to transform fragmented marketing efforts into focused, outcome-driven programs. Hive doesn't just produce plans or assets—we build connected systems where strategy, execution, and learning continuously reinforce each other.

Our platform-driven approach enables faster decision-making, higher quality outputs, and measurable impact across branding, content, media, SEO, and growth initiatives.`,

  differentiators: [
    'AI-native operating system, not just an agency',
    'Strategy → Plan → Work fully connected in one system',
    'Diagnostics-first approach (labs before ideas)',
    'Faster execution without sacrificing quality',
    'Built-in learning loops and performance feedback',
    'Human-confirmed strategy with AI acceleration',
    'Clear ownership from insight to implementation',
  ],

  services: [
    'Growth & Marketing Strategy',
    'Brand Positioning & Messaging',
    'Content Strategy & Production',
    'Media Planning & Activation',
    'SEO & Organic Growth',
    'Conversion Optimization',
    'AI-Assisted Marketing Operations',
    'RFP & Proposal Strategy Support',
  ],

  industries: [
    'B2B SaaS',
    'Marketplaces',
    'Professional Services',
    'Technology Startups',
    'Multi-location & Platform Businesses',
  ],

  approachSummary: `Hive starts with truth, not tactics.

We begin by diagnosing what's actually happening—across audience, brand, channels, and performance—to inform strategy decisions before anything is built. Once strategy is locked, we translate it into clear plans, actionable work, and measurable outcomes.

Every deliverable, plan, and task is connected back to confirmed decisions so execution stays aligned and intentional.`,

  collaborationModel: `Hive works as an embedded strategic partner.

We collaborate closely with internal teams, providing clarity on what to do, why it matters, and how to execute it. Our system creates transparency across decisions, progress, and outcomes—so stakeholders always know what's happening and what's next.

We combine async collaboration, structured reviews, and focused working sessions to move quickly without chaos.`,

  aiStyleGuide: `Clear. Direct. Strategic. Grounded in reality.

Hive AI outputs should:
- Prioritize clarity over cleverness
- Be concise, structured, and actionable
- Avoid buzzwords and vague claims
- Explain why recommendations matter
- Reflect a confident, expert tone
- Assume an informed, business-savvy audience

AI should augment human judgment—not replace it—and always respect confirmed strategy and human-approved inputs.`,

  defaultAssumptions: [],
};

async function main() {
  console.log('Seeding Firm Brain profile for Hive Agency...');
  console.log('');

  try {
    const profile = await upsertAgencyProfile(hiveAgencyProfile);
    console.log('✓ Profile saved successfully');
    console.log('  ID:', profile.id);
    console.log('  Name:', profile.name);
    console.log('  Services:', profile.services.length, 'items');
    console.log('  Industries:', profile.industries.length, 'items');
    console.log('  Differentiators:', profile.differentiators.length, 'items');
  } catch (error: any) {
    if (error?.error === 'NOT_AUTHORIZED' || error?.statusCode === 403) {
      console.error('✗ Airtable authorization error.');
      console.error('');
      console.error('The "AgencyProfile" table may not exist or your API token lacks access.');
      console.error('');
      console.error('To fix this:');
      console.error('1. Create the "AgencyProfile" table in your Airtable base with fields:');
      console.error('   - name, oneLiner, overviewLong, differentiators, services,');
      console.error('   - industries, approachSummary, collaborationModel, aiStyleGuide,');
      console.error('   - defaultAssumptions, createdAt, updatedAt');
      console.error('2. Ensure your API token has access to this table');
      console.error('3. Re-run this script');
    } else {
      console.error('✗ Failed to seed profile:', error);
    }
    process.exit(1);
  }
}

main();
