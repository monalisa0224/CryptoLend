# Smart Contract: LendingPool

## File

- `contracts/LendingPool.sol`

## Purpose

`LendingPool` is the protocol core handling:

- ETH-collateralized mUSDT borrowing.
- mUSDT staking and reward accounting.

## Core State

- `mockUsdt`: immutable token interface.
- `treasury`: contract deployer (metadata role in current implementation).
- `positions`: borrower loan positions.
- `stakedUsdt`: investor principal per wallet.
- `lastRewardAt`: timestamp checkpoint for reward accrual.
- `totalBorrowedUsdt`, `totalStakedUsdt`: aggregate protocol counters.
- `locked`: non-reentrancy guard.

## Constants

- `PRICE_USDT_PER_ETH = 100`
- `MAX_LTV_BPS = 7000`
- `INTEREST_BPS = 400`
- `STAKING_APY_BPS = 350`
- `BPS_DENOMINATOR = 10000`
- `YEAR_SECONDS = 365 days`

## Borrowing Logic

### Function: `borrowWithEthCollateral(uint256 borrowAmountUsdt)`

Checks:

- ETH collateral (`msg.value`) must be > 0.
- Borrow amount must be > 0.
- Borrow amount <= max LTV derived from collateral.
- Pool mUSDT balance must be sufficient.

Actions:

- Transfer mUSDT from pool to borrower.
- Increase borrower `positions[msg.sender]` collateral and borrowed values.
- Update `totalBorrowedUsdt`.
- Emit `Borrowed` event.

## Staking Logic

### Function: `stakeUsdt(uint256 amountUsdt)`

- Requires amount > 0.
- Computes pending reward first.
- If reward exists, sends reward immediately before adding new stake.
- Pulls principal from user with `transferFrom`.
- Increments user and protocol staked totals.
- Sets `lastRewardAt` to current block timestamp.

### Function: `unstakeUsdt(uint256 amountUsdt)`

- Requires amount > 0 and sufficient staked balance.
- Computes pending reward.
- Payout = principal + reward.
- Requires pool has enough token liquidity for payout.
- Decrements stake balances, updates timestamp, transfers payout.

### Function: `claimRewards()`

- Requires pending reward > 0.
- Requires pool reward reserve liquidity.
- Updates timestamp and transfers reward only.

## Reward and LTV Helpers

- `pendingRewardUsdt(investor)` computes linear APY over elapsed time.
- `getCollateralValueUsdt(collateralWei)` converts ETH to token value at constant price.
- `getMaxBorrowUsdt(collateralWei)` applies LTV ratio to collateral value.

## Security/Correctness Notes

- Uses simple `nonReentrant` lock around all state-changing transfer functions.
- Relies on pool token reserves for both loan and reward payouts.
- No liquidation, repayment, dynamic pricing, or interest accrual is implemented yet.
- `getPoolLiquidityUsdt()` and `getAvailableLiquidityUsdt()` currently return the same value.
