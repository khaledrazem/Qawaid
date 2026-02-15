-- ---------------------------------------------------------------------------
-- v1-2: Denormalize display_name and avatar_url onto monthly_scores.
--
-- The leaderboard queries monthly_scores. Previously it joined with users
-- to get display info, but users has RLS (own-row only). By storing the
-- display info directly on monthly_scores (which has a public SELECT
-- policy), the leaderboard works without any join to users.
-- ---------------------------------------------------------------------------

ALTER TABLE monthly_scores ADD COLUMN display_name text;
ALTER TABLE monthly_scores ADD COLUMN avatar_url text;
