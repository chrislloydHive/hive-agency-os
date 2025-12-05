// lib/contextGraph/icpExtractor.ts
// ICP Extractor Module
//
// Extracts canonical ICP (Ideal Customer Profile) from Website Lab and GAP results
// using AI analysis. The extracted ICP is written to the Context Graph and becomes
// the authoritative audience constraint for Audience Lab and other Labs.
//
// IMPORTANT: This extractor uses lower confidence (0.8) so human edits in Setup
// or Strategic Plan (confidence 0.95) will always take precedence.

import OpenAI from 'openai';
import { loadContextGraph, saveContextGraph } from './storage';
import { setFieldUntyped, createProvenance } from './mutate';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import type { HeavyGapRunState } from '@/lib/gap-heavy/state';
import type { CompanyContextGraph } from './companyContextGraph';
import type { CanonicalICPFields } from './icpMapping';
import { hasICPContent, buildICPSummary } from './icpMapping';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for ICP extraction
 */
export interface ICPExtractorInput {
  companyId: string;
  /** Force extraction even if ICP already exists (respects source priority) */
  force?: boolean;
}

/**
 * Result of ICP extraction
 */
export interface ICPExtractorResult {
  success: boolean;
  extracted: CanonicalICPFields;
  fieldsWritten: string[];
  fieldsSkipped: string[];
  error?: string;
  /** Sources used for extraction */
  sourcesUsed: string[];
}

/**
 * Raw extraction context from diagnostics
 */
interface ExtractionContext {
  companyName?: string;
  websiteData?: {
    heroText?: string;
    whoWeServe?: string;
    servicesDescription?: string;
    aboutUs?: string;
    targetAudienceHints?: string[];
  };
  gapData?: {
    audienceSection?: string;
    businessContext?: {
      targetAudience?: string;
      industry?: string;
      businessModel?: string;
    };
    strategistNotes?: string;
  };
}

// ============================================================================
// Context Loading
// ============================================================================

/**
 * Load extraction context from Website Lab and GAP results
 */
async function loadExtractionContext(companyId: string): Promise<ExtractionContext> {
  const context: ExtractionContext = {};

  try {
    // Load GAP Heavy runs (contains Website Lab data)
    const gapRuns = await getHeavyGapRunsByCompanyId(companyId);

    // Find the most recent completed run
    const completedRuns = gapRuns.filter((r: HeavyGapRunState) => r.status === 'completed');
    const latestRun = completedRuns.sort((a: HeavyGapRunState, b: HeavyGapRunState) =>
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    )[0];

    if (latestRun) {
      console.log('[ICPExtractor] Found latest completed GAP Heavy run:', latestRun.id);

      // Extract Website Lab data from evidence pack
      const evidencePack = latestRun.evidencePack;
      if (evidencePack?.websiteLabV4) {
        const websiteLab = evidencePack.websiteLabV4 as any; // Type is complex, use any
        context.websiteData = {
          heroText: websiteLab.heroSection?.headline,
          whoWeServe: websiteLab.audienceSignals?.whoWeServeText,
          servicesDescription: websiteLab.servicesSection?.overview,
          aboutUs: websiteLab.aboutSection?.summary,
          targetAudienceHints: websiteLab.audienceSignals?.targetAudienceHints,
        };
        console.log('[ICPExtractor] Extracted Website Lab data');
      }

      // Try to extract from brand lab if available
      if (evidencePack?.brandLab) {
        const brandLab = evidencePack.brandLab as any;
        // Brand lab might have audience insights
        if (brandLab.audienceInsights) {
          context.gapData = {
            audienceSection: brandLab.audienceInsights,
            businessContext: {
              targetAudience: brandLab.targetAudience,
              industry: brandLab.industry,
              businessModel: brandLab.businessModel,
            },
          };
          console.log('[ICPExtractor] Extracted Brand Lab data');
        }
      }

      // Extract from domain if available
      context.companyName = latestRun.domain;
    }
  } catch (error) {
    console.error('[ICPExtractor] Error loading context:', error);
  }

  return context;
}

// ============================================================================
// AI Extraction
// ============================================================================

/**
 * Build the extraction prompt
 */
function buildExtractionPrompt(context: ExtractionContext): string {
  const sections: string[] = [];

  if (context.companyName) {
    sections.push(`Company: ${context.companyName}`);
  }

  if (context.websiteData) {
    const ws = context.websiteData;
    const websiteLines: string[] = [];

    if (ws.heroText) {
      websiteLines.push(`Hero Text: ${ws.heroText}`);
    }
    if (ws.whoWeServe) {
      websiteLines.push(`Who We Serve: ${ws.whoWeServe}`);
    }
    if (ws.servicesDescription) {
      websiteLines.push(`Services: ${ws.servicesDescription}`);
    }
    if (ws.aboutUs) {
      websiteLines.push(`About: ${ws.aboutUs}`);
    }
    if (ws.targetAudienceHints?.length) {
      websiteLines.push(`Audience Hints: ${ws.targetAudienceHints.join(', ')}`);
    }

    if (websiteLines.length > 0) {
      sections.push(`## Website Content\n${websiteLines.join('\n')}`);
    }
  }

  if (context.gapData) {
    const gd = context.gapData;
    const gapLines: string[] = [];

    if (gd.businessContext?.targetAudience) {
      gapLines.push(`Target Audience: ${gd.businessContext.targetAudience}`);
    }
    if (gd.businessContext?.industry) {
      gapLines.push(`Industry: ${gd.businessContext.industry}`);
    }
    if (gd.businessContext?.businessModel) {
      gapLines.push(`Business Model: ${gd.businessContext.businessModel}`);
    }
    if (gd.audienceSection) {
      gapLines.push(`Audience Analysis:\n${gd.audienceSection}`);
    }

    if (gapLines.length > 0) {
      sections.push(`## GAP Analysis\n${gapLines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Extract ICP using AI
 */
async function extractICPWithAI(context: ExtractionContext): Promise<CanonicalICPFields> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const contextText = buildExtractionPrompt(context);

  if (!contextText.trim()) {
    throw new Error('No context available for ICP extraction');
  }

  const systemPrompt = `You are an expert marketing strategist. Your task is to extract the Ideal Customer Profile (ICP) from the provided company data.

Analyze the website content and GAP analysis to determine:
1. Who is the primary target audience?
2. What roles/titles are the buyers or decision makers?
3. What type of companies do they serve (if B2B)?

Output your analysis as valid JSON with this structure:
{
  "icpDescription": "A comprehensive 2-3 sentence description of the ideal customer",
  "primaryAudience": "One clear sentence describing who they serve",
  "primaryBuyerRoles": ["Role 1", "Role 2"],
  "companyProfile": {
    "sizeRange": "SMB | Mid-Market | Enterprise | null if B2C",
    "stage": "Startup | Growth | Mature | null if unknown",
    "industries": ["Industry 1", "Industry 2"] or null if not specific
  }
}

Guidelines:
- Be specific and actionable, not generic
- For B2C businesses, focus on consumer demographics in primaryAudience
- For B2B businesses, include company characteristics in companyProfile
- primaryBuyerRoles should be job titles or roles that make purchasing decisions
- If something is unclear, omit it rather than guessing
- Use the exact data provided, don't invent details`;

  const userPrompt = `Extract the ICP from this company data:

${contextText}

Return only valid JSON.`;

  console.log('[ICPExtractor] Calling OpenAI for ICP extraction...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3, // Low temperature for consistent extraction
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in AI response');
  }

  const parsed = JSON.parse(content) as {
    icpDescription?: string;
    primaryAudience?: string;
    primaryBuyerRoles?: string[];
    companyProfile?: {
      sizeRange?: string;
      stage?: string;
      industries?: string[];
    };
  };

  // Transform to canonical format
  const icp: CanonicalICPFields = {};

  if (parsed.icpDescription?.trim()) {
    icp.icpDescription = parsed.icpDescription.trim();
  }
  if (parsed.primaryAudience?.trim()) {
    icp.primaryAudience = parsed.primaryAudience.trim();
  }
  if (parsed.primaryBuyerRoles?.length) {
    icp.primaryBuyerRoles = parsed.primaryBuyerRoles.filter(r => r?.trim());
  }
  if (parsed.companyProfile) {
    icp.companyProfile = {
      sizeRange: parsed.companyProfile.sizeRange?.trim() || null,
      stage: parsed.companyProfile.stage?.trim() || null,
      industries: parsed.companyProfile.industries?.filter(i => i?.trim()) || null,
    };
  }

  return icp;
}

// ============================================================================
// Context Graph Writing
// ============================================================================

/**
 * Write extracted ICP to Context Graph
 */
async function writeICPToGraph(
  graph: CompanyContextGraph,
  icp: CanonicalICPFields
): Promise<{ fieldsWritten: string[]; fieldsSkipped: string[] }> {
  const fieldsWritten: string[] = [];
  const fieldsSkipped: string[] = [];

  // Create provenance for ICP Extractor
  // Lower confidence (0.8) so human edits take precedence
  const provenance = createProvenance('inferred', {
    confidence: 0.8,
    notes: 'ICPExtractor - extracted from Website Lab + GAP',
    validForDays: 180, // 6 months
  });

  // Write icpDescription to identity domain
  if (icp.icpDescription) {
    setFieldUntyped(
      graph,
      'identity',
      'icpDescription',
      icp.icpDescription,
      provenance,
      { debug: true }
    );
    // setFieldUntyped returns the graph, but we track writes by checking provenance
    fieldsWritten.push('identity.icpDescription');
  }

  // Write primaryAudience to audience domain
  if (icp.primaryAudience) {
    setFieldUntyped(
      graph,
      'audience',
      'primaryAudience',
      icp.primaryAudience,
      provenance,
      { debug: true }
    );
    fieldsWritten.push('audience.primaryAudience');
  }

  // Write primaryBuyerRoles to audience domain
  if (icp.primaryBuyerRoles?.length) {
    setFieldUntyped(
      graph,
      'audience',
      'primaryBuyerRoles',
      icp.primaryBuyerRoles,
      provenance,
      { debug: true }
    );
    fieldsWritten.push('audience.primaryBuyerRoles');
  }

  // Write companyProfile to audience domain
  if (icp.companyProfile) {
    setFieldUntyped(
      graph,
      'audience',
      'companyProfile',
      icp.companyProfile,
      provenance,
      { debug: true }
    );
    fieldsWritten.push('audience.companyProfile');
  }

  return { fieldsWritten, fieldsSkipped };
}

// ============================================================================
// Main Extractor Function
// ============================================================================

/**
 * Extract ICP from Website Lab and GAP results
 *
 * This function:
 * 1. Loads the latest Website Lab and GAP results
 * 2. Uses AI to extract ICP fields
 * 3. Writes to Context Graph with appropriate provenance
 *
 * @param input - Extraction input
 * @returns Extraction result
 */
export async function extractICPFromDiagnostics(
  input: ICPExtractorInput
): Promise<ICPExtractorResult> {
  const { companyId } = input;

  console.log('[ICPExtractor] Starting extraction for company:', companyId);

  const result: ICPExtractorResult = {
    success: false,
    extracted: {},
    fieldsWritten: [],
    fieldsSkipped: [],
    sourcesUsed: [],
  };

  try {
    // Load Context Graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      result.error = 'No Context Graph found for company';
      return result;
    }

    // Load extraction context
    const context = await loadExtractionContext(companyId);

    // Track sources used
    if (context.websiteData) {
      result.sourcesUsed.push('Website Lab');
    }
    if (context.gapData) {
      result.sourcesUsed.push('GAP Analysis');
    }

    if (result.sourcesUsed.length === 0) {
      result.error = 'No Website Lab or GAP data available for extraction';
      return result;
    }

    // Extract ICP using AI
    const extractedICP = await extractICPWithAI(context);

    if (!hasICPContent(extractedICP)) {
      result.error = 'AI extraction returned no meaningful ICP data';
      return result;
    }

    result.extracted = extractedICP;

    // Write to Context Graph
    const writeResult = await writeICPToGraph(graph, extractedICP);
    result.fieldsWritten = writeResult.fieldsWritten;
    result.fieldsSkipped = writeResult.fieldsSkipped;

    // Save graph if any fields were written
    if (result.fieldsWritten.length > 0) {
      await saveContextGraph(graph, 'ICPExtractor');
      console.log('[ICPExtractor] Saved graph with', result.fieldsWritten.length, 'ICP fields');
    }

    result.success = true;

    console.log('[ICPExtractor] Extraction complete:', {
      fieldsWritten: result.fieldsWritten,
      fieldsSkipped: result.fieldsSkipped,
      sourcesUsed: result.sourcesUsed,
    });

    return result;
  } catch (error) {
    console.error('[ICPExtractor] Extraction failed:', error);
    result.error = error instanceof Error ? error.message : 'Extraction failed';
    return result;
  }
}

// ============================================================================
// ICP Loading (for Audience Lab)
// ============================================================================

/**
 * Load canonical ICP from Context Graph
 *
 * This is the function Audience Lab should use to check for ICP.
 */
export async function loadCanonicalICP(companyId: string): Promise<{
  hasCanonicalICP: boolean;
  icp: CanonicalICPFields;
  summary: string;
  sources: string[];
}> {
  const result = {
    hasCanonicalICP: false,
    icp: {} as CanonicalICPFields,
    summary: '',
    sources: [] as string[],
  };

  try {
    const graph = await loadContextGraph(companyId);
    console.log('[loadCanonicalICP] Graph loaded:', !!graph, 'companyId:', companyId);

    if (!graph) {
      console.log('[loadCanonicalICP] No graph found');
      return result;
    }

    // Debug: Log what audience fields exist
    console.log('[loadCanonicalICP] Audience domain fields:', {
      hasIdentityIcpDesc: !!graph.identity?.icpDescription?.value,
      hasPrimaryAudience: !!graph.audience?.primaryAudience?.value,
      hasPrimaryBuyerRoles: !!graph.audience?.primaryBuyerRoles?.value?.length,
      hasCompanyProfile: !!graph.audience?.companyProfile?.value,
      hasCoreSegments: !!graph.audience?.coreSegments?.value?.length,
      hasDemographics: !!graph.audience?.demographics?.value,
      hasGeos: !!graph.audience?.geos?.value,
      primaryAudienceValue: graph.audience?.primaryAudience?.value?.substring?.(0, 50),
      coreSegmentsValue: graph.audience?.coreSegments?.value,
    });

    // Extract ICP fields from graph
    const icp: CanonicalICPFields = {};

    // identity.icpDescription
    if (graph.identity?.icpDescription?.value) {
      icp.icpDescription = graph.identity.icpDescription.value;
      const source = graph.identity.icpDescription.provenance?.[0]?.source;
      if (source && !result.sources.includes(source)) {
        result.sources.push(source);
      }
    }

    // audience.primaryAudience
    if (graph.audience?.primaryAudience?.value) {
      icp.primaryAudience = graph.audience.primaryAudience.value;
      const source = graph.audience.primaryAudience.provenance?.[0]?.source;
      if (source && !result.sources.includes(source)) {
        result.sources.push(source);
      }
    }

    // audience.primaryBuyerRoles
    if (graph.audience?.primaryBuyerRoles?.value?.length) {
      icp.primaryBuyerRoles = graph.audience.primaryBuyerRoles.value;
      const source = graph.audience.primaryBuyerRoles.provenance?.[0]?.source;
      if (source && !result.sources.includes(source)) {
        result.sources.push(source);
      }
    }

    // audience.companyProfile
    if (graph.audience?.companyProfile?.value) {
      icp.companyProfile = graph.audience.companyProfile.value;
      const source = graph.audience.companyProfile.provenance?.[0]?.source;
      if (source && !result.sources.includes(source)) {
        result.sources.push(source);
      }
    }

    result.icp = icp;
    result.hasCanonicalICP = hasICPContent(icp);
    result.summary = buildICPSummary(icp);

    return result;
  } catch (error) {
    console.error('[ICPExtractor] Error loading canonical ICP:', error);
    return result;
  }
}
