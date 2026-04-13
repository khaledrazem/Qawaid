import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLeaderboard, fetchGlobalLeaderboard } from '@/services/leaderboardService';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';
import { PageBack } from '@/components/PageBack';
import type { LeaderboardDTO, LeaderboardEntryDTO } from '@/types/dto';

type Tab = 'monthly' | 'personal' | 'global';

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('monthly');
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<LeaderboardDTO | null>(null);
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntryDTO[]>([]);

  // Fetch leaderboard after auth is ready so JWT-backed calls see the right user.
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      const [monthlyData, globalData] = await Promise.all([
        fetchLeaderboard(),
        fetchGlobalLeaderboard(),
      ]);
      if (cancelled) return;
      setMonthly(monthlyData);
      setGlobalEntries(globalData);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  return (
    <div className="page page-with-bg">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
      <TextureOverlay className="page-texture" />
      <div className="page-content">
        <div className="page-header">
          <PageBack to="/" />
          <h1 className="page-heading">{t('leaderboard.title')}</h1>
        </div>

        <div className="leaderboard-tabs">
          {(['monthly', 'personal', 'global'] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`leaderboard-tab${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {t(`leaderboard.${key}`)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="placeholder">
            <div className="spinner" />
            <p className="placeholder-text">{t('common.loading')}</p>
          </div>
        )}

        {!loading && tab === 'monthly' && (
          <MonthlyTab leaderboard={monthly} />
        )}

        {!loading && tab === 'personal' && (
          <PersonalTab />
        )}

        {!loading && tab === 'global' && (
          <GlobalTab entries={globalEntries} />
        )}
      </div>
    </div>
  );
}

/* =======================================================================
   Monthly Tab — top 3 podium + remaining list + guest CTA
   ======================================================================= */

function MonthlyTab({ leaderboard }: { leaderboard: LeaderboardDTO | null }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!leaderboard || leaderboard.topUsers.length === 0) {
    return (
      <div className="placeholder">
        <span className="placeholder-icon">🏆</span>
        <p className="placeholder-text">{t('leaderboard.noData')}</p>
      </div>
    );
  }

  const { topUsers, surroundingUsers, currentUserRank } = leaderboard;

  return (
    <div className="leaderboard-content">
      {/* Podium — top 3 */}
      <div className="leaderboard-podium">
        {topUsers.map((entry) => (
          <LeaderboardRow key={entry.userId} entry={entry} isPodium highlight={entry.userId === user?.id} />
        ))}
      </div>

      {/* Surrounding users (when logged in and not already in top) */}
      {surroundingUsers.length > 0 && (
        <>
          <div className="leaderboard-gap">···</div>
          <div className="leaderboard-list">
            {surroundingUsers.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} highlight={entry.userId === user?.id} />
            ))}
          </div>
        </>
      )}

      {/* User rank or guest CTA */}
      {user && currentUserRank != null ? (
        <div className="leaderboard-your-rank">
          {t('leaderboard.yourRank')}: <strong>#{currentUserRank}</strong>
        </div>
      ) : !user ? (
        <div className="leaderboard-cta">
          <p>{t('leaderboard.signInCta')}</p>
        </div>
      ) : null}
    </div>
  );
}

/* =======================================================================
   Personal Tab — guest-only placeholder
   ======================================================================= */

function PersonalTab() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="placeholder">
        <span className="placeholder-icon">👤</span>
        <p className="placeholder-text">{t('leaderboard.signInCta')}</p>
      </div>
    );
  }

  return (
    <div className="placeholder">
      <span className="placeholder-icon">📊</span>
      <p className="placeholder-text">{t('leaderboard.noData')}</p>
    </div>
  );
}

/* =======================================================================
   Global Tab — all-time aggregated scores
   ======================================================================= */

function GlobalTab({ entries }: { entries: LeaderboardEntryDTO[] }) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return (
      <div className="placeholder">
        <span className="placeholder-icon">🌍</span>
        <p className="placeholder-text">{t('leaderboard.noData')}</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-content">
      <div className="leaderboard-list">
        {entries.map((entry) => (
          <LeaderboardRow key={entry.userId} entry={entry} isPodium={entry.rank <= 3} />
        ))}
      </div>

      <div className="leaderboard-cta">
        <p>{t('leaderboard.signInCta')}</p>
      </div>
    </div>
  );
}

/* =======================================================================
   LeaderboardRow — a single leaderboard entry
   ======================================================================= */

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'];

function LeaderboardRow({
  entry,
  isPodium = false,
  highlight = false,
}: {
  entry: LeaderboardEntryDTO;
  isPodium?: boolean;
  highlight?: boolean;
}) {
  const medal = isPodium && entry.rank <= 3 ? PODIUM_MEDALS[entry.rank - 1] : null;

  return (
    <div className={`leaderboard-row${isPodium ? ' podium' : ''}${highlight ? ' highlight' : ''}`}>
      <span className="leaderboard-rank">
        {medal ?? `#${entry.rank}`}
      </span>
      <span className="leaderboard-avatar">
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className="leaderboard-avatar-img" />
        ) : (
          '👤'
        )}
      </span>
      <span className="leaderboard-name">{entry.displayName}</span>
      <span className="leaderboard-points">{entry.points.toLocaleString()}</span>
    </div>
  );
}
