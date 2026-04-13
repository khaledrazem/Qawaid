import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { prewarmQuestionCache } from '@/services/batchLoader';
import { flushPendingSessions } from '@/services/sessionPersistence';
import './app.css';

/** Learner app shell. No global header; each page has its own back + title (qawaid-ui style). */
export default function AppLayout() {
  const navigate = useNavigate();

  // Prewarm question cache for offline play (v1-4)
  useEffect(() => {
    prewarmQuestionCache();
  }, []);

  // When back online, flush any queued session persists (v1-4)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushPendingSessions();
    }
    const onOnline = () => { flushPendingSessions(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Android system back: match in-app navigation (WebView history).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handlePromise = App.addListener('backButton', () => {
      navigate(-1);
    });
    return () => {
      void handlePromise.then((h) => h.remove());
    };
  }, [navigate]);

  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
