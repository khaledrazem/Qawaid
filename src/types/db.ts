export type QuestionType = 'MCQ' | 'click_word' | 'click_letter';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface User {
  id: string;
  username: string | null;
  hashed_password: string | null;
  is_admin: boolean;
  google_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Definition {
  id: string;
  label: string;
  is_active: boolean;
}

export interface CategoryDefinition {
  id: string;
  category_id: string;
  definition_id: string;
}

export interface Prompt {
  id: string;
  prompt_text: string;
  difficulty: Difficulty;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PromptDefinition {
  id: string;
  prompt_id: string;
  definition_id: string;
  index_start: number;
  is_letter: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  category_id: string;
  type: QuestionType;
  min_options: number;
  is_active: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  content_html: string | null;
  category_id: string;
  is_active: boolean;
}
