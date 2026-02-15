import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { hasPlayableContent } from '@/services/questionEngine';
import SettingsModal from '@/components/SettingsModal';
import { BackgroundPattern, TextureOverlay, CornerOrnament, GoldDivider } from '@/components/Decorative';

export default function MainMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canPlay, setCanPlay] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasPlayableContent().then((ok) => {
      if (!cancelled) setCanPlay(ok);
    });
    return () => { cancelled = true; };
  }, []);

  const handlePlay = () => {
    if (canPlay) navigate('/play');
  };

  return (
    <div className="main-menu-wrap">
      <BackgroundPattern className="main-menu-bg-pattern" variant={1} opacity={0.15} />
      <TextureOverlay className="main-menu-texture" />

      <Link
        to="/profile"
        className="main-menu-profile-icon"
        aria-label={t('nav.profile')}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="main-menu-profile-avatar" />
        ) : (
          <span className="main-menu-profile-icon-inner">👤</span>
        )}
      </Link>

      <div className="main-menu">
        <div className="main-menu-brand">
          <CornerOrnament className="main-menu-ornament" />
          <h1 className="main-menu-logo">{t('app.name')}</h1>
          <GoldDivider className="main-menu-divider" />
          <p className="main-menu-tagline">{t('app.tagline')}</p>
        </div>

        <div className="main-menu-cards">
          <div className="main-menu-row main-menu-row-primary">
            <button
              type="button"
              className="main-menu-play-card"
              onClick={handlePlay}
              disabled={canPlay === false}
            >
              <div className="main-menu-play-card-inner">
                <span className="main-menu-play-card-title">
                  {canPlay === null ? '…' : t('menu.play')}
                </span>
                <span className="main-menu-play-card-subtitle">{t('app.tagline')}</span>
              </div>
            </button>
            <button
              type="button"
              className="main-menu-settings-card"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('nav.settings')}
            >
              <span className="main-menu-settings-icon">⚙</span>
              <span className="main-menu-settings-label">{t('nav.settings')}</span>
            </button>
          </div>

          {canPlay === false && (
            <p className="main-menu-no-content">{t('play.noContent')}</p>
          )}

          <div className="main-menu-row main-menu-row-secondary">
            <button
              type="button"
              className="main-menu-card main-menu-card-lessons"
              onClick={() => navigate('/lessons')}
            >
              <span className="main-menu-card-icon main-menu-card-icon-svg" aria-hidden>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
              </span>
              <h3 className="main-menu-card-title">{t('menu.lessons')}</h3>
              <p className="main-menu-card-desc">{t('app.tagline')}</p>
            </button>
            <button
              type="button"
              className="main-menu-card main-menu-card-leaderboard"
              onClick={() => navigate('/leaderboard')}
            >
              <span className="main-menu-card-icon main-menu-card-icon-svg" aria-hidden>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47 1-1 1H8a1 1 0 0 1-1-1v-2.34"/><path d="M14 14.66V17c0 .55.47 1 1 1h1a1 1 0 0 0 1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </span>
              <h3 className="main-menu-card-title">{t('menu.leaderboard')}</h3>
              <p className="main-menu-card-desc">{t('app.tagline')}</p>
            </button>
          </div>
        </div>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
