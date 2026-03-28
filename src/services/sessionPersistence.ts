/**
 * Session Persistence — v1-2
 *
 * When a logged-in user finishes a session, calls backend POST /api/leaderboard/record-answer
 * which updates monthly_scores, user_stats, and runs difficulty adaptation.
 *
 * v1-4: When offline, queue session in localStorage; flush when back online.
 */

import { recordAnswer } from '@/services/backendApi';
import type { SessionSummaryDTO } from '@/types/dto';

const LOG = '[SessionPersistence]';
const OFFLINE_QUEUE_KEY = 'sahra_offline_session_queue';

interface QueuedSession {
  userId: string;
  summary: SessionSummaryDTO;
  displayName: string;
  avatarUrl: string | null;
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
 * Persist a completed session for a logged-in user via backend record-answer.
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
    await recordAnswer({
      points: summary.totalPoints,
      totalQuestionsAnswered: summary.totalQuestionsAnswered,
      displayName,
      avatarUrl,
    });
    console.log(LOG, 'Session persisted successfully');
    return true;
  } catch (err) {
    console.error(LOG, 'Unexpected error persisting session:', err);
    return false;
  }
}
