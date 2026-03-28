-- Add question templates from v1_1.md spec.
-- This assumes categories and definitions are already seeded (see v1.1 migrations).
-- Questions are inserted by (question_text, category name, type).

-- Insert questions if a question with the same text/category/type does not already exist
INSERT INTO questions (question_text, category_id, type, is_active)
SELECT q.question_text, c.id, q.type::question_type, true
FROM (VALUES


  -- الاستفهام
  ('أكمل الجملة لتصبح سؤالًا.', 'الاستفهام', 'fill_in_sentence'),
  ('حوّل هذه الجملة إلى سؤال.', 'الاستفهام', 'mcq_fillin'),
  ('ما الذي يدل على أن هذه الجملة استفهام؟', 'الاستفهام', 'click_word'),
  ('هل هذه الجملة استفهام أم لا؟', 'الاستفهام', 'yes_no'),

  -- النفي
  ('انفِ هذه الجملة (أكمل أداة النفي الناقصة).', 'النفي', 'fill_in_sentence'),
  ('انفِ هذه الجملة (اختر أداة النفي الصحيحة).', 'النفي', 'mcq_fillin'),
  ('ما الكلمة التي تدل على النفي في هذه الجملة؟', 'النفي', 'click_word'),
  ('هل هذه الجملة نفي أم لا؟', 'النفي', 'yes_no'),

  -- جنس
  ('هل هذا مذكر أم مؤنث؟ (صورة + تسمية)', 'جنس', 'visual_mcq'),
  ('هل الكلمة المظللة مذكر أم مؤنث؟', 'جنس', 'MCQ'),

  -- صفة
  ('اضغط على {definition}.', 'صفة', 'click_word'),

  -- العدد
  ('ما عدد الكلمة المظللة؟', 'العدد', 'MCQ'),
  ('اضغط على الكلمة في الجملة التي هي {definition}.', 'العدد', 'click_word'),
  ('كم عدد العنصر المحدد؟', 'العدد', 'visual_mcq'),
  ('حوّل الكلمة المظللة لتصبح {definition}.', 'العدد', 'transformation'),

  -- المعرفة
  ('حوّل الكلمة المظللة لتصبح {definition}.', 'المعرفة', 'transformation'),
  ('هل الكلمة المظللة معرفة أم نكرة؟', 'المعرفة', 'MCQ'),

  -- الضمائر
  ('أكمل الجملة بالضمير الصحيح.', 'ضمائر', 'fill_in_sentence'),
  ('أكمل الجملة بالضمير الصحيح (اختيار من متعدد).', 'ضمائر', 'mcq_fillin'),
  ('ما الضمير في هذه الجملة؟', 'ضمائر', 'click_word'),


  -- الإشارة
  ('ما اسم الإشارة في هذه الجملة؟', 'الإشارة', 'click_word'),
  ('أكمل الجملة باسم الإشارة الصحيح.', 'الإشارة', 'mcq_fillin'),

  -- المكان / زمان
  ('اضغط على ظرف المكان الصحيح في الجملة.', 'المكان', 'click_word'),
  ('اضغط على ظرف الزمان الصحيح في الجملة.', 'زمان', 'click_word'),

  -- أقسام الجملة
  ('اضغط على {definition}. (أقسام الجملة)', 'أقسام الجملة', 'click_word'),
  ('طابق كلمات الجملة مع التعريف الصحيح.', 'أقسام الجملة', 'drag_and_match'),

  -- زمان الفعل
  ('حوّل الكلمة المظللة لتطابق {definition}.', 'زمان الفعل', 'transformation'),
  ('اختر الكلمة في الجملة التي هي {definition}.', 'زمان الفعل', 'click_word'),

  -- صفة / الاسم الموصول (additional click-word variants)
  ('اضغط على {definition}. (صفة)', 'صفة', 'click_word'),
  ('اضغط على {definition}. (اسم موصول)', 'الاسم الموصول', 'click_word')
) AS q(question_text, category_name, type)
JOIN categories c ON c.name = q.category_name
LEFT JOIN questions existing
  ON existing.category_id = c.id
  AND existing.question_text = q.question_text
  AND existing.type = q.type::question_type
WHERE existing.id IS NULL;

