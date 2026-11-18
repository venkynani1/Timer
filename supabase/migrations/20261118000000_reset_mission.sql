-- =============================================================================
-- Owner-only mission reset (for rehearsals or a botched launch).
--
-- Protected like the emergency override:
--   * owner role only
--   * the emergency override must be armed
--   * fresh sign-in (password re-entry within 5 minutes)
--   * written reason (>= 10 characters)
--   * rate limited and permanently audited (with the previous deadline)
-- Resetting returns the clock to NOT_STARTED, keeps duration, milestones,
-- announcements and settings, and disarms the override again.
-- =============================================================================

create or replace function mission_clock.reset_mission(p_event_id uuid, p_reason text)
returns setof mission_clock.mission_clock
language plpgsql security definer set search_path = mission_clock, pg_temp as $$
declare
  uid uuid;
  t mission_clock.event_timers;
  reason text := mission_clock.clean_text(p_reason, 500);
begin
  uid := mission_clock.require_role(p_event_id, array['owner']);
  perform mission_clock.require_recent_auth(300);
  perform mission_clock.enforce_rate_limit('override', 10, 300);

  if reason is null or char_length(reason) < 10 then
    raise exception 'A reason of at least 10 characters is required' using errcode = '22023';
  end if;

  select * into t from mission_clock.event_timers where event_id = p_event_id for update;
  if not found then
    raise exception 'Mission clock not configured for this event' using errcode = 'P0002';
  end if;
  if not t.override_enabled then
    raise exception 'Arm the emergency override before resetting the mission' using errcode = '42501';
  end if;
  if t.state = 'NOT_STARTED' then
    raise exception 'Mission has not been launched; nothing to reset' using errcode = '22023';
  end if;

  perform set_config('mission.privileged', 'on', true);
  update mission_clock.event_timers
     set state             = 'NOT_STARTED',
         started_at        = null,
         ends_at           = null,
         completed_at      = null,
         started_by        = null,
         held_at           = null,
         held_remaining_ms = null,
         override_enabled  = false
   where event_id = p_event_id;
  perform set_config('mission.privileged', 'off', true);

  insert into mission_clock.timer_audit_log (event_id, actor_id, action, reason, details)
  values (p_event_id, uid, 'MISSION_RESET', reason,
          jsonb_build_object('before', jsonb_build_object(
            'state', t.state, 'started_at', t.started_at, 'ends_at', t.ends_at,
            'completed_at', t.completed_at, 'held_remaining_ms', t.held_remaining_ms)));

  return query select * from mission_clock.mission_clock where event_id = p_event_id;
end $$;

revoke execute on function mission_clock.reset_mission(uuid, text) from public, anon;
grant execute on function mission_clock.reset_mission(uuid, text) to authenticated;
