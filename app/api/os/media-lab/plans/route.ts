// app/api/os/media-lab/plans/route.ts
// API routes for creating media plans
//
// Handles plan creation from Media Lab wizard with:
// - Objective, budget, and timeframe
// - Channel allocations
// - Status management

import { NextRequest, NextResponse } from 'next/server';
import {
  createMediaPlan,
  createMediaPlanChannel,
  type CreateMediaPlanInput,
} from '@/lib/airtable/mediaLab';
import { getCompanyById } from '@/lib/airtable/companies';

interface CreatePlanRequestBody {
  companyId: string;
  name?: string;
  objective?: string;
  totalBudget?: number;
  timeframeStart?: string;
  timeframeEnd?: string;
  channels?: Array<{
    channel: string;
    budgetAmount?: number;
    budgetPercentage?: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePlanRequestBody;
    const {
      companyId,
      name,
      objective,
      totalBudget,
      timeframeStart,
      timeframeEnd,
      channels,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Map wizard objective to plan objective
    // Note: 'blended' maps to 'installs' as the default outcome objective
    const objectiveMap: Record<string, CreateMediaPlanInput['objective']> = {
      max_installs: 'installs',
      max_calls: 'calls',
      store_traffic: 'store_visits',
      blended: 'installs', // Default to installs for blended goals
    };

    const input: CreateMediaPlanInput = {
      companyId,
      name: name || 'New Media Plan',
      status: 'active',
      objective: objectiveMap[objective || 'blended'] || 'installs',
      totalBudget: totalBudget || 0,
      timeframeStart: timeframeStart || undefined,
      timeframeEnd: timeframeEnd || undefined,
    };

    const plan = await createMediaPlan(input);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Failed to create media plan' },
        { status: 500 }
      );
    }

    // Create channel allocations if provided
    if (channels && channels.length > 0) {
      // Map simplified channel names to MediaChannelKey
      const channelKeyMap: Record<string, string> = {
        search: 'google_search',
        maps: 'google_maps_gbp',
        lsa: 'google_lsas',
        social: 'paid_social_meta',
        display: 'display_retarg',
        radio: 'radio',
        youtube: 'google_youtube',
        email: 'email_marketing',
        affiliate: 'affiliate',
      };

      // Map index to priority
      const priorityByIndex: Record<number, 'core' | 'supporting' | 'experimental'> = {
        0: 'core',
        1: 'core',
        2: 'supporting',
        3: 'supporting',
        4: 'experimental',
      };

      const channelPromises = channels.map((ch, index) =>
        createMediaPlanChannel({
          mediaPlanId: plan.id,
          channel: (channelKeyMap[ch.channel] || ch.channel) as any,
          budgetAmount: ch.budgetAmount,
          budgetSharePct: ch.budgetPercentage,
          priority: priorityByIndex[index] || 'experimental',
        })
      );

      try {
        await Promise.all(channelPromises);
      } catch (channelError) {
        console.warn('[API] Failed to create some plan channels:', channelError);
        // Don't fail the whole request if channels fail
      }
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('[API] Failed to create media plan:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
