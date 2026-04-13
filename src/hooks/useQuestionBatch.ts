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
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [current, setCurrent] = useState<QuestionDTO | null>(null);
  const { user, loading: authLoading } = useAuth();

  // Wait for auth to resolve, then load (or reload when the logged-in user changes).
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setEmpty(false);
      setAuthRequired(false);
      setCurrent(null);

      const loader = new BatchLoader();
      loaderRef.current = loader;

      let userWeights;
      if (user?.id) {
        try {
          userWeights = await fetchUserDifficulty(user.id);
        } catch (err) {
          console.warn('[useQuestionBatch] Failed to fetch user difficulty, using defaults:', err);
        }
      }

      try {
        await loader.init(userWeights);
      } catch (err) {
        if (cancelled) return;
        const status = (err as Error & { status?: number })?.status;
        if (status === 401) {
          setAuthRequired(true);
          setLoading(false);
          return;
        }
        setLoading(false);
        throw err;
      }

      if (cancelled) return;

      if (loader.empty) {
        setLoading(false);
        setEmpty(true);
        return;
      }

      const first = await loader.next();
      if (cancelled) return;

      setCurrent(first);
      setLoading(false);
      setEmpty(!first);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

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
