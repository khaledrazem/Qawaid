import { Routes, Route, Navigate } from 'react-router-dom';

/* --- Admin --- */
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminCategories from './pages/admin/AdminCategories';
import AdminDefinitions from './pages/admin/AdminDefinitions';
import AdminPrompts from './pages/admin/AdminPrompts';
import AdminQuestions from './pages/admin/AdminQuestions';
import AdminConfig from './pages/admin/AdminConfig';

/* --- Learner app --- */
import AppLayout from './pages/app/AppLayout';
import MainMenu from './pages/app/MainMenu';
import Profile from './pages/app/Profile';
import LeaderboardPage from './pages/app/LeaderboardPage';
import LessonsPage from './pages/app/LessonsPage';
import LessonDetailPage from './pages/app/LessonDetailPage';
import Play from './pages/app/Play';
import Finish from './pages/app/Finish';
import AuthCallback from './pages/app/AuthCallback';

function App() {
  return (
    <Routes>
      {/* ---- Auth callback (outside layout — no header) ---- */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* ---- Learner routes (wrapped in AppLayout) ---- */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<MainMenu />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/lessons/:id" element={<LessonDetailPage />} />
        <Route path="/play" element={<Play />} />
        <Route path="/finish" element={<Finish />} />
      </Route>

      {/* ---- Admin routes ---- */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="categories" replace />} />
        <Route path="login" element={<AdminLogin />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="definitions" element={<AdminDefinitions />} />
        <Route path="prompts" element={<AdminPrompts />} />
        <Route path="questions" element={<AdminQuestions />} />
        <Route path="config" element={<AdminConfig />} />
      </Route>

      {/* ---- Catch-all ---- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
