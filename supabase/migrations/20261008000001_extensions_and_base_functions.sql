-- ============================================================
-- GardenPay | migration 0001 | extensions + base helpers
-- Supabase: Postgres 15+
-- ============================================================

create extension if not exists pgcrypto;    -- gen_random_uuid()
create extension if not exists btree_gist;  -- exclusion constraints (tariffs validity)

-- ------------------------------------------------------------
-- updated_at maintenance (used by later migrations)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: stamps updated_at = now()';
