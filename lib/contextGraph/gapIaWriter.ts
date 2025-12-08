// lib/contextGraph/gapIaWriter.ts
// Maps GAP-IA diagnostic run outputs to Context Graph fields
//
// This writer is used after GAP-IA diagnostic runs (via postRunHooks) to populate
// the Context Graph with structured data from the analysis.
//
// Rules:
// - All writes use source: "gap_ia"
// - Does NOT overwrite human/manual, qbr, strategy, setup_wizard, gap_heavy sources
// - Uses existing mergeField semantics via setFieldUntypedWithResult

import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import {
  setFieldUntypedWithResult,
  createProvenance,
  type ProvenanceSource,
} from '@/lib/contextGraph/mutate';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Result summary from the writer
 */
export interface GapIaWriteSummary {
  fieldsUpdated: number;
  fieldsSkipped: number;
  updatedPaths: string[];
  errors: string[];
}

/**
 * Social presence data from enhanced discovery
 */
interface SocialPresenceResult {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  gbpUrl?: string | null;
  instagramHandle?: string;
  linkedinHandle?: string;
  tiktokHandle?: string;
  socialConfidence?: number;
  gbpConfidence?: number;
  hasInstagram?: boolean;
  hasFacebook?: boolean;
  hasLinkedIn?: boolean;
  hasTikTok?: boolean;
  hasYouTube?: boolean;
  hasGBP?: boolean;
  summary?: string;
}

/**
 * GAP-IA diagnostic result structure (from runInitialAssessment)
 */
interface GapIaDiagnosticResult {
  initialAssessment?: {
    summary?: {
      overallScore?: number;
      maturityStage?: string;
      topOpportunities?: string[];
    };
    dimensions?: {
      brand?: { score?: number; oneLiner?: string; issues?: string[] };
      content?: { score?: number; oneLiner?: string; issues?: string[] };
      seo?: { score?: number; oneLiner?: string; issues?: string[] };
      website?: { score?: number; oneLiner?: string; issues?: string[] };
      digitalFootprint?: { score?: number; oneLiner?: string; issues?: string[] };
      authority?: { score?: number; oneLiner?: string; issues?: string[] };
    };
    quickWins?: {
      bullets?: Array<{ action?: string; rationale?: string } | string>;
    };
    breakdown?: {
      strengths?: string[];
      gaps?: string[];
    };
    // Legacy fields from V2 format
    core?: {
      overallScore?: number;
      marketingMaturity?: string;
      topOpportunities?: string[];
    };
  };
  businessContext?: {
    businessType?: string;
  };
  dataConfidence?: {
    score?: number;
    level?: string;
  };
  metadata?: {
    url?: string;
    domain?: string;
    pagesAnalyzed?: number;
  };
  // Enhanced social presence data (V4)
  socialPresence?: SocialPresenceResult;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Write GAP-IA diagnostic results to the Context Graph
 *
 * @param companyId - Company to update
 * @param gapIaResult - Result from runInitialAssessment (diagnostic run rawJson)
 * @param runId - Diagnostic run ID for provenance
 */
export async function writeGapIaAndSave(
  companyId: string,
  gapIaResult: Record<string, unknown>,
  runId?: string
): Promise<{ summary: GapIaWriteSummary }> {
  console.log('[gapIaWriter] Starting write for company:', companyId);

  const result = gapIaResult as GapIaDiagnosticResult;
  const ia = result.initialAssessment;

  if (!ia) {
    console.warn('[gapIaWriter] No initialAssessment in result, skipping');
    return {
      summary: {
        fieldsUpdated: 0,
        fieldsSkipped: 0,
        updatedPaths: [],
        errors: ['No initialAssessment in GAP-IA result'],
      },
    };
  }

  // Load current context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    console.warn('[gapIaWriter] No context graph found for company:', companyId);
    return {
      summary: {
        fieldsUpdated: 0,
        fieldsSkipped: 0,
        updatedPaths: [],
        errors: ['No context graph found'],
      },
    };
  }

  const updatedPaths: string[] = [];
  const errors: string[] = [];
  let fieldsUpdated = 0;
  let fieldsSkipped = 0;

  // Get overall score from summary or core
  const overallScore =
    ia.summary?.overallScore ?? ia.core?.overallScore;

  // Create provenance for all writes
  const provenance = createProvenance('gap_ia' as ProvenanceSource, {
    confidence: 0.75,
    runId,
    notes: overallScore ? `GAP-IA diagnostic (score: ${overallScore})` : 'GAP-IA diagnostic',
  });

  // Helper to write a field and track results
  const writeField = (
    domain: string,
    field: string,
    value: unknown
  ): boolean => {
    if (value === null || value === undefined) return false;
    if (value === '' || (Array.isArray(value) && value.length === 0)) return false;

    try {
      const { graph: updatedGraph, result } = setFieldUntypedWithResult(
        graph!,
        domain,
        field,
        value,
        provenance
      );

      if (result.updated) {
        graph = updatedGraph;
        fieldsUpdated++;
        updatedPaths.push(`${domain}.${field}`);
        return true;
      } else {
        fieldsSkipped++;
        return false;
      }
    } catch (error) {
      errors.push(`Failed to write ${domain}.${field}: ${error}`);
      return false;
    }
  };

  // ========================================================================
  // Map SEO Dimension
  // ========================================================================
  const seo = ia.dimensions?.seo;
  if (seo) {
    writeField('seo', 'seoScore', seo.score);
    writeField('seo', 'seoSummary', seo.oneLiner);

    if (seo.issues && seo.issues.length > 0) {
      const technicalIssues = seo.issues.map((issue, idx) => ({
        title: `SEO Issue ${idx + 1}`,
        description: issue,
        severity: 'medium' as const,
        category: 'general',
      }));
      writeField('seo', 'technicalIssues', technicalIssues);
    }
  }

  // ========================================================================
  // Map Content Dimension
  // ========================================================================
  const content = ia.dimensions?.content;
  if (content) {
    writeField('content', 'contentScore', content.score);
    writeField('content', 'contentSummary', content.oneLiner);

    if (content.issues && content.issues.length > 0) {
      const contentGaps = content.issues.map((issue) => ({
        topic: issue,
        priority: 'medium' as const,
      }));
      writeField('content', 'contentGaps', contentGaps);
    }
  }

  // ========================================================================
  // Map Website Dimension
  // ========================================================================
  const website = ia.dimensions?.website;
  if (website) {
    writeField('website', 'websiteSummary', website.oneLiner);
    writeField('website', 'websiteScore', website.score);

    if (website.issues && website.issues.length > 0) {
      writeField('website', 'criticalIssues', website.issues);
    }
  }

  // Map quick wins
  if (ia.quickWins?.bullets && ia.quickWins.bullets.length > 0) {
    const quickWinsList = ia.quickWins.bullets.map((qw) => {
      if (typeof qw === 'string') return qw;
      return qw.action || '';
    }).filter(Boolean);
    writeField('website', 'quickWins', quickWinsList);
  }

  // ========================================================================
  // Map Brand Dimension
  // ========================================================================
  const brand = ia.dimensions?.brand;
  if (brand) {
    writeField('brand', 'positioning', brand.oneLiner);
    writeField('brand', 'brandScore', brand.score);

    if (brand.issues && brand.issues.length > 0) {
      writeField('brand', 'brandWeaknesses', brand.issues);
    }
  }

  // ========================================================================
  // Map Digital Footprint → DigitalInfra
  // ========================================================================
  const digitalFootprint = ia.dimensions?.digitalFootprint;
  if (digitalFootprint) {
    writeField('digitalInfra', 'dataQuality', digitalFootprint.oneLiner);
    writeField('digitalInfra', 'digitalFootprintScore', digitalFootprint.score);

    if (digitalFootprint.issues && digitalFootprint.issues.length > 0) {
      writeField('digitalInfra', 'digitalFootprintIssues', digitalFootprint.issues);
    }
  }

  // ========================================================================
  // Map Authority Dimension
  // ========================================================================
  const authority = ia.dimensions?.authority;
  if (authority) {
    writeField('seo', 'authorityScore', authority.score);
    writeField('seo', 'authoritySummary', authority.oneLiner);
  }

  // ========================================================================
  // Map Top-Level Insights
  // ========================================================================
  const topOpportunities =
    ia.summary?.topOpportunities ?? ia.core?.topOpportunities;
  if (topOpportunities && topOpportunities.length > 0) {
    writeField('strategy', 'topOpportunities', topOpportunities);
  }

  const maturityStage =
    ia.summary?.maturityStage ?? ia.core?.marketingMaturity;
  if (maturityStage) {
    writeField('strategy', 'maturityStage', maturityStage);
  }

  if (overallScore !== undefined) {
    writeField('strategy', 'overallScore', overallScore);
  }

  // Map strengths and gaps
  if (ia.breakdown?.strengths && ia.breakdown.strengths.length > 0) {
    writeField('strategy', 'keyStrengths', ia.breakdown.strengths);
  }
  if (ia.breakdown?.gaps && ia.breakdown.gaps.length > 0) {
    writeField('strategy', 'keyGaps', ia.breakdown.gaps);
  }

  // ========================================================================
  // Map Social Presence (V4 Enhanced Detection)
  // ========================================================================
  const social = result.socialPresence;
  if (social) {
    console.log('[gapIaWriter] Writing social presence data:', {
      hasInstagram: social.hasInstagram,
      hasGBP: social.hasGBP,
      socialConfidence: social.socialConfidence,
      gbpConfidence: social.gbpConfidence,
    });

    // Instagram
    if (social.instagramUrl) {
      writeField('social', 'instagramUrl', social.instagramUrl);
    }
    if (social.instagramHandle) {
      writeField('social', 'instagramHandle', social.instagramHandle);
    }
    if (social.hasInstagram !== undefined) {
      writeField('social', 'hasInstagram', social.hasInstagram);
    }

    // Facebook
    if (social.facebookUrl) {
      writeField('social', 'facebookUrl', social.facebookUrl);
    }
    if (social.hasFacebook !== undefined) {
      writeField('social', 'hasFacebook', social.hasFacebook);
    }

    // TikTok
    if (social.tiktokUrl) {
      writeField('social', 'tiktokUrl', social.tiktokUrl);
    }
    if (social.tiktokHandle) {
      writeField('social', 'tiktokHandle', social.tiktokHandle);
    }
    if (social.hasTikTok !== undefined) {
      writeField('social', 'hasTikTok', social.hasTikTok);
    }

    // X (Twitter)
    if (social.xUrl) {
      writeField('social', 'xUrl', social.xUrl);
    }

    // LinkedIn
    if (social.linkedinUrl) {
      writeField('social', 'linkedinUrl', social.linkedinUrl);
    }
    if (social.linkedinHandle) {
      writeField('social', 'linkedinHandle', social.linkedinHandle);
    }
    if (social.hasLinkedIn !== undefined) {
      writeField('social', 'hasLinkedIn', social.hasLinkedIn);
    }

    // YouTube
    if (social.youtubeUrl) {
      writeField('social', 'youtubeUrl', social.youtubeUrl);
    }
    if (social.hasYouTube !== undefined) {
      writeField('social', 'hasYouTube', social.hasYouTube);
    }

    // Google Business Profile
    if (social.gbpUrl) {
      writeField('social', 'gbpUrl', social.gbpUrl);
    }
    if (social.hasGBP !== undefined) {
      writeField('social', 'hasGBP', social.hasGBP);
    }

    // Confidence scores
    if (social.socialConfidence !== undefined) {
      writeField('social', 'socialConfidence', social.socialConfidence);
    }
    if (social.gbpConfidence !== undefined) {
      writeField('social', 'gbpConfidence', social.gbpConfidence);
    }

    // Summary
    if (social.summary) {
      writeField('social', 'socialSummary', social.summary);
    }

    // Discovery metadata
    writeField('social', 'lastDiscoveryAt', new Date().toISOString());
    writeField('social', 'discoverySource', 'gap_ia');
  }

  // ========================================================================
  // Map Social Footprint (V5 Enhanced Detection with Detection Sources)
  // ========================================================================
  const socialFootprint = (result as any).socialFootprint;
  if (socialFootprint) {
    console.log('[gapIaWriter] Writing V5 social footprint data:', {
      socialsCount: socialFootprint.socials?.length,
      gbpStatus: socialFootprint.gbp?.status,
      dataConfidence: socialFootprint.dataConfidence,
    });

    // Map socials array to individual fields
    const socials = socialFootprint.socials || [];

    for (const socialItem of socials) {
      const network = socialItem.network;
      const isPresent = socialItem.status === 'present' || socialItem.status === 'probable';

      switch (network) {
        case 'instagram':
          if (socialItem.url) writeField('social', 'instagramUrl', socialItem.url);
          if (socialItem.handle) writeField('social', 'instagramHandle', socialItem.handle);
          writeField('social', 'hasInstagram', isPresent);
          break;
        case 'facebook':
          if (socialItem.url) writeField('social', 'facebookUrl', socialItem.url);
          writeField('social', 'hasFacebook', isPresent);
          break;
        case 'tiktok':
          if (socialItem.url) writeField('social', 'tiktokUrl', socialItem.url);
          if (socialItem.handle) writeField('social', 'tiktokHandle', socialItem.handle);
          writeField('social', 'hasTikTok', isPresent);
          break;
        case 'x':
          if (socialItem.url) writeField('social', 'xUrl', socialItem.url);
          break;
        case 'linkedin':
          if (socialItem.url) writeField('social', 'linkedinUrl', socialItem.url);
          if (socialItem.handle) writeField('social', 'linkedinHandle', socialItem.handle);
          writeField('social', 'hasLinkedIn', isPresent);
          break;
        case 'youtube':
          if (socialItem.url) writeField('social', 'youtubeUrl', socialItem.url);
          writeField('social', 'hasYouTube', isPresent);
          break;
      }
    }

    // Map GBP
    const gbp = socialFootprint.gbp;
    if (gbp) {
      const gbpPresent = gbp.status === 'present' || gbp.status === 'probable';
      if (gbp.url) writeField('social', 'gbpUrl', gbp.url);
      writeField('social', 'hasGBP', gbpPresent);
      writeField('social', 'gbpConfidence', Math.round(gbp.confidence * 100));
    }

    // Calculate average social confidence from detected socials
    const detectedSocials = socials.filter((s: any) =>
      s.status === 'present' || s.status === 'probable'
    );
    if (detectedSocials.length > 0) {
      const avgConfidence = detectedSocials.reduce((sum: number, s: any) => sum + s.confidence, 0) / detectedSocials.length;
      writeField('social', 'socialConfidence', Math.round(avgConfidence * 100));
    }

    // Build summary from V5 data
    const summaryParts: string[] = [];
    for (const s of socials) {
      if (s.status === 'present' || s.status === 'probable') {
        summaryParts.push(`${s.network}: ${s.handle || 'detected'} (${Math.round(s.confidence * 100)}%)`);
      }
    }
    if (gbp && (gbp.status === 'present' || gbp.status === 'probable')) {
      summaryParts.push(`GBP: detected (${Math.round(gbp.confidence * 100)}%)`);
    }
    if (summaryParts.length > 0) {
      writeField('social', 'socialSummary', summaryParts.join('; '));
    }

    // Discovery metadata
    writeField('social', 'lastDiscoveryAt', new Date().toISOString());
    writeField('social', 'discoverySource', 'gap_ia_v5');
  }

  // ========================================================================
  // Save Updated Graph
  // ========================================================================
  if (fieldsUpdated > 0) {
    await saveContextGraph(graph, 'gap_ia_diagnostic');
    console.log('[gapIaWriter] Saved context graph with', fieldsUpdated, 'fields written');
  }

  console.log('[gapIaWriter] Complete:', {
    fieldsUpdated,
    fieldsSkipped,
    paths: updatedPaths,
    errors: errors.length,
  });

  return {
    summary: {
      fieldsUpdated,
      fieldsSkipped,
      updatedPaths,
      errors,
    },
  };
}
