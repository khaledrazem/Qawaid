"""
Question engine — same pipeline as frontend questionEngine.ts.
Pick difficulty → fetch prompts → pick prompt → prompt_definition → definition + category
→ question template → replace {definition} → build answer pool → return QuestionDTO.
"""

import random
from typing import Any, Dict, List, Optional, Set

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Base points per difficulty (match frontend config)
BASE_POINTS = {"easy": 10, "medium": 20, "hard": 30}

# Global minimum MCQ options (not stored in DB)
MCQ_MIN_OPTIONS = 2


def _supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _pick_difficulty(weights: Optional[Dict[str, float]] = None) -> str:
    w = weights or {"easy": 0.5, "medium": 0.3, "hard": 0.2}
    r = random.random()
    if r < w.get("easy", 0.5):
        return "easy"
    if r < w.get("easy", 0.5) + w.get("medium", 0.3):
        return "medium"
    return "hard"


def _shuffle(arr: List[Any]) -> List[Any]:
    out = list(arr)
    random.shuffle(out)
    return out


def has_playable_content() -> bool:
    """True if active prompts, prompt_definitions, and questions exist."""
    sb = _supabase()
    r1 = sb.table("prompts").select("id", count="exact", head=True).eq("is_active", True).execute()
    if (r1.count or 0) == 0:
        return False
    r2 = sb.table("prompt_definitions").select("id", count="exact", head=True).execute()
    if (r2.count or 0) == 0:
        return False
    r3 = sb.table("questions").select("id", count="exact", head=True).eq("is_active", True).execute()
    if (r3.count or 0) == 0:
        return False
    return True


def _render_question_text(template: str, definition_label: str) -> str:
    return template.replace("{definition}", definition_label)


def generate_one_question(
    used_prompt_ids: Set[str],
    selected_category_ids: Optional[List[str]] = None,
    user_weights: Optional[Dict[str, float]] = None,
) -> Optional[Dict]:
    """Build one QuestionDTO or None."""
    sb = _supabase()
    difficulty = _pick_difficulty(user_weights)

    # Fetch active prompts for this difficulty
    r = sb.table("prompts").select("id, prompt_text, difficulty").eq("is_active", True).eq("difficulty", difficulty).execute()
    if r.data is None:
        r = sb.table("prompts").select("id, prompt_text, difficulty").eq("is_active", True).execute()
        if not r.data:
            return None
    prompts = [p for p in r.data if p["id"] not in used_prompt_ids]
    if not prompts:
        # Fallback: any difficulty
        r = sb.table("prompts").select("id, prompt_text, difficulty").eq("is_active", True).execute()
        if not r.data:
            return None
        prompts = [p for p in r.data if p["id"] not in used_prompt_ids]
        if not prompts:
            return None

    prompt = random.choice(prompts)
    used_prompt_ids.add(prompt["id"])

    # prompt_definitions
    pd_r = sb.table("prompt_definitions").select("id, definition_id, index_start, index_end, is_letter").eq("prompt_id", prompt["id"]).execute()
    if not pd_r.data:
        return None
    pd = random.choice(pd_r.data)

    # definition (include description for incorrect feedback)
    def_r = sb.table("definitions").select("id, label, description").eq("id", pd["definition_id"]).execute()
    if not def_r.data:
        return None
    def_row = def_r.data[0]

    # category via category_definitions
    cd_r = sb.table("category_definitions").select("category_id").eq("definition_id", pd["definition_id"]).execute()
    if not cd_r.data:
        return None
    category_id = cd_r.data[0]["category_id"]
    if selected_category_ids and category_id not in selected_category_ids:
        return None

    # question templates for this category (min_options is global in code, not in DB)
    tpl_r = sb.table("questions").select("id, question_text, type, category_id").eq("category_id", category_id).eq("is_active", True).execute()
    if not tpl_r.data:
        return None
    # Filter by is_letter compatibility
    # Only generate types we support in the engine (MCQ, click_word, click_letter, click_letter_range)
    templates = [
        t for t in tpl_r.data
        if t["type"] == "MCQ"
        or (pd.get("is_letter") and t["type"] in ("click_letter", "click_letter_range"))
        or (not pd.get("is_letter") and t["type"] == "click_word")
    ]
    if not templates:
        return None
    template = random.choice(templates)

    question_text = _render_question_text(template["question_text"], def_row["label"])
    correct_answer = {"id": def_row["id"], "label": def_row["label"]}

    if template["type"] == "MCQ":
        cd_all = sb.table("category_definitions").select("definition_id").eq("category_id", category_id).neq("definition_id", def_row["id"]).execute()
        distractor_ids = [r["definition_id"] for r in (cd_all.data or [])]
        need = MCQ_MIN_OPTIONS - 1
        if len(distractor_ids) < need:
            return None
        picked = _shuffle(distractor_ids)[:need]
        dist_r = sb.table("definitions").select("id, label").in_("id", picked).execute()
        distractors = [{"id": d["id"], "label": d["label"]} for d in (dist_r.data or [])]
        possible_answers = _shuffle([correct_answer] + distractors)
    else:
        possible_answers = [correct_answer]

    qtype = template["type"]
    if qtype == "click_letter_range" and not pd.get("index_end"):
        qtype = "click_letter"
    return {
        "questionType": qtype,
        "promptText": prompt["prompt_text"],
        "promptId": prompt["id"],
        "questionText": question_text,
        "possibleAnswers": possible_answers,
        "correctAnswer": correct_answer,
        "categoryId": category_id,
        "difficulty": prompt["difficulty"],
        "points": BASE_POINTS.get(prompt["difficulty"], 20),
        "indexStart": pd["index_start"],
        "indexEnd": pd.get("index_end"),
        "isLetter": pd.get("is_letter", False),
        "definitionDescription": def_row.get("description"),
    }


def generate_batch(
    count: int,
    used_prompt_ids: Optional[List[str]] = None,
    selected_category_ids: Optional[List[str]] = None,
    user_weights: Optional[Dict[str, float]] = None,
) -> List[Dict]:
    """Generate up to `count` questions."""
    used = set(used_prompt_ids or [])
    results = []
    max_attempts = count * 3
    for _ in range(max_attempts):
        if len(results) >= count:
            break
        q = generate_one_question(used, selected_category_ids, user_weights)
        if q:
            results.append(q)
    return results
