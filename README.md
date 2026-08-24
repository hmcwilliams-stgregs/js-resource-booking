# Resource Booking

A resource/room booking system — resource groups with their own timetables,
approval workflows, recurring and all-day bookings, and a full audit log —
built with React + Vite, backed by Supabase (Postgres), deployed on GitHub
Pages.

**→ See [DEPLOYMENT.md](./DEPLOYMENT.md) for full setup instructions.**

## Quick start (local development)

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

## Project structure

```
src/
  App.jsx              the whole app (UI + state)
  main.jsx             React entry point
  lib/
    supabaseClient.js   Supabase client setup (reads env vars)
    api.js              every database read/write, incl. the audit log
supabase/
  schema.sql            run this once in your Supabase project
.github/workflows/
  deploy.yml             builds + deploys to GitHub Pages on push to main
```

## Where your data lives

Everything (resources, groups, timetables, bookings, users, notifications)
is stored in Supabase Postgres tables — see `supabase/schema.sql`. Every
booking created, approved, rejected, or cancelled also writes a row to
`booking_events`, an append-only audit log independent of current state.
