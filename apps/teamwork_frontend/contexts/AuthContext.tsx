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

    // Supabase's _initialize() promise never resolves, which means:
    // - getSession() hangs forever (awaits _initialize())
    // - onAuthStateChange INITIAL_SESSION never fires for stored sessions
    // So we read the stored session directly from localStorage on page load.

    // Check for OAuth errors in URL hash
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

    // Recover session directly from localStorage (bypasses broken _initialize())
    const recoverStoredSession = async () => {
      try {
        const stored = localStorage.getItem('teamwork-ai-synth-auth');
        if (stored) {
          const data = JSON.parse(stored);
          if (data?.access_token && data?.user) {
            const now = Math.floor(Date.now() / 1000);
            if (data.expires_at && now < data.expires_at) {
              console.log('Recovered session from storage:', data.user.email);
              const { profile, workspace } = await fetchProfile(data.user.id);
              setState({
                user: data.user,
                profile,
                workspace,
                session: data as Session,
                isLoading: false,
                isAuthenticated: true,
                isConfigured: true,
                authError: null,
              });
              return;
            } else {
              console.log('Stored session expired, clearing');
              localStorage.removeItem('teamwork-ai-synth-auth');
            }
          }
        }
      } catch (err) {
        console.warn('Failed to recover stored session:', err);
      }
      // No valid stored session - stop loading (show login screen)
      // unless we're in an OAuth callback (onAuthStateChange will handle it)
      if (!window.location.hash.includes('access_token')) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    recoverStoredSession();

    // Safety timeout for OAuth callbacks
    const safetyTimeout = setTimeout(() => {
      setState((prev) => {
        if (prev.isLoading) {
          console.warn('Auth safety timeout');
          return { ...prev, isLoading: false };
        }
        return prev;
      });
    }, 15000);

    // Listen for auth changes (new logins, logouts, token refreshes).
    // Stored session recovery is handled above via localStorage read.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        clearTimeout(safetyTimeout);

        if (event === 'SIGNED_IN' && session?.user) {
          // New login (e.g. implicit OAuth callback)
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
        } else if (event === 'INITIAL_SESSION' && session?.user) {
          // _initialize() completed with a session - update if we haven't already
          setState((prev) => {
            if (!prev.isAuthenticated) {
              return {
                ...prev,
                user: session.user,
                session,
                isLoading: false,
                isAuthenticated: true,
                isConfigured: true,
                authError: null,
              };
            }
            return prev;
          });
        } else if (event === 'INITIAL_SESSION' && !session) {
          setState((prev) => {
            if (prev.isLoading) return { ...prev, isLoading: false };
            return prev;
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
      clearTimeout(safetyTimeout);
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
