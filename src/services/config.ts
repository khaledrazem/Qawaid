/* -----------------------------------------------------------------------
   App configuration — reads from env and provides typed defaults.
   All VITE_ vars are available at build time via import.meta.env.
   ----------------------------------------------------------------------- */

function envFloat(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw == null || raw === '') return fallback;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? fallback : n;
}

function envInt(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

/** Default difficulty distribution for guests / new users. */
export const DIFFICULTY_WEIGHTS = {
  easy:   envFloat('VITE_DIFFICULTY_DEFAULT_EASY_WEIGHT',   0.5),
  medium: envFloat('VITE_DIFFICULTY_DEFAULT_MEDIUM_WEIGHT', 0.3),
  hard:   envFloat('VITE_DIFFICULTY_DEFAULT_HARD_WEIGHT',   0.2),
} as const;

/** Base points per correct answer (before combo). */
export const BASE_POINTS = {
  easy:   envInt('VITE_POINTS_EASY',   10),
  medium: envInt('VITE_POINTS_MEDIUM', 20),
  hard:   envInt('VITE_POINTS_HARD',   30),
} as const;

/** Combo: every N correct in a row, multiplier += INCREMENT. */
export const COMBO = {
  step:      envInt('VITE_COMBO_QUESTIONS_STEP',       5),
  increment: envFloat('VITE_COMBO_MULTIPLIER_INCREMENT', 0.05),
} as const;

/** Question batch loading. */
export const BATCH = {
  size:      envInt('VITE_QUESTION_BATCH_SIZE',       30),
  threshold: envInt('VITE_QUESTION_PRELOAD_THRESHOLD', 5),
} as const;

/** Offline mode (v1-4): pre-generate up to this many questions at app start. */
export const OFFLINE = {
  cacheSize: envInt('VITE_OFFLINE_CACHE_SIZE', 100),
} as const;

/** Session rules. */
export const SESSION = {
  startingLives: 3,
} as const;

/** Leaderboard display. */
export const LEADERBOARD = {
  topCount:         envInt('VITE_LEADERBOARD_TOP_COUNT',         3),
  surroundingCount: envInt('VITE_LEADERBOARD_SURROUNDING_COUNT', 4),
} as const;

/**
 * Difficulty adaptation — adjusts user_difficulty_profile after each session.
 *
 * If the user answered MORE than targetMax questions → they found it too easy →
 * increase medium/hard weights, decrease easy weight.
 *
 * If the user answered FEWER than targetMin questions → too hard →
 * increase easy weight, decrease medium/hard weights.
 *
 * weightDelta is the amount to shift per adjustment.
 */
export const DIFFICULTY_ADAPTATION = {
  targetMin:   envInt('VITE_DIFFICULTY_TARGET_MIN',       20),
  targetMax:   envInt('VITE_DIFFICULTY_TARGET_MAX',       50),
  weightDelta: envFloat('VITE_DIFFICULTY_WEIGHT_DELTA',   0.05),
} as const;
