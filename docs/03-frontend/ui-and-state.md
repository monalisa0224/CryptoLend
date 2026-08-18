# Frontend UI and State Logic

## Primary Files

- `src/app/page.tsx`: thin entry point that renders `<HomeRouteView />`.
- `src/components/defi-state.tsx`: **all application state** — wallet, balances, protocol metrics, transaction actions, and history. The `DefiProvider` component wraps the whole app and exposes a `useDefi()` hook.
- `src/components/defi-views.tsx`: view routing (home / lend / stake / admin panels).
- `src/components/lending-view.tsx`, `staking-view.tsx`, etc.: individual panel UIs consuming `useDefi()`.

## State Architecture

All state lives in `DefiProvider` (a React Context in `defi-state.tsx`). It is split into:

| Category         | Key State Fields                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Wallet identity  | `account`, `isTreasury`                                                                                 |
| Balances         | `ethBalance`, `usdtBalance`, `assetBalances` (ETH/BTC/SOL)                                              |
| Allowances       | `usdtAllowance`, `assetAllowances`                                                                      |
| Protocol metrics | `poolLiquidity`, `totalBorrowed`, `totalStaked`, `protocolReserveUsdt`, `stakingApyBps`, `borrowApyBps` |
| User position    | `position.{collateral, borrowed, accruedInterest, totalDebt, staked, pendingReward}`, `tokenCollateral` |
| Live prices      | `prices` (from `/api/prices` → CoinGecko), `priceSource`                                                |
| Form inputs      | `collateralAmount`, `borrowAmount`, `repayAmount`, `stakeAmount`, `unstakeAmount`, `liquidityAmount`    |
| UX state         | `status`, `error`, `isBusy`, `isShaking`, `isMessageClosing`                                            |
| History          | `borrowHistory`, `repayHistory`, `stakingHistory`                                                       |

## Supported Collateral Assets

The app supports three collateral types loaded from `deployment.json` at startup:

- `ETH` (native, 18 decimals, 70 % LTV)
- `BTC` (ERC-20 `MockToken`, 8 decimals, 70 % LTV)
- `SOL` (ERC-20 `MockToken`, 9 decimals, 65 % LTV)

The `selectedAsset` in state controls which asset the borrow form targets. ERC-20 assets require a separate approval step before borrowing.

## Transaction Pipeline Logic

### 1) Connect Wallet

- Uses `BrowserProvider(window.ethereum)`, requests accounts.
- `ensureHardhatNetwork()` switches MetaMask to chain `31337` if needed (adds it if missing).
- Stores address; runs full refresh of balances, protocol metrics, and all history.

### 2) Refresh Reads

- `refreshProtocol()` reads pool-level metrics from local RPC (no wallet needed).
- `refreshBalances()` reads user ETH/USDT/token balances, allowances, loan position, and staking data. It also calls `refreshProtocol()` internally to keep protocol metrics in sync.
- `refreshBorrowHistory()`, `refreshRepayHistory()`, `refreshStakingHistory()` fetch persisted records from Next.js API routes.
- Prices are polled every 60 seconds via `refreshPrices()` → `/api/prices`.

### 3) Approve Collateral (ERC-20 only)

- If `selectedAsset.type === "erc20"` and collateral amount exceeds current allowance, `approveCollateral()` sends an `approve()` transaction to the token contract.

### 4) Borrow

- `validateBorrow()` checks: active loan guard, valid decimal format, gas buffer for ETH, ERC-20 balance sufficiency, live price availability, safe max borrow ceiling, pool liquidity.
- A `staticCall` pre-flight catches contract reverts before spending gas.
- Calls `borrowWithEthCollateral` or `borrowWithTokenCollateral` depending on asset type.
- On success, persists record to POST `/api/borrow-history` and refreshes all state.

### 5) Repay

- `repayPosition(amount)` is the primary repay handler:
  - If the amount is within tolerance of total debt, it auto-routes to `repayFullLoan()` + `withdrawAllCollateral()`.
  - Otherwise, calls `repayUsdt(amount)` for partial repayment.
  - Auto-approves mUSDT if allowance is insufficient before sending the repay tx.
  - Stores repay record to POST `/api/repay-history`.
- `repayLoan()` and `repayFullLoan()` are older single-purpose helpers (still wired to their views).

### 6) Withdraw Collateral

- `withdrawCollateral()` calls `withdrawAllCollateral()` on the pool.
- Guard: loan must be fully repaid (`position.borrowed == 0`).

### 7) Approve and Stake

- `approveStake()` calls `MockUSDT.approve(pool, amount)`.
- `stake()` enforces allowance, calls `stakeUsdt(amount)`, writes `STAKE` record to staking history API.

### 8) Claim and Unstake

- `claimRewards()`: pending reward > 0 required; writes `CLAIM` record.
- `unstake()`: validates amount ≤ staked; treasury wallet has an extra liquidity guard check.
  Writes `UNSTAKE` record with reward captured before the tx.

### 9) Treasury Admin Functions

- `addLiquidity()`: treasury-only; adds mUSDT reserves to the pool.
- `withdrawReserve()`: treasury-only; withdraws claimable protocol reserve earnings.
- `setAssetLiquidationThreshold()`: treasury-only; calls on-chain setter and persists to `localStorage` cache.

## Derived UI Calculations (Frontend-Only)

Computed in useMemo hooks for instant feedback:

- `collateralValue = collateralAmount * selectedLivePrice` (live oracle price)
- `maxBorrow = collateralValue * ltvBps / 10000`
- `safeMaxBorrow = maxBorrow * 0.995` (0.5 % safety margin)
- `healthFactor = (collateralValue * liquidationThresholdBps / 10000) / borrowAmount`
- `dailyReward`, `yearlyReward` from staking APY
- `portfolioValue` = sum of all asset balances × live prices + mUSDT balance

> These are guidance values only; the Solidity contract checks are authoritative.

## Supporting Frontend Files

- `src/app/layout.tsx`: app shell metadata and root HTML layout.
- `src/app/globals.css`: global styles and font baseline.
- `src/lib/contracts.ts`: deployment JSON, full ABIs, and `hasDeployment()` check.
- `src/types/ethereum.d.ts`: TypeScript declarations for `window.ethereum` injected provider.
- `src/lib/prisma.ts`: singleton Prisma client for API routes.
- `src/components/app-shell.tsx`: top navigation and layout wrapper.
- `src/components/theme-initializer.tsx`: synchronises dark/light theme from `localStorage` before first paint (avoids flash).
