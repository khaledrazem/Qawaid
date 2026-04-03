-- Morphological features (CAMeL vox, mod, cas, per, rat): categories, definitions, questions.
-- Does not seed enc0/prc*. Idempotent: skips definitions that already exist by label; questions deduped by text+type+category.
-- Playable batch still requires prompts + prompt_definitions (add via admin or follow-up migration).

-- Categories
INSERT INTO categories (name, is_active) VALUES
  ('الصوت', true),
  ('مزاج الفعل', true),
  ('إعراب الاسم', true),
  ('شخص الفعل', true),
  ('العقلانية', true)
ON CONFLICT (name) DO NOTHING;

CREATE TEMP TABLE _seed_defs (
  label text,
  description text,
  category_name text,
  camel_feature_map jsonb
);

INSERT INTO _seed_defs (label, description, category_name, camel_feature_map) VALUES
  ('مبني للمعلوم', 'الفعل المبني للمعلوم يدل على فاعل ظاهر', 'الصوت', '[{"feature":"vox","value":"a"}]'::jsonb),
  ('مبني للمجهول', 'الفعل المبني للمجهول يدل على المفعول به كفاعل لفظي', 'الصوت', '[{"feature":"vox","value":"p"}]'::jsonb),
  ('صوت معلوم', 'مرادف لتمييز الصوت المعلوم في التمارين', 'الصوت', '[{"feature":"vox","value":"a"}]'::jsonb),
  ('صوت مجهول', 'مرادف لتمييز الصوت المجهول في التمارين', 'الصوت', '[{"feature":"vox","value":"p"}]'::jsonb),
  ('فعل مرفوع', 'فعل مضارع مرفوع', 'مزاج الفعل', '[{"feature":"mod","value":"i"}]'::jsonb),
  ('فعل مجزوم', 'فعل مضارع مجزوم', 'مزاج الفعل', '[{"feature":"mod","value":"j"}]'::jsonb),
  ('فعل منصوب', 'فعل مضارع منصوب', 'مزاج الفعل', '[{"feature":"mod","value":"s"}]'::jsonb),
  ('مزاج جازم', 'صيغة مجزومة للفعل المضارع', 'مزاج الفعل', '[{"feature":"mod","value":"j"}]'::jsonb),
  ('اسم مرفوع', 'اسم حالته الرفع', 'إعراب الاسم', '[{"feature":"cas","value":"n"}]'::jsonb),
  ('اسم منصوب', 'اسم حالته النصب', 'إعراب الاسم', '[{"feature":"cas","value":"a"}]'::jsonb),
  ('اسم مجرور', 'اسم حالته الجر', 'إعراب الاسم', '[{"feature":"cas","value":"g"}]'::jsonb),
  ('حالة جر', 'مرادف لتمييز الجر في التمارين', 'إعراب الاسم', '[{"feature":"cas","value":"g"}]'::jsonb),
  ('متكلم', 'الفعل للمتكلم', 'شخص الفعل', '[{"feature":"per","value":"1"}]'::jsonb),
  ('مخاطب', 'الفعل للمخاطب', 'شخص الفعل', '[{"feature":"per","value":"2"}]'::jsonb),
  ('غائب', 'الفعل للغائب', 'شخص الفعل', '[{"feature":"per","value":"3"}]'::jsonb),
  ('شخص غائب', 'مرادف لتمييز الغائب', 'شخص الفعل', '[{"feature":"per","value":"3"}]'::jsonb),
  ('عاقل', 'المسمى عاقل', 'العقلانية', '[{"feature":"rat","value":"y"}]'::jsonb),
  ('غير عاقل', 'المسمى غير عاقل', 'العقلانية', '[{"feature":"rat","value":"n"}]'::jsonb),
  ('مسند عاقل', 'سياق عاقل في التحليل', 'العقلانية', '[{"feature":"rat","value":"y"}]'::jsonb),
  ('مسند غير عاقل', 'سياق غير عاقل في التحليل', 'العقلانية', '[{"feature":"rat","value":"n"}]'::jsonb);

DO $$
DECLARE
  r RECORD;
  def_id uuid;
  cat_id uuid;
BEGIN
  FOR r IN SELECT label, description, category_name, camel_feature_map FROM _seed_defs
  LOOP
    SELECT id INTO def_id FROM definitions WHERE label = r.label LIMIT 1;
    IF def_id IS NULL THEN
      INSERT INTO definitions (label, description, is_active, camel_feature_map)
      VALUES (r.label, r.description, true, COALESCE(r.camel_feature_map, '[]'::jsonb))
      RETURNING id INTO def_id;
    END IF;
    SELECT id INTO cat_id FROM categories WHERE name = r.category_name LIMIT 1;
    IF cat_id IS NOT NULL AND def_id IS NOT NULL THEN
      INSERT INTO category_definitions (category_id, definition_id)
      VALUES (cat_id, def_id)
      ON CONFLICT (category_id, definition_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

DROP TABLE _seed_defs;

-- Question templates (batch engine uses MCQ / click_word / click_letter / click_letter_range only; others for future UI)
INSERT INTO questions (question_text, category_id, type, is_active)
SELECT q.question_text, c.id, q.type::question_type, true
FROM (VALUES
  ('ما الكلمة في الجملة التي توضّح {definition}؟', 'الصوت', 'click_word'),
  ('هل الفعل في الجملة مبنيّ للمعلوم أم للمجهول؟', 'الصوت', 'MCQ'),
  ('هل الفعل المحدّد مبنيّ للمجهول؟', 'الصوت', 'yes_no'),
  ('حوّل الفعل المظلّل ليصبح صيغة {definition}.', 'الصوت', 'transformation'),
  ('ما الكلمة في الجملة التي توضّح {definition}؟', 'مزاج الفعل', 'click_word'),
  ('ما مزاج الفعل المحدّد (مرفوع / منصوب / مجزوم)؟', 'مزاج الفعل', 'MCQ'),
  ('أكمل الفعل بالشكل الصحيح حسب المطلوب.', 'مزاج الفعل', 'fill_in_sentence'),
  ('حوّل الفعل المظلّل ليكون {definition}.', 'مزاج الفعل', 'transformation'),
  ('ما الكلمة التي توضّح {definition} في الجملة؟', 'إعراب الاسم', 'click_word'),
  ('ما إعراب الكلمة المحدّدة؟', 'إعراب الاسم', 'MCQ'),
  ('هل الكلمة المحدّدة مجرورة؟', 'إعراب الاسم', 'yes_no'),
  ('حوّل الكلمة المظلّلة لتُعرَب {definition}.', 'إعراب الاسم', 'transformation'),
  ('ما الكلمة التي تدلّ على {definition}؟', 'شخص الفعل', 'click_word'),
  ('من المتكلّم أم المخاطب أم الغائب؟', 'شخص الفعل', 'MCQ'),
  ('اختر ضمير المتكلّم المناسب.', 'شخص الفعل', 'mcq_fillin'),
  ('حوّل الجملة لتدلّ على أن الفعل لـ{definition}.', 'شخص الفعل', 'transformation'),
  ('ما الكلمة التي توضّح {definition}؟', 'العقلانية', 'click_word'),
  ('هل الاسم عاقل أم غير عاقل في السياق؟', 'العقلانية', 'MCQ'),
  ('هل المسمّى عاقل؟', 'العقلانية', 'yes_no'),
  ('حوّل التعبير ليدلّ على {definition}.', 'العقلانية', 'transformation')
) AS q(question_text, category_name, type)
JOIN categories c ON c.name = q.category_name
LEFT JOIN questions existing
  ON existing.category_id = c.id
  AND existing.question_text = q.question_text
  AND existing.type = q.type::question_type
WHERE existing.id IS NULL;
