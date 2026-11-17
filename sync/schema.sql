-- PLATFORM synchronization schema (PREPARATION ONLY; do not deploy without owner approval).
-- Run only on a dedicated active Supabase project.
create table if not exists public.platform_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('reader','editor','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.platform_catalog (
  id text primary key check (id = 'main'),
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table if not exists public.platform_catalog_history (
  id bigint generated always as identity primary key,
  revision bigint not null,
  payload jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);
alter table public.platform_members enable row level security;
alter table public.platform_catalog enable row level security;
alter table public.platform_catalog_history enable row level security;
revoke all on public.platform_members from anon, authenticated;
revoke all on public.platform_catalog_history from anon, authenticated;
revoke all on public.platform_catalog from anon;
grant select on public.platform_catalog to authenticated;
create policy platform_catalog_read on public.platform_catalog
  for select to authenticated
  using (exists (select 1 from public.platform_members m where m.user_id=(select auth.uid())));
-- Write RPC: compare-and-swap prevents silent loss of concurrent edits.
create or replace function public.platform_save_catalog(expected_revision bigint, next_payload jsonb)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare next_revision bigint;
begin
  if not exists(select 1 from public.platform_members
    where user_id=(select auth.uid()) and role in ('editor','admin')) then
    raise exception 'Not authorized to edit the platform catalog';
  end if;
  if next_payload is null or jsonb_typeof(next_payload)<>'object' or pg_column_size(next_payload)>1048576 then
    raise exception 'Invalid catalog payload';
  end if;
  -- Revisions are verified atomically; readers must not overwrite a newer revision.
  update public.platform_catalog
     set payload=next_payload, revision=revision+1, updated_at=now(),
         updated_by=(select auth.uid())
   where id='main' and revision=expected_revision
   returning revision into next_revision;
  if next_revision is null then raise exception 'Catalog revision conflict; reload and merge changes'; end if;
  insert into public.platform_catalog_history(revision,payload,changed_by)
    values (next_revision,next_payload,(select auth.uid()));
  return next_revision;
end; $$;
revoke all on function public.platform_save_catalog(bigint,jsonb) from public,anon;
grant execute on function public.platform_save_catalog(bigint,jsonb) to authenticated;
-- IMPORTANT: With SECURITY INVOKER, UPDATE policy is required.
create policy platform_catalog_write on public.platform_catalog for update to authenticated
using (exists(select 1 from public.platform_members m where m.user_id=(select auth.uid()) and m.role in ('editor','admin')))
with check (exists(select 1 from public.platform_members m where m.user_id=(select auth.uid()) and m.role in ('editor','admin')));
-- History insert must be permitted for verified editors.
grant insert on public.platform_catalog_history to authenticated;
create policy platform_history_add on public.platform_catalog_history for insert to authenticated
with check(changed_by=(select auth.uid()) and exists(select 1 from public.platform_members m where m.user_id=(select auth.uid()) and m.role in ('editor','admin')));
-- Administrator must provision member rows through a trusted admin session,
-- not by granting public insert permission. Bootstrap main row in SQL after importing backups.
