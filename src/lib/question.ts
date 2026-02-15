/**
 * Runtime question-text helper.
 *
 * Question templates may include the placeholder `{definition}` which is
 * replaced with the definition label at runtime.  Templates without the
 * placeholder are returned unchanged.
 *
 * Pipeline reminder:
 *  1. Pick prompt → get prompt_definitions
 *  2. Pick one prompt_definition → definition (+ its category)
 *  3. Fetch question templates for that category
 *  4. Pick a random template
 *  5. renderQuestionText(template.question_text, definition.label)
 *  6. Build answer pool:
 *       MCQ  → correct = definition label + 3 random distractors from same category
 *       click → word/letter at index_start in prompt text
 */

const PLACEHOLDER = '{definition}';

/**
 * Replace every `{definition}` occurrence in `template` with `definitionLabel`.
 * If the template contains no placeholder the original string is returned as-is.
 */
export function renderQuestionText(
  template: string,
  definitionLabel: string,
): string {
  if (!template.includes(PLACEHOLDER)) return template;
  return template.replaceAll(PLACEHOLDER, definitionLabel);
}
