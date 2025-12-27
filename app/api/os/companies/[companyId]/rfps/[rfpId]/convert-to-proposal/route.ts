// app/api/os/companies/[companyId]/rfps/[rfpId]/convert-to-proposal/route.ts
// API route for converting an RFP to a Proposal

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRfpWithDetails } from '@/lib/airtable/rfp';
import {
  convertRfpToProposal,
  canConvertToProposal,
} from '@/lib/os/proposal/convertRfpToProposal';

interface RouteParams {
  params: Promise<{ companyId: string; rfpId: string }>;
}

// POST /api/os/companies/[companyId]/rfps/[rfpId]/convert-to-proposal
// Convert an RFP to a Proposal
const ConvertSchema = z.object({
  proposalTitle: z.string().min(1).optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, rfpId } = await params;

    if (!companyId || !rfpId) {
      return NextResponse.json(
        { error: 'Company ID and RFP ID are required' },
        { status: 400 }
      );
    }

    // Get the RFP with all details
    const rfpWithDetails = await getRfpWithDetails(rfpId);

    if (!rfpWithDetails) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Verify ownership
    if (rfpWithDetails.rfp.companyId !== companyId) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Check if conversion is possible
    const conversionCheck = canConvertToProposal(rfpWithDetails);
    if (!conversionCheck.canConvert) {
      return NextResponse.json(
        {
          error: 'Cannot convert RFP',
          reason: conversionCheck.reason,
        },
        { status: 400 }
      );
    }

    // Parse optional title override
    let proposalTitle: string | undefined;
    try {
      const body = await request.json();
      const parsed = ConvertSchema.safeParse(body);
      if (parsed.success && parsed.data.proposalTitle) {
        proposalTitle = parsed.data.proposalTitle;
      }
    } catch {
      // No body provided, use default title
    }

    // Perform the conversion
    const result = await convertRfpToProposal({
      rfpWithDetails,
      proposalTitle,
    });

    return NextResponse.json({
      success: true,
      proposal: result.proposal,
      sections: result.sections,
      mappedSections: result.mappedSections,
      skippedSections: result.skippedSections,
      warnings: conversionCheck.warnings,
    }, { status: 201 });
  } catch (error) {
    console.error('[rfp] convert-to-proposal error:', error);
    return NextResponse.json(
      { error: 'Failed to convert RFP to proposal' },
      { status: 500 }
    );
  }
}

// GET /api/os/companies/[companyId]/rfps/[rfpId]/convert-to-proposal
// Check if an RFP can be converted (preview)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, rfpId } = await params;

    if (!companyId || !rfpId) {
      return NextResponse.json(
        { error: 'Company ID and RFP ID are required' },
        { status: 400 }
      );
    }

    // Get the RFP with all details
    const rfpWithDetails = await getRfpWithDetails(rfpId);

    if (!rfpWithDetails) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Verify ownership
    if (rfpWithDetails.rfp.companyId !== companyId) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Check if conversion is possible
    const conversionCheck = canConvertToProposal(rfpWithDetails);

    // Count sections with content
    const sectionsWithContent = rfpWithDetails.sections.filter(
      s => s.contentApproved || s.contentWorking
    ).length;

    return NextResponse.json({
      canConvert: conversionCheck.canConvert,
      reason: conversionCheck.reason,
      warnings: conversionCheck.warnings,
      sectionsWithContent,
      totalSections: rfpWithDetails.sections.length,
      rfpTitle: rfpWithDetails.rfp.title,
      suggestedTitle: `Proposal: ${rfpWithDetails.rfp.title}`,
    });
  } catch (error) {
    console.error('[rfp] convert-to-proposal check error:', error);
    return NextResponse.json(
      { error: 'Failed to check conversion eligibility' },
      { status: 500 }
    );
  }
}
