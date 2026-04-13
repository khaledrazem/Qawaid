/**
 * Lesson detail — v1-3
 * Shows a single lesson's title and HTML content (admin-authored).
 * If content uses <div class="lesson-page">, shows one page at a time with prev/next.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchLessonById } from '@/services/lessonService';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';
import { PageBack } from '@/components/PageBack';
import type { LessonDetailDTO } from '@/services/lessonService';

export default function LessonDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const contentRef = useRef<HTMLDivElement>(null);
  const [lesson, setLesson] = useState<LessonDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchLessonById(id).then((data) => {
      if (cancelled) return;
      setLesson(data);
      setNotFound(!data);
      setCurrentPage(0);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  // Count .lesson-page elements after content is rendered (for multi-page booklet)
  useEffect(() => {
    if (!lesson?.contentHtml) return;
    const id = setTimeout(() => {
      const pages = contentRef.current?.querySelectorAll('.lesson-page');
      setTotalPages(pages && pages.length > 0 ? pages.length : 1);
    }, 0);
    return () => clearTimeout(id);
  }, [lesson?.contentHtml]);

  if (loading) {
    return (
      <div className="page page-with-bg">
        <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
        <TextureOverlay className="page-texture" />
        <div className="page-content">
        <div className="page-header">
          <PageBack to="/lessons" />
          <h1 className="page-heading">{t('lessons.title')}</h1>
        </div>
        <div className="placeholder">
          <div className="spinner" />
          <p className="placeholder-text">{t('common.loading')}</p>
        </div>
        </div>
      </div>
    );
  }

  if (notFound || !lesson) {
    return (
      <div className="page page-with-bg">
        <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
        <TextureOverlay className="page-texture" />
        <div className="page-content">
        <div className="page-header">
          <PageBack to="/lessons" />
          <h1 className="page-heading">{t('lessons.title')}</h1>
        </div>
        <div className="placeholder">
          <span className="placeholder-icon">📖</span>
          <p className="placeholder-text">{t('lessons.notFound')}</p>
          <Link to="/lessons" className="btn btn-primary">{t('lessons.backToList')}</Link>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-with-bg lesson-detail-page">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.15} />
      <TextureOverlay className="page-texture" />
      <div className="page-content">
      <div className="page-header">
        <PageBack to="/lessons" />
        <h1 className="page-heading lesson-detail-title">{lesson.title}</h1>
      </div>

      {lesson.categoryName && (
        <p className="lesson-detail-category">{lesson.categoryName}</p>
      )}

      <div className="lesson-detail-content">
        {lesson.contentHtml ? (
          <div className="card lesson-detail-card">
            <div
              ref={contentRef}
              className={`lesson-content-html lesson-pages lesson-page-${currentPage}`}
              dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
            />
            {totalPages > 1 && (
              <div className="lesson-pagination">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  aria-label={t('lessons.prevPage')}
                >
                  ← {t('lessons.prevPage')}
                </button>
                <span className="lesson-page-indicator">
                  {t('lessons.pageOf')
                    .replace('{{current}}', String(currentPage + 1))
                    .replace('{{total}}', String(totalPages))}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  aria-label={t('lessons.nextPage')}
                >
                  {t('lessons.nextPage')} →
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="placeholder-text">{t('lessons.noContent')}</p>
        )}
      </div>
      </div>
    </div>
  );
}
