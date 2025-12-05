// app/api/setup/[companyId]/export/route.ts
// Export strategic setup data as PDF or JSON

import { NextRequest, NextResponse } from 'next/server';
import { SetupFormData, SETUP_STEP_CONFIG } from '@/app/c/[companyId]/brain/setup/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();
    const { format, formData } = body as {
      format: 'pdf' | 'json';
      formData: Partial<SetupFormData>;
    };

    if (format === 'json') {
      // Export as JSON
      const exportData = {
        companyId,
        exportedAt: new Date().toISOString(),
        version: '1.0',
        data: formData,
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="strategy-pack-${companyId}.json"`,
        },
      });
    }

    if (format === 'pdf') {
      // Generate HTML that can be converted to PDF
      // For now, return HTML that the browser can print as PDF
      const html = generateStrategyPackHTML(companyId, formData);

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `inline; filename="strategy-pack-${companyId}.html"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid format. Use "pdf" or "json"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export' },
      { status: 500 }
    );
  }
}

function generateStrategyPackHTML(
  companyId: string,
  formData: Partial<SetupFormData>
): string {
  const companyName = formData.businessIdentity?.businessName || 'Company';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Strategic Marketing Plan - ${companyName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: #1a1a1a;
    }
    h1 {
      color: #7c3aed;
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 10px;
    }
    h2 {
      color: #374151;
      margin-top: 30px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
    }
    h3 { color: #6b7280; }
    .section { margin-bottom: 30px; }
    .field { margin-bottom: 15px; }
    .label {
      font-weight: 600;
      color: #374151;
      display: block;
      margin-bottom: 3px;
    }
    .value { color: #1f2937; }
    .tag {
      display: inline-block;
      background: #f3f4f6;
      padding: 4px 10px;
      border-radius: 15px;
      margin: 2px;
      font-size: 0.9em;
    }
    .empty { color: #9ca3af; font-style: italic; }
    .header-meta {
      color: #6b7280;
      font-size: 0.9em;
      margin-bottom: 30px;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Strategic Marketing Plan</h1>
  <div class="header-meta">
    <strong>${companyName}</strong><br>
    Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>

  <button class="no-print" onclick="window.print()" style="background:#7c3aed;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;margin-bottom:20px;">
    Print / Save as PDF
  </button>

  ${generateSection('Business Identity', [
    { label: 'Industry', value: formData.businessIdentity?.industry },
    { label: 'Business Model', value: formData.businessIdentity?.businessModel },
    { label: 'Revenue Model', value: formData.businessIdentity?.revenueModel },
    { label: 'Geographic Footprint', value: formData.businessIdentity?.geographicFootprint },
    { label: 'Service Area', value: formData.businessIdentity?.serviceArea },
    { label: 'Seasonality', value: formData.businessIdentity?.seasonalityNotes },
    { label: 'Peak Seasons', value: formData.businessIdentity?.peakSeasons, isArray: true },
    { label: 'Revenue Streams', value: formData.businessIdentity?.revenueStreams, isArray: true },
    { label: 'Primary Competitors', value: formData.businessIdentity?.primaryCompetitors, isArray: true },
  ])}

  ${generateSection('Marketing Objectives', [
    { label: 'Primary Objective', value: formData.objectives?.primaryObjective },
    { label: 'Secondary Objectives', value: formData.objectives?.secondaryObjectives, isArray: true },
    { label: 'Primary Business Goal', value: formData.objectives?.primaryBusinessGoal },
    { label: 'Time Horizon', value: formData.objectives?.timeHorizon },
    { label: 'Target CPA', value: formData.objectives?.targetCpa ? `$${formData.objectives.targetCpa}` : null },
    { label: 'Target ROAS', value: formData.objectives?.targetRoas ? `${formData.objectives.targetRoas}x` : null },
    { label: 'Revenue Goal', value: formData.objectives?.revenueGoal ? `$${formData.objectives.revenueGoal.toLocaleString()}` : null },
    { label: 'Lead Goal', value: formData.objectives?.leadGoal?.toLocaleString() },
  ])}

  ${generateSection('Target Audience', [
    { label: 'Core Segments', value: formData.audience?.coreSegments, isArray: true },
    { label: 'Demographics', value: formData.audience?.demographics },
    { label: 'Geographic Focus', value: formData.audience?.geos },
    { label: 'Primary Markets', value: formData.audience?.primaryMarkets, isArray: true },
    { label: 'Behavioral Drivers', value: formData.audience?.behavioralDrivers, isArray: true },
    { label: 'Demand States', value: formData.audience?.demandStates, isArray: true },
    { label: 'Pain Points', value: formData.audience?.painPoints, isArray: true },
    { label: 'Motivations', value: formData.audience?.motivations, isArray: true },
  ])}

  ${generateSection('Website & Conversion', [
    { label: 'Website Summary', value: formData.website?.websiteSummary },
    { label: 'Conversion Blockers', value: formData.website?.conversionBlocks, isArray: true },
    { label: 'Critical Issues', value: formData.website?.criticalIssues, isArray: true },
    { label: 'Opportunities', value: formData.website?.conversionOpportunities, isArray: true },
    { label: 'Quick Wins', value: formData.website?.quickWins, isArray: true },
  ])}

  ${generateSection('Media Strategy', [
    { label: 'Media Summary', value: formData.mediaFoundations?.mediaSummary },
    { label: 'Active Channels', value: formData.mediaFoundations?.activeChannels, isArray: true },
    { label: 'Attribution Model', value: formData.mediaFoundations?.attributionModel },
    { label: 'Media Issues', value: formData.mediaFoundations?.mediaIssues, isArray: true },
    { label: 'Opportunities', value: formData.mediaFoundations?.mediaOpportunities, isArray: true },
  ])}

  ${generateSection('Budget & Investment', [
    { label: 'Total Marketing Budget', value: formData.budgetScenarios?.totalMarketingBudget ? `$${formData.budgetScenarios.totalMarketingBudget.toLocaleString()}` : null },
    { label: 'Media Spend Budget', value: formData.budgetScenarios?.mediaSpendBudget ? `$${formData.budgetScenarios.mediaSpendBudget.toLocaleString()}` : null },
    { label: 'Budget Period', value: formData.budgetScenarios?.budgetPeriod },
    { label: 'Average Customer Value', value: formData.budgetScenarios?.avgCustomerValue ? `$${formData.budgetScenarios.avgCustomerValue.toLocaleString()}` : null },
    { label: 'Customer LTV', value: formData.budgetScenarios?.customerLTV ? `$${formData.budgetScenarios.customerLTV.toLocaleString()}` : null },
  ])}

  ${generateSection('Creative Strategy', [
    { label: 'Core Messages', value: formData.creativeStrategy?.coreMessages, isArray: true },
    { label: 'Proof Points', value: formData.creativeStrategy?.proofPoints, isArray: true },
    { label: 'Call to Actions', value: formData.creativeStrategy?.callToActions, isArray: true },
    { label: 'Available Formats', value: formData.creativeStrategy?.availableFormats, isArray: true },
    { label: 'Brand Guidelines', value: formData.creativeStrategy?.brandGuidelines },
  ])}

  ${generateSection('Measurement Setup', [
    { label: 'GA4 Property', value: formData.measurement?.ga4PropertyId },
    { label: 'Conversion Events', value: formData.measurement?.ga4ConversionEvents, isArray: true },
    { label: 'Call Tracking', value: formData.measurement?.callTracking },
    { label: 'Tracking Tools', value: formData.measurement?.trackingTools, isArray: true },
    { label: 'Attribution Model', value: formData.measurement?.attributionModel },
    { label: 'Attribution Window', value: formData.measurement?.attributionWindow },
  ])}

  <div class="section">
    <h2>Next Steps</h2>
    <ol>
      <li>Review and validate all strategic inputs with stakeholders</li>
      <li>Set up or verify tracking and measurement infrastructure</li>
      <li>Develop creative assets based on messaging strategy</li>
      <li>Launch initial campaigns on priority channels</li>
      <li>Establish reporting cadence and optimization schedule</li>
    </ol>
  </div>

  <div style="margin-top:50px;padding-top:20px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:0.9em;">
    Generated by Hive OS Strategic Setup | Company ID: ${companyId}
  </div>
</body>
</html>
  `;
}

function generateSection(
  title: string,
  fields: { label: string; value: string | string[] | number | null | undefined; isArray?: boolean }[]
): string {
  const content = fields
    .map((field) => {
      if (field.isArray && Array.isArray(field.value)) {
        if (field.value.length === 0) {
          return `<div class="field"><span class="label">${field.label}</span><span class="empty">Not specified</span></div>`;
        }
        return `
          <div class="field">
            <span class="label">${field.label}</span>
            <div>${field.value.map((v) => `<span class="tag">${v}</span>`).join('')}</div>
          </div>
        `;
      }

      const displayValue = field.value || '<span class="empty">Not specified</span>';
      return `
        <div class="field">
          <span class="label">${field.label}</span>
          <span class="value">${displayValue}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="section">
      <h2>${title}</h2>
      ${content}
    </div>
  `;
}
