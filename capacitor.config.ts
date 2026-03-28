import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qawaid.app',
  appName: 'Qawaid',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // Android: OAuth 2.0 Client ID for Android (from GCP). Set via env when running cap sync.
      androidClientId: process.env.VITE_GOOGLE_ANDROID_CLIENT_ID ?? '333925155088-0r23tfdn0lvvgj2ge86ng7f8l9qfj8l1.apps.googleusercontent.com',
      // Web client ID (same as used in Supabase). Optional; helps with token verification.
      serverClientId: process.env.VITE_GOOGLE_WEB_CLIENT_ID ?? '333925155088-dc8jovk1gcf4656otv168au3hscb0spl.apps.googleusercontent.com',
    },
  },
};

export default config;
