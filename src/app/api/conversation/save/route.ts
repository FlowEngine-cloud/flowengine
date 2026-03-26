import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { userId, conversationId, messages, metadata = {}, title } = await req.json();

    if (!userId || !conversationId || !messages) {
      return NextResponse.json(
        { error: 'userId, conversationId, and messages are required' },
        { status: 400 }
      );
    }

    // Enforce ownership: authenticated user must match requested userId
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { saveConversation } = await import('@/lib/supabaseConversations');
    const result = await saveConversation(userId, conversationId, messages, metadata, title);

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('API: Error saving conversation:', error);
    return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
  }
}
