-- ============================================================
-- GardenPay | migration 0008 | plots: owner + notes
-- ============================================================
-- Denormalizes the current owner onto plots for list/CRUD UX.
-- Full ownership/tenancy history stays in plot_assignments.
-- One member (owner_id -> members) can own many plots.

alter table plots
  add column owner_id uuid references members (id) on delete set null,
  add column notes    text;

create index plots_owner_idx on plots (owner_id) where owner_id is not null;

comment on column plots.owner_id is
  'Current plot owner (denormalized); history lives in plot_assignments';
comment on column plots.notes is 'Free-form notes about the plot';

-- Keep plot_assignments in sync with plots.owner_id:
-- close any open 'owner' assignment and open a new one for the new owner.
create or replace function public.sync_plot_owner_to_assignment()
returns trigger
language plpgsql
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    update plot_assignments
       set end_on = current_date
     where plot_id = new.id
       and end_on is null
       and relation = 'owner';

    if new.owner_id is not null then
      insert into plot_assignments (plot_id, member_id, relation, start_on)
      values (new.id, new.owner_id, 'owner', current_date);
    end if;
  end if;

  return new;
end;
$$;

create trigger plots_owner_sync
  before insert or update of owner_id on plots
  for each row execute function public.sync_plot_owner_to_assignment();