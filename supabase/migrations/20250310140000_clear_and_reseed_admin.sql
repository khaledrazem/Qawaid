-- Clear all admin-managed content and re-seed with v1.1 plan data (categories, definitions with camel_feature_map, questions).
-- Order: truncate dependent tables first, then categories/definitions. Then insert seed.
-- Reference: https://camel-tools.readthedocs.io/en/latest/reference/camel_morphology_features.html for camel_feature_map values.

TRUNCATE question_reports, prompt_definitions, questions, category_definitions, definitions, categories RESTART IDENTITY CASCADE;

-- Categories
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

-- Definitions + category_definitions; camel_feature_map maps to CAMeL morphology (pos, prc0, asp, form_num, gen, stt, etc.)
CREATE TEMP TABLE _seed_defs (
  label text,
  description text,
  indicator text,
  category_name text,
  camel_feature_map jsonb
);

INSERT INTO _seed_defs (label, description, indicator, category_name, camel_feature_map) VALUES
  ('مفرد', 'يدل على واحد فقط', 'هو,أنت,أنا,هي,هذا,هذه,ذاك,ذلك,تيك,تلك', 'العدد', '[{"feature":"form_num","value":"s"},{"feature":"num","value":"s"}]'::jsonb),
  ('جمع', 'ادوات الجمع هي ما تدل على أكثر من اثنين', 'ون,ين,ات,نحن,أنتم,هم,هؤلاء,أولئك', 'العدد', '[{"feature":"form_num","value":"p"},{"feature":"num","value":"p"}]'::jsonb),
  ('مثنى', 'يدل على اثنين', 'ان,ين,هما,أنتما,أنتن,هذان,هذين,ذانك,ذينِك,هاتان,هاتين,تانك,تينِك', 'العدد', '[{"feature":"form_num","value":"d"},{"feature":"num","value":"d"}]'::jsonb),
  ('من', 'يسأل بها عن العاقل (الانسان)', 'من', 'الاستفهام', '[{"feature":"pos","value":"pron_interrog"}]'::jsonb),
  ('ما', 'يُسأل بها عن غير العاقل (شيء او صفة)', 'ما', 'الاستفهام', '[{"feature":"pos","value":"pron_interrog"},{"feature":"pos","value":"part_interrog"}]'::jsonb),
  ('أي', 'يُطلب بها تعيين أحد الشيئين أو الأشياء', 'أي', 'الاستفهام', '[{"feature":"pos","value":"pron_interrog"}]'::jsonb),
  ('ماذا', 'يُسأل بها عن غير العاقل (شيء او صفة)', 'ماذا', 'الاستفهام', '[{"feature":"pos","value":"pron_interrog"}]'::jsonb),
  ('هل', 'يُسأل بها عن وقوع حدث', 'هل', 'الاستفهام', '[{"feature":"pos","value":"part_interrog"}]'::jsonb),
  ('متى', 'يُسأل بها عن الزمان', 'متى', 'الاستفهام', '[{"feature":"pos","value":"adv_interrog"}]'::jsonb),
  ('أين', 'يُسأل بها عن المكان', 'أين', 'الاستفهام', '[{"feature":"pos","value":"adv_interrog"}]'::jsonb),
  ('كم', 'يُسأل بها عن العدد والمقدار', 'كم', 'الاستفهام', '[{"feature":"pos","value":"pron_interrog"}]'::jsonb),
  ('كيف', 'يُسأل بها عن الهيئة والحال', 'كيف', 'الاستفهام', '[{"feature":"pos","value":"adv_interrog"}]'::jsonb),
  ('لن', 'تدخل على الفعل المضارع لنفي وقوع الحدث في المستقبل', 'لن', 'النفي', '[{"feature":"pos","value":"part_neg"}]'::jsonb),
  ('ليس', 'تدخل على الجملة الاسمية لنفي مضمونها', 'ليس', 'النفي', '[{"feature":"pos","value":"verb_pseudo"}]'::jsonb),
  ('لا', 'تدخل على الأسماء والأفعال للنفي', 'لا', 'النفي', '[{"feature":"pos","value":"part_neg"},{"feature":"prc0","value":"lA_neg"}]'::jsonb),
  ('لم', 'تدخل على الفعل المضارع لنفي وقوع الحدث في الماضي', 'لم', 'النفي', '[{"feature":"pos","value":"part_neg"}]'::jsonb),
  ('ما', 'تستعمل للنفي وتدخل على الأسماء والأفعال', 'ما', 'النفي', '[{"feature":"pos","value":"part_neg"},{"feature":"prc0","value":"mA_neg"},{"feature":"prc0","value":"ma_neg"}]'::jsonb),
  ('مذكر', 'يدل على جنس الذكر', 'هذا,ذاك,ذلك,هذان,هذين,ذانك,ذينك', 'جنس', '[{"feature":"gen","value":"m"},{"feature":"form_gen","value":"m"}]'::jsonb),
  ('مؤنث', 'علامة التأنيث تكون في آخر الاسم وتدل على تأنيثه', 'ة,ى,اء,هذه,تيك,تلك,هاتان,هاتين,تانك,تينك', 'جنس', '[{"feature":"gen","value":"f"},{"feature":"form_gen","value":"f"}]'::jsonb),
  ('معرف', 'ال التعريف تعرف الاسم النكرة', 'ال', 'المعرفة', '[{"feature":"stt","value":"d"},{"feature":"prc0","value":"Al_det"}]'::jsonb),
  ('نكرة', 'دلالة على مسمى عام غير معين', NULL, 'المعرفة', '[{"feature":"stt","value":"i"}]'::jsonb),
  ('منسوب', 'يدل على النسبة إلى بلد أو مكان أو صفة', 'ي', 'النسبة', '[]'::jsonb),
  ('منسوب اليه', 'الاسم الذي تُنسب إليه الصفة', NULL, 'النسبة', '[]'::jsonb),
  ('ضمير المنفصلة', 'ضمائر تأتي منفصلة عن الكلمة', 'هو,أنت,أنا,هي,هما,نحن,هم,أنتم,هن,أنتن', 'ضمائر', '[{"feature":"pos","value":"pron"}]'::jsonb),
  ('ضمير الفاعل', 'ضمائر تتصل بالفعل وتدل على الفاعل', 'تما,نا,ت,تم,تا,ا,تن,ن', 'ضمائر', '[{"feature":"pos","value":"pron"}]'::jsonb),
  ('ضمير المفعول', 'ضمائر تتصل بالفعل وتدل على المفعول به', 'ي,ك,ه,ها,كما,هما,كم,هم,هن,كن,نا', 'ضمائر', '[{"feature":"pos","value":"pron"}]'::jsonb),
  ('هذه', 'اسم إشارة للمفرد المؤنث القريب', 'هذه', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('هذا', 'اسم إشارة للمفرد المذكر القريب', 'هذا', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('ذلك', 'اسم إشارة للمفرد المذكر البعيد', 'ذلك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('هذان', 'اسم إشارة للمثنى المذكر القريب', 'هذان', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('تلك', 'اسم إشارة للمفرد المؤنث البعيد', 'تلك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('هاتان', 'اسم إشارة للمثنى المؤنث القريب', 'هاتان', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('هذين', 'اسم إشارة للمثنى المذكر القريب في حالة النصب والجر', 'هذين', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('هاتين', 'اسم إشارة للمثنى المؤنث القريب في حالة النصب والجر', 'هاتين', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('ذانك', 'اسم إشارة للمثنى المذكر البعيد', 'ذانك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('ذينك', 'اسم إشارة للمثنى المذكر البعيد في حالة النصب والجر', 'ذينك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('هؤلاء', 'اسم إشارة للجمع القريب', 'هؤلاء', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('تانك', 'اسم إشارة للمثنى المؤنث البعيد', 'تانك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('أولئك', 'اسم إشارة للجمع البعيد', 'أولئك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('تينك', 'اسم إشارة للمثنى المؤنث البعيد في حالة النصب والجر', 'تينِك', 'الإشارة', '[{"feature":"pos","value":"pron_dem"},{"feature":"pos","value":"part_dem"}]'::jsonb),
  ('المكان', 'يدل على مكان حدوث الفعل', NULL, 'المكان', '[]'::jsonb),
  ('زمان', 'يدل على زمن حدوث الفعل', NULL, 'زمان', '[]'::jsonb),
  ('اسم', 'كلمة تدل على معنى في نفسها دون اقتران بزمن', NULL, 'أقسام الجملة', '[{"feature":"pos","value":"noun"},{"feature":"pos","value":"noun_prop"},{"feature":"pos","value":"noun_num"},{"feature":"pos","value":"noun_quant"},{"feature":"pos","value":"pron"},{"feature":"pos","value":"adj"}]'::jsonb),
  ('فعل', 'كلمة تدل على حدث مقترن بزمن', NULL, 'أقسام الجملة', '[{"feature":"pos","value":"verb"},{"feature":"pos","value":"verb_pseudo"}]'::jsonb),
  ('حرف', 'كلمة تدل على معنى في غيرها', NULL, 'أقسام الجملة', '[{"feature":"pos","value":"part"},{"feature":"pos","value":"part_dem"},{"feature":"pos","value":"part_det"},{"feature":"pos","value":"part_focus"},{"feature":"pos","value":"part_fut"},{"feature":"pos","value":"part_interrog"},{"feature":"pos","value":"part_neg"},{"feature":"pos","value":"part_restrict"},{"feature":"pos","value":"part_verb"},{"feature":"pos","value":"part_voc"},{"feature":"pos","value":"prep"},{"feature":"pos","value":"conj"},{"feature":"pos","value":"conj_sub"}]'::jsonb),
  ('ماضي', 'فعل يدل على حدث وقع في الماضي', NULL, 'زمان الفعل', '[{"feature":"asp","value":"p"}]'::jsonb),
  ('مضارع', 'فعل يدل على حدث يقع في الحاضر أو المستقبل', 'أ,ن,ي,ت', 'زمان الفعل', '[{"feature":"asp","value":"i"}]'::jsonb),
  ('امر', 'فعل يدل على طلب حدوث الفعل', 'اِ', 'زمان الفعل', '[{"feature":"asp","value":"c"}]'::jsonb),
  ('صفة', 'كلمة تدل على وصف لاسم', NULL, 'صفة', '[{"feature":"pos","value":"adj"},{"feature":"pos","value":"adj_comp"},{"feature":"pos","value":"adj_num"}]'::jsonb),
  ('موصوف', 'الاسم الذي توصفه الصفة', NULL, 'صفة', '[]'::jsonb),
  ('الذي', 'اسم موصول للمفرد المذكر', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('التي', 'اسم موصول للمفرد المؤنث', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('اللذان', 'اسم موصول للمثنى المذكر', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('اللتان', 'اسم موصول للمثنى المؤنث', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('اللتين', 'اسم موصول للمثنى المؤنث في النصب والجر', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('اللذين', 'اسم موصول للمثنى المذكر في النصب والجر', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('اللاتي', 'اسم موصول لجمع المؤنث', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('من', 'اسم موصول يُستعمل للعاقل', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb),
  ('ما', 'اسم موصول يُستعمل لغير العاقل', NULL, 'الاسم الموصول', '[{"feature":"pos","value":"pron_rel"}]'::jsonb);

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

-- Questions
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
