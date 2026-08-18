# Scripts and Configuration Documentation

## Runtime and Build Scripts (`package.json`)

### Frontend

- `npm run dev`: run Next.js in development mode.
- `npm run dev:clean`: remove `.next` cache then start dev server (use after stale-cache errors).
- `npm run build`: create production build.
- `npm run start`: run production server.
- `npm run lint`: run Next.js ESLint checks.

### Hardhat and Deployment

- `npm run hardhat:node`: start local Hardhat blockchain node on `http://127.0.0.1:8545`.
- `npm run hardhat:compile`: compile Solidity contracts to `artifacts/`.
- `npm run hardhat:test`: execute the full test suite.
- `npm run deploy:local`: deploy all contracts to the running Hardhat node and write `deployment.json`.
- `npm run oracle:update`: re-fetch CoinGecko prices and push them to the on-chain `PriceOracle`.

### Database

- `npm run db:push`: sync Prisma schema to the local SQLite database.
- `npm run db:studio`: open Prisma Studio for browsing/editing database records.

### Environment Notes

Windows scripts temporarily redirect `APPDATA` and `LOCALAPPDATA` to project-local folders so
Hardhat and Prisma tools use workspace-scoped configuration and avoid polluting user-level app data.

## Deployment Script (`scripts/deploy.js`)

Deployment sequence:

1. Resolve signers from the Hardhat node.
2. Deploy `MockUSDT` (6-decimal USDT stand-in).
3. Deploy `MockToken` twice: once for BTC (8 decimals) and once for SOL (9 decimals).
4. Deploy `PriceOracle`.
5. Deploy `LendingPool` with `mockUsdt` and `priceOracle` addresses.
6. Mint token balances to deployer, borrower, and up to 8 demo accounts.
7. Transfer 5 000 mUSDT to the pool as initial lending liquidity; send 1 000 ETH to the pool.
8. Fetch live CoinGecko prices for ETH, BTC, SOL and set them in `PriceOracle`.
9. Call `configureCollateralAsset` on `LendingPool` for BTC (70 % LTV, 85 % liquidation) and SOL (65 % LTV, 80 % liquidation).
10. Write `src/lib/deployment.json` with all contract addresses, asset metadata, and protocol constants.

`deployment.json` is the single source of truth consumed by the frontend for contract addresses and ABI wiring.

## Oracle Update Script (`scripts/update-oracle-prices.js`)

- Reads `priceOracle` address from existing `deployment.json`.
- Fetches fresh ETH/BTC/SOL prices from CoinGecko.
- Calls `PriceOracle.setPricesUsdt()` as the deployer (owner) signer.
- Useful for refreshing prices during a long-running demo session.

## Cache Utility (`scripts/clean-next-cache.js`)

- Removes `.next` folder if present.
- Used by `dev:clean` script as a pre-step to recover from stale local build artifacts.

## Hardhat Config (`hardhat.config.js`)

- Solidity version `0.8.24` with Yul optimizer enabled.
- Defines `hardhat` and `localhost` networks, both on chain ID `31337`.
- `localhost` network points to `http://127.0.0.1:8545` for use with a running `hardhat node`.

## Next.js and TypeScript Config

- `next.config.ts`
  - `reactStrictMode: true`
  - `outputFileTracingRoot` set to project root for correct static analysis of server bundles
- `tsconfig.json`
  - strict mode enabled
  - path alias: `@/* -> ./src/*`
  - `noEmit: true` (type-check only; Next.js handles compilation)

## Styling Config

- `tailwind.config.ts`: content glob covers `src/` and `components/`; custom colour tokens (`ink`, `line`, `mint`, `night`) and a `soft` drop-shadow utility.
- `postcss.config.js`: Tailwind + Autoprefixer plugin chain.
- `src/app/globals.css`: base reset, CSS custom properties, and global typography setup.

## Lint and Generated Typing Files

- `.eslintrc.json`: extends `next/core-web-vitals`.
- `next-env.d.ts`: Next.js generated typing references; **do not edit manually**.
