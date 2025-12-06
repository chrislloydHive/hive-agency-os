// lib/insights/ingestors/competitorLabIngestor.ts
// Insight ingestor for Competitor Lab results
//
// Extracts insights from expanded competitive intelligence:
// - Strategic positioning analysis
// - Feature matrix gaps
// - Pricing landscape insights
// - Messaging overlap/differentiation
// - Market cluster threats
// - Substitute detection
// - High-threat competitor alerts

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  runIngestor,
  extractLabData,
  formatArrayItems,
  type IngestorParams,
  type IngestorResult,
} from './baseIngestor';

/**
 * Extract insights from Competitor Lab / Competition Lab reports
 *
 * Handles both:
 * - competitorLab (original Context Graph-based competitive intelligence)
 * - competitionLab (Competition Lab v2 multi-source discovery pipeline)
 */
export async function ingestCompetitorLab(params: IngestorParams): Promise<IngestorResult> {
  // Support both tool IDs
  const toolId = params.run.toolId === 'competitionLab' ? 'competitionLab' : 'competitorLab';
  const toolName = toolId === 'competitionLab' ? 'Competition Lab v2' : 'Competitor Lab';

  return runIngestor(params, {
    toolId,
    toolName,
    labId: 'competitor',

    extractReportData: extractCompetitorLabData,
    systemPromptAddendum: `This is a Competitor Lab report analyzing comprehensive competitive intelligence.

Focus on extracting insights in these categories:
1. **strategic_positioning**: Market position gaps, whitespace opportunities, differentiation strategy
2. **competitive_threat**: High-threat competitors, threat drivers, defensive actions needed
3. **messaging_overlap**: Saturated messaging themes, differentiation opportunities
4. **pricing_landscape**: Price tier misalignment, value perception issues
5. **substitute_threats**: Alternative solutions taking market share

Prioritize insights that are:
- Actionable (clear next steps)
- Time-sensitive (threats, market shifts)
- High-impact (affects positioning or revenue)
- Data-backed (based on competitive analysis)

For threat-related insights, use severity based on threat level:
- threatLevel >= 80: critical
- threatLevel >= 60: high
- threatLevel >= 40: medium
- threatLevel < 40: low`,
  });
}

function extractCompetitorLabData(run: DiagnosticRun): string {
  const labData = extractLabData(run);
  const raw = labData.raw;
  const parts: string[] = [];

  // Overall summary
  if (labData.summary) {
    parts.push(`**Summary:** ${labData.summary}`);
  }

  // Competitor-specific fields from raw data
  if (raw) {
    // =========================================================================
    // Positioning Analysis
    // =========================================================================

    // Positioning axes
    if (raw.primaryAxis) {
      parts.push(`**Primary Axis:** ${raw.primaryAxis}`);
    }
    if (raw.secondaryAxis) {
      parts.push(`**Secondary Axis:** ${raw.secondaryAxis}`);
    }

    // Position summary
    if (raw.positionSummary) {
      parts.push(`**Positioning Summary:** ${raw.positionSummary}`);
    }

    // Positioning axes (structured format)
    if (raw.positioningAxes && typeof raw.positioningAxes === 'object') {
      const axes = raw.positioningAxes as Record<string, unknown>;
      const primaryAxis = axes.primaryAxis as Record<string, string> | undefined;
      const secondaryAxis = axes.secondaryAxis as Record<string, string> | undefined;
      if (primaryAxis) {
        parts.push(`**Primary Axis:** ${primaryAxis.label} (${primaryAxis.lowLabel} ↔ ${primaryAxis.highLabel})`);
      }
      if (secondaryAxis) {
        parts.push(`**Secondary Axis:** ${secondaryAxis.label} (${secondaryAxis.lowLabel} ↔ ${secondaryAxis.highLabel})`);
      }
    }

    // =========================================================================
    // Competitors with Expanded Fields
    // =========================================================================

    if (raw.competitors && Array.isArray(raw.competitors)) {
      const competitors = raw.competitors as Array<Record<string, unknown>>;

      // Format competitor list with key info
      const competitorSummaries = competitors.map((c) => {
        const name = c.name as string;
        const category = c.category as string | null;
        const threatLevel = c.threatLevel as number | null;
        const trajectory = c.trajectory as string | null;
        const confidence = c.confidence as number | null;

        let summary = category ? `${name} (${category})` : name;
        if (threatLevel !== null) summary += ` - Threat: ${threatLevel}/100`;
        if (trajectory) summary += ` - Trajectory: ${trajectory}`;
        if (confidence !== null) summary += ` - Confidence: ${Math.round(confidence * 100)}%`;
        return summary;
      });
      parts.push(formatArrayItems(competitorSummaries, 'Competitors', 10));

      // Extract high-threat competitors (threatLevel >= 60)
      const highThreatCompetitors = competitors.filter((c) => (c.threatLevel as number) >= 60);
      if (highThreatCompetitors.length > 0) {
        const threatDetails = highThreatCompetitors.map((c) => {
          const name = c.name as string;
          const threatLevel = c.threatLevel as number;
          const drivers = (c.threatDrivers as string[]) || [];
          return `${name} (${threatLevel}/100): ${drivers.slice(0, 3).join(', ') || 'No drivers specified'}`;
        });
        parts.push(formatArrayItems(threatDetails, 'High-Threat Competitors', 5));
      }

      // Extract rising competitors (trajectory = 'rising')
      const risingCompetitors = competitors.filter((c) => c.trajectory === 'rising');
      if (risingCompetitors.length > 0) {
        const risingDetails = risingCompetitors.map((c) => {
          const name = c.name as string;
          const reason = (c.trajectoryReason as string) || 'No reason specified';
          return `${name}: ${reason}`;
        });
        parts.push(formatArrayItems(risingDetails, 'Rising Competitors', 5));
      }
    }

    // =========================================================================
    // Feature Matrix
    // =========================================================================

    if (raw.featuresMatrix && Array.isArray(raw.featuresMatrix)) {
      const features = raw.featuresMatrix as Array<Record<string, unknown>>;

      // Find feature gaps (company doesn't support but competitors do)
      const featureGaps = features.filter((f) => {
        const companySupport = f.companySupport as boolean;
        const competitors = f.competitors as Array<{ hasFeature: boolean }> || [];
        const competitorCount = competitors.filter((c) => c.hasFeature).length;
        return !companySupport && competitorCount >= 2;
      });

      if (featureGaps.length > 0) {
        const gapDetails = featureGaps.map((f) => {
          const name = f.featureName as string;
          const importance = f.importance as number;
          return `${name} (Importance: ${importance}/100)`;
        });
        parts.push(formatArrayItems(gapDetails, 'Feature Gaps (Competitors Have, You Don\'t)', 5));
      }

      // Find competitive advantages (company has, most competitors don't)
      const featureAdvantages = features.filter((f) => {
        const companySupport = f.companySupport as boolean;
        const competitors = f.competitors as Array<{ hasFeature: boolean }> || [];
        const competitorCount = competitors.filter((c) => c.hasFeature).length;
        return companySupport && competitorCount <= 1;
      });

      if (featureAdvantages.length > 0) {
        const advantageDetails = featureAdvantages.map((f) => f.featureName as string);
        parts.push(formatArrayItems(advantageDetails, 'Feature Advantages (You Have, Competitors Don\'t)', 5));
      }
    }

    // =========================================================================
    // Pricing Landscape
    // =========================================================================

    if (raw.pricingModels && Array.isArray(raw.pricingModels)) {
      const pricingModels = raw.pricingModels as Array<Record<string, unknown>>;
      const pricingDetails = pricingModels.map((p) => {
        const name = p.competitorName as string;
        const tier = p.priceTier as string;
        const value = p.valueForMoneyScore as number;
        const notes = p.pricingNotes as string | null;
        return `${name}: ${tier} tier, Value: ${value}/100${notes ? ` - ${notes}` : ''}`;
      });
      parts.push(formatArrayItems(pricingDetails, 'Pricing Landscape', 8));
    }

    if (raw.ownPriceTier) {
      parts.push(`**Own Price Tier:** ${raw.ownPriceTier}`);
    }

    // =========================================================================
    // Messaging Overlap
    // =========================================================================

    if (raw.messageOverlap && Array.isArray(raw.messageOverlap)) {
      const overlaps = raw.messageOverlap as Array<Record<string, unknown>>;

      // Find saturated themes (high overlap)
      const saturatedThemes = overlaps.filter((m) => (m.overlapScore as number) >= 60);
      if (saturatedThemes.length > 0) {
        const saturatedDetails = saturatedThemes.map((m) => {
          const theme = m.theme as string;
          const score = m.overlapScore as number;
          const suggestion = m.suggestion as string | null;
          return `"${theme}" (Overlap: ${score}/100)${suggestion ? ` → ${suggestion}` : ''}`;
        });
        parts.push(formatArrayItems(saturatedDetails, 'Saturated Messaging Themes (Differentiate)', 5));
      }

      // Find differentiation opportunities (low overlap, company using)
      const uniqueThemes = overlaps.filter((m) =>
        (m.overlapScore as number) < 30 && (m.companyUsing as boolean)
      );
      if (uniqueThemes.length > 0) {
        const uniqueDetails = uniqueThemes.map((m) => m.theme as string);
        parts.push(formatArrayItems(uniqueDetails, 'Unique Messaging (Amplify)', 5));
      }
    }

    if (raw.messagingDifferentiationScore !== null && raw.messagingDifferentiationScore !== undefined) {
      parts.push(`**Messaging Differentiation Score:** ${raw.messagingDifferentiationScore}/100`);
    }

    // =========================================================================
    // Market Clusters
    // =========================================================================

    if (raw.marketClusters && Array.isArray(raw.marketClusters)) {
      const clusters = raw.marketClusters as Array<Record<string, unknown>>;
      const clusterDetails = clusters.map((c) => {
        const name = c.clusterName as string;
        const competitors = c.competitors as string[] || [];
        const threatLevel = c.threatLevel as number;
        const whitespace = c.whitespaceOpportunity as string | null;
        let detail = `${name} (Threat: ${threatLevel}/100): ${competitors.slice(0, 3).join(', ')}`;
        if (whitespace) detail += ` → Opportunity: ${whitespace}`;
        return detail;
      });
      parts.push(formatArrayItems(clusterDetails, 'Market Clusters', 5));
    }

    // =========================================================================
    // Threat Scores (Detailed)
    // =========================================================================

    if (raw.threatScores && Array.isArray(raw.threatScores)) {
      const threats = raw.threatScores as Array<Record<string, unknown>>;
      const criticalThreats = threats.filter((t) => (t.threatLevel as number) >= 70);
      if (criticalThreats.length > 0) {
        const threatDetails = criticalThreats.map((t) => {
          const name = t.competitorName as string;
          const level = t.threatLevel as number;
          const horizon = t.timeHorizon as string | null;
          const actions = t.defensiveActions as string[] || [];
          let detail = `${name}: ${level}/100`;
          if (horizon) detail += ` (${horizon})`;
          if (actions.length > 0) detail += ` → Actions: ${actions.slice(0, 2).join(', ')}`;
          return detail;
        });
        parts.push(formatArrayItems(threatDetails, 'Critical Threats (Immediate Action)', 5));
      }
    }

    if (raw.overallThreatLevel !== null && raw.overallThreatLevel !== undefined) {
      parts.push(`**Overall Threat Level:** ${raw.overallThreatLevel}/100`);
    }

    // =========================================================================
    // Substitutes
    // =========================================================================

    if (raw.substitutes && Array.isArray(raw.substitutes)) {
      const substitutes = raw.substitutes as Array<Record<string, unknown>>;
      const substituteDetails = substitutes.map((s) => {
        const name = s.name as string;
        const category = s.category as string | null;
        const reason = s.reasonCustomersChooseThem as string | null;
        const threat = s.threatLevel as number;
        let detail = category ? `${name} (${category})` : name;
        detail += ` - Threat: ${threat}/100`;
        if (reason) detail += ` - "${reason}"`;
        return detail;
      });
      parts.push(formatArrayItems(substituteDetails, 'Substitutes / Alternatives', 5));
    }

    // =========================================================================
    // Whitespace Opportunities (Expanded)
    // =========================================================================

    if (raw.whitespaceMap && Array.isArray(raw.whitespaceMap)) {
      const whitespaces = raw.whitespaceMap as Array<Record<string, unknown>>;
      const whitespaceDetails = whitespaces.map((w) => {
        const name = w.name as string;
        const description = w.description as string | null;
        const size = w.size as number;
        const strategicFit = w.strategicFit as number;
        const actions = w.captureActions as string[] || [];
        let detail = `${name} (Size: ${size}/100, Fit: ${strategicFit}/100)`;
        if (description) detail += `: ${description}`;
        if (actions.length > 0) detail += ` → ${actions[0]}`;
        return detail;
      });
      parts.push(formatArrayItems(whitespaceDetails, 'Whitespace Opportunities', 5));
    } else if (raw.whitespaceOpportunities && Array.isArray(raw.whitespaceOpportunities)) {
      // Fallback to string array
      parts.push(formatArrayItems(raw.whitespaceOpportunities, 'Whitespace Opportunities'));
    }

    // =========================================================================
    // Strategy Fields
    // =========================================================================

    // Competitive advantages
    if (raw.competitiveAdvantages && Array.isArray(raw.competitiveAdvantages)) {
      parts.push(formatArrayItems(raw.competitiveAdvantages, 'Competitive Advantages'));
    }

    // Competitive threats
    if (raw.competitiveThreats && Array.isArray(raw.competitiveThreats)) {
      parts.push(formatArrayItems(raw.competitiveThreats, 'Competitive Threats'));
    }

    // Competitive opportunities
    if (raw.competitiveOpportunities && Array.isArray(raw.competitiveOpportunities)) {
      parts.push(formatArrayItems(raw.competitiveOpportunities, 'Competitive Opportunities'));
    }

    // Differentiation strategy
    if (raw.differentiationStrategy) {
      parts.push(`**Differentiation Strategy:** ${raw.differentiationStrategy}`);
    }

    // Market trends
    if (raw.marketTrends && Array.isArray(raw.marketTrends)) {
      parts.push(formatArrayItems(raw.marketTrends, 'Market Trends'));
    }

    // Data confidence
    if (raw.dataConfidence !== null && raw.dataConfidence !== undefined) {
      parts.push(`**Data Confidence:** ${Math.round((raw.dataConfidence as number) * 100)}%`);
    }
  }

  // Issues and recommendations from labData
  if (labData.issues.length > 0) {
    parts.push(formatArrayItems(labData.issues, 'Issues'));
  }
  if (labData.quickWins.length > 0) {
    parts.push(formatArrayItems(labData.quickWins, 'Quick Wins'));
  }
  if (labData.recommendations.length > 0) {
    parts.push(formatArrayItems(labData.recommendations, 'Recommendations'));
  }

  return parts.join('\n\n');
}
