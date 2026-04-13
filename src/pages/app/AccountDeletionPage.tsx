/**
 * Stand-alone account deletion by email (direct URL only; not linked from main navigation).
 * User must be signed in; entered email must match the session account.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { deleteAccount } from '@/services/backendApi';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';

export default function AccountDeletionPage() {
  const { t } = useTranslation();
  const { session, loading: authLoading, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const e = session?.user?.email?.trim() ?? '';
    if (e) setEmail(e);
  }, [session?.user?.email]);

  const sessionEmail = session?.user?.email?.trim() ?? '';

  const openConfirm = () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('accountDeletion.emailRequired'));
      return;
    }
    if (!sessionEmail) {
      setError(t('accountDeletion.signInFirst'));
      return;
    }
    if (trimmed.toLowerCase() !== sessionEmail.toLowerCase()) {
      setError(t('accountDeletion.emailMismatch'));
      return;
    }
    setDeleteWord('');
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (busy) return;
    setConfirmOpen(false);
    setDeleteWord('');
    setError(null);
  };

  const submitDelete = async () => {
    if (deleteWord.trim() !== 'DELETE') {
      setError(t('profile.deleteAccountMustType'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAccount('DELETE', email.trim());
      try {
        localStorage.removeItem('sahra_offline_session_queue');
      } catch {
        /* ignore */
      }
      await signOut();
      setConfirmOpen(false);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.deleteAccountFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-with-bg account-deletion-page">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.12} />
      <TextureOverlay className="page-texture" />
      <div className="page-content account-deletion-content">
        <p className="account-deletion-meta">
          <Link to="/">← {t('nav.home')}</Link>
        </p>
        <h1 className="page-heading">{t('accountDeletion.title')}</h1>
        <p className="account-deletion-intro">{t('accountDeletion.intro')}</p>

        {authLoading && (
          <div className="placeholder">
            <div className="spinner" />
          </div>
        )}

        {!authLoading && !session && (
          <div className="card account-deletion-card">
            <p>{t('accountDeletion.signInFirst')}</p>
            <Link to="/profile" className="btn btn-primary">
              {t('accountDeletion.goToProfile')}
            </Link>
          </div>
        )}

        {!authLoading && session && (
          <div className="card account-deletion-card">
            <label className="profile-delete-label" htmlFor="acct-del-email">
              {t('accountDeletion.emailLabel')}
            </label>
            <input
              id="acct-del-email"
              type="email"
              className="profile-delete-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
            />
            {error && !confirmOpen && (
              <p className="profile-delete-error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn btn-secondary" onClick={openConfirm} disabled={busy}>
              {t('accountDeletion.continue')}
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="modal-backdrop" onClick={closeConfirm} role="presentation">
          <div
            className="modal-panel profile-delete-modal account-deletion-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="acct-del-modal-title"
            aria-modal="true"
          >
            <h3 id="acct-del-modal-title">{t('accountDeletion.modalTitle')}</h3>
            <p className="profile-delete-warning">{t('accountDeletion.modalBody')}</p>
            <p className="account-deletion-confirm-email">
              <strong>{email.trim()}</strong>
            </p>
            <label className="profile-delete-label" htmlFor="acct-del-word">
              {t('profile.deleteAccountTypeLabel')}
            </label>
            <input
              id="acct-del-word"
              type="text"
              className="profile-delete-input"
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={busy}
            />
            {error && confirmOpen && (
              <p className="profile-delete-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-footer profile-delete-footer">
              <button type="button" className="btn btn-secondary" onClick={closeConfirm} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn profile-delete-confirm-btn"
                onClick={submitDelete}
                disabled={busy || deleteWord.trim() !== 'DELETE'}
              >
                {busy ? '…' : t('profile.deleteAccountConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
