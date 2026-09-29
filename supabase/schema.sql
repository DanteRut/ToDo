-- Momentum cloud storage. Run once in Supabase → SQL Editor.
create table if not exists public.records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists records_user_updated_idx
  on public.records (user_id, updated_at desc);

alter table public.records enable row level security;

create policy "Users can read their own records"
  on public.records for select
  using (auth.uid() = user_id);

create policy "Users can insert their own records"
  on public.records for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own records"
  on public.records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own records"
  on public.records for delete
  using (auth.uid() = user_id);

-- Safe to run even if the table is already in the realtime publication.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception
  when duplicate_object then null;
end $$;
