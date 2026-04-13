/**
 * Privacy policy — intended for store compliance and direct URL only (/privacy).
 * Not linked from in-app navigation. Hidden on native builds (use the website URL).
 */

import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';

export default function PrivacyPolicyPage() {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page page-with-bg privacy-policy-page">
      <BackgroundPattern className="page-bg-pattern" variant={2} opacity={0.12} />
      <TextureOverlay className="page-texture" />
      <div className="page-content privacy-policy-content">
        <p className="privacy-policy-meta">
          <Link to="/">← Home</Link>
        </p>
        <h1 className="page-heading privacy-policy-title">Privacy Policy — Qawaid (قواعد)</h1>
        <p className="privacy-policy-updated">Last updated: April 2026</p>

        <div className="card privacy-policy-card">
          <h2>Who we are</h2>
          <p>
            Qawaid is an Arabic grammar practice application. This policy describes how we handle information when you use
            the app or the website.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account (optional):</strong> If you sign in (for example with Google), we receive identifiers and
              profile details from your provider (such as name and avatar) as processed by our authentication service
              (Supabase).
            </li>
            <li>
              <strong>Usage and progress:</strong> When you are signed in, we store game-related data such as scores,
              session statistics, difficulty preferences, and question reports you submit.
            </li>
            <li>
              <strong>Local device data:</strong> The app may keep local settings or session summaries on your device
              (for example best session scores) to improve your experience offline.
            </li>
          </ul>

          <h2>How we use data</h2>
          <p>We use the information above to run the service, show leaderboards, personalize difficulty, and fix content issues.</p>

          <h2>Third parties</h2>
          <p>
            Authentication and database hosting may be provided by Supabase and sign-in by Google, subject to their
            respective policies. We do not sell your personal information.
          </p>

          <h2>Retention and deletion</h2>
          <p>
            You can delete your learner account from the Profile screen in the app (when signed in), or by opening the
            account deletion page in your browser at <strong>/account-deletion</strong> on our website (sign in, enter your
            email, confirm). That removes your profile and related game data from our database and deletes your
            authentication account, except where we must retain minimal records for legal or security reasons.
          </p>

          <h2>Contact</h2>
          <p>For privacy questions, contact the operator of this Qawaid deployment using the support channel they publish for the app.</p>
        </div>
      </div>
    </div>
  );
}
