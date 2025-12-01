// components/gap/DetailedServiceAssessments.tsx
// Detailed Service Assessments section for GAP page

import type { DiagnosticsPayload } from '@/lib/airtable/gapFullReports';
import type { GrowthAccelerationPlan } from '@/lib/growth-plan/growthActionPlanSchema';
import { BrandLabSnapshot, type BrandLabSnapshotData } from './BrandLabSnapshot';

interface AreaDiagnostic {
  score?: number; // 0–100
  summary?: string;
  strengths?: string[];
  issues?: string[];
  recommendations?: string[];
  evidence?: string[];
  maturityNotes?: string;
}

interface GapDiagnostics {
  brand?: AreaDiagnostic;
  content?: AreaDiagnostic;
  seo?: AreaDiagnostic;
  website?: AreaDiagnostic;
}

interface DetailedServiceAssessmentsProps {
  plan?: GrowthAccelerationPlan;
  diagnostics?: GapDiagnostics | DiagnosticsPayload;
  scores?: {
    brand?: number;
    content?: number;
    seo?: number;
    website?: number;
    websiteUx?: number; // Alternative name
  };
  /** Brand Lab context from pre-analysis (V4) */
  brandLabContext?: BrandLabSnapshotData;
  /** Company ID for linking to Brand Lab */
  companyId?: string;
}

export function DetailedServiceAssessments({
  plan,
  diagnostics,
  scores,
  brandLabContext,
  companyId,
}: DetailedServiceAssessmentsProps) {
  // Use plan.sectionAnalyses if available, otherwise fall back to diagnostics
  const sectionAnalyses = plan?.sectionAnalyses || {};
  
  // Debug logging - ALWAYS log in development
  console.log('[DetailedServiceAssessments] 🔍 DEBUG:', {
    hasPlan: !!plan,
    planGapId: plan?.gapId,
    sectionAnalysesKeys: Object.keys(sectionAnalyses),
    sectionAnalysesCount: Object.keys(sectionAnalyses).length,
    hasDiagnostics: !!diagnostics,
    diagnosticsType: diagnostics ? typeof diagnostics : 'null',
    scores,
    scorecard: plan?.scorecard ? {
      overall: plan.scorecard.overall,
      brand: plan.scorecard.brand,
      content: plan.scorecard.content,
      seo: plan.scorecard.seo,
      website: plan.scorecard.website,
    } : 'no scorecard',
    brandSection: (sectionAnalyses.brand || (sectionAnalyses as any).brandAndPositioning) ? 'present' : 'missing',
    contentSection: (sectionAnalyses.content || (sectionAnalyses as any).contentAndMessaging) ? 'present' : 'missing',
    seoSection: (sectionAnalyses.seo || (sectionAnalyses as any).seoAndVisibility) ? 'present' : 'missing',
    websiteSection: (sectionAnalyses.website || (sectionAnalyses as any).websiteAndConversion) ? 'present' : 'missing',
  });
  
  // Map section analysis keys to our area keys (new format: brand, content, seo, website)
  const SECTION_KEY_MAP: Record<string, { key: string; label: string }> = {
    brand: { key: 'brand', label: 'Brand & Positioning' },
    content: { key: 'content', label: 'Content & Messaging' },
    seo: { key: 'seo', label: 'SEO & Visibility' },
    website: { key: 'website', label: 'Website & Conversion' },
    // Legacy format support
    brandAndPositioning: { key: 'brand', label: 'Brand & Positioning' },
    contentAndMessaging: { key: 'content', label: 'Content & Messaging' },
    seoAndVisibility: { key: 'seo', label: 'SEO & Visibility' },
    websiteAndConversion: { key: 'website', label: 'Website & Conversion' },
  };

  // Get area data from plan.sectionAnalyses (prioritize new simple format: label, score, summary, strengths, issues)
  const getAreaDataFromPlan = (areaKey: string) => {
    // Try new format first (brand, content, seo, website keys)
    let section = sectionAnalyses[areaKey as keyof typeof sectionAnalyses];
    
    // Fallback to legacy format if new format not found
    if (!section) {
      const legacyMap: Record<string, string> = {
        brand: 'brandAndPositioning',
        content: 'contentAndMessaging',
        seo: 'seoAndVisibility',
        website: 'websiteAndConversion',
      };
      const legacyKey = legacyMap[areaKey];
      if (legacyKey) {
        section = sectionAnalyses[legacyKey as keyof typeof sectionAnalyses];
      }
    }
    
    if (section) {
      const sectionAny = section as any;
      
      // Prioritize new simple format: label, score, summary, strengths, issues
      // Check if it has the new simple structure (label, summary, strengths, issues directly)
      if (sectionAny.label || sectionAny.summary || (sectionAny.strengths && Array.isArray(sectionAny.strengths)) || (sectionAny.issues && Array.isArray(sectionAny.issues))) {
        const score = sectionAny.score ?? plan?.scorecard?.[areaKey === 'website' ? 'website' : areaKey as keyof typeof plan.scorecard] as number | undefined;
        
        return {
          score,
          label: sectionAny.label,
          grade: sectionAny.grade,
          verdict: sectionAny.verdict,
          summary: sectionAny.summary,
          strengths: Array.isArray(sectionAny.strengths) ? sectionAny.strengths : [],
          issues: Array.isArray(sectionAny.issues) ? sectionAny.issues : [],
          recommendations: Array.isArray(sectionAny.recommendations) ? sectionAny.recommendations : [],
          impactEstimate: sectionAny.impactEstimate,
          // Legacy fields for backward compatibility
          keyFindings: sectionAny.keyFindings || [],
          quickWins: sectionAny.quickWins || [],
          deeperInitiatives: sectionAny.deeperInitiatives || [],
        };
      }
      
      // Handle cardLevel/deepDive structure (if present)
      if (sectionAny.cardLevel || sectionAny.deepDive) {
        const score = sectionAny.score ?? plan?.scorecard?.[areaKey === 'website' ? 'website' : areaKey as keyof typeof plan.scorecard] as number | undefined;
        
        return {
          score,
          label: sectionAny.label,
          grade: sectionAny.grade,
          verdict: sectionAny.cardLevel?.verdict || sectionAny.verdict,
          summary: sectionAny.cardLevel?.summary || sectionAny.summary,
          strengths: Array.isArray(sectionAny.deepDive?.strengths) ? sectionAny.deepDive.strengths : (Array.isArray(sectionAny.strengths) ? sectionAny.strengths : []),
          issues: Array.isArray(sectionAny.deepDive?.issues) ? sectionAny.deepDive.issues : (Array.isArray(sectionAny.issues) ? sectionAny.issues : []),
          recommendations: Array.isArray(sectionAny.deepDive?.recommendations) ? sectionAny.deepDive.recommendations : (Array.isArray(sectionAny.recommendations) ? sectionAny.recommendations : []),
          impactEstimate: sectionAny.deepDive?.impactEstimate || sectionAny.impactEstimate,
          // Legacy fields for backward compatibility
          keyFindings: sectionAny.keyFindings || [],
          quickWins: sectionAny.quickWins || [],
          deeperInitiatives: sectionAny.deeperInitiatives || [],
        };
      }
    }
    
    // If no sectionAnalyses but we have a scorecard, at least return the score
    if (plan?.scorecard) {
      const scoreKey = areaKey === 'website' ? 'website' : areaKey;
      const score = plan.scorecard[scoreKey as keyof typeof plan.scorecard] as number | undefined;
      if (score !== undefined) {
        return {
          score,
          label: undefined,
          grade: undefined,
          verdict: undefined,
          summary: undefined,
          strengths: [],
          issues: [],
          recommendations: [],
          impactEstimate: undefined,
          keyFindings: [],
          quickWins: [],
          deeperInitiatives: [],
        };
      }
    }
    
    return null;
  };

  // Fallback: Map diagnostics to our expected format
  const getAreaDataFromDiagnostics = (area: 'brand' | 'content' | 'seo' | 'website' | 'websiteUx') => {
    if (!diagnostics) return null;
    
    const diagnosticsKey = area === 'website' ? 'websiteUx' : area;
    
    // Check if diagnostics is DiagnosticsJson format (has issuesByPillar)
    if (diagnostics && 'issuesByPillar' in diagnostics) {
      const dj = diagnostics as any;
      const pillarKey = diagnosticsKey as 'brand' | 'content' | 'seo' | 'websiteUx' | 'funnel';
      const issues = dj.issuesByPillar?.[pillarKey] || [];
      
      // Get score from scores prop
      const score = scores?.[area === 'website' ? 'websiteUx' : area];
      
      // Try to get summary from commentary
      const commentary = dj.commentary || '';
      const summaryMatch = commentary.match(new RegExp(`${pillarKey}:\\s*([^\\n]+)`, 'i'));
      const summary = summaryMatch ? summaryMatch[1] : undefined;
      
      return {
        score,
        label: undefined,
        grade: undefined,
        verdict: undefined,
        summary,
        strengths: [],
        issues: [],
        recommendations: [],
        impactEstimate: undefined,
        keyFindings: issues.slice(0, 3).map((i: any) => i.title || i.description || i) || [],
        quickWins: [],
        deeperInitiatives: [],
      };
    }
    
    // Handle DiagnosticsPayload format (has label, score, summary, issues)
    const diagnostic = diagnostics[diagnosticsKey as keyof typeof diagnostics];
    if (diagnostic && typeof diagnostic === 'object') {
      const dp = diagnostic as any;
      
      // Check if it's DiagnosticsPayload format (has issues array)
      if (Array.isArray(dp.issues)) {
        const diagnosticIssues = dp.issues || [];
        
        // Extract issues (key findings) - prioritize critical/high severity
        const keyFindings = diagnosticIssues
          .filter((i: any) => {
            const severity = (i.severity || '').toLowerCase();
            return severity === 'critical' || severity === 'high' || severity === 'medium';
          })
          .slice(0, 3)
          .map((i: any) => i.title || i.description || i)
          .filter(Boolean);
        
        // Extract strengths - look for positive issues or filter by severity
        const strengths = diagnosticIssues
          .filter((i: any) => {
            // Consider low severity or positive-sounding issues as strengths
            const severity = (i.severity || '').toLowerCase();
            const title = (i.title || '').toLowerCase();
            return severity === 'info' || severity === 'low' || 
                   title.includes('strong') || title.includes('good') || 
                   title.includes('effective') || title.includes('well');
          })
          .slice(0, 3)
          .map((i: any) => i.title || i.description || i)
          .filter(Boolean);
        
        // Extract recommendations from issue suggestions
        const recommendations = diagnosticIssues
          .map((i: any) => i.suggestion)
          .filter(Boolean)
          .slice(0, 1);
        
        return {
          score: dp.score ?? scores?.[area === 'website' ? 'websiteUx' : area],
          summary: dp.summary,
          strengths,
          keyFindings,
          recommendations,
        };
      }
      
      // Handle GapDiagnostics format (has summary, strengths, issues, recommendations as arrays)
      if (dp.strengths || (dp.issues && !Array.isArray(dp.issues[0]) && typeof dp.issues[0] !== 'object')) {
        return {
          score: dp.score ?? scores?.[area === 'website' ? 'websiteUx' : area],
          summary: dp.summary,
          strengths: Array.isArray(dp.strengths) ? dp.strengths : [],
          keyFindings: Array.isArray(dp.issues) 
            ? dp.issues.slice(0, 3).map((i: any) => typeof i === 'string' ? i : i.title || i)
            : [],
          recommendations: Array.isArray(dp.recommendations) ? dp.recommendations : [],
        };
      }
    }
    
    return null;
  };

  // Build areas array - prioritize plan.sectionAnalyses, fallback to diagnostics, then scores
  const areas = [
    {
      key: 'brand' as const,
      label: 'Brand & Positioning',
      data: getAreaDataFromPlan('brand') || getAreaDataFromDiagnostics('brand'),
      score: plan?.scorecard?.brand ?? scores?.brand,
    },
    {
      key: 'content' as const,
      label: 'Content & Engagement',
      data: getAreaDataFromPlan('content') || getAreaDataFromDiagnostics('content'),
      score: plan?.scorecard?.content ?? scores?.content,
    },
    {
      key: 'seo' as const,
      label: 'SEO & Visibility',
      data: getAreaDataFromPlan('seo') || getAreaDataFromDiagnostics('seo'),
      score: plan?.scorecard?.seo ?? scores?.seo,
    },
    {
      key: 'website' as const,
      label: 'Website & Conversion',
      data: getAreaDataFromPlan('website') || getAreaDataFromDiagnostics('website'),
      score: plan?.scorecard?.website ?? scores?.websiteUx ?? scores?.website,
    },
  ];

  // Ensure each area has at least a score if available, even if no other data
  const areasWithScores = areas.map(area => {
    // If we have a score but no data object, create a minimal data object
    if (area.score !== undefined && !area.data) {
      return {
        ...area,
        data: {
          score: area.score,
          label: undefined,
          grade: undefined,
          verdict: undefined,
          summary: undefined,
          strengths: [],
          issues: [],
          recommendations: [],
          impactEstimate: undefined,
          keyFindings: [],
          quickWins: [],
          deeperInitiatives: [],
        },
      };
    }
    // If we have data but no score in it, add the score
    if (area.data && area.score !== undefined && area.data.score === undefined) {
      return {
        ...area,
        data: {
          ...area.data,
          score: area.score,
        },
      };
    }
    return area;
  });

  // Filter out areas with no data AND no score
  const areasWithData = areasWithScores.filter(area => {
    if (!area.data && area.score === undefined) return false;
    // Include if we have summary, strengths, issues, recommendations, keyFindings, quickWins, deeperInitiatives, or score
    return (
      area.data?.summary ||
      (area.data?.strengths && area.data.strengths.length > 0) ||
      (area.data?.issues && area.data.issues.length > 0) ||
      (area.data?.recommendations && area.data.recommendations.length > 0) ||
      (area.data?.keyFindings && area.data.keyFindings.length > 0) ||
      (area.data?.quickWins && area.data.quickWins.length > 0) ||
      (area.data?.deeperInitiatives && area.data.deeperInitiatives.length > 0) ||
      area.data?.score !== undefined ||
      area.score !== undefined
    );
  });
  
  console.log('[DetailedServiceAssessments] 📊 Areas with data:', {
    totalAreas: areas.length,
    areasWithDataCount: areasWithData.length,
    areas: areasWithData.map(a => ({
      key: a.key,
      hasData: !!a.data,
      hasScore: a.score !== undefined || a.data?.score !== undefined,
      score: a.score ?? a.data?.score,
    })),
  });

  // Don't render if no data at all
  if (areasWithData.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DetailedServiceAssessments] No data found, not rendering');
    }
    return null;
  }

  return (
    <section className="mb-6">
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">
            Section Analyses
          </h2>
          <p className="text-sm text-slate-400">
            Concise diagnostics of your marketing system across Brand, Content, SEO, and Website & Conversion.
          </p>
        </div>

        {/* Brand Lab Snapshot (V4) - show when available */}
        {brandLabContext && (
          <div className="mb-6">
            <BrandLabSnapshot data={brandLabContext} companyId={companyId} />
          </div>
        )}

        {/* 2x2 Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {areasWithData.map((area) => {
            const { data } = area;
            
            if (!data || (data.score === undefined && !data.summary)) {
              return (
                <div
                  key={area.key}
                  className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-300">
                      {area.label}
                    </h3>
                    <span className="text-xs text-slate-500">—</span>
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    We didn't generate a detailed assessment for this area in this run.
                  </p>
                </div>
              );
            }

            const score = data.score;
            const label = data.label || area.label;
            const verdict = data.verdict;
            const summary = data.summary;
            const strengths = data.strengths || [];
            const issues = data.issues || [];

            // Check if we have cardLevel data (verdict/summary) or deepDive data (strengths/issues)
            const hasContent = verdict || summary || strengths.length > 0 || issues.length > 0;

            return (
              <div
                key={area.key}
                className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5"
              >
                {/* Header Row with Score */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-100 sm:text-base">
                    {label}
                  </h3>
                  {score !== undefined && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                      {Math.round(score)}/100
                    </span>
                  )}
                </div>

                {/* Verdict - Sharp one-line diagnosis */}
                {verdict && (
                  <p className="text-sm font-medium text-slate-200 mb-2">
                    {verdict}
                  </p>
                )}

                {/* Summary - Short overview */}
                {summary && (
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {summary}
                  </p>
                )}

                {/* Strengths & Issues in a compact grid */}
                <div className="grid grid-cols-1 gap-3 mt-3">
                  {/* Strengths */}
                  {strengths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Strengths
                      </p>
                      <ul className="space-y-1">
                        {strengths.slice(0, 3).map((strength: any, idx: number) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                            <span className="text-slate-500 mt-0.5 flex-shrink-0">+</span>
                            <span>{typeof strength === 'string' ? strength : strength.title || strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Issues */}
                  {issues.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Issues
                      </p>
                      <ul className="space-y-1">
                        {issues.slice(0, 3).map((issue: any, idx: number) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                            <span className="text-slate-500 mt-0.5 flex-shrink-0">−</span>
                            <span>{typeof issue === 'string' ? issue : issue.title || issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

