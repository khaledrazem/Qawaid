"""
Optional CAMeL Tools morphology for auto-detect and question handling.

Two main uses (per plan):
1. Auto-detect definitions: use morphology (lemma, POS) to match prompt words to definitions.
2. Questions: transformation/fill-in — normalize user answer (lemma) for comparison; optionally
   diacritize for display.

Requires: pip install camel-tools, then camel_data -i morphology-db-msa-r13
Optional: camel_data -i disambig-mle-calima-msa-r13 for sentence-level disambiguation (picks
  one reading per word from context, e.g. كتاب -> كِتاب not كُتّاب when context is "the book").
When unavailable, callers fall back to label/whitespace behaviour.
"""

import traceback
import unicodedata
from typing import Any, Dict, List, Optional

_MORPH_AVAILABLE = False
_analyzer = None
_MORPH_ERROR: Optional[str] = None
_disambiguator = None
_DISAMBIG_AVAILABLE = False

try:
    from camel_tools.morphology.database import MorphologyDB
    from camel_tools.morphology.analyzer import Analyzer
    _db = MorphologyDB.builtin_db()
    _analyzer = Analyzer(_db)
    _MORPH_AVAILABLE = True
    print("[camel_morphology] Loaded: MorphologyDB + Analyzer (morphology available)")
except ImportError as e:
    _analyzer = None
    _MORPH_AVAILABLE = False
    _MORPH_ERROR = str(e)
    print("[camel_morphology] CAMeL Tools not installed (optional). Use Python 3.10–3.12 and: pip install -r requirements-camel.txt")
except (FileNotFoundError, OSError) as e:
    _analyzer = None
    _MORPH_AVAILABLE = False
    _MORPH_ERROR = str(e)
    print("[camel_morphology] Morphology data not found (run: camel_data -i morphology-db-msa-r13). Using label/indicator matching only.")
except Exception as e:
    _analyzer = None
    _MORPH_AVAILABLE = False
    _MORPH_ERROR = str(e)
    print(f"[camel_morphology] Failed to load morphology: {e}")
    traceback.print_exc()

# Optional MLE disambiguator: uses sentence context to pick one analysis per word (e.g. كتاب -> كِتاب not كُتّاب)
if _MORPH_AVAILABLE and _analyzer is not None:
    try:
        from camel_tools.disambig.mle import MLEDisambiguator
        _disambiguator = MLEDisambiguator.pretrained(analyzer=_analyzer, top=1)
        _DISAMBIG_AVAILABLE = True
        print("[camel_morphology] Loaded: MLE disambiguator (sentence-level analysis available)")
    except ImportError:
        _disambiguator = None
        _DISAMBIG_AVAILABLE = False
    except (FileNotFoundError, OSError) as e:
        _disambiguator = None
        _DISAMBIG_AVAILABLE = False
        print(f"[camel_morphology] MLE disambiguator not found (optional: camel_data -i disambig-mle-calima-msa-r13). Using per-word analyses.")
    except Exception as e:
        _disambiguator = None
        _DISAMBIG_AVAILABLE = False
        print(f"[camel_morphology] MLE disambiguator failed to load: {e}")
        traceback.print_exc()

_normalize_ar: Optional[Any] = None
try:
    from camel_tools.utils import normalize as _ct_normalize
    _normalize_ar = _ct_normalize
except Exception as e:
    _normalize_ar = None
    print(f"[camel_morphology] Optional normalize not available: {e}")


def _normalize_word_for_analyzer(word: str) -> str:
    """
    Normalize Arabic word so it matches what the morphology DB expects.
    - Unicode NFC (composed form)
    - Optionally CAMeL: normalize_unicode, normalize_alef_ar, normalize_alef_maksura_ar, normalize_teh_marbuta_ar.
    """
    if not word or not word.strip():
        return word
    s = word.strip()
    s = unicodedata.normalize("NFC", s)
    if _normalize_ar is not None:
        try:
            if hasattr(_normalize_ar, "normalize_unicode"):
                s = _normalize_ar.normalize_unicode(s, compatibility=False)
            if hasattr(_normalize_ar, "normalize_alef_ar"):
                s = _normalize_ar.normalize_alef_ar(s)
            if hasattr(_normalize_ar, "normalize_alef_maksura_ar"):
                s = _normalize_ar.normalize_alef_maksura_ar(s)
            if hasattr(_normalize_ar, "normalize_teh_marbuta_ar"):
                s = _normalize_ar.normalize_teh_marbuta_ar(s)
        except Exception:
            pass
    return s


def is_morphology_available() -> bool:
    return _MORPH_AVAILABLE


def get_morphology_status() -> str:
    """Return a short status string for diagnostics (e.g. 'available' or why not)."""
    if _MORPH_AVAILABLE:
        return "available"
    if _MORPH_ERROR:
        return f"not loaded: {_MORPH_ERROR}"
    return "not loaded (camel_tools not installed or DB missing)"


def is_disambiguation_available() -> bool:
    """True if MLE disambiguator is loaded (sentence-level analysis)."""
    return _DISAMBIG_AVAILABLE and _disambiguator is not None


def analyze_sentence(sentence_tokens: List[str]) -> List[List[Dict[str, Any]]]:
    """
    Analyze a full sentence: one list of analyses per token.
    When MLE disambiguator is available, returns at most one analysis per word (contextually
    chosen), so e.g. كتاب in "الكتاب على الطاولة" yields كِتاب (book) not كُتّاب (writers).
    When disambiguator is not available, falls back to analyze_word per token (all possible
    analyses per word).
    sentence_tokens: list of words (e.g. from tokenizer).
    Returns: list of same length; each element is a list of analysis dicts (pos, lex, ...).
    """
    if not sentence_tokens:
        return []
    if not _MORPH_AVAILABLE or not _analyzer:
        return [analyze_word(w) for w in sentence_tokens]
    # Normalize tokens for analyzer/disambiguator
    normalized_tokens = [_normalize_word_for_analyzer(w) for w in sentence_tokens]
    if _DISAMBIG_AVAILABLE and _disambiguator is not None:
        try:
            disambig_result = _disambiguator.disambiguate(normalized_tokens)
            out: List[List[Dict[str, Any]]] = []
            for dw in disambig_result:
                analyses = []
                if dw.analyses:
                    for sa in dw.analyses:
                        if isinstance(getattr(sa, "analysis", None), dict):
                            analyses.append(sa.analysis)
                out.append(analyses)
            return out
        except Exception as e:
            print(f"[camel_morphology] analyze_sentence disambiguate failed: {e}")
            traceback.print_exc()
            return [analyze_word(w) for w in normalized_tokens]
    return [analyze_word(w) for w in normalized_tokens]


def analyze_word(word: str) -> List[Dict[str, Any]]:
    """
    Return list of morphological analyses for the word (lemma, pos, etc.).
    Input is normalized (NFC + CAMeL alef/teh/ya) so it matches the morphology DB.
    When CAMeL is unavailable, returns [].
    """
    if not word or not word.strip():
        return []
    if not _MORPH_AVAILABLE or not _analyzer:
        return []
    raw = word.strip()
    normalized = _normalize_word_for_analyzer(raw)
    if normalized != raw:
        print(f"[camel_morphology] input normalized: {raw!r} -> {normalized!r}")
    try:
        result = _analyzer.analyze(normalized)
        out = result if isinstance(result, list) else []
        if not out and normalized:
            print(f"[camel_morphology] no analyses for {normalized!r} (len={len(normalized)}, codes={[hex(ord(c)) for c in normalized[:5]]}...)")
        return out
    except Exception as e:
        print(f"[camel_morphology] analyze_word({normalized!r}) failed: {e}")
        traceback.print_exc()
        return []


def get_lemmas(word: str) -> List[str]:
    """
    Return distinct lemmas (lex) for the word. Used for matching definition labels.
    Strips trailing _N from lex (e.g. مَشَّى_1 -> مَشَّى) for label matching.
    """
    analyses = analyze_word(word)
    lemmas: List[str] = []
    seen = set()
    for a in analyses:
        if isinstance(a, dict):
            lex = a.get("lex") or a.get("lexeme")
            if lex:
                # Strip CALIMA-style suffix _1, _2 for matching
                base = lex.split("_")[0] if "_" in lex else lex
                if base and base not in seen:
                    seen.add(base)
                    lemmas.append(base)
    return lemmas


def normalize_for_comparison(word: str) -> str:
    """
    For transformation/fill-in: normalize user input for comparison (e.g. lemma or normalized form).
    When CAMeL is available, returns first lemma or original word; otherwise returns word stripped.
    """
    if not word or not word.strip():
        return ""
    lemmas = get_lemmas(word.strip())
    if lemmas:
        return lemmas[0]
    return word.strip()
