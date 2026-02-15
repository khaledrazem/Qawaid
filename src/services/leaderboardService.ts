/**
 * Leaderboard Service — v1-2
 *
 * Reads monthly_scores directly (display_name and avatar_url are
 * denormalized onto that table) so we never need to join with the
 * RLS-protected users table.
 */

import { supabase } from '@/lib/supabase';
import { LEADERBOARD } from '@/services/config';
import type { LeaderboardDTO, LeaderboardEntryDTO } from '@/types/dto';

const LOG = '[LeaderboardService]';

/** Get the current month string in YYYY-MM format. */
function currentMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Fetch the monthly leaderboard for the current month.
 *
 * @param userId - (optional) current user's ID for surrounding entries.
 *                 null for guests.
 */
export async function fetchLeaderboard(
  userId: string | null = null,
): Promise<LeaderboardDTO> {
  const month = currentMonth();
  console.log(LOG, `Fetching leaderboard for month=${month}, userId=${userId ?? 'guest'}`);

  // Read directly — no join needed; display info lives on monthly_scores
  const { data, error } = await supabase
    .from('monthly_scores')
    .select('user_id, points, display_name, avatar_url')
    .eq('month', month)
    .order('points', { ascending: false });

  if (error) {
    console.error(LOG, 'Error fetching leaderboard:', error.message);
    return { topUsers: [], surroundingUsers: [], currentUserRank: null };
  }

  if (!data || data.length === 0) {
    console.log(LOG, 'No leaderboard data for this month');
    return { topUsers: [], surroundingUsers: [], currentUserRank: null };
  }

  // Map raw rows → LeaderboardEntryDTO with rank
  const entries: LeaderboardEntryDTO[] = data.map((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name ?? 'مجهول',
    avatarUrl: row.avatar_url ?? undefined,
    rank: index + 1,
    points: row.points,
  }));

  // Top N
  const topUsers = entries.slice(0, LEADERBOARD.topCount);

  // Surrounding users (±N around current user)
  let surroundingUsers: LeaderboardEntryDTO[] = [];
  let currentUserRank: number | null = null;

  if (userId) {
    const userIndex = entries.findIndex((e) => e.userId === userId);
    if (userIndex >= 0) {
      currentUserRank = entries[userIndex].rank;
      const start = Math.max(0, userIndex - LEADERBOARD.surroundingCount);
      const end = Math.min(entries.length, userIndex + LEADERBOARD.surroundingCount + 1);
      surroundingUsers = entries.slice(start, end);

      // Remove entries already in topUsers to avoid duplicates
      const topIds = new Set(topUsers.map((u) => u.userId));
      surroundingUsers = surroundingUsers.filter((u) => !topIds.has(u.userId));
    }
  }

  console.log(LOG, `Results: ${entries.length} total, top=${topUsers.length}, surrounding=${surroundingUsers.length}, rank=${currentUserRank}`);

  return { topUsers, surroundingUsers, currentUserRank };
}

/**
 * Fetch global all-time top users.
 * Aggregates all monthly_scores across all months.
 */
export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntryDTO[]> {
  console.log(LOG, 'Fetching global leaderboard');

  // Fetch all scores — no join needed
  const { data, error } = await supabase
    .from('monthly_scores')
    .select('user_id, points, display_name, avatar_url');

  if (error || !data || data.length === 0) {
    console.log(LOG, 'No global data:', error?.message ?? 'empty');
    return [];
  }

  // Aggregate points per user; keep the most recent display_name
  const agg = new Map<string, { points: number; displayName: string; avatarUrl?: string }>();
  for (const row of data) {
    const existing = agg.get(row.user_id);
    if (existing) {
      existing.points += row.points;
      // Overwrite display info — later rows (more recent months) win
      if (row.display_name) existing.displayName = row.display_name;
      if (row.avatar_url) existing.avatarUrl = row.avatar_url;
    } else {
      agg.set(row.user_id, {
        points: row.points,
        displayName: row.display_name ?? 'مجهول',
        avatarUrl: row.avatar_url ?? undefined,
      });
    }
  }

  // Sort and rank
  const sorted = [...agg.entries()]
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, LEADERBOARD.topCount + LEADERBOARD.surroundingCount);

  return sorted.map(([userId, info], index) => ({
    userId,
    displayName: info.displayName,
    avatarUrl: info.avatarUrl,
    rank: index + 1,
    points: info.points,
  }));
}
