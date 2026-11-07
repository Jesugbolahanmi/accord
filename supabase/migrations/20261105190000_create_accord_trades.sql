create table if not exists public.accord_trades (
  id text primary key,
  reference text not null unique,
  trade jsonb not null check (jsonb_typeof(trade) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint accord_trades_payload_matches_keys
    check (trade ->> 'id' = id and trade ->> 'reference' = reference)
);

create index if not exists accord_trades_updated_at_idx
  on public.accord_trades (updated_at desc);

alter table public.accord_trades enable row level security;

revoke all on public.accord_trades from anon, authenticated;
grant all on public.accord_trades to service_role;
