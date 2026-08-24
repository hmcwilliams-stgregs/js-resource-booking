# Deployment guide: GitHub Pages + Supabase

This gets the app live at `https://<your-username>.github.io/<repo-name>/`,
with all booking data, timetables, and the audit log stored in a free
Supabase Postgres database.

Total time: ~15 minutes.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Pick an organization, name it (e.g. `resource-booking`), set a database
   password (save it somewhere — you likely won't need it again, but it's
   your Postgres root password), choose a region close to your users, and
   create the project. Takes 1–2 minutes to provision.

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the whole file, paste it
   in, and click **Run**.
3. You should see it complete with no errors. Check **Table Editor** — you
   should now see `groups`, `resources`, `periods`, `app_users`, `bookings`,
   `notifications`, and `booking_events`, with the first few seeded already
   (5 resource groups, 12 resources, one admin account "A. Marsh").

If you ever want to reset to a clean slate, you can re-run the script — the
`insert ... on conflict do nothing` seed lines won't duplicate data, but
they also won't undo changes you've made. To fully reset, drop the tables
first (`drop table booking_events, notifications, bookings, app_users,
periods, resources, groups cascade;`) then re-run the script.

## 3. Get your API keys

1. In Supabase: **Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **anon / public** key. You'll need both
   in the next two steps. (Don't use the `service_role` key anywhere in this
   app — it bypasses the row-level security policies and should never ship
   in a browser bundle.)

## 4. Push the code to GitHub

If you haven't already:

```bash
cd resource-booking-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## 5. Add your Supabase keys as repo secrets

The GitHub Actions workflow needs your Supabase credentials to build the
app (they get baked into the static JS bundle at build time — this is
normal and safe for the anon key, see step 3's note).

1. On GitHub: your repo → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**.
2. Add two secrets:
   - `VITE_SUPABASE_URL` → your Project URL from step 3
   - `VITE_SUPABASE_ANON_KEY` → your anon key from step 3

## 6. Enable GitHub Pages

1. Repo → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**
   (not "Deploy from a branch" — the workflow in this repo handles the
   build itself).

## 7. Deploy

The workflow at `.github/workflows/deploy.yml` runs automatically on every
push to `main`. If you just pushed in step 4, it's likely already running —
check the **Actions** tab on GitHub to watch it build and deploy.

Once it finishes (green checkmark), your app is live at:

```
https://<your-username>.github.io/<repo-name>/
```

You can also trigger a deploy manually anytime from **Actions** → **Deploy
to GitHub Pages** → **Run workflow**.

## 8. Try it

- Sign in as **A. Marsh** (the seeded admin) to see the full admin toolset:
  Edit timetable, Manage resources, Manage users, Approvals.
- Sign in as **Julie Stewart** or create a new account to try it as a
  regular member.
- Make a booking on something marked "needs approval" (e.g. the Theatre) as
  a member, then switch to A. Marsh and approve it from the **Approvals**
  panel — you'll see the notification appear back on Julie's side.

---

## Viewing the audit log

Every booking created, approved, rejected, or cancelled writes a row to the
`booking_events` table — independent of the current-state tables, so it's a
real history even after a booking is later deleted.

In Supabase, either browse it directly in **Table Editor → booking_events**,
or query it in **SQL Editor**, e.g.:

```sql
-- everything that happened to a specific booking
select * from booking_events where booking_id = 'abc123' order by created_at;

-- everyone's activity in the last 7 days
select actor, action, count(*) 
from booking_events 
where created_at > now() - interval '7 days'
group by actor, action
order by count(*) desc;
```

---

## Updating the app later

Any push to `main` triggers a new build + deploy automatically — no manual
steps needed. Database schema changes (e.g. adding a column) need to be run
manually in the Supabase SQL Editor, since `schema.sql` isn't applied
automatically on every deploy.

---

## Local development

```bash
npm install
cp .env.example .env.local
# edit .env.local with your Supabase URL + anon key
npm run dev
```

This runs against the *same* Supabase project as your deployed site (there's
only one database here) — useful for testing changes, but be aware you're
working with live data, not a separate sandbox. If you want an isolated dev
environment, create a second free Supabase project and point `.env.local`
at that instead.

---

## Security note: this app has no real authentication

Signing in here works by matching a typed name against the `app_users`
table — there's no password, and the Supabase row-level security policies
in `schema.sql` are deliberately **wide open** (any anon key can read or
write any row) so the app functions without a real auth layer. That's a
reasonable starting point for something reachable only inside a school
network, a trusted internal tool, or early testing — **it is not safe for
a public-internet deployment with data you actually care about protecting**,
since anyone with your anon key (visible in the browser bundle — this is
normal for anon keys, but means the *lack of policy restrictions* is the
actual risk) could read or modify any booking, resource, or user.

### Next steps: real authentication

When you're ready to lock this down:

1. Switch sign-in to [Supabase Auth](https://supabase.com/docs/guides/auth)
   (email/password, magic link, or an OAuth provider like Google/Microsoft).
2. Add a `user_id uuid references auth.users` column linking `app_users`
   rows to real Supabase Auth identities.
3. Rewrite the RLS policies in `schema.sql` to check `auth.uid()` — e.g.
   members can only insert/update/cancel their own bookings, only rows
   where `app_users.role = 'admin'` (matched to the signed-in `auth.uid()`)
   can approve/reject or edit resources and timetables.

This is a genuine chunk of work (not a config toggle), so it's worth doing
once you know the app is otherwise meeting your needs — happy to help
scaffold it when you're ready.

---

## Troubleshooting

**Blank page after deploying, works fine locally** — almost always the Vite
`base` path. The workflow sets it automatically from your repo name; if
you renamed the repo after first deploying, re-run the workflow
(**Actions → Run workflow**) to rebuild with the new name.

**"Missing Supabase env vars" in the browser console** — the repo secrets
in step 5 aren't set, or were added after the last build ran. Trigger a
fresh deploy from the **Actions** tab.

**Data doesn't show up / everything looks empty** — check that
`schema.sql` actually ran successfully (step 2) and that the seed rows
appear in Table Editor. Also check the browser console for Supabase errors
(usually a copy-paste mistake in the URL or key).

**"new row violates row-level security policy"** — this means a table's
RLS is enabled but its permissive policy either wasn't created or got
edited/removed. Re-run the `create policy` statements from `schema.sql` for
the affected table.
