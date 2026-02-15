/**
 * Question Engine — MVP-3
 *
 * Pipeline:
 *  1. Pick a difficulty via weighted random (env defaults for guest)
 *  2. Fetch active prompts matching that difficulty
 *  3. Pick a random prompt
 *  4. Fetch its prompt_definitions
 *  5. Pick one prompt_definition at random → gives us a definition + its category
 *  6. Fetch question templates whose category matches
 *  7. Pick a random template
 *  8. Replace {definition} placeholder
 *  9. Build answer pool (MCQ: correct + 3 distractors from same category)
 *  10. Return QuestionDTO
 *
 * All steps are logged to console for debugging.
 */

import { supabase } from '@/lib/supabase';
import { renderQuestionText } from '@/lib/question';
import { DIFFICULTY_WEIGHTS, BASE_POINTS } from '@/services/config';
import { getSelectedCategories } from '@/components/SettingsModal';
import type { DifficultyWeights } from '@/services/difficultyAdaptation';
import type { Difficulty, QuestionType } from '@/types/db';
import type { QuestionDTO, DefinitionOptionDTO } from '@/types/dto';

const LOG_PREFIX = '[QuestionEngine]';

/** Check if an error is an AbortError (request cancelled by client). */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: string }).message;
    if (msg.includes('AbortError') || msg.includes('signal is aborted')) return true;
  }
  return false;
}

/* -----------------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------------- */

/** Pick a difficulty based on weighted random distribution. */
function pickDifficulty(weights?: DifficultyWeights): Difficulty {
  const w = weights ?? DIFFICULTY_WEIGHTS;
  const r = Math.random();
  if (r < w.easy) return 'easy';
  if (r < w.easy + w.medium) return 'medium';
  return 'hard';
}

/** Pick a random element from an array. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffle array in-place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* -----------------------------------------------------------------------
   Types for intermediate DB rows
   ----------------------------------------------------------------------- */

interface PromptRow {
  id: string;
  prompt_text: string;
  difficulty: Difficulty;
}

interface PromptDefinitionRow {
  id: string;
  definition_id: string;
  index_start: number;
  is_letter: boolean;
}

interface DefinitionWithCategory {
  id: string;
  label: string;
  categoryId: string;
}

interface QuestionTemplateRow {
  id: string;
  question_text: string;
  type: QuestionType;
  min_options: number;
  category_id: string;
}

/* -----------------------------------------------------------------------
   Core pipeline
   ----------------------------------------------------------------------- */

/**
 * Quick check: does the DB have at least one active prompt with prompt_definitions
 * linked to a category that has an active question template?
 * Used on the main menu to block play if there's nothing to show.
 */
export async function hasPlayableContent(): Promise<boolean> {
  try {
    // 1. Any active prompt?
    const { count: promptCount } = await supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (!promptCount) return false;

    // 2. Any prompt_definitions?
    const { count: pdCount } = await supabase
      .from('prompt_definitions')
      .select('id', { count: 'exact', head: true });

    if (!pdCount) return false;

    // 3. Any active question templates?
    const { count: qCount } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (!qCount) return false;

    return true;
  } catch (err) {
    console.error(LOG_PREFIX, 'hasPlayableContent error:', err);
    return false;
  }
}

/**
 * Generate a single QuestionDTO.
 *
 * @param usedPromptIds - prompt IDs already used this batch (to avoid repeats)
 * @param userWeights   - optional per-user difficulty weights (logged-in users)
 * @returns QuestionDTO or null if generation fails (logged)
 */
export async function generateOneQuestion(
  usedPromptIds: Set<string>,
  userWeights?: DifficultyWeights,
): Promise<QuestionDTO | null> {
  try {
    /* ---- Step 1: Pick difficulty ---- */
    const difficulty = pickDifficulty(userWeights);
    console.log(LOG_PREFIX, 'Step 1 — difficulty:', difficulty);

    /* ---- Step 2: Fetch active prompts for this difficulty ---- */
    const rawCats = getSelectedCategories();
    // Treat null or empty array as "all categories"
    const selectedCats = rawCats && rawCats.length > 0 ? rawCats : null;
    console.log(LOG_PREFIX, 'Step 1b — selectedCats:', selectedCats ? selectedCats.length : 'ALL');
    let promptQuery = supabase
      .from('prompts')
      .select('id, prompt_text, difficulty')
      .eq('is_active', true)
      .eq('difficulty', difficulty);

    const { data: prompts, error: promptErr } = await promptQuery;
    if (promptErr) {
      console.error(LOG_PREFIX, 'Step 2 — error fetching prompts:', promptErr.message);
      return null;
    }

    // Filter out already-used prompts
    const available = (prompts as PromptRow[]).filter((p) => !usedPromptIds.has(p.id));
    console.log(
      LOG_PREFIX,
      `Step 2 — ${prompts?.length ?? 0} prompts (difficulty=${difficulty}), ${available.length} unused`,
    );

    if (available.length === 0) {
      // Fall back: try any difficulty
      console.warn(LOG_PREFIX, 'Step 2 — no unused prompts for difficulty, trying any difficulty');
      const { data: fallback, error: fallbackErr } = await supabase
        .from('prompts')
        .select('id, prompt_text, difficulty')
        .eq('is_active', true);

      if (fallbackErr || !fallback?.length) {
        console.error(LOG_PREFIX, 'Step 2 — no prompts at all:', fallbackErr?.message);
        return null;
      }

      const fallbackAvailable = (fallback as PromptRow[]).filter((p) => !usedPromptIds.has(p.id));
      if (fallbackAvailable.length === 0) {
        console.warn(LOG_PREFIX, 'Step 2 — all prompts used, clearing used set');
        usedPromptIds.clear();
        return generateOneQuestion(usedPromptIds, userWeights);
      }

      return buildFromPrompt(pickRandom(fallbackAvailable), usedPromptIds, selectedCats);
    }

    return buildFromPrompt(pickRandom(available), usedPromptIds, selectedCats);
  } catch (err) {
    // Re-throw AbortErrors so the batch generator can apply retry logic
    if (isAbortError(err)) throw err;
    console.error(LOG_PREFIX, 'Unexpected error in generateOneQuestion:', err);
    return null;
  }
}

/**
 * Given a chosen prompt, run steps 3–10 of the pipeline.
 */
async function buildFromPrompt(
  prompt: PromptRow,
  usedPromptIds: Set<string>,
  selectedCats: string[] | null,
): Promise<QuestionDTO | null> {
  usedPromptIds.add(prompt.id);
  console.log(LOG_PREFIX, `Step 3 — picked prompt: "${prompt.prompt_text}" (${prompt.id})`);

  /* ---- Step 4: Fetch prompt_definitions ---- */
  const { data: pdRows, error: pdErr } = await supabase
    .from('prompt_definitions')
    .select('id, definition_id, index_start, is_letter')
    .eq('prompt_id', prompt.id);

  if (pdErr || !pdRows?.length) {
    console.error(LOG_PREFIX, 'Step 4 — no prompt_definitions:', pdErr?.message ?? 'empty');
    return null;
  }

  console.log(LOG_PREFIX, `Step 4 — ${pdRows.length} prompt_definitions found`);

  /* ---- Step 5: Pick one prompt_definition → resolve definition + its category ---- */
  const pd = pickRandom(pdRows as PromptDefinitionRow[]);
  console.log(LOG_PREFIX, `Step 5 — picked prompt_definition: def_id=${pd.definition_id}, index=${pd.index_start}, is_letter=${pd.is_letter}`);

  // Get definition label
  const { data: defRow, error: defErr } = await supabase
    .from('definitions')
    .select('id, label')
    .eq('id', pd.definition_id)
    .single();

  if (defErr || !defRow) {
    console.error(LOG_PREFIX, 'Step 5 — definition not found:', defErr?.message);
    return null;
  }

  // Get the category for this definition via category_definitions
  const { data: catDefRows, error: catDefErr } = await supabase
    .from('category_definitions')
    .select('category_id')
    .eq('definition_id', pd.definition_id);

  if (catDefErr || !catDefRows?.length) {
    console.error(LOG_PREFIX, 'Step 5 — no category for definition:', catDefErr?.message ?? 'empty');
    return null;
  }

  // If category filter is active, try to find a matching category
  let categoryId: string;
  if (selectedCats) {
    const match = catDefRows.find((r) => selectedCats.includes(r.category_id));
    if (!match) {
      console.warn(LOG_PREFIX, 'Step 5 — definition category not in selected categories, skipping');
      return null;
    }
    categoryId = match.category_id;
  } else {
    categoryId = catDefRows[0].category_id;
  }

  const defWithCat: DefinitionWithCategory = {
    id: defRow.id,
    label: defRow.label,
    categoryId,
  };

  console.log(LOG_PREFIX, `Step 5 — definition: "${defWithCat.label}", category: ${defWithCat.categoryId}`);

  /* ---- Step 6: Fetch question templates for this category ---- */
  const { data: templates, error: tplErr } = await supabase
    .from('questions')
    .select('id, question_text, type, min_options, category_id')
    .eq('category_id', defWithCat.categoryId)
    .eq('is_active', true);

  if (tplErr || !templates?.length) {
    console.error(LOG_PREFIX, 'Step 6 — no question templates for category:', tplErr?.message ?? 'empty');
    return null;
  }

  console.log(LOG_PREFIX, `Step 6 — ${templates.length} templates for category ${defWithCat.categoryId}`);

  /* ---- Step 7: Pick a random template ---- */
  // For click_letter, only pick templates that match is_letter; for click_word, only word; MCQ is fine for both
  const compatibleTemplates = (templates as QuestionTemplateRow[]).filter((tpl) => {
    if (pd.is_letter && tpl.type === 'click_word') return false;
    if (!pd.is_letter && tpl.type === 'click_letter') return false;
    return true;
  });

  if (compatibleTemplates.length === 0) {
    console.error(LOG_PREFIX, 'Step 7 — no compatible templates (is_letter mismatch)');
    return null;
  }

  const template = pickRandom(compatibleTemplates);
  console.log(LOG_PREFIX, `Step 7 — picked template: "${template.question_text}" (type=${template.type})`);

  /* ---- Step 8: Replace {definition} ---- */
  const questionText = renderQuestionText(template.question_text, defWithCat.label);
  console.log(LOG_PREFIX, `Step 8 — rendered question: "${questionText}"`);

  /* ---- Step 9: Build answer pool ---- */
  const correctAnswer: DefinitionOptionDTO = { id: defWithCat.id, label: defWithCat.label };
  let possibleAnswers: DefinitionOptionDTO[];

  if (template.type === 'MCQ') {
    // Need 3 distractors from the same category
    const { data: catDefs, error: catDefsErr } = await supabase
      .from('category_definitions')
      .select('definition_id')
      .eq('category_id', defWithCat.categoryId)
      .neq('definition_id', defWithCat.id);

    if (catDefsErr) {
      console.error(LOG_PREFIX, 'Step 9 — error fetching distractors:', catDefsErr.message);
      return null;
    }

    const distractorIds = (catDefs ?? []).map((r) => r.definition_id);
    console.log(LOG_PREFIX, `Step 9 — ${distractorIds.length} possible distractors in category`);

    if (distractorIds.length < (template.min_options - 1)) {
      console.error(LOG_PREFIX, `Step 9 — not enough distractors (need ${template.min_options - 1}, have ${distractorIds.length})`);
      return null;
    }

    // Fetch distractor labels
    const picked = shuffle([...distractorIds]).slice(0, template.min_options - 1);
    const { data: distDefs, error: distErr } = await supabase
      .from('definitions')
      .select('id, label')
      .in('id', picked);

    if (distErr || !distDefs) {
      console.error(LOG_PREFIX, 'Step 9 — error fetching distractor definitions:', distErr?.message);
      return null;
    }

    possibleAnswers = shuffle([
      correctAnswer,
      ...distDefs.map((d) => ({ id: d.id, label: d.label })),
    ]);

    console.log(LOG_PREFIX, `Step 9 — MCQ answers: [${possibleAnswers.map((a) => a.label).join(', ')}]`);
  } else {
    // click_word / click_letter — only the correct answer
    possibleAnswers = [correctAnswer];
    console.log(LOG_PREFIX, `Step 9 — click answer: "${correctAnswer.label}"`);
  }

  /* ---- Step 10: Build QuestionDTO ---- */
  const dto: QuestionDTO = {
    questionType: template.type,
    promptText: prompt.prompt_text,
    questionText,
    possibleAnswers,
    correctAnswer,
    categoryId: defWithCat.categoryId,
    difficulty: prompt.difficulty,
    points: BASE_POINTS[prompt.difficulty],
    indexStart: pd.index_start,
    isLetter: pd.is_letter,
  };

  console.log(LOG_PREFIX, 'Step 10 — QuestionDTO built:', {
    type: dto.questionType,
    prompt: dto.promptText,
    question: dto.questionText,
    correct: dto.correctAnswer.label,
    difficulty: dto.difficulty,
    points: dto.points,
  });

  return dto;
}

/* -----------------------------------------------------------------------
   Batch generation
   ----------------------------------------------------------------------- */

/**
 * Generate a batch of questions.
 *
 * @param count       - how many questions to generate
 * @param userWeights - optional per-user difficulty weights (logged-in users)
 * @returns array of QuestionDTOs (may be shorter if generation failed for some)
 */
export async function generateBatch(
  count: number,
  userWeights?: DifficultyWeights,
): Promise<QuestionDTO[]> {
  console.log(LOG_PREFIX, `Generating batch of ${count} questions...`);
  const usedPromptIds = new Set<string>();
  const results: QuestionDTO[] = [];
  let attempts = 0;
  let abortRetries = 0;
  const maxAttempts = count * 3; // allow some failures
  const maxAbortRetries = 5;     // cap retries for AbortError specifically

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    try {
      const q = await generateOneQuestion(usedPromptIds, userWeights);
      if (q) {
        results.push(q);
        abortRetries = 0; // reset on success
      } else {
        console.warn(LOG_PREFIX, `Attempt ${attempts} failed, retrying...`);
      }
    } catch (err) {
      if (isAbortError(err)) {
        abortRetries++;
        console.warn(LOG_PREFIX, `Attempt ${attempts} aborted (${abortRetries}/${maxAbortRetries}), waiting before retry...`);
        if (abortRetries >= maxAbortRetries) {
          console.error(LOG_PREFIX, 'Too many AbortErrors, stopping batch');
          break;
        }
        // Brief wait before retrying — lets React settle
        await new Promise((r) => setTimeout(r, 500));
      } else {
        console.error(LOG_PREFIX, `Attempt ${attempts} threw:`, err);
      }
    }
  }

  console.log(LOG_PREFIX, `Batch complete: ${results.length}/${count} questions generated in ${attempts} attempts`);
  return results;
}
