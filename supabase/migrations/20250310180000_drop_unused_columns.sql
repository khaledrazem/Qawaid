-- Drop columns whose data we no longer use.
-- - definitions.indicator, definitions.indicator_position: matching is CAMeL-only; these are unused.
-- - prompts.version: never read or written by the app.

ALTER TABLE definitions DROP COLUMN IF EXISTS indicator;
ALTER TABLE definitions DROP COLUMN IF EXISTS indicator_position;
ALTER TABLE prompts DROP COLUMN IF EXISTS version;
