create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role public.app_role;
begin
  insert into public.profiles (id, full_name, roll_number, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'roll_number', ''),
    new.email
  );

  if not exists (select 1 from public.user_roles) then
    _role := 'admin';
  elsif new.raw_user_meta_data->>'requested_role' = 'faculty' then
    _role := 'faculty';
  else
    _role := 'student';
  end if;

  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end;
$$;