import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/backendApi';

const ADMIN_AUTH_DOMAIN = import.meta.env.VITE_ADMIN_AUTH_DOMAIN ?? 'admin.sahra.local';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const raw = username.trim();
    const email = raw.includes('@') ? raw : `${raw}@${ADMIN_AUTH_DOMAIN}`;
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    try {
      const profile = await getProfile();
      if (!profile.isAdmin) {
        await supabase.auth.signOut();
        setError('Not an admin account.');
        return;
      }
      navigate('/admin/categories', { replace: true });
    } catch {
      setError('Could not verify admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <h1>Admin login</h1>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="hint">
        In Supabase Auth, the admin user must have email set to <strong>username@{ADMIN_AUTH_DOMAIN}</strong> (same id as in public.users with is_admin = true).
      </p>
    </div>
  );
}
