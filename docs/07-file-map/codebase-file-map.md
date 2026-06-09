# Complete Codebase File Map

This map lists all key code/config files and their responsibilities.

## Root Files

- `package.json`: scripts, dependencies, and tooling commands.
- `hardhat.config.js`: Solidity compiler + network definitions.
- `next.config.ts`: Next.js runtime configuration.
- `tailwind.config.ts`: Tailwind scanning and theme tokens.
- `postcss.config.js`: PostCSS plugin setup.
- `tsconfig.json`: TypeScript strict settings and path aliases.
- `.eslintrc.json`: lint rule preset (`next/core-web-vitals`).
- `next-env.d.ts`: Next.js generated typings.
- `README.md`: project setup and usage guide.
- `.gitignore`: local/generated files excluded from git.

## Smart Contracts

- `contracts/MockUSDT.sol`: mock token with mint + transfer + approve/transferFrom.
- `contracts/LendingPool.sol`: borrow/stake/claim/unstake protocol logic.

## Scripts

- `scripts/deploy.js`: deploy contracts, seed balances, write deployment metadata.
- `scripts/clean-next-cache.js`: remove `.next` cache directory.

## Tests

- `test/LendingPool.test.js`: end-to-end behavior checks for contract flows.

## Prisma and Local Data

- `prisma/schema.prisma`: SQLite models for borrow/staking history.
- `prisma/dev.db`: SQLite local database file.

## Frontend App

- `src/app/layout.tsx`: app shell layout and metadata.
- `src/app/page.tsx`: full UI flow and transaction orchestration.
- `src/app/globals.css`: global styles.

## API Routes

- `src/app/api/borrow-history/route.ts`: read/write borrow history records.
- `src/app/api/staking-history/route.ts`: read/write staking history records.

## Frontend Libraries and Types

- `src/lib/contracts.ts`: deployment object, ABIs, deployment presence check.
- `src/lib/deployment.json`: generated deployed addresses/constants.
- `src/lib/prisma.ts`: singleton Prisma client getter.
- `src/types/ethereum.d.ts`: browser `window.ethereum` typing.

## Documentation Folder

- `docs/`: technical documentation organized by topic area.
