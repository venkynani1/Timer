-- Grant mission staff roles. Run in the Supabase SQL editor (as the project owner).
-- First create the user under Authentication → Users (email + password).
--
--   host            configure, start, milestones, announcements, display, integrations
--   override_admin  host + emergency override (only once an owner arms it)
--   owner           override_admin + arm/disarm the emergency override

insert into public.event_staff (event_id, user_id, role)
select e.id, u.id, 'host'                       -- ← role
from public.events e, auth.users u
where e.slug = 'designathon-x'
  and u.email = 'host@your-domain.example'      -- ← user
on conflict (event_id, user_id) do update set role = excluded.role;

-- Review staff:
-- select u.email, s.role from public.event_staff s join auth.users u on u.id = s.user_id;
