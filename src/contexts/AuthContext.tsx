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
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
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
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/* -----------------------------------------------------------------------
   Provider
   ----------------------------------------------------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
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

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (Capacitor.isNativePlatform()) {
      // In-app native Google Sign-In (no browser). Plugin shows account picker inside the app.
      try {
        GoogleAuth.initialize(); // uses androidClientId + serverClientId from capacitor.config
        const result = await GoogleAuth.signIn();
        const idToken = result?.authentication?.idToken;
        if (!idToken) {
          console.warn('[AuthContext] Native Google Sign-In: no id token (user may have cancelled)');
          return;
        }
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (error) {
          console.error('[AuthContext] signInWithIdToken failed — full error:', error);
          const errObj = error as { message?: string; code?: string; status?: number; name?: string };
          console.error('[AuthContext] signInWithIdToken details:', {
            message: errObj.message,
            code: errObj.code,
            status: errObj.status,
            name: errObj.name,
          });
          const detail = [
            error.message || 'Login failed',
            (error as { code?: string }).code && `Code: ${(error as { code?: string }).code}`,
            (error as { status?: number }).status != null && `Status: ${(error as { status?: number }).status}`,
          ]
            .filter(Boolean)
            .join(' · ');
          setAuthError(detail);
          return;
        }
        // Supabase may not fire onAuthStateChange immediately on native; set session/user from response so UI updates.
        if (data?.session) {
          setSession(data.session);
          sessionRef.current = data.session;
          if (data.session.user) {
            try {
              const appUser = await ensureUserExists(data.session.user);
              setUser(appUser);
            } catch (err) {
              console.warn('[AuthContext] ensureUserExists after signInWithIdToken:', err);
              setUser(null);
            }
          }
          setLoading(false);
        }
      } catch (err) {
        const parts: string[] = [];
        const errObj = err && typeof err === 'object' ? (err as { message?: string; code?: string; status?: number }) : null;
        const msg = errObj?.message ?? (err instanceof Error ? err.message : String(err));
        const code = errObj?.code ?? (err as { code?: string })?.code;
        const status = errObj?.status ?? (err as { status?: number })?.status;

        parts.push(msg || 'Google sign-in failed');
        if (code) parts.push(`Code: ${code}`);
        if (status != null) parts.push(`Status: ${status}`);
        if (code === '10' || msg === 'Something went wrong') {
          parts.push(
            '(Android: add the signing keystore SHA-1 to the Android OAuth client in Google Cloud; '
            + 'package must be com.qawaid.app. serverClientId must match your Web OAuth client used by Supabase.)'
          );
        }
        const message = parts.join(' · ');
        setAuthError(message);
        console.error('[AuthContext] Native Google Sign-In failed — full error:', err);
        console.error('[AuthContext] error details:', { message: msg, code, status, raw: err });
        if (err instanceof Error && err.stack) console.error('[AuthContext] error.stack:', err.stack);
        return;
      }
      return;
    }

    // Web: OAuth redirect flow
    const redirectTo = `${window.location.origin}/auth/callback`;
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
      value={{ session, user, loading, authError, signInWithGoogle, signOut, refreshUser, clearAuthError }}
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
