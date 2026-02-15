import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { persistSession, queueSessionWhenOffline } from '@/services/sessionPersistence';
import { fetchLeaderboard } from '@/services/leaderboardService';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';
import type { SessionSummaryDTO, LessonRecommendationDTO } from '@/types/dto';

const BEST_SESSION_KEY = 'sahra_best_session';
const SESSIONS_PLAYED_KEY = 'sahra_sessions_played';

/** Read the best session score from localStorage. */
function getBestSession(): number {
  try {
    const raw = localStorage.getItem(BEST_SESSION_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Update best session score in localStorage if current is higher. Returns true if new record. */
function checkAndUpdateBestSession(questionsAnswered: number): boolean {
  const prev = getBestSession();
  if (questionsAnswered > prev) {
    localStorage.setItem(BEST_SESSION_KEY, String(questionsAnswered));
    return true;
  }
  return false;
}

/** Increment the sessions-played counter. */
function incrementSessionsPlayed(): void {
  try {
    const raw = localStorage.getItem(SESSIONS_PLAYED_KEY);
    const prev = raw ? parseInt(raw, 10) : 0;
    localStorage.setItem(SESSIONS_PLAYED_KEY, String((Number.isNaN(prev) ? 0 : prev) + 1));
  } catch { /* ignore */ }
}

export default function Finish() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const summary = (location.state as { summary?: SessionSummaryDTO } | null)?.summary;
  const [lessons, setLessons] = useState<LessonRecommendationDTO[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const persisted = useRef(false);

  // Check for new record and track session count — only on first render
  const isNewRecord = useMemo(() => {
    if (!summary) return false;
    incrementSessionsPlayed();
    return checkAndUpdateBestSession(summary.totalQuestionsAnswered);
  }, [summary]);

  // Persist session to DB for logged-in users (once); when offline, queue for sync (v1-4)
  useEffect(() => {
    if (!summary || !user?.id || persisted.current) return;
    persisted.current = true;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queueSessionWhenOffline(user.id, summary, user.displayName, user.avatarUrl ?? null);
      setPendingSync(true);
      return;
    }

    (async () => {
      const ok = await persistSession(user.id, summary, user.displayName, user.avatarUrl ?? null);
      if (!ok) {
        queueSessionWhenOffline(user.id, summary, user.displayName, user.avatarUrl ?? null);
        setPendingSync(true);
        return;
      }

      try {
        const lb = await fetchLeaderboard(user.id);
        if (lb?.currentUserRank) setRank(lb.currentUserRank);
      } catch (err) {
        console.warn('[Finish] Failed to fetch rank:', err);
      }
    })();
  }, [summary, user]);

  // Fetch recommended lessons based on incorrect category IDs
  useEffect(() => {
    if (!summary || summary.incorrectCategoryIds.length === 0) return;

    (async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, category_id')
        .in('category_id', summary.incorrectCategoryIds)
        .eq('is_active', true);

      if (error || !data) return;

      // Deduplicate by category — one lesson per category
      const seen = new Set<string>();
      const unique: LessonRecommendationDTO[] = [];
      for (const row of data) {
        if (!seen.has(row.category_id)) {
          seen.add(row.category_id);
          unique.push({
            lessonId: row.id,
            title: row.title,
            categoryId: row.category_id,
          });
        }
      }
      setLessons(unique);
    })();
  }, [summary]);

  // If no summary (direct navigation), show zeroes
  const totalQuestions = summary?.totalQuestionsAnswered ?? 0;
  const totalPoints = summary?.totalPoints ?? 0;
  const maxCombo = summary?.maxCombo ?? 1.0;

  return (
    <div className="finish finish-with-bg">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
      <TextureOverlay className="page-texture" />
      <div className="finish-card card">
      <h1 className="finish-title">{t('finish.title')}</h1>

      {/* New record banner */}
      {isNewRecord && (
        <div className="finish-record">
          <span className="finish-record-icon">🏆</span>
          <span className="finish-record-text">{t('finish.newRecord')}</span>
        </div>
      )}

      <div className="finish-stats">
        <div className="finish-stat">
          <span className="finish-stat-value">{totalQuestions}</span>
          <span className="finish-stat-label">{t('finish.totalQuestions')}</span>
        </div>
        <div className="finish-stat">
          <span className="finish-stat-value">{totalPoints}</span>
          <span className="finish-stat-label">{t('finish.totalPoints')}</span>
        </div>
        <div className="finish-stat">
          <span className="finish-stat-value">×{maxCombo.toFixed(2)}</span>
          <span className="finish-stat-label">{t('finish.maxCombo')}</span>
        </div>
      </div>

      {/* Recommended lessons */}
      {lessons.length > 0 && (
        <div className="finish-lessons">
          <h3 className="finish-lessons-title">{t('finish.recommendedLessons')}</h3>
          {lessons.map((lesson) => (
            <Link
              key={lesson.lessonId}
              to={`/lessons/${lesson.lessonId}`}
              className="finish-lesson-item finish-lesson-link"
            >
              {lesson.title}
            </Link>
          ))}
        </div>
      )}

      {/* Offline: points queued for sync (v1-4) */}
      {user && pendingSync && (
        <p className="finish-pending-sync">{t('finish.pendingSync')}</p>
      )}

      {/* Rank display for logged-in users, or guest CTA */}
      {user && !pendingSync ? (
        rank !== null ? (
          <div className="finish-rank">
            <span className="finish-rank-label">{t('leaderboard.yourRank')}</span>
            <span className="finish-rank-value">#{rank}</span>
          </div>
        ) : null
      ) : !user ? (
        <div className="finish-login-cta">
          <p>{t('finish.loginCta')}</p>
        </div>
      ) : null}

      <div className="finish-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/play')}>
          {t('finish.retry')}
        </button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/')}>
          {t('finish.mainMenu')}
        </button>
      </div>
      </div>
    </div>
  );
}
