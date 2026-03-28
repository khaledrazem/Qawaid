-- min_options is now a global constant in backend (MCQ_MIN_OPTIONS), not stored per question.
ALTER TABLE questions DROP COLUMN IF EXISTS min_options;
