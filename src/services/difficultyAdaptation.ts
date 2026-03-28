/**
 * Difficulty Adaptation — v1-2
 *
 * Fetches user difficulty weights from backend (GET /api/user/difficulty-profile).
 * After a session, the backend runs adaptation when record-answer is called,
 * so we only need to read weights here (for batch request and UI).
 */

import { getDifficultyProfile } from '@/services/backendApi';

const LOG = '[DifficultyAdaptation]';

/* -----------------------------------------------------------------------
   Types
   ----------------------------------------------------------------------- */

export interface DifficultyWeights {
  easy: number;
  medium: number;
  hard: number;
}

/* -----------------------------------------------------------------------
   Fetch
   ----------------------------------------------------------------------- */

/**
 * Fetch the user's difficulty weights from the backend.
 */
export async function fetchUserDifficulty(_userId: string): Promise<DifficultyWeights> {
  try {
    return await getDifficultyProfile();
  } catch (err) {
    console.warn(LOG, 'Could not fetch difficulty profile:', err);
    return { easy: 0.5, medium: 0.3, hard: 0.2 };
  }
}

/**
 * No-op: adaptation is done on the backend when record-answer is called.
 * Kept for API compatibility so callers (e.g. sessionPersistence) don't need to change.
 */
export async function adaptDifficulty(
  _userId: string,
  _questionsAnswered: number,
): Promise<void> {
  // Backend POST /api/leaderboard/record-answer runs difficulty adaptation.
}
