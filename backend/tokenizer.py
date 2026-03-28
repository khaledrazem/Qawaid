"""
Word tokenization for prompt text.
Uses CAMeL simple_word_tokenize when available; otherwise falls back to
whitespace split to match frontend getPromptWords (split on \\s+).
"""

from typing import List, Tuple

_CAMEL_AVAILABLE = False
try:
    from camel_tools.tokenizers.word import simple_word_tokenize
    _CAMEL_AVAILABLE = True
except ImportError:
    pass


def _words_whitespace(text: str) -> List[Tuple[int, int, str]]:
    """Split on whitespace only; return (start, end, word) for each non-empty segment."""
    result = []
    start = 0
    i = 0
    while i <= len(text):
        if i == len(text) or text[i].isspace():
            if i > start:
                result.append((start, i, text[start:i]))
            start = i + 1
        i += 1
    return result


def _words_camel(text: str) -> List[Tuple[int, int, str]]:
    """Use CAMeL simple_word_tokenize and compute (start, end) by scanning."""
    tokens = simple_word_tokenize(text)
    result = []
    pos = 0
    for tok in tokens:
        idx = text.find(tok, pos)
        if idx == -1:
            # Fallback: advance by token length (should not happen for normal input)
            result.append((pos, pos + len(tok), tok))
            pos = pos + len(tok)
        else:
            result.append((idx, idx + len(tok), tok))
            pos = idx + len(tok)
    return result


def get_prompt_words(text: str) -> List[dict]:
    """
    Return list of { "start": int, "end": int, "word": str }.
    Uses CAMeL when available; otherwise whitespace split to match Play.
    If CAMeL returns only one token but the text contains spaces, fall back to
    whitespace split so every word is returned (fixes auto-detect only seeing the first word).
    """
    if _CAMEL_AVAILABLE:
        pairs = _words_camel(text)
        # Fallback: some environments/tokenizer may return whole text as one token
        if len(pairs) == 1 and text.strip() and any(c.isspace() for c in text):
            pairs = _words_whitespace(text)
    else:
        pairs = _words_whitespace(text)
    return [{"start": s, "end": e, "word": w} for s, e, w in pairs]
