"""Load config from environment."""
import os
from pathlib import Path

# Load .env from backend/ or project root so SUPABASE_* and CORS_ORIGINS are set when running locally
try:
    from dotenv import load_dotenv
    _backend_dir = Path(__file__).resolve().parent
    load_dotenv(_backend_dir / ".env")
    load_dotenv(_backend_dir.parent / ".env")
except ImportError:
    pass

# Support both backend (SUPABASE_*) and root .env (VITE_SUPABASE_URL, SUPABASE_SECRET_KEY)
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY", "")
# Browsers send Authorization — no "*". These origins are always merged unless CORS_STRICT=1.
# (Origin has no trailing slash; match what the browser sends.)
# Include Capacitor native WebView origins used by Android/iOS builds.
_LOCAL_DEV_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://localhost",
    "capacitor://localhost",
)
_DEFAULT_FRONTEND_ORIGINS = ("https://qawaid-iota.vercel.app",)
_CORS_ALWAYS_MERGE = _LOCAL_DEV_ORIGINS + _DEFAULT_FRONTEND_ORIGINS
_raw = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_strict = os.environ.get("CORS_STRICT", "").strip().lower() in ("1", "true", "yes")
if _raw == "*" or not _raw:
    CORS_ORIGINS = list(_CORS_ALWAYS_MERGE)
else:
    from_env = [o.strip() for o in _raw.split(",") if o.strip()]
    if _cors_strict:
        CORS_ORIGINS = from_env
    else:
        CORS_ORIGINS = list(dict.fromkeys(list(from_env) + list(_CORS_ALWAYS_MERGE)))
SEED_SECRET = os.environ.get("SEED_SECRET", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
SUPABASE_JWT_ISSUER = os.environ.get("SUPABASE_JWT_ISSUER", "").strip()
SUPABASE_JWT_AUDIENCE = os.environ.get("SUPABASE_JWT_AUDIENCE", "").strip()
SUPABASE_JWKS_URL = os.environ.get("SUPABASE_JWKS_URL", "").strip()

# Difficulty adaptation (backend runs this for record-answer)
def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None or raw == "":
        return default
    try:
        return int(raw, 10)
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    raw = os.environ.get(key)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


DIFFICULTY_TARGET_MIN = _env_int("DIFFICULTY_TARGET_MIN", 20)
DIFFICULTY_TARGET_MAX = _env_int("DIFFICULTY_TARGET_MAX", 50)
DIFFICULTY_WEIGHT_DELTA = _env_float("DIFFICULTY_WEIGHT_DELTA", 0.05)
DIFFICULTY_DEFAULT_EASY = _env_float("DIFFICULTY_DEFAULT_EASY", 0.5)
DIFFICULTY_DEFAULT_MEDIUM = _env_float("DIFFICULTY_DEFAULT_MEDIUM", 0.3)
DIFFICULTY_DEFAULT_HARD = _env_float("DIFFICULTY_DEFAULT_HARD", 0.2)
