/**
 * AuthCallback — handles the redirect from Google OAuth (PKCE).
 *
 * Completes the code exchange explicitly so we do not navigate away before
 * the session exists (avoids races with AuthContext INITIAL_SESSION).
 * Also reads OAuth errors from the URL hash (e.g. server_error / exchange failures).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const hash = window.location.hash.replace(/^#/, '');
      const hp = new URLSearchParams(hash);
      const errDesc = hp.get('error_description');
      const errCode = hp.get('error');
      if (errDesc || errCode) {
        const raw = errDesc || errCode || 'Sign-in failed';
        const text = decodeURIComponent(raw.replace(/\+/g, ' '));
        if (!cancelled) setMessage(text);
        window.history.replaceState({}, '', '/auth/callback');
        return;
      }

      const sp = new URLSearchParams(window.location.search);
      const code = sp.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({}, '', '/auth/callback');
        if (error) {
          console.error('[AuthCallback] exchangeCodeForSession:', error);
          if (!cancelled) setMessage(error.message || 'Could not complete sign-in');
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      navigate(data.session?.user ? '/profile' : '/', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => navigate('/', { replace: true }), 5000);
    return () => window.clearTimeout(t);
  }, [message, navigate]);

  return (
    <div className="placeholder">
      {message ? (
        <p className="placeholder-text" role="alert">
          {message}
        </p>
      ) : (
        <>
          <div className="spinner" />
          <p className="placeholder-text">…</p>
        </>
      )}
    </div>
  );
}
