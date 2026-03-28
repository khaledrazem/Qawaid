"""
Suggest definition links for a prompt. Uses CAMeL morphology when available
(lemma match) in addition to exact label match.
"""

from typing import Any, Dict, List

from tokenizer import get_prompt_words

try:
    from camel_morphology import get_lemmas, is_morphology_available
except ImportError:
    def get_lemmas(word: str) -> List[str]:
        return []

    def is_morphology_available() -> bool:
        return False


def suggest_links(
    prompt_text: str,
    definitions_by_label: Dict[str, Dict],
) -> Dict[str, Any]:
    """
    definitions_by_label: map label -> { id, label, ... } from DB.
    Returns { "words": [ { start, end, word } ], "suggestions": [ { wordIndex, definitionId, label, indicatorPosition } ] }.
    When CAMeL morphology is available, also matches by lemma.
    """
    words = get_prompt_words(prompt_text)
    use_morph = is_morphology_available()
    suggestions = []
    for i, w in enumerate(words):
        word_str = w["word"].strip()
        if not word_str:
            continue
        key_lower = word_str.lower() if word_str.isascii() else word_str
        word_lemmas = get_lemmas(word_str) if use_morph else []
        for label, defn in definitions_by_label.items():
            if label == word_str or label == key_lower:
                suggestions.append({
                    "wordIndex": i,
                    "definitionId": defn["id"],
                    "label": defn["label"],
                    "indicatorPosition": None,
                })
                break
            if word_lemmas and label in word_lemmas:
                suggestions.append({
                    "wordIndex": i,
                    "definitionId": defn["id"],
                    "label": defn["label"],
                    "indicatorPosition": None,
                })
                break
    return {"words": words, "suggestions": suggestions}
