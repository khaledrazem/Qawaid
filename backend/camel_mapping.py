"""
Maps CAMeL Tools morphology features to our grammar definitions (category + label).

CAMeL returns analyses with features like:
  pos: noun, verb, part, part_interrog, part_neg, part_dem, ...
  prc0, enc0: proclitic/enclitic markers (e.g. ال for definite article)
  lex: lemma

We map these to our category names and definition labels so auto-detect can suggest
definitions when the word's morphology matches (e.g. pos=noun -> أقسام الجملة / اسم).
"""

import json
from typing import Any, Dict, List, Optional, Tuple

# (feature_name, feature_value) -> (our_category_name, our_definition_label or None)
# When label is None, we only suggest by category (any definition in that category).
# Full coverage so fallback works when DB camel_feature_map is empty or analyzer uses different keys.
CAMEL_TO_CATEGORY_LABEL: List[Tuple[str, str, str, Optional[str]]] = [
    # (feature, value, category, label)
    # أقسام الجملة: اسم، فعل، حرف
    ("pos", "noun", "أقسام الجملة", "اسم"),
    ("pos", "noun_prop", "أقسام الجملة", "اسم"),
    ("pos", "noun_num", "أقسام الجملة", "اسم"),
    ("pos", "noun_quant", "أقسام الجملة", "اسم"),
    ("pos", "adj", "أقسام الجملة", "اسم"),
    ("pos", "adj_comp", "أقسام الجملة", "اسم"),
    ("pos", "adj_num", "أقسام الجملة", "اسم"),
    ("pos", "pron", "أقسام الجملة", "اسم"),
    ("pos", "verb", "أقسام الجملة", "فعل"),
    ("pos", "verb_pseudo", "أقسام الجملة", "فعل"),
    ("pos", "part", "أقسام الجملة", "حرف"),
    ("pos", "part_dem", "أقسام الجملة", "حرف"),
    ("pos", "part_det", "أقسام الجملة", "حرف"),
    ("pos", "part_focus", "أقسام الجملة", "حرف"),
    ("pos", "part_fut", "أقسام الجملة", "حرف"),
    ("pos", "part_interrog", "أقسام الجملة", "حرف"),
    ("pos", "part_neg", "أقسام الجملة", "حرف"),
    ("pos", "part_restrict", "أقسام الجملة", "حرف"),
    ("pos", "part_verb", "أقسام الجملة", "حرف"),
    ("pos", "part_voc", "أقسام الجملة", "حرف"),
    ("pos", "prep", "أقسام الجملة", "حرف"),
    ("pos", "conj", "أقسام الجملة", "حرف"),
    ("pos", "conj_sub", "أقسام الجملة", "حرف"),
    ("pos", "adv", "أقسام الجملة", "حرف"),
    ("pos", "adv_interrog", "أقسام الجملة", "حرف"),
    ("pos", "adv_rel", "أقسام الجملة", "حرف"),
    # استفهام (consolidated: أداة استفهام)
    ("pos", "part_interrog", "الاستفهام", "أداة استفهام"),
    ("pos", "pron_interrog", "الاستفهام", "أداة استفهام"),
    ("pos", "adv_interrog", "الاستفهام", "أداة استفهام"),
    # نفي (consolidated: أداة نفي)
    ("pos", "part_neg", "النفي", "أداة نفي"),
    ("pos", "verb_pseudo", "النفي", "أداة نفي"),
    ("prc0", "lA_neg", "النفي", "أداة نفي"),
    ("prc0", "mA_neg", "النفي", "أداة نفي"),
    ("prc0", "ma_neg", "النفي", "أداة نفي"),
    # إشارة (consolidated: اسم إشارة)
    ("pos", "part_dem", "الإشارة", "اسم إشارة"),
    ("pos", "pron_dem", "الإشارة", "اسم إشارة"),
    # صفة
    ("pos", "adj", "صفة", "صفة"),
    ("pos", "adj_comp", "صفة", "صفة"),
    ("pos", "adj_num", "صفة", "صفة"),
    # الاسم الموصول (consolidated: اسم موصول)
    ("pos", "pron_rel", "الاسم الموصول", "اسم موصول"),
    # ضمائر (consolidated: ضمير)
    ("pos", "pron", "ضمائر", "ضمير"),
    # عدد (form_num / num)
    ("form_num", "s", "العدد", "مفرد"),
    ("form_num", "d", "العدد", "مثنى"),
    ("form_num", "p", "العدد", "جمع"),
    ("num", "s", "العدد", "مفرد"),
    ("num", "d", "العدد", "مثنى"),
    ("num", "p", "العدد", "جمع"),
    # جنس
    ("gen", "m", "جنس", "مذكر"),
    ("gen", "f", "جنس", "مؤنث"),
    ("form_gen", "m", "جنس", "مذكر"),
    ("form_gen", "f", "جنس", "مؤنث"),
    # المعرفة
    ("stt", "d", "المعرفة", "معرف"),
    ("stt", "i", "المعرفة", "نكرة"),
    ("prc0", "Al_det", "المعرفة", "معرف"),
    # زمان الفعل
    ("asp", "p", "زمان الفعل", "ماضي"),
    ("asp", "i", "زمان الفعل", "مضارع"),
    ("asp", "c", "زمان الفعل", "امر"),
]

# Category name -> list of (feature, value) that map to this category (for flexible lookup)
def _build_reverse() -> Dict[str, List[Tuple[str, str]]]:
    by_category: Dict[str, List[Tuple[str, str]]] = {}
    for feat, val, cat, _ in CAMEL_TO_CATEGORY_LABEL:
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append((feat, val))
    return by_category


def get_definition_hints_from_analysis(analysis: Dict[str, Any]) -> List[Tuple[str, Optional[str]]]:
    """
    Given one CAMeL analysis dict (pos, lex, prc0, enc0, etc.), return list of
    (category_name, definition_label) that this analysis can map to.
    label can be None (any definition in that category). Accepts value as str or list.
    """
    hints: List[Tuple[str, Optional[str]]] = []
    seen: set = set()
    for feat_name, feat_val, category, label in CAMEL_TO_CATEGORY_LABEL:
        val = analysis.get(feat_name)
        analysis_vals = _normalize_analysis_value(val)
        if not analysis_vals:
            continue
        if feat_val not in analysis_vals and str(feat_val) not in analysis_vals:
            continue
        key = (category, label)
        if key not in seen:
            seen.add(key)
            hints.append((category, label))
    return hints


def _normalize_analysis_value(val: Any) -> List[str]:
    """Return list of comparable strings from analysis value (may be str or list)."""
    if val is None:
        return []
    if isinstance(val, list):
        return [str(v).strip() for v in val if v is not None]
    return [str(val).strip()] if str(val).strip() else []


def definition_matches_analysis_by_db_map(analysis: Dict[str, Any], definition: Dict[str, Any]) -> bool:
    """
    True if the CAMeL analysis matches any (feature, value) in definition.camel_feature_map from DB.
    camel_feature_map is an array of { "feature": "pos", "value": "noun" } per
    https://camel-tools.readthedocs.io/en/latest/reference/camel_morphology_features.html
    Accepts camel_feature_map as list or JSON string. Checks analysis keys as-is; analyzer may use 'pos', etc.
    """
    map_raw = definition.get("camel_feature_map")
    if map_raw is None:
        return False
    if isinstance(map_raw, str):
        try:
            map_list = json.loads(map_raw) if map_raw.strip() else []
        except Exception:
            return False
    elif isinstance(map_raw, list):
        map_list = map_raw
    else:
        return False
    if not map_list:
        return False
    for entry in map_list:
        if not isinstance(entry, dict):
            continue
        feat = (entry.get("feature") or "").strip()
        want = (entry.get("value") or "").strip()
        if not feat:
            continue
        val = analysis.get(feat)
        analysis_vals = _normalize_analysis_value(val)
        if not analysis_vals:
            continue
        if want in analysis_vals:
            return True
        if str(want) in analysis_vals:
            return True
    return False


def definitions_matching_camel_analysis(
    analysis: Dict[str, Any],
    definitions_by_category: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    Given one CAMeL analysis and a map category_name -> list of definition dicts (id, label, camel_feature_map?, ...),
    return definitions that match this analysis. Prefers DB camel_feature_map when present; else uses static mapping.
    """
    out: List[Dict[str, Any]] = []
    seen_ids: set = set()
    # 1) DB-driven: definitions with camel_feature_map that matches this analysis
    for defs in definitions_by_category.values():
        for d in defs:
            if d.get("id") in seen_ids:
                continue
            if definition_matches_analysis_by_db_map(analysis, d):
                seen_ids.add(d["id"])
                out.append(d)
    if out:
        return out
    # 2) Fallback: static CAMEL_TO_CATEGORY_LABEL mapping
    hints = get_definition_hints_from_analysis(analysis)
    for category, preferred_label in hints:
        defs = definitions_by_category.get(category, [])
        for d in defs:
            if d.get("id") in seen_ids:
                continue
            if preferred_label is None or d.get("label") == preferred_label:
                seen_ids.add(d["id"])
                out.append(d)
    return out
