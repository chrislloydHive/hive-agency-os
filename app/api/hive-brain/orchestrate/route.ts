// app/api/hive-brain/orchestrate/route.ts
// Hive Brain Orchestration API
//
// Endpoints:
// POST /api/hive-brain/orchestrate - Create and run an orchestration

import { NextRequest, NextResponse } from 'next/server';
import {
  createOrchestration,
  runOrchestration,
  listAgents,
  findAgentsForTask,
} from '@/lib/hiveBrain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, goal, companyIds, context, taskType, initiatedBy } = body as {
      action?: 'create' | 'run' | 'listAgents' | 'findAgents';
      goal?: string;
      companyIds?: string[];
      context?: Record<string, unknown>;
      taskType?: string;
      initiatedBy?: string;
    };

    switch (action) {
      case 'listAgents': {
        const agents = listAgents();
        return NextResponse.json({ agents });
      }

      case 'findAgents': {
        if (!taskType) {
          return NextResponse.json(
            { error: 'taskType required for findAgents' },
            { status: 400 }
          );
        }
        const agents = findAgentsForTask(taskType);
        return NextResponse.json({ agents });
      }

      case 'run': {
        if (!goal || !companyIds?.length) {
          return NextResponse.json(
            { error: 'goal and companyIds required for run' },
            { status: 400 }
          );
        }

        // Create and immediately run the orchestration
        const orchestration = createOrchestration(
          goal,
          'human',
          companyIds,
          context,
          initiatedBy
        );

        const result = await runOrchestration(orchestration);
        return NextResponse.json(result);
      }

      case 'create':
      default: {
        if (!goal || !companyIds?.length) {
          return NextResponse.json(
            { error: 'goal and companyIds required' },
            { status: 400 }
          );
        }

        // Create orchestration without running
        const orchestration = createOrchestration(
          goal,
          'human',
          companyIds,
          context,
          initiatedBy
        );

        return NextResponse.json(orchestration);
      }
    }
  } catch (error) {
    console.error('Hive Brain orchestration error:', error);
    return NextResponse.json(
      { error: 'Failed to process orchestration request' },
      { status: 500 }
    );
  }
}
