import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types/db';

interface AdminAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

async function checkAdminUser(authUserId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .eq('is_admin', true)
    .single();
  if (error || !data) return null;
  return data as User;
}

export function useAdminAuth(): AdminAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initializeAndListen = async () => {
      console.log("initializeAndListen")      // 1. Sequential init: resolve session first, before listener fires
      const { data, error: sessionError } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user;
      console.log("data")      // 1. Sequential init: resolve session first, before listener fires
      console.log(data)      // 1. Sequential init: resolve session first, before listener fires
      console.log(error)      // 1. Sequential init: resolve session first, before listener fires

      if (cancelled) return;

      if (sessionError || !sessionUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      console.log("adminUser")

      const adminUser = await checkAdminUser(sessionUser.id);
      if (cancelled) return;
      console.log(adminUser)

      if (!adminUser) {
        await supabase.auth.signOut();
        setUser(null);
        setError('Access denied: not an admin user.');
        setIsLoading(false);
        return;
      }

      setUser(adminUser);
      setError(null);
      setIsLoading(false);

      // 2. Now that init is done, set up the listener for future events
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setIsLoading(true);
          const admin = await checkAdminUser(session.user.id);
          if (cancelled) return;

          if (!admin) {
            await supabase.auth.signOut();
            setUser(null);
            setError('Access denied: not an admin user.');
            setIsLoading(false);
            return;
          }

          setUser(admin);
          setError(null);
          setIsLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setError(null);
          setIsLoading(false);
        }
      });

      // Store unsubscribe for cleanup
      cleanupRef = () => listener.subscription.unsubscribe();
    };

    let cleanupRef: (() => void) | null = null;
    initializeAndListen();

    return () => {
      cancelled = true;
      cleanupRef?.();
    };
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    signOut: async () => { await supabase.auth.signOut(); },
  };
}
