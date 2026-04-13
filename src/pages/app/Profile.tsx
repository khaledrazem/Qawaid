import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { updateDisplayName, fetchUserStats, type UserStats } from '@/services/userService';
import { BackgroundPattern, TextureOverlay, GoldDivider } from '@/components/Decorative';
import { PageBack } from '@/components/PageBack';

const BEST_SESSION_KEY = 'sahra_best_session';
const SESSIONS_PLAYED_KEY = 'sahra_sessions_played';

function getLocal(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export default function Profile() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLanguage();
  const { user, loading: authLoading, authError, signInWithGoogle, signOut, refreshUser, clearAuthError } =
    useAuth();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  const bestSession = getLocal(BEST_SESSION_KEY);
  const sessionsPlayed = getLocal(SESSIONS_PLAYED_KEY);
  const isLoggedIn = !!user;

  // Fetch cloud stats when logged in (after auth has finished resolving).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStats(null);
      return;
    }
    fetchUserStats(user.id).then(setStats);
  }, [user, authLoading]);

  const handleEditName = () => {
    setNameInput(user?.displayName ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!user || !nameInput.trim()) return;
    setSaving(true);
    const ok = await updateDisplayName(user.id, nameInput);
    if (ok) {
      await refreshUser();
    }
    setSaving(false);
    setEditingName(false);
  };

  return (
    <div className="page page-with-bg">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
      <TextureOverlay className="page-texture" />

      <div className="page-content">
        <div className="page-header">
          <PageBack to="/" />
          <h1 className="page-heading">{t('profile.title')}</h1>
        </div>

        {authLoading && (
          <div className="placeholder">
            <div className="spinner" />
          </div>
        )}

        {!authLoading && !isLoggedIn && (
          <div className="card card-gold profile-card">
            <div className="profile-avatar">👤</div>
            <p className="profile-name">{t('profile.guest')}</p>
            <p className="profile-hint">{t('profile.signInPrompt')}</p>
            {authError && (
              <div className="profile-auth-error" role="alert">
                <span className="profile-auth-error-text">{authError}</span>
                <button type="button" className="profile-auth-error-dismiss" onClick={clearAuthError} aria-label="Dismiss">×</button>
              </div>
            )}
            <GoldDivider className="profile-divider" />
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={signInWithGoogle}
            >
              {t('profile.signIn')}
            </button>
          </div>
        )}

      {/* Logged-in user card */}
      {!authLoading && isLoggedIn && user && (
        <div className="card card-gold profile-card">
          <div className="profile-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="profile-avatar-img" />
            ) : (
              '👤'
            )}
          </div>

          {/* Display name — inline edit */}
          {editingName ? (
            <div className="profile-name-edit">
              <input
                type="text"
                className="profile-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveName}
                disabled={saving || !nameInput.trim()}
              >
                {saving ? '…' : t('profile.saveName')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingName(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div className="profile-name-row">
              <p className="profile-name">{user.displayName}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleEditName}
              >
                {t('profile.editName')}
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={signOut}
          >
            {t('profile.signOut')}
          </button>
        </div>
      )}

      {/* Local session stats (always available) */}
      <div className="card profile-stats-card">
        <h2 className="profile-section-title">{t('profile.localStats')}</h2>
        <div className="profile-stats-grid profile-stats-grid-2">
          <div className="profile-stat">
            <span className="profile-stat-value">{bestSession || '—'}</span>
            <span className="profile-stat-label">{t('profile.bestSessionQuestions')}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{sessionsPlayed || '—'}</span>
            <span className="profile-stat-label">{t('profile.sessionsPlayed')}</span>
          </div>
        </div>
      </div>

      {/* Cloud stats */}
      <div className="card profile-stats-card">
        <h2 className="profile-section-title">{t('profile.stats')}</h2>
        {isLoggedIn && stats ? (
          <div className="profile-stats-grid">
            <div className="profile-stat">
              <span className="profile-stat-value">{stats.totalQuestionsAnswered}</span>
              <span className="profile-stat-label">{t('profile.totalQuestions')}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{stats.bestSessionQuestions}</span>
              <span className="profile-stat-label">{t('profile.bestSession')}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{stats.lifetimePoints}</span>
              <span className="profile-stat-label">{t('profile.lifetimePoints')}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="profile-stats-grid">
              <div className="profile-stat">
                <span className="profile-stat-value">—</span>
                <span className="profile-stat-label">{t('profile.totalQuestions')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">—</span>
                <span className="profile-stat-label">{t('profile.bestSession')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">—</span>
                <span className="profile-stat-label">{t('profile.lifetimePoints')}</span>
              </div>
            </div>
            {!isLoggedIn && (
              <p className="profile-stats-locked">{t('profile.signInPrompt')}</p>
            )}
          </>
        )}
      </div>

        {/* Language switch — v1-6 */}
        <div className="card profile-lang-card">
          <h2 className="profile-section-title">{t('profile.language')}</h2>
          <div className="profile-lang-options">
            <button
              type="button"
              className={`btn btn-secondary profile-lang-btn${locale === 'ar' ? ' active' : ''}`}
              onClick={() => setLocale('ar')}
            >
              العربية
            </button>
            <button
              type="button"
              className={`btn btn-secondary profile-lang-btn${locale === 'en' ? ' active' : ''}`}
              onClick={() => setLocale('en')}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
