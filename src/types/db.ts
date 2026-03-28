export type QuestionType =
  | 'MCQ'
  | 'click_word'
  | 'click_letter'
  | 'mcq_fillin'
  | 'fill_in_sentence'
  | 'transformation'
  | 'yes_no'
  | 'visual_mcq'
  | 'drag_and_match'
  | 'click_letter_range';
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
  description?: string | null;
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
  created_at: string;
  updated_at: string;
  image_url?: string | null;
  definition_id?: string | null;
}

export interface PromptDefinition {
  id: string;
  prompt_id: string;
  definition_id: string;
  index_start: number;
  index_end?: number | null;
  is_letter: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  category_id: string;
  type: QuestionType;
  is_active: boolean;
  include_definition_ids?: string[] | null;
}

export interface Lesson {
  id: string;
  title: string;
  content_html: string | null;
  category_id: string;
  is_active: boolean;
}

export interface QuestionReport {
  id: string;
  prompt_id: string;
  definition_id: string | null;
  user_id: string;
  comment: string;
  created_at: string;
}
