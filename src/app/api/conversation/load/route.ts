import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { userId, conversationId } = await request.json();

    if (!userId || !conversationId) {
      return NextResponse.json({ error: 'Missing userId or conversationId' }, { status: 400 });
    }

    console.log(`Loading conversation ${conversationId} for user ${userId}`);

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        console.log(`No conversation found for ${conversationId}`);
        return NextResponse.json({ messages: [] });
      }
      throw error;
    }

    console.log(`Found conversation with ${data.messages?.length || 0} messages`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading conversation:', error);
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
  }
}
