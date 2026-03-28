-- v1_1 schema: definitions (description, indicator, indicator_position), prompt_definitions (index_end),
-- prompts (image_url, definition_id), questions (include_definition_ids, extended types), question_reports.
-- Allow duplicate definition labels (e.g. ما in استفهام vs نفي).
ALTER TABLE definitions DROP CONSTRAINT IF EXISTS definitions_label_key;

-- Extend question_type enum with v1_1 types
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'mcq_fillin';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'fill_in_sentence';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'transformation';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'yes_no';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'visual_mcq';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'drag_and_match';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'click_letter_range';

-- definitions: description, indicator, indicator_position
ALTER TABLE definitions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS indicator text,
  ADD COLUMN IF NOT EXISTS indicator_position text;
COMMENT ON COLUMN definitions.indicator_position IS 'prefix | suffix | separate_word';

-- prompt_definitions: index_end (nullable; null = legacy)
ALTER TABLE prompt_definitions
  ADD COLUMN IF NOT EXISTS index_end int;
COMMENT ON COLUMN prompt_definitions.index_end IS 'End char index for span; null = legacy (infer from tokenizer or single letter)';

-- prompts: image_url, definition_id for visual prompts
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS definition_id uuid REFERENCES definitions(id) ON DELETE SET NULL;
COMMENT ON COLUMN prompts.definition_id IS 'When image_url is set, single definition for the whole image (visual_mcq)';

-- questions: included definitions (scoping)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS include_definition_ids jsonb;
COMMENT ON COLUMN questions.include_definition_ids IS 'When non-empty, engine only uses prompt_definitions whose definition_id is in this array for this template';

-- question_reports
CREATE TABLE IF NOT EXISTS question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  definition_id uuid REFERENCES definitions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_reports_prompt ON question_reports(prompt_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_definition ON question_reports(definition_id);

ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question_reports_insert_authenticated" ON question_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "question_reports_select_admin" ON question_reports
  FOR SELECT TO authenticated USING (is_admin_user());
