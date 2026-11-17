-- =============================================================================
-- DESIGNATHON X — THE FINAL 12
-- Authoritative mission clock schema.
--
-- Design rules enforced here (not in the browser):
--   * The official start time is always the database's own clock (now()).
--   * The deadline is always started_at + duration. Clients never send times.
--   * Starting is a single conditional UPDATE, so duplicate / concurrent starts
--     cannot produce two different deadlines.
--   * Once started, start/duration/deadline are immutable, except through the
--     emergency override function (disabled by default, audited, reauth only).
--   * The event counts as COMPLETED as soon as now() >= ends_at, even if no
--     browser is connected (see public.mission_clock view + finalize function).
--   * All writes go through SECURITY DEFINER functions. Tables expose no
--     INSERT/UPDATE/DELETE policies to anon/authenticated users.
--
-- Shared tables (events, event_staff) use IF NOT EXISTS so the module can be
-- dropped into an existing Designathon X database that already has them.
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+.

-- -----------------------------------------------------------------------------
-- Shared event identity (re-used by other Designathon X modules)
-- -----------------------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.events add column if not exists tagline   text not null default '12 Hours. One Mission. Infinite Possibilities.';
alter table public.events add column if not exists subtitle  text not null default 'THE FINAL 12';
alter table public.events add column if not exists branding  jsonb not null default '{}'::jsonb;
alter table public.events add column if not exists updated_at timestamptz not null default now();

-- Staff / administrator roles. auth.users comes from Supabase Auth.
--   host            : configure, start, milestones, announcements, display
--   override_admin  : host + emergency override (when enabled)
--   owner           : override_admin + enable/disable emergency override
create table if not exists public.event_staff (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

do $$ begin
  alter table public.event_staff
    add constraint event_staff_role_check check (role in ('host', 'override_admin', 'owner'));
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Timer
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.timer_state as enum ('NOT_STARTED', 'RUNNING', 'COMPLETED', 'EMERGENCY_OVERRIDE');
exception when duplicate_object then null; end $$;

create table if not exists public.event_timers (
  event_id           uuid primary key references public.events(id) on delete cascade,
  state              public.timer_state not null default 'NOT_STARTED',
  duration_seconds   integer not null default 43200
                       check (duration_seconds between 60 and 172800),
  started_at         timestamptz,
  ends_at            timestamptz,
  completed_at       timestamptz,
  started_by         uuid references auth.users(id),
  -- Emergency hold bookkeeping (only used in EMERGENCY_OVERRIDE state)
  held_at            timestamptz,
  held_remaining_ms  bigint,
  override_enabled   boolean not null default false,
  display_mode       text not null default 'cinematic'
                       check (display_mode in ('cinematic', 'minimal', 'command')),
  sound_enabled      boolean not null default false,
  closing_message    text not null default '12 HOURS. COUNTLESS IDEAS. ONE INCREDIBLE MISSION.'
                       check (char_length(closing_message) between 1 and 200),
  version            bigint not null default 1,
  updated_at         timestamptz not null default now(),
  constraint ends_after_start check (ends_at is null or started_at is null or ends_at > started_at),
  constraint running_has_times check (state = 'NOT_STARTED' or (started_at is not null and ends_at is not null))
);

-- -----------------------------------------------------------------------------
-- Milestones
-- -----------------------------------------------------------------------------
create table if not exists public.timer_milestones (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  offset_seconds integer not null check (offset_seconds >= 0 and offset_seconds <= 172800),
  title          text not null check (char_length(title) between 1 and 60),
  description    text not null default '' check (char_length(description) <= 280),
  icon           text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$'),
  theme          text check (theme is null or theme in ('cyan', 'blue', 'violet', 'amber', 'orange', 'red', 'green')),
  announcement   text check (announcement is null or char_length(announcement) <= 280),
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists timer_milestones_event_idx on public.timer_milestones (event_id, offset_seconds);

-- -----------------------------------------------------------------------------
-- Announcements
-- -----------------------------------------------------------------------------
create table if not exists public.timer_announcements (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  message          text not null check (char_length(message) between 1 and 280),
  priority         text not null default 'normal' check (priority in ('info', 'normal', 'high', 'critical')),
  display_seconds  integer not null default 20 check (display_seconds between 5 and 3600),
  publish_at       timestamptz not null default now(),
  expires_at       timestamptz,
  cancelled_at     timestamptz,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  constraint expires_after_publish check (expires_at is null or expires_at > publish_at)
);
create index if not exists timer_announcements_event_idx on public.timer_announcements (event_id, publish_at desc);

-- -----------------------------------------------------------------------------
-- Immutable audit log
-- -----------------------------------------------------------------------------
create table if not exists public.timer_audit_log (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references public.events(id) on delete cascade,
  actor_id    uuid,
  action      text not null,
  reason      text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists timer_audit_event_idx on public.timer_audit_log (event_id, created_at desc);

create or replace function public.tg_audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'timer_audit_log is append-only' using errcode = '42501';
end $$;

drop trigger if exists audit_no_update on public.timer_audit_log;
create trigger audit_no_update before update or delete on public.timer_audit_log
  for each row execute function public.tg_audit_immutable();
drop trigger if exists audit_no_truncate on public.timer_audit_log;
create trigger audit_no_truncate before truncate on public.timer_audit_log
  for each statement execute function public.tg_audit_immutable();

-- -----------------------------------------------------------------------------
-- Rate limiting for administrative actions (fixed window, per actor+action)
-- -----------------------------------------------------------------------------
create table if not exists public.admin_rate_limits (
  actor_id     uuid not null,
  action       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (actor_id, action, window_start)
);

-- -----------------------------------------------------------------------------
-- Integration hooks: optional server-side module deadlines
-- -----------------------------------------------------------------------------
create table if not exists public.timer_module_integrations (
  event_id               uuid not null references public.events(id) on delete cascade,
  module_key             text not null check (module_key ~ '^[a-z0-9_]{2,60}$'),
  close_on_deadline      boolean not null default false,
  updated_at             timestamptz not null default now(),
  primary key (event_id, module_key)
);

-- =============================================================================
-- Guards
-- =============================================================================

-- Official time fields are immutable once the timer has started, unless the
-- transaction-local flag set by emergency_override()/internal finalisation is on.
create or replace function public.tg_event_timers_guard() returns trigger
language plpgsql as $$
declare
  privileged boolean := coalesce(current_setting('mission.privileged', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.state <> 'NOT_STARTED' then
      raise exception 'A launched mission clock cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.state <> 'NOT_STARTED' and not privileged then
    if new.started_at is distinct from old.started_at
       or new.ends_at is distinct from old.ends_at
       or new.duration_seconds is distinct from old.duration_seconds
       or new.started_by is distinct from old.started_by
       or new.held_at is distinct from old.held_at
       or new.held_remaining_ms is distinct from old.held_remaining_ms
       or new.state is distinct from old.state
       or new.completed_at is distinct from old.completed_at then
      raise exception 'Official mission time is locked after launch' using errcode = '42501';
    end if;
  end if;

  if old.state = 'NOT_STARTED' and new.state <> 'NOT_STARTED' and not privileged then
    raise exception 'Use start_mission() to launch the clock' using errcode = '42501';
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists event_timers_guard on public.event_timers;
create trigger event_timers_guard before update or delete on public.event_timers
  for each row execute function public.tg_event_timers_guard();

-- Milestone schedule (offset/enabled, insert/delete) is locked after launch.
-- Copy (title, description, announcement, icon, theme) may still change.
create or replace function public.tg_milestones_guard() returns trigger
language plpgsql as $$
declare
  ev uuid := coalesce(new.event_id, old.event_id);
  st public.timer_state;
begin
  select state into st from public.event_timers where event_id = ev;
  if st is not null and st <> 'NOT_STARTED' then
    if tg_op in ('INSERT', 'DELETE') then
      raise exception 'Milestone schedule is locked after launch' using errcode = '42501';
    end if;
    if new.offset_seconds is distinct from old.offset_seconds
       or new.enabled is distinct from old.enabled
       or new.event_id is distinct from old.event_id then
      raise exception 'Milestone timing is locked after launch' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists milestones_guard on public.timer_milestones;
create trigger milestones_guard before insert or update or delete on public.timer_milestones
  for each row execute function public.tg_milestones_guard();

-- =============================================================================
-- Helpers
-- =============================================================================

create or replace function public.staff_role(p_event_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.event_staff where event_id = p_event_id and user_id = auth.uid()
$$;

create or replace function public.require_role(p_event_id uuid, p_roles text[]) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r text;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select role into r from public.event_staff where event_id = p_event_id and user_id = uid;
  if r is null or not (r = any (p_roles)) then
    raise exception 'Not authorised for this mission' using errcode = '42501';
  end if;
  return uid;
end $$;

create or replace function public.enforce_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  w timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  if uid is null then return; end if;
  insert into public.admin_rate_limits (actor_id, action, window_start, hits)
  values (uid, p_action, w, 1)
  on conflict (actor_id, action, window_start) do update set hits = admin_rate_limits.hits + 1
  returning hits into n;
  if n > p_max then
    raise exception 'Rate limit exceeded for %', p_action using errcode = '54000';
  end if;
  -- opportunistic cleanup
  delete from public.admin_rate_limits where window_start < now() - interval '1 day';
end $$;

create or replace function public.write_audit(p_event_id uuid, p_action text, p_reason text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.timer_audit_log (event_id, actor_id, action, reason, details)
  values (p_event_id, auth.uid(), p_action, p_reason, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.clean_text(p text, p_max integer) returns text
language sql immutable as $$
  -- strip control characters (keep normal whitespace), collapse, trim.
  select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'), '\s+', ' ', 'g')), p_max), '')
$$;

-- =============================================================================
-- Public read model: effective state is computed against the DB clock, so the
-- event is COMPLETED the moment its deadline passes, with no browser involved.
-- =============================================================================
create or replace view public.mission_clock
with (security_invoker = true) as
select
  t.event_id,
  case
    when t.state = 'RUNNING' and now() >= t.ends_at then 'COMPLETED'::public.timer_state
    else t.state
  end as state,
  t.duration_seconds,
  t.started_at,
  t.ends_at,
  case
    when t.state = 'RUNNING' and now() >= t.ends_at then t.ends_at
    else t.completed_at
  end as completed_at,
  t.held_at,
  t.held_remaining_ms,
  t.override_enabled,
  t.display_mode,
  t.sound_enabled,
  t.closing_message,
  t.version,
  t.updated_at,
  now() as server_now
from public.event_timers t;

-- =============================================================================
-- Mutations (SECURITY DEFINER, validated, rate-limited, audited)
-- =============================================================================

-- Idempotent: persists COMPLETED once the deadline has passed. Safe for anyone
-- to call; it can only ever do the one correct thing. completed_at = ends_at,
-- so repeated calls never change the record or duplicate audit entries.
create or replace function public.finalize_mission(p_event_id uuid)
returns setof public.mission_clock
language plpgsql security definer set search_path = public as $$
declare
  changed integer;
begin
  perform set_config('mission.privileged', 'on', true);
  update public.event_timers
     set state = 'COMPLETED', completed_at = ends_at
   where event_id = p_event_id and state = 'RUNNING' and ends_at <= now();
  get diagnostics changed = row_count;
  perform set_config('mission.privileged', 'off', true);
  if changed > 0 then
    insert into public.timer_audit_log (event_id, actor_id, action, details)
    values (p_event_id, null, 'MISSION_COMPLETED', jsonb_build_object('source', 'deadline'));
  end if;
  return query select * from public.mission_clock where event_id = p_event_id;
end $$;

-- Finalise every overdue mission (used by pg_cron when available).
create or replace function public.finalize_overdue_missions() returns integer
language plpgsql security definer set search_path = public as $$
declare
  ev record; n integer := 0;
begin
  for ev in select event_id from public.event_timers where state = 'RUNNING' and ends_at <= now() loop
    perform public.finalize_mission(ev.event_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- START MISSION. Atomic: one conditional UPDATE under a row lock.
-- Duplicate or concurrent calls return the already-committed deadline.
create or replace function public.start_mission(p_event_id uuid)
returns setof public.mission_clock
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  changed integer;
begin
  uid := public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('start_mission', 10, 60);

  perform 1 from public.event_timers where event_id = p_event_id for update;
  if not found then
    raise exception 'Mission clock not configured for this event' using errcode = 'P0002';
  end if;

  perform set_config('mission.privileged', 'on', true);
  update public.event_timers
     set state      = 'RUNNING',
         started_at = now(),
         ends_at    = now() + make_interval(secs => duration_seconds),
         started_by = uid
   where event_id = p_event_id and state = 'NOT_STARTED';
  get diagnostics changed = row_count;
  perform set_config('mission.privileged', 'off', true);

  if changed > 0 then
    insert into public.timer_audit_log (event_id, actor_id, action, details)
    select p_event_id, uid, 'MISSION_STARTED',
           jsonb_build_object('started_at', started_at, 'ends_at', ends_at, 'duration_seconds', duration_seconds)
      from public.event_timers where event_id = p_event_id;
  else
    insert into public.timer_audit_log (event_id, actor_id, action, details)
    values (p_event_id, uid, 'START_IGNORED', jsonb_build_object('note', 'mission already launched'));
  end if;

  return query select * from public.mission_clock where event_id = p_event_id;
end $$;

-- Pre-launch configuration + always-editable presentation settings.
create or replace function public.configure_mission(
  p_event_id uuid,
  p_name text default null,
  p_subtitle text default null,
  p_tagline text default null,
  p_duration_seconds integer default null,
  p_closing_message text default null,
  p_sound_enabled boolean default null,
  p_display_mode text default null
) returns setof public.mission_clock
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  st public.timer_state;
begin
  uid := public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('configure_mission', 60, 60);
  select state into st from public.event_timers where event_id = p_event_id for update;

  if p_duration_seconds is not null then
    if st <> 'NOT_STARTED' then
      raise exception 'Duration is locked after launch' using errcode = '42501';
    end if;
    if p_duration_seconds < 60 or p_duration_seconds > 172800 then
      raise exception 'Duration must be between 1 minute and 48 hours' using errcode = '22023';
    end if;
  end if;
  if p_display_mode is not null and p_display_mode not in ('cinematic', 'minimal', 'command') then
    raise exception 'Unknown display mode' using errcode = '22023';
  end if;

  update public.events set
    name       = coalesce(public.clean_text(p_name, 80), name),
    subtitle   = coalesce(public.clean_text(p_subtitle, 60), subtitle),
    tagline    = coalesce(public.clean_text(p_tagline, 140), tagline),
    updated_at = now()
  where id = p_event_id;

  update public.event_timers set
    duration_seconds = coalesce(p_duration_seconds, duration_seconds),
    closing_message  = coalesce(public.clean_text(p_closing_message, 200), closing_message),
    sound_enabled    = coalesce(p_sound_enabled, sound_enabled),
    display_mode     = coalesce(p_display_mode, display_mode)
  where event_id = p_event_id;

  perform public.write_audit(p_event_id, 'CONFIGURED', null, jsonb_strip_nulls(jsonb_build_object(
    'name', p_name, 'subtitle', p_subtitle, 'tagline', p_tagline, 'duration_seconds', p_duration_seconds,
    'closing_message', p_closing_message, 'sound_enabled', p_sound_enabled, 'display_mode', p_display_mode)));

  return query select * from public.mission_clock where event_id = p_event_id;
end $$;

create or replace function public.upsert_milestone(
  p_event_id uuid,
  p_id uuid,
  p_offset_seconds integer,
  p_title text,
  p_description text,
  p_icon text,
  p_theme text,
  p_announcement text,
  p_enabled boolean
) returns public.timer_milestones
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  m public.timer_milestones;
begin
  uid := public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('milestone', 120, 60);

  if p_id is null then
    insert into public.timer_milestones (event_id, offset_seconds, title, description, icon, theme, announcement, enabled)
    values (p_event_id, p_offset_seconds, public.clean_text(p_title, 60), coalesce(public.clean_text(p_description, 280), ''),
            p_icon, p_theme, public.clean_text(p_announcement, 280), coalesce(p_enabled, true))
    returning * into m;
  else
    update public.timer_milestones set
      offset_seconds = coalesce(p_offset_seconds, offset_seconds),
      title          = coalesce(public.clean_text(p_title, 60), title),
      description    = coalesce(public.clean_text(p_description, 280), ''),
      icon           = p_icon,
      theme          = p_theme,
      announcement   = public.clean_text(p_announcement, 280),
      enabled        = coalesce(p_enabled, enabled)
    where id = p_id and event_id = p_event_id
    returning * into m;
    if m.id is null then
      raise exception 'Milestone not found' using errcode = 'P0002';
    end if;
  end if;

  perform public.write_audit(p_event_id, 'MILESTONE_SAVED', null, to_jsonb(m));
  return m;
end $$;

create or replace function public.delete_milestone(p_event_id uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('milestone', 120, 60);
  delete from public.timer_milestones where id = p_id and event_id = p_event_id;
  perform public.write_audit(p_event_id, 'MILESTONE_DELETED', null, jsonb_build_object('id', p_id));
end $$;

create or replace function public.publish_announcement(
  p_event_id uuid,
  p_message text,
  p_priority text default 'normal',
  p_display_seconds integer default 20,
  p_publish_at timestamptz default null,
  p_expires_at timestamptz default null
) returns public.timer_announcements
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  a public.timer_announcements;
  msg text := public.clean_text(p_message, 280);
  pub timestamptz := greatest(coalesce(p_publish_at, now()), now());
begin
  uid := public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('announcement', 30, 60);
  if msg is null then
    raise exception 'Announcement message is required' using errcode = '22023';
  end if;
  if pub > now() + interval '48 hours' then
    raise exception 'Announcements can be scheduled at most 48 hours ahead' using errcode = '22023';
  end if;
  insert into public.timer_announcements (event_id, message, priority, display_seconds, publish_at, expires_at, created_by)
  values (p_event_id, msg, coalesce(p_priority, 'normal'), coalesce(p_display_seconds, 20), pub, p_expires_at, uid)
  returning * into a;
  perform public.write_audit(p_event_id, 'ANNOUNCEMENT_PUBLISHED', null, to_jsonb(a));
  return a;
end $$;

create or replace function public.cancel_announcement(p_event_id uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('announcement', 30, 60);
  update public.timer_announcements set cancelled_at = now()
   where id = p_id and event_id = p_event_id and cancelled_at is null;
  perform public.write_audit(p_event_id, 'ANNOUNCEMENT_CANCELLED', null, jsonb_build_object('id', p_id));
end $$;

-- Owner-only: arm / disarm the emergency override. Requires a fresh sign-in.
create or replace function public.set_override_enabled(p_event_id uuid, p_enabled boolean, p_reason text)
returns setof public.mission_clock
language plpgsql security definer set search_path = public as $$
declare
  reason text := public.clean_text(p_reason, 500);
begin
  perform public.require_role(p_event_id, array['owner']);
  perform public.require_recent_auth(300);
  perform public.enforce_rate_limit('override', 10, 300);
  if reason is null or char_length(reason) < 10 then
    raise exception 'A reason of at least 10 characters is required' using errcode = '22023';
  end if;
  update public.event_timers set override_enabled = p_enabled where event_id = p_event_id;
  perform public.write_audit(p_event_id, case when p_enabled then 'OVERRIDE_ARMED' else 'OVERRIDE_DISARMED' end,
                             reason, '{}'::jsonb);
  return query select * from public.mission_clock where event_id = p_event_id;
end $$;

-- Reauthentication check: the caller's JWT must come from a sign-in within the
-- last p_max_age seconds (Supabase records sign-in time in the "amr" claim).
create or replace function public.require_recent_auth(p_max_age integer) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  ts bigint;
begin
  select max((elem->>'timestamp')::bigint) into ts
    from jsonb_array_elements(coalesce(claims->'amr', '[]'::jsonb)) elem
   where elem->>'method' in ('password', 'otp', 'magiclink', 'mfa/totp', 'totp');
  if ts is null or ts < extract(epoch from now()) - p_max_age then
    raise exception 'Re-authentication required' using errcode = '28000';
  end if;
end $$;

-- EMERGENCY OVERRIDE. Disabled by default. Requires override_admin/owner role,
-- override armed on the timer, a fresh sign-in, a written reason, and always
-- writes an immutable audit record of the before/after deadline.
--   HOLD    : freeze the clock (state -> EMERGENCY_OVERRIDE)
--   RESUME  : continue from the frozen remaining time (new ends_at)
--   ADJUST  : shift the deadline by p_delta_seconds (-3600 .. +7200)
create or replace function public.emergency_override(
  p_event_id uuid,
  p_action text,
  p_reason text,
  p_delta_seconds integer default null
) returns setof public.mission_clock
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  t public.event_timers;
  reason text := public.clean_text(p_reason, 500);
  new_end timestamptz;
  remaining bigint;
begin
  uid := public.require_role(p_event_id, array['override_admin', 'owner']);
  perform public.require_recent_auth(300);
  perform public.enforce_rate_limit('override', 10, 300);

  if reason is null or char_length(reason) < 10 then
    raise exception 'A reason of at least 10 characters is required' using errcode = '22023';
  end if;

  select * into t from public.event_timers where event_id = p_event_id for update;
  if not t.override_enabled then
    raise exception 'Emergency override is disabled for this mission' using errcode = '42501';
  end if;

  perform set_config('mission.privileged', 'on', true);

  if p_action = 'HOLD' then
    if t.state <> 'RUNNING' or t.ends_at <= now() then
      raise exception 'Only a running mission can be held' using errcode = '22023';
    end if;
    remaining := floor(extract(epoch from (t.ends_at - now())) * 1000);
    update public.event_timers
       set state = 'EMERGENCY_OVERRIDE', held_at = now(), held_remaining_ms = remaining
     where event_id = p_event_id;

  elsif p_action = 'RESUME' then
    if t.state <> 'EMERGENCY_OVERRIDE' then
      raise exception 'Mission is not on hold' using errcode = '22023';
    end if;
    new_end := now() + make_interval(secs => t.held_remaining_ms / 1000.0);
    update public.event_timers
       set state = 'RUNNING', ends_at = new_end, held_at = null, held_remaining_ms = null
     where event_id = p_event_id;

  elsif p_action = 'ADJUST' then
    if p_delta_seconds is null or p_delta_seconds = 0 or p_delta_seconds < -3600 or p_delta_seconds > 7200 then
      raise exception 'Adjustment must be between -3600 and +7200 seconds' using errcode = '22023';
    end if;
    if t.state = 'RUNNING' then
      new_end := t.ends_at + make_interval(secs => p_delta_seconds);
      if new_end <= now() then
        raise exception 'Adjustment would end the mission in the past' using errcode = '22023';
      end if;
      update public.event_timers set ends_at = new_end where event_id = p_event_id;
    elsif t.state = 'EMERGENCY_OVERRIDE' then
      if t.held_remaining_ms + p_delta_seconds::bigint * 1000 <= 0 then
        raise exception 'Adjustment would leave no time remaining' using errcode = '22023';
      end if;
      update public.event_timers
         set held_remaining_ms = held_remaining_ms + p_delta_seconds::bigint * 1000
       where event_id = p_event_id;
    else
      raise exception 'Mission must be running or on hold to adjust' using errcode = '22023';
    end if;
  else
    raise exception 'Unknown override action' using errcode = '22023';
  end if;

  perform set_config('mission.privileged', 'off', true);

  insert into public.timer_audit_log (event_id, actor_id, action, reason, details)
  select p_event_id, uid, 'EMERGENCY_' || p_action, reason,
         jsonb_build_object('before', jsonb_build_object('state', t.state, 'ends_at', t.ends_at, 'held_remaining_ms', t.held_remaining_ms),
                            'after',  jsonb_build_object('state', n.state, 'ends_at', n.ends_at, 'held_remaining_ms', n.held_remaining_ms),
                            'delta_seconds', p_delta_seconds)
    from public.event_timers n where n.event_id = p_event_id;

  return query select * from public.mission_clock where event_id = p_event_id;
end $$;

-- Integration hook: other modules (Problem Statement Arena, Goodies Selection
-- Arena, ...) can call this from their own RLS policies or functions so that a
-- deadline is enforced in the database, not just in a browser.
create or replace function public.is_module_open(p_event_id uuid, p_module_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
      from public.timer_module_integrations i
      join public.event_timers t on t.event_id = i.event_id
     where i.event_id = p_event_id
       and i.module_key = p_module_key
       and i.close_on_deadline
       and t.ends_at is not null
       and t.state <> 'EMERGENCY_OVERRIDE'
       and now() >= t.ends_at
  )
$$;

create or replace function public.set_module_integration(p_event_id uuid, p_module_key text, p_close_on_deadline boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role(p_event_id, array['host', 'override_admin', 'owner']);
  perform public.enforce_rate_limit('configure_mission', 60, 60);
  insert into public.timer_module_integrations (event_id, module_key, close_on_deadline)
  values (p_event_id, p_module_key, p_close_on_deadline)
  on conflict (event_id, module_key) do update set close_on_deadline = excluded.close_on_deadline, updated_at = now();
  perform public.write_audit(p_event_id, 'INTEGRATION_CONFIGURED', null,
    jsonb_build_object('module', p_module_key, 'close_on_deadline', p_close_on_deadline));
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.events                     enable row level security;
alter table public.event_staff                enable row level security;
alter table public.event_timers               enable row level security;
alter table public.timer_milestones           enable row level security;
alter table public.timer_announcements        enable row level security;
alter table public.timer_audit_log            enable row level security;
alter table public.admin_rate_limits          enable row level security;
alter table public.timer_module_integrations  enable row level security;

drop policy if exists "events are public" on public.events;
create policy "events are public" on public.events for select using (true);

drop policy if exists "staff see own membership" on public.event_staff;
create policy "staff see own membership" on public.event_staff for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "timer is public" on public.event_timers;
create policy "timer is public" on public.event_timers for select using (true);

drop policy if exists "milestones are public" on public.timer_milestones;
-- Disabled milestones and cancelled announcements stay readable (clients filter
-- them) so that Realtime can deliver the change to every screen.
create policy "milestones are public" on public.timer_milestones for select using (true);

drop policy if exists "announcements are public" on public.timer_announcements;
create policy "announcements are public" on public.timer_announcements for select using (true);

drop policy if exists "staff read audit" on public.timer_audit_log;
create policy "staff read audit" on public.timer_audit_log for select to authenticated
  using (public.staff_role(event_id) is not null);

drop policy if exists "integrations are public" on public.timer_module_integrations;
create policy "integrations are public" on public.timer_module_integrations for select using (true);

-- No write policies: every write goes through the functions above.
revoke insert, update, delete, truncate on public.events, public.event_staff, public.event_timers,
  public.timer_milestones, public.timer_announcements, public.timer_audit_log, public.admin_rate_limits,
  public.timer_module_integrations from anon, authenticated;
revoke all on public.admin_rate_limits from anon, authenticated;
grant select on public.events, public.event_timers, public.timer_milestones, public.timer_announcements,
  public.timer_module_integrations, public.mission_clock to anon, authenticated;
grant select on public.event_staff, public.timer_audit_log to authenticated;

-- Function privileges: internal helpers are not callable from the API.
revoke execute on function public.enforce_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.write_audit(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.require_role(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.require_recent_auth(integer) from public, anon, authenticated;
revoke execute on function public.finalize_overdue_missions() from public, anon, authenticated;

revoke execute on function public.start_mission(uuid) from public, anon;
revoke execute on function public.configure_mission(uuid, text, text, text, integer, text, boolean, text) from public, anon;
revoke execute on function public.upsert_milestone(uuid, uuid, integer, text, text, text, text, text, boolean) from public, anon;
revoke execute on function public.delete_milestone(uuid, uuid) from public, anon;
revoke execute on function public.publish_announcement(uuid, text, text, integer, timestamptz, timestamptz) from public, anon;
revoke execute on function public.cancel_announcement(uuid, uuid) from public, anon;
revoke execute on function public.set_override_enabled(uuid, boolean, text) from public, anon;
revoke execute on function public.emergency_override(uuid, text, text, integer) from public, anon;
revoke execute on function public.set_module_integration(uuid, text, boolean) from public, anon;

grant execute on function public.start_mission(uuid) to authenticated;
grant execute on function public.configure_mission(uuid, text, text, text, integer, text, boolean, text) to authenticated;
grant execute on function public.upsert_milestone(uuid, uuid, integer, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.delete_milestone(uuid, uuid) to authenticated;
grant execute on function public.publish_announcement(uuid, text, text, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_announcement(uuid, uuid) to authenticated;
grant execute on function public.set_override_enabled(uuid, boolean, text) to authenticated;
grant execute on function public.emergency_override(uuid, text, text, integer) to authenticated;
grant execute on function public.set_module_integration(uuid, text, boolean) to authenticated;
grant execute on function public.finalize_mission(uuid) to anon, authenticated;
grant execute on function public.is_module_open(uuid, text) to anon, authenticated;
grant execute on function public.staff_role(uuid) to anon, authenticated;

-- =============================================================================
-- Realtime + scheduled finalisation (only when available, e.g. on Supabase)
-- =============================================================================
do $$
declare tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array['event_timers', 'timer_milestones', 'timer_announcements', 'events'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'finalize-overdue-missions';
    perform cron.schedule('finalize-overdue-missions', '* * * * *', 'select public.finalize_overdue_missions()');
  end if;
end $$;
