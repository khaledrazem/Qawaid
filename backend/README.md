# Qawaid Backend

Python API for the Qawaid app: question engine (playable, batch) and prompt analysis (analyze, suggest-links).

## Endpoints

- `GET /api/questions/playable` — returns `{ "playable": boolean }`
- `POST /api/questions/batch` — body: `{ "count", "selectedCategoryIds?", "usedPromptIds", "userWeights?" }`; returns `{ "questions": QuestionDTO[], "empty"?: boolean }`
- `POST /api/prompts/analyze` — body: `{ "prompt_text" }`; returns `{ "words": [ { "start", "end", "word" } ] }` (CAMeL or whitespace tokenizer)
- `POST /api/prompts/suggest-links` — body: `{ "prompt_text" }`; returns `{ "words", "suggestions": [ { "wordIndex", "definitionId", "label", "indicatorPosition" } ] }`

## Setup

**Python 3.10, 3.11, or 3.12** (required for optional CAMeL Tools; 3.13+ is not supported by camel-tools). The repo root includes a `.python-version` (3.12) for pyenv/IDE.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

### CAMeL Tools — two main uses

1. **Auto-detect definitions** (`POST /api/prompts/{id}/auto-link`): When the morphology database is installed, the backend uses CAMeL to analyze each word (lemma, POS) and matches prompt words to definitions in two ways: **(a)** by label and indicator (lemma match in addition to exact word match); **(b)** by **CAMeL→definition mapping** (`camel_mapping.py`): CAMeL features (e.g. `pos=noun` → أقسام الجملة/اسم, `part_interrog` → استفهام, `part_neg` → نفي) are mapped to our categories and labels so that morphology-based suggestions are aligned with our grammar definitions. Without CAMeL, only exact label and indicator string match is used.

2. **Questions**: For **transformation** and **fill-in** types, CAMeL is used to normalize user input (lemma) when comparing the answer to the expected word, and can be used to display the sentence differently (e.g. diacritization). See `camel_morphology.normalize_for_comparison()`.

Install the morphology data for auto-detect and normalization:

```bash
cd backend
.venv\Scripts\activate   # Windows; on macOS/Linux: source .venv/bin/activate
camel_data -i morphology-db-msa-r13
```

**Optional — sentence-level disambiguation:** Without diacritics, a word like كتاب can have multiple readings (e.g. كِتاب “book” and كُتّاب “writers”). The MLE disambiguator uses the full sentence to pick one analysis per word, so e.g. الكتاب على الطاولة yields “book” not “writers”. Install:

```bash
camel_data -i disambig-mle-calima-msa-r13
```

On Windows, if `camel_data` is not recognized, activate the venv first (`cd backend` then `.venv\Scripts\activate`) or run `python -m camel_tools.data -i disambig-mle-calima-msa-r13` from the backend directory.

When the disambiguator is available, auto-detect analyzes the **entire sentence** and uses one contextually chosen analysis per word. If not installed, each word is analyzed in isolation (all possible readings are returned and may match multiple definitions).

If not installed, the tokenizer falls back to whitespace split and auto-detect uses label/indicator match only.

### Run with Docker (no local Python or camel_data needed)

The image installs **morphology DB** and **MLE disambiguator** during build. You only need to build/run the container; no need to run `camel_data` on your machine.

From the **project root** (directory that contains `backend/` and `docker-compose.yml`):

```bash
# Ensure .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
docker compose up --build
```

Or build only: `docker compose build backend`

Backend runs at http://localhost:8000 with Python 3.12, CAMeL morphology, and sentence disambiguation preinstalled. First build may take several minutes while dependencies and CAMeL data are downloaded.

## Seed data (v1.1 in the database)

Categories, definitions, and question templates are stored in the database, not in a JSON file at runtime. You can load v1.1 seed data in either of these ways:

1. **Migration** (recommended for new DBs): The migration `20250310120000_seed_v1_1_data.sql` inserts categories, definitions, category_definitions, and questions. Run `supabase db push` or apply migrations; the seed runs as part of migrations.

2. **Seed API**: Alternatively, run the seed endpoint once (e.g. after deploy):  
   `curl -X POST http://localhost:8000/api/seed/v1_1 -H "X-Seed-Secret: YOUR_SEED_SECRET"`

The file `data/v1_1_seed.json` is only the import source for the seed API. After seeding (by migration or API), the app uses only the database.

## Environment

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (for server-side DB access)
- `CORS_ORIGINS` — Comma-separated origins (default `*`)
- `SEED_SECRET` — Required to call `POST /api/seed/v1_1`

## Run locally

From the `backend` directory:

```bash
python -m uvicorn main:app --reload --port 8000
```

On Windows PowerShell, use `python -m uvicorn` (so the script doesn’t need to be on PATH).  
Frontend can use `VITE_BACKEND_URL=http://localhost:8000`, or rely on the Vite dev proxy so `/api` is forwarded to the backend.

## Deploy

This backend is intended for deployment on **Railway**, **Render**, **Fly.io**, or similar (not Vercel serverless, to avoid CAMeL bundle size limits). Set the same env vars and run:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Point the frontend at the deployed URL via `VITE_BACKEND_URL`.

### Phase 7 (optional) CAMeL extensions
- **Suggest-links**: Use CAMeL morphology (pos, prc0, enc0) to map words to definitions and set indicator/indicator_position.
- **Diacritization**: `camel_diac` for diacritized text; حركات category for "What is the diacritic?" questions.
- **Lemma normalisation**: In fill-in/transformation, compare user input to lemma via `camel_morphology.normalize_for_comparison()`.
