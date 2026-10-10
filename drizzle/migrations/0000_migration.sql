create type public.app_role as enum ('admin','faculty','student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  roll_number text,
  email text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "staff read profiles" on public.profiles for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'faculty'));
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admin read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Admin role changes go through a checked function
create or replace function public.set_user_role(_user_id uuid, _role app_role)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles(user_id, role) values (_user_id, _role);
end $$;
revoke execute on function public.set_user_role(uuid, app_role) from public, anon;
grant execute on function public.set_user_role(uuid, app_role) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, roll_number, email)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'roll_number', new.email);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'student');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();