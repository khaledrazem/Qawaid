/**
 * Backend API client for Play path.
 * Uses VITE_BACKEND_URL; falls back to same origin if unset.
 */

import type { DifficultyWeights } from '@/services/difficultyAdaptation';
import type { QuestionDTO } from '@/types/dto';

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL
  ? (import.meta.env.VITE_BACKEND_URL as string).replace(/\/$/, '')
  : '';

export interface BatchRequest {
  count: number;
  selectedCategoryIds?: string[] | null;
  usedPromptIds?: string[];
  userWeights?: DifficultyWeights;
}

export interface BatchResponse {
  questions: QuestionDTO[];
  empty?: boolean;
}

export async function getAccessToken(): Promise<string | null> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  console.log('data', data);
  return data.session?.access_token ?? null;
}

export async function backendRequestWithAuth<T>(
  path: string,
  init: RequestInit & { authToken?: string } = {},
): Promise<T> {
  const token = init.authToken ?? (await getAccessToken());
  const headers: HeadersInit = {
    ...(init.headers || {}),
    'Content-Type': (init.headers as any)?.['Content-Type'] || 'application/json',
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = new Error(`${path}: ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function getPlayable(): Promise<{ playable: boolean }> {
  return backendRequestWithAuth<{ playable: boolean }>('/api/questions/playable', { method: 'GET' });
}

export async function postBatch(body: BatchRequest): Promise<BatchResponse> {
  return backendRequestWithAuth<BatchResponse>('/api/questions/batch', {
    method: 'POST',
    body: JSON.stringify({
      count: body.count,
      selectedCategoryIds: body.selectedCategoryIds ?? undefined,
      usedPromptIds: body.usedPromptIds ?? [],
      userWeights: body.userWeights,
    }),
  });
}

// --- User & session (JWT) ---

export async function sessionSync(displayName: string, avatarUrl: string | null): Promise<{ ok: boolean }> {
  return backendRequestWithAuth<{ ok: boolean }>('/api/user/session-sync', {
    method: 'POST',
    body: JSON.stringify({ displayName, avatarUrl }),
  });
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  lifetimePoints?: number;
  totalQuestionsAnswered?: number;
  bestSessionQuestions?: number;
}

export async function getProfile(): Promise<UserProfile> {
  return backendRequestWithAuth<UserProfile>('/api/user/profile', { method: 'GET' });
}

export async function patchProfile(displayName: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth<{ ok: boolean }>('/api/user/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
}

export async function getDifficultyProfile(): Promise<DifficultyWeights> {
  return backendRequestWithAuth<DifficultyWeights>('/api/user/difficulty-profile', { method: 'GET' });
}

export async function postDifficultyProfile(weights: DifficultyWeights): Promise<{ ok: boolean }> {
  return backendRequestWithAuth<{ ok: boolean }>('/api/user/difficulty-profile', {
    method: 'POST',
    body: JSON.stringify(weights),
  });
}

export async function recordAnswer(payload: {
  points: number;
  totalQuestionsAnswered: number;
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<{ ok: boolean }> {
  return backendRequestWithAuth<{ ok: boolean }>('/api/leaderboard/record-answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCategories(): Promise<{ id: string; name: string; is_active: boolean }[]> {
  return backendRequestWithAuth('/api/categories', { method: 'GET' });
}

export async function postQuestionReport(payload: {
  prompt_id: string;
  definition_id?: string | null;
  comment: string;
}): Promise<{ ok: boolean }> {
  return backendRequestWithAuth<{ ok: boolean }>('/api/question-reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface LessonListItem {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
}

export async function getLessons(): Promise<LessonListItem[]> {
  return backendRequestWithAuth<LessonListItem[]>('/api/lessons', { method: 'GET' });
}

export interface LessonDetail {
  id: string;
  title: string;
  contentHtml: string | null;
  categoryId: string;
  categoryName: string;
}

export async function getLessonById(lessonId: string): Promise<LessonDetail> {
  return backendRequestWithAuth<LessonDetail>(`/api/lessons/${lessonId}`, { method: 'GET' });
}

export interface AnalyzeWord {
  start: number;
  end: number;
  word: string;
}

export async function postAnalyze(promptText: string): Promise<{ words: AnalyzeWord[] }> {
  const res = await fetch(`${BASE}/api/prompts/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt_text: promptText }),
  });
  if (!res.ok) throw new Error(`analyze: ${res.status}`);
  return res.json();
}

export async function postSuggestLinks(promptText: string): Promise<{
  words: AnalyzeWord[];
  suggestions: Array<{ wordIndex: number; definitionId: string; label: string; indicatorPosition: string | null }>;
}> {
  const res = await fetch(`${BASE}/api/prompts/suggest-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt_text: promptText }),
  });
  if (!res.ok) throw new Error(`suggest-links: ${res.status}`);
  return res.json();
}

export async function postPromptDefinition(
  promptId: string,
  body: { wordIndex: number; definitionId: string; is_letter?: boolean; letterIndexInWord?: number }
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/prompts/${promptId}/definitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wordIndex: body.wordIndex,
      definitionId: body.definitionId,
      is_letter: body.is_letter ?? false,
      letterIndexInWord: body.letterIndexInWord,
    }),
  });
  if (!res.ok) throw new Error(`prompt definition: ${res.status}`);
  return res.json();
}

export interface AutoLinkCreated {
  id: string;
  prompt_id: string;
  definition_id: string;
  index_start: number;
  index_end: number;
  is_letter: boolean;
}

export async function postAutoLink(
  promptId: string,
  replace: boolean = false
): Promise<{ created: AutoLinkCreated[] }> {
  const res = await fetch(`${BASE}/api/prompts/${promptId}/auto-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replace }),
  });
  if (!res.ok) throw new Error(`auto-link: ${res.status}`);
  return res.json();
}

// --- Admin (JWT + is_admin) ---

export async function getAdminPrompts(): Promise<{
  prompts: Record<string, unknown>[];
  prompt_definitions: Record<string, unknown>[];
  definitions: Record<string, unknown>[];
}> {
  return backendRequestWithAuth('/api/admin/prompts', { method: 'GET' });
}

export interface AdminAutoLinkAllResult {
  prompts_processed: number;
  links_created: number;
  errors: { prompt_id: string; detail: string }[];
}

/** Run CAMeL auto-detect on all prompts (merge: skips duplicate span + definition). Admin only. */
export async function postAdminAutoLinkAll(body?: {
  replace?: boolean;
  only_active?: boolean;
}): Promise<AdminAutoLinkAllResult> {
  return backendRequestWithAuth<AdminAutoLinkAllResult>('/api/admin/prompts/auto-link-all', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function createAdminPrompt(prompt_text: string, difficulty: string): Promise<Record<string, unknown>> {
  return backendRequestWithAuth('/api/admin/prompts', {
    method: 'POST',
    body: JSON.stringify({ prompt_text: prompt_text.trim(), difficulty }),
  });
}

export async function patchAdminPrompt(promptId: string, body: { is_active?: boolean; image_url?: string; definition_id?: string | null | undefined }): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/prompts/${promptId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteAdminPrompt(promptId: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/prompts/${promptId}`, { method: 'DELETE' });
}

export async function deleteAdminPromptDefinitions(promptId: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/prompts/${promptId}/prompt-definitions`, { method: 'DELETE' });
}

export async function deleteAdminPromptDefinition(promptDefinitionId: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/prompt-definitions/${promptDefinitionId}`, { method: 'DELETE' });
}

export async function getAdminDefinitions(): Promise<{
  definitions: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  category_definitions: { category_id: string; definition_id: string }[];
}> {
  return backendRequestWithAuth('/api/admin/definitions', { method: 'GET' });
}

export async function createAdminDefinition(label: string, category_ids: string[]): Promise<Record<string, unknown>> {
  return backendRequestWithAuth('/api/admin/definitions', {
    method: 'POST',
    body: JSON.stringify({ label: label.trim(), category_ids }),
  });
}

export async function patchAdminDefinition(
  definitionId: string,
  body: { label?: string; description?: string | null; is_active?: boolean; category_ids?: string[] }
): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/definitions/${definitionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteAdminDefinition(definitionId: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/definitions/${definitionId}`, { method: 'DELETE' });
}

export async function getAdminCategories(): Promise<{
  categories: Record<string, unknown>[];
  definitions: Record<string, unknown>[];
  category_definitions: { category_id: string; definition_id: string }[];
}> {
  return backendRequestWithAuth('/api/admin/categories', { method: 'GET' });
}

export async function createAdminCategory(name: string, definition_ids: string[]): Promise<Record<string, unknown>> {
  return backendRequestWithAuth('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), definition_ids }),
  });
}

export async function patchAdminCategory(
  categoryId: string,
  body: { name?: string; is_active?: boolean; definition_ids?: string[] }
): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteAdminCategory(categoryId: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
}

export async function getAdminQuestions(): Promise<{
  questions: Record<string, unknown>[];
  categories: Record<string, unknown>[];
}> {
  return backendRequestWithAuth('/api/admin/questions', { method: 'GET' });
}

export async function createAdminQuestion(body: {
  question_text: string;
  category_id: string;
  type: string;
  is_active: boolean;
}): Promise<Record<string, unknown>> {
  return backendRequestWithAuth('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAdminQuestion(
  questionId: string,
  body: { question_text?: string; category_id?: string; type?: string; is_active?: boolean }
): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteAdminQuestion(questionId: string): Promise<{ ok: boolean }> {
  return backendRequestWithAuth(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
}

export async function getAdminStatistics(): Promise<{
  promptsByDifficulty: Record<string, number>;
  promptsByCategory: Record<string, number>;
  questionsByCategory: Record<string, number>;
  questionsByType: Record<string, number>;
  definitionsByCategory: Record<string, number>;
  definitionsCount: number;
  categoriesCount: number;
  promptDefinitionsCount: number;
}> {
  return backendRequestWithAuth('/api/admin/statistics', { method: 'GET' });
}

export async function getAdminReports(): Promise<{
  reports: (Record<string, unknown> & { prompt_text?: string; definition_label?: string })[];
}> {
  return backendRequestWithAuth('/api/admin/reports', { method: 'GET' });
}
