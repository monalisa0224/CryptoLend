# Test Suite Documentation

## File

- `test/LendingPool.test.js`

## Test Strategy

The suite uses a reusable `deployFixture()` to create fresh protocol state for each test:

- Deploy contracts.
- Mint token balances.
- Seed LendingPool with mUSDT liquidity and ETH collateral reserve.

This isolates test behavior and keeps assertions deterministic.

## Covered Scenarios

1. Deployment and initial liquidity correctness.
2. Successful borrow at max allowed LTV boundary example.
3. Revert when requested borrow exceeds max LTV.
4. Revert when borrow exceeds pool liquidity.
5. Successful staking with prior token approval.
6. Revert when staking above wallet balance.
7. Reward claim after one simulated year.
8. Unstake principal plus reward after one simulated year.

## Time-Based Reward Testing

The suite advances chain time via:

- `evm_increaseTime`
- `evm_mine`

This verifies reward math over one full year and checks values are within expected tolerance ranges.

## Assertion Patterns

- Event emission assertions (`to.emit`) confirm intended on-chain actions.
- Direct storage/state reads confirm balances and aggregate counters.
- Revert assertions validate protocol guardrails.

## Why This Matters

These tests validate the most important behaviors for the assignment demo:

- Lending safety checks.
- Liquidity constraints.
- Staking lifecycle correctness.
- Reward distribution consistency.
