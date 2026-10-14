-- ============================================================
-- GardenPay | seed.sql | sample data (development / test)
-- Entities: contribution_types, plots, members, tariffs
-- Idempotent: safe to re-run (on conflict do nothing)
-- Loaded automatically by `supabase db reset`
--   (config.toml -> [db.seed] sql_paths = ["supabase/seed.sql"])
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONTRIBUTION TYPES (8)
-- ------------------------------------------------------------
insert into contribution_types (code, name, kind, billing_mode, meter_kind, sort_order) values
  ('membership_fee',  'Membership fee',      'membership_fee', 'periodic', null,          10),
  ('plot_rent',       'Plot rent',           'plot_rent',      'periodic', null,          20),
  ('water',           'Water consumption',   'water',          'metered',  'water',       30),
  ('electricity',     'Electricity',         'electricity',    'metered',  'electricity', 40),
  ('late_fee',        'Late payment fee',    'penalty',        'manual',   null,          50),
  ('special_levy',    'Special assessment',  'one_time',       'manual',   null,          60),
  ('entrance_fee',    'Entrance fee',        'one_time',       'manual',   null,          70),
  ('equipment_rental','Equipment rental',    'other',          'manual',   null,          80)
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. PLOTS (24)
-- ------------------------------------------------------------
insert into plots (plot_no, area_m2, zone, soil_type, status) values
  ('A-01', 180.00, 'A', 'loam',    'allocated'),
  ('A-02', 220.50, 'A', 'loam',    'allocated'),
  ('A-03', 245.00, 'A', 'clay',    'free'),
  ('A-04', 260.75, 'A', 'clay',    'free'),
  ('B-01', 310.00, 'B', 'sand',    'allocated'),
  ('B-02', 315.25, 'B', 'sand',    'free'),
  ('B-03', 322.00, 'B', 'loam',    'free'),
  ('B-04', 340.50, 'B', 'loam',    'reserved'),
  ('C-01', 400.00, 'C', 'peat',    'allocated'),
  ('C-02', 410.00, 'C', 'peat',    'free'),
  ('C-03', 418.75, 'C', 'mixed',   'free'),
  ('C-04', 425.00, 'C', 'mixed',   'free'),
  ('D-01', 150.00, 'D', 'loam',    'free'),
  ('D-02', 155.50, 'D', 'loam',    'free'),
  ('D-03', 160.00, 'D', 'sand',    'out_of_service'),
  ('D-04', 168.25, 'D', 'sand',    'free'),
  ('E-01', 500.00, 'E', 'clay',    'allocated'),
  ('E-02', 512.00, 'E', 'clay',    'reserved'),
  ('E-03', 520.50, 'E', 'mixed',   'free'),
  ('E-04', 530.00, 'E', 'mixed',   'free'),
  ('F-01', 620.00, 'F', 'loam',    'free'),
  ('F-02', 625.75, 'F', 'loam',    'free'),
  ('F-03', 640.00, 'F', 'peat',    'free'),
  ('F-04', 650.25, 'F', 'peat',    'free')
on conflict (plot_no) do nothing;

-- ------------------------------------------------------------
-- 3. MEMBERS (24)
-- ------------------------------------------------------------
insert into members (member_no, first_name, last_name, email, phone, kind, status, joined_on, left_on) values
  ('M-0001', 'Anna',      'Mueller',  'm01@beispiel.test',  '+49 151 1000001', 'full',     'active',   '2012-03-15', null),
  ('M-0002', 'Klaus',     'Schmidt',  'm02@beispiel.test',  '+49 151 1000002', 'full',     'active',   '2013-04-01', null),
  ('M-0003', 'Sabine',    'Weber',    'm03@beispiel.test',  '+49 151 1000003', 'full',     'active',   '2014-05-20', null),
  ('M-0004', 'Thomas',    'Fischer',  'm04@beispiel.test',  '+49 151 1000004', 'full',     'active',   '2015-06-10', null),
  ('M-0005', 'Birgit',    'Wagner',   'm05@beispiel.test',  '+49 151 1000005', 'full',     'active',   '2016-02-28', null),
  ('M-0006', 'Michael',   'Becker',   'm06@beispiel.test',  '+49 151 1000006', 'full',     'active',   '2016-07-12', null),
  ('M-0007', 'Claudia',   'Hoffmann', 'm07@beispiel.test',  '+49 151 1000007', 'full',     'active',   '2017-03-03', null),
  ('M-0008', 'Stefan',    'Schaefer', 'm08@beispiel.test',  '+49 151 1000008', 'full',     'active',   '2017-09-18', null),
  ('M-0009', 'Petra',     'Koch',     'm09@beispiel.test',  '+49 151 1000009', 'full',     'active',   '2018-01-25', null),
  ('M-0010', 'Andreas',   'Richter',  'm10@beispiel.test',  '+49 151 1000010', 'full',     'active',   '2018-04-14', null),
  ('M-0011', 'Julia',     'Klein',    'm11@beispiel.test',  '+49 151 1000011', 'full',     'active',   '2019-05-06', null),
  ('M-0012', 'Markus',    'Wolf',     'm12@beispiel.test',  '+49 151 1000012', 'full',     'active',   '2019-08-30', null),
  ('M-0013', 'Silke',     'Schroeder', 'm13@beispiel.test', '+49 151 1000013', 'full',     'active',   '2020-03-11', null),
  ('M-0014', 'Daniel',    'Neumann',  'm14@beispiel.test',  '+49 151 1000014', 'full',     'active',   '2020-10-02', null),
  ('M-0015', 'Martina',   'Schwarz',  'm15@beispiel.test',  '+49 151 1000015', 'full',     'active',   '2021-04-19', null),
  ('M-0016', 'Jens',      'Zimmermann', 'm16@beispiel.test', '+49 151 1000016', 'full',    'active',   '2021-11-08', null),
  ('M-0017', 'Heike',     'Braun',    'm17@beispiel.test',  '+49 151 1000017', 'tenant',   'active',   '2022-03-21', null),
  ('M-0018', 'Frank',     'Krueger',  'm18@beispiel.test',  '+49 151 1000018', 'tenant',   'active',   '2022-06-13', null),
  ('M-0019', 'Susanne',   'Hofmann',  'm19@beispiel.test',  '+49 151 1000019', 'tenant',   'suspended', '2023-02-09', null),
  ('M-0020', 'Bernd',     'Hartmann', 'm20@beispiel.test',  '+49 151 1000020', 'tenant',   'lapsed',   '2019-07-01', '2025-11-30'),
  ('M-0021', 'Katrin',    'Lange',    'm21@beispiel.test',  '+49 151 1000021', 'associate', 'active',  '2023-05-17', null),
  ('M-0022', 'Uwe',       'Schmitt',  'm22@beispiel.test',  '+49 151 1000022', 'associate', 'pending', '2026-01-12', null),
  ('M-0023', 'Nadine',    'Werner',   'm23@beispiel.test',  '+49 151 1000023', 'associate', 'active',  '2024-09-04', null),
  ('M-0024', 'Georg',     'Schmitz',  'm24@beispiel.test',  '+49 151 1000024', 'honorary',  'active',  '2010-05-22', null)
on conflict (member_no) do nothing;

-- ------------------------------------------------------------
-- 4. TARIFFS (14) — linked to contribution types by code
--    validity windows never overlap per (contribution type, unit)
-- ------------------------------------------------------------
insert into tariffs (contribution_type_id, name, unit, amount_minor, currency, valid_from, valid_to)
select ct.id, v.name, v.unit, v.amount_minor, v.currency, v.valid_from, v.valid_to
  from contribution_types ct
  join (values
    ('membership_fee',   'Annual membership fee 2020-2024', 'fixed', 2200,  'EUR', date '2020-01-01', date '2024-12-31'),
    ('membership_fee',   'Annual membership fee 2025+',     'fixed', 2500,  'EUR', date '2025-01-01', null),
    ('plot_rent',        'Plot rent per m2 2020-2024',      'm2',    160,   'EUR', date '2020-01-01', date '2024-12-31'),
    ('plot_rent',        'Plot rent per m2 2025+',          'm2',    180,   'EUR', date '2025-01-01', null),
    ('water',            'Water per m3 2020-2024',          'm3',    190,   'EUR', date '2020-01-01', date '2024-12-31'),
    ('water',            'Water per m3 2025+',              'm3',    220,   'EUR', date '2025-01-01', null),
    ('water',            'Water standing charge 2025+',     'fixed', 500,   'EUR', date '2025-01-01', null),
    ('electricity',      'Electricity per kWh 2020-2024',   'kwh',   290,   'EUR', date '2020-01-01', date '2024-12-31'),
    ('electricity',      'Electricity per kWh 2025+',       'kwh',   320,   'EUR', date '2025-01-01', null),
    ('electricity',      'Electricity standing charge 2025+','fixed', 800,  'EUR', date '2025-01-01', null),
    ('late_fee',         'Late payment fee',                'fixed', 500,   'EUR', date '2020-01-01', null),
    ('special_levy',     'Special assessment 2026 roof repair','fixed', 5000, 'EUR', date '2026-01-01', null),
    ('entrance_fee',     'Entrance fee',                    'fixed', 10000, 'EUR', date '2020-01-01', null),
    ('equipment_rental', 'Equipment rental per hour',       'hour',  500,   'EUR', date '2020-01-01', null)
  ) as v(code, name, unit, amount_minor, currency, valid_from, valid_to)
    on v.code = ct.code
on conflict (contribution_type_id, unit, valid_from) do nothing;
