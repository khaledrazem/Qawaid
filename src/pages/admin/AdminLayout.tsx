import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import './admin.css';

const tabs = [
  { path: 'categories', label: 'Categories' },
  { path: 'definitions', label: 'Definitions' },
  { path: 'prompts', label: 'Prompts' },
  { path: 'questions', label: 'Questions' },
  { path: 'config', label: 'Config' },
];

export default function AdminLayout() {
  const location = useLocation();
  const { user, isLoading, signOut } = useAdminAuth();

  const isLoginPage = location.pathname === '/admin/login';
  const redirectToLogin = !isLoading && !user && !isLoginPage;
  const redirectToCategories = !isLoading && isLoginPage && !!user;
  const showLoginPage = !isLoading && isLoginPage && !user;
  const showDashboard = !isLoading && !!user && !isLoginPage;

  return (
    <div className="admin-shell">
      {redirectToLogin && <Navigate to="/admin/login" replace />}
      {redirectToCategories && <Navigate to="/admin/categories" replace />}

      {isLoading && <div className="admin-loading">Loading…</div>}

      {showLoginPage && <Outlet />}

      {showDashboard && (
        <>
          <header className="admin-header">
            <nav className="admin-nav">
              {tabs.map((t) => (
                <Link
                  key={t.path}
                  to={`/admin/${t.path}`}
                  className={`admin-nav-link${location.pathname === `/admin/${t.path}` ? ' active' : ''}`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <span className="admin-username">{user?.username ?? 'Admin'}</span>
            <button type="button" onClick={signOut} className="admin-signout">Sign out</button>
          </header>
          <main className="admin-main">
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
}
