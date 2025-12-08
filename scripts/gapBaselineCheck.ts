#!/usr/bin/env npx tsx
// scripts/gapBaselineCheck.ts
// Dev-only helper: run the GAP baseline pipeline for a URL and print social/digital footprint summary for sanity checks.
//
// Usage:
//   npx tsx scripts/gapBaselineCheck.ts https://atlasskateboarding.com
//   npm run gap:check https://atlasskateboarding.com
//
// This script runs the same detection + analysis pipeline as baseline_context_build,
// without requiring a company record in Airtable.

import { config } from 'dotenv';
// Load environment variables
config({ path: '.env' });
config({ path: '.env.local' });

import {
  generateGapIaAnalysisCore,
  fetchHtmlBounded,
  extractHtmlSignals,
  discoverMultiPageContent,
  type GapIaCoreInput,
} from '@/lib/gap/core';
import {
  collectDigitalFootprint,
} from '@/lib/digital-footprint/collectDigitalFootprint';
import {
  detectSocialAndGbp,
  type SocialFootprintSnapshot,
  extractJsonLdSchemas,
} from '@/lib/gap/socialDetection';

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error(`
Usage: npx tsx scripts/gapBaselineCheck.ts <url>

Examples:
  npx tsx scripts/gapBaselineCheck.ts https://atlasskateboarding.com
  npx tsx scripts/gapBaselineCheck.ts https://example.com

This tool runs the GAP baseline pipeline and prints a summary of:
  - Social footprint detection (GBP, Instagram, YouTube, etc.)
  - Digital footprint subscores
  - Quick wins and opportunities mentioning GBP/Instagram
`);
    process.exit(1);
  }

  // Normalize URL
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Extract domain
  let domain: string;
  try {
    const urlObj = new URL(normalizedUrl);
    domain = urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    console.error(`Invalid URL: ${url}`);
    process.exit(1);
  }

  console.log('\n=== GAP Baseline Check ===');
  console.log(`URL: ${normalizedUrl}`);
  console.log(`Domain: ${domain}`);
  console.log('Source: baseline_context_build (dev CLI)\n');

  const startTime = Date.now();

  try {
    // 1. Fetch HTML
    console.log('[1/5] Fetching HTML...');
    const html = await fetchHtmlBounded(normalizedUrl, 50000);
    console.log(`      Fetched ${html.length} characters`);

    // 2. Extract signals
    console.log('[2/5] Extracting HTML signals...');
    const signals = extractHtmlSignals(html);

    // 3. Collect digital footprint, social footprint, multi-page (parallel)
    console.log('[3/5] Running detection (digital footprint, social, multi-page)...');
    const [digitalFootprint, socialFootprint, multiPageSnapshot] = await Promise.all([
      collectDigitalFootprintSafe(domain, html),
      detectSocialAndGbpSafe(html),
      discoverMultiPageContentSafe(normalizedUrl, html),
    ]);

    // 4. Run GAP-IA core
    console.log('[4/5] Running GAP-IA analysis...');
    const coreInput: GapIaCoreInput = {
      url: normalizedUrl,
      domain,
      html,
      signals,
      digitalFootprint,
      multiPageSnapshot,
      socialFootprint: socialFootprint ?? undefined,
    };

    const gapResult = await generateGapIaAnalysisCore(coreInput);

    // 5. Print results
    console.log('[5/5] Analysis complete!\n');

    const durationMs = Date.now() - startTime;

    printResults({
      url: normalizedUrl,
      domain,
      socialFootprint,
      digitalFootprint: gapResult.dimensions?.digitalFootprint,
      quickWins: gapResult.quickWins?.bullets || [],
      topOpportunities: gapResult.summary?.topOpportunities || [],
      overallScore: gapResult.summary?.overallScore || gapResult.core?.overallScore || 0,
      maturityStage: gapResult.core?.marketingMaturity || 'Unknown',
      durationMs,
    });

  } catch (error) {
    console.error('\n[ERROR] Pipeline failed:');
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function collectDigitalFootprintSafe(domain: string, html?: string) {
  try {
    return await collectDigitalFootprint(domain, html);
  } catch (e) {
    console.warn('      [WARN] Digital footprint collection failed:', e instanceof Error ? e.message : String(e));
    return {
      gbp: { found: false, hasReviews: false, reviewCountBucket: 'unknown' as const, ratingBucket: 'unknown' as const },
      linkedin: { found: false, followerBucket: 'unknown' as const, postingCadence: 'unknown' as const },
      otherSocials: { instagram: false, facebook: false, youtube: false },
      brandedSearch: { ownDomainDominates: false, confusingNameCollisions: false },
    };
  }
}

async function detectSocialAndGbpSafe(html: string): Promise<SocialFootprintSnapshot | null> {
  try {
    const schemas = extractJsonLdSchemas(html);
    return detectSocialAndGbp({ html, schemas });
  } catch (e) {
    console.warn('      [WARN] Social detection failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function discoverMultiPageContentSafe(url: string, html: string) {
  try {
    return await discoverMultiPageContent(url, html);
  } catch (e) {
    console.warn('      [WARN] Multi-page discovery failed:', e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

interface PrintResultsInput {
  url: string;
  domain: string;
  socialFootprint: SocialFootprintSnapshot | null;
  digitalFootprint: {
    score?: number;
    oneLiner?: string;
    subscores?: {
      googleBusinessProfile?: number;
      socialPresence?: number;
      linkedinPresence?: number;
      reviewsReputation?: number;
    };
  } | null | undefined;
  quickWins: Array<{ action?: string } | string>;
  topOpportunities: string[];
  overallScore: number;
  maturityStage: string;
  durationMs: number;
}

function printResults(input: PrintResultsInput) {
  const { socialFootprint, digitalFootprint, quickWins, topOpportunities, overallScore, maturityStage, durationMs } = input;

  // Print header
  console.log('─'.repeat(60));
  console.log(`Overall Score: ${overallScore} | Maturity: ${maturityStage} | Time: ${(durationMs / 1000).toFixed(1)}s`);
  console.log('─'.repeat(60));

  // Social Footprint
  console.log('\n[SocialFootprint]');
  if (socialFootprint) {
    // GBP
    const gbp = socialFootprint.gbp;
    if (gbp) {
      const gbpUrl = gbp.url ? ` - ${gbp.url.substring(0, 50)}${gbp.url.length > 50 ? '...' : ''}` : '';
      console.log(`  GBP:        ${padStatus(gbp.status)} (${gbp.confidence.toFixed(2)})${gbpUrl}`);
    } else {
      console.log('  GBP:        not detected');
    }

    // Social networks
    const networks = ['instagram', 'youtube', 'facebook', 'linkedin', 'tiktok', 'x'] as const;
    for (const network of networks) {
      const social = socialFootprint.socials.find(s => s.network === network);
      if (social && (social.status === 'present' || social.status === 'probable')) {
        const socialUrl = social.url ? ` - ${social.url.substring(0, 40)}${social.url.length > 40 ? '...' : ''}` : '';
        console.log(`  ${padName(network)}:  ${padStatus(social.status)} (${social.confidence.toFixed(2)})${socialUrl}`);
      }
    }

    console.log(`  DataConfidence: ${socialFootprint.dataConfidence.toFixed(2)}`);
  } else {
    console.log('  (Social detection returned null)');
  }

  // Digital Footprint Scores
  console.log('\n[DigitalFootprint Scores]');
  if (digitalFootprint) {
    console.log(`  Overall:              ${digitalFootprint.score ?? 'N/A'}`);
    const subscores = digitalFootprint.subscores;
    if (subscores) {
      console.log(`  GBP Subscore:         ${subscores.googleBusinessProfile ?? 'N/A'}`);
      console.log(`  Social Presence:      ${subscores.socialPresence ?? 'N/A'}`);
      console.log(`  LinkedIn Presence:    ${subscores.linkedinPresence ?? 'N/A'}`);
      console.log(`  Reviews Reputation:   ${subscores.reviewsReputation ?? 'N/A'}`);
    } else {
      console.log('  (No subscores available)');
    }
  } else {
    console.log('  (Digital footprint dimension not available)');
  }

  // Digital Footprint Summary
  console.log('\n[DigitalFootprint Summary]');
  if (digitalFootprint?.oneLiner) {
    console.log(`  "${digitalFootprint.oneLiner}"`);
  } else {
    console.log('  (No oneLiner available)');
  }

  // Quick Wins mentioning GBP/Instagram
  const gbpIgQuickWins = quickWins
    .map(qw => typeof qw === 'string' ? qw : qw.action || '')
    .filter(action =>
      /google\s*business\s*profile|gbp|instagram/i.test(action)
    );

  console.log('\n[Quick Wins mentioning GBP/Instagram]');
  if (gbpIgQuickWins.length > 0) {
    for (const qw of gbpIgQuickWins) {
      console.log(`  - "${qw}"`);
    }
  } else {
    console.log('  (None)');
  }

  // Top Opportunities mentioning GBP/Instagram
  const gbpIgOpportunities = topOpportunities.filter(opp =>
    /google\s*business\s*profile|gbp|instagram/i.test(opp)
  );

  console.log('\n[Top Opportunities mentioning GBP/Instagram]');
  if (gbpIgOpportunities.length > 0) {
    for (const opp of gbpIgOpportunities) {
      console.log(`  - "${opp}"`);
    }
  } else {
    console.log('  (None)');
  }

  // All Quick Wins (for reference)
  console.log('\n[All Quick Wins]');
  const allQuickWins = quickWins.map(qw => typeof qw === 'string' ? qw : qw.action || '').filter(Boolean);
  if (allQuickWins.length > 0) {
    for (const qw of allQuickWins) {
      console.log(`  - ${qw}`);
    }
  } else {
    console.log('  (None)');
  }

  // All Top Opportunities (for reference)
  console.log('\n[All Top Opportunities]');
  if (topOpportunities.length > 0) {
    for (const opp of topOpportunities) {
      console.log(`  - ${opp}`);
    }
  } else {
    console.log('  (None)');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Done.');
}

function padStatus(status: string): string {
  return status.padEnd(12);
}

function padName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).padEnd(9);
}

// Run
main();
