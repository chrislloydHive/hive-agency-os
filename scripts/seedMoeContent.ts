#!/usr/bin/env npx tsx
/**
 * Seed MOE Content case studies
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createCaseStudy, getCaseStudies } from '../lib/airtable/firmBrain';

async function seedMoeContent() {
  console.log('[INFO] Checking for existing MOE Content case studies...');

  const existing = await getCaseStudies();
  const hasInternal = existing.some(cs =>
    cs.client.toLowerCase().includes('moe') &&
    cs.title.toLowerCase().includes('content') &&
    cs.permissionLevel === 'internal'
  );
  const hasPublic = existing.some(cs =>
    cs.client.toLowerCase().includes('moe') &&
    cs.title.toLowerCase().includes('content') &&
    cs.permissionLevel === 'public'
  );

  // Create internal version
  if (!hasInternal) {
    console.log('[INFO] Creating MOE Content (internal)...');
    await createCaseStudy({
      title: 'Creating Thoughtful Content to Build Connection for MOE',
      client: 'MOE',
      industry: 'Consumer / Lifestyle',
      permissionLevel: 'internal',
      visibility: 'internal',
      services: ['Content', 'Campaign', 'Video', 'Social Content'],
      tags: ['content', 'video', 'social', 'brand'],
      summary: "Hive partnered with MOE to create thoughtful, brand-led content designed to connect with audiences and reinforce the brand's point of view across channels.",
      problem: "MOE needed content that went beyond promotion and instead reflected the brand's values while building emotional connection with its audience.",
      approach: "Hive developed a content approach rooted in MOE's brand platform, producing a mix of video and supporting content designed to feel intentional, human, and consistent across touchpoints.",
      outcome: "The content strengthened MOE's brand expression and created a cohesive, recognizable presence that supported ongoing engagement and brand affinity.",
      caseStudyUrl: 'https://www.hiveadagency.com/moe-content',
      metrics: {},
      assets: [],
      visuals: [],
      clientLogo: null,
    });
    console.log('[OK] MOE Content (internal) created');
  } else {
    console.log('[SKIP] MOE Content (internal) already exists');
  }

  // Create public version
  if (!hasPublic) {
    console.log('[INFO] Creating MOE Content (public)...');
    await createCaseStudy({
      title: 'Thoughtful Brand Content for MOE',
      client: 'MOE',
      industry: 'Consumer / Lifestyle',
      permissionLevel: 'public',
      visibility: 'public',
      services: ['Content', 'Video', 'Social'],
      tags: ['content', 'brand', 'video'],
      summary: "Hive created thoughtful, brand-led content for MOE designed to connect with audiences and reinforce the brand's perspective.",
      problem: 'MOE wanted content that felt authentic and aligned with brand values.',
      approach: "We produced video and supporting content rooted in MOE's brand platform and designed for multi-channel use.",
      outcome: 'The work delivered a cohesive content presence that supported ongoing brand engagement.',
      caseStudyUrl: 'https://www.hiveadagency.com/moe-content',
      metrics: {},
      assets: [],
      visuals: [],
      clientLogo: null,
    });
    console.log('[OK] MOE Content (public) created');
  } else {
    console.log('[SKIP] MOE Content (public) already exists');
  }

  console.log('[DONE] MOE Content case studies seeded');
}

seedMoeContent().catch(console.error);
