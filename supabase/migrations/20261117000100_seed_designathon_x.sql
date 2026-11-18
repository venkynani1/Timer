-- Seed: the Designathon X event, its 12-hour mission clock and default milestones.
-- Safe to re-run; it never touches a clock that has already launched.

insert into mission_clock.events (slug, name, subtitle, tagline)
values ('designathon-x', 'DESIGNATHON X', 'THE FINAL 12', '12 Hours. One Mission. Infinite Possibilities.')
on conflict (slug) do nothing;

insert into mission_clock.event_timers (event_id)
select id from mission_clock.events where slug = 'designathon-x'
on conflict (event_id) do nothing;

insert into mission_clock.timer_milestones (event_id, offset_seconds, title, description, icon, theme, announcement)
select e.id, m.offset_seconds, m.title, m.description, m.icon, m.theme, m.announcement
from mission_clock.events e
cross join (values
  (0,     'IGNITION',         'The mission clock is live. Form up, align, and lock your mission objective.', 'rocket',        'cyan',   'Mission is live. Twelve hours start now.'),
  (3600,  'DISCOVERY',        'Research the problem space. Talk to mentors. Map the users.',                 'telescope',     'cyan',   'Discovery phase has begun.'),
  (10800, 'IDEATION',         'Diverge, then converge. Choose the idea worth building.',                     'lightbulb',     'blue',   'Ideation phase has begun.'),
  (18000, 'BUILD MODE',       'Design systems, prototypes, flows. Make it real.',                            'hammer',        'violet', 'Build mode engaged.'),
  (32400, 'REFINEMENT',       'Polish, test with real people, tighten the story.',                           'sparkles',      'amber',  'Refinement phase has begun.'),
  (39600, 'FINAL PUSH',       'One hour left. Finish, rehearse, and prepare your submission.',               'flame',         'orange', 'The final hour has begun.'),
  (43200, 'MISSION COMPLETE', 'Pencils down. Submissions are closed.',                                       'flag',          'green',  null)
) as m(offset_seconds, title, description, icon, theme, announcement)
where e.slug = 'designathon-x'
  and not exists (select 1 from mission_clock.timer_milestones tm where tm.event_id = e.id);
