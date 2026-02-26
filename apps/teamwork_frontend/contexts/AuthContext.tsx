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

    // Initialize auth state.
    // For OAuth callbacks: getSession() hangs because Supabase's _initialize()
    // promise never resolves during PKCE exchange. But onAuthStateChange DOES
    // fire SIGNED_IN successfully. So for callbacks we skip getSession() and
    // let onAuthStateChange (below) handle the session. We just clean the URL
    // and set a safety timeout in case onAuthStateChange never fires.
    const initAuth = async () => {
      try {
        const isCallback = window.location.pathname === '/auth/callback' ||
          window.location.hash.includes('access_token') ||
          new URLSearchParams(window.location.search).has('code');

        // Check for explicit OAuth error params
        if (isCallback) {
          const callbackParams = new URLSearchParams(window.location.search);
          const callbackError = callbackParams.get('error_description') || callbackParams.get('error');
          if (callbackError) {
            window.history.replaceState({}, '', '/');
            setState((prev) => ({
              ...prev,
              isLoading: false,
              isAuthenticated: false,
              authError: `Sign-in failed: ${decodeURIComponent(callbackError)}`,
            }));
            return;
          }

          // For callbacks, onAuthStateChange handles the session.
          // DO NOT clear the URL here - Supabase's _initialize() needs to
          // read the ?code= param. URL is cleaned in onAuthStateChange after
          // the session is established.
          console.log('OAuth callback detected, waiting for onAuthStateChange...');
          setTimeout(() => {
            setState((prev) => {
              if (prev.isLoading) {
                console.warn('Auth callback timeout - onAuthStateChange did not fire in time');
                return { ...prev, isLoading: false, authError: 'Sign-in timed out. Please try again.' };
              }
              return prev;
            });
          }, 30000);
          return;
        }

        // Normal (non-callback) session check
        console.log('Getting session... (normal, timeout: 5000ms)');
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out')), 5000)
        );

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise])
          .catch((err) => {
            console.warn('Session check timed out or failed:', err);
            return { data: { session: null }, error: err };
          }) as { data: { session: any }, error: any };

        if (error) {
          console.error('Error getting session:', error);
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        console.log('Session:', session?.user?.email || 'none');

        if (session?.user) {
          console.log('Fetching profile...');
          try {
            const { profile, workspace } = await fetchProfile(session.user.id);
            setState({
              user: session.user, profile, workspace, session,
              isLoading: false, isAuthenticated: true, isConfigured: true, authError: null,
            });
          } catch (profileErr) {
            console.error('Profile fetch error:', profileErr);
            setState({
              user: session.user, profile: null, workspace: null, session,
              isLoading: false, isAuthenticated: true, isConfigured: true, authError: null,
            });
          }
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

        // Handle both SIGNED_IN and INITIAL_SESSION (OAuth callback returns INITIAL_SESSION)
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          // Clean callback URL params now that session is established
          if (window.location.pathname === '/auth/callback' || new URLSearchParams(window.location.search).has('code')) {
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
