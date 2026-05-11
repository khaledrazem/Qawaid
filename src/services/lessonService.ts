/**
 * Lesson Service — v1-3
 *
 * Fetches active lessons from backend for the lessons list and lesson detail view.
 */

import { getLessons, getLessonById as getLessonByIdApi } from '@/services/backendApi';
import { readCache, writeCache } from '@/services/localCache';

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

const LESSONS_LIST_CACHE_KEY = 'sahra_lessons_list_cache_v1';
const LESSON_DETAIL_CACHE_KEY_PREFIX = 'sahra_lesson_detail_cache_v1:';
const LESSON_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

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

export function getCachedLessonsList(): LessonListItemDTO[] | null {
  return readCache<LessonListItemDTO[]>(LESSONS_LIST_CACHE_KEY, LESSON_CACHE_MAX_AGE_MS);
}

export async function fetchLessonsListFresh(): Promise<LessonListItemDTO[]> {
  const list = await fetchLessonsList();
  writeCache(LESSONS_LIST_CACHE_KEY, list);
  return list;
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

export function getCachedLessonById(id: string): LessonDetailDTO | null {
  if (!id) return null;
  return readCache<LessonDetailDTO>(`${LESSON_DETAIL_CACHE_KEY_PREFIX}${id}`, LESSON_CACHE_MAX_AGE_MS);
}

export async function fetchLessonByIdFresh(id: string): Promise<LessonDetailDTO | null> {
  const lesson = await fetchLessonById(id);
  if (lesson) {
    writeCache(`${LESSON_DETAIL_CACHE_KEY_PREFIX}${id}`, lesson);
  }
  return lesson;
}
