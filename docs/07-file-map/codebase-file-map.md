# Complete Codebase File Map

This map lists all key code/config files and their responsibilities.

## Root Files

- `package.json`: scripts, dependencies, and tooling commands.
- `hardhat.config.js`: Solidity compiler settings (v0.8.24, Yul optimizer) and network definitions.
- `next.config.ts`: Next.js runtime configuration (strict mode, output tracing root).
- `tailwind.config.ts`: Tailwind content globs and custom colour/shadow tokens.
- `postcss.config.js`: PostCSS plugin setup (Tailwind + Autoprefixer).
- `tsconfig.json`: TypeScript strict settings and `@/*` path alias.
- `.eslintrc.json`: lint rule preset (`next/core-web-vitals`).
- `next-env.d.ts`: Next.js generated typings — do not edit.
- `README.md`: project setup and usage guide.
- `.gitignore`: local/generated files excluded from git.

## Smart Contracts

- `contracts/MockUSDT.sol`: 6-decimal mock USDT token; owner-only mint; used as the lending/staking denomination.
- `contracts/MockToken.sol`: generic configurable ERC-20 used to simulate BTC (8 dec) and SOL (9 dec) collateral.
- `contracts/PriceOracle.sol`: owner-controlled on-chain price registry (mUSDT per asset); queried by `LendingPool`.
- `contracts/LendingPool.sol`: full protocol — multi-collateral borrow, interest accrual, repayment, staking, liquidation, protocol reserve.

## Scripts

- `scripts/deploy.js`: deploy all four contracts, seed demo balances, fetch CoinGecko prices, configure collateral assets, write `deployment.json`.
- `scripts/update-oracle-prices.js`: refresh PriceOracle with live CoinGecko prices without redeploying.
- `scripts/clean-next-cache.js`: remove `.next` cache directory.

## Tests

- `test/LendingPool.test.js`: end-to-end behaviour checks covering ETH/token collateral borrow, repayment, oracle integration, interest, liquidation, and staking lifecycle.

## Prisma and Local Data

- `prisma/schema.prisma`: SQLite models for `BorrowTransaction`, `RepayTransaction`, and `StakingTransaction`.
- `prisma/dev.db`: SQLite local database file (git-ignored).

## Frontend App

- `src/app/layout.tsx`: root HTML layout, metadata, `<DefiProvider>` and `<ThemeInitializer>` wrappers.
- `src/app/page.tsx`: entry point — renders `<HomeRouteView />`.
- `src/app/globals.css`: global CSS reset, custom properties, typography.

## API Routes

- `src/app/api/borrow-history/route.ts`: GET/POST borrow transaction records (idempotent by txHash).
- `src/app/api/repay-history/route.ts`: GET/POST repay transaction records.
- `src/app/api/staking-history/route.ts`: GET/POST staking/unstake/claim records.
- `src/app/api/prices/route.ts`: GET live ETH/BTC/SOL prices from CoinGecko (60 s cache).

## Frontend Components

- `src/components/defi-state.tsx`: **central state layer** — `DefiProvider` context with all wallet, protocol, and transaction logic; exposes `useDefi()` hook.
- `src/components/defi-views.tsx`: top-level view router (home / lend / stake / admin panels).
- `src/components/lending-view.tsx`: collateral selection, borrow, repay, and withdraw collateral UI.
- `src/components/staking-view.tsx`: approve/stake/claim/unstake UI.
- `src/components/liquidation-admin-view.tsx`: treasury liquidation management panel.
- `src/components/liquidity-admin-view.tsx`: treasury liquidity funding and reserve management.
- `src/components/app-shell.tsx`: top navigation bar and overall page shell.
- `src/components/animated-background.tsx`: decorative animated canvas background.
- `src/components/background-beams.tsx`: additional visual effect component.
- `src/components/theme-initializer.tsx`: reads saved theme from `localStorage` and applies it before first paint to avoid flash of wrong theme.

## Frontend Libraries and Types

- `src/lib/contracts.ts`: `DEPLOYMENT` object, full `LENDING_POOL_ABI`, `MOCK_USDT_ABI`, `PRICE_ORACLE_ABI`, and `hasDeployment()` guard.
- `src/lib/deployment.json`: generated at deploy time; contains contract addresses, asset list, and protocol constants.
- `src/lib/prisma.ts`: singleton Prisma client getter (global pattern for hot-reload safety).
- `src/types/ethereum.d.ts`: TypeScript declarations for `window.ethereum` injected provider.

## Dashboard Pages

- `src/app/dashboard/history/page.tsx`: transaction history view.
- `src/app/dashboard/protocol/page.tsx`: protocol health and statistics.
- `src/app/dashboard/transactions/page.tsx`: detailed transaction explorer.
- `src/app/lend/page.tsx`: lending route page entry.
- `src/app/stake/page.tsx`: staking route page entry.
- `src/app/admin/liquidation/page.tsx`: liquidation admin entry.
- `src/app/admin/liquidity/page.tsx`: liquidity admin entry.

## Documentation Folder

- `docs/`: technical documentation organised by topic area (see `docs/README.md` for the full index).
