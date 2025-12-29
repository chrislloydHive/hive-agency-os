#!/usr/bin/env npx tsx
/**
 * Seed Reviver, Portage Bank, and MOE Website case studies
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createCaseStudy, getCaseStudies } from '../lib/airtable/firmBrain';

interface CaseStudyData {
  title: string;
  client: string;
  industry: string;
  permissionLevel: 'internal' | 'public';
  visibility: 'internal' | 'public';
  services: string[];
  tags: string[];
  summary: string;
  problem: string;
  approach: string;
  outcome: string;
  caseStudyUrl: string;
}

const CASE_STUDIES: CaseStudyData[] = [
  // Reviver - Internal
  {
    title: 'Building a Modern Brand System for Reviver',
    client: 'Reviver',
    industry: 'Automotive Technology',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Brand Strategy', 'Visual Identity', 'Brand Guidelines'],
    tags: ['branding', 'technology', 'brand-identity'],
    summary: "Hive partnered with Reviver to develop a modern brand system that reflected innovation and supported the company's growing presence in the automotive technology space.",
    problem: 'Reviver needed a brand identity that clearly communicated its innovative technology while remaining flexible enough to scale across products and audiences.',
    approach: 'Hive clarified brand positioning and translated it into a cohesive visual system, creating guidelines that ensured consistency across marketing, product, and communications.',
    outcome: "The new brand system strengthened Reviver's visual presence and provided a scalable foundation to support continued growth and market expansion.",
    caseStudyUrl: 'https://www.hiveadagency.com/reviver',
  },
  // Reviver - Public
  {
    title: 'Modern Brand Identity for Reviver',
    client: 'Reviver',
    industry: 'Automotive Technology',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Branding', 'Visual Identity'],
    tags: ['branding', 'technology'],
    summary: 'Hive created a modern, flexible brand identity for Reviver that supports innovation and growth.',
    problem: 'Reviver needed a clearer brand presence to communicate its technology-driven mission.',
    approach: 'We developed a cohesive brand system designed to scale across platforms and touchpoints.',
    outcome: 'The refreshed identity provided clarity, consistency, and a strong foundation for future growth.',
    caseStudyUrl: 'https://www.hiveadagency.com/reviver',
  },
  // Portage Bank - Internal
  {
    title: 'Refreshing a Community-Focused Brand for Portage Bank',
    client: 'Portage Bank',
    industry: 'Financial Services',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Brand Strategy', 'Visual Identity', 'Messaging'],
    tags: ['branding', 'professional-services', 'trust-building'],
    summary: 'Hive worked with Portage Bank to refresh its brand in a way that honored its community roots while presenting a more modern, confident presence.',
    problem: 'Portage Bank needed to evolve its brand to better reflect its values and appeal to both existing and prospective customers.',
    approach: 'Hive refined brand positioning and updated the visual and messaging system to balance trust, approachability, and professionalism.',
    outcome: "The refreshed brand strengthened Portage Bank's identity and helped communicate its role as a trusted, community-centered financial institution.",
    caseStudyUrl: 'https://www.hiveadagency.com/portagebank',
  },
  // Portage Bank - Public
  {
    title: 'Community-Driven Brand Refresh for Portage Bank',
    client: 'Portage Bank',
    industry: 'Financial Services',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Branding', 'Messaging'],
    tags: ['professional-services', 'branding'],
    summary: "Hive refreshed Portage Bank's brand to reflect its community values and modernize its presence.",
    problem: 'Portage Bank wanted a clearer, more contemporary brand identity.',
    approach: 'We refined positioning and updated visual and messaging elements.',
    outcome: 'The result was a more confident, cohesive brand presence rooted in trust.',
    caseStudyUrl: 'https://www.hiveadagency.com/portagebank',
  },
  // MOE Website - Internal
  {
    title: "Designing a Website Experience to Support MOE's Brand",
    client: 'MOE',
    industry: 'Consumer / Lifestyle',
    permissionLevel: 'internal',
    visibility: 'internal',
    services: ['Brand Strategy', 'Content Development', 'Creative Production'],
    tags: ['brand', 'content', 'consumer'],
    summary: 'Hive designed and built a website experience for MOE that aligned closely with the brand and supported clear, intuitive user journeys.',
    problem: 'MOE needed a website that reflected its brand values while making it easier for users to engage and explore.',
    approach: "Hive aligned UX strategy, content structure, and visual design to create a cohesive site experience rooted in MOE's brand platform.",
    outcome: 'The new website delivered a clearer, more engaging experience that reinforced brand consistency and usability across devices.',
    caseStudyUrl: 'https://www.hiveadagency.com/moe-website',
  },
  // MOE Website - Public
  {
    title: 'Website Design and UX for MOE',
    client: 'MOE',
    industry: 'Consumer / Lifestyle',
    permissionLevel: 'public',
    visibility: 'public',
    services: ['Content Development', 'Creative Production'],
    tags: ['brand', 'content'],
    summary: 'Hive designed a website for MOE that reflects the brand and supports intuitive user experiences.',
    problem: 'MOE needed a site that aligned brand expression with usability.',
    approach: "We designed a cohesive website experience grounded in MOE's brand system.",
    outcome: 'The site provides a clear, consistent, and engaging experience.',
    caseStudyUrl: 'https://www.hiveadagency.com/moe-website',
  },
];

async function seedCaseStudies() {
  console.log('[INFO] Checking for existing case studies...');
  const existing = await getCaseStudies();

  for (const cs of CASE_STUDIES) {
    const exists = existing.some(
      (e) =>
        e.client.toLowerCase() === cs.client.toLowerCase() &&
        e.title.toLowerCase() === cs.title.toLowerCase() &&
        e.permissionLevel === cs.permissionLevel
    );

    if (exists) {
      console.log(`[SKIP] ${cs.title} (${cs.permissionLevel}) already exists`);
      continue;
    }

    console.log(`[INFO] Creating ${cs.title} (${cs.permissionLevel})...`);
    try {
      await createCaseStudy({
        ...cs,
        metrics: {},
        assets: [],
        visuals: [],
        clientLogo: null,
      });
      console.log(`[OK] Created ${cs.title}`);
    } catch (err) {
      console.error(`[ERROR] Failed to create ${cs.title}:`, err);
    }
  }

  console.log('[DONE] Case studies seeded');
}

seedCaseStudies().catch(console.error);
