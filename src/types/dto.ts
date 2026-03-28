import type { Difficulty, QuestionType } from './db';

/* -----------------------------------------------------------------------
   DTOs used by the question engine, session manager, and UI.
   These mirror the spec in the product requirements doc.
   ----------------------------------------------------------------------- */

/** A single answer option shown to the user (MCQ or click target). */
export interface DefinitionOptionDTO {
  id: string;
  label: string;
}

/** Fully built question ready for the UI. */
export interface QuestionDTO {
  /** The question type determines the UI component. */
  questionType: QuestionType;
  /** The Arabic sentence (prompt) the question is about. */
  promptText: string;
  /** The question text (with {definition} already replaced). */
  questionText: string;
  /** Answer options (MCQ: 4 items; click: 1 item — the correct one). */
  possibleAnswers: DefinitionOptionDTO[];
  /** The correct answer (also present in possibleAnswers). */
  correctAnswer: DefinitionOptionDTO;
  /** Category ID of the question (used for incorrect tracking / lesson recommendations). */
  categoryId: string;
  /** Prompt difficulty, used for scoring. */
  difficulty: Difficulty;
  /** Base points (before combo) for this question. */
  points: number;
  /** Character index of the correct word/letter in the prompt (for click types). */
  indexStart: number;
  /** End character index for letter-range highlighting (optional). */
  indexEnd?: number;
  /** Whether the target is a letter (true) or word (false). */
  isLetter: boolean;
  /** Prompt ID (for backend batch: used to pass usedPromptIds on next fetch). */
  promptId?: string;
  /** For visual_mcq: image URL to display. */
  imageUrl?: string | null;
  /** For fill_in_sentence / transformation: the word the user must enter. */
  expectedWord?: string;
  /** For yes_no: correct answer is literal "yes" or "no". */
  correctAnswerYesNo?: boolean;
  /** Shown when user answers incorrectly (definition description). */
  definitionDescription?: string | null;
}

/** Live session state, managed in memory during play. */
export interface SessionStateDTO {
  startedAt: string; // ISO date
  livesRemaining: number; // starts at 3
  currentScore: number;
  comboMultiplier: number;
  questionsAnswered: number;
  correctStreak: number;
  maxCombo: number;
  incorrectCategoryIds: string[];
  currentQuestion: QuestionDTO | null;
}

/** Summary shown on the finish screen. */
export interface SessionSummaryDTO {
  totalQuestionsAnswered: number;
  totalPoints: number;
  maxCombo: number;
  incorrectCategoryIds: string[]; // de-duplicated
}

/** A recommended lesson for the finish screen. */
export interface LessonRecommendationDTO {
  lessonId: string;
  title: string;
  categoryId: string;
}

/** Single entry in the leaderboard. */
export interface LeaderboardEntryDTO {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  rank: number;
  points: number;
}

/** Full leaderboard data. */
export interface LeaderboardDTO {
  topUsers: LeaderboardEntryDTO[];
  surroundingUsers: LeaderboardEntryDTO[];
  currentUserRank: number | null;
}
