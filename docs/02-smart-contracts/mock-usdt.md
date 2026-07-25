# Smart Contract: MockUSDT

## File

- `contracts/MockUSDT.sol`

## Purpose

`MockUSDT` is a lightweight ERC20-like token used for local lending and staking simulation.

## Token Configuration

- Name: `Mock USDT`
- Symbol: `mUSDT`
- Decimals: `6`

## Storage and Access Control

- `owner`: deployer address.
- `totalSupply`: total minted token amount.
- `balanceOf`: account balances.
- `allowance`: spender allowances.
- `onlyOwner` modifier protects minting.

## Exposed Behavior

- `mint(to, amount)`: owner-only mint function.
- `transfer(to, amount)`: direct transfer.
- `approve(spender, amount)`: set allowance.
- `transferFrom(from, to, amount)`: spend allowance and transfer.

Internal helper:

- `_transfer(from, to, amount)` checks non-zero recipient and sufficient sender balance.

## Events

- `Transfer(from, to, value)`
- `Approval(owner, spender, value)`

## How It Is Used in CryptoLend

- Deployment script mints initial liquidity to wallets.
- LendingPool contract receives token transfers for borrowing and staking actions.
- Frontend uses `approve` before staking and reads `balanceOf`/`allowance` for UX logic.
