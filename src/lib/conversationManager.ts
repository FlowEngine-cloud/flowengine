import { Message, ConversationData } from './supabaseConversations';

export interface ConversationItem {
  id: string;
  title: string;
  lastUpdated?: string;
  messageCount?: number;
}

export interface SyncMetadata {
  lastFullSync: string;
  lastPartialSync: string;
  syncInProgress: boolean;
  failedSyncs: string[];
}

export interface ConversationManagerConfig {
  userId: string;
  syncInterval?: number; // milliseconds, default 5 minutes
  maxRetries?: number;
  enablePeriodicSync?: boolean;
}

interface SupabaseConversationResponse {
  conversation_id: string;
  title?: string;
  updated_at?: string;
  messages?: Message[];
}

/**
 * Unified conversation manager that handles:
 * - Individual conversation storage in localStorage with unique keys
 * - Periodic sync with Supabase
 * - Instant loading from localStorage
 * - Conflict resolution and background sync
 */
export class ConversationManager {
  private userId: string;
  private syncInterval: number;
  private maxRetries: number;
  private enablePeriodicSync: boolean;
  private syncTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;
  private isSyncing = false;
  private syncEnabled = true;
  private localOnlyMode = false;
  private readonly storagePrefix = 'flowengine_conv_';

  // Storage keys
  private get conversationListKey() {
    return `${this.storagePrefix}conversations_${this.userId}`;
  }

  private get syncMetadataKey() {
    return `${this.storagePrefix}sync_metadata_${this.userId}`;
  }

  private getConversationKey(conversationId: string) {
    return `flowengine_conversation_${this.userId}_${conversationId}`;
  }

  private syncQueue = new Map<string, 'save' | 'delete'>();
  private debounceTimer: NodeJS.Timeout | null = null;

  // Track deleted conversation IDs to prevent re-sync from Supabase
  private get deletedConversationsKey() {
    return `${this.storagePrefix}deleted_${this.userId}`;
  }

  private getDeletedConversationIds(): Set<string> {
    try {
      const stored = localStorage.getItem(this.deletedConversationsKey);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading deleted conversation IDs:', error);
    }
    return new Set();
  }

  private addDeletedConversationId(conversationId: string): void {
    const deleted = this.getDeletedConversationIds();
    deleted.add(conversationId);
    localStorage.setItem(this.deletedConversationsKey, JSON.stringify(Array.from(deleted)));
  }

  private removeDeletedConversationId(conversationId: string): void {
    const deleted = this.getDeletedConversationIds();
    deleted.delete(conversationId);
    localStorage.setItem(this.deletedConversationsKey, JSON.stringify(Array.from(deleted)));
  }

  /**
   * Check if Supabase environment variables are properly configured
   */
  private isSupabaseConfigured(): boolean {
    if (typeof window === 'undefined') return true; // Server-side, assume configured

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!supabaseUrl && supabaseUrl.length > 10 && supabaseUrl !== 'your_supabase_url';
  }

  constructor(config: ConversationManagerConfig) {
    this.userId = config.userId;
    this.syncInterval = config.syncInterval || 60000; // Default to 60 seconds
    this.maxRetries = config.maxRetries || 3;
    this.enablePeriodicSync = config.enablePeriodicSync !== false;

    // Check if we should operate in local-only mode
    this.localOnlyMode =
      !this.isSupabaseConfigured() ||
      (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_ENABLE_SYNC);

    if (this.localOnlyMode) {
      console.log('🔄 ConversationManager operating in local-only mode (Supabase sync disabled)');
    }

    // Initialize window listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.triggerSync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      // Start sync timer if enabled and not in local-only mode
      if (this.enablePeriodicSync && !this.localOnlyMode) {
        this.startPeriodicSync();
      }
    }
  }

  /**
   * Get conversations instantly from localStorage
   */
  getConversationsInstant(): ConversationItem[] {
    try {
      const stored = localStorage.getItem(this.conversationListKey);
      if (stored) {
        const conversations: ConversationItem[] = JSON.parse(stored);
        console.log(`📱 Loaded ${conversations.length} conversations instantly from localStorage`);
        // Return conversations in their stored order (already sorted by last interaction)
        return conversations;
      }
    } catch (error) {
      console.error('Error loading conversations from localStorage:', error);
    }
    return [];
  }

  /**
   * Get a specific conversation instantly from localStorage
   */
  getConversationInstant(conversationId: string): ConversationData | null {
    try {
      const stored = localStorage.getItem(this.getConversationKey(conversationId));
      if (stored) {
        const conversation: ConversationData = JSON.parse(stored);
        console.log(
          `📱 Loaded conversation ${conversationId} instantly from localStorage (${conversation.messages?.length || 0} messages)`
        );
        return conversation;
      }
    } catch (error) {
      console.error(`Error loading conversation ${conversationId} from localStorage:`, error);
    }
    return null;
  }

  /**
   * Save conversation to localStorage immediately
   */
  saveConversationInstant(
    conversationId: string,
    messages: Message[],
    metadata: Record<string, unknown> = {},
    title?: string
  ): void {
    try {
      const conversationData: ConversationData = {
        id: crypto.randomUUID(),
        user_id: this.userId,
        conversation_id: conversationId,
        title: title || `Chat ${new Date().toLocaleDateString()}`,
        messages,
        metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save individual conversation
      localStorage.setItem(
        this.getConversationKey(conversationId),
        JSON.stringify(conversationData)
      );

      // Update conversation list
      this.updateConversationList(
        conversationId,
        conversationData.title || 'Untitled Chat',
        messages.length
      );

      console.log(`💾 Saved conversation ${conversationId} instantly to localStorage`);

      // Trigger background sync
      this.scheduleSync(conversationId);
    } catch (error) {
      console.error('Error saving conversation to localStorage:', error);
    }
  }

  /**
   * Update the conversation list in localStorage
   */
  private updateConversationList(
    conversationId: string,
    title: string,
    messageCount: number
  ): void {
    try {
      const conversations = this.getConversationsInstant();
      const existingIndex = conversations.findIndex(c => c.id === conversationId);

      // Preserve existing title if new title is 'New Chat' and existing title is different
      const existingTitle = existingIndex >= 0 ? conversations[existingIndex].title : null;
      const finalTitle = (title === 'New Chat' && existingTitle && existingTitle !== 'New Chat')
        ? existingTitle
        : title;

      const updatedConversation: ConversationItem = {
        id: conversationId,
        title: finalTitle,
        lastUpdated: new Date().toISOString(),
        messageCount,
      };

      if (existingIndex >= 0) {
        conversations[existingIndex] = updatedConversation;
      } else {
        conversations.unshift(updatedConversation);
      }

      localStorage.setItem(this.conversationListKey, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error updating conversation list:', error);
    }
  }

  /**
   * Rename a conversation (just updates the title in the list, doesn't require full conversation data)
   */
  renameConversation(conversationId: string, title: string): void {
    try {
      const conversations = this.getConversationsInstant();
      const existingIndex = conversations.findIndex(c => c.id === conversationId);

      if (existingIndex >= 0) {
        // Update existing conversation title
        conversations[existingIndex] = {
          ...conversations[existingIndex],
          title,
          lastUpdated: new Date().toISOString(),
        };
      } else {
        // Conversation not in list yet - add it
        conversations.unshift({
          id: conversationId,
          title,
          lastUpdated: new Date().toISOString(),
          messageCount: 0,
        });
      }

      localStorage.setItem(this.conversationListKey, JSON.stringify(conversations));
      console.log(`✏️ Renamed conversation ${conversationId} to "${title}"`);
    } catch (error) {
      console.error('Error renaming conversation:', error);
    }
  }

  /**
   * Delete conversation from localStorage
   */
  deleteConversationInstant(conversationId: string): void {
    try {
      // Remove individual conversation
      localStorage.removeItem(this.getConversationKey(conversationId));

      // Update conversation list
      const conversations = this.getConversationsInstant();
      const filtered = conversations.filter(c => c.id !== conversationId);
      localStorage.setItem(this.conversationListKey, JSON.stringify(filtered));

      // Track this as deleted to prevent re-sync from Supabase
      this.addDeletedConversationId(conversationId);

      console.log(`🗑️ Deleted conversation ${conversationId} from localStorage`);

      // Trigger background sync to delete from Supabase
      this.scheduleSync(conversationId, 'delete');
    } catch (error) {
      console.error('Error deleting conversation from localStorage:', error);
    }
  }

  /**
   * Start periodic background sync
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      console.log(`⏰ Periodic sync triggered - online: ${this.isOnline}`);
      if (this.isOnline) {
        this.performFullSync();
      } else {
        console.log(`📴 Skipping sync - device offline`);
      }
    }, this.syncInterval);

    console.log(
      `🔄 Started periodic sync every ${this.syncInterval / 1000} seconds for user ${this.userId}`
    );
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Schedule a sync for a specific conversation
   */
  private scheduleSync(conversationId: string, action: 'save' | 'delete' = 'save'): void {
    console.log(`📤 Scheduling sync for conversation ${conversationId} with action: ${action}`);

    if (!this.isOnline) {
      console.log(`📴 Offline - scheduled sync for conversation ${conversationId} when online`);
      this.syncQueue.set(conversationId, action);
      return;
    }

    this.syncQueue.set(conversationId, action);
    console.log(`📋 Sync queue now has ${this.syncQueue.size} items`);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      console.log(`🚀 Processing sync queue with ${this.syncQueue.size} items after debounce`);
      this.processSyncQueue();
    }, 2000); // Debounce for 2 seconds
  }

  private async processSyncQueue(): Promise<void> {
    // Skip processing if we're in local-only mode
    if (this.localOnlyMode) {
      if (this.syncQueue.size > 0) {
        console.log(
          `🔄 Skipping sync queue processing (${this.syncQueue.size} items) - local-only mode active`
        );
        this.syncQueue.clear(); // Clear queue since we won't sync
      }
      return;
    }

    if (this.isSyncing || !this.isOnline || !this.syncQueue.size) {
      return;
    }

    this.isSyncing = true;

    try {
      // Create a snapshot of the queue
      const queueSnapshot = new Map(this.syncQueue);

      // Clear the queue immediately to prevent duplicate processing
      this.syncQueue.clear();

      const entries = Array.from(queueSnapshot.entries());
      console.log(`🔄 Processing sync queue with ${entries.length} items`);

      // Process each item
      for (const [conversationId, action] of entries) {
        try {
          if (action === 'delete') {
            await this.deleteConversationFromSupabase(conversationId);
          } else {
            await this.syncConversationToSupabase(conversationId);
          }
        } catch (error) {
          console.error(`❌ Failed to process queue item ${conversationId}:`, error);
          // Re-queue failed items
          this.syncQueue.set(conversationId, action);
        }
      }
    } catch (error) {
      console.error('❌ Error processing sync queue:', error);
    } finally {
      this.isSyncing = false;

      // Check if more items were added during processing
      if (this.syncQueue.size > 0) {
        console.log(`🔄 Found ${this.syncQueue.size} more items to sync, processing again...`);
        await this.processSyncQueue();
      }
    }
  }

  /**
   * Trigger immediate sync
   */
  async triggerSync(): Promise<void> {
    if (!this.isOnline) {
      console.log('📴 Cannot sync while offline');
      return;
    }

    if (this.localOnlyMode) {
      console.log(`🔄 Skipping sync - local-only mode active`);
      return;
    }

    await this.performFullSync();
  }

  /**
   * Perform full sync between localStorage and Supabase
   */
  private async performFullSync(): Promise<void> {
    try {
      console.log('🔄 Starting full sync with Supabase...');

      if (this.localOnlyMode) {
        console.log(`🔄 Skipping full sync - local-only mode active`);
        return;
      }

      const syncMetadata = this.getSyncMetadata();
      syncMetadata.syncInProgress = true;
      this.saveSyncMetadata(syncMetadata);

      // Get conversations from both sources
      const localConversations = this.getConversationsInstant();
      console.log(`📱 Local conversations: ${localConversations.length}`);

      const supabaseConversations = await this.fetchConversationsFromSupabase();
      console.log(`☁️ Supabase conversations: ${supabaseConversations.length}`);

      // Merge and resolve conflicts
      const mergedConversations = await this.mergeConversations(
        localConversations,
        supabaseConversations
      );
      console.log(`🔗 Merged conversations: ${mergedConversations.length}`);

      // Update localStorage with merged data
      if (mergedConversations.length > 0) {
        localStorage.setItem(this.conversationListKey, JSON.stringify(mergedConversations));
        console.log(
          `✅ Full sync completed - merged ${mergedConversations.length} conversations to localStorage`
        );
      } else {
        console.log(`⚠️ No conversations to save after merge`);
      }

      // Update sync metadata
      syncMetadata.lastFullSync = new Date().toISOString();
      syncMetadata.syncInProgress = false;
      syncMetadata.failedSyncs = [];
      this.saveSyncMetadata(syncMetadata);
    } catch (error) {
      console.error('❌ Full sync failed:', error);

      // Update sync metadata with error
      const syncMetadata = this.getSyncMetadata();
      syncMetadata.syncInProgress = false;
      syncMetadata.failedSyncs.push(new Date().toISOString());
      this.saveSyncMetadata(syncMetadata);
    }
  }

  /**
   * Sync a specific conversation to Supabase
   */
  private async syncConversationToSupabase(conversationId: string): Promise<void> {
    try {
      const conversation = this.getConversationInstant(conversationId);
      if (!conversation) {
        console.warn(`No local conversation found for ${conversationId}`);
        return;
      }

      // Validate data before sending to prevent malformed requests
      if (!conversation.conversation_id || !this.userId) {
        console.warn(
          `Missing critical data for sync: userId=${this.userId}, conversationId=${conversation.conversation_id}`
        );
        return;
      }

      // Use a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add cache-busting parameter to prevent stale responses
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            action: 'save',
            userId: this.userId,
            conversationId: conversation.conversation_id,
            messages: conversation.messages || [],
            metadata: conversation.metadata || {},
            title: conversation.title || 'Untitled Chat',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ Synced conversation ${conversationId} to Supabase`);
        } else {
          const errorText = await response.text().catch(() => 'Could not read response');
          if (response.status >= 500) {
            console.warn(
              `⚠️ Server error during sync (${response.status}): ${response.statusText} - Will retry later`
            );
            console.warn(`Error details: ${errorText.substring(0, 200)}...`);
            // Requeue for later retry
            this.scheduleSync(conversationId, 'save');
          } else {
            console.error(
              `❌ Client error during sync (${response.status}): ${errorText.substring(0, 200)}...`
            );
          }
        }
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        // Handle network errors and aborts specially
        if (
          fetchError &&
          typeof fetchError === 'object' &&
          'name' in fetchError &&
          fetchError.name === 'AbortError'
        ) {
          console.warn(`⏱️ Request timeout for conversation ${conversationId} - Will retry later`);
        } else {
          console.error(
            `🌐 Network error while syncing conversation ${conversationId}:`,
            fetchError
          );
        }
        // Always requeue network errors for later retry
        this.scheduleSync(conversationId, 'save');
      }
    } catch (error) {
      console.error(`❌ Failed to sync conversation ${conversationId} to Supabase:`, error);
    }
  }

  /**
   * Delete conversation from Supabase
   */
  private async deleteConversationFromSupabase(conversationId: string): Promise<void> {
    // Validate data before sending to prevent malformed requests
    if (!conversationId || !this.userId) {
      console.warn(
        `Missing critical data for delete: userId=${this.userId}, conversationId=${conversationId}`
      );
      return;
    }

    try {
      // Use a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            action: 'delete',
            userId: this.userId,
            conversationId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ Deleted conversation ${conversationId} from Supabase`);
          // Remove from deleted tracking since Supabase is now in sync
          this.removeDeletedConversationId(conversationId);
        } else {
          const errorText = await response.text().catch(() => 'Could not read response');
          if (response.status >= 500) {
            console.warn(
              `⚠️ Server error during delete (${response.status}): ${response.statusText} - Will retry later`
            );
            console.warn(`Error details: ${errorText.substring(0, 200)}...`);
            // Requeue for later retry
            this.scheduleSync(conversationId, 'delete');
          } else {
            console.error(
              `❌ Client error during delete (${response.status}): ${errorText.substring(0, 200)}...`
            );
          }
        }
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        // Handle network errors and aborts specially
        if (
          fetchError &&
          typeof fetchError === 'object' &&
          'name' in fetchError &&
          fetchError.name === 'AbortError'
        ) {
          console.warn(
            `⏱️ Request timeout for deleting conversation ${conversationId} - Will retry later`
          );
        } else {
          console.error(
            `🌐 Network error while deleting conversation ${conversationId}:`,
            fetchError
          );
        }
        // Always requeue network errors for later retry
        this.scheduleSync(conversationId, 'delete');
      }
    } catch (error) {
      console.error(`❌ Failed to delete conversation ${conversationId} from Supabase:`, error);
    }
  }

  /**
   * Fetch conversations from Supabase
   */
  private async fetchConversationsFromSupabase(): Promise<ConversationItem[]> {
    try {
      // Skip sync in local-only mode
      if (this.localOnlyMode) {
        console.log(`🚫 Skipping Supabase fetch - local-only mode active`);
        return [];
      }

      if (!this.userId) {
        console.warn('Missing userId for fetching conversations');
        return [];
      }

      console.log(`🔍 Fetching conversations from Supabase for user: ${this.userId}`);

      // Use a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for list operation

      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            action: 'list',
            userId: this.userId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`📡 API response status: ${response.status}`);

        if (response.ok) {
          const result = await response.json();
          console.log(`📊 API response:`, result);

          const data = result.data || [];
          const conversations = data.map((conv: SupabaseConversationResponse) => ({
            id: conv.conversation_id,
            title: conv.title || 'Untitled Chat',
            lastUpdated: conv.updated_at,
            messageCount: conv.messages?.length || 0,
          }));

          console.log(`✅ Mapped ${conversations.length} conversations from Supabase`);
          return conversations;
        } else {
          // Handle different error types more gracefully
          const errorText = await response.text().catch(() => 'Could not read response');
          if (response.status >= 500) {
            console.error(
              `❌ Server error ${response.status}: ${response.statusText} - Continuing with local data only`
            );
            console.warn(`Error details: ${errorText.substring(0, 200)}...`);
            // Enable local-only mode when we detect Supabase errors
            this.localOnlyMode = true;
            console.log(`🚫 Switching to local-only mode due to server errors`);
          } else {
            const truncatedError =
              errorText.length > 200 ? errorText.slice(0, 200) + '...' : errorText;
            console.error(`❌ API error ${response.status}:`, truncatedError);
          }
        }
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        // Handle network errors and aborts specially
        if (
          fetchError &&
          typeof fetchError === 'object' &&
          'name' in fetchError &&
          fetchError.name === 'AbortError'
        ) {
          console.warn(`⏱️ Request timeout while fetching conversations - using local data`);
        } else {
          console.error(`🌐 Network error while fetching conversations:`, fetchError);
          // Enable local-only mode when we detect network errors
          this.localOnlyMode = true;
          console.log(`🚫 Switching to local-only mode due to network errors`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch conversations from Supabase:', error);
      // Enable local-only mode when we detect general errors
      this.localOnlyMode = true;
      console.log(`🚫 Switching to local-only mode due to general errors`);
    }
    return [];
  }

  /**
   * Merge conversations from localStorage and Supabase
   */
  private async mergeConversations(
    localConversations: ConversationItem[],
    supabaseConversations: ConversationItem[]
  ): Promise<ConversationItem[]> {
    const merged = new Map<string, ConversationItem>();

    // Get list of locally deleted conversations to prevent re-sync
    const deletedIds = this.getDeletedConversationIds();
    if (deletedIds.size > 0) {
      console.log(`🗑️ Excluding ${deletedIds.size} deleted conversations from merge`);
    }

    // Add all local conversations
    localConversations.forEach(conv => {
      merged.set(conv.id, conv);
    });

    // Merge Supabase conversations (Supabase wins for conflicts based on timestamp)
    for (const supabaseConv of supabaseConversations) {
      // Skip conversations that were deleted locally but not yet synced to Supabase
      if (deletedIds.has(supabaseConv.id)) {
        console.log(`⏭️ Skipping deleted conversation ${supabaseConv.id} during merge`);
        continue;
      }

      const localConv = merged.get(supabaseConv.id);

      if (!localConv) {
        // New conversation from Supabase - fetch full data
        const fullConversation = await this.fetchFullConversationFromSupabase(supabaseConv.id);
        if (fullConversation) {
          localStorage.setItem(
            this.getConversationKey(supabaseConv.id),
            JSON.stringify(fullConversation)
          );
        }
        merged.set(supabaseConv.id, supabaseConv);
      } else {
        // Conflict resolution - use newer timestamp
        const localTime = new Date(localConv.lastUpdated || '').getTime();
        const supabaseTime = new Date(supabaseConv.lastUpdated || '').getTime();

        if (supabaseTime > localTime) {
          // Supabase is newer - fetch and update local
          const fullConversation = await this.fetchFullConversationFromSupabase(supabaseConv.id);
          if (fullConversation) {
            localStorage.setItem(
              this.getConversationKey(supabaseConv.id),
              JSON.stringify(fullConversation)
            );
          }
          merged.set(supabaseConv.id, supabaseConv);
        }
        // else: local is newer or same, keep local version
      }
    }

    // Preserve local order, append new items from Supabase at the end
    const result: ConversationItem[] = [];
    const addedIds = new Set<string>();

    // First add local conversations in their original order
    for (const conv of localConversations) {
      const mergedConv = merged.get(conv.id);
      if (mergedConv) {
        result.push(mergedConv);
        addedIds.add(conv.id);
      }
    }

    // Then append any new conversations from Supabase
    for (const conv of supabaseConversations) {
      if (!addedIds.has(conv.id) && !deletedIds.has(conv.id)) {
        const mergedConv = merged.get(conv.id);
        if (mergedConv) {
          result.push(mergedConv);
        }
      }
    }

    return result;
  }

  /**
   * Fetch full conversation data from Supabase
   */
  private async fetchFullConversationFromSupabase(
    conversationId: string
  ): Promise<ConversationData | null> {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load',
          userId: this.userId,
          conversationId,
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        return data;
      }
    } catch (error) {
      console.error(`❌ Failed to fetch conversation ${conversationId} from Supabase:`, error);
    }
    return null;
  }

  /**
   * Get sync metadata
   */
  private getSyncMetadata(): SyncMetadata {
    try {
      const stored = localStorage.getItem(this.syncMetadataKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading sync metadata:', error);
    }

    return {
      lastFullSync: '',
      lastPartialSync: '',
      syncInProgress: false,
      failedSyncs: [],
    };
  }

  /**
   * Save sync metadata
   */
  private saveSyncMetadata(metadata: SyncMetadata): void {
    try {
      localStorage.setItem(this.syncMetadataKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving sync metadata:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isOnline: boolean;
    lastSync: string;
    syncInProgress: boolean;
    hasFailedSyncs: boolean;
  } {
    const metadata = this.getSyncMetadata();
    return {
      isOnline: this.isOnline,
      lastSync: metadata.lastFullSync,
      syncInProgress: metadata.syncInProgress,
      hasFailedSyncs: metadata.failedSyncs.length > 0,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicSync();

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.triggerSync);
      window.removeEventListener('offline', () => (this.isOnline = false));
    }
  }
}
