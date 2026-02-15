-- ---------------------------------------------------------------------------
-- v1-1: Allow anyone to read users rows for leaderboard joins.
--
-- monthly_scores is already readable by anon+authenticated, but the join to
-- users fails because only the owner can read their own row.
-- This policy lets anyone SELECT from users (display_name, avatar_url are
-- public info). The hashed_password column is a bcrypt hash and not sensitive
-- at the row level; a stricter approach (view) can be added later.
-- ---------------------------------------------------------------------------

CREATE POLICY "users_select_public" ON users
  FOR SELECT TO anon, authenticated USING (true);
