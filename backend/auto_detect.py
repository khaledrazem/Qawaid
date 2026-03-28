"""
Auto-detect definition links for a prompt using CAMeL only.

Uses:
- tokenizer (CAMeL simple_word_tokenize when available, else whitespace) for word boundaries
- CAMeL morphology: pos/part_* etc. mapped to our definitions via camel_mapping
- Unmapped CAMeL analyses are printed to the console.
"""

import traceback
from typing import Any, Dict, List

from tokenizer import get_prompt_words

try:
    from camel_morphology import (
        is_morphology_available,
        get_morphology_status,
        is_disambiguation_available,
        analyze_word,
        analyze_sentence,
    )
except ImportError:
    def is_morphology_available() -> bool:
        return False

    def get_morphology_status() -> str:
        return "camel_morphology not imported"

    def is_disambiguation_available() -> bool:
        return False

    def analyze_word(word: str) -> List[Dict[str, Any]]:
        return []

    def analyze_sentence(sentence_tokens: List[str]) -> List[List[Dict[str, Any]]]:
        return []

try:
    from camel_mapping import definitions_matching_camel_analysis
except ImportError:
    def definitions_matching_camel_analysis(
        analysis: Dict[str, Any],
        definitions_by_category: Dict[str, List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        return []


def _build_definitions_by_category(definitions: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group definitions by category_name for CAMeL mapping lookup."""
    by_cat: Dict[str, List[Dict[str, Any]]] = {}
    for d in definitions:
        cat = (d.get("category_name") or "").strip()
        if not cat:
            continue
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append(d)
    return by_cat


def auto_detect_all(
    prompt_text: str,
    definitions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    For each word in the prompt, find definitions via CAMeL morphology only.
    CAMeL pos/features are mapped to our definitions via camel_mapping
    (e.g. pos=noun -> أقسام الجملة/اسم). Unmapped analyses are printed.
    definitions: list of { id, label, category_name?, camel_feature_map? } from DB.
    Returns list of { wordIndex, definitionId, label, start, end, is_letter }.
    """
    words = get_prompt_words(prompt_text)
    use_morph = is_morphology_available()
    definitions_by_category = _build_definitions_by_category(definitions) if use_morph else {}
    seen: set = set()  # (word_index, definition_id) to avoid duplicates
    suggestions: List[Dict[str, Any]] = []

    # Precompute CAMeL analyses per word (sentence-level disambiguation when available)
    word_analyses: List[List[Dict[str, Any]]] = []
    sentence_tokens = [(w.get("word") or "").strip() for w in words]
    use_disambig = use_morph and is_disambiguation_available() and len(sentence_tokens) > 1
    if use_disambig:
        try:
            word_analyses = analyze_sentence(sentence_tokens)
            # ensure same length as words (analyze_sentence may return shorter if error)
            while len(word_analyses) < len(words):
                word_analyses.append([])
        except Exception as e:
            print(f"[auto_detect] analyze_sentence failed: {e}")
            traceback.print_exc()
            use_disambig = False
    if not use_disambig:
        for w in words:
            word_str = (w.get("word") or "").strip()
            analyses: List[Dict[str, Any]] = []
            if word_str and use_morph:
                try:
                    analyses = analyze_word(word_str) or []
                except Exception as e:
                    print(f"[auto_detect] Error analyzing word {word_str!r}: {e}")
                    traceback.print_exc()
            word_analyses.append(analyses)

    print("[auto_detect] CAMeL morphology:", get_morphology_status())
    print("[auto_detect] Sentence disambiguation:", "on" if use_disambig else "off")
    print("[auto_detect] prompt words:", [w.get("word") for w in words])
    for i, (w, analyses) in enumerate(zip(words, word_analyses)):
        word_str = (w.get("word") or "").strip()
        if word_str:
            print(f"[auto_detect] word[{i}] {word_str!r} -> CAMeL analyses (before mapping): {analyses}")
    if use_morph and get_morphology_status() == "available" and word_analyses and all(not a for a in word_analyses):
        print("[auto_detect] All words had no analyses. Install morphology data: camel_data -i morphology-db-msa-r13")

    for i, w in enumerate(words):
        word_str = (w.get("word") or "").strip()
        if not word_str:
            continue
        start_idx = w.get("start", 0)
        end_idx = w.get("end", start_idx + len(word_str))
        analyses = word_analyses[i]

        # CAMeL only: map morphology (pos, part_*, etc.) to our definitions; print unmapped
        for analysis in analyses:
            if not isinstance(analysis, dict):
                continue
            try:
                matched = definitions_matching_camel_analysis(analysis, definitions_by_category)
                if matched:
                    for d in matched:
                        key = (i, d["id"])
                        if key not in seen:
                            seen.add(key)
                            suggestions.append({
                                "wordIndex": i,
                                "definitionId": d["id"],
                                "label": d.get("label", ""),
                                "start": start_idx,
                                "end": end_idx,
                                "is_letter": False,
                            })
                else:
                    print(f"[auto_detect] Unmapped CAMeL word[{i}] {word_str!r}: {analysis}")
            except Exception as e:
                print(f"[auto_detect] Error in definitions_matching_camel_analysis: {e}")
                traceback.print_exc()
                print(f"[auto_detect] Unmapped (error) word[{i}] {word_str!r}: {analysis}")

    print(f"[auto_detect] Suggestions: {len(suggestions)} from CAMeL mapping (unmapped printed above)")
    return suggestions
