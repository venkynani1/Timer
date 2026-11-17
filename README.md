# DESIGNATHON X — THE FINAL 12

**12 Hours. One Mission. Infinite Possibilities.**

The official 12-hour mission clock for Designathon X: a cinematic projector display, a public mobile timer, and a secure host dashboard. All of it runs on one authoritative deadline stored in PostgreSQL.

| Route | Who | What |
| --- | --- | --- |
| `/timer/projector` | Main stage / LED wall | Cinematic, Minimal or Command layout, fullscreen, sound |
| `/timer` | Participants (QR code) | Public, read-only, mobile-first timer |
| `/admin/timer` | Hosts | Setup, START MISSION, announcements, milestones, display, health, audit log, override |
| `/admin/login` | Hosts | Supabase Auth sign-in |

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Radix) · Framer Motion · Lucide · Supabase (Postgres, Realtime, Auth) · Vercel.

---

## How the clock stays correct

The app never counts down by decrementing a variable. Every screen calculates remaining time from the same committed deadline:

```
remaining = max(0, ends_at − estimated_server_now)
```

1. **One authoritative row.** `public.event_timers` stores `state`, `duration_seconds`, `started_at`, `ends_at`, `completed_at`, `version` and `updated_at`.
2. **Atomic start.** `start_mission()` takes a row lock, then runs one conditional `UPDATE … WHERE state = 'NOT_STARTED'` with `started_at = now()` and `ends_at = now() + duration`. Both times come from the database clock. The client sends no time values. Duplicate or concurrent starts return the deadline already committed.
3. **Immutable after launch.** A trigger rejects any change to start, duration or deadline once launched. Only the audited emergency override function can bypass it.
4. **Completion without browsers.** The `mission_clock` view reports `COMPLETED` as soon as `now() >= ends_at`. `finalize_mission()` persists completion idempotently (`completed_at = ends_at`, one audit row). The public state API calls it, and so does an optional `pg_cron` job.
5. **Server-time sync on each device.** `ServerClock` uses an NTP-style method:
   - It measures round trips to `/api/time` (an edge function that never touches the database) against `performance.now()`.
   - It keeps the lowest-latency samples and anchors server time to the monotonic clock.
   - It ignores the device's wall clock, so a phone set 3 hours wrong still shows the right time.
6. **Resync triggers.** The clock resyncs every 5 minutes, and also on focus, visibility change, network reconnect and every Realtime state change. A watchdog compares wall-clock and monotonic time and resyncs if they diverge, which catches a device waking from sleep.
7. **Rendering.** Ticks are aligned to whole-second boundaries of *server* time. There is one state update per second, nothing accumulates, and nothing drifts.
8. **Realtime is a hint, not the source of truth.** Realtime pushes are accepted only if they carry a newer `version`. Reconnecting always refetches authoritative state. If Realtime drops, the countdown keeps running, because it only needs the deadline already on screen. A slow fallback poll (20 s while disconnected, 5 min while live) catches up on anything missed.

Seconds are ceiling-rounded. The display reads `12:00:00` at the exact start and `00:00:00` exactly at the deadline, and it never shows a negative value.

### States

`NOT_STARTED` → `RUNNING` → `COMPLETED`, plus `EMERGENCY_OVERRIDE`, which is a frozen hold.

By default the event is strict and cannot be paused. Hosts see no Pause, Reset or Extend controls after launch.

### Emergency override (disabled by default)

Each layer below is enforced in Postgres, not only in the UI:

- An **owner** must first *arm* the override.
- Only **override_admin** or **owner** can act: **HOLD** (freeze), **RESUME** (continue from the frozen remaining time) or **ADJUST** (−60 to +120 minutes).
- Every action requires:
  - **Password re-entry.** The API performs a fresh sign-in, and the database checks that the JWT `amr` sign-in timestamp is under 5 minutes old.
  - A written **reason** of at least 10 characters.
  - An explicit confirmation dialog.
- Each action writes an **append-only audit row** with before and after deadlines. Update, delete and truncate on the audit log are blocked by triggers.

---

## Project layout

```
app/
  timer/page.tsx                 participant timer
  timer/projector/page.tsx       projector (cinematic | minimal | command)
  admin/timer/page.tsx           host dashboard (server-side role check)
  admin/login/page.tsx
  api/time                       edge time beacon for clock sync
  api/timer/state                public authoritative state (+ idempotent finalisation)
  api/admin/timer/*              start, configure, milestones, announcements, override, arm, audit, integrations
  api/integrations/module-status integration hook for other modules
components/
  mission/                       energy ring, countdown, launch sequence, views, alerts, celebration…
  admin/                         dashboard panels
  ui/                            shadcn/ui primitives
hooks/use-mission.ts             one hook drives every screen
lib/timer/
  engine.ts                      pure timing maths (snapshot, phases, milestones, announcements)
  server-clock.ts                latency-aware server time estimation
  store.ts                       versioned state store + realtime/reconnect logic
  simulation.ts                  developer-only accelerated mode
  transport.ts                   Supabase transport (state API + Realtime)
supabase/migrations/             schema, RLS, functions, seed
supabase/snippets/grant-staff.sql
tests/unit/                      engine, sync, store, simulation
tests/db/                        the real migrations, run in embedded Postgres (PGlite)
```

---

## Setup

### 1. Supabase

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` in order. Either:
   - with the CLI: `supabase link --project-ref <ref> && supabase db push`, or
   - by pasting each file into **SQL Editor** and running it.
3. Optional: enable **pg_cron** (Database → Extensions) *before* running the first migration. The migration then schedules `finalize_overdue_missions()` every minute, so the stored state flips to `COMPLETED` even if no one is watching. The read model already reports completion correctly without it.
4. **Realtime.** The migration adds `event_timers`, `timer_milestones`, `timer_announcements` and `events` to the `supabase_realtime` publication. Confirm they appear under Database → Publications.

### 2. Authentication

1. Go to **Authentication → Providers → Email**:
   - Enable email + password.
   - Under **Authentication → Sign In / Up**, *disable new sign-ups* so only staff you create can sign in.
2. Under **Authentication → URL Configuration**, set the Site URL to your Vercel domain.
3. Create each host under **Authentication → Users → Add user**.
4. Grant roles with `supabase/snippets/grant-staff.sql`, using one of `host`, `override_admin` or `owner`.

> **Integrating with an existing Designathon X database:** `events` and `event_staff` use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`. If they already exist, the module reuses them. If your existing tables have different names, point the functions' `require_role()` and `staff_role()` at your table instead.

### 3. Environment

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key only |
| `NEXT_PUBLIC_EVENT_SLUG` | no | Default `designathon-x` |
| `NEXT_PUBLIC_EVENT_TIMEZONE` | no | e.g. `Asia/Kolkata`; defaults to each viewer's zone |
| `NEXT_PUBLIC_ALLOW_SIMULATION` | no | `true` only on staging |

The app does **not** use the service-role key anywhere. All privileged work runs in `SECURITY DEFINER` functions that check the caller's own JWT.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm test           # unit + database tests
```

---

## Developer simulation (accelerated testing)

To preview any moment of the event without a database, add `?sim=<speed>` to `/timer` or `/timer/projector`:

| URL | Shows |
| --- | --- |
| `/timer/projector?sim=1&launch=3` | standby, then the 10 s launch sequence after 3 s |
| `/timer/projector?sim=1&at=2:14:00` | mid-mission (cyan) |
| `/timer/projector?sim=1&at=7:40:00` | blue/violet phase |
| `/timer/projector?sim=1&at=10:59:50` | the final-hour transition |
| `/timer/projector?sim=1&at=11:59:00` | final minute → final seconds → Mission Complete |
| `/timer/projector?sim=600&at=11:00:00` | the last hour at 600× speed |
| `/timer/projector?sim=1&at=5:00:00&mode=command` | Command layout |
| `/timer?sim=1&at=3:20:00` | participant phone view |

The simulation runs entirely in the browser against a synthetic event with id `simulation`. It never reads or writes the official clock, and every view shows a **"Developer simulation · not the official clock"** banner. It is **off in production builds** unless `NEXT_PUBLIC_ALLOW_SIMULATION=true`.

---

## Running the event

**Before doors open**

1. Sign in at `/admin/timer`. Check the event name, duration (12 h = 43,200 s), milestones and closing message.
2. **Display tab:** choose the projector layout, enable sound if wanted, and download the participant QR code.
3. Open `/timer/projector` on the stage machine and press **Fullscreen**. If sound is enabled, click **Sound on** once; browsers require a user gesture before playing audio.
4. Pin side screens to a layout with `?mode=minimal` or `?mode=command`.
5. **Health tab:** confirm the screens show *SYNCED*. The command layout also shows the clock-sync round-trip time.

**Launch**

Press **START MISSION**, type `LAUNCH` and confirm. Postgres commits the start time, and every connected screen plays the 10-second launch sequence in lock-step. The official clock is already running underneath the animation. Screens opened later skip the animation and show the live countdown.

**During the event**

- Broadcast announcements: immediate or scheduled, with priority, display duration and expiry. You can withdraw one at any time.
- Edit milestone copy. Milestone timing is locked after launch.
- Switch the projector layout. This never affects the timer.

**Final hour (automatic)**

| Remaining | What happens |
| --- | --- |
| 60 min | "THE FINAL HOUR HAS BEGUN", ember palette |
| 30 min | Subtle notice |
| 10 min | FINAL COUNTDOWN: larger digits, red palette, side panels dim |
| 5 min | "FIVE MINUTES TO GO" |
| 60 s | Fullscreen final-minute layout |
| 10 s | Giant numerals, optional ticks |
| 0 | `00:00:00`, MISSION COMPLETE, official finish timestamp, closing message, one-time celebration |

Reopening any screen after the deadline shows the completed state without replaying the celebration and without any backend action.

### Energy ring phases

- **12–6 h:** electric cyan
- **6–3 h:** blue/violet
- **3–1 h:** amber
- **Final hour:** orange-red
- **Final 10 min:** high-contrast red
- **Complete:** green

Colour is never the only signal. Each phase also has a text status, a status-icon shape, milestone markers and dimmed spent ticks.

---

## Integration hooks (Problem Statement Arena, Goodies Selection Arena, dashboards)

The timer never opens or closes another module unless an admin enables it under **Integrations**.

- **Database (authoritative):** call `public.is_module_open(event_id, 'problem_statement_arena')` from the other module's RLS policies or functions. For example:
  ```sql
  create policy "selection closes at deadline" on public.problem_selections
    for insert to authenticated
    with check (public.is_module_open(event_id, 'problem_statement_arena'));
  ```
- **HTTP (advisory, for UI):** `GET /api/integrations/module-status?module=problem_statement_arena` returns `{ open, state, endsAt, serverNow }`.
- **Read model:** other dashboards can select from `public.mission_clock` or subscribe to `event_timers` through Realtime.

---

## Security

- **Authentication:** Supabase Auth, with session cookies refreshed by middleware.
- **Authorisation, checked three times:**
  - Middleware sends signed-out users to the login page.
  - The admin page checks the user's staff role on the server.
  - Every Postgres function calls `require_role()`.
- **Row Level Security:** enabled on all tables.
  - The public can read only the timer, events, milestones and announcements.
  - The audit log is readable by staff of that event only.
  - **No table has INSERT/UPDATE/DELETE policies.** All writes go through validated, rate-limited, audited functions.
- **Rate limiting:** per user and per action in Postgres, so it holds across serverless instances. Examples: 10 starts/min, 30 announcements/min, 10 overrides per 5 min.
- **Input validation:**
  - zod validates input in the API.
  - The database sanitises it again with `clean_text()`, which strips control characters and enforces length limits, and with CHECK constraints.
  - Announcements are plain text and rendered escaped.
- **CSRF:** cookie-authenticated mutations must be same-origin.
- **Trust boundaries:** the app never trusts client-supplied start times or deadlines, and never needs a service-role key.

---

## Tests

```bash
npm test          # everything
npm run test:unit # timing engine, clock sync, realtime store, simulation
npm run test:db   # real migrations in embedded Postgres (PGlite) with a Supabase auth shim
```

The database tests run the actual SQL, including RLS, roles and JWT claims, so they need no Supabase project.

| # | Requirement | Test |
| --- | --- | --- |
| 1 | Starts at exactly 12 h | `db: starts at exactly 12 hours`, `engine: shows exactly 12:00:00` |
| 2 | Refresh doesn't reset | `db: re-reading state…`, `store: a refresh (new store instance)…` |
| 3 | Screens consistent | `sync: multiple screens on different networks…` |
| 4 | Duplicate starts → same deadline | `db: duplicate start requests…` |
| 5 | Browser closure doesn't stop it | `db: completes server-side with no browser connected` |
| 6 | Wrong device clock ignored | `sync: a wildly wrong device clock…` |
| 7 | Reaches zero correctly | `engine: reaches 00:00:00 exactly at 12 elapsed hours` |
| 8 | Never negative | `engine: never becomes negative…` |
| 9 | Completion persists | `db: completion persists and finalisation is idempotent` |
| 10 | Unauthorised users blocked | `db: anonymous and non-staff users cannot…` |
| 11 | Milestones at correct offsets | `engine: milestone transitions happen at the configured offsets` |
| 12 | Announcements sync | `store: announcements synchronise across clients` |
| 13 | Reconnection restores state | `store: reconnection restores authoritative state…` |
| 14 | Override needs auth + audit | `db: emergency override …` (2 tests) |
| 15 | Simulated 12-h run | `simulation: a simulated 12-hour run produces the correct completion time` |

Further tests cover sleep/wake resync, jittery networks, no drift over 12 hours, locked timing, rate limiting, sanitisation and integration deadlines.

---

## Deploying to Vercel

1. Import the repository in Vercel. The framework preset is Next.js and needs no extra configuration.
2. Add the environment variables from `.env.example` for Production (and Preview if you use it).
3. Deploy. `npm run build` is the build command.
4. In Supabase, set **Authentication → URL Configuration → Site URL** to the Vercel URL.
5. Smoke-test:
   - `/timer` shows *Awaiting launch*.
   - Sign in at `/admin/timer`.
   - Open `/timer/projector` on a second device and check that both show *SYNCED*.

No long-running backend process is needed:

- Vercel serves stateless functions and the edge time beacon.
- Postgres holds all state.
- Supabase Realtime pushes changes to screens.
- `pg_cron` (optional) persists completion.

For a dress rehearsal, use a separate Supabase project or event slug with a short duration (for example 10 minutes). Never rehearse on the production event row: once launched, it cannot be reset.
