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

    // Get initial session with timeout
    const initAuth = async () => {
      try {
        // Detect if we're returning from an OAuth callback
        const isCallback = window.location.pathname === '/auth/callback' ||
          window.location.hash.includes('access_token') ||
          new URLSearchParams(window.location.search).has('code');

        const timeoutMs = isCallback ? 30000 : 5000;
        console.log(`Getting session... (${isCallback ? 'OAuth callback' : 'normal'}, timeout: ${timeoutMs}ms)`);

        // Add timeout to prevent infinite loading
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(
            isCallback
              ? 'Authentication timed out after returning from Microsoft. This may indicate an expired Azure AD secret in the Supabase configuration.'
              : 'Session check timed out'
          )), timeoutMs)
        );

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise])
          .catch((err) => {
            console.warn('Session check timed out or failed:', err);
            return { data: { session: null }, error: err };
          }) as { data: { session: any }, error: any };

        // Clean up callback URL params to prevent issues on refresh
        if (isCallback) {
          window.history.replaceState({}, '', '/');
        }

        if (error) {
          const errorMessage = error instanceof Error ? error.message : (error?.message || String(error));
          console.error('Error getting session:', error);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
            authError: isCallback
              ? `Sign-in failed: ${errorMessage}`
              : null,
          }));
          return;
        }

        console.log('Session:', session?.user?.email || 'none');

        if (session?.user) {
          // Fetch profile with timeout
          console.log('Fetching profile...');
          try {
            const { profile, workspace } = await fetchProfile(session.user.id);
            console.log('Profile fetched:', profile?.email || 'none');
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
          } catch (profileErr) {
            console.error('Profile fetch error:', profileErr);
            // Still authenticate even if profile fails
            setState({
              user: session.user,
              profile: null,
              workspace: null,
              session,
              isLoading: false,
              isAuthenticated: true,
              isConfigured: true,
              authError: null,
            });
          }
        } else {
          console.log('No session found');
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
            authError: isCallback
              ? 'Sign-in failed: No session was returned after authentication. The OAuth code exchange may have failed.'
              : prev.authError,
          }));
        }
      } catch (err) {
        console.error('Error in initAuth:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          authError: `Authentication error: ${errorMessage}`,
        }));
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);

        // Handle both SIGNED_IN and INITIAL_SESSION (OAuth callback returns INITIAL_SESSION)
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
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
