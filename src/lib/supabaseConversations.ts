import { createClient } from '@supabase/supabase-js';

// Create Supabase client that works on both client and server
const createSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }

  // Check if we're on the server side (where service role key is available)
  const isServer = typeof window === 'undefined';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Use service role key on server, anon key on client
  let supabaseKey: string;

  if (isServer && serviceRoleKey) {
    supabaseKey = serviceRoleKey;
    console.log('Using Supabase service role key (server-side)');
  } else if (anonKey) {
    supabaseKey = anonKey;
    console.log('Using Supabase anon key (client-side)');
  } else {
    throw new Error(
      `Supabase key not available. Server: ${isServer}, ServiceKey: ${!!serviceRoleKey}, AnonKey: ${!!anonKey}`
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: !isServer,
      persistSession: !isServer,
    },
  });
};

const supabaseAdmin = createSupabaseClient();

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  workflowData?: any;
  timestamp?: string;
}

export interface ConversationData {
  id: string;
  user_id: string;
  conversation_id: string;
  title?: string;
  messages: Message[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Load a conversation from Supabase
 */
export async function loadConversation(
  userId: string,
  conversationId: string
): Promise<ConversationData | null> {
  try {
    console.log(`Loading conversation ${conversationId} for user ${userId}`);

    // Check if we're on client side and need authentication
    const isClient = typeof window !== 'undefined';
    if (isClient) {
      // On client side, get current session
      const {
        data: { session },
      } = await supabaseAdmin.auth.getSession();
      if (!session) {
        console.log('No active session on client side');
        return null;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - conversation doesn't exist
        console.log(`Conversation ${conversationId} not found`);
        return null;
      }
      throw error;
    }

    console.log(`Loaded conversation with ${data.messages?.length || 0} messages`);
    return data;
  } catch (error) {
    console.error('Error loading conversation:', error);
    return null;
  }
}

/**
 * Save a conversation to Supabase
 */
export async function saveConversation(
  userId: string,
  conversationId: string,
  messages: Message[],
  metadata: Record<string, any> = {},
  title?: string
): Promise<boolean> {
  try {
    console.log(`Saving conversation ${conversationId} with ${messages.length} messages`);

    // Check if we're on client side and need authentication
    const isClient = typeof window !== 'undefined';
    if (isClient) {
      // On client side, get current session
      const {
        data: { session },
      } = await supabaseAdmin.auth.getSession();
      if (!session) {
        console.log('No active session on client side, cannot save');
        return false;
      }
    }

    // Prepare the data
    const conversationData = {
      user_id: userId,
      conversation_id: conversationId,
      title: title || `Chat ${new Date().toLocaleDateString()}`,
      messages: messages,
      metadata: metadata,
      updated_at: new Date().toISOString(),
    };

    // Use upsert with the correct conflict target
    const { error } = await supabaseAdmin.from('conversations').upsert(conversationData, {
      onConflict: 'user_id,conversation_id',
    });

    if (error) {
      throw error;
    }

    console.log(`Successfully saved conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error('Error saving conversation:', error);
    return false;
  }
}

/**
 * Delete a conversation from Supabase
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  try {
    console.log(`Deleting conversation ${conversationId} for user ${userId}`);

    const { error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    console.log(`Successfully deleted conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }
}

/**
 * List all conversations for a user
 */
export async function listConversations(userId: string): Promise<ConversationData[]> {
  try {
    console.log(`Loading conversations for user ${userId}`);

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id, conversation_id, title, messages, metadata, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} conversations`);
    return data || [];
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

/**
 * Get the last workflow data from a conversation
 */
export async function getLastWorkflowData(
  userId: string,
  conversationId: string
): Promise<any | null> {
  try {
    const conversation = await loadConversation(userId, conversationId);
    if (!conversation || !conversation.messages) {
      return null;
    }

    // Find the last message with workflow data
    const lastWorkflowMessage = conversation.messages
      .slice()
      .reverse()
      .find(msg => msg.workflowData?.hasWorkflow);

    return lastWorkflowMessage?.workflowData || null;
  } catch (error) {
    console.error('Error getting last workflow data:', error);
    return null;
  }
}
