import { supabase, getCurrentProfile, isSupabaseConfigured } from '../lib/supabase';
import type {
  Conversation,
  ConversationInsert,
  ConversationTopic,
  ConversationWithMessages,
  Message,
  MessageInsert,
  Profile,
} from '../types/supabase';

/**
 * Supabase Service
 * Handles all database operations for conversations and messages
 */

// ============================================
// CONVERSATIONS
// ============================================

/**
 * Get all conversations for the current user's workspace
 * Grouped by topic and sorted by updated_at desc
 */
export async function getConversations(): Promise<Conversation[]> {
  if (!isSupabaseConfigured()) return [];

  const profile = await getCurrentProfile();
  if (!profile?.workspace_id) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('workspace_id', profile.workspace_id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get conversations grouped by topic
 */
export async function getConversationsByTopic(): Promise<Record<ConversationTopic, Conversation[]>> {
  const conversations = await getConversations();

  const grouped: Record<ConversationTopic, Conversation[]> = {
    project: [],
    status: [],
    timelog: [],
    general: [],
  };

  for (const conv of conversations) {
    if (conv.topic && grouped[conv.topic]) {
      grouped[conv.topic].push(conv);
    }
  }

  return grouped;
}

/**
 * Get a single conversation with all its messages
 */
export async function getConversationWithMessages(
  conversationId: string
): Promise<ConversationWithMessages | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError) {
    console.error('Error fetching conversation:', convError);
    return null;
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('Error fetching messages:', msgError);
    return null;
  }

  return {
    ...conversation,
    messages: messages || [],
  };
}

/**
 * Create a new conversation
 */
export async function createConversation(
  topic: ConversationTopic,
  projectId?: string,
  title?: string
): Promise<Conversation | null> {
  if (!isSupabaseConfigured()) return null;

  const profile = await getCurrentProfile();
  if (!profile?.workspace_id) {
    console.error('No workspace found for current user');
    return null;
  }

  const newConversation: ConversationInsert = {
    workspace_id: profile.workspace_id,
    user_id: profile.id,
    topic,
    project_id: projectId || null,
    title: title || null,
  };

  const { data, error } = await supabase
    .from('conversations')
    .insert(newConversation)
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return data;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating conversation title:', error);
    return false;
  }

  return true;
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }

  return true;
}

// ============================================
// MESSAGES
// ============================================

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  displayData?: Record<string, unknown>
): Promise<Message | null> {
  if (!isSupabaseConfigured()) return null;

  const newMessage: MessageInsert = {
    conversation_id: conversationId,
    role,
    content,
    display_data: displayData || null,
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(newMessage)
    .select()
    .single();

  if (error) {
    console.error('Error adding message:', error);
    return null;
  }

  return data;
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

// ============================================
// SEARCH
// ============================================

/**
 * Search conversations by text
 * Uses PostgreSQL full-text search
 */
export async function searchConversations(query: string): Promise<Conversation[]> {
  if (!isSupabaseConfigured()) return [];
  if (!query.trim()) return [];

  const profile = await getCurrentProfile();
  if (!profile?.workspace_id) return [];

  const { data, error } = await supabase.rpc('search_conversations', {
    search_query: query,
    user_workspace_id: profile.workspace_id,
  });

  if (error) {
    console.error('Error searching conversations:', error);
    return [];
  }

  // Transform RPC result to Conversation type
  return (data || []).map((result: { conversation_id: string; title: string; topic: string; created_at: string; updated_at: string }) => ({
    id: result.conversation_id,
    title: result.title,
    topic: result.topic as ConversationTopic,
    created_at: result.created_at,
    updated_at: result.updated_at,
    workspace_id: profile.workspace_id,
    user_id: profile.id,
    project_id: null,
    search_vector: null,
  }));
}

// ============================================
// AUTO-TITLE GENERATION
// ============================================

/**
 * Generate a title for a conversation from the first message
 * Uses Claude API to summarize
 */
export async function generateConversationTitle(
  conversationId: string,
  firstMessage: string
): Promise<string | null> {
  try {
    // Call a backend endpoint to generate title using Claude
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: firstMessage }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate title');
    }

    const { title } = await response.json();

    // Update the conversation with the generated title
    await updateConversationTitle(conversationId, title);

    return title;
  } catch (error) {
    console.error('Error generating title:', error);
    // Fallback: use first 50 chars of message
    const fallbackTitle = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    await updateConversationTitle(conversationId, fallbackTitle);
    return fallbackTitle;
  }
}

// ============================================
// PROFILE
// ============================================

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile || null;
}

/**
 * Update current user's profile
 */
export async function updateProfile(
  updates: { display_name?: string; avatar_url?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const profile = await getCurrentProfile();
  if (!profile) return false;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profile.id);

  if (error) {
    console.error('Error updating profile:', error);
    return false;
  }

  return true;
}

export default {
  // Conversations
  getConversations,
  getConversationsByTopic,
  getConversationWithMessages,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  // Messages
  addMessage,
  getMessages,
  // Search
  searchConversations,
  // Title generation
  generateConversationTitle,
  // Profile
  getProfile,
  updateProfile,
};
