-- Drop all existing RLS policies on app tables
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('jobs', 'candidates', 'applications', 'profiles', 'user_roles')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (policyname ilike '%resume%' or qual ilike '%resumes%' or with_check ilike '%resumes%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Remove RBAC and profiles
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.job_owner(uuid) cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;
drop type if exists public.app_role cascade;

-- Ownership columns are no longer required
alter table public.jobs alter column user_id drop not null;
alter table public.candidates alter column user_id drop not null;
alter table public.applications alter column user_id drop not null;
alter table public.candidates alter column candidate_user_id drop not null;
alter table public.applications alter column candidate_user_id drop not null;

-- Open access (single shared, public workspace)
grant select, insert, update, delete on public.jobs to anon, authenticated;
grant select, insert, update, delete on public.candidates to anon, authenticated;
grant select, insert, update, delete on public.applications to anon, authenticated;
grant all on public.jobs to service_role;
grant all on public.candidates to service_role;
grant all on public.applications to service_role;

create policy "Public access to jobs" on public.jobs for all to anon, authenticated using (true) with check (true);
create policy "Public access to candidates" on public.candidates for all to anon, authenticated using (true) with check (true);
create policy "Public access to applications" on public.applications for all to anon, authenticated using (true) with check (true);

-- Resume storage open to everyone
create policy "Public resume read" on storage.objects for select to anon, authenticated using (bucket_id = 'resumes');
create policy "Public resume upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'resumes');
create policy "Public resume update" on storage.objects for update to anon, authenticated using (bucket_id = 'resumes') with check (bucket_id = 'resumes');
create policy "Public resume delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'resumes');