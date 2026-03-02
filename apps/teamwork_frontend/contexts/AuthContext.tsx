import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, signInWithMicrosoft, signOut as supabaseSignOut, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, Workspace } from '../types/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  workspace: Workspace | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  authError: string | null;
}

interface AuthContextType extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    workspace: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isConfigured: isSupabaseConfigured(),
    authError: null,
  });

  // Fetch profile and workspace for a user
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, workspaces(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return { profile: null, workspace: null };
      }

      return {
        profile: data as Profile,
        workspace: (data as { workspaces: Workspace | null }).workspaces,
      };
    } catch (err) {
      console.error('Error in fetchProfile:', err);
      return { profile: null, workspace: null };
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    // With implicit flow, the session token comes in the URL hash (#access_token=...).
    // detectSessionInUrl: true handles parsing it. onAuthStateChange fires SIGNED_IN.
    // We only need initAuth for the non-callback case (returning user with stored session).
    const initAuth = async () => {
      try {
        // Check for explicit OAuth error in hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashError = hashParams.get('error_description') || hashParams.get('error');
        if (hashError) {
          window.history.replaceState({}, '', window.location.pathname);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
            authError: `Sign-in failed: ${decodeURIComponent(hashError)}`,
          }));
          return;
        }

        // If hash contains access_token, Supabase handles it via detectSessionInUrl.
        // onAuthStateChange will fire. Just set a safety timeout.
        if (window.location.hash.includes('access_token')) {
          console.log('OAuth implicit callback detected, Supabase will handle session...');
          setTimeout(() => {
            setState((prev) => {
              if (prev.isLoading) {
                return { ...prev, isLoading: false, authError: 'Sign-in timed out. Please try again.' };
              }
              return prev;
            });
          }, 15000);
          return;
        }

        // Normal session check for returning users
        console.log('Checking existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        if (session?.user) {
          const { profile, workspace } = await fetchProfile(session.user.id);
          setState({
            user: session.user, profile, workspace, session,
            isLoading: false, isAuthenticated: true, isConfigured: true, authError: null,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('Error in initAuth:', err);
        setState((prev) => ({
          ...prev, isLoading: false,
          authError: `Authentication error: ${err instanceof Error ? err.message : String(err)}`,
        }));
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);

        // Handle both SIGNED_IN and INITIAL_SESSION
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          // Clean callback URL (hash fragments from implicit flow, or query params)
          if (window.location.hash.includes('access_token') || window.location.pathname === '/auth/callback') {
            window.history.replaceState({}, '', '/');
          }
          const { profile, workspace } = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            workspace,
            session,
            isLoading: false,
            isAuthenticated: true,
            isConfigured: true,
            authError: null,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            profile: null,
            workspace: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            isConfigured: true,
            authError: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setState((prev) => ({
            ...prev,
            session,
          }));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign in with Microsoft
  const signIn = useCallback(async () => {
    try {
      await signInWithMicrosoft();
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabaseSignOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    const { profile, workspace } = await fetchProfile(state.user.id);
    setState((prev) => ({
      ...prev,
      profile,
      workspace,
    }));
  }, [state.user, fetchProfile]);

  const value: AuthContextType = {
    ...state,
    signIn,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
