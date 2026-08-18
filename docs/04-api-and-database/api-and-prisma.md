# API Routes and Database Logic

## Files

- `src/app/api/borrow-history/route.ts`
- `src/app/api/staking-history/route.ts`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`

## Data Persistence Purpose

On-chain transactions are immutable, but this app also stores recent activity for easy UI display and assignment demonstration.

## Prisma Client Lifecycle

`src/lib/prisma.ts` provides `getPrisma()` using a global singleton pattern:

- Avoids creating many Prisma clients across hot reloads.
- Ensures API handlers reuse a shared client instance.

## Borrow History API

### GET `/api/borrow-history`

- Fetches latest 20 borrow rows.
- Orders by newest first (`createdAt desc`).

### POST `/api/borrow-history`

Required body fields:

- `walletAddress`, `collateralAmount`, `borrowAmount`, `txHash`

Behavior:

- Returns `400` if required fields are missing.
- Uses `upsert` by unique `txHash`.
- Prevents duplicate history rows for the same transaction hash.

## Staking History API

### GET `/api/staking-history`

- Fetches latest 20 staking rows ordered by latest timestamp.

### POST `/api/staking-history`

Required body fields:

- `walletAddress`, `action`, `amount`, `rewardAmount`, `txHash`

Behavior:

- Returns `400` on missing fields.
- Uses `upsert` by `txHash` for idempotent writes.

## Prisma Schema

### Model: `BorrowTransaction`

- `id` auto increment primary key.
- wallet/collateral/borrow/tx hash fields.
- `txHash` unique constraint.
- `createdAt` default current timestamp.

### Model: `StakingTransaction`

- Similar structure with `action`, `amount`, `rewardAmount`.
- `txHash` unique constraint for dedupe/idempotency.

## Design Notes

- Amount fields are stored as strings to preserve decimal formatting from UI submissions.
- APIs are simple and trust frontend shape; stronger schema validation can be added later.

SQLlite --> Query
