import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { userId, conversationId, messages, metadata = {}, title } = await req.json();

    // Validate required parameters
    if (!userId || !conversationId || !messages) {
      return NextResponse.json(
        { error: 'userId, conversationId, and messages are required' },
        { status: 400 }
      );
    }

    console.log(
      `API: Saving conversation ${conversationId} with ${messages.length} messages for user ${userId}`
    );

    // Use existing supabaseConversations function
    const { saveConversation } = await import('@/lib/supabaseConversations');
    const result = await saveConversation(userId, conversationId, messages, metadata, title);

    if (result) {
      console.log(`API: Successfully saved conversation ${conversationId}`);
    } else {
      console.log(`API: Failed to save conversation ${conversationId}`);
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('API: Error saving conversation:', error);
    return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
  }
}
