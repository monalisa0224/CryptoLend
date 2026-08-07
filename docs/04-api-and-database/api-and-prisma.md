# API Routes and Database Logic

## Files

- `src/app/api/borrow-history/route.ts`
- `src/app/api/repay-history/route.ts`
- `src/app/api/staking-history/route.ts`
- `src/app/api/prices/route.ts`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`

## Data Persistence Purpose

On-chain transactions are immutable, but this app also stores recent activity for UI history display.
History entries are idempotent (upsert by `txHash`) so re-submits or hot-reload retries are safe.

## Prisma Client Lifecycle

`src/lib/prisma.ts` provides `getPrisma()` using a global singleton pattern:

- Avoids creating many Prisma clients across Next.js hot reloads in development.
- In production builds a fresh client is created once and reused.

## Borrow History API

### GET `/api/borrow-history?wallet=<address>`

- Fetches latest 20 borrow rows for the given wallet.
- `wallet` query param is optional; omitting it returns all rows (admin use).
- Orders by newest first (`createdAt desc`).

### POST `/api/borrow-history`

Required body fields:

| Field              | Type   | Notes                                  |
| ------------------ | ------ | -------------------------------------- |
| `walletAddress`    | string | Borrower address                       |
| `collateralSymbol` | string | Defaults to `"ETH"` if omitted         |
| `collateralAmount` | string | Amount as decimal string               |
| `borrowAmount`     | string | mUSDT amount as decimal string         |
| `txHash`           | string | On-chain transaction hash (unique key) |

- Returns `400` if required fields are missing.
- `upsert` by `txHash` — duplicate POSTs for the same hash are ignored (`update: {}`).

## Repay History API

### GET `/api/repay-history?wallet=<address>`

- Fetches latest 20 repay rows for the wallet.

### POST `/api/repay-history`

Required body fields:

| Field           | Type   | Notes                        |
| --------------- | ------ | ---------------------------- |
| `walletAddress` | string | Borrower address             |
| `amount`        | string | Total amount repaid          |
| `interestPaid`  | string | Defaults to `"0"` if omitted |
| `principalPaid` | string | Defaults to `"0"` if omitted |
| `txHash`        | string | Unique key                   |

- Returns `400` if `walletAddress`, `amount`, or `txHash` are missing.

## Staking History API

### GET `/api/staking-history?wallet=<address>`

- Fetches latest 20 staking rows ordered by latest timestamp.

### POST `/api/staking-history`

Required body fields:

| Field           | Type   | Notes                              |
| --------------- | ------ | ---------------------------------- |
| `walletAddress` | string | Investor address                   |
| `action`        | string | One of `STAKE`, `UNSTAKE`, `CLAIM` |
| `amount`        | string | Principal amount                   |
| `rewardAmount`  | string | Reward included in the action      |
| `txHash`        | string | Unique key                         |

- Returns `400` on missing fields.
- `rewardAmount` is checked for `undefined` (allows `"0"`).

## Prices API

### GET `/api/prices`

- Fetches live ETH/BTC/SOL prices in USD from CoinGecko.
- Response is revalidated every 60 seconds via Next.js cache headers.
- Returns `{ source: "coingecko", prices: { ethereum, bitcoin, solana } }` on success.
- Returns `{ source: "unavailable", prices: {} }` with HTTP 502 if CoinGecko is unreachable.
- Frontend uses these prices for UI-only collateral value estimates; the on-chain `PriceOracle` is the authoritative source for contract calculations.

## Prisma Schema

### Model: `BorrowTransaction`

- `id` auto-increment PK.
- `walletAddress`, `collateralSymbol` (default `ETH`), `collateralAmount`, `borrowAmount`, `txHash`, `createdAt`.
- `txHash` has a `@unique` constraint for idempotent upserts.

### Model: `RepayTransaction`

- `id` auto-increment PK.
- `walletAddress`, `amount`, `interestPaid`, `principalPaid`, `txHash`, `createdAt`.
- `txHash` `@unique`.

### Model: `StakingTransaction`

- `id` auto-increment PK.
- `walletAddress`, `action`, `amount`, `rewardAmount`, `txHash`, `createdAt`.
- `txHash` `@unique`.

## Design Notes

- Amount fields are stored as strings to avoid floating-point precision loss from UI input.
- API routes trust the frontend request shape; additional schema validation (e.g. Zod) can be added if the API becomes public-facing.
- No authentication is implemented; the API is intended for local demo use only.
