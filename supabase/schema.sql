create table if not exists public.mood_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  face jsonb not null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.mood_entries enable row level security;

create policy "users_can_select_own_mood_entries"
on public.mood_entries
for select
using (auth.uid() = user_id);

create policy "users_can_insert_own_mood_entries"
on public.mood_entries
for insert
with check (auth.uid() = user_id);

create policy "users_can_update_own_mood_entries"
on public.mood_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users_can_delete_own_mood_entries"
on public.mood_entries
for delete
using (auth.uid() = user_id);

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

create policy "users_can_select_own_profile"
on public.profiles
for select
using (auth.uid() = user_id);

create policy "users_can_insert_own_profile"
on public.profiles
for insert
with check (auth.uid() = user_id and role = 'user');

create policy "users_can_update_own_profile"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and role = 'user');

create policy "admins_can_manage_profiles"
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.mood_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date text not null,
  face jsonb not null,
  note text null,
  share_caption text null,
  consent_public boolean not null default false,
  consent_template boolean not null default false,
  status text not null default 'uploaded' check (status in ('uploaded', 'approved', 'rejected', 'featured', 'withdrawn')),
  review_comment text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mood_submissions
add column if not exists is_anonymous boolean not null default false;

create index if not exists mood_submissions_user_idx on public.mood_submissions(user_id, created_at desc);
create index if not exists mood_submissions_status_idx on public.mood_submissions(status, created_at desc);

alter table public.mood_submissions enable row level security;

create policy "users_can_select_own_submissions"
on public.mood_submissions
for select
using (auth.uid() = user_id);

create policy "users_can_insert_own_submissions"
on public.mood_submissions
for insert
with check (
  auth.uid() = user_id
  and status = 'uploaded'
  and reviewed_by is null
  and reviewed_at is null
);

create policy "users_can_delete_own_submissions"
on public.mood_submissions
for delete
using (auth.uid() = user_id);

create policy "admins_can_manage_submissions"
on public.mood_submissions
for all
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.featured_templates (
  id uuid primary key default gen_random_uuid(),
  source_submission_id uuid null references public.mood_submissions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null default '今日精选',
  description text null,
  face jsonb not null,
  note text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.featured_templates
add column if not exists is_anonymous boolean not null default false;

create index if not exists featured_templates_active_idx on public.featured_templates(is_active, created_at desc);

alter table public.featured_templates enable row level security;

create policy "public_can_select_active_featured_templates"
on public.featured_templates
for select
using (is_active = true);

create policy "admins_can_manage_featured_templates"
on public.featured_templates
for all
using (public.is_admin())
with check (public.is_admin());
