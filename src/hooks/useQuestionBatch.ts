/**
 * useQuestionBatch — React hook that wraps the BatchLoader for the Play screen.
 *
 * Provides:
 *  - loading: true while the initial batch is being fetched
 *  - empty: true if no playable content exists
 *  - current: the current QuestionDTO (or null)
 *  - advance(): move to the next question
 *  - reset(): clear cache and reload (e.g. after settings change)
 *
 * When a user is logged in, fetches their difficulty profile and passes it
 * to the BatchLoader so question difficulty is personalised.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BatchLoader } from '@/services/batchLoader';
import { fetchUserDifficulty } from '@/services/difficultyAdaptation';
import { useAuth } from '@/contexts/AuthContext';
import type { QuestionDTO } from '@/types/dto';

interface UseQuestionBatchReturn {
  loading: boolean;
  empty: boolean;
  /** True when the backend returned 401 — user must sign in to play. */
  authRequired: boolean;
  current: QuestionDTO | null;
  advance: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useQuestionBatch(): UseQuestionBatchReturn {
  const loaderRef = useRef<BatchLoader | null>(null);
  const initStarted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [current, setCurrent] = useState<QuestionDTO | null>(null);
  const { user } = useAuth();

  // Initialize on mount — guard against StrictMode double-mount.
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    const init = async () => {
      const loader = new BatchLoader();
      loaderRef.current = loader;

      // Fetch user-specific difficulty weights if logged in
      let userWeights;
      if (user?.id) {
        try {
          userWeights = await fetchUserDifficulty(user.id);
          console.log('[useQuestionBatch] Using user difficulty weights:', userWeights);
        } catch (err) {
          console.warn('[useQuestionBatch] Failed to fetch user difficulty, using defaults:', err);
        }
      }

      try {
        await loader.init(userWeights);
      } catch (err) {
        const status = (err as Error & { status?: number })?.status;
        if (status === 401) {
          setAuthRequired(true);
          setLoading(false);
          return;
        }
        throw err;
      }

      if (loader.empty) {
        setLoading(false);
        setEmpty(true);
        return;
      }

      // Serve the first question
      const first = await loader.next();

      setCurrent(first);
      setLoading(false);
      setEmpty(!first);
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(async () => {
    const loader = loaderRef.current;
    if (!loader) return;

    const next = await loader.next();
    setCurrent(next);

    if (!next) {
      setEmpty(true);
    }
  }, []);

  const reset = useCallback(async () => {
    const loader = loaderRef.current;
    if (!loader) return;

    setLoading(true);
    setCurrent(null);
    setEmpty(false);

    // Re-fetch user weights on reset too
    let userWeights;
    if (user?.id) {
      try {
        userWeights = await fetchUserDifficulty(user.id);
      } catch { /* use defaults */ }
    }

    loader.reset();
    try {
      await loader.init(userWeights);
    } catch (err) {
      const status = (err as Error & { status?: number })?.status;
      if (status === 401) {
        setAuthRequired(true);
        setLoading(false);
        return;
      }
      throw err;
    }

    if (loader.empty) {
      setLoading(false);
      setEmpty(true);
      return;
    }

    const first = await loader.next();
    setCurrent(first);
    setLoading(false);
    setEmpty(!first);
  }, [user]);

  return { loading, empty, authRequired, current, advance, reset };
}
