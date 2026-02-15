/**
 * Lessons list — v1-3
 * Fetches active lessons from DB and links to each lesson detail page.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchLessonsList } from '@/services/lessonService';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';
import type { LessonListItemDTO } from '@/services/lessonService';

export default function LessonsPage() {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState<LessonListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLessonsList().then((list) => {
      if (!cancelled) {
        setLessons(list);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page page-with-bg">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
      <TextureOverlay className="page-texture" />
      <div className="page-content">
        <div className="page-header">
          <Link to="/" className="page-back">←</Link>
          <h1 className="page-heading">{t('lessons.title')}</h1>
        </div>

        {loading && (
          <div className="placeholder">
            <div className="spinner" />
            <p className="placeholder-text">{t('common.loading')}</p>
          </div>
        )}

        {!loading && lessons.length === 0 && (
          <div className="placeholder">
            <span className="placeholder-icon">📖</span>
            <p className="placeholder-text">{t('lessons.noLessons')}</p>
          </div>
        )}

        {!loading && lessons.length > 0 && (
          <div className="lesson-list">
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                to={`/lessons/${lesson.id}`}
                className="lesson-list-item"
              >
                <span className="lesson-list-title">{lesson.title}</span>
                {lesson.categoryName && (
                  <span className="lesson-list-category">{lesson.categoryName}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
