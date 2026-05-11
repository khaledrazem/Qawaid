import { LEADERBOARD } from '@/services/config';
import { backendRequestWithAuth } from '@/services/backendApi';
import { readCache, writeCache } from '@/services/localCache';
import type { LeaderboardDTO, LeaderboardEntryDTO } from '@/types/dto';

const LOG = '[LeaderboardService]';
const MONTHLY_CACHE_KEY = 'sahra_leaderboard_monthly_v1';
const GLOBAL_CACHE_KEY = 'sahra_leaderboard_global_v1';
const LEADERBOARD_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

/** Get the current month string in YYYY-MM format. */
function currentMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Fetch the monthly leaderboard for the current month.
 * User context comes from the Supabase JWT (Authorization header).
 */
export async function fetchLeaderboard(): Promise<LeaderboardDTO> {
  const month = currentMonth();
  console.log(LOG, `Fetching leaderboard for month=${month}`);
  const data = await backendRequestWithAuth<LeaderboardDTO>('/api/leaderboard/monthly', { method: 'GET' });

  // Client-side trimming if needed (backend already provides rank)
  const topUsers = data.topUsers.slice(0, LEADERBOARD.topCount);
  const surroundingUsers = data.surroundingUsers;
  return { topUsers, surroundingUsers, currentUserRank: data.currentUserRank };
}

export function getCachedLeaderboard(): LeaderboardDTO | null {
  return readCache<LeaderboardDTO>(MONTHLY_CACHE_KEY, LEADERBOARD_CACHE_MAX_AGE_MS);
}

export async function fetchLeaderboardFresh(): Promise<LeaderboardDTO> {
  const data = await fetchLeaderboard();
  writeCache(MONTHLY_CACHE_KEY, data);
  return data;
}

/**
 * Fetch global all-time top users.
 * Aggregates all monthly_scores across all months.
 */
export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntryDTO[]> {
  console.log(LOG, 'Fetching global leaderboard');
  const data = await backendRequestWithAuth<LeaderboardEntryDTO[]>('/api/leaderboard/global', { method: 'GET' });
  // Backend already ranks; client can slice to desired size
  return data.slice(0, LEADERBOARD.topCount + LEADERBOARD.surroundingCount);
}

export function getCachedGlobalLeaderboard(): LeaderboardEntryDTO[] | null {
  return readCache<LeaderboardEntryDTO[]>(GLOBAL_CACHE_KEY, LEADERBOARD_CACHE_MAX_AGE_MS);
}

export async function fetchGlobalLeaderboardFresh(): Promise<LeaderboardEntryDTO[]> {
  const data = await fetchGlobalLeaderboard();
  writeCache(GLOBAL_CACHE_KEY, data);
  return data;
}
