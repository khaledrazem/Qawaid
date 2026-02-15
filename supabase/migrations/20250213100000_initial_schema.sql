-- =============================================================================
-- Sahra — Initial schema (Phase 3)
-- Supabase / PostgreSQL
-- =============================================================================
-- Run this in Supabase SQL Editor or via: supabase db push
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE question_type AS ENUM ('MCQ', 'click_word', 'click_letter');
CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');

-- Users (includes admin: is_admin = true, username + hashed_password)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar UNIQUE,
  hashed_password varchar,
  is_admin bool NOT NULL DEFAULT false,
  google_id varchar UNIQUE,
  display_name varchar,
  avatar_url varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN users.username IS 'Unique, immutable once set; required for admin login';
COMMENT ON COLUMN users.hashed_password IS 'For admin login; null for Google users';
COMMENT ON COLUMN users.is_admin IS 'True for admin users; they log in with username + password';

-- User stats (one row per user)
-- -----------------------------------------------------------------------------
CREATE TABLE user_stats (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lifetime_points int NOT NULL DEFAULT 0,
  total_questions_answered int NOT NULL DEFAULT 0,
  best_session_questions int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Monthly scores (leaderboard; one row per user per month)
-- -----------------------------------------------------------------------------
CREATE TABLE monthly_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month char(7) NOT NULL,
  points int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

COMMENT ON COLUMN monthly_scores.month IS 'YYYY-MM';

CREATE INDEX idx_monthly_scores_month ON monthly_scores(month);
CREATE INDEX idx_monthly_scores_user_month ON monthly_scores(user_id, month);

-- User difficulty profile (adaptive weights; one row per user)
-- -----------------------------------------------------------------------------
CREATE TABLE user_difficulty_profile (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  easy_weight float NOT NULL,
  medium_weight float NOT NULL,
  hard_weight float NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Categories (groups of definitions)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  is_active bool NOT NULL DEFAULT true
);

-- Definitions (grammar terms, e.g. فاعل, مفعول به)
-- -----------------------------------------------------------------------------
CREATE TABLE definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label varchar NOT NULL UNIQUE,
  is_active bool NOT NULL DEFAULT true
);

-- Category – Definition (many-to-many)
-- -----------------------------------------------------------------------------
CREATE TABLE category_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES definitions(id) ON DELETE CASCADE,
  UNIQUE (category_id, definition_id)
);

CREATE INDEX idx_category_definitions_category ON category_definitions(category_id);
CREATE INDEX idx_category_definitions_definition ON category_definitions(definition_id);

-- Prompts (sentences; difficulty per prompt; prompt text not editable after creation — app rule)
-- -----------------------------------------------------------------------------
CREATE TABLE prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text text NOT NULL,
  difficulty difficulty NOT NULL,
  is_active bool NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prompt – Definition (word or letter in prompt linked to a definition)
-- -----------------------------------------------------------------------------
CREATE TABLE prompt_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES definitions(id) ON DELETE CASCADE,
  index_start int NOT NULL,
  is_letter bool NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN prompt_definitions.index_start IS 'Character index in prompt_text; word = from index_start to next space/punctuation';
COMMENT ON COLUMN prompt_definitions.is_letter IS 'True = single letter (e.g. harakah); false = word';

CREATE INDEX idx_prompt_definitions_prompt ON prompt_definitions(prompt_id);
CREATE INDEX idx_prompt_definitions_definition ON prompt_definitions(definition_id);

-- Questions (linked to category and correct definition; min_options for MCQ vs click)
-- -----------------------------------------------------------------------------
CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text varchar NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type question_type NOT NULL,
  correct_definition_id uuid NOT NULL REFERENCES definitions(id) ON DELETE RESTRICT,
  min_options int NOT NULL DEFAULT 4,
  is_active bool NOT NULL DEFAULT true
);

COMMENT ON COLUMN questions.min_options IS '4 for MCQ (need 4 choices); 1 for click_word and click_letter';

CREATE INDEX idx_questions_category ON questions(category_id);
CREATE INDEX idx_questions_correct_definition ON questions(correct_definition_id);
CREATE INDEX idx_questions_active ON questions(is_active) WHERE is_active = true;

-- Lessons (per category; optional in MVP)
-- -----------------------------------------------------------------------------
CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL UNIQUE,
  content_html text,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  is_active bool NOT NULL DEFAULT true
);

CREATE INDEX idx_lessons_category ON lessons(category_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- App (anon + authenticated): read content + leaderboard; write own user stats.
-- Admin: content write only when user is_admin = true (admin logs in via Supabase Auth).
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_difficulty_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Helper: current user is admin (must be authenticated and have is_admin = true)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- users: read own row; update own row (display_name, avatar_url); admin can read all
-- -----------------------------------------------------------------------------
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (is_admin_user());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert: allow authenticated user to insert own row (for Google signup: id = auth.uid())
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- user_stats: own row only
-- -----------------------------------------------------------------------------
CREATE POLICY "user_stats_select_own" ON user_stats
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_stats_insert_own" ON user_stats
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_stats_update_own" ON user_stats
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- monthly_scores: anyone can read (leaderboard); insert/update only own
-- -----------------------------------------------------------------------------
CREATE POLICY "monthly_scores_select_all" ON monthly_scores
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "monthly_scores_insert_own" ON monthly_scores
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "monthly_scores_update_own" ON monthly_scores
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- user_difficulty_profile: own row only
-- -----------------------------------------------------------------------------
CREATE POLICY "user_difficulty_profile_select_own" ON user_difficulty_profile
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_difficulty_profile_insert_own" ON user_difficulty_profile
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_difficulty_profile_update_own" ON user_difficulty_profile
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Content tables: anon + authenticated can read; only admin can write
-- -----------------------------------------------------------------------------
CREATE POLICY "categories_select_all" ON categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "categories_admin_insert" ON categories
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "categories_admin_update" ON categories
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "categories_admin_delete" ON categories
  FOR DELETE TO authenticated USING (is_admin_user());

CREATE POLICY "definitions_select_all" ON definitions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "definitions_admin_insert" ON definitions
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "definitions_admin_update" ON definitions
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "definitions_admin_delete" ON definitions
  FOR DELETE TO authenticated USING (is_admin_user());

CREATE POLICY "category_definitions_select_all" ON category_definitions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "category_definitions_admin_insert" ON category_definitions
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "category_definitions_admin_update" ON category_definitions
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "category_definitions_admin_delete" ON category_definitions
  FOR DELETE TO authenticated USING (is_admin_user());

CREATE POLICY "prompts_select_all" ON prompts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "prompts_admin_insert" ON prompts
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "prompts_admin_update" ON prompts
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "prompts_admin_delete" ON prompts
  FOR DELETE TO authenticated USING (is_admin_user());

CREATE POLICY "prompt_definitions_select_all" ON prompt_definitions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "prompt_definitions_admin_insert" ON prompt_definitions
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "prompt_definitions_admin_update" ON prompt_definitions
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "prompt_definitions_admin_delete" ON prompt_definitions
  FOR DELETE TO authenticated USING (is_admin_user());

CREATE POLICY "questions_select_all" ON questions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "questions_admin_insert" ON questions
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "questions_admin_update" ON questions
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "questions_admin_delete" ON questions
  FOR DELETE TO authenticated USING (is_admin_user());

CREATE POLICY "lessons_select_all" ON lessons
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "lessons_admin_insert" ON lessons
  FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "lessons_admin_update" ON lessons
  FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "lessons_admin_delete" ON lessons
  FOR DELETE TO authenticated USING (is_admin_user());
