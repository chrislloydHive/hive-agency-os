// lib/airtable/gapRuns.ts
// GAP Runs logging to Airtable

import { createRecord } from './client';

/**
 * GAP Run Payload for Airtable logging
 */
export interface GapRunPayload {
  planId: string;
  snapshotId?: string;
  url: string;
  maturityStage?: 'Early' | 'Emerging' | 'Scaling' | 'Leading';
  scores: {
    overall?: number;
    brand?: number;
    content?: number;
    website?: number;
    technical?: number;
    authority?: number;
    seo?: number;
  };
  quickWinsCount: number;
  initiativesCount: number;
  createdAt: string;
  modelVersion?: string;
  warnings?: string[];
  rawPlan?: unknown;
  // New enrichment fields
  ctaClarity?: 'clear' | 'moderate' | 'unclear';
  ctaProminence?: 'prominent' | 'buried' | 'missing';
  socialPresenceLevel?: 'strong' | 'moderate' | 'weak' | 'missing';
  competitorCount?: number;
}

/**
 * Log a GAP run to Airtable
 *
 * This function MUST NOT throw - it catches all errors and logs them to console.
 * GAP API responses should never fail due to Airtable logging issues.
 *
 * @param payload - GAP run data to log
 */
export async function logGapRunToAirtable(
  payload: GapRunPayload
): Promise<void> {
  try {
    // Get table name from environment or use default
    const tableName =
      process.env.AIRTABLE_GAP_RUNS_TABLE_ID || 
      process.env.AIRTABLE_GAP_RUNS_TABLE || 
      'GAP Runs';

    console.log('[GAP] Logging to Airtable:', {
      tableName,
      planId: payload.planId,
      url: payload.url,
    });

    // Map payload to Airtable field names (matching exact schema)
    const fields: Record<string, unknown> = {
      'Plan ID': payload.planId,
      'URL': payload.url,
      'Status': 'completed',
      'Progress': 100,
      'Stage': 'done',
      'Error': null,
      'Current Finding': null,
      'Business Name': payload.rawPlan && typeof payload.rawPlan === 'object' && 'companyName' in payload.rawPlan 
        ? (payload.rawPlan as any).companyName 
        : null,
      'Quick Wins Count': payload.quickWinsCount,
      'Initiatives Count': payload.initiativesCount,
      'Created At': payload.createdAt,
      'Updated At': payload.createdAt, // Set to same as Created At for new records
    };
    
    // Add Result field with full plan JSON
    if (payload.rawPlan) {
      fields['Result'] = JSON.stringify(payload.rawPlan);
    }
    
    // Note: Full Reports field is a link field - would need assessment IDs to link
    // This would require additional data from the assessment process
    // For now, leaving it empty/null

    // Optional fields
    if (payload.snapshotId) {
      fields['Snapshot ID'] = payload.snapshotId;
    }

    // Maturity Stage - map to Airtable allowed options (uppercase)
    // Airtable options: FOUNDATION, EMERGING, SCALING, LEADING
    if (payload.maturityStage) {
      const maturityStageMap: Record<string, string> = {
        'Early': 'FOUNDATION',
        'Early-stage': 'FOUNDATION',
        'Developing': 'FOUNDATION', // Map Developing to FOUNDATION
        'Emerging': 'EMERGING',
        'Scaling': 'SCALING',
        'Leading': 'LEADING',
        'Category leader': 'LEADING',
      };
      
      const mappedStage = maturityStageMap[payload.maturityStage] || payload.maturityStage.toUpperCase();
      const allowedStages = ['FOUNDATION', 'EMERGING', 'SCALING', 'LEADING'];
      
      if (allowedStages.includes(mappedStage)) {
        fields['Maturity Stage'] = mappedStage;
      } else {
        console.warn(`[GAP] Maturity Stage "${payload.maturityStage}" (mapped to "${mappedStage}") not in allowed values: ${allowedStages.join(', ')}`);
      }
    }

    // Note: Model Version field removed - not in Airtable schema
    // if (payload.modelVersion) {
    //   fields['Model Version'] = payload.modelVersion;
    // }

    // Scores
    if (payload.scores.overall !== undefined) {
      fields['Overall Score'] = payload.scores.overall;
    }
    if (payload.scores.brand !== undefined) {
      fields['Brand Score'] = payload.scores.brand;
    }
    if (payload.scores.content !== undefined) {
      fields['Content Score'] = payload.scores.content;
    }
    if (payload.scores.website !== undefined) {
      fields['Website Score'] = payload.scores.website;
    }
    // Technical Score and Authority Score (now in schema)
    if (payload.scores.technical !== undefined) {
      fields['Technical Score'] = payload.scores.technical;
    }
    if (payload.scores.authority !== undefined) {
      fields['Authority Score'] = payload.scores.authority;
    }
    if (payload.scores.seo !== undefined) {
      fields['SEO Score'] = payload.scores.seo;
    }

    // Note: Warnings field removed - not in Airtable schema
    // Warnings data is stored in the Result JSON field if needed
    // if (payload.warnings && payload.warnings.length > 0) {
    //   fields['Warnings'] = payload.warnings.join('\n');
    // }

    // CTA fields (single select - map to exact values)
    if (payload.ctaClarity) {
      // Map to Airtable options: Clear / Moderate / Unclear
      const clarityMap: Record<string, string> = {
        'clear': 'Clear',
        'moderate': 'Moderate',
        'unclear': 'Unclear',
      };
      const mappedClarity = clarityMap[payload.ctaClarity];
      if (mappedClarity) {
        fields['CTA Clarity'] = mappedClarity;
      }
    }
    
    if (payload.ctaProminence) {
      // Map to Airtable options: Prominent / Buried / Missing
      const prominenceMap: Record<string, string> = {
        'prominent': 'Prominent',
        'buried': 'Buried',
        'missing': 'Missing',
      };
      const mappedProminence = prominenceMap[payload.ctaProminence];
      if (mappedProminence) {
        fields['CTA Prominence'] = mappedProminence;
      }
    }
    
    // Social Presence Level (single select)
    if (payload.socialPresenceLevel) {
      // Map to Airtable options: Strong / Moderate / Weak / Missing
      const socialMap: Record<string, string> = {
        'strong': 'Strong',
        'moderate': 'Moderate',
        'weak': 'Weak',
        'missing': 'Missing',
      };
      const mappedSocial = socialMap[payload.socialPresenceLevel];
      if (mappedSocial) {
        fields['Social Presence Level'] = mappedSocial;
      }
    }
    
    // Competitor Count (number)
    if (payload.competitorCount !== undefined) {
      fields['Competitor Count'] = payload.competitorCount;
    }

    // Create the record
    console.log('[GAP] Creating Airtable record with fields:', Object.keys(fields));
    console.log('[GAP] Field values preview:', {
      'Plan ID': fields['Plan ID'],
      'URL': fields['URL'],
      'Status': fields['Status'],
      'Business Name': fields['Business Name'],
      'Overall Score': fields['Overall Score'],
    });
    
    const startTime = Date.now();
    const result = await createRecord(tableName, fields);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    const recordId = result?.id || result?.records?.[0]?.id;
    console.log(
      `[GAP] ✅ Successfully logged run to Airtable: ${payload.planId}`
    );
    console.log('[GAP] Airtable record ID:', recordId);
    console.log('[GAP] Save completed in', elapsed, 'seconds');
  } catch (error) {
    // CRITICAL: Never throw from this function
    // Logging failures should not break the GAP API
    console.error('[GAP] ❌ Failed to log GAP run to Airtable:', error);
    if (error instanceof Error) {
      console.error('[GAP] Error details:', error.message);
      console.error('[GAP] Error stack:', error.stack);
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      console.error('[GAP] Error status code:', (error as any).statusCode);
    }
  }
}
