# TrustPay

TrustPay creates link-based escrow for social commerce. Payments use shielded
Zcash addresses and encrypted transaction memos so balances, payment history,
vendor revenue, and order metadata are not public on-chain.

## Architecture

- Orders store Zcash Unified or shielded addresses, ZEC amounts, status, and
  transaction ids in Supabase.
- A compatible browser wallet is exposed through `window.zcash`. Funding
  transactions send ZEC to the configured shielded vault and include a JSON
  order memo capped at Zcash's 512-byte encrypted memo limit.
- `ZCASH_RELAYER_URL` must point to a service backed by `lightwalletd`. The
  relayer verifies the incoming value and decrypted memo before `/fund` marks
  an order held. It also creates shielded vendor payouts from `/release`.
- Browser clients can use `/api/escrow/fund` as the stable funding endpoint;
  it delegates to the order-specific verifier.
- Sellers create a passwordless profile once from the home screen. The profile
  token is stored locally and can be copied as a `?sellerToken=` device-sync
  link; order creation then only asks for the item, ZEC amount, and delivery
  notes. Each order snapshots its payout address so later profile edits do not
  change existing orders.
- Seller and buyer state changes are recorded by the server API; no smart
  contract or EVM wallet is required.

## Configuration

Set these variables in `.env.local`:

```env
NEXT_PUBLIC_ZCASH_ESCROW_VAULT_ADDRESS=utest1qx0z2p4lm9xwh3fe6jc0nj6qfmyj5sd5tere2kvvgsgvp8phempuhtykfy4gy3qdkaxak60svsq409dg7auxmmeaqutrg6jgevpew9a3
NEXT_PUBLIC_ZCASH_EXPLORER_URL=https://zcashblockexplorer.com/tx
ZCASH_RELAYER_URL=https://your-relayer.example
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Apply [`supabase/schema.sql`](./supabase/schema.sql) to the database before
creating orders.

## Development

```bash
npm install
npm run dev
```

Validate a production build with:

```bash
npm run lint
npx tsc --noEmit
npm run build
```
