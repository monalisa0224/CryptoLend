# Frontend UI and State Logic

## Primary File

- `src/app/page.tsx` is the entire main page, transaction orchestrator, and history display.

## UI Modes

The app swaps between three views using local state:

- `home`: strategy selection + high-level portfolio summary.
- `lending`: collateral/borrow workflow and borrow history.
- `staking`: approve/stake/claim/unstake workflow and staking history.

## State Model

`page.tsx` tracks:

- Wallet identity: `account`.
- Wallet balances: `ethBalance`, `usdtBalance`.
- Contract data: `allowance`, `poolLiquidity`, `poolCollateral`, `totalBorrowed`, `totalStaked`.
- Position data: collateral, borrowed amount, staked amount, pending reward.
- Form input state: collateral, borrow, stake, unstake amounts.
- UX state: `status`, `error`, `isBusy`.
- History arrays from API: borrow and staking history.

## Transaction Pipeline Logic

### 1) Connect Wallet

- Uses `BrowserProvider(window.ethereum)`.
- Requests accounts.
- If chain is not Hardhat (`31337`), requests wallet network add/switch.
- Stores selected address and refreshes balances.

### 2) Refresh Reads

- `refreshProtocol()` reads pool-level metrics from local RPC.
- `refreshBalances()` reads user balances/allowance/position from contracts.
- `refreshBorrowHistory()` and `refreshStakingHistory()` read persisted records from APIs.

### 3) Borrow

- Local validation before tx:
  - collateral > 0
  - collateral <= wallet ETH - gas buffer
  - borrow > 0
  - borrow <= computed max borrow
  - borrow <= pool liquidity
- Sends `borrowWithEthCollateral(borrowAmountUsdt)` with ETH value.
- On receipt, persists record to `/api/borrow-history`.
- Refreshes wallet/protocol/history state.

### 4) Approve and Stake

- `approveStake()` calls `MockUSDT.approve(pool, amount)`.
- `stake()` enforces approval first, then calls `stakeUsdt(amount)`.
- On receipt, writes staking action (`STAKE`) to API.

### 5) Claim and Unstake

- `claimRewards()` requires pending reward > 0 and calls `claimRewards()`.
- `unstake()` validates amount <= staked and calls `unstakeUsdt(amount)`.
- Both actions write records to `/api/staking-history`.

## Derived UI Calculations

Computed in frontend for instant feedback:

- `collateralValue = collateralAmount * 100`
- `maxBorrow = collateralValue * 0.7`
- `healthFactor = maxBorrow / borrowAmount`
- reward estimate from APY for daily/yearly display

These are guidance values; Solidity contract checks are authoritative.

## Supporting Frontend Files

- `src/app/layout.tsx`: app metadata and root HTML layout.
- `src/app/globals.css`: global styles and font baseline.
- `src/lib/contracts.ts`: deployment object and minimal ABIs.
- `src/types/ethereum.d.ts`: typing for `window.ethereum` provider hooks.
