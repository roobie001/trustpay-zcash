-- Migration: Add deposit_txid, funded_at, confirmations and unique index
alter table escrow_orders add column if not exists deposit_txid text;
alter table escrow_orders add column if not exists funded_at timestamptz;
alter table escrow_orders add column if not exists confirmations integer default 0;

-- Sync existing rows
update escrow_orders set deposit_txid = fund_txid where deposit_txid is null and fund_txid is not null;
update escrow_orders set funded_at = paid_at where funded_at is null and paid_at is not null;

-- Unique index on deposit_txid to prevent replay attacks across orders
create unique index if not exists idx_escrow_orders_deposit_txid on escrow_orders (deposit_txid) where deposit_txid is not null;
