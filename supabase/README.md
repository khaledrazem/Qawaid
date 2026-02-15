# Sahra — Supabase

## Phase 3: Database

### Running the migration

**Option A — Supabase Dashboard**

1. Open your project in [Supabase Dashboard](https://app.supabase.com) → SQL Editor.
2. Paste the contents of `migrations/20250213100000_initial_schema.sql`.
3. Run the script.

**Option B — Supabase CLI**

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### RLS summary

| Table | anon | authenticated (learner) | authenticated (admin) |
|-------|------|--------------------------|------------------------|
| **users** | — | read/update own row | read all, update own |
| **user_stats** | — | read/insert/update own | — |
| **monthly_scores** | read all (leaderboard) | read all, insert/update own | — |
| **user_difficulty_profile** | — | read/insert/update own | — |
| **categories, definitions, category_definitions** | read | read | full CRUD |
| **prompts, prompt_definitions** | read | read | full CRUD |
| **questions, lessons** | read | read | full CRUD |

Admin = `users.is_admin = true`. Admin must sign in via **Supabase Auth** (so `auth.uid()` is set) for these policies to apply. The app verifies username + password and then signs them in with `signInWithPassword` (using the same user in `auth.users`) or you create the admin in Auth manually.

### Creating the first admin user

Admin is a row in `users` with `username`, `hashed_password`, and `is_admin = true`. For RLS to allow content writes, that user must also exist in Supabase Auth with the **same id**.

1. **Create auth user (Supabase Dashboard or Admin API)**  
   Auth → Users → Add user with email `your_username@admin.sahra.local` (e.g. `admin@admin.sahra.local`) and your password. Login in the app uses Username (no email). Note the user’s **UUID** (`id`).

2. **Insert into `public.users` with that same id** (run in SQL Editor):

```sql
INSERT INTO public.users (id, username, hashed_password, is_admin)
VALUES (
  'PASTE_THE_AUTH_USER_UUID_HERE',
  'admin',
  crypt('your_secure_password', gen_salt('bf')),
  true
);
```

Use the **same** password as in Auth. The admin signs in with **Username** (e.g. `admin`) and that password—no email field.

### Admin session (JWT expiry)

If the admin UI logs you out often or gets stuck on “Loading”, increase the JWT lifetime so the access token lasts longer. In **Supabase Dashboard → Project Settings → Auth → JWT expiry**, set a higher value (e.g. `86400` for 24 hours; max `604800` for one week). The default is 3600 (1 hour). Sessions are refreshed automatically; a longer JWT reduces how often refresh must succeed.

To inspect your project's auth config (e.g. `jwt_exp`, refresh token settings) via the Management API, use a [Personal Access Token](https://supabase.com/dashboard/account/tokens) and run:

```bash
curl -s "https://api.supabase.com/v1/projects/YOUR_PROJECT_REF/config/auth" \
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"
```

Replace `YOUR_PROJECT_REF` with your project ref (the subdomain of your Supabase URL). The admin UI has a **Config** tab where you can see the current session's JWT expiry and optionally fetch this auth config by pasting a PAT (used only for that request).

### Seed data (optional)

To load the example categories, definitions, prompts, prompt_definitions, and questions, run the contents of `seed.sql` in the SQL Editor (after migrations). It is intended for an empty content DB; if you already have data, truncate or adapt as needed.

### Next (Phase 4a)

Bootstrap seed will create this admin user (and optionally minimal categories/definitions). You can run the migration first, then use the seed script or do the admin user creation as above.
