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
  and consent_public = true
  and consent_template = true
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

create or replace function public.enforce_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception '当前未登录，请先登录后再投稿。';
  end if;

  if new.user_id is distinct from v_user_id then
    raise exception '投稿用户标识不匹配。';
  end if;

  if new.consent_public is distinct from true or new.consent_template is distinct from true then
    raise exception '投稿前请先确认公开展示与模板授权。';
  end if;

  if new.status is distinct from 'uploaded' then
    raise exception '投稿状态不合法。';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select count(*) into v_count
  from public.mood_submissions ms
  where ms.user_id = v_user_id
    and ms.created_at >= now() - interval '1 hour';

  if v_count >= 10 then
    raise exception '你本小时投稿次数已达上限（10次），请稍后再试。';
  end if;

  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_comment := null;
  new.updated_at := coalesce(new.updated_at, now());

  return new;
end;
$$;

drop trigger if exists trg_enforce_submission_insert on public.mood_submissions;
create trigger trg_enforce_submission_insert
before insert on public.mood_submissions
for each row execute procedure public.enforce_submission_insert();

create or replace function public.prevent_submission_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception '不支持直接删除投稿，请使用撤回操作。';
end;
$$;

drop trigger if exists trg_prevent_submission_delete on public.mood_submissions;
create trigger trg_prevent_submission_delete
before delete on public.mood_submissions
for each row execute procedure public.prevent_submission_delete();

create or replace function public.submit_mood_submission(
  p_entry_date text,
  p_face jsonb,
  p_note text default null,
  p_share_caption text default null,
  p_consent_public boolean default false,
  p_consent_template boolean default false,
  p_is_anonymous boolean default false
)
returns public.mood_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count integer;
  v_row public.mood_submissions;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception '当前未登录，请先登录后再投稿。';
  end if;

  if p_consent_public is distinct from true or p_consent_template is distinct from true then
    raise exception '投稿前请先确认公开展示与模板授权。';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select count(*) into v_count
  from public.mood_submissions ms
  where ms.user_id = v_user_id
    and ms.created_at >= now() - interval '1 hour';

  if v_count >= 10 then
    raise exception '你本小时投稿次数已达上限（10次），请稍后再试。';
  end if;

  insert into public.mood_submissions (
    user_id,
    entry_date,
    face,
    note,
    share_caption,
    consent_public,
    consent_template,
    is_anonymous,
    status,
    review_comment,
    reviewed_by,
    reviewed_at
  )
  values (
    v_user_id,
    p_entry_date,
    p_face,
    nullif(btrim(coalesce(p_note, '')), ''),
    nullif(btrim(coalesce(p_share_caption, '')), ''),
    true,
    true,
    coalesce(p_is_anonymous, false),
    'uploaded',
    null,
    null,
    null
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.withdraw_submission(
  p_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.mood_submissions;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception '当前未登录，请先登录后再操作。';
  end if;

  select *
  into v_row
  from public.mood_submissions ms
  where ms.id = p_submission_id
    and ms.user_id = v_user_id
    and ms.status <> 'withdrawn'
  for update;

  if not found then
    raise exception '投稿不存在、已撤回，或无权限操作。';
  end if;

  update public.featured_templates ft
  set is_active = false
  where ft.source_submission_id = v_row.id
    and ft.is_active = true;

  update public.mood_submissions ms
  set
    status = 'withdrawn',
    review_comment = '用户已撤回投稿。',
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  where ms.id = v_row.id;
end;
$$;

grant usage on schema public to anon, authenticated;

grant select on table public.featured_templates to anon, authenticated;
grant select, insert, update, delete on table public.mood_entries to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.mood_submissions to authenticated;

create or replace function public.feature_submission(
  p_submission_id uuid,
  p_admin_id uuid,
  p_title text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.mood_submissions;
begin
  if not public.is_admin() then
    raise exception '当前账号不是管理员，无法进行精选审核。';
  end if;

  select *
  into v_submission
  from public.mood_submissions ms
  where ms.id = p_submission_id
  for update;

  if not found then
    raise exception '投稿不存在。';
  end if;

  if v_submission.consent_template is distinct from true then
    raise exception '该投稿未授权作为模板，无法入选。';
  end if;

  insert into public.featured_templates (
    source_submission_id,
    created_by,
    title,
    description,
    face,
    note,
    is_anonymous,
    is_active
  )
  values (
    v_submission.id,
    p_admin_id,
    coalesce(nullif(btrim(p_title), ''), '今日精选'),
    nullif(btrim(coalesce(p_description, '')), ''),
    v_submission.face,
    v_submission.note,
    coalesce(v_submission.is_anonymous, false),
    true
  );

  update public.mood_submissions ms
  set
    status = 'featured',
    review_comment = '已入选模板库，感谢你的投稿。',
    reviewed_by = p_admin_id,
    reviewed_at = now(),
    updated_at = now()
  where ms.id = v_submission.id;
end;
$$;

grant execute on function public.feature_submission(uuid, uuid, text, text) to authenticated;

grant execute on function public.submit_mood_submission(
  text,
  jsonb,
  text,
  text,
  boolean,
  boolean,
  boolean
) to authenticated;
grant execute on function public.withdraw_submission(uuid) to authenticated;
