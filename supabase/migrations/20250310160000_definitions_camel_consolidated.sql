-- CAMeL-aligned definitions: consolidate word-specific definitions (هذه/هذان/هذين etc.)
-- into grammar-category definitions identified by CAMeL morphology. 24 definitions total.
-- After running: re-link prompts via auto-detect or admin UI (prompt_definitions will be empty).
-- Reference: https://camel-tools.readthedocs.io/en/stable/reference/camel_morphology_features.html

TRUNCATE question_reports, prompt_definitions, questions, category_definitions, definitions, categories RESTART IDENTITY CASCADE;

-- Categories (unchanged)
INSERT INTO categories (name, is_active) VALUES
  ('الاستفهام', true),
  ('النفي', true),
  ('جنس', true),
  ('المعرفة', true),
  ('النسبة', true),
  ('العدد', true),
  ('ضمائر', true),
  ('الإشارة', true),
  ('المكان', true),
  ('زمان', true),
  ('أقسام الجملة', true),
  ('صفة', true),
  ('الاسم الموصول', true),
  ('زمان الفعل', true);

-- 24 definitions: consolidated where CAMeL identifies (indicator null; camel_feature_map used only)
CREATE TEMP TABLE _seed_defs (
  label text,
  description text,
  indicator text,
  category_name text,
  camel_feature_map jsonb
);

INSERT INTO _seed_defs (label, description, indicator, category_name, camel_feature_map) VALUES
  -- العدد (3: MCQ)
  ('مفرد', 'يدل على واحد فقط', NULL, 'العدد', '[{"feature":"form_num","value":"s"},{"feature":"num","value":"s"}]'::jsonb),
  ('جمع', 'ادوات الجمع هي ما تدل على أكثر من اثنين', NULL, 'العدد', '[{"feature":"form_num","value":"p"},{"feature":"num","value":"p"}]'::jsonb),
  ('مثنى', 'يدل على اثنين', NULL, 'العدد', '[{"feature":"form_num","value":"d"},{"feature":"num","value":"d"}]'::jsonb),
  -- الاستفهام (1: CAMeL part_interrog, pron_interrog, adv_interrog)
  ('أداة استفهام', 'أدوات الاستفهام تسأل بها عن شيء أو حدث أو حال', NULL, 'الاستفهام', '[{"feature":"pos","value":"part_interrog"},{"feature":"pos","value":"pron_interrog"},{"feature":"pos","value":"adv_interrog"}]'::jsonb),
  -- النفي (1: CAMeL part_neg, verb_pseudo, prc0)
  ('أداة نفي', 'أدوات النفي تدخل على الجملة لنفي مضمونها', NULL, 'النفي', '[{"feature":"pos","value":"part_neg"},{"feature":"pos","value":"verb_pseudo"},{"feature":"prc0","value":"lA_neg"},{"feature":"prc0","value":"mA_neg"},{"feature":"prc0","value":"ma_neg"}]'::jsonb),
  -- جنس (2: MCQ)
  ('مذكر', 'يدل على جنس الذكر', NULL, 'جنس', '[{"feature":"gen","value":"m"},{"feature":"form_gen","value":"m"}]'::jsonb),
  ('مؤنث', 'علامة التأنيث تكون في آخر الاسم وتدل على تأنيثه', NULL, 'جنس', '[{"feature":"gen","value":"f"},{"feature":"form_gen","value":"f"}]'::jsonb),
  -- المعرفة (2: MCQ)
  ('معرف', 'ال التعريف تعرف الاسم النكرة', NULL, 'المعرفة', '[{"feature":"stt","value":"d"},{"feature":"prc0","value":"Al_det"}]'::jsonb),
  ('نكرة', 'دلالة على مسمى عام غير معين', NULL, 'المعرفة', '[{"feature":"stt","value":"i"}]'::jsonb),
  -- النسبة (2: no CAMeL)
  ('منسوب', 'يدل على النسبة إلى بلد أو مكان أو صفة', NULL, 'النسبة', '[]'::jsonb),
  ('منسوب اليه', 'الاسم الذي تُنسب إليه الصفة', NULL, 'النسبة', '[]'::jsonb),
  -- ضمائر (1: CAMeL pron)
  ('ضمير', 'ضمير يغني عن اسم ظاهر', NULL, 'ضمائر', '[{"feature":"pos","value":"pron"}]'::jsonb),
  -- الإشارة (1: CAMeL pron_dem, part_dem)
  ('اسم إشارة', 'اسم إشارة يدل على معين بالإشارة (هذا، هذه، ذلك، هذان، ...)', NULL, 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  -- المكان، زمان (1 each: no CAMeL)
  ('المكان', 'يدل على مكان حدوث الفعل', NULL, 'المكان', '[]'::jsonb),
  ('زمان', 'يدل على زمن حدوث الفعل', NULL, 'زمان', '[]'::jsonb),
  -- أقسام الجملة (3: MCQ, drag_and_match)
  ('اسم', 'كلمة تدل على معنى في نفسها دون اقتران بزمن', NULL, 'أقسام الجملة', '[{"feature":"pos","value":"noun"},{"feature":"pos","value":"noun_prop"},{"feature":"pos","value":"noun_num"},{"feature":"pos","value":"noun_quant"},{"feature":"pos","value":"pron"},{"feature":"pos","value":"adj"}]'::jsonb),
  ('فعل', 'كلمة تدل على حدث مقترن بزمن', NULL, 'أقسام الجملة', '[{"feature":"pos","value":"verb"},{"feature":"pos","value":"verb_pseudo"}]'::jsonb),
  ('حرف', 'كلمة تدل على معنى في غيرها', NULL, 'أقسام الجملة', '[{"feature":"pos","value":"part"},{"feature":"pos","value":"part_dem"},{"feature":"pos","value":"part_det"},{"feature":"pos","value":"part_focus"},{"feature":"pos","value":"part_fut"},{"feature":"pos","value":"part_interrog"},{"feature":"pos","value":"part_neg"},{"feature":"pos","value":"part_restrict"},{"feature":"pos","value":"part_verb"},{"feature":"pos","value":"part_voc"},{"feature":"pos","value":"prep"},{"feature":"pos","value":"conj"},{"feature":"pos","value":"conj_sub"}]'::jsonb),
  -- زمان الفعل (3: MCQ)
  ('ماضي', 'فعل يدل على حدث وقع في الماضي', NULL, 'زمان الفعل', '[{"feature":"asp","value":"p"}]'::jsonb),
  ('مضارع', 'فعل يدل على حدث يقع في الحاضر أو المستقبل', NULL, 'زمان الفعل', '[{"feature":"asp","value":"i"}]'::jsonb),
  ('امر', 'فعل يدل على طلب حدوث الفعل', NULL, 'زمان الفعل', '[{"feature":"asp","value":"c"}]'::jsonb),
  -- صفة (2: صفة CAMeL adj; موصوف no CAMeL)
  ('صفة', 'كلمة تدل على وصف لاسم', NULL, 'صفة', '[{"feature":"pos","value":"adj"},{"feature":"pos","value":"adj_comp"},{"feature":"pos","value":"adj_num"}]'::jsonb),
  ('موصوف', 'الاسم الذي توصفه الصفة', NULL, 'صفة', '[]'::jsonb),
  -- الاسم الموصول (1: CAMeL pron_rel)
  ('اسم موصول', 'اسم موصول يربط جملة صلة بما قبله (الذي، التي، من، ما، ...)', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb);

DO $$
DECLARE
  r RECORD;
  def_id uuid;
  cat_id uuid;
BEGIN
  FOR r IN SELECT label, description, category_name, camel_feature_map FROM _seed_defs
  LOOP
    INSERT INTO definitions (label, description, is_active, camel_feature_map)
    VALUES (r.label, r.description, true, COALESCE(r.camel_feature_map, '[]'::jsonb))
    RETURNING id INTO def_id;
    SELECT id INTO cat_id FROM categories WHERE name = r.category_name LIMIT 1;
    IF cat_id IS NOT NULL THEN
      INSERT INTO category_definitions (category_id, definition_id)
      VALUES (cat_id, def_id)
      ON CONFLICT (category_id, definition_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

DROP TABLE _seed_defs;

-- Question templates (unchanged; use {definition} -> new labels e.g. أداة استفهام، اسم إشارة)
INSERT INTO questions (question_text, category_id, type, is_active)
SELECT q.question_text, c.id, q.type::question_type, true
FROM (VALUES
  ('ما دور الكلمة المحددة؟', 'أقسام الجملة', 'MCQ'),
  ('ما الكلمة في الجملة التي هي {definition}؟', 'العدد', 'click_word'),
  ('ما الكلمة في الجملة التي هي {definition}؟', 'الاستفهام', 'click_word'),
  ('هل هذه جملة استفهام أم لا؟', 'الاستفهام', 'yes_no'),
  ('ما الكلمة التي تدل على النفي؟', 'النفي', 'click_word'),
  ('هل هذه نفي أم لا؟', 'النفي', 'yes_no'),
  ('هل الكلمة المحددة مذكر أم مؤنث؟', 'جنس', 'MCQ'),
  ('ما عدد الكلمة المحددة؟', 'العدد', 'MCQ'),
  ('الكلمة المحددة معرف أو نكرة؟', 'المعرفة', 'MCQ'),
  ('انقر على {definition}', 'صفة', 'click_word'),
  ('انقر على {definition}', 'الاسم الموصول', 'click_word'),
  ('ما زمن الفعل المحدد؟', 'زمان الفعل', 'MCQ'),
  ('طابق الكلمات مع التعريف الصحيح', 'أقسام الجملة', 'drag_and_match')
) AS q(question_text, category_name, type)
JOIN categories c ON c.name = q.category_name;
