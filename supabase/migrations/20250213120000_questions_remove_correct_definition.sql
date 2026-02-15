-- Remove correct_definition_id from questions; correct answer is derived from prompt_definitions when building a question.
-- Pipeline: pick prompt → pick one prompt_definition (word/letter) → that definition is the correct answer; find a question template by category.

DROP INDEX IF EXISTS idx_questions_correct_definition;
ALTER TABLE questions DROP COLUMN IF EXISTS correct_definition_id;

COMMENT ON TABLE questions IS 'Question templates: text, category, type. Correct answer for a given prompt comes from the chosen prompt_definition (definition linked to a word/letter in the prompt).';
