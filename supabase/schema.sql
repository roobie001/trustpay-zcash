-- TrustPay shielded Zcash escrow schema.
create extension if not exists pgcrypto;

create table if not exists escrow_orders (
  id uuid primary key default gen_random_uuid(),
  item_title text not null,
  amount numeric not null,
  delivery_fee numeric not null default 0,
  seller_name text not null,
  seller_phone text not null,
  vendor_address text not null,
  escrow_vault_address text not null,
  buyer_address text,
  buyer_name text,
  buyer_phone text,
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT', 'HELD_IN_ESCROW', 'DISPATCHED', 'FUNDS_RELEASED', 'DISPUTED')),
  fund_txid text,
  release_txid text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safe to re-run while migrating a database created by the EVM version.
alter table escrow_orders add column if not exists vendor_address text;
alter table escrow_orders add column if not exists escrow_vault_address text;
alter table escrow_orders add column if not exists buyer_address text;
alter table escrow_orders add column if not exists fund_txid text;
alter table escrow_orders add column if not exists release_txid text;
alter table escrow_orders add column if not exists paid_at timestamptz;

create table if not exists escrow_order_secrets (
  order_id uuid primary key references escrow_orders (id) on delete cascade,
  seller_secret_key text not null unique,
  created_at timestamptz not null default now()
);

alter table escrow_orders enable row level security;
alter table escrow_order_secrets enable row level security;

drop policy if exists "Anyone can read escrow orders" on escrow_orders;
create policy "Anyone can read escrow orders" on escrow_orders for select using (true);

drop policy if exists "Anyone can update escrow orders except release" on escrow_orders;
create policy "Anyone can update escrow orders except release"
  on escrow_orders for update
  using (status not in ('FUNDS_RELEASED'))
  with check (status not in ('FUNDS_RELEASED'));

-- Fund verification and payouts are service-role operations. The relayer
-- watches lightwalletd, decrypts the vault's incoming memo, and writes only
-- the verified transaction id and state transition here.
