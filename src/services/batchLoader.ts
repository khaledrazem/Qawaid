/**
 * Batch Loader — manages question batch lifecycle with localStorage cache.
 *
 * - Loads BATCH.size questions at a time via the question engine
 * - Preloads next batch when BATCH.threshold questions remain
 * - Caches current batch in localStorage for optimization
 * - Provides next() to pop the next question from the queue
 *
 * v1-4: Offline mode — prewarm fills cache up to OFFLINE.cacheSize when online;
 * preload and emergency fetch are skipped when offline.
 */

import { generateBatch } from '@/services/questionEngine';
import { BATCH, OFFLINE } from '@/services/config';
import type { DifficultyWeights } from '@/services/difficultyAdaptation';
import type { QuestionDTO } from '@/types/dto';

const LOG_PREFIX = '[BatchLoader]';
const STORAGE_KEY = 'sahra_question_batch';

/* -----------------------------------------------------------------------
   localStorage helpers
   ----------------------------------------------------------------------- */

function saveToStorage(questions: QuestionDTO[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch {
    console.warn(LOG_PREFIX, 'Failed to save batch to localStorage');
  }
}

function loadFromStorage(): QuestionDTO[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestionDTO[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Validate first item has required fields (catches stale cache from older DTO)
    if (!parsed[0].categoryId || !parsed[0].questionType) {
      console.warn(LOG_PREFIX, 'Stale cache detected, discarding');
      clearStorage();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Prewarm the question cache for offline play (v1-4).
 * When online, fills localStorage up to OFFLINE.cacheSize questions so play
 * works with no or limited network. No-op when offline or cache already full.
 * Runs in the background; does not block.
 */
export function prewarmQuestionCache(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const cached = loadFromStorage();
  if (cached && cached.length >= OFFLINE.cacheSize) return;

  (async () => {
    let total = cached?.length ?? 0;
    if (total >= OFFLINE.cacheSize) return;

    try {
      while (total < OFFLINE.cacheSize) {
        const batch = await generateBatch(BATCH.size, undefined);
        if (batch.length === 0) break;

        const current = loadFromStorage() ?? [];
        const combined = [...current, ...batch].slice(0, OFFLINE.cacheSize);
        saveToStorage(combined);
        total = combined.length;
        console.log(LOG_PREFIX, `Prewarm: cache has ${total} questions`);

        if (batch.length < BATCH.size) break;
      }
    } catch (err) {
      console.warn(LOG_PREFIX, 'Prewarm failed:', err);
    }
  })();
}

/* -----------------------------------------------------------------------
   BatchLoader class
   ----------------------------------------------------------------------- */

export class BatchLoader {
  private queue: QuestionDTO[] = [];
  private preloading = false;
  private preloadPromise: Promise<void> | null = null;
  private userWeights?: DifficultyWeights;

  /** True when the initial batch is still loading. */
  public loading = true;

  /** True if we tried loading but got zero questions. */
  public empty = false;

  /**
   * Initialize the loader: try localStorage first, then fetch from DB.
   * @param userWeights - optional per-user difficulty weights (logged-in users)
   */
  async init(userWeights?: DifficultyWeights): Promise<void> {
    this.userWeights = userWeights;
    console.log(LOG_PREFIX, 'Initializing...');

    // Try cached batch first
    const cached = loadFromStorage();
    if (cached && cached.length > 0) {
      console.log(LOG_PREFIX, `Loaded ${cached.length} questions from localStorage cache`);
      this.queue = cached;
      this.loading = false;
      this.empty = false;
      // Preload if cache is small (only when online)
      if (this.queue.length <= BATCH.threshold && typeof navigator !== 'undefined' && navigator.onLine) {
        this.triggerPreload();
      }
      return;
    }

    // No cache and offline — cannot fetch
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn(LOG_PREFIX, 'Offline and no cache — no playable content');
      this.loading = false;
      this.empty = true;
      return;
    }

    // No cache — generate fresh batch
    console.log(LOG_PREFIX, 'No cache, generating fresh batch...');
    const batch = await generateBatch(BATCH.size, this.userWeights);

    if (batch.length === 0) {
      console.error(LOG_PREFIX, 'Initial batch is empty — no playable content');
      this.loading = false;
      this.empty = true;
      return;
    }

    this.queue = batch;
    saveToStorage(this.queue);
    this.loading = false;
    this.empty = false;
    console.log(LOG_PREFIX, `Ready with ${this.queue.length} questions`);
  }

  /**
   * Get the next question from the queue.
   * Returns null if queue is exhausted and preload hasn't finished yet.
   */
  async next(): Promise<QuestionDTO | null> {
    // If preload is in flight and queue is empty, wait for it
    if (this.queue.length === 0 && this.preloadPromise) {
      console.log(LOG_PREFIX, 'Queue empty, waiting for preload...');
      await this.preloadPromise;
    }

    if (this.queue.length === 0) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn(LOG_PREFIX, 'Queue exhausted and offline — no more questions');
        return null;
      }
      console.warn(LOG_PREFIX, 'Queue exhausted, generating emergency batch...');
      const batch = await generateBatch(BATCH.size, this.userWeights);
      if (batch.length === 0) return null;
      this.queue = batch;
      saveToStorage(this.queue);
    }

    const question = this.queue.shift()!;
    saveToStorage(this.queue);

    console.log(
      LOG_PREFIX,
      `Served question (${this.queue.length} remaining): "${question.questionText}"`,
    );

    // Trigger preload when running low
    if (this.queue.length <= BATCH.threshold && !this.preloading) {
      this.triggerPreload();
    }

    return question;
  }

  /** How many questions are queued. */
  get remaining(): number {
    return this.queue.length;
  }

  /** Clear the cache and queue (e.g. when settings change). */
  reset(): void {
    console.log(LOG_PREFIX, 'Reset — clearing queue and cache');
    this.queue = [];
    this.loading = true;
    this.empty = false;
    this.preloading = false;
    this.preloadPromise = null;
    clearStorage();
  }

  /* ---- internal ---- */

  private triggerPreload(): void {
    if (this.preloading) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.preloading = true;

    console.log(LOG_PREFIX, `Preloading next batch (threshold=${BATCH.threshold})...`);

    this.preloadPromise = generateBatch(BATCH.size, this.userWeights)
      .then((batch) => {
        if (batch.length > 0) {
          this.queue.push(...batch);
          saveToStorage(this.queue);
          console.log(LOG_PREFIX, `Preloaded ${batch.length} questions (total queued: ${this.queue.length})`);
        } else {
          console.warn(LOG_PREFIX, 'Preload returned 0 questions');
        }
      })
      .catch((err) => {
        console.error(LOG_PREFIX, 'Preload error:', err);
      })
      .finally(() => {
        this.preloading = false;
        this.preloadPromise = null;
      });
  }
}
