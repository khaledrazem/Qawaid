/**
 * Difficulty Adaptation — v1-2
 *
 * Reads and updates the user_difficulty_profile so logged-in users
 * get progressively harder (or easier) questions based on session performance.
 *
 * Algorithm:
 *   - If questionsAnswered > targetMax → user found it easy → shift toward harder
 *   - If questionsAnswered < targetMin → user found it hard → shift toward easier
 *   - Otherwise → no change
 *
 * Weights are clamped to [0.05, 0.90] and always normalised to sum = 1.
 */

import { supabase } from '@/lib/supabase';
import { DIFFICULTY_WEIGHTS, DIFFICULTY_ADAPTATION } from '@/services/config';

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
 * Fetch the user's difficulty weights from user_difficulty_profile.
 * Returns env defaults if the row doesn't exist yet (shouldn't happen
 * after ensureUserExists, but just in case).
 */
export async function fetchUserDifficulty(userId: string): Promise<DifficultyWeights> {
  const { data, error } = await supabase
    .from('user_difficulty_profile')
    .select('easy_weight, medium_weight, hard_weight')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    console.warn(LOG, 'Could not fetch difficulty profile, using defaults:', error?.message);
    return { ...DIFFICULTY_WEIGHTS };
  }

  return {
    easy: data.easy_weight,
    medium: data.medium_weight,
    hard: data.hard_weight,
  };
}

/* -----------------------------------------------------------------------
   Adapt
   ----------------------------------------------------------------------- */

/** Clamp a number to [min, max]. */
function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Normalise weights so they sum to 1. */
function normalise(w: DifficultyWeights): DifficultyWeights {
  const sum = w.easy + w.medium + w.hard;
  if (sum <= 0) return { ...DIFFICULTY_WEIGHTS }; // safety
  return {
    easy: +(w.easy / sum).toFixed(4),
    medium: +(w.medium / sum).toFixed(4),
    hard: +(w.hard / sum).toFixed(4),
  };
}

/**
 * After a session, adjust the user's difficulty profile based on how
 * many questions they answered before losing all lives.
 */
export async function adaptDifficulty(
  userId: string,
  questionsAnswered: number,
): Promise<void> {
  const { targetMin, targetMax, weightDelta } = DIFFICULTY_ADAPTATION;
  const current = await fetchUserDifficulty(userId);

  let adjusted: DifficultyWeights;

  if (questionsAnswered > targetMax) {
    // Too easy → increase medium & hard, decrease easy
    console.log(LOG, `Session too easy (${questionsAnswered} > ${targetMax}), making harder`);
    adjusted = {
      easy: clamp(current.easy - weightDelta, 0.05, 0.90),
      medium: clamp(current.medium + weightDelta * 0.6, 0.05, 0.90),
      hard: clamp(current.hard + weightDelta * 0.4, 0.05, 0.90),
    };
  } else if (questionsAnswered < targetMin) {
    // Too hard → increase easy, decrease medium & hard
    console.log(LOG, `Session too hard (${questionsAnswered} < ${targetMin}), making easier`);
    adjusted = {
      easy: clamp(current.easy + weightDelta, 0.05, 0.90),
      medium: clamp(current.medium - weightDelta * 0.6, 0.05, 0.90),
      hard: clamp(current.hard - weightDelta * 0.4, 0.05, 0.90),
    };
  } else {
    // Within target range — no change
    console.log(LOG, `Session in range (${questionsAnswered} in [${targetMin}, ${targetMax}]), no change`);
    return;
  }

  const finalWeights = normalise(adjusted);
  console.log(LOG, 'New weights:', finalWeights);

  const { error } = await supabase
    .from('user_difficulty_profile')
    .update({
      easy_weight: finalWeights.easy,
      medium_weight: finalWeights.medium,
      hard_weight: finalWeights.hard,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error(LOG, 'Failed to update difficulty profile:', error.message);
  }
}
