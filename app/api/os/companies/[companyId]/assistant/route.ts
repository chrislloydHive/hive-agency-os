// app/api/os/companies/[companyId]/assistant/route.ts
// Company Context Assistant API
//
// POST - Send a message to the assistant
// GET - Get quick actions and context health summary

import { NextRequest, NextResponse } from 'next/server';
import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { loadAssistantContext, formatContextForPrompt } from '@/lib/assistant/contextLoader';
import { getAssistantSystemPrompt, buildTaskPrompt, generateQuickActions, getPageContextHint } from '@/lib/assistant/prompts';
import { storeProposedChanges } from '@/lib/assistant/changeStore';
import type {
  AssistantRequest,
  AssistantResponse,
  AssistantMessage,
  AIResponseParsed,
  PageContextId,
} from '@/lib/assistant/types';
import { AIResponseSchema } from '@/lib/assistant/types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/assistant
 * Send a message to the assistant
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json() as AssistantRequest & { pageContext?: PageContextId };
    const { message, mode = 'chat', conversationHistory, pageContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`[Assistant] Processing message for ${companyId}:`, message.substring(0, 100), { pageContext });

    // Load context
    const context = await loadAssistantContext(companyId);
    if (!context) {
      return NextResponse.json(
        { error: 'Failed to load company context' },
        { status: 404 }
      );
    }

    // Format context for prompt
    const formattedContext = formatContextForPrompt(context);

    // Build prompts with page context hint
    const baseSystemPrompt = getAssistantSystemPrompt(mode);
    const pageHint = pageContext ? getPageContextHint(pageContext) : '';
    const systemPrompt = pageHint
      ? `${baseSystemPrompt}\n\n## Current View\n${pageHint}`
      : baseSystemPrompt;
    const taskPrompt = buildTaskPrompt(message, formattedContext, conversationHistory);

    // Call AI
    const aiResult = await aiForCompany(companyId, {
      type: 'company_assistant',
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.4,
      jsonMode: true,
      maxTokens: 4000,
      tags: ['assistant', mode],
      memoryOptions: {
        limit: 10,
        types: ['company_assistant', 'Strategy', 'GAP Full'],
      },
    });

    // Parse AI response
    let parsed: AIResponseParsed;
    try {
      const rawParsed = JSON.parse(aiResult.content);
      parsed = AIResponseSchema.parse(rawParsed);
    } catch (parseError) {
      console.error('[Assistant] Failed to parse AI response:', parseError);
      // Return plain text response if JSON parsing fails
      const response: AssistantResponse = {
        messages: [{
          type: 'assistant',
          content: aiResult.content || 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date().toISOString(),
        }],
        contextHealth: {
          score: context.contextHealth.score,
          status: context.contextHealth.status,
        },
      };
      return NextResponse.json(response);
    }

    // Build response
    const messages: AssistantMessage[] = [{
      type: 'assistant',
      content: parsed.response,
      timestamp: new Date().toISOString(),
    }];

    const response: AssistantResponse = {
      messages,
      contextHealth: {
        score: context.contextHealth.score,
        status: context.contextHealth.status,
      },
    };

    // If there are proposed changes, store them and include token
    if (parsed.proposedChanges &&
        (parsed.proposedChanges.contextUpdates?.length ||
         parsed.proposedChanges.workItems?.length ||
         parsed.proposedChanges.actions?.length)) {

      // Add old values to context updates for display
      if (parsed.proposedChanges.contextUpdates) {
        parsed.proposedChanges.contextUpdates = parsed.proposedChanges.contextUpdates.map(update => {
          const [domain, fieldName] = update.path.split('.');
          const domainData = context.contextGraph.domains[domain];
          const fieldData = domainData?.fields[fieldName];
          return {
            ...update,
            oldValue: fieldData?.value ?? null,
          };
        });
      }

      const proposedChanges = parsed.proposedChanges as import('@/lib/assistant/types').ProposedChanges;
      const changeToken = storeProposedChanges(companyId, proposedChanges);
      response.proposedChanges = proposedChanges;
      response.changeToken = changeToken;
    }

    console.log(`[Assistant] Response generated for ${companyId}`, {
      hasChanges: !!response.proposedChanges,
      contextUpdates: response.proposedChanges?.contextUpdates?.length || 0,
      workItems: response.proposedChanges?.workItems?.length || 0,
      actions: response.proposedChanges?.actions?.length || 0,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Assistant] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/os/companies/[companyId]/assistant
 * Get quick actions and context summary
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Load context
    const context = await loadAssistantContext(companyId);
    if (!context) {
      return NextResponse.json(
        { error: 'Failed to load company context' },
        { status: 404 }
      );
    }

    // Generate quick actions based on context
    const quickActions = generateQuickActions({
      missingCritical: context.contextHealth.missingCritical,
      weakSections: context.contextHealth.weakSections,
      healthScore: context.contextHealth.score,
    });

    return NextResponse.json({
      company: {
        id: context.company.id,
        name: context.company.name,
      },
      contextHealth: context.contextHealth,
      quickActions,
      recentInsightsCount: context.insights?.length || 0,
      openWorkItemsCount: context.workItems?.length || 0,
    });
  } catch (error) {
    console.error('[Assistant] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to load assistant context' },
      { status: 500 }
    );
  }
}
