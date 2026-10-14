-- ============================================================
-- GardenPay | migration 0006 | seed data
-- ============================================================

insert into roles (code, name, description, is_system) values
  ('member',       'Member',         'Plot holder, self-service access',     true),
  ('workday_lead', 'Workday Lead',   'Coordinates workdays and tasks',       true),
  ('treasurer',    'Treasurer',      'Full finance permissions',             true),
  ('board',        'Board Member',   'Reads all, manages members and plots', true),
  ('admin',        'Administrator',  'Users, roles, settings, audit',        true),
  ('auditor',      'Auditor',        'Read-only finance and reports',        true)
on conflict (code) do nothing;

insert into contribution_types (code, name, kind, billing_mode, meter_kind, sort_order) values
  ('membership_fee', 'Membership fee',     'membership_fee', 'periodic', null,              10),
  ('plot_rent',      'Plot rent',          'plot_rent',      'periodic', null,              20),
  ('water',          'Water consumption',  'water',          'metered',  'water',           30),
  ('electricity',    'Electricity',        'electricity',    'metered',  'electricity',     40),
  ('late_fee',       'Late payment fee',   'penalty',        'manual',   null,              50),
  ('special_levy',   'Special assessment', 'one_time',       'manual',   null,              60)
on conflict (code) do nothing;
