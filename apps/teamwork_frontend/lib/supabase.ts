import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// Environment variables (Vite uses import.meta.env with VITE_ prefix)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// Service role key should NOT be exposed to client - only used server-side

// Validate environment
if (!supabaseUrl) {
  console.warn('VITE_SUPABASE_URL is not set. Supabase features will be disabled.');
}
if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Supabase features will be disabled.');
}

/**
 * Supabase client for browser/client-side use
 * Uses anon key with RLS policies enforced
 * Only created if environment variables are set
 */
export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Disable browser lock to prevent hanging on getSession()
          // Lock can get stuck if another tab/window didn't release it properly
          lock: false,
          // Use unique storage key to avoid conflicts
          storageKey: 'teamwork-ai-synth-auth',
        },
      })
    : null;

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
}

/**
 * Get the current user's profile with workspace info
 */
export async function getCurrentProfile() {
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*, workspaces(*)')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error getting current profile:', error);
    return null;
  }

  return data;
}

/**
 * Sign in with Microsoft Azure
 */
export async function signInWithMicrosoft() {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile openid',
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Error signing in with Microsoft:', error);
    throw error;
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export default supabase;
