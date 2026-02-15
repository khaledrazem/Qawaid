/**
 * AuthContext — v1-1
 *
 * Provides authentication state to the entire learner app.
 * Wraps Supabase Auth and our public.users table.
 *
 * Uses onAuthStateChange as the single source of truth for session state,
 * including the INITIAL_SESSION event on page load/refresh.
 *
 * Guards against React StrictMode double-mount by using a ref to prevent
 * the listener from being set up twice (which would abort in-flight requests).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { ensureUserExists, type AppUser } from '@/services/userService';
import type { Session } from '@supabase/supabase-js';

/* -----------------------------------------------------------------------
   Types
   ----------------------------------------------------------------------- */

interface AuthState {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/* -----------------------------------------------------------------------
   Provider
   ----------------------------------------------------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-mount.
    if (initStarted.current) return;
    initStarted.current = true;

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        console.log('[AuthContext] event:', event, 'user:', sess?.user?.id ?? 'none');

        setSession(sess);
        sessionRef.current = sess;

        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED'
        ) {
          if (sess?.user) {
            try {
              const appUser = await ensureUserExists(sess.user);
              setUser(appUser);
            } catch (err) {
              console.warn('[AuthContext] ensureUserExists failed:', err);
              setUser(null);
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
        }
      },
    );

    void listener;
  }, []);

  /* ---- Actions ---- */

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = import.meta.env.VITE_APP_URL
      ? `${import.meta.env.VITE_APP_URL}/auth/callback`
      : `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess?.user) return;
    try {
      const appUser = await ensureUserExists(sess.user);
      setUser(appUser);
    } catch (err) {
      console.warn('[AuthContext] refreshUser failed:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, user, loading, signInWithGoogle, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* -----------------------------------------------------------------------
   Hook
   ----------------------------------------------------------------------- */

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
