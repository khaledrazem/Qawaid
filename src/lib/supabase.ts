import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

/**
 * Supabase client singleton.
 *
 * The default GoTrueClient uses `navigator.locks` to coordinate
 * token refresh across tabs. In dev mode (Vite HMR / React StrictMode)
 * the lock's AbortController gets triggered, producing:
 *   "AbortError: signal is aborted without reason"
 * which prevents onAuthStateChange from ever firing.
 *
 * Providing a custom `lock` that simply calls the function directly
 * bypasses navigator.locks entirely. Token refresh still works — it
 * just won't be coordinated across multiple tabs (fine for our use case).
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
  },
});
