/**
 * Session Manager — pure state machine for a play session.
 *
 * Manages lives, score, combo multiplier, streaks, and incorrect categories.
 * No side effects — returns new state on every transition.
 */

import { SESSION, BASE_POINTS, COMBO } from '@/services/config';
import type { Difficulty } from '@/types/db';
import type { SessionSummaryDTO } from '@/types/dto';

export interface SessionState {
  livesRemaining: number;
  currentScore: number;
  comboMultiplier: number;
  questionsAnswered: number;
  correctStreak: number;
  maxCombo: number;
  incorrectCategoryIds: string[]; // may contain duplicates — dedupe at summary
}

/** Create a fresh session state. */
export function createSession(): SessionState {
  return {
    livesRemaining: SESSION.startingLives,
    currentScore: 0,
    comboMultiplier: 1.0,
    questionsAnswered: 0,
    correctStreak: 0,
    maxCombo: 1.0,
    incorrectCategoryIds: [],
  };
}

/** Process a correct answer. Returns new state. */
export function answerCorrect(
  state: SessionState,
  difficulty: Difficulty,
): SessionState {
  const basePoints = BASE_POINTS[difficulty];
  const earned = Math.round(basePoints * state.comboMultiplier);

  const newStreak = state.correctStreak + 1;

  // Combo: increase multiplier every COMBO.step correct answers
  let newMultiplier = state.comboMultiplier;
  if (newStreak > 0 && newStreak % COMBO.step === 0) {
    newMultiplier = +(newMultiplier + COMBO.increment).toFixed(2);
  }

  const newMaxCombo = Math.max(state.maxCombo, newMultiplier);

  return {
    ...state,
    currentScore: state.currentScore + earned,
    questionsAnswered: state.questionsAnswered + 1,
    correctStreak: newStreak,
    comboMultiplier: newMultiplier,
    maxCombo: newMaxCombo,
  };
}

/** Process an incorrect answer. Returns new state. */
export function answerIncorrect(
  state: SessionState,
  categoryId: string,
): SessionState {
  return {
    ...state,
    livesRemaining: state.livesRemaining - 1,
    questionsAnswered: state.questionsAnswered + 1,
    correctStreak: 0,
    comboMultiplier: 1.0, // reset combo
    incorrectCategoryIds: [...state.incorrectCategoryIds, categoryId],
  };
}

/** Check if session is over (no lives left). */
export function isSessionOver(state: SessionState): boolean {
  return state.livesRemaining <= 0;
}

/** Build the finish-screen summary from session state. */
export function buildSummary(state: SessionState): SessionSummaryDTO {
  // Deduplicate incorrect category IDs
  const uniqueCategories = [...new Set(state.incorrectCategoryIds)];

  return {
    totalQuestionsAnswered: state.questionsAnswered,
    totalPoints: state.currentScore,
    maxCombo: state.maxCombo,
    incorrectCategoryIds: uniqueCategories,
  };
}
