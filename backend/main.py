"""
Qawaid backend API: playable, batch, analyze, suggest-links, seed.
"""

import json
import logging
import os
import threading
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Path as ApiPath, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from config import (
    CORS_ORIGINS,
    DIFFICULTY_DEFAULT_EASY,
    DIFFICULTY_DEFAULT_HARD,
    DIFFICULTY_DEFAULT_MEDIUM,
    DIFFICULTY_TARGET_MAX,
    DIFFICULTY_TARGET_MIN,
    DIFFICULTY_WEIGHT_DELTA,
    SEED_SECRET,
    SUPABASE_JWKS_URL,
    SUPABASE_JWT_AUDIENCE,
    SUPABASE_JWT_ISSUER,
    SUPABASE_JWT_SECRET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)
from engine import generate_batch, has_playable_content
from tokenizer import get_prompt_words
from suggest_links import suggest_links
from auto_detect import auto_detect_all

app = FastAPI(title="Qawaid Backend")
logger = logging.getLogger(__name__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _validate_supabase_env() -> None:
    """Fail fast if DB client cannot be configured (avoids obscure errors on first /api call)."""
    if not (SUPABASE_URL or "").strip():
        raise RuntimeError(
            "SUPABASE_URL is not set. On Cloud Run, add env var SUPABASE_URL=https://<ref>.supabase.co "
            "(the server does not read VITE_SUPABASE_URL)."
        )
    if not (SUPABASE_SERVICE_ROLE_KEY or "").strip():
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Cloud Run (Secret Manager recommended)."
        )


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class BatchRequest(BaseModel):
    count: int = 10
    selectedCategoryIds: Optional[List[str]] = None
    usedPromptIds: Optional[List[str]] = None
    userWeights: Optional[Dict[str, float]] = None


class BatchResponse(BaseModel):
    questions: List[Dict[str, Any]]
    empty: Optional[bool] = None


class AnalyzeRequest(BaseModel):
    prompt_text: str


class SuggestLinksRequest(BaseModel):
    prompt_text: str


class AddDefinitionLinkRequest(BaseModel):
    wordIndex: int
    definitionId: str
    is_letter: bool = False
    letterIndexInWord: Optional[int] = None  # when is_letter=True, which character in the word


class AutoLinkRequest(BaseModel):
    replace: bool = False  # if True, delete all existing links then add; else merge (add only new)


class AdminAutoLinkAllRequest(BaseModel):
    """Bulk auto-link: same merge rules as single prompt (skip duplicate span + definition)."""
    replace: bool = False
    only_active: bool = False  # if True, skip prompts where is_active is false
    # True (default): NDJSON stream — keeps HTTP connection open (needed on Cloud Run for full run).
    # False: return 202 immediately and run in a background thread (may stall if host throttles CPU after response).
    stream: bool = True


class UserContext(BaseModel):
    id: str
    role: Optional[str] = None


class SessionSyncRequest(BaseModel):
    displayName: str = ""
    avatarUrl: Optional[str] = None


class DifficultyProfileRequest(BaseModel):
    easy: float
    medium: float
    hard: float


class RecordAnswerRequest(BaseModel):
    points: int = 0
    totalQuestionsAnswered: int = 0
    displayName: Optional[str] = None
    avatarUrl: Optional[str] = None


def _get_sb():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


_jwks_client: Optional[jwt.PyJWKClient] = None


def _get_jwks_client() -> Optional[jwt.PyJWKClient]:
    """Create (once) a JWKS client for Supabase new signing keys."""
    global _jwks_client
    jwks_url = SUPABASE_JWKS_URL or (f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else "")
    if not jwks_url:
        return None
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(jwks_url)
    return _jwks_client


def _decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Decode Supabase JWT.
    Priority:
      1) JWKS (new signing keys, usually RS256/ES256)
      2) Legacy shared secret (HS256)
    """
    options = {"verify_aud": bool(SUPABASE_JWT_AUDIENCE)}
    issuer = SUPABASE_JWT_ISSUER or (f"{SUPABASE_URL.rstrip('/')}/auth/v1" if SUPABASE_URL else None)

    # New signing keys path (recommended by Supabase)
    jwks_client = _get_jwks_client()
    if jwks_client is not None:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=SUPABASE_JWT_AUDIENCE or None,
                issuer=issuer,
                options=options,
            )
        except jwt.PyJWTError:
            # If JWKS verification fails and legacy secret exists, fallback below.
            if not SUPABASE_JWT_SECRET:
                raise

    # Legacy shared-secret path
    if SUPABASE_JWT_SECRET:
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=SUPABASE_JWT_AUDIENCE or None,
            issuer=issuer,
            options=options,
        )

    raise jwt.PyJWTError(
        "No JWT verification method configured. Set SUPABASE_JWKS_URL/SUPABASE_URL "
        "for new signing keys or SUPABASE_JWT_SECRET for legacy HS256."
    )


def get_current_user(authorization: Optional[str] = Header(None, alias="Authorization")) -> UserContext:
    """
    Extract user id from Supabase JWT sent as Authorization: Bearer <token>.
    Used for player-level endpoints (questions, leaderboard, etc.).
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = parts[1]
    try:
        # Supabase JWT: sub = user id, role in 'role' claim.
        payload = _decode_supabase_jwt(token)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub (user id)")
    return UserContext(id=user_id, role=payload.get("role"))


def get_optional_user(authorization: Optional[str] = Header(None, alias="Authorization")) -> Optional[UserContext]:
    """
    Like get_current_user but allows unauthenticated requests.
    Returns None when Authorization header is missing/empty.
    """
    if not authorization:
        return None
    return get_current_user(authorization)


def _require_admin(user: UserContext) -> None:
    """Raise 403 if user is not admin (is_admin in users table)."""
    sb = _get_sb()
    r = sb.table("users").select("is_admin").eq("id", user.id).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(status_code=403, detail="User not found")
    if not r.data[0].get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin required")


# ---------------------------------------------------------------------------
# Supabase helper for suggest-links (definitions + categories)
# ---------------------------------------------------------------------------

def _get_definitions_by_label() -> Dict[str, Dict]:
    sb = _get_sb()
    r = sb.table("definitions").select("id, label").eq("is_active", True).execute()
    if not r.data:
        return {}
    return {d["label"]: d for d in r.data}


def _get_all_definitions() -> List[Dict]:
    """Definitions with id, label; used when category not needed."""
    sb = _get_sb()
    r = sb.table("definitions").select("id, label").eq("is_active", True).execute()
    return r.data or []


def _get_all_definitions_with_categories() -> List[Dict]:
    """Definitions with id, label, camel_feature_map and category_name. One entry per definition–category pair for CAMeL mapping."""
    sb = _get_sb()
    r = sb.table("definitions").select("id, label, camel_feature_map").eq("is_active", True).execute()
    defs = r.data or []
    if not defs:
        return []
    cd_r = sb.table("category_definitions").select("definition_id, category_id").execute()
    cat_r = sb.table("categories").select("id, name").execute()
    cat_by_id = {c["id"]: c["name"] for c in (cat_r.data or [])}
    def_by_id = {d["id"]: d for d in defs}
    out: List[Dict] = []
    for row in cd_r.data or []:
        did = row["definition_id"]
        cat_name = cat_by_id.get(row["category_id"], "")
        if not cat_name or did not in def_by_id:
            continue
        out.append({**def_by_id[did], "category_name": cat_name})
    return out if out else [{**d, "category_name": ""} for d in defs]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/questions/playable")
def get_playable() -> Dict[str, bool]:
    """Returns { playable: true } if active prompts, prompt_definitions, and questions exist."""
    return {"playable": has_playable_content()}


@app.post("/api/questions/batch", response_model=BatchResponse)
def post_batch(body: BatchRequest) -> BatchResponse:
    """Generate a batch of questions for the current user (id from JWT)."""
    questions = generate_batch(
        count=body.count,
        used_prompt_ids=body.usedPromptIds,
        selected_category_ids=body.selectedCategoryIds,
        user_weights=body.userWeights,
    )
    return BatchResponse(questions=questions, empty=len(questions) == 0)


def _current_month() -> str:
    """Return current month as YYYY-MM (matches monthly_scores.month)."""
    from datetime import datetime

    now = datetime.utcnow()
    return f"{now.year}-{now.month:02d}"


@app.get("/api/leaderboard/monthly")
def get_monthly_leaderboard(user: Optional[UserContext] = Depends(get_optional_user)) -> Dict[str, Any]:
    """
    Monthly leaderboard for the current month.
    Returns { topUsers: LeaderboardEntryDTO[], surroundingUsers: LeaderboardEntryDTO[], currentUserRank: number | null }.
    """
    month = _current_month()
    sb = _get_sb()
    r = sb.table("monthly_scores").select("user_id, points, display_name, avatar_url").eq("month", month).order("points", desc=True).execute()
    rows = r.data or []
    if not rows:
        return {"topUsers": [], "surroundingUsers": [], "currentUserRank": None}

    # Map to entries with rank
    entries = [
        {
            "userId": row["user_id"],
            "displayName": row.get("display_name") or "مجهول",
            "avatarUrl": row.get("avatar_url") or None,
            "rank": idx + 1,
            "points": row.get("points") or 0,
        }
        for idx, row in enumerate(rows)
    ]

    # Top N (same as frontend LEADERBOARD.topCount; backend just returns all, client can slice)
    top_users = entries

    # Surrounding users around current user
    surrounding_users: List[Dict[str, Any]] = []
    current_rank: Optional[int] = None
    if user is not None:
        user_id = user.id
        idx = next((i for i, e in enumerate(entries) if e["userId"] == user_id), -1)
        if idx >= 0:
            current_rank = entries[idx]["rank"]
            # Use ±3 as a reasonable surrounding window; client can adjust later if needed
            start = max(0, idx - 3)
            end = min(len(entries), idx + 4)
            surrounding_users = entries[start:end]
            # Remove any that are already in topUsers to avoid duplicates
            top_ids = {e["userId"] for e in top_users}
            surrounding_users = [e for e in surrounding_users if e["userId"] not in top_ids]

    return {"topUsers": top_users, "surroundingUsers": surrounding_users, "currentUserRank": current_rank}


@app.get("/api/leaderboard/global")
def get_global_leaderboard() -> List[Dict[str, Any]]:
    """
    Global all-time leaderboard.
    Returns LeaderboardEntryDTO[] (userId, displayName, avatarUrl, rank, points).
    """
    sb = _get_sb()
    r = sb.table("monthly_scores").select("user_id, points, display_name, avatar_url").execute()
    rows = r.data or []
    if not rows:
        return []

    agg: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        uid = row["user_id"]
        entry = agg.get(uid)
        pts = row.get("points") or 0
        if entry:
            entry["points"] += pts
            # prefer latest non-empty display info
            if row.get("display_name"):
                entry["displayName"] = row["display_name"]
            if row.get("avatar_url"):
                entry["avatarUrl"] = row["avatar_url"]
        else:
            agg[uid] = {
                "userId": uid,
                "displayName": row.get("display_name") or "مجهول",
                "avatarUrl": row.get("avatar_url") or None,
                "points": pts,
            }

    sorted_entries = sorted(agg.values(), key=lambda e: e["points"], reverse=True)
    for idx, e in enumerate(sorted_entries):
        e["rank"] = idx + 1
    return sorted_entries


# ---------------------------------------------------------------------------
# User & session (JWT)
# ---------------------------------------------------------------------------

@app.post("/api/user/session-sync")
def post_session_sync(body: SessionSyncRequest, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Upsert current user (display_name, avatar_url), ensure user_stats and
    monthly_scores row for current month exist. Idempotent; call after login.
    """
    uid = user.id
    sb = _get_sb()
    month = _current_month()
    display_name = (body.displayName or "").strip() or "لاعب"
    avatar_url = body.avatarUrl

    # Upsert users
    r = sb.table("users").select("id").eq("id", uid).execute()
    if r.data and len(r.data) > 0:
        sb.table("users").update({
            "display_name": display_name,
            "avatar_url": avatar_url,
            "updated_at": _utc_now_iso(),
        }).eq("id", uid).execute()
    else:
        sb.table("users").insert({
            "id": uid,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "is_admin": False,
        }).execute()

    # Ensure user_stats
    rs = sb.table("user_stats").select("user_id").eq("user_id", uid).execute()
    if not rs.data or len(rs.data) == 0:
        sb.table("user_stats").insert({"user_id": uid}).execute()

    # Ensure user_difficulty_profile (defaults)
    rd = sb.table("user_difficulty_profile").select("user_id").eq("user_id", uid).execute()
    if not rd.data or len(rd.data) == 0:
        sb.table("user_difficulty_profile").insert({
            "user_id": uid,
            "easy_weight": DIFFICULTY_DEFAULT_EASY,
            "medium_weight": DIFFICULTY_DEFAULT_MEDIUM,
            "hard_weight": DIFFICULTY_DEFAULT_HARD,
        }).execute()

    # Ensure monthly_scores for current month
    rm = sb.table("monthly_scores").select("id").eq("user_id", uid).eq("month", month).execute()
    if not rm.data or len(rm.data) == 0:
        sb.table("monthly_scores").insert({
            "user_id": uid,
            "month": month,
            "points": 0,
            "display_name": display_name,
            "avatar_url": avatar_url,
        }).execute()
    else:
        sb.table("monthly_scores").update({
            "display_name": display_name,
            "avatar_url": avatar_url,
        }).eq("user_id", uid).eq("month", month).execute()

    return {"ok": True}


def _utc_now_iso() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


class UserProfilePatch(BaseModel):
    displayName: Optional[str] = None


@app.get("/api/user/profile")
def get_user_profile(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """Return id, displayName, avatarUrl, isAdmin and optional stats for the current user."""
    sb = _get_sb()
    r = sb.table("users").select("id, display_name, avatar_url, is_admin").eq("id", user.id).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")
    row = r.data[0]
    out = {
        "id": row["id"],
        "displayName": row.get("display_name") or "لاعب",
        "avatarUrl": row.get("avatar_url"),
        "isAdmin": bool(row.get("is_admin")),
    }
    rs = sb.table("user_stats").select("lifetime_points, total_questions_answered, best_session_questions").eq("user_id", user.id).execute()
    if rs.data and len(rs.data) > 0:
        s = rs.data[0]
        out["lifetimePoints"] = s.get("lifetime_points") or 0
        out["totalQuestionsAnswered"] = s.get("total_questions_answered") or 0
        out["bestSessionQuestions"] = s.get("best_session_questions") or 0
    return out


@app.patch("/api/user/profile")
def patch_user_profile(body: UserProfilePatch, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """Update display name for the current user."""
    if body.displayName is not None:
        trimmed = (body.displayName or "").strip() or "لاعب"
        sb = _get_sb()
        sb.table("users").update({"display_name": trimmed, "updated_at": _utc_now_iso()}).eq("id", user.id).execute()
    return {"ok": True}


@app.get("/api/user/difficulty-profile")
def get_difficulty_profile(user: UserContext = Depends(get_current_user)) -> Dict[str, float]:
    """Return easy, medium, hard weights for the current user."""
    sb = _get_sb()
    r = sb.table("user_difficulty_profile").select("easy_weight, medium_weight, hard_weight").eq("user_id", user.id).execute()
    if not r.data or len(r.data) == 0:
        return {
            "easy": DIFFICULTY_DEFAULT_EASY,
            "medium": DIFFICULTY_DEFAULT_MEDIUM,
            "hard": DIFFICULTY_DEFAULT_HARD,
        }
    row = r.data[0]
    return {
        "easy": float(row.get("easy_weight", DIFFICULTY_DEFAULT_EASY)),
        "medium": float(row.get("medium_weight", DIFFICULTY_DEFAULT_MEDIUM)),
        "hard": float(row.get("hard_weight", DIFFICULTY_DEFAULT_HARD)),
    }


@app.post("/api/user/difficulty-profile")
def post_difficulty_profile(body: DifficultyProfileRequest, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """Upsert difficulty weights for the current user."""
    sb = _get_sb()
    r = sb.table("user_difficulty_profile").select("user_id").eq("user_id", user.id).execute()
    row = {
        "easy_weight": body.easy,
        "medium_weight": body.medium,
        "hard_weight": body.hard,
        "updated_at": _utc_now_iso(),
    }
    if r.data and len(r.data) > 0:
        sb.table("user_difficulty_profile").update(row).eq("user_id", user.id).execute()
    else:
        sb.table("user_difficulty_profile").insert({
            "user_id": user.id,
            **row,
        }).execute()
    return {"ok": True}


@app.get("/api/categories")
def get_categories() -> List[Dict[str, Any]]:
    """Return active categories for player (e.g. settings modal)."""
    sb = _get_sb()
    r = sb.table("categories").select("id, name, is_active").eq("is_active", True).order("name").execute()
    return r.data or []


class QuestionReportRequest(BaseModel):
    prompt_id: str
    definition_id: Optional[str] = None
    comment: str


@app.post("/api/question-reports")
def post_question_report(body: QuestionReportRequest, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """Submit a question report from the player."""
    sb = _get_sb()
    sb.table("question_reports").insert({
        "prompt_id": body.prompt_id,
        "definition_id": body.definition_id,
        "user_id": user.id,
        "comment": (body.comment or "").strip()[:2000],
    }).execute()
    return {"ok": True}


@app.get("/api/lessons")
def get_lessons() -> List[Dict[str, Any]]:
    """Return active lessons with category name for player."""
    sb = _get_sb()
    r = sb.table("lessons").select("id, title, category_id").eq("is_active", True).order("title").execute()
    rows = r.data or []
    if not rows:
        return []
    cat_ids = list({row["category_id"] for row in rows})
    cat_r = sb.table("categories").select("id, name").in_("id", cat_ids).execute()
    cat_by_id = {c["id"]: c["name"] for c in (cat_r.data or [])}
    return [
        {"id": row["id"], "title": row["title"], "categoryId": row["category_id"], "categoryName": cat_by_id.get(row["category_id"], "")}
        for row in rows
    ]


@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: str) -> Dict[str, Any]:
    """Return a single lesson by id."""
    sb = _get_sb()
    r = sb.table("lessons").select("id, title, content_html, category_id").eq("id", lesson_id).eq("is_active", True).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    row = r.data[0]
    cat_r = sb.table("categories").select("name").eq("id", row["category_id"]).execute()
    cat_name = (cat_r.data or [{}])[0].get("name", "") if cat_r.data else ""
    return {
        "id": row["id"],
        "title": row["title"],
        "contentHtml": row.get("content_html"),
        "categoryId": row["category_id"],
        "categoryName": cat_name,
    }


@app.post("/api/leaderboard/record-answer")
def post_record_answer(body: RecordAnswerRequest, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Record session result: update monthly_scores (+points), user_stats,
    and run difficulty adaptation. Call once per finished session.
    """
    uid = user.id
    sb = _get_sb()
    month = _current_month()
    points = max(0, body.points)
    total_questions = max(0, body.totalQuestionsAnswered)
    display_name = (body.displayName or "").strip() or "لاعب"
    avatar_url = body.avatarUrl

    # Monthly score upsert
    rm = sb.table("monthly_scores").select("id, points").eq("user_id", uid).eq("month", month).execute()
    if rm.data and len(rm.data) > 0:
        existing_points = rm.data[0].get("points") or 0
        sb.table("monthly_scores").update({
            "points": existing_points + points,
            "display_name": display_name,
            "avatar_url": avatar_url,
        }).eq("user_id", uid).eq("month", month).execute()
    else:
        sb.table("monthly_scores").insert({
            "user_id": uid,
            "month": month,
            "points": points,
            "display_name": display_name,
            "avatar_url": avatar_url,
        }).execute()

    # User stats
    rs = sb.table("user_stats").select("lifetime_points, total_questions_answered, best_session_questions").eq("user_id", uid).execute()
    if rs.data and len(rs.data) > 0:
        row = rs.data[0]
        new_lifetime = (row.get("lifetime_points") or 0) + points
        new_total = (row.get("total_questions_answered") or 0) + total_questions
        new_best = max(row.get("best_session_questions") or 0, total_questions)
        sb.table("user_stats").update({
            "lifetime_points": new_lifetime,
            "total_questions_answered": new_total,
            "best_session_questions": new_best,
            "updated_at": _utc_now_iso(),
        }).eq("user_id", uid).execute()
    else:
        sb.table("user_stats").insert({
            "user_id": uid,
            "lifetime_points": points,
            "total_questions_answered": total_questions,
            "best_session_questions": total_questions,
        }).execute()

    # Difficulty adaptation
    _run_difficulty_adaptation(sb, uid, total_questions)

    return {"ok": True}


def _run_difficulty_adaptation(sb, user_id: str, questions_answered: int) -> None:
    """Adjust user_difficulty_profile based on session performance."""
    r = sb.table("user_difficulty_profile").select("easy_weight, medium_weight, hard_weight").eq("user_id", user_id).execute()
    if not r.data or len(r.data) == 0:
        return
    row = r.data[0]
    current = {
        "easy": float(row.get("easy_weight", DIFFICULTY_DEFAULT_EASY)),
        "medium": float(row.get("medium_weight", DIFFICULTY_DEFAULT_MEDIUM)),
        "hard": float(row.get("hard_weight", DIFFICULTY_DEFAULT_HARD)),
    }

    def clamp(v: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, v))

    if questions_answered > DIFFICULTY_TARGET_MAX:
        adjusted = {
            "easy": clamp(current["easy"] - DIFFICULTY_WEIGHT_DELTA, 0.05, 0.90),
            "medium": clamp(current["medium"] + DIFFICULTY_WEIGHT_DELTA * 0.6, 0.05, 0.90),
            "hard": clamp(current["hard"] + DIFFICULTY_WEIGHT_DELTA * 0.4, 0.05, 0.90),
        }
    elif questions_answered < DIFFICULTY_TARGET_MIN:
        adjusted = {
            "easy": clamp(current["easy"] + DIFFICULTY_WEIGHT_DELTA, 0.05, 0.90),
            "medium": clamp(current["medium"] - DIFFICULTY_WEIGHT_DELTA * 0.6, 0.05, 0.90),
            "hard": clamp(current["hard"] - DIFFICULTY_WEIGHT_DELTA * 0.4, 0.05, 0.90),
        }
    else:
        return

    s = adjusted["easy"] + adjusted["medium"] + adjusted["hard"]
    if s <= 0:
        return
    final = {
        "easy_weight": round(adjusted["easy"] / s, 4),
        "medium_weight": round(adjusted["medium"] / s, 4),
        "hard_weight": round(adjusted["hard"] / s, 4),
    }
    sb.table("user_difficulty_profile").update({
        **final,
        "updated_at": _utc_now_iso(),
    }).eq("user_id", user_id).execute()


@app.post("/api/prompts/analyze")
def post_analyze(body: AnalyzeRequest) -> Dict[str, List[Dict]]:
    """Return word spans from tokenizer (CAMeL or whitespace)."""
    words = get_prompt_words(body.prompt_text)
    return {"words": words}


@app.post("/api/prompts/suggest-links")
def post_suggest_links(body: SuggestLinksRequest) -> Dict[str, Any]:
    """Return words + suggested definition links per word (label match)."""
    definitions_by_label = _get_definitions_by_label()
    return suggest_links(body.prompt_text, definitions_by_label)


def _get_prompt_text(prompt_id: str) -> Optional[str]:
    sb = _get_sb()
    r = sb.table("prompts").select("prompt_text").eq("id", prompt_id).execute()
    if not r.data or len(r.data) == 0:
        return None
    return r.data[0].get("prompt_text")


def _run_auto_link(
    sb: Any,
    prompt_id: str,
    prompt_text: str,
    replace: bool,
    definitions: List[Dict[str, Any]],
    *,
    quiet: bool = False,
) -> List[Dict[str, Any]]:
    """
    Insert prompt_definitions from CAMeL auto_detect_all.
    When replace is False, skips rows that already exist (same definition_id + index_start + index_end).
    """
    if not (prompt_text or "").strip():
        return []

    if replace:
        sb.table("prompt_definitions").delete().eq("prompt_id", prompt_id).execute()

    existing = set()
    if not replace:
        r = sb.table("prompt_definitions").select("definition_id, index_start, index_end").eq("prompt_id", prompt_id).execute()
        for row in r.data or []:
            key = (row["definition_id"], row["index_start"], row.get("index_end"))
            existing.add(key)

    suggestions = auto_detect_all(prompt_text, definitions, quiet=quiet)
    created: List[Dict[str, Any]] = []
    for s in suggestions:
        key = (s["definitionId"], s["start"], s["end"])
        if key in existing:
            continue
        is_letter = s.get("is_letter", False)
        row = {
            "prompt_id": prompt_id,
            "definition_id": s["definitionId"],
            "index_start": int(s["start"]),
            "index_end": int(s["end"]),
            "is_letter": is_letter,
        }
        ins = sb.table("prompt_definitions").insert(row).execute()
        if ins.data and len(ins.data) > 0:
            created.append({
                "id": ins.data[0]["id"],
                "prompt_id": prompt_id,
                "definition_id": s["definitionId"],
                "index_start": row["index_start"],
                "index_end": row["index_end"],
                "is_letter": is_letter,
            })
            existing.add(key)

    return created


AUTO_LINK_ALL_BATCH_SIZE = 25

_auto_link_all_lock = threading.Lock()
_auto_link_all_running = False


def _try_begin_auto_link_all() -> bool:
    global _auto_link_all_running
    with _auto_link_all_lock:
        if _auto_link_all_running:
            return False
        _auto_link_all_running = True
        return True


def _end_auto_link_all() -> None:
    global _auto_link_all_running
    with _auto_link_all_lock:
        _auto_link_all_running = False


def _bulk_auto_link_all_iter(
    replace: bool,
    work: List[Tuple[str, str]],
):
    """
    Yields event dicts: started → batch (per chunk) → complete.
    Single implementation for streaming HTTP and background thread (same batching, no artificial cap).
    """
    n = len(work)
    t0 = time.monotonic()
    if n == 0:
        yield {
            "event": "complete",
            "links_total": 0,
            "errors": [],
            "prompts_processed": 0,
            "elapsed_sec": 0.0,
        }
        logger.info("auto-link-all: no prompts to process")
        return

    batches = (n + AUTO_LINK_ALL_BATCH_SIZE - 1) // AUTO_LINK_ALL_BATCH_SIZE
    logger.info(
        "auto-link-all START prompt_count=%s total_batches=%s batch_size=%s replace=%s",
        n,
        batches,
        AUTO_LINK_ALL_BATCH_SIZE,
        replace,
    )

    sb = _get_sb()
    definitions = _get_all_definitions_with_categories()
    yield {
        "event": "started",
        "prompt_count": n,
        "total_batches": batches,
        "batch_size": AUTO_LINK_ALL_BATCH_SIZE,
    }

    total_created = 0
    errors: List[Dict[str, str]] = []
    prompts_processed = 0

    for bi in range(batches):
        start = bi * AUTO_LINK_ALL_BATCH_SIZE
        chunk = work[start : start + AUTO_LINK_ALL_BATCH_SIZE]
        batch_created = 0
        logger.info(
            "auto-link-all BATCH_BEGIN batch=%s/%s prompts_in_batch=%s",
            bi + 1,
            batches,
            len(chunk),
        )
        for pid, ptext in chunk:
            try:
                created = _run_auto_link(sb, pid, ptext, replace, definitions, quiet=True)
                c = len(created)
                batch_created += c
                total_created += c
                prompts_processed += 1
            except Exception as e:
                err = {"prompt_id": pid, "detail": f"{type(e).__name__}: {e}"}
                errors.append(err)
                logger.warning("auto-link-all PROMPT_FAIL id=%s %s", pid, e)

        elapsed = time.monotonic() - t0
        batch_evt = {
            "event": "batch",
            "batch_index": bi + 1,
            "total_batches": batches,
            "prompts_in_batch": len(chunk),
            "prompts_processed_total": prompts_processed,
            "links_this_batch": batch_created,
            "links_total": total_created,
            "errors_total": len(errors),
            "elapsed_sec": round(elapsed, 2),
        }
        yield batch_evt
        logger.info(
            "auto-link-all BATCH_END batch=%s/%s links_batch=%s links_total=%s errors_total=%s elapsed_sec=%.2f",
            bi + 1,
            batches,
            batch_created,
            total_created,
            len(errors),
            elapsed,
        )

    elapsed = time.monotonic() - t0
    yield {
        "event": "complete",
        "links_total": total_created,
        "errors": errors,
        "prompts_processed": prompts_processed,
        "elapsed_sec": round(elapsed, 2),
    }
    logger.info(
        "auto-link-all COMPLETE links_total=%s prompts_processed=%s prompt_errors=%s elapsed_sec=%.2f — job finished normally",
        total_created,
        prompts_processed,
        len(errors),
        elapsed,
    )


def _ndjson_stream_auto_link_all(replace: bool, work: List[Tuple[str, str]]):
    """Encode iterator events as NDJSON; release lock on exit or client disconnect."""
    acquired = False
    try:
        if not _try_begin_auto_link_all():
            yield (json.dumps({"event": "error", "detail": "already_running"}, ensure_ascii=False) + "\n").encode(
                "utf-8"
            )
            logger.warning("auto-link-all stream rejected: job already running")
            return
        acquired = True
        logger.info("auto-link-all stream: lock acquired, beginning NDJSON stream")
        for evt in _bulk_auto_link_all_iter(replace, work):
            line = json.dumps(evt, ensure_ascii=False) + "\n"
            yield line.encode("utf-8")
    except GeneratorExit:
        logger.warning(
            "auto-link-all stream aborted (client disconnected or proxy closed). "
            "Partial progress is saved per prompt; re-run merge mode to continue."
        )
        raise
    except Exception as e:
        logger.exception("auto-link-all stream fatal: %s", e)
        yield (json.dumps({"event": "fatal", "error": f"{type(e).__name__}: {e}"}, ensure_ascii=False) + "\n").encode(
            "utf-8"
        )
    finally:
        if acquired:
            _end_auto_link_all()
            logger.info("auto-link-all stream: lock released (finally)")


@app.post("/api/prompts/{prompt_id}/definitions")
def post_prompt_definitions(
    prompt_id: str = ApiPath(..., description="Prompt UUID"),
    body: AddDefinitionLinkRequest = ...,
) -> Dict[str, Any]:
    """Create a prompt_definition from analyze-derived indices. No user-supplied indices."""
    prompt_text = _get_prompt_text(prompt_id)
    if not prompt_text:
        raise HTTPException(status_code=404, detail="Prompt not found")
    words = get_prompt_words(prompt_text)
    if body.wordIndex < 0 or body.wordIndex >= len(words):
        raise HTTPException(status_code=400, detail="Invalid wordIndex")
    w = words[body.wordIndex]
    start = w["start"]
    end = w["end"]
    is_letter = body.is_letter
    if is_letter and body.letterIndexInWord is not None:
        word_len = end - start
        idx = max(0, min(body.letterIndexInWord, word_len - 1))
        start = start + idx
        end = start + 1
    sb = _get_sb()
    row = {
        "prompt_id": prompt_id,
        "definition_id": body.definitionId,
        "index_start": start,
        "index_end": end,
        "is_letter": is_letter,
    }
    ins = sb.table("prompt_definitions").insert(row).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return {"id": ins.data[0]["id"], "index_start": start, "index_end": end if not is_letter else None, "is_letter": is_letter}


@app.post("/api/prompts/{prompt_id}/auto-link")
def post_prompt_auto_link(
    prompt_id: str = ApiPath(..., description="Prompt UUID"),
    body: Optional[AutoLinkRequest] = None,
) -> Dict[str, Any]:
    """
    Auto-detect all definition links for this prompt and create prompt_definitions.
    replace=False (default): merge — only add suggestions that don't already exist (same span + definition).
    replace=True: delete all existing prompt_definitions for this prompt, then create all from auto-detect.
    Returns { created: [ { id, prompt_id, definition_id, index_start, index_end, is_letter }, ... ] }.
    """
    try:
        prompt_text = _get_prompt_text(prompt_id)
        if not prompt_text:
            raise HTTPException(status_code=404, detail="Prompt not found")
        sb = _get_sb()
        replace = body.replace if body else False
        definitions = _get_all_definitions_with_categories()
        created = _run_auto_link(sb, prompt_id, prompt_text, replace, definitions, quiet=False)
        return {"created": created}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n{tb}")


# ---------------------------------------------------------------------------
# Admin CRUD (JWT + is_admin)
# ---------------------------------------------------------------------------

class AdminPromptCreate(BaseModel):
    prompt_text: str
    difficulty: str = "medium"


class AdminPromptPatch(BaseModel):
    is_active: Optional[bool] = None
    image_url: Optional[str] = None
    definition_id: Optional[str] = None


class AdminDefinitionCreate(BaseModel):
    label: str
    category_ids: Optional[List[str]] = None


class AdminDefinitionPatch(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    category_ids: Optional[List[str]] = None


class AdminCategoryCreate(BaseModel):
    name: str
    definition_ids: Optional[List[str]] = None


class AdminCategoryPatch(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    definition_ids: Optional[List[str]] = None


class AdminQuestionCreate(BaseModel):
    question_text: str
    category_id: str
    type: str = "MCQ"
    is_active: bool = True


class AdminQuestionPatch(BaseModel):
    question_text: Optional[str] = None
    category_id: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None


@app.get("/api/admin/prompts")
def admin_get_prompts(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    prompts = sb.table("prompts").select("*").order("created_at", desc=True).execute()
    pd = sb.table("prompt_definitions").select("*").execute()
    definitions = sb.table("definitions").select("*").order("label").execute()
    return {
        "prompts": prompts.data or [],
        "prompt_definitions": pd.data or [],
        "definitions": definitions.data or [],
    }


@app.post("/api/admin/prompts/auto-link-all")
def admin_auto_link_all(
    body: AdminAutoLinkAllRequest = AdminAutoLinkAllRequest(),
    user: UserContext = Depends(get_current_user),
) -> Any:
    """
    Queue CAMeL auto-detect for every prompt (optional: only_active). Returns 202 immediately;
    work runs in a background thread in batches of AUTO_LINK_ALL_BATCH_SIZE. Merge semantics
    unchanged: existing links kept; new (definition_id, span) pairs inserted.
    """
    _require_admin(user)
    replace = body.replace
    only_active = body.only_active

    sb = _get_sb()
    pr = sb.table("prompts").select("id, prompt_text, is_active").execute()
    rows = pr.data or []
    if only_active:
        rows = [r for r in rows if r.get("is_active")]

    work: List[Tuple[str, str]] = []
    for row in rows:
        pid = row.get("id")
        ptext = row.get("prompt_text") or ""
        if not pid or not (ptext or "").strip():
            continue
        work.append((str(pid), str(ptext)))

    if not work:
        return {
            "status": "noop",
            "message": "No prompts with text to process.",
            "prompt_count": 0,
            "batch_size": AUTO_LINK_ALL_BATCH_SIZE,
        }

    if body.stream:
        return StreamingResponse(
            _ndjson_stream_auto_link_all(replace, work),
            media_type="application/x-ndjson",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    if not _try_begin_auto_link_all():
        raise HTTPException(
            status_code=409,
            detail="An auto-link-all job is already running. Wait for it to finish, then try again.",
        )

    def run_job() -> None:
        try:
            for _evt in _bulk_auto_link_all_iter(replace, work):
                pass
        except Exception as e:
            logger.exception("auto-link-all background thread failed: %s", e)
        finally:
            _end_auto_link_all()
            logger.info("auto-link-all background: lock released (finally)")

    threading.Thread(target=run_job, daemon=False, name="auto-link-all-bg").start()

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "status": "accepted",
            "message": "Processing in background (stream=false). Prefer stream=true so the host keeps CPU until done.",
            "prompt_count": len(work),
            "batch_size": AUTO_LINK_ALL_BATCH_SIZE,
        },
    )


@app.post("/api/admin/prompts")
def admin_create_prompt(body: AdminPromptCreate, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    ins = sb.table("prompts").insert({
        "prompt_text": body.prompt_text.strip(),
        "difficulty": body.difficulty,
    }).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return ins.data[0]


@app.patch("/api/admin/prompts/{prompt_id}")
def admin_patch_prompt(
    prompt_id: str,
    body: AdminPromptPatch,
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    payload: Dict[str, Any] = {}
    if body.is_active is not None:
        payload["is_active"] = body.is_active
    if body.image_url is not None:
        payload["image_url"] = body.image_url
    if body.definition_id is not None:
        payload["definition_id"] = body.definition_id
    if not payload:
        return {"ok": True}
    sb.table("prompts").update(payload).eq("id", prompt_id).execute()
    return {"ok": True}


@app.delete("/api/admin/prompts/{prompt_id}")
def admin_delete_prompt(prompt_id: str, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    sb.table("prompt_definitions").delete().eq("prompt_id", prompt_id).execute()
    sb.table("prompts").delete().eq("id", prompt_id).execute()
    return {"ok": True}


@app.delete("/api/admin/prompts/{prompt_id}/prompt-definitions")
def admin_delete_prompt_definitions(prompt_id: str, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    sb.table("prompt_definitions").delete().eq("prompt_id", prompt_id).execute()
    return {"ok": True}


@app.delete("/api/admin/prompt-definitions/{pd_id}")
def admin_delete_prompt_definition(pd_id: str, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    sb.table("prompt_definitions").delete().eq("id", pd_id).execute()
    return {"ok": True}


@app.get("/api/admin/definitions")
def admin_get_definitions(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    definitions = sb.table("definitions").select("*").order("label").execute()
    categories = sb.table("categories").select("*").order("name").execute()
    cd = sb.table("category_definitions").select("category_id, definition_id").execute()
    return {
        "definitions": definitions.data or [],
        "categories": categories.data or [],
        "category_definitions": cd.data or [],
    }


@app.post("/api/admin/definitions")
def admin_create_definition(body: AdminDefinitionCreate, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    ins = sb.table("definitions").insert({"label": body.label.strip(), "is_active": True}).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    def_id = ins.data[0]["id"]
    for cid in body.category_ids or []:
        sb.table("category_definitions").insert({"category_id": cid, "definition_id": def_id}).execute()
    return ins.data[0]


@app.patch("/api/admin/definitions/{definition_id}")
def admin_patch_definition(
    definition_id: str,
    body: AdminDefinitionPatch,
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    payload: Dict[str, Any] = {}
    if body.label is not None:
        payload["label"] = body.label.strip()
    if body.description is not None:
        payload["description"] = body.description.strip() or None
    if body.is_active is not None:
        payload["is_active"] = body.is_active
    if payload:
        sb.table("definitions").update(payload).eq("id", definition_id).execute()
    if body.category_ids is not None:
        sb.table("category_definitions").delete().eq("definition_id", definition_id).execute()
        for cid in body.category_ids:
            sb.table("category_definitions").insert({"category_id": cid, "definition_id": definition_id}).execute()
    return {"ok": True}


@app.delete("/api/admin/definitions/{definition_id}")
def admin_delete_definition(definition_id: str, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    sb.table("category_definitions").delete().eq("definition_id", definition_id).execute()
    sb.table("prompt_definitions").delete().eq("definition_id", definition_id).execute()
    sb.table("definitions").delete().eq("id", definition_id).execute()
    return {"ok": True}


@app.get("/api/admin/categories")
def admin_get_categories(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    categories = sb.table("categories").select("*").order("name").execute()
    definitions = sb.table("definitions").select("*").order("label").execute()
    cd = sb.table("category_definitions").select("category_id, definition_id").execute()
    return {
        "categories": categories.data or [],
        "definitions": definitions.data or [],
        "category_definitions": cd.data or [],
    }


@app.post("/api/admin/categories")
def admin_create_category(body: AdminCategoryCreate, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    ins = sb.table("categories").insert({"name": body.name.strip(), "is_active": True}).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    cat_id = ins.data[0]["id"]
    for did in body.definition_ids or []:
        sb.table("category_definitions").insert({"category_id": cat_id, "definition_id": did}).execute()
    return ins.data[0]


@app.patch("/api/admin/categories/{category_id}")
def admin_patch_category(
    category_id: str,
    body: AdminCategoryPatch,
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    payload: Dict[str, Any] = {}
    if body.name is not None:
        payload["name"] = body.name.strip()
    if body.is_active is not None:
        payload["is_active"] = body.is_active
    if payload:
        sb.table("categories").update(payload).eq("id", category_id).execute()
    if body.definition_ids is not None:
        sb.table("category_definitions").delete().eq("category_id", category_id).execute()
        for did in body.definition_ids:
            sb.table("category_definitions").insert({"category_id": category_id, "definition_id": did}).execute()
    return {"ok": True}


@app.delete("/api/admin/categories/{category_id}")
def admin_delete_category(category_id: str, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    sb.table("category_definitions").delete().eq("category_id", category_id).execute()
    sb.table("categories").delete().eq("id", category_id).execute()
    return {"ok": True}


@app.get("/api/admin/questions")
def admin_get_questions(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    questions = sb.table("questions").select("*").order("question_text").execute()
    categories = sb.table("categories").select("*").order("name").execute()
    return {"questions": questions.data or [], "categories": categories.data or []}


@app.post("/api/admin/questions")
def admin_create_question(body: AdminQuestionCreate, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    ins = sb.table("questions").insert({
        "question_text": body.question_text.strip(),
        "category_id": body.category_id,
        "type": body.type,
        "is_active": body.is_active,
    }).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return ins.data[0]


@app.patch("/api/admin/questions/{question_id}")
def admin_patch_question(
    question_id: str,
    body: AdminQuestionPatch,
    user: UserContext = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    payload: Dict[str, Any] = {}
    if body.question_text is not None:
        payload["question_text"] = body.question_text.strip()
    if body.category_id is not None:
        payload["category_id"] = body.category_id
    if body.type is not None:
        payload["type"] = body.type
    if body.is_active is not None:
        payload["is_active"] = body.is_active
    if not payload:
        return {"ok": True}
    sb.table("questions").update(payload).eq("id", question_id).execute()
    return {"ok": True}


@app.delete("/api/admin/questions/{question_id}")
def admin_delete_question(question_id: str, user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    sb.table("questions").delete().eq("id", question_id).execute()
    return {"ok": True}


@app.get("/api/admin/statistics")
def admin_get_statistics(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    p_res = sb.table("prompts").select("id, difficulty").eq("is_active", True).execute()
    pd_res = sb.table("prompt_definitions").select("id, prompt_id, definition_id").execute()
    d_res = sb.table("definitions").select("id").eq("is_active", True).execute()
    c_res = sb.table("categories").select("id, name").eq("is_active", True).execute()
    q_res = sb.table("questions").select("category_id, type").eq("is_active", True).execute()
    cd_res = sb.table("category_definitions").select("category_id, definition_id").execute()
    prompts = (p_res.data or []) if p_res.data else []
    pd_list = (pd_res.data or []) if pd_res.data else []
    categories = (c_res.data or []) if c_res.data else []
    def_to_cat = {(r["definition_id"]): r["category_id"] for r in (cd_res.data or [])}
    by_diff: Dict[str, int] = {}
    for p in prompts:
        d = p.get("difficulty", "medium")
        by_diff[d] = by_diff.get(d, 0) + 1
    prompt_ids_by_cat: Dict[str, set] = {}
    for pd in pd_list:
        cid = def_to_cat.get(pd["definition_id"])
        if cid:
            prompt_ids_by_cat.setdefault(cid, set()).add(pd["prompt_id"])
    prompts_by_category = {c["name"]: len(prompt_ids_by_cat.get(c["id"], set())) for c in categories}
    questions = q_res.data or []
    by_cat: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    for q in questions:
        by_cat[q["category_id"]] = by_cat.get(q["category_id"], 0) + 1
        by_type[q["type"]] = by_type.get(q["type"], 0) + 1
    questions_by_category = {c["name"]: by_cat.get(c["id"], 0) for c in categories}
    cat_name_by_id = {c["id"]: c["name"] for c in categories}
    defs_by_cat = {c["name"]: 0 for c in categories}
    for r in cd_res.data or []:
        name = cat_name_by_id.get(r["category_id"], r["category_id"])
        defs_by_cat[name] = defs_by_cat.get(name, 0) + 1
    return {
        "promptsByDifficulty": by_diff,
        "promptsByCategory": prompts_by_category,
        "questionsByCategory": questions_by_category,
        "questionsByType": by_type,
        "definitionsByCategory": defs_by_cat,
        "definitionsCount": len(d_res.data or []),
        "categoriesCount": len(categories),
        "promptDefinitionsCount": len(pd_list),
    }


@app.get("/api/admin/reports")
def admin_get_reports(user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    _require_admin(user)
    sb = _get_sb()
    reports = sb.table("question_reports").select("*").order("created_at", desc=True).execute()
    rows = reports.data or []
    if not rows:
        return {"reports": []}
    prompt_ids = list({r["prompt_id"] for r in rows})
    def_ids = list({r["definition_id"] for r in rows if r.get("definition_id")})
    by_prompt: Dict[str, str] = {}
    by_def: Dict[str, str] = {}
    if prompt_ids:
        pr = sb.table("prompts").select("id, prompt_text").in_("id", prompt_ids).execute()
        by_prompt = {p["id"]: p.get("prompt_text", "") for p in (pr.data or [])}
    if def_ids:
        dr = sb.table("definitions").select("id, label").in_("id", def_ids).execute()
        by_def = {d["id"]: d.get("label", "") for d in (dr.data or [])}
    out = []
    for r in rows:
        out.append({
            **r,
            "prompt_text": by_prompt.get(r["prompt_id"]),
            "definition_label": by_def.get(r["definition_id"]) if r.get("definition_id") else None,
        })
    return {"reports": out}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Seed v1_1 (protected by SEED_SECRET)
# ---------------------------------------------------------------------------
# v1.1 content (categories, definitions, questions) lives in the database.
# The JSON file is only the import source for this endpoint. Run POST /api/seed/v1_1
# once (e.g. after deploy) to load data/v1_1_seed.json into the DB. At runtime
# the app reads only from the database.

def _load_seed_json() -> Dict[str, Any]:
    for base in [Path(__file__).resolve().parent.parent, Path(__file__).resolve().parent]:
        p = base / "data" / "v1_1_seed.json"
        if p.exists():
            with open(p, encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("data/v1_1_seed.json not found (seed data belongs in DB; use this endpoint to load from JSON once)")


@app.post("/api/seed/v1_1")
def post_seed_v1_1(x_seed_secret: Optional[str] = Header(None, alias="X-Seed-Secret")) -> Dict[str, Any]:
    """Idempotent upsert of v1_1 categories, definitions, and question templates into the DB. Requires X-Seed-Secret header. Source: data/v1_1_seed.json."""
    if not SEED_SECRET or x_seed_secret != SEED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing SEED_SECRET")
    data = _load_seed_json()
    sb = _get_sb()
    category_ids: Dict[str, str] = {}

    for name in data.get("categories", []):
        r = sb.table("categories").select("id").eq("name", name).execute()
        if r.data and len(r.data) > 0:
            category_ids[name] = r.data[0]["id"]
        else:
            ins = sb.table("categories").insert({"name": name, "is_active": True}).select("id").execute()
            if ins.data:
                category_ids[name] = ins.data[0]["id"]

    for defn in data.get("definitions", []):
        label = defn["label"]
        cat_name = defn["category"]
        cid = category_ids.get(cat_name)
        if not cid:
            continue
        r = sb.table("definitions").select("id").eq("label", label).execute()
        candidates = r.data or []
        def_id = None
        for d in candidates:
            cd = sb.table("category_definitions").select("id").eq("category_id", cid).eq("definition_id", d["id"]).execute()
            if cd.data and len(cd.data) > 0:
                def_id = d["id"]
                break
        if def_id:
            sb.table("definitions").update({
                "description": defn.get("description"),
            }).eq("id", def_id).execute()
        else:
            ins = sb.table("definitions").insert({
                "label": label,
                "description": defn.get("description"),
                "is_active": True,
            }).select("id").execute()
            if ins.data:
                def_id = ins.data[0]["id"]
            else:
                continue
        cd = sb.table("category_definitions").select("id").eq("category_id", cid).eq("definition_id", def_id).execute()
        if not cd.data or len(cd.data) == 0:
            sb.table("category_definitions").insert({"category_id": cid, "definition_id": def_id}).execute()

    for q in data.get("questions", []):
        cat_name = q.get("category")
        cid = category_ids.get(cat_name)
        if not cid:
            continue
        qtype = q.get("type", "MCQ")
        r = sb.table("questions").select("id").eq("category_id", cid).eq("question_text", q["question_text"]).eq("type", qtype).execute()
        if r.data and len(r.data) > 0:
            sb.table("questions").update({"is_active": True}).eq("id", r.data[0]["id"]).execute()
        else:
            sb.table("questions").insert({
                "question_text": q["question_text"],
                "category_id": cid,
                "type": qtype,
                "is_active": True,
            }).execute()

    return {"ok": True, "categories": len(category_ids), "definitions": len(data.get("definitions", [])), "questions": len(data.get("questions", []))}
