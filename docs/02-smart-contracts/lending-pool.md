# Smart Contract: LendingPool

## File

- `contracts/LendingPool.sol`

## Purpose

`LendingPool` is the protocol core handling:

- ETH and ERC-20 collateralised mUSDT borrowing.
- Day-granular interest accrual and partial/full loan repayment.
- Collateral withdrawal after repayment.
- mUSDT staking with continuous reward accrual.
- Treasury-only liquidation of under-collateralised positions.
- Protocol reserve accumulation and treasury reserve withdrawal.

## Core State

| Variable              | Type                                              | Purpose                                                |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `mockUsdt`            | `IERC20Token` (immutable)                         | The mUSDT token used for all transfers                 |
| `priceOracle`         | `IPriceOracle` (immutable)                        | Live price source for collateral valuation             |
| `treasury`            | `address` (immutable)                             | Deployer; guards admin functions via `onlyTreasury`    |
| `positions`           | `mapping(address => LoanPosition)`                | Per-borrower ETH collateral + debt + timestamp         |
| `collateralAssets`    | `mapping(bytes32 => CollateralAsset)`             | ERC-20 collateral configs (LTV, liquidation threshold) |
| `tokenCollateral`     | `mapping(address => mapping(bytes32 => uint256))` | Per-user ERC-20 collateral balances                    |
| `stakedUsdt`          | `mapping(address => uint256)`                     | Per-investor staked principal                          |
| `lastRewardAt`        | `mapping(address => uint256)`                     | Per-investor reward accrual checkpoint                 |
| `protocolReserveUsdt` | `uint256`                                         | Accumulated interest reserve (10 % reserve factor)     |
| `totalBorrowedUsdt`   | `uint256`                                         | Aggregate outstanding loan principal                   |
| `totalStakedUsdt`     | `uint256`                                         | Aggregate staked principal                             |
| `locked`              | `bool`                                            | Simple non-reentrancy guard                            |

## Constants

| Constant                        | Value    | Meaning                                              |
| ------------------------------- | -------- | ---------------------------------------------------- |
| `MAX_LTV_BPS`                   | 7000     | 70 % max loan-to-value for ETH/BTC collateral        |
| `INTEREST_BPS`                  | 400      | 4 % APR borrow interest (day-granular)               |
| `STAKING_APY_BPS`               | 350      | 3.5 % APY staking reward (per-second)                |
| `RESERVE_FACTOR_BPS`            | 1000     | 10 % of interest goes to protocol reserve            |
| `LIQUIDATION_BONUS_BPS`         | 500      | 5 % bonus collateral seized during liquidation       |
| `LIQUIDATION_CLOSE_FACTOR_BPS`  | 5000     | 50 % max debt repayable per liquidation call         |
| `LIQUIDATION_HEALTH_FACTOR_BPS` | 11000    | Health factor ≤ 1.1 triggers eligibility             |
| `BPS_DENOMINATOR`               | 10000    | Basis point denominator for all rate math            |
| `YEAR_SECONDS`                  | 365 days | Seconds in a year (used in reward/interest formulas) |

## Borrowing Logic

### `borrowWithEthCollateral(uint256 borrowAmountUsdt) payable`

- Rejects if borrower has an existing active loan.
- Reads ETH/USD price from `priceOracle` to value collateral.
- Enforces `borrowAmount <= collateralValue * MAX_LTV_BPS / 10000`.
- Checks pool has sufficient mUSDT.
- Transfers mUSDT to borrower, updates `positions[msg.sender]` and `totalBorrowedUsdt`.
- Emits `Borrowed` event.

### `borrowWithTokenCollateral(bytes32 assetId, uint256 collateralAmount, uint256 borrowAmountUsdt)`

- Checks collateral asset is configured and enabled.
- Uses asset-specific LTV from `collateralAssets[assetId].ltvBps`.
- Pulls ERC-20 token collateral from borrower with `transferFrom`.
- Same single-active-loan guard as ETH borrow.
- Emits `TokenBorrowed` event.

## Repayment Logic

### `repayUsdt(uint256 amountUsdt)`

- Partial or full repay against an active loan.
- Requires `amountUsdt >= accruedInterest` (interest must be covered first).
- 10 % of interest paid is deposited into `protocolReserveUsdt`.
- Reduces `position.borrowedUsdt` by the principal component.
- Emits `Repaid` event.

### `repayFullLoan()`

- Calculates total debt at call time (principal + interest) and pulls it all in one transfer.
- Clears `position.borrowedUsdt` to 0.
- Emits `Repaid` event.
- After this, `withdrawAllCollateral()` becomes available.

### `withdrawAllCollateral()`

- Guards: `position.borrowedUsdt` must be 0.
- Returns ETH (via `.call`) and all registered ERC-20 collateral tokens.
- Emits `CollateralWithdrawn` event.

## Staking Logic

### `stakeUsdt(uint256 amountUsdt)`

- Pulls mUSDT from user.
- Calls `_stake()` which auto-claims pending reward before adding new principal.
- Resets `lastRewardAt[user]` to current block.
- Emits `Staked` and optionally `RewardClaimed` events.

### `unstakeUsdt(uint256 amountUsdt)`

- Computes pending reward; payout = principal + reward.
- Treasury wallet is subject to `_enforceLiquidityGuard()` before withdrawal.
- Decrements staked balances and transfers payout.
- Emits `Unstaked` and optionally `RewardClaimed` events.

### `claimRewards()`

- Transfers only pending reward; does not touch staked principal.
- Updates `lastRewardAt[msg.sender]`.
- Emits `RewardClaimed`.

## Liquidation Logic

### `liquidate(address borrower, bytes32 assetId, uint256 repayAmountUsdt)` — treasury only

1. Reads health factor from `getBorrowerRiskData(borrower)`.
2. Reverts if health factor > `LIQUIDATION_HEALTH_FACTOR_BPS` (1.1).
3. Caps repay to 50 % of total debt (close factor) unless repaying in full.
4. Calls `previewLiquidation()` to compute `seizeAmount = (repay + 5 % bonus) / oraclePrice`.
5. Pulls mUSDT from treasury via `transferFrom`, calls `_applyDebtPayment()`, then `_seizeCollateral()` to send collateral to treasury.
6. Emits `Liquidated` event.

## Key View Functions

| Function                                       | Description                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `pendingRewardUsdt(investor)`                  | Per-second linear APY reward since `lastRewardAt`                |
| `getAccruedInterestUsdt(borrower)`             | Day-granular borrow interest since `positions.updatedAt`         |
| `getTotalDebtUsdt(borrower)`                   | Principal + accrued interest                                     |
| `getBorrowerRiskData(borrower)`                | Returns collateral value, liquidation value, debt, health factor |
| `previewLiquidation(borrower, assetId, repay)` | Preview collateral seize amount and bonus for a liquidation      |
| `getCollateralValueUsdt(wei)`                  | ETH collateral → mUSDT value using oracle                        |
| `getTokenCollateralValueUsdt(assetId, amount)` | ERC-20 collateral → mUSDT value using oracle                     |
| `getMaxBorrowUsdt(wei)`                        | ETH collateral → max borrowable mUSDT                            |
| `getAvailableLiquidityUsdt()`                  | Pool balance minus protocol reserve                              |
| `getCompanyTreasuryUsdt()`                     | Treasury staked + pending reward + claimable reserve             |

## Liquidity Safety Mechanisms

- `_enforceLiquidityGuard(outflow)` is called before any treasury withdrawal or unstake.
  It ensures: available pool liquidity after withdrawal can still cover all outstanding loans AND meets `minLiquidityBufferBps`.
- `minReserveUsdt` keeps a floor of protocol reserve that cannot be withdrawn.
- `protocolReserveUsdt` tracks accumulated interest kept inside the pool.

## Security Notes

- `nonReentrant` modifier wraps all state-changing functions that transfer funds.
- `onlyTreasury` guards admin operations (configure assets, liquidate, withdraw reserve).
- Interest is day-granular (not per-second) to reduce precision drift.
- `staticCall` pre-flight checks in frontend catch contract reverts before submitting real transactions.
