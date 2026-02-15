# Seed content for review

Draft content aligned with the product requirements (categories: harakah, سؤال, اركان, زمن). Review and we can then generate SQL to insert it.

---

## 1. Categories (4)

| # | Name (Arabic / key) |
|---|---------------------|
| 1 | حركات |
| 2 | سؤال |
| 3 | اركان |
| 4 | زمن |

---

## 2. Definitions (20) with category

**harakah (7)** — diacritics  
| # | label |
|---|--------|
| 1 | فَتْحَة |
| 2 | كَسْرَة |
| 3 | ضَمَّة |
| 4 | مَدَّة |
| 5 | سُكُون |
| 6 | تَنْوِين |
| 7 | شَدَّة |

**سؤال (4)** — question particles  
| # | label |
|---|--------|
| 8 | هَلْ |
| 9 | مَنْ |
| 10 | مَاذَا |
| 11 | مَا |

**اركان (4)** — sentence elements  
| # | label |
|---|--------|
| 12 | اسم |
| 13 | فعل |
| 14 | فاعل |
| 15 | مفعول به |
| 20 | خبر |

**زمن (4)** — tense (added أمر so category has ≥4 for MCQ)  
| # | label |
|---|--------|
| 16 | ماضي |
| 17 | المضارع |
| 18 | مستقبل |
| 19 | أمر |


---

## 3. Prompts (20)

Simple Arabic sentences with clear grammar. Each will need **prompt_definitions** (word/letter → definition) when we build the SQL; below we only list prompt text and difficulty. You can later link words/letters to definitions in the admin UI or we can propose links in the SQL.

| # | prompt_text | difficulty |
|---|--------------|------------|
| 1 | جلس الولد | easy |
| 2 | أكل محمد التفاحة | easy |
| 3 | يلعب الأطفال في الحديقة | medium |
| 4 | هل جاء المعلم؟ | easy |
| 5 | من في البيت؟ | easy |
| 6 | ماذا قرأت؟ | medium |
| 7 | ما اسمك؟ | easy |
| 8 | كتبت الرسالة أمس | medium |
| 9 | الطالب يدرس في الجامعة | medium |
| 10 | سيسافر أبي غداً | medium |
| 11 | اقرأ الدرس | easy |
| 12 | هل سمعت الخبر؟ | medium |
| 13 | من فتح الباب؟ | medium |
| 14 | ماذا تفعل الآن؟ | medium |
| 15 | الشمس تشرق من المشرق | hard |
| 16 | كان الأستاذ يشرح الدرس | hard |
| 17 | لن أتأخر عن الموعد | hard |
| 18 | إنّ الحقّ يعلو | hard |
| 19 | كتب التلميذ الواجب | easy |
| 20 | هل يلعبون الكرة؟ | medium |

---

## 4. Questions (11 templates with `{definition}` placeholder)

Questions are **templates**: question_text, category_id, type, min_options. The **correct answer** is not stored on the question; it comes from **prompt_definitions** when building a question.

`{definition}` in the question_text is replaced at runtime with the definition's label. For example, `أي كلمة في الجملة هي {definition}؟` becomes `أي كلمة في الجملة هي الفاعل؟` when the prompt_definition points to فاعل. If the question_text has no `{definition}`, it is shown as-is.

MCQ questions are typically **generic** (the definition IS the answer, not part of the question text) — this avoids giving away the answer. click_word / click_letter questions **use `{definition}`** so the user knows what to find in the sentence.

| # | question_text | type | category |
|---|----------------|------|----------|
| 1 | ما حركة الحرف المحدد؟ | MCQ | حركات |
| 2 | ما نوع الحركة على الحرف المحدد؟ | MCQ | حركات |
| 3 | اضغط على الحرف الذي عليه {definition} | click_letter | حركات |
| 4 | ما الذي يدل على أن الجملة استفهامية؟ | click_word | سؤال |
| 5 | اضغط على أداة الاستفهام في الجملة | click_word | سؤال |
| 6 | ما إعراب الكلمة المحددة؟ | MCQ | اركان |
| 7 | ما دور الكلمة المحددة في الجملة؟ | MCQ | اركان |
| 8 | أي كلمة في الجملة هي {definition}؟ | click_word | اركان |
| 9 | اضغط على {definition} في الجملة | click_word | اركان |
| 10 | ما زمن الفعل المحدد؟ | MCQ | زمن |
| 11 | ما زمن الفعل الظاهر؟ | MCQ | زمن |

---

## 5. Prompt–definition links and question-building pipeline

| #  | prompt_id | definition_id | index_start | is_letter |
| -- | --------- | ------------- | ----------- | --------- |
| 1  | 1         | 13            | 0           | false     |
| 2  | 1         | 14            | 5           | false     |
| 3  | 1         | 16            | 0           | false     |
| 4  | 2         | 13            | 0           | false     |
| 5  | 2         | 14            | 4           | false     |
| 6  | 2         | 15            | 10          | false     |
| 7  | 3         | 17            | 0           | false     |
| 8  | 3         | 14            | 6           | false     |
| 9  | 3         | 12            | 18          | false     |
| 10 | 4         | 8             | 0           | false     |
| 11 | 4         | 13            | 4           | false     |
| 12 | 4         | 14            | 8           | false     |
| 13 | 5         | 9             | 0           | false     |
| 14 | 5         | 12            | 6           | false     |
| 15 | 5         | 9             | 0           | false     |
| 16 | 6         | 10            | 0           | false     |
| 17 | 6         | 13            | 5           | false     |
| 18 | 6         | 16            | 5           | false     |
| 19 | 7         | 11            | 0           | false     |
| 20 | 7         | 12            | 3           | false     |
| 21 | 7         | 11            | 0           | false     |
| 22 | 8         | 13            | 0           | false     |
| 23 | 8         | 15            | 6           | false     |
| 24 | 8         | 16            | 0           | false     |
| 25 | 9         | 12            | 0           | false     |
| 26 | 9         | 17            | 7           | false     |
| 27 | 9         | 12            | 16          | false     |
| 28 | 10        | 18            | 0           | false     |
| 29 | 10        | 14            | 8           | false     |
| 30 | 10        | 13            | 0           | false     |
| 31 | 11        | 19            | 0           | false     |
| 32 | 11        | 13            | 0           | false     |
| 33 | 11        | 15            | 5           | false     |
| 34 | 12        | 8             | 0           | false     |
| 35 | 12        | 16            | 4           | false     |
| 36 | 12        | 15            | 10          | false     |
| 37 | 13        | 9             | 0           | false     |
| 38 | 13        | 13            | 4           | false     |
| 39 | 13        | 15            | 8           | false     |
| 40 | 14        | 10            | 0           | false     |
| 41 | 14        | 17            | 5           | false     |
| 42 | 14        | 12            | 11          | false     |
| 43 | 15        | 12            | 0           | false     |
| 44 | 15        | 17            | 6           | false     |
| 45 | 15        | 12            | 14          | false     |
| 46 | 16        | 16            | 0           | false     |
| 47 | 16        | 12            | 4           | false     |
| 48 | 16        | 17            | 12          | false     |
| 49 | 17        | 13            | 3           | false     |
| 50 | 17        | 12            | 14          | false     |
| 51 | 17        | 17            | 3           | false     |
| 52 | 18        | 12            | 4           | false     |
| 53 | 18        | 17            | 11          | false     |
| 54 | 18        | 12            | 0           | false     |
| 55 | 19        | 16            | 0           | false     |
| 56 | 19        | 14            | 4           | false     |
| 57 | 19        | 15            | 13          | false     |
| 58 | 20        | 8             | 0           | false     |
| 59 | 20        | 17            | 4           | false     |
| 60 | 20        | 15            | 12          | false     |

### Runtime question-building pipeline

```
1. Pick a prompt
2. Fetch all prompt_definitions for that prompt
3. Pick one prompt_definition → gives us a definition (+ its category)
4. Fetch question templates whose category_id matches the definition's category
5. Pick a random template from those
6. Replace {definition} in question_text with the definition's label
7. Build the answer pool:
   - MCQ: correct answer = the definition label; distractors = 3 other
     definitions from the same category (random, excluding the correct one)
   - click_word / click_letter: correct answer = the word/letter at
     index_start in the prompt text; no distractors needed
```

When we write the SQL:

1. Insert categories, definitions, category_definitions.
2. Insert prompts.
3. Insert prompt_definitions (prompt_id, definition_id, index_start, is_letter).
4. Insert questions (question_text, category_id, type, min_options only — no correct_definition_id).

---

## 6. Summary

- **Categories:** 4 (harakah, سؤال, اركان, زمن).
- **Definitions:** 20 (7 + 4 + 5 + 4).
- **Prompts:** 20 (mix of easy/medium/hard).
- **Questions:** 11 templates (collapsed from 15). Templates use `{definition}` placeholder for click-type questions. MCQ templates stay generic. Correct answer is derived from prompt_definitions at runtime.

Tell me what you'd like to change (labels, prompts, question templates, or links), and I'll produce the SQL script.
