// app/api/hive-brain/reason/route.ts
// Hive Brain Reasoning API
//
// Endpoints:
// POST /api/hive-brain/reason - Ask the Hive Brain a question

import { NextRequest, NextResponse } from 'next/server';
import {
  reason,
  askAboutVertical,
  compareVerticals,
  identifyAttentionNeeded,
  getHiveSummary,
} from '@/lib/hiveBrain';
import type { ReasonerQuery } from '@/lib/hiveBrain';
import { getAllCompanies } from '@/lib/airtable/companies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, verticalId, question } = body as {
      action?: 'reason' | 'askVertical' | 'compareVerticals' | 'attentionNeeded' | 'summary';
      query?: ReasonerQuery;
      verticalId?: string;
      question?: string;
    };

    // Get all company IDs for analysis
    const companies = await getAllCompanies();
    const companyIds = companies.map((c) => c.id);

    switch (action) {
      case 'askVertical': {
        if (!verticalId || !question) {
          return NextResponse.json(
            { error: 'verticalId and question required for askVertical' },
            { status: 400 }
          );
        }
        const result = await askAboutVertical(verticalId, question, companyIds);
        return NextResponse.json(result);
      }

      case 'compareVerticals': {
        const result = await compareVerticals(companyIds);
        return NextResponse.json(result);
      }

      case 'attentionNeeded': {
        const result = await identifyAttentionNeeded(companyIds);
        return NextResponse.json(result);
      }

      case 'summary': {
        const result = await getHiveSummary(companyIds);
        return NextResponse.json(result);
      }

      case 'reason':
      default: {
        if (!query?.question) {
          return NextResponse.json(
            { error: 'query.question is required' },
            { status: 400 }
          );
        }
        const result = await reason(query, companyIds);
        return NextResponse.json(result);
      }
    }
  } catch (error) {
    console.error('Hive Brain reason error:', error);
    return NextResponse.json(
      { error: 'Failed to process reasoning request' },
      { status: 500 }
    );
  }
}

