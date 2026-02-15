import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { decodeJwtPayload } from '@/lib/jwt';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.replace('.supabase.co', '') : '';

export default function AdminConfig() {
  const [session, setSession] = useState<{ exp?: number; iat?: number; sub?: string } | null>(null);
  const [authConfig, setAuthConfig] = useState<Record<string, unknown> | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) {
        setSession(null);
        return;
      }
      const payload = decodeJwtPayload(s.access_token);
      if (payload) {
        setSession({
          exp: payload.exp as number,
          iat: payload.iat as number,
          sub: payload.sub as string,
        });
      } else {
        setSession(null);
      }
    };
    load();
  }, []);

  const fetchAuthConfig = async (pat: string) => {
    if (!projectRef || !pat.trim()) return;
    setConfigLoading(true);
    setConfigError(null);
    setAuthConfig(null);
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
        headers: { Authorization: `Bearer ${pat.trim()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setConfigError(data?.message ?? data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setAuthConfig(data);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfigLoading(false);
    }
  };

  const formatTs = (s: number | undefined) => (s ? new Date(s * 1000).toISOString() : '—');
  const jwtLifetime = session?.exp && session?.iat ? session.exp - session.iat : null;

  return (
    <div className="config-page">
      <h2 className="page-title">Session &amp; config</h2>
      <p className="page-subtitle">
        Current session and JWT info. To see full Supabase auth config (e.g. JWT expiry, refresh token settings), use the Management API below.
      </p>

      <section className="section">
        <h3 className="section-title">From current session</h3>
        <dl className="info-grid">
          <dt>Supabase URL</dt>
          <dd className="break-all">{supabaseUrl || '—'}</dd>
          <dt>Project ref</dt>
          <dd>{projectRef || '—'}</dd>
          {session && (
            <>
              <dt>User ID (sub)</dt>
              <dd className="text-mono">{session.sub ?? '—'}</dd>
              <dt>Token issued at</dt>
              <dd>{formatTs(session.iat)}</dd>
              <dt>Token expires at</dt>
              <dd>{formatTs(session.exp)}</dd>
              <dt>JWT lifetime</dt>
              <dd>{jwtLifetime != null ? `${jwtLifetime} seconds` : '—'}</dd>
            </>
          )}
        </dl>
        {!session && <p className="no-session">No session (decode from access_token failed or not logged in).</p>}
      </section>

      <section>
        <h3 className="section-title">Full auth config (Management API)</h3>
        <p className="api-hint">
          Requires a <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer">Personal Access Token</a>. Do not commit or expose it.
        </p>
        <pre>
          {`curl -s "https://api.supabase.com/v1/projects/${projectRef || 'YOUR_REF'}/config/auth" \\
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"`}
        </pre>
        <div className="pat-row">
          <input
            type="password"
            placeholder="Paste PAT (used only for this request)"
            className="pat-input"
            id="admin-config-pat"
          />
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('admin-config-pat') as HTMLInputElement;
              if (input?.value) fetchAuthConfig(input.value);
            }}
            disabled={configLoading || !projectRef}
          >
            {configLoading ? 'Loading…' : 'Fetch config'}
          </button>
        </div>
        {configError && <p className="text-error">{configError}</p>}
        {authConfig && (
          <details>
            <summary>Auth config (relevant keys)</summary>
            <pre className="result-pre">
              {JSON.stringify(
                {
                  jwt_exp: authConfig.jwt_exp,
                  refresh_token_rotation_enabled: authConfig.refresh_token_rotation_enabled,
                  security_refresh_token_reuse_interval: authConfig.security_refresh_token_reuse_interval,
                  sessions_timebox: authConfig.sessions_timebox,
                  sessions_inactivity_timeout: authConfig.sessions_inactivity_timeout,
                  sessions_single_per_user: authConfig.sessions_single_per_user,
                },
                null,
                2
              )}
            </pre>
            <p className="result-hint">
              jwt_exp = JWT lifetime in seconds. Increase in Dashboard → Project Settings → Auth if sessions drop too often.
            </p>
          </details>
        )}
      </section>
    </div>
  );
}
