/**
 * AuthCallback — handles the redirect from Google OAuth.
 *
 * Supabase automatically picks up the auth tokens from the URL hash.
 * We just wait for the auth state to resolve and redirect to the profile.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const { loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    // Once auth resolves, go to profile (logged in) or home (failed)
    navigate(user ? '/profile' : '/', { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="placeholder">
      <div className="spinner" />
    </div>
  );
}
