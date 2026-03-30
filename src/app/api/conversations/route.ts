import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { action, userId, conversationId, messages, metadata, title } = await req.json();

    console.log(
      `🗄️ Conversations API: ${action} for user ${userId}, conversation ${conversationId}`
    );

    // SECURITY: Validate that the requesting user matches the userId in the request
    const supabase = createServerClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return (await cookies()).get(name)?.value;
          },
          async set() {},
          async remove() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Conversations API: Authentication required');
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Verify the userId in the request matches the authenticated user
    if (user.id !== userId) {
      console.error(`❌ Conversations API: User ID mismatch. Auth: ${user.id}, Request: ${userId}`);
      return NextResponse.json(
        { error: 'Unauthorized access', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    if (action === 'save') {
      const conversationData = {
        user_id: userId,
        conversation_id: conversationId,
        title: title || `Chat ${new Date().toLocaleDateString()}`,
        messages: messages,
        metadata: metadata || {},
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin.from('conversations').upsert(conversationData, {
        onConflict: 'user_id,conversation_id',
      });

      if (error) {
        console.error('❌ Supabase save error:', error);
        throw error;
      }

      console.log(
        `✅ Successfully saved conversation ${conversationId} with ${messages.length} messages`
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'load') {
      console.log(`🔍 [FlowEngine API] Loading conversation ${conversationId} for user ${userId}`);

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ [FlowEngine API] Supabase load error:', error);
        throw error;
      }

      if (data) {
        console.log(
          `📥 [FlowEngine API] Found conversation ${conversationId}: ${data.messages?.length || 0} messages, title: "${data.title}"`
        );
      } else {
        console.log(`📭 [FlowEngine API] No conversation found for ID ${conversationId}`);

        // Let's also check how many conversations this user has total
        const { data: allConversations } = await supabaseAdmin
          .from('conversations')
          .select('conversation_id, title, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(10);

        console.log(
          `📊 [FlowEngine API] User ${userId} has ${allConversations?.length || 0} total conversations:`
        );
        allConversations?.forEach(conv => {
          console.log(
            `  - ID: ${conv.conversation_id}, Title: "${conv.title}", Updated: ${conv.updated_at}`
          );
        });
      }

      return NextResponse.json({ data: data || null });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Supabase delete error:', error);
        throw error;
      }

      console.log(`🗑️ Successfully deleted conversation ${conversationId}`);
      return NextResponse.json({ success: true });
    }

    if (action === 'list') {
      console.log(`📋 [FlowEngine API] Listing conversations for user ${userId}`);

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase list error:', error);
        throw error;
      }

      console.log(`📋 [FlowEngine API] Listed ${data?.length || 0} conversations for user ${userId}`);
      return NextResponse.json({ data: data || [] });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('❌ Conversations API error:', error);

    // Improved error handling for different error types
    let errorMessage = 'Internal server error';
    let errorCode = 'SERVER_ERROR';
    let statusCode = 500;

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('fetch failed') || error.message.includes('network')) {
        errorMessage = 'Network connection error - please try again later';
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out - please try again later';
        errorCode = 'TIMEOUT_ERROR';
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      // Log detailed error for debugging without sending to client
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause,
      });
    }

    // Return a sanitized error response without exposing internal details
    return NextResponse.json(
      {
        error: errorMessage,
        code: errorCode,
      },
      { status: statusCode }
    );
  }
}
