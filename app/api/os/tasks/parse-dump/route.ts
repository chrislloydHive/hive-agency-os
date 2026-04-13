// app/api/os/tasks/parse-dump/route.ts
// AI-powered brain dump parser — takes raw text (pasted emails, voice notes,
// rambling thoughts) and returns a structured task object.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a task parser for a digital agency owner named Chris Lloyd who runs Hive Ad Agency.

Parse the following brain dump text into a structured task. The text could be a pasted email, a quick thought, a voice note transcription, or anything else.

Brain dump text:
"""
${text}
"""

Return a JSON object with these fields:
- "task": A concise task title (max 60 chars). If it's an email, summarize what Chris needs to do (e.g., "Upload tax docs to TaxCaddy", "Reply to Jim re: geofence data")
- "from": The person this task relates to (their name). If from an email, use the sender's name. If unclear, use "Chris Lloyd"
- "project": Best guess at project category. Common ones: "Car Toys 2026 Media", "Car Toys Tint", "Car Toys / Billing", "HEY / Eric Request", "Hive Admin", "Hive Billing", "Legal", "Portage Bank". If unsure, leave empty string.
- "nextAction": 1-2 sentence description of the specific next step Chris should take
- "priority": P0 (due today/blocking), P1 (due this week/important), P2 (next week/normal), P3 (backlog/low)
- "due": Suggested due date in YYYY-MM-DD format based on any deadlines mentioned, or empty string if none
- "status": "Inbox" for new items that need triage, "Next" if the action is clear and ready to do

Return ONLY the JSON object, no markdown formatting or explanation.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    // Parse the JSON response, handling potential markdown wrapping
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    return NextResponse.json({ parsed });
  } catch (error) {
    console.error('[Parse Dump API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse brain dump' },
      { status: 500 }
    );
  }
}
