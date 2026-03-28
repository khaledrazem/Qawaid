# Letter indices and UTF-16

Prompt word/letter indices used in the app (e.g. `index_start`, `index_end` in `prompt_definitions`, and in the Play UI for highlighting and click targets) are **JavaScript string indices**, i.e. **UTF-16 code unit** positions.

- In JavaScript, `"string".slice(start, end)` and `string[index]` use UTF-16 code units.
- Most Arabic characters are a single UTF-16 code unit (BMP). Characters outside the BMP (e.g. some emoji, rare symbols) use two code units (surrogate pairs).
- When using letter targeting or letter-range questions, prompts should avoid non-BMP characters so that one “letter” corresponds to one index. If non-BMP characters are present, admin should be aware that a single displayed character may span two indices.

This applies to:
- Backend tokenizer and analyze/suggest-links (Python uses Unicode code points; when returning `start`/`end` to the frontend, ensure consistency with JS expectations if the frontend uses them for slicing).
- Play highlight and click validation (which use `question.indexStart` / `question.indexEnd` with the prompt string in JS).
