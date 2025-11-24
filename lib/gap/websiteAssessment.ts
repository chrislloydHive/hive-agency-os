/**
 * Safe website assessment step handler
 * 
 * This step performs website scoring with timeout protection.
 * If scoring times out or fails, it creates a partial result instead of throwing.
 */

import type { GapRunState, WebsiteAssessmentResult } from '@/types/gap';
import { setCurrentFinding } from './runFindings';
import { safeScoreWebsite } from '@/lib/full-report-analysis';
import { DEFAULT_RUBRIC } from '@/lib/rubric';
import type { ExtractionData } from '@/lib/rubric';

// In-memory store for assessment results (in production, use a proper database)
const assessmentResults = new Map<string, WebsiteAssessmentResult>();

/**
 * Save website assessment result
 */
async function saveWebsiteAssessmentResult(result: Omit<WebsiteAssessmentResult, 'id' | 'createdAt'>): Promise<string> {
  const id = `website-assessment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const assessment: WebsiteAssessmentResult = {
    id,
    ...result,
    createdAt: new Date().toISOString(),
  };
  assessmentResults.set(id, assessment);
  return id;
}

/**
 * Get website assessment result by ID
 */
export async function getWebsiteAssessmentResult(id: string): Promise<WebsiteAssessmentResult | null> {
  return assessmentResults.get(id) || null;
}

/**
 * Perform website assessment step safely
 * 
 * This function:
 * - Calls website scoring with a 20s timeout
 * - If successful, saves full result
 * - If timeout/failure, saves partial result with conservative estimates
 * - Never throws - always completes successfully
 */
export async function doWebsiteAssessmentSafe(
  run: GapRunState,
  extraction: ExtractionData
): Promise<void> {
  setCurrentFinding(run, 'Reviewing website UX, CTAs, and conversion paths…');
  
  try {
    // Call safe scoring wrapper (already has 20s timeout built in)
    const scoringResult = await safeScoreWebsite(extraction, DEFAULT_RUBRIC);
    
    if (scoringResult.ok && scoringResult.data) {
      // Success - save full assessment result
      const id = await saveWebsiteAssessmentResult({
        status: 'ok',
        data: scoringResult.data,
      });
      run.websiteAssessmentId = id;
      setCurrentFinding(run, 'Website assessment complete.');
    } else {
      // Timeout or failure - save partial result
      console.warn('[doWebsiteAssessmentSafe] Website scoring failed:', scoringResult.error);
      
      const id = await saveWebsiteAssessmentResult({
        status: 'partial',
        reason: 'timeout',
        data: null,
      });
      run.websiteAssessmentId = id;
      
      setCurrentFinding(
        run,
        'Website scoring timed out — using conservative estimates based on other signals.'
      );
    }
  } catch (err: any) {
    // This should never happen since safeScoreWebsite doesn't throw,
    // but handle it just in case
    console.error('[doWebsiteAssessmentSafe] Unexpected error:', err);
    
    const id = await saveWebsiteAssessmentResult({
      status: 'partial',
      reason: 'error',
      data: null,
    });
    run.websiteAssessmentId = id;
    
    setCurrentFinding(
      run,
      'Website assessment encountered an issue — using conservative estimates.'
    );
  }
}

