# Test Suite Documentation

## File

- `test/LendingPool.test.js`

## Test Strategy

The suite uses a reusable `deployFixture()` (via Hardhat Network Helpers `loadFixture`) to create
fresh, isolated protocol state for every test:

- Deploy `MockUSDT`, `MockToken` (BTC and SOL), `PriceOracle`, and `LendingPool`.
- Seed token balances for deployer, borrower, and liquidator.
- Fund the pool with 5 000 mUSDT and 1 000 ETH.
- Set ETH ($100), BTC ($65 000), and SOL ($150) oracle prices.
- Configure BTC (70 % LTV / 85 % threshold) and SOL (65 % LTV / 80 % threshold) as collateral assets.

This isolation ensures every test starts from the same state and assertions are fully deterministic.

## Covered Scenarios

### Deployment

1. Pool balance and ETH collateral reserve are correctly seeded.

### ETH Collateral Borrowing

2. Borrow within 70 % LTV emits `Borrowed` and updates balances correctly.
3. Borrow above max LTV reverts with `"Exceeds max LTV"`.
4. Borrow when pool has insufficient mUSDT reverts with `"Pool liquidity low"`.
5. Second borrow while an active loan exists reverts with `"Active loan exists"`.

### ERC-20 Collateral Borrowing (BTC / SOL)

6. BTC collateral borrow after approval emits `TokenBorrowed` and credits mUSDT.
7. SOL collateral borrow after approval works correctly.
8. BTC borrow above asset LTV reverts with `"Exceeds max LTV"`.
9. Token collateral borrow while ETH loan is active reverts with `"Active loan exists"`.

### Oracle Integration

10. Updating the oracle price at runtime changes `getCollateralValueUsdt()` output and allows
    borrowing a higher amount that was previously over the old-price LTV.

### Interest Accrual and Repayment

11. After one year, accrued interest matches expected 4 % APR calculation (within tolerance).
12. Full loan repayment (`repayFullLoan`) clears `borrowedUsdt` to 0 and emits `Repaid`.
13. Interest accrues by completed days only (no interest before the first full day has elapsed).
14. Repayment that does not cover accrued interest reverts with `"Repay interest first"`.

### Collateral Withdrawal

15. ETH collateral can be withdrawn after full repayment; `collateralWei` resets to 0.
16. BTC and SOL collateral returned correctly after full repayment of each respective loan.

### Liquidation

17. Liquidation of a healthy position (health factor > 1.1) reverts with `"Position healthy"`.
18. Treasury can liquidate when health factor drops to or below 1.1; collateral is seized with
    the 5 % bonus and debt is partially reduced per the 50 % close factor.

## Time-Based Testing

Chain time is advanced with:

```js
await ethers.provider.send("evm_increaseTime", [seconds]);
await ethers.provider.send("evm_mine");
```

This validates both per-day interest granularity and one-year APR scenarios.

## Assertion Patterns

- `to.emit(contract, "EventName")` — confirms intended on-chain actions fired.
- Direct state reads (`positions()`, `totalBorrowedUsdt()`) — validate balances and counters.
- `to.be.revertedWith("message")` — validates all protocol guardrails.
- `greaterThanOrEqual` / `lessThan` bounds — accommodate minor time-delta precision in interest.

## How to Run

```bash
npm run hardhat:test
```

No running node is needed; Hardhat's in-process network is used automatically.
