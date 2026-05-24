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
