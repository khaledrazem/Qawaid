-- 20 sample prompts for development/demo. Mix of easy, medium, hard.
-- Prompts are sentences that can be linked to definitions via prompt_definitions (admin UI or auto-link).

INSERT INTO prompts (prompt_text, difficulty, is_active) VALUES
  ('هذا كتاب جديد', 'easy', true),
  ('هل ذهبت إلى المدرسة؟', 'easy', true),
  ('الطالب يقرأ الدرس', 'easy', true),
  ('لم يأتِ أحمد اليوم', 'easy', true),
  ('ما اسمك؟', 'easy', true),
  ('هذه القصة جميلة', 'medium', true),
  ('لن أنسى هذا اليوم', 'medium', true),
  ('الولدان يلعبان في الحديقة', 'medium', true),
  ('من الذي كتب هذا الدرس؟', 'medium', true),
  ('كيف حالك؟', 'medium', true),
  ('ليس الطالب في الفصل', 'medium', true),
  ('أين ذهبت أمس؟', 'medium', true),
  ('الطلاب يدرسون اللغة العربية', 'medium', true),
  ('متى تذهب إلى المكتبة؟', 'medium', true),
  ('هؤلاء أصدقائي', 'medium', true),
  ('لا أعرف الجواب', 'hard', true),
  ('الكتاب الذي قرأته مفيد', 'hard', true),
  ('ما الذي تريد أن تتعلمه؟', 'hard', true),
  ('تلك الفتاة الذكية تنجح دائماً', 'hard', true),
  ('كم كتاباً قرأت هذا الشهر؟', 'hard', true);
