/**
 * User Service — v1-1
 *
 * Handles user profile creation and management.
 * On first Google login, creates rows in:
 *   - public.users  (display_name, google_id, avatar_url)
 *   - user_stats    (zeroed counters)
 *   - user_difficulty_profile (env defaults)
 */

import { supabase } from '@/lib/supabase';
import { DIFFICULTY_WEIGHTS } from '@/services/config';
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
 * Given a Supabase Auth user (from Google login), ensure our public.users
 * row (and related rows) exist. Returns the AppUser profile.
 *
 * Idempotent — safe to call on every auth state change.
 * Retries once on AbortError (caused by React StrictMode lifecycle).
 */
export async function ensureUserExists(
  authUser: SupabaseAuthUser,
  _retry = false,
): Promise<AppUser | null> {
  const uid = authUser.id;
  console.log(LOG, `Ensuring user exists: ${uid}${_retry ? ' (retry)' : ''}`);

  // 1. Try to read existing user row
  let existing: { id: string; display_name: string | null; avatar_url: string | null; google_id: string | null; is_admin: boolean } | null = null;

  try {
    const { data, error: readErr } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, google_id, is_admin')
      .eq('id', uid)
      .maybeSingle();

    if (readErr) {
      // If it looks like an AbortError and we haven't retried, wait and retry
      if (!_retry && isAbortError(readErr)) {
        console.warn(LOG, 'AbortError reading user, retrying in 500ms...');
        await new Promise((r) => setTimeout(r, 500));
        return ensureUserExists(authUser, true);
      }
      console.error(LOG, 'Error reading user:', readErr.message);
      return null;
    }

    existing = data;
  } catch (err) {
    if (!_retry && isAbortError(err)) {
      console.warn(LOG, 'AbortError (thrown) reading user, retrying in 500ms...');
      await new Promise((r) => setTimeout(r, 500));
      return ensureUserExists(authUser, true);
    }
    throw err;
  }

  if (existing) {
    console.log(LOG, 'User already exists:', existing.display_name);
    return mapToAppUser(existing);
  }

  // 2. First login — create user row
  const meta = authUser.user_metadata ?? {};
  const displayName = meta.full_name ?? meta.name ?? 'لاعب جديد';
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null;
  const googleId = meta.provider_id ?? authUser.app_metadata?.provider_id ?? null;

  console.log(LOG, 'Creating new user:', { uid, displayName, googleId });

  const { error: insertErr } = await supabase
    .from('users')
    .insert({
      id: uid,
      display_name: displayName,
      avatar_url: avatarUrl,
      google_id: googleId,
      is_admin: false,
    });

  if (insertErr) {
    console.error(LOG, 'Error inserting user:', insertErr.message);
    return null;
  }

  // 3. Create user_stats (zeroed)
  const { error: statsErr } = await supabase
    .from('user_stats')
    .insert({ user_id: uid });

  if (statsErr) {
    console.error(LOG, 'Error inserting user_stats:', statsErr.message);
    // Non-fatal — user row exists, stats can be created later
  }

  // 4. Create user_difficulty_profile with env defaults
  const { error: diffErr } = await supabase
    .from('user_difficulty_profile')
    .insert({
      user_id: uid,
      easy_weight: DIFFICULTY_WEIGHTS.easy,
      medium_weight: DIFFICULTY_WEIGHTS.medium,
      hard_weight: DIFFICULTY_WEIGHTS.hard,
    });

  if (diffErr) {
    console.error(LOG, 'Error inserting user_difficulty_profile:', diffErr.message);
  }

  console.log(LOG, 'User created successfully');

  return {
    id: uid,
    displayName,
    avatarUrl,
    googleId,
    isAdmin: false,
  };
}

/* -----------------------------------------------------------------------
   Profile operations
   ----------------------------------------------------------------------- */

/** Update the user's display name. */
export async function updateDisplayName(
  userId: string,
  newName: string,
): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed) return false;

  const { error } = await supabase
    .from('users')
    .update({ display_name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error(LOG, 'Error updating display name:', error.message);
    return false;
  }

  return true;
}

/** Fetch user_stats for a given user. */
export async function fetchUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .select('lifetime_points, total_questions_answered, best_session_questions')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    console.error(LOG, 'Error fetching user_stats:', error?.message ?? 'not found');
    return null;
  }

  return {
    lifetimePoints: data.lifetime_points,
    totalQuestionsAnswered: data.total_questions_answered,
    bestSessionQuestions: data.best_session_questions,
  };
}

/* -----------------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------------- */

function mapToAppUser(row: {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  google_id: string | null;
  is_admin: boolean;
}): AppUser {
  return {
    id: row.id,
    displayName: row.display_name ?? 'لاعب',
    avatarUrl: row.avatar_url,
    googleId: row.google_id,
    isAdmin: row.is_admin,
  };
}
