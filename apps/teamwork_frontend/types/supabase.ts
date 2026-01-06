/**
 * Supabase Database Types
 * Generated from schema - update when schema changes
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          teamwork_site_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          teamwork_site_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          teamwork_site_url?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          workspace_id: string | null;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          workspace_id?: string | null;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          workspace_id: string | null;
          user_id: string | null;
          project_id: string | null;
          topic: 'project' | 'status' | 'timelog' | 'general';
          title: string | null;
          search_vector: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          user_id?: string | null;
          project_id?: string | null;
          topic: 'project' | 'status' | 'timelog' | 'general';
          title?: string | null;
          search_vector?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          user_id?: string | null;
          project_id?: string | null;
          topic?: 'project' | 'status' | 'timelog' | 'general';
          title?: string | null;
          search_vector?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string | null;
          role: 'user' | 'assistant';
          content: string | null;
          display_data: Json | null;
          search_vector: unknown | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id?: string | null;
          role: 'user' | 'assistant';
          content?: string | null;
          display_data?: Json | null;
          search_vector?: unknown | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string | null;
          role?: 'user' | 'assistant';
          content?: string | null;
          display_data?: Json | null;
          search_vector?: unknown | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      search_conversations: {
        Args: {
          search_query: string;
          user_workspace_id: string;
        };
        Returns: {
          conversation_id: string;
          title: string;
          topic: string;
          created_at: string;
          updated_at: string;
          rank: number;
        }[];
      };
    };
  };
}

// Convenience types
export type Workspace = Database['public']['Tables']['workspaces']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];

export type ConversationTopic = Conversation['topic'];

export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

// Extended types with relations
export type ProfileWithWorkspace = Profile & {
  workspaces: Workspace | null;
};

export type ConversationWithMessages = Conversation & {
  messages: Message[];
};

export type ConversationWithMetadata = Conversation & {
  message_count: number;
  last_message_at: string | null;
};
