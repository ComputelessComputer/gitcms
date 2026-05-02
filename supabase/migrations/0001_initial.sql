create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  name text not null,
  folder text not null default '',
  mime_type text not null,
  size bigint not null default 0,
  public_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_folder_idx on public.media_assets (folder);

insert into storage.buckets (id, name, public)
values ('gitcms-media', 'gitcms-media', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'gitcms media public read'
  ) then
    create policy "gitcms media public read"
    on storage.objects for select
    using (bucket_id = 'gitcms-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'gitcms media service write'
  ) then
    create policy "gitcms media service write"
    on storage.objects for all
    using (bucket_id = 'gitcms-media')
    with check (bucket_id = 'gitcms-media');
  end if;
end $$;
