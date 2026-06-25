create extension if not exists "uuid-ossp";

create type market_type as enum ('CN', 'HK', 'US');
create type direction_type as enum ('BUY', 'SELL');
create type currency_type as enum ('CNY', 'HKD', 'USD');

create table trades (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  market market_type not null,
  direction direction_type not null,
  quantity integer not null check (quantity > 0),
  price decimal(12,4) not null check (price > 0),
  currency currency_type not null,
  total_amount decimal(16,4) not null,
  trade_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table holdings (
  symbol text primary key,
  name text not null,
  market market_type not null,
  quantity integer not null default 0,
  avg_cost decimal(12,4) not null,
  total_cost decimal(16,4) not null,
  currency currency_type not null,
  updated_at timestamptz not null default now()
);

create index trades_symbol_idx on trades(symbol);
create index trades_trade_date_idx on trades(trade_date desc);
