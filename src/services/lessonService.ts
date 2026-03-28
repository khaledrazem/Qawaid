/**
 * Lesson Service — v1-3
 *
 * Fetches active lessons from backend for the lessons list and lesson detail view.
 */

import { getLessons, getLessonById as getLessonByIdApi } from '@/services/backendApi';

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
  try {
    return await getLessons();
  } catch (err) {
    console.error('[lessonService] fetchLessonsList:', err);
    return [];
  }
}

/**
 * Fetch a single lesson by id for the detail view.
 */
export async function fetchLessonById(id: string): Promise<LessonDetailDTO | null> {
  try {
    return await getLessonByIdApi(id);
  } catch (err) {
    console.warn('[lessonService] fetchLessonById:', err);
    return null;
  }
}
