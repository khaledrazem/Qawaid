/**
 * Batch Loader — manages question batch lifecycle via backend API.
 *
 * - On init: calls backend playable; if playable, fetches first batch (count, selectedCategoryIds, usedPromptIds, userWeights)
 * - Serves questions via next(); tracks usedPromptIds from served questions
 * - When queue drops to BATCH.threshold, preloads next batch with current usedPromptIds
 * - Caches current queue in localStorage for resilience
 */

import { getPlayable, postBatch } from '@/services/backendApi';
import { getSelectedCategories } from '@/components/SettingsModal';
import { BATCH, OFFLINE } from '@/services/config';
import type { DifficultyWeights } from '@/services/difficultyAdaptation';
import type { QuestionDTO } from '@/types/dto';

const LOG_PREFIX = '[BatchLoader]';
const STORAGE_KEY = 'sahra_question_batch';

/** Wrapped payload with timestamp so we can expire cache when back online. */
interface StoredBatchPayload {
  updatedAt: number;
  questions: QuestionDTO[];
}

function isNavigatorOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function isCacheExpired(updatedAt: number): boolean {
  if (updatedAt <= 0) return true;
  return Date.now() - updatedAt > OFFLINE.cacheMaxAgeMs;
}

/* -----------------------------------------------------------------------
   localStorage helpers
   ----------------------------------------------------------------------- */

function saveToStorage(questions: QuestionDTO[]): void {
  try {
    const payload: StoredBatchPayload = { updatedAt: Date.now(), questions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    console.warn(LOG_PREFIX, 'Failed to save batch to localStorage');
  }
}

function validateQuestions(arr: QuestionDTO[]): QuestionDTO[] | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  if (!arr[0].categoryId || !arr[0].questionType) {
    console.warn(LOG_PREFIX, 'Stale cache detected, discarding');
    clearStorage();
    return null;
  }
  return arr;
}

/** Raw load including age; legacy format = plain array (treated as expired when online). */
function loadBatchPayload(): StoredBatchPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const questions = validateQuestions(parsed as QuestionDTO[]);
      if (!questions) return null;
      return { updatedAt: 0, questions };
    }
    const obj = parsed as Partial<StoredBatchPayload>;
    if (!obj || !Array.isArray(obj.questions)) return null;
    const questions = validateQuestions(obj.questions as QuestionDTO[]);
    if (!questions) return null;
    const updatedAt =
      typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : 0;
    return { updatedAt, questions };
  } catch {
    return null;
  }
}

function loadFromStorage(): QuestionDTO[] | null {
  const p = loadBatchPayload();
  return p?.questions ?? null;
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Prewarm the question cache for offline play (v1-4).
 * Uses backend batch API when online; no-op when offline or cache already full.
 */
export function prewarmQuestionCache(): void {
  if (!isNavigatorOnline()) return;

  const payload = loadBatchPayload();
  const cached = payload?.questions ?? null;
  const expired = !payload || isCacheExpired(payload.updatedAt);
  if (!expired && cached && cached.length >= OFFLINE.cacheSize) return;

  (async () => {
    if (expired && cached?.length) {
      clearStorage();
      console.log(LOG_PREFIX, 'Cache expired — prewarming fresh questions');
    }
    let total = expired ? 0 : cached?.length ?? 0;
    if (total >= OFFLINE.cacheSize) return;
    try {
      const used = new Set<string>();
      while (total < OFFLINE.cacheSize) {
        const res = await postBatch({
          count: BATCH.size,
          selectedCategoryIds: getSelectedCategories(),
          usedPromptIds: [...used],
        });
        if (!res.questions?.length) break;
        for (const q of res.questions) {
          if (q.promptId) used.add(q.promptId);
        }
        const current = loadBatchPayload()?.questions ?? [];
        const combined = [...current, ...res.questions].slice(0, OFFLINE.cacheSize);
        saveToStorage(combined);
        total = combined.length;
        console.log(LOG_PREFIX, `Prewarm: cache has ${total} questions`);
        if (res.questions.length < BATCH.size) break;
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
  private usedPromptIds = new Set<string>();
  private preloading = false;
  private preloadPromise: Promise<void> | null = null;
  private userWeights?: DifficultyWeights;
  private backgroundRefreshPromise: Promise<void> | null = null;

  /** True when the initial batch is still loading. */
  public loading = true;

  /** True if we tried loading but got zero questions. */
  public empty = false;

  /**
   * Initialize: call backend playable; if playable, fetch first batch (or use cache).
   * @param userWeights - optional per-user difficulty weights (logged-in users)
   */
  async init(userWeights?: DifficultyWeights): Promise<void> {
    this.userWeights = userWeights;
    console.log(LOG_PREFIX, 'Initializing...');

    if (!isNavigatorOnline()) {
      const cached = loadFromStorage();
      if (cached && cached.length > 0) {
        this.queue = cached;
        this.loading = false;
        this.empty = false;
        return;
      }
      console.warn(LOG_PREFIX, 'Offline and no cache — no playable content');
      this.loading = false;
      this.empty = true;
      return;
    }

    const batchPayload = loadBatchPayload();
    const cached = batchPayload?.questions ?? null;
    const cacheStale =
      isNavigatorOnline() &&
      batchPayload != null &&
      cached != null &&
      cached.length > 0 &&
      isCacheExpired(batchPayload.updatedAt);

    if (cached && cached.length > 0) {
      console.log(LOG_PREFIX, `Loaded ${cached.length} questions from cache`);
      this.queue = cached;
      for (const q of cached) {
        if (q.promptId) this.usedPromptIds.add(q.promptId);
      }
      this.loading = false;
      this.empty = false;
      if (cacheStale) {
        console.log(LOG_PREFIX, 'Cache is stale — refreshing in background');
      }
      this.refreshInBackground();
      if (this.queue.length <= BATCH.threshold) this.triggerPreload();
      return;
    }

    try {
      const { playable } = await getPlayable();
      if (!playable) {
        const cached = loadFromStorage();
        if (cached && cached.length > 0) {
          this.queue = cached;
          this.loading = false;
          this.empty = false;
          return;
        }
        console.warn(LOG_PREFIX, 'Backend reports no playable content');
        this.loading = false;
        this.empty = true;
        return;
      }
    } catch (err) {
      console.warn(LOG_PREFIX, 'Playable check failed, trying cache:', err);
      const cached = loadFromStorage();
      if (cached && cached.length > 0) {
        this.queue = cached;
        this.loading = false;
        this.empty = false;
        return;
      }
      this.loading = false;
      this.empty = true;
      return;
    }

    const res = await postBatch({
      count: BATCH.size,
      selectedCategoryIds: getSelectedCategories(),
      usedPromptIds: [],
      userWeights: this.userWeights,
    });
    if (!res.questions?.length) {
      this.loading = false;
      this.empty = true;
      return;
    }
    this.queue = res.questions;
    for (const q of res.questions) {
      if (q.promptId) this.usedPromptIds.add(q.promptId);
    }
    saveToStorage(this.queue);
    this.loading = false;
    this.empty = false;
    console.log(LOG_PREFIX, `Ready with ${this.queue.length} questions`);
    if (this.queue.length <= BATCH.threshold) this.triggerPreload();
  }

  /**
   * Get the next question from the queue.
   * Returns null if queue is exhausted and preload hasn't finished yet.
   */
  async next(): Promise<QuestionDTO | null> {
    if (this.queue.length === 0 && this.preloadPromise) {
      console.log(LOG_PREFIX, 'Queue empty, waiting for preload...');
      await this.preloadPromise;
    }

    if (this.queue.length === 0) {
      if (!isNavigatorOnline()) {
        console.warn(LOG_PREFIX, 'Queue exhausted and offline — no more questions');
        return null;
      }
      try {
        const res = await postBatch({
          count: BATCH.size,
          selectedCategoryIds: getSelectedCategories(),
          usedPromptIds: [...this.usedPromptIds],
          userWeights: this.userWeights,
        });
        if (res.questions?.length) {
          this.queue = res.questions;
          for (const q of res.questions) {
            if (q.promptId) this.usedPromptIds.add(q.promptId);
          }
          saveToStorage(this.queue);
        }
      } catch (err) {
        console.error(LOG_PREFIX, 'Emergency batch failed:', err);
      }
      if (this.queue.length === 0) return null;
    }

    const question = this.queue.shift()!;
    if (question.promptId) this.usedPromptIds.add(question.promptId);
    saveToStorage(this.queue);

    console.log(
      LOG_PREFIX,
      `Served question (${this.queue.length} remaining): "${question.questionText}"`,
    );

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
    this.usedPromptIds = new Set<string>();
    this.loading = true;
    this.empty = false;
    this.preloading = false;
    this.preloadPromise = null;
    clearStorage();
  }

  private triggerPreload(): void {
    if (this.preloading) return;
    if (!isNavigatorOnline()) return;

    this.preloading = true;
    const used = [...this.usedPromptIds];
    console.log(LOG_PREFIX, `Preloading next batch (threshold=${BATCH.threshold})...`);

    this.preloadPromise = postBatch({
      count: BATCH.size,
      selectedCategoryIds: getSelectedCategories(),
      usedPromptIds: used,
      userWeights: this.userWeights,
    })
      .then((res) => {
        if (res.questions?.length) {
          for (const q of res.questions) {
            if (q.promptId) this.usedPromptIds.add(q.promptId);
          }
          this.queue.push(...res.questions);
          saveToStorage(this.queue);
          console.log(LOG_PREFIX, `Preloaded ${res.questions.length} questions (total queued: ${this.queue.length})`);
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

  private refreshInBackground(): void {
    if (!isNavigatorOnline()) return;
    if (this.backgroundRefreshPromise) return;
    this.backgroundRefreshPromise = (async () => {
      try {
        const { playable } = await getPlayable();
        if (!playable) return;
        const fresh = await postBatch({
          count: BATCH.size,
          selectedCategoryIds: getSelectedCategories(),
          usedPromptIds: [],
          userWeights: this.userWeights,
        });
        if (!fresh.questions?.length) return;
        this.queue = fresh.questions;
        this.usedPromptIds = new Set<string>();
        for (const q of fresh.questions) {
          if (q.promptId) this.usedPromptIds.add(q.promptId);
        }
        saveToStorage(this.queue);
        if (this.queue.length <= BATCH.threshold && !this.preloading) {
          this.triggerPreload();
        }
      } catch (err) {
        console.warn(LOG_PREFIX, 'Background refresh failed:', err);
      } finally {
        this.backgroundRefreshPromise = null;
      }
    })();
  }
}
