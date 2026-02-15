/**
 * Session Persistence — v1-2
 *
 * When a logged-in user finishes a session, this service:
 *  1. Upserts monthly_scores (add points to current month)
 *  2. Updates user_stats  (lifetime points, total questions, best session)
 *  3. Runs difficulty adaptation
 *
 * v1-4: When offline, queue session in localStorage; flush when back online.
 */

import { supabase } from '@/lib/supabase';
import { adaptDifficulty } from '@/services/difficultyAdaptation';
import type { SessionSummaryDTO } from '@/types/dto';

const LOG = '[SessionPersistence]';
const OFFLINE_QUEUE_KEY = 'sahra_offline_session_queue';

interface QueuedSession {
  userId: string;
  summary: SessionSummaryDTO;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Current month key, e.g. "2026-02".
 */
function currentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/* -----------------------------------------------------------------------
   1. Monthly Scores — upsert
   ----------------------------------------------------------------------- */

async function upsertMonthlyScore(
  userId: string,
  points: number,
  displayName: string,
  avatarUrl: string | null,
): Promise<void> {
  const month = currentMonthKey();
  console.log(LOG, `Upserting monthly_scores for ${month}: +${points} points`);

  // Try to read existing row
  const { data: existing, error: readErr } = await supabase
    .from('monthly_scores')
    .select('id, points')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (readErr) {
    console.error(LOG, 'Error reading monthly_scores:', readErr.message);
    return;
  }

  if (existing) {
    // Add to existing — also refresh display info
    const { error } = await supabase
      .from('monthly_scores')
      .update({
        points: existing.points + points,
        display_name: displayName,
        avatar_url: avatarUrl,
      })
      .eq('id', existing.id);

    if (error) console.error(LOG, 'Error updating monthly_scores:', error.message);
    else console.log(LOG, `Monthly score updated: ${existing.points} → ${existing.points + points}`);
  } else {
    // Insert new row
    const { error } = await supabase
      .from('monthly_scores')
      .insert({
        user_id: userId,
        month,
        points,
        display_name: displayName,
        avatar_url: avatarUrl,
      });

    if (error) console.error(LOG, 'Error inserting monthly_scores:', error.message);
    else console.log(LOG, `Monthly score created: ${points} points for ${month}`);
  }
}

/* -----------------------------------------------------------------------
   2. User Stats — update
   ----------------------------------------------------------------------- */

async function updateUserStats(
  userId: string,
  summary: SessionSummaryDTO,
): Promise<void> {
  console.log(LOG, 'Updating user_stats...');

  // Read current stats
  const { data: stats, error: readErr } = await supabase
    .from('user_stats')
    .select('lifetime_points, total_questions_answered, best_session_questions')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr || !stats) {
    console.error(LOG, 'Error reading user_stats:', readErr?.message ?? 'not found');
    return;
  }

  const newLifetime = stats.lifetime_points + summary.totalPoints;
  const newTotal = stats.total_questions_answered + summary.totalQuestionsAnswered;
  const newBest = Math.max(stats.best_session_questions, summary.totalQuestionsAnswered);

  const { error } = await supabase
    .from('user_stats')
    .update({
      lifetime_points: newLifetime,
      total_questions_answered: newTotal,
      best_session_questions: newBest,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error(LOG, 'Error updating user_stats:', error.message);
  } else {
    console.log(LOG, 'user_stats updated:', { newLifetime, newTotal, newBest });
  }
}

/* -----------------------------------------------------------------------
   Offline queue (v1-4)
   ----------------------------------------------------------------------- */

function getOfflineQueue(): QueuedSession[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setOfflineQueue(queue: QueuedSession[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn(LOG, 'Failed to write offline queue', e);
  }
}

/**
 * Queue a session for later sync when offline. Call from Finish when navigator.onLine is false.
 */
export function queueSessionWhenOffline(
  userId: string,
  summary: SessionSummaryDTO,
  displayName: string,
  avatarUrl: string | null,
): void {
  const queue = getOfflineQueue();
  queue.push({ userId, summary, displayName, avatarUrl });
  setOfflineQueue(queue);
  console.log(LOG, 'Queued session for offline sync; queue length:', queue.length);
}

/**
 * Flush any queued sessions to the server. Call when app detects online (e.g. load or online event).
 */
export async function flushPendingSessions(): Promise<void> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(LOG, 'Flushing offline queue:', queue.length, 'sessions');

  const remaining: QueuedSession[] = [];
  for (const item of queue) {
    const ok = await persistSession(item.userId, item.summary, item.displayName, item.avatarUrl);
    if (!ok) remaining.push(item);
  }
  setOfflineQueue(remaining);
  if (remaining.length > 0) {
    console.warn(LOG, 'Failed to persist some queued sessions:', remaining.length);
  }
}

/* -----------------------------------------------------------------------
   Public API
   ----------------------------------------------------------------------- */

/**
 * Persist a completed session for a logged-in user.
 * Runs all three operations (monthly score, user stats, difficulty adaptation).
 * Returns true on success, false on failure (errors are logged; callers can queue for retry).
 */
export async function persistSession(
  userId: string,
  summary: SessionSummaryDTO,
  displayName: string,
  avatarUrl: string | null,
): Promise<boolean> {
  console.log(LOG, 'Persisting session for user:', userId);

  try {
    await Promise.all([
      upsertMonthlyScore(userId, summary.totalPoints, displayName, avatarUrl),
      updateUserStats(userId, summary),
    ]);

    await adaptDifficulty(userId, summary.totalQuestionsAnswered);

    console.log(LOG, 'Session persisted successfully');
    return true;
  } catch (err) {
    console.error(LOG, 'Unexpected error persisting session:', err);
    return false;
  }
}
