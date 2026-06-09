# Scripts and Configuration Documentation

## Runtime and Build Scripts (`package.json`)

### Frontend

- `npm run dev`: run Next.js in development mode.
- `npm run dev:clean`: remove `.next` cache, then run dev.
- `npm run build`: create production build.
- `npm run start`: run production server.
- `npm run lint`: run Next.js ESLint checks.

### Hardhat and Deployment

- `npm run hardhat:node`: start local blockchain.
- `npm run hardhat:compile`: compile Solidity contracts.
- `npm run hardhat:test`: execute test suite.
- `npm run deploy:local`: deploy to localhost Hardhat node.

### Database

- `npm run db:push`: sync Prisma schema to SQLite.
- `npm run db:studio`: open Prisma Studio.

### Environment Notes

Windows scripts temporarily redirect `APPDATA` and `LOCALAPPDATA` to project folders so Hardhat/Prisma tools run with local workspace-scoped app data.

## Deployment Script (`scripts/deploy.js`)

Deployment sequence:

1. Resolve signers from Hardhat node.
2. Deploy `MockUSDT`.
3. Deploy `LendingPool` with token address.
4. Mint token balances to deployer/demo accounts.
5. Fund pool with mUSDT and ETH.
6. Write `src/lib/deployment.json` used by frontend.

`deployment.json` becomes the source of truth for contract addresses and protocol constants in UI.

## Cache Utility (`scripts/clean-next-cache.js`)

- Removes `.next` folder if present.
- Used by `dev:clean` for recovery from stale local build artifacts.

## Hardhat Config (`hardhat.config.js`)

- Solidity version `0.8.24` with optimizer enabled.
- Defines `hardhat` and `localhost` networks on chain id `31337`.

## Next.js and TypeScript Config

- `next.config.ts`
  - `reactStrictMode: true`
  - `outputFileTracingRoot` set to project root
- `tsconfig.json`
  - strict mode enabled
  - path alias: `@/* -> ./src/*`
  - no emit (type-check only)

## Styling Config

- `tailwind.config.ts`: content globs, custom colors (`ink`, `line`, `mint`, `night`), custom shadow `soft`.
- `postcss.config.js`: Tailwind + Autoprefixer plugin chain.
- `src/app/globals.css`: base reset and global typography setup.

## Lint and Generated Typing Files

- `.eslintrc.json`: extends `next/core-web-vitals`.
- `next-env.d.ts`: Next.js generated typing references; should not be edited manually.
