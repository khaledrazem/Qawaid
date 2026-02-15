/**
 * Lesson Service — v1-3
 *
 * Fetches active lessons from Supabase for the lessons list and lesson detail view.
 */

import { supabase } from '@/lib/supabase';

export interface LessonListItemDTO {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
}

export interface LessonDetailDTO {
  id: string;
  title: string;
  contentHtml: string | null;
  categoryId: string;
  categoryName: string;
}

/**
 * Fetch all active lessons with category name for the lessons list.
 */
export async function fetchLessonsList(): Promise<LessonListItemDTO[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, category_id, categories(name)')
    .eq('is_active', true)
    .order('title');

  if (error) {
    console.error('[lessonService] fetchLessonsList:', error.message);
    return [];
  }

  type Row = { id: string; title: string; category_id: string; categories: { name: string }[] | null };
  return (data ?? []).map((row: Row) => ({
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.categories?.[0]?.name ?? '',
  }));
}

/**
 * Fetch a single lesson by id for the detail view.
 */
export async function fetchLessonById(id: string): Promise<LessonDetailDTO | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, content_html, category_id, categories(name)')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.warn('[lessonService] fetchLessonById:', error?.message ?? 'not found');
    return null;
  }

  type Row = {
    id: string;
    title: string;
    content_html: string | null;
    category_id: string;
    categories: { name: string }[] | null;
  };
  const row = data as Row;

  return {
    id: row.id,
    title: row.title,
    contentHtml: row.content_html,
    categoryId: row.category_id,
    categoryName: row.categories?.[0]?.name ?? '',
  };
}
