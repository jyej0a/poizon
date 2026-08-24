create table if not exists public.source_offer_cache (
  article_number text primary key,
  offers jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists source_offer_cache_expires_at_idx
  on public.source_offer_cache (expires_at);

create table if not exists public.poizon_spu_cache (
  spu_id text not null,
  region text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (spu_id, region)
);

create index if not exists poizon_spu_cache_expires_at_idx
  on public.poizon_spu_cache (expires_at);

alter table public.source_offer_cache enable row level security;
alter table public.poizon_spu_cache enable row level security;

drop policy if exists "service role manages source offer cache" on public.source_offer_cache;
create policy "service role manages source offer cache"
  on public.source_offer_cache
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role manages poizon spu cache" on public.poizon_spu_cache;
create policy "service role manages poizon spu cache"
  on public.poizon_spu_cache
  for all
  to service_role
  using (true)
  with check (true);
