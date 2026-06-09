# CryptoLend Documentation

This folder contains structured technical documentation for the whole project.

## Documentation Index

1. [Project Overview](./01-overview/architecture.md)
2. [Smart Contracts: MockUSDT](./02-smart-contracts/mock-usdt.md)
3. [Smart Contracts: LendingPool](./02-smart-contracts/lending-pool.md)
4. [Frontend App Logic](./03-frontend/ui-and-state.md)
5. [API and Database](./04-api-and-database/api-and-prisma.md)
6. [Scripts and Tooling Config](./05-scripts-and-config/scripts-and-config.md)
7. [Test Suite Explanation](./06-testing/lendingpool-tests.md)
8. [Complete Codebase File Map](./07-file-map/codebase-file-map.md)

## Quick Reading Path

- If you are new to the codebase: start with Overview -> Frontend -> Smart Contracts.
- If you are debugging API/history data: read API and Database, then Frontend.
- If you are validating blockchain behavior: read LendingPool and Test Suite.

## Scope

These docs cover:

- Runtime architecture and data flow.
- Smart contract logic and formulas.
- Frontend state and transaction logic.
- Next.js API routes and Prisma schema behavior.
- Deployment/testing scripts and project configuration files.
- A file-by-file responsibility map for fast onboarding.
