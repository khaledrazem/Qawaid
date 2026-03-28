# Building the Android APK

The app is wrapped with [Capacitor](https://capacitorjs.com/) so the same Vite/React build runs inside a native Android WebView. Use this flow to produce an APK (or AAB for Play Store).

## Prerequisites

- **Node** and **npm** (already used for the web app)
- **Android Studio** (or Android SDK + build tools) for building the APK
- **Java 17** (recommended for current Capacitor/Android Gradle)

## Build steps

1. **Install dependencies** (including Capacitor):
   ```bash
   npm install
   ```

2. **Build the web app for production**  
   Use the same env as Vercel so the bundle has the right Supabase URL and keys. Either rely on `.env.production` or set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and optionally `VITE_APP_URL`:
   ```bash
   npm run build
   ```

3. **Sync web assets into the Android project**:
   ```bash
   npx cap sync
   ```
   Or use the combined script that builds then syncs:
   ```bash
   npm run cap:sync
   ```

4. **Open the Android project** in Android Studio:
   ```bash
   npx cap open android
   ```
   Or open the `android/` folder in Android Studio manually.

5. **Build the APK** in Android Studio:
   - **Build → Build Bundle(s) / APK(s) → Build APK(s)** for a debug or release APK.
   - For Play Store, use **Build → Build Bundle(s) / APK(s) → Build App Bundle(s)** to get an AAB.

6. **Google sign-in in the APK (in-app, no browser)**  
   The app uses **native Google Sign-In** on Android: the account picker appears inside the app instead of opening a browser. To enable it:
   - **GCP:** Create an Android OAuth 2.0 Client ID; package name `com.qawaid.app`; add keystore SHA-1 (e.g. `cd android && ./gradlew signingReport`). Copy the Android client ID.
   - **Supabase:** Authentication → Providers → Google. The **Client ID** field must list both your Web and Android client IDs so Supabase can verify the token: enter `WebClientId,AndroidClientId` (comma-separated, Web first). If you only had the Web ID before, add the Android client ID from GCP. Without it, sign-in will open the picker but fail after you select an account.
   - **Capacitor:** Set `VITE_GOOGLE_ANDROID_CLIENT_ID` when running `cap:sync`, or set `plugins.GoogleAuth.androidClientId` in capacitor.config.ts.
   - Then Sign in with Google in the APK shows the in-app picker and signs in without leaving the app.
   - **If you get "Something went wrong" with code 10 (DEVELOPER_ERROR):** The SHA-1 of the keystore you used to sign the APK is missing or wrong in GCP. Add the correct SHA-1 to your Android OAuth client (debug: from `./gradlew signingReport`; release: from your release keystore or Play Console App Integrity). Package name must be exactly `com.qawaid.app`.
   - (Legacy: redirect URL `capacitor://localhost/auth/callback` is only needed if you use the browser OAuth flow.)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Type-check and Vite production build → `dist/` |
| `npm run cap:sync` | Run `npm run build` then `npx cap sync` |
| `npm run cap:open:android` | Open the `android/` project in Android Studio |

## Config

- **Capacitor:** [capacitor.config.ts](../capacitor.config.ts) — `appId`, `appName`, `webDir: "dist"`, and `plugins.GoogleAuth` for native Google Sign-In (androidClientId, serverClientId).
- **Vite:** No change needed; default `base: '/'` works with Capacitor.

## Signing (release)

For a release APK or AAB, configure signing in Android Studio (e.g. **Build → Generate Signed Bundle / APK**). Keep keystore files (e.g. `*.jks`, `*.keystore`) out of the repo; they are listed in `.gitignore`.
