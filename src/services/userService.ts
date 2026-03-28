/**
 * User Service — v1-1
 *
 * Handles user profile creation and management via backend API (JWT).
 * On first login: session-sync upserts users, user_stats, monthly_scores, user_difficulty_profile.
 */

import { sessionSync, getProfile, patchProfile } from '@/services/backendApi';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

const LOG = '[UserService]';

/* -----------------------------------------------------------------------
   Types
   ----------------------------------------------------------------------- */

export interface AppUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  googleId: string | null;
  isAdmin: boolean;
}

export interface UserStats {
  lifetimePoints: number;
  totalQuestionsAnswered: number;
  bestSessionQuestions: number;
}

/* -----------------------------------------------------------------------
   ensureUserExists
   ----------------------------------------------------------------------- */

/** Check if an error is an AbortError. */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg.includes('AbortError') || msg.includes('signal is aborted')) return true;
  }
  return false;
}

/**
 * Given a Supabase Auth user (from Google login), ensure backend has user
 * and related rows (session-sync), then return AppUser from profile.
 * Idempotent — safe to call on every auth state change.
 */
export async function ensureUserExists(
  authUser: SupabaseAuthUser,
  _retry = false,
): Promise<AppUser | null> {
  const uid = authUser.id;
  console.log(LOG, `Ensuring user exists: ${uid}${_retry ? ' (retry)' : ''}`);

  const meta = authUser.user_metadata ?? {};
  const displayName = meta.full_name ?? meta.name ?? 'لاعب جديد';
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null;

  try {
    await sessionSync(displayName, avatarUrl);
    const profile = await getProfile();
    return {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      googleId: meta.provider_id ?? authUser.app_metadata?.provider_id ?? null,
      isAdmin: profile.isAdmin,
    };
  } catch (err) {
    if (!_retry && isAbortError(err)) {
      console.warn(LOG, 'AbortError, retrying in 500ms...');
      await new Promise((r) => setTimeout(r, 500));
      return ensureUserExists(authUser, true);
    }
    console.error(LOG, 'Error ensuring user:', err);
    return null;
  }
}

/* -----------------------------------------------------------------------
   Profile operations
   ----------------------------------------------------------------------- */

/** Update the user's display name via backend. */
export async function updateDisplayName(
  _userId: string,
  newName: string,
): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed) return false;

  try {
    await patchProfile(trimmed);
    return true;
  } catch (err) {
    console.error(LOG, 'Error updating display name:', err);
    return false;
  }
}

/** Fetch user_stats via backend profile (includes stats when available). */
export async function fetchUserStats(_userId: string): Promise<UserStats | null> {
  try {
    const profile = await getProfile();
    if (
      profile.lifetimePoints === undefined &&
      profile.totalQuestionsAnswered === undefined &&
      profile.bestSessionQuestions === undefined
    ) {
      return null;
    }
    return {
      lifetimePoints: profile.lifetimePoints ?? 0,
      totalQuestionsAnswered: profile.totalQuestionsAnswered ?? 0,
      bestSessionQuestions: profile.bestSessionQuestions ?? 0,
    };
  } catch (err) {
    console.error(LOG, 'Error fetching user stats:', err);
    return null;
  }
}
