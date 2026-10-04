# Kalendaryo

Appointment booking for a one-person business: a customer picks a service and an
open time in under a minute, and the owner sees the day's list in one place.

Live surfaces:

- **Book a slot** - service, day and time, contact details, confirmation.
- **Owner** - today and upcoming bookings, booked value, service list, cancel.

## Stack

Vite, React 19, Tailwind CSS v4, Motion, and Supabase for auth and Postgres.
UI primitives follow Aceternity patterns (spotlight card, text flip, stateful
button) re-implemented locally so the app owns its own code.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5200
```

With no `.env.local` the app runs on a seeded local store in localStorage, so the
whole booking flow works with no backend. The owner dashboard is open in that
mode and says so. `npm test` covers the slot logic and needs nothing running.

## Backend

Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. The app switches to Supabase automatically, the owner
dashboard then requires a magic-link sign in, and bookings are written to
Postgres.

The schema lives in `supabase/migrations/0001_init.sql`: services, availability
and bookings, with row level security so the menu and hours are public, anyone
may create a booking, and only a signed-in owner may read or change bookings. A
partial unique index on `starts_at` stops a double booking at the database.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5200 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run lint` | oxlint |
| `npm test` | Slot-generation tests |
